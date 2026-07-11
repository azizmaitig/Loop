/**
 * execute-phases.ts — shared phase execution for loop.ts runLoop() and tick().
 *
 * Both callers construct an ExecutionDeps and call executePhaseGroup(),
 * extracting ~50 LOC of duplication from each.
 *
 * executePhaseGroup reports phase outcomes through deps.onPhaseFailed (the
 * failTerminal recovery seam) and persists a checkpoint after every completed
 * phase. Recovery/guard logic lives in recovery.ts (ADR-0009).
 */

import { evaluatePhase } from './evaluate.js';
import { executeHooks } from './plugins.js';
import type { Plugin, HookContext } from './plugins.js';
import { RecoveryStrategy } from './recovery.js';
import { updatePhaseResult } from './state.js';
import type { PhaseDef, PhaseResult, LoopState, LoopConfig, PlanYamlDoc } from './types.js';
import { logPhaseContext } from './memory-hooks.js';
import { runCommand } from './shell.js';
import { appendRunLog } from './run-log.js';
import type { RunLogEntry } from './run-log.js';

/** Everything executePhaseGroup needs from the caller's context. */
export interface ExecutionDeps {
  config: LoopConfig;
  plugins: Plugin[];
  writeState(state: LoopState): Promise<void>;
  onPhaseFailed(phase: PhaseDef, result: PhaseResult): void;
  /** Optional: path to plan file for checkpoint persistence */
  planPath?: string;
  /** Optional: getter for the active plan doc (needed for checkpoint planName) */
  getPlanDoc?: () => PlanYamlDoc | null;
  /** Optional: path to run-log.md for structured log entries */
  logPath?: string;
}

/** Result of a phase execution group (one iteration's phases). */
export interface PhaseGroupResult {
  allPassed: boolean;
  state: LoopState;
}

/**
 * Execute all phases for one iteration.
 *
 * Shared by:
 * - runLoop()   in loop.ts (single-run mode)
 * - tick()      in loop.ts (daemon/interval mode)
 *
 * Does NOT handle state machine transitions — the caller manages those.
 */
