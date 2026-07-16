import { describe, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

import { applyOutputBounds, cleanupRunOutput, PHASE_OUTPUT_TAIL } from '../src/output-store.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSmallOutput(size: number): string {
  return 'A'.repeat(size);
}

function makeLargeOutput(): string {
  return 'X'.repeat(PHASE_OUTPUT_TAIL + 100);
}

function tempDir(): string {
  return mkdtempSync(resolve(tmpdir(), 'output-store-test-'));
}

// ── applyOutputBounds ─────────────────────────────────────────────────────────

describe('applyOutputBounds', () => {
  test('small stdout (<=2000) stays inline — no path set, no file written', () => {
    const output = makeSmallOutput(100);
    const result = applyOutputBounds('test-phase', 1, 'test-run', { stdout: output, stderr: '' });

    expect(result.stdout).toBe(output);
    expect(result.stdout.length).toBe(100);
    expect(result.stdoutPath).toBeUndefined();
    expect(result.stderr).toBe('');
    expect(result.stderrPath).toBeUndefined();
  });

  test('small stderr (<=2000) stays inline — no path set', () => {
    const errOutput = makeSmallOutput(50);
    const result = applyOutputBounds('test-phase', 1, 'test-run', { stdout: '', stderr: errOutput });

    expect(result.stderr).toBe(errOutput);
    expect(result.stderrPath).toBeUndefined();
  });

  test('large stdout (>2000) offloaded to disk with tail retained', () => {
    const fullOutput = makeLargeOutput();
    const dir = tempDir();

    try {
      const result = applyOutputBounds('big-phase', 1, 'big-run', { stdout: fullOutput, stderr: '' }, dir);

      // Inline tail is exactly PHASE_OUTPUT_TAIL chars
      expect(result.stdout.length).toBe(PHASE_OUTPUT_TAIL);
      expect(result.stdout).toBe(fullOutput.slice(0, PHASE_OUTPUT_TAIL));

      // Path is set
      expect(result.stdoutPath).toBeDefined();
      expect(result.stdoutPath).toContain('1-big-phase.stdout.log');

      // File on disk contains the FULL original output
      const onDisk = readFileSync(result.stdoutPath!, 'utf-8');
      expect(onDisk).toBe(fullOutput);

      // stderr unchanged (empty)
      expect(result.stderr).toBe('');
      expect(result.stderrPath).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('large stderr (>2000) offloaded to disk with tail retained', () => {
    const fullErrOutput = makeLargeOutput();
    const dir = tempDir();

    try {
      const result = applyOutputBounds('err-phase', 2, 'err-run', { stdout: '', stderr: fullErrOutput }, dir);

      expect(result.stderr.length).toBe(PHASE_OUTPUT_TAIL);
      expect(result.stderr).toBe(fullErrOutput.slice(0, PHASE_OUTPUT_TAIL));
      expect(result.stderrPath).toBeDefined();
      expect(result.stderrPath).toContain('2-err-phase.stderr.log');

      const onDisk = readFileSync(result.stderrPath!, 'utf-8');
      expect(onDisk).toBe(fullErrOutput);

      expect(result.stdout).toBe('');
      expect(result.stdoutPath).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('both stdout and stderr can be large simultaneously', () => {
    const fullOutput = makeLargeOutput();
    const fullErrOutput = makeLargeOutput();
    const dir = tempDir();

    try {
      const result = applyOutputBounds('both', 3, 'both-run', { stdout: fullOutput, stderr: fullErrOutput }, dir);

      expect(result.stdout.length).toBe(PHASE_OUTPUT_TAIL);
      expect(result.stdoutPath).toBeDefined();
      expect(readFileSync(result.stdoutPath!, 'utf-8')).toBe(fullOutput);

      expect(result.stderr.length).toBe(PHASE_OUTPUT_TAIL);
      expect(result.stderrPath).toBeDefined();
      expect(readFileSync(result.stderrPath!, 'utf-8')).toBe(fullErrOutput);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('slugifies special characters in phaseName and runName', () => {
    const output = makeLargeOutput();
    const dir = tempDir();

    try {
      const result = applyOutputBounds('my phase!@#$', 1, 'my run/with:chars', { stdout: output, stderr: '' }, dir);

      expect(result.stdoutPath).toBeDefined();
      // Space becomes one dash, !@#$ become four dashes — total 5 dashes after 'my'
      expect(result.stdoutPath).toContain('my-phase----');
      expect(result.stdoutPath).toContain('1-my-phase----');
      // run dir also slugified: "my run/with:chars" -> "my-run-with-chars"
      expect(result.stdoutPath).toContain('my-run-with-chars');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ── cleanupRunOutput ──────────────────────────────────────────────────────────

describe('cleanupRunOutput', () => {
  test('removes the runs directory for a given runName', () => {
    const output = makeLargeOutput();
    const dir = tempDir();

    try {
      // Create the offload file via applyOutputBounds
      applyOutputBounds('phase', 1, 'cleanup-test', { stdout: output, stderr: '' }, dir);

      const runsPath = resolve(dir, 'runs', 'cleanup-test');
      expect(existsSync(runsPath)).toBe(true);

      // Run cleanup
      cleanupRunOutput('cleanup-test', dir);

      // Directory is removed
      expect(existsSync(runsPath)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('does not throw when run does not exist', () => {
    const dir = tempDir();

    try {
      // Should not throw
      expect(() => cleanupRunOutput('nonexistent', dir)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
