import { describe, expect, test } from "bun:test";
import { runCommand } from "../src/shell.js";

const isWin = process.platform === 'win32';

const describeWin = isWin
  ? describe
  : describe.skip;

// ── Regression: shell quoting with paths containing spaces ─────────────────────
//
// GAP B discovery: buildShellArgs previously wrapped the command in
// `cmd.exe /d /c "<command>"`. Windows cmd re-parses the post-`/c` string and
// STRIPS embedded double quotes, so any `--dir "D:\path with spaces"` got
// truncated at the first space ("Failed to change directory to D:\path").
// The fix writes the command to a temp `.cmd` file (primary parser preserves
// quotes) instead of re-parsing through `cmd /c`.
//
// This test asserts the fix: a quoted argument containing spaces must survive
// intact, AND no "Failed to change directory" style truncation must occur.

const ARGV_PROBE = `
  const a = process.argv.slice(2);
  console.log(JSON.stringify(a));
`;

function writeProbe(): string {
  const path = `/tmp/agent-loop-shell-probe-${Math.random().toString(36).slice(2)}.mjs`;
  Bun.write(path, ARGV_PROBE);
  return path;
}

describeWin("runCommand quoting with paths containing spaces", () => {
  test("preserves a quoted arg containing spaces (cmd /c re-parse regression)", async () => {
    const probe = writeProbe();
    try {
      const command = `node "${probe}" "hello world" --dir "C:/path with spaces/app"`;
      const result = await runCommand(command, { timeoutMs: 15000 });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).not.toMatch(/Failed to change directory/i);

      const argv = JSON.parse(result.stdout) as string[];
      expect(argv).toEqual(["hello world", "--dir", "C:/path with spaces/app"]);
    } finally {
      try {
        Bun.file(probe).delete?.();
      } catch {
        /* best-effort */
      }
    }
  });

  test("preserves the vault path shape (obsidian\\second brain) used by opencode stages", async () => {
    const probe = writeProbe();
    try {
      const vaultPath = "D:\\projects\\obsidian\\second brain\\10-Projects\\11-Active\\loop-factory\\first-test";
      const command = `node "${probe}" "design the app" --dir "${vaultPath}"`;
      const result = await runCommand(command, { timeoutMs: 15000 });

      expect(result.exitCode).toBe(0);
      const argv = JSON.parse(result.stdout) as string[];
      expect(argv).toEqual(["design the app", "--dir", vaultPath]);
    } finally {
      try {
        Bun.file(probe).delete?.();
      } catch {
        /* best-effort */
      }
    }
  });
});
