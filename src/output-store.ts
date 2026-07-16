/**
 * output-store.ts — bounded phase output offload.
 *
 * When a phase produces more than `PHASE_OUTPUT_TAIL` chars of stdout or stderr,
 * the full output is written to disk under `_agent-loop-output/runs/<runName>/`.
 * The in-memory fields hold only the tail; `stdoutPath`/`stderrPath` point to the
 * offload files.
 *
 * Small outputs (≤ PHASE_OUTPUT_TAIL) stay inline — no file IO, no path set.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OUTPUT_DIR } from './constants.js';

/** Maximum chars of stdout/stderr kept in memory per phase. Full output is offloaded to disk when exceeded. */
export const PHASE_OUTPUT_TAIL = 2000;

/**
 * Slugify a string for safe filesystem use.
 * Replaces any character not in `[a-zA-Z0-9_-]` with `-`.
 */
function slugify(text: string): string {
  return text.replace(/[^a-zA-Z0-9_-]/g, '-');
}

/**
 * Apply output bounds to a phase result.
 *
 * When `result.stdout` exceeds `PHASE_OUTPUT_TAIL`, the full stdout is written to
 * `_agent-loop-output/runs/<runName>/<iteration>-<phaseName>.stdout.log`, the
 * in-memory `stdout` is replaced with the tail, and `stdoutPath` is set.
 * Same for stderr (`.stderr.log`).
 *
 * Small outputs (≤ PHASE_OUTPUT_TAIL) are not offloaded — kept inline only.
 *
 * @param phaseName  The phase name (slugified for the filename).
 * @param iteration  The iteration number (1-based, used in the filename).
 * @param runName    The run identifier (planName or taskName, slugified for the dir).
 * @param result     The raw phase output (stdout, stderr strings).
 * @param outputDir  Optional override for the base output directory (defaults to OUTPUT_DIR). Used by tests.
 */
export function applyOutputBounds(
  phaseName: string,
  iteration: number,
  runName: string,
  result: { stdout: string; stderr: string },
  outputDir?: string,
): { stdout: string; stderr: string; stdoutPath?: string; stderrPath?: string } {
  const baseDir = outputDir ?? OUTPUT_DIR;
  const safeRunName = slugify(runName);
  const safePhaseName = slugify(phaseName);

  let stdout = result.stdout;
  let stderr = result.stderr;
  let stdoutPath: string | undefined;
  let stderrPath: string | undefined;

  if (stdout.length > PHASE_OUTPUT_TAIL) {
    const runsDir = resolve(baseDir, 'runs', safeRunName);
    mkdirSync(runsDir, { recursive: true });
    stdoutPath = resolve(runsDir, `${iteration}-${safePhaseName}.stdout.log`);
    writeFileSync(stdoutPath, stdout, 'utf-8');
    stdout = stdout.slice(0, PHASE_OUTPUT_TAIL);
  }

  if (stderr.length > PHASE_OUTPUT_TAIL) {
    const runsDir = resolve(baseDir, 'runs', safeRunName);
    mkdirSync(runsDir, { recursive: true });
    stderrPath = resolve(runsDir, `${iteration}-${safePhaseName}.stderr.log`);
    writeFileSync(stderrPath, stderr, 'utf-8');
    stderr = stderr.slice(0, PHASE_OUTPUT_TAIL);
  }

  return { stdout, stderr, stdoutPath, stderrPath };
}

/**
 * Remove the offload directory for a run.
 * Best-effort — swallows errors (e.g. dir doesn't exist, permissions).
 */
export function cleanupRunOutput(runName: string, outputDir?: string): void {
  try {
    const baseDir = outputDir ?? OUTPUT_DIR;
    const runsDir = resolve(baseDir, 'runs', slugify(runName));
    rmSync(runsDir, { recursive: true, force: true });
  } catch {
    // best-effort: swallow errors
  }
}
