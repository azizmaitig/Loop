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
import { writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

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

/**
 * Build the spawn args for a command.
 *
 * Windows caveat: `cmd.exe /c "<command>"` (the previous implementation)
 * re-parses the post-`/c` string through cmd's legacy quote-handling, which
 * STRIPS embedded double quotes. Any argument containing a space — e.g. a
 * `--dir "D:\path with spaces"` passed to `opencode run` — gets truncated at
 * the first space ("Failed to change directory to D:\path").
 *
 * Fix: write the command verbatim to a temp `.cmd` file and execute that file.
 * cmd reads a `.cmd` file with its PRIMARY parser (not the `/c` re-parse), so
 * every embedded quote and space is preserved exactly as authored. This mirrors
 * how typing the command directly into a shell works. The temp file is removed
 * after the process exits.
 *
 * Unix is unaffected: `/bin/sh -c <command>` handles quoted args correctly.
 */
function buildShellArgs(command: string): { cmd: string[]; shell: boolean; cleanup?: () => void } {
  if (isWindows()) {
    const tmpPath = join(tmpdir(), `agent-loop-${randomUUID()}.cmd`);
    // @echo off suppresses cmd's command-echo so stdout carries only the
    // program's own output (callers parse stdout).
    writeFileSync(tmpPath, `@echo off\r\n${command}`, { encoding: 'utf8' });
    const cleanup = () => {
      try {
        unlinkSync(tmpPath);
      } catch {
        /* best-effort cleanup */
      }
    };
    return { cmd: ['cmd.exe', '/d', '/c', tmpPath], shell: false, cleanup };
  }
  return { cmd: ['/bin/sh', '-c', command], shell: false };
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
  const { cmd: args, shell, cleanup } = buildShellArgs(command);

  const execute = async (signal?: AbortSignal): Promise<RunResult> => {
    const proc = Bun.spawn(args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
      cwd: opts?.cwd,
      shell,
    });

    const [stdout, stderr] = await Promise.all([
      Bun.readableStreamToText(proc.stdout),
      Bun.readableStreamToText(proc.stderr),
    ]);
    const exitCode = await proc.exited;

    cleanup?.();

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
