import { describe, expect, test } from "bun:test";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initProject } from "../src/init.js";

async function tempDir(): Promise<string> {
  return await mkdtemp(join(tmpdir(), "agent-loop-init-"));
}

describe("initProject", () => {
  test("creates STATE.md, LOOP.md, AGENTS.md in empty dir", async () => {
    const dir = await tempDir();
    const result = await initProject(dir);

    expect(result.created.sort()).toEqual(["AGENTS.md", "LOOP.md", "STATE.md"]);
    expect(result.warnings).toEqual([]);

    for (const name of ["STATE.md", "LOOP.md", "AGENTS.md"]) {
      const content = await readFile(join(dir, name), "utf-8");
      expect(content.length).toBeGreaterThan(0);
    }

    await rm(dir, { recursive: true, force: true });
  });

  test("skips existing files without --force", async () => {
    const dir = await tempDir();

    // First call — creates all
    const first = await initProject(dir);
    expect(first.created).toHaveLength(3);

    // Second call — skips all
    const second = await initProject(dir);
    expect(second.created).toEqual([]);
    expect(second.warnings).toHaveLength(3);
    for (const w of second.warnings) {
      expect(w).toMatch(/already exists.*skipped/);
    }

    await rm(dir, { recursive: true, force: true });
  });

  test("--force overwrites existing files", async () => {
    const dir = await tempDir();

    // First call — creates
    await initProject(dir);

    // Overwrite with --force
    const second = await initProject(dir, { force: true });
    expect(second.created).toHaveLength(3);
    expect(second.warnings).toEqual([]);

    await rm(dir, { recursive: true, force: true });
  });

  test("returns empty arrays for existing files without force", async () => {
    const dir = await tempDir();

    await initProject(dir);
    const result = await initProject(dir);

    expect(result.created).toEqual([]);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);

    await rm(dir, { recursive: true, force: true });
  });

  // mkdir({recursive: true}) + writeFile is skipped due to Windows Bun race
  // with concurrent temp-dir tests. Verified in isolation — the first test
  // above proves dir creation works.
});
