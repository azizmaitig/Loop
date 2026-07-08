/**
 * shell.ts — unified shell command execution.
 *
 * Consolidates 3 previous implementations (execute-phases.ts, worktree.ts,
 * task-processor.ts) into a single depthful module with timeout support,
 * platform detection, and reusable safety checks.
 *
 * @module shell
 */

import { executeWithTimeout } from './safety.js';
import { platform } from 'node:os';

// ── Types ────────────────────────────────────────────────────────────────────

export interface RunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface RunOptions {
  /** Timeout in milliseconds (default: no timeout) */
  timeoutMs?: number;
  /** Working directory (default: process.cwd()) */
  cwd?: string;
}

// ── Safety checks ─────────────────────────────────────────────────────────────

const UNSAFE_CMD_CHARS = /[;&|`$\n\r]/;
const UNSAFE_PATH_CHARS = /[;&|`$()\n\r]/;

/**
 * Check whether a shell command string contains unsafe metacharacters.
 * Prevents command injection via the daemon's HTTP API.
 */
export function isSafeCommand(cmd: string): boolean {
  return !UNSAFE_CMD_CHARS.test(cmd);
}

/**
 * Check whether a filesystem path contains unsafe shell metacharacters.
 * More restrictive than isSafeCommand (also blocks parens).
 */
export function isSafePath(path: string): boolean {
  return !UNSAFE_PATH_CHARS.test(path);
}

// ── Platform helpers ──────────────────────────────────────────────────────────

function isWindows(): boolean {
  return platform() === 'win32';
}

function buildShellArgs(command: string): string[] {
  return isWindows() ? ['cmd.exe', '/c', command] : ['/bin/sh', '-c', command];
}

// ── Unified shell execution ─────────────────────────────────────────────────────

/**
 * Run a shell command and capture stdout/stderr/exit code.
 *
 * Features:
 * - Platform-aware shell selection (cmd.exe on Windows, /bin/sh on Unix)
 * - Optional hard timeout via AbortController (throws PhaseTimeoutError)
 * - Optional working directory
 *
 * @returns RunResult with exitCode, trimmed stdout/stderr, and wall-clock durationMs
 */
export async function runCommand(command: string, opts?: RunOptions): Promise<RunResult> {
  const startTime = Date.now();
  const args = buildShellArgs(command);

  const execute = async (signal?: AbortSignal): Promise<RunResult> => {
    const proc = Bun.spawn(args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
      cwd: opts?.cwd,
    });

    const [stdout, stderr] = await Promise.all([
      Bun.readableStreamToText(proc.stdout),
      Bun.readableStreamToText(proc.stderr),
    ]);
    const exitCode = await proc.exited;

    return {
      exitCode,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
      durationMs: Date.now() - startTime,
    };
  };

  if (opts?.timeoutMs && opts.timeoutMs > 0) {
    return executeWithTimeout(execute, opts.timeoutMs, command);
  }

  return execute();
}
