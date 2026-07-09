/**
 * recovery.ts — unified recovery + guard seam (ADR-0009).
 *
 * Two distinct hook points replaced the old inline "command failed → now what"
 * sprawl:
 *
 *   Guard (pre-execution)   — "should this run at all?"
 *     Budget cap (report-only / exceeded), pause, and command safety all gate
 *     execution. A guard outcome of "no" means the task never executes.
 *     cancel-report is a GUARD outcome, not a recovery.
 *
 *   RecoveryStrategy (post-execution)
 *     "now that this ran and did not pass, what next?"
 *     - failTerminal: mark failed + broadcast (WIRED)
 *     - healAndRetry: run a fix command, re-run the verify phase (DEFINED, UNWIRED)
 *
 * healAndRetry is intentionally left without a live caller. The dead heal block
 * in execute-phases.ts was deleted rather than revived, because we do not know
 * whether its original unwiring was accident or intent. Wiring heal later is a
 * ~5-line mapping addition in plan-executor.ts, not a redesign.
 *
 * @module recovery
 */

import type { PhaseDef, PhaseResult, Task } from "./types.js";
import type { TaskQueue } from "./task-queue.js";

// ── Guard (pre-execution) ─────────────────────────────────────────────────────

export interface GuardContext {
  baseDir: string;
  isPaused: () => Promise<boolean>;
  isSafeCommand: (command: string) => boolean;
}

export interface GuardDecision {
  /** false = do not run; the task is cancelled/reported, not executed. */
  run: boolean;
  /** Present only when run === false; human-readable cancel reason. */
  reason?: string;
}

/**
 * Pre-execution gate. Covers budget (via the caller-supplied budgetStatus),
 * pause, and command safety. A "no" decision means the task never executes —
 * which is why cancel-report belongs here, not in RecoveryStrategy.
 */
export const Guard = {
  async shouldRun(
    ctx: GuardContext,
    task: Task,
    budgetStatus: "ok" | "report_only" | "exceeded",
  ): Promise<GuardDecision> {
    if (budgetStatus === "exceeded") {
      return { run: false, reason: `budget exceeded, task skipped (${task.id})` };
    }
    if (budgetStatus === "report_only") {
      return { run: false, reason: `budget: report-only mode, task skipped (${task.id})` };
    }
    if (await ctx.isPaused()) {
      return { run: false, reason: "daemon paused, task skipped" };
    }
    if (!ctx.isSafeCommand(task.command)) {
      return { run: false, reason: "Command rejected: unsafe shell metacharacters detected" };
    }
    return { run: true };
  },
};

// ── RecoveryStrategy (post-execution) ─────────────────────────────────────────

export interface RecoveryContext {
  taskQueue: TaskQueue;
  broadcast: (type: string, data: unknown) => void;
  /** Injectable shell runner (healing re-runs a fix command). */
  runCommand?: (command: string, timeoutMs?: number) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
  }>;
  getPlanDoc?: () => unknown;
}

export interface HealConfig {
  healCommand: string;
  maxRetries: number;
}

export const RecoveryStrategy = {
  /**
   * Terminal failure: mark the task failed and broadcast completion.
   * This is the only wired recovery variant.
   */
  failTerminal(ctx: RecoveryContext, task: Task, error: string): void {
    ctx.taskQueue.fail(task.id, error);
    ctx.broadcast("task_completed", ctx.taskQueue.get(task.id));
  },

  /**
   * Defined but UNWIRED. Runs healCommand up to maxRetries times; on a heal
   * success, re-runs the verify phase. If the verify passes, mutates `result`
   * in place to a passing state and returns { healed: true }.
   *
   * No live caller exists in execute-phases.ts or task-processor.ts. Reviving
   * it requires mapping healCommand/maxRetries through plan-executor.ts (ADR-0009).
   */
  async healAndRetry(
    ctx: RecoveryContext,
    phase: PhaseDef,
    result: PhaseResult,
    heal: HealConfig,
  ): Promise<{ healed: boolean }> {
    if (!ctx.runCommand) return { healed: false };
    for (let attempt = 1; attempt <= heal.maxRetries; attempt++) {
      const healResult = await ctx.runCommand(heal.healCommand, phase.timeoutMs);
      if (healResult.exitCode !== 0) continue;
      const retry = await ctx.runCommand(phase.command, phase.timeoutMs);
      if (retry.exitCode === 0) {
        result.status = "pass";
        result.exitCode = retry.exitCode;
        result.stdout = retry.stdout;
        result.stderr = retry.stderr;
        result.durationMs = retry.durationMs;
        result.judgment = undefined;
        return { healed: true };
      }
    }
    return { healed: false };
  },
};