export async function executePhaseGroup(
  deps: ExecutionDeps,
  state: LoopState,
  iteration: number,
): Promise<PhaseGroupResult> {
  let allPassed = true;

  for (const phase of deps.config.phases) {
    try { process.stdout.write(`[${iteration}/${deps.config.maxIterations}] ${phase.name}... `); } catch {} // CI without TTY

    // Plugin hooks: onPhaseStart
    const prePluginResults = await executeHooks('onPhaseStart', { phase, state }, deps.plugins);
    let pluginResults: Record<string, unknown> = { ...prePluginResults };

    logPhaseContext(phase, deps.config);

    const phaseStart = Date.now();
    const result = await executeShellCommand(phase.command, phase.timeoutMs);

    // Produces gate: if phase declared a produces file, verify it exists (and optionally non-empty)
    if (result.status === 'pass' && phase.produces) {
      try {
        const { existsSync, statSync } = await import('node:fs');
        if (!existsSync(phase.produces)) {
          result.status = 'fail';
          result.stderr = `Produces gate: file "${phase.produces}" was not created by phase "${phase.name}"`;
        } else if (phase.producedMustHaveContent && statSync(phase.produces).size === 0) {
          result.status = 'fail';
          result.stderr = `Produces gate: file "${phase.produces}" is empty after phase "${phase.name}"`;
        }
      } catch (err) {
        result.status = 'fail';
        result.stderr = `Produces gate: error checking artifact "${phase.produces}": ${err instanceof Error ? err.message : String(err)}`;
      }
    }

    // Plugin hooks: onPhaseEnd or onError
    if (result.status === 'error') {
      const errResults = await executeHooks('onError', { phase, state, error: new Error(result.stderr) }, deps.plugins);
      Object.assign(pluginResults, errResults);
    } else {
      const postPluginResults = await executeHooks('onPhaseEnd', { phase, result, state }, deps.plugins);
      Object.assign(pluginResults, postPluginResults);
    }
    result.pluginResults = pluginResults;

    // ponytail: evaluation failure should not crash the loop
    try {
      const judgment = await evaluatePhase(phase, result);
      result.judgment = judgment;
    } catch {
      // Non-fatal
    }

    const totalPhaseMs = Date.now() - phaseStart;
    state = updatePhaseResult(state, phase.name, result);

    // Log result with real wall-clock duration (shell + LLM eval)
    if (result.status === 'pass') {
      console.log(`PASS (${totalPhaseMs}ms)`);
    } else if (result.status === 'fail') {
      allPassed = false;
      console.log(`FAIL (${totalPhaseMs}ms)`);
      if (result.stderr) console.error(`  stderr: ${result.stderr}`);
      if (result.stdout) console.error(`  stdout: ${result.stdout}`);
    } else {
      allPassed = false;
      console.log(`ERROR (${totalPhaseMs}ms)`);
      if (result.stderr) console.error(`  error: ${result.stderr}`);
    }

    if (result.status !== 'pass') {
      // ADR-0011 heal seam: phases with healCommand get up to maxRetries heal
      // attempts (re-run phase command); success bypasses failTerminal.
      if (phase.healCommand) {
        const { healed } = await RecoveryStrategy.healAndRetry(
          {
            taskQueue: { fail: () => {}, get: () => undefined } as never,
            broadcast: () => {},
            runCommand: (cmd: string, timeoutMs?: number) =>
              runCommand(cmd, { timeoutMs }),
          },
          phase,
          result,
          { healCommand: phase.healCommand, maxRetries: phase.maxRetries ?? 1 },
        );
        if (healed) {
          console.log(`HEALED (${totalPhaseMs}ms)`);
          await deps.writeState(state);
          continue;
        }
      }
      deps.onPhaseFailed(phase, result);
    }

    // ── Save checkpoint after every completed phase ──
    if (result.status === 'pass' && deps.planPath && deps.getPlanDoc) {
      const planDoc = deps.getPlanDoc();
      if (planDoc) {
        try {
          const { saveCheckpoint, loadCheckpoint } = await import('./checkpoint.js');
          const existingCp = loadCheckpoint(planDoc.planName);
          const completedIds = Object.entries(state.phaseResults || {})
            .filter(([, r]) => r.status === 'pass')
            .map(([name]) => name);
          const mergedIds = [...new Set([
            ...(existingCp?.completedTaskIds ?? []),
            ...completedIds,
          ])];
          await saveCheckpoint({
            planPath: deps.planPath,
            planName: planDoc.planName,
            startedAt: existingCp?.startedAt ?? new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            completedTaskIds: mergedIds,
            inProgressTaskId: null,
            results: Object.fromEntries(
              Object.entries(state.phaseResults).map(([name, r]) => [
                name,
                { status: r.status, durationMs: r.durationMs, exitCode: r.exitCode },
              ]),
            ),
          });
        } catch (e) {
          console.error('[checkpoint] Save failed (non-fatal):', e);
        }
      }
    }

    await deps.writeState(state);

    // ── Write run-log entry (structured JSON, real data) ──
    if (deps.logPath) {
      try {
        const planName = deps.getPlanDoc?.()?.planName ?? deps.config.taskName ?? 'unknown';
        const entry: RunLogEntry = {
          run_id: new Date().toISOString(),
          pattern: planName,
          runs_count: state.iteration,
          outcome: result.status === 'pass' ? 'pass' : result.status === 'fail' ? 'fail' : 'error',
          timestamp: new Date().toISOString(),
          duration_ms: totalPhaseMs,
        };
        await appendRunLog(deps.logPath, entry);
      } catch {
        // non-fatal: log write failures should not crash the loop
      }
    }
  }

  return { allPassed, state };
}

// ── Shell command executor ────────────────────────────────────────────────────

async function executeShellCommand(
  command: string,
  timeoutMs?: number,
): Promise<PhaseResult> {
  const startTime = Date.now();

  try {
    const result = await runCommand(command, { timeoutMs });
    return {
      status: result.exitCode === 0 ? 'pass' : 'fail',
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      durationMs: result.durationMs,
      evidencePath: '',
    };
  } catch (err) {
    return {
      status: 'error',
      exitCode: -1,
      stdout: '',
      stderr: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startTime,
      evidencePath: '',
    };
  }
}
