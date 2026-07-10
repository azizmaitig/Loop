import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Daemon } from "../src/daemon.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

function seedTask(base: string, id: string, status: string, overrides: Record<string, unknown> = {}) {
  const dir = join(base, "_loop-history", id);
  mkdirSync(dir, { recursive: true });
  const entry = {
    task: { id, command: "test", status, createdAt: new Date().toISOString(), completedAt: new Date().toISOString(), ...overrides },
    phases: [],
  };
  writeFileSync(join(dir, "task.json"), JSON.stringify(entry, null, 2));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/metrics", () => {
  test("returns computed metrics from seeded history and budget from run-log", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "metrics-test-"));
    const now = new Date().toISOString();

    try {
      // Seed 5 completed tasks with known durations
      const durations = [100, 200, 300, 400, 500];
      for (let i = 0; i < 5; i++) {
        seedTask(tempDir, `task-00${i + 1}`, "completed", {
          durationMs: durations[i],
          completedAt: now,
        });
      }
      // Seed 2 failed tasks
      seedTask(tempDir, "task-006", "failed", { completedAt: now });
      seedTask(tempDir, "task-007", "failed", { completedAt: now });
      // Seed 1 cancelled task → counts as error
      seedTask(tempDir, "task-008", "cancelled", { completedAt: now });

      // Seed loop-run-log.md for budget
      const logContent = [
        "# Loop Run Log — Test",
        "",
        "## Recent Runs",
        "",
        "<!-- Loop appends below this line -->",
        JSON.stringify({ run_id: "test-1", pattern: "test", runs_count: 3, outcome: "pass", timestamp: now, duration_ms: 100 }),
        JSON.stringify({ run_id: "test-2", pattern: "test", runs_count: 5, outcome: "pass", timestamp: now, duration_ms: 200 }),
        "",
      ].join("\n");
      writeFileSync(join(tempDir, "loop-run-log.md"), logContent, "utf-8");

      const d = new Daemon(0, tempDir);
      const startPromise = d.start();
      await new Promise((r) => setTimeout(r, 300));

      try {
        const resp = await fetch(`http://localhost:${d.getState().port}/api/metrics`);
        expect(resp.status).toBe(200);
        const body = await resp.json();

        expect(body).toHaveProperty("taskMetrics");
        expect(body).toHaveProperty("budget");
        expect(body).toHaveProperty("triggers");
        expect(body.triggers).toEqual([]);

        const tm = body.taskMetrics;

        expect(tm.totalRuns).toBe(8);
        expect(tm.lastN).toBe(100);

        expect(tm.passCount).toBe(5);
        expect(tm.failCount).toBe(2);
        expect(tm.errorCount).toBe(1);

        expect(tm.avgDurationMs).toBe(300);
        expect(tm.p50DurationMs).toBe(300);
        expect(tm.p95DurationMs).toBe(500);

        expect(tm.throughputWindowMinutes).toBe(60);
        expect(tm.throughputTasksPerMin).toBeCloseTo(8 / 60, 5);

        const bg = body.budget;
        expect(bg.status).toBe("ok");
        expect(bg.runsToday).toBe(8);
        expect(bg.cap).toBe(100);
        expect(bg.remaining).toBe(92);
      } finally {
        d.stop();
        await startPromise;
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("respects window and lastN query params", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "metrics-params-"));
    const now = new Date().toISOString();

    try {
      for (let i = 0; i < 5; i++) {
        seedTask(tempDir, `task-00${i + 1}`, "completed", { durationMs: 100, completedAt: now });
      }
      seedTask(tempDir, "task-006", "failed", { completedAt: now });
      seedTask(tempDir, "task-007", "failed", { completedAt: now });
      seedTask(tempDir, "task-008", "cancelled", { completedAt: now });

      writeFileSync(join(tempDir, "loop-run-log.md"), `# Log\n\n<!-- Loop appends below this line -->\n${JSON.stringify({ run_id: "t", pattern: "t", runs_count: 1, outcome: "pass", timestamp: now, duration_ms: 0 })}\n`, "utf-8");

      const d = new Daemon(0, tempDir);
      const startPromise = d.start();
      await new Promise((r) => setTimeout(r, 300));

      try {
        const resp = await fetch(`http://localhost:${d.getState().port}/api/metrics?lastN=5&window=10m`);
        expect(resp.status).toBe(200);
        const body = await resp.json();
        expect(body.taskMetrics.lastN).toBe(5);
        expect(body.taskMetrics.throughputWindowMinutes).toBe(10);
        expect(body.taskMetrics.throughputTasksPerMin).toBeCloseTo(5 / 10, 5);

        const resp2 = await fetch(`http://localhost:${d.getState().port}/api/metrics?window=24h&lastN=100`);
        expect(resp2.status).toBe(200);
        const body2 = await resp2.json();
        expect(body2.taskMetrics.throughputWindowMinutes).toBe(1440);
      } finally {
        d.stop();
        await startPromise;
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test("returns zeros and nulls when no history exists", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "metrics-empty-"));
    const d = new Daemon(0, tempDir);
    const startPromise = d.start();
    await new Promise((r) => setTimeout(r, 300));

    try {
      const resp = await fetch(`http://localhost:${d.getState().port}/api/metrics`);
      expect(resp.status).toBe(200);
      const body = await resp.json();
      const tm = body.taskMetrics;

      expect(tm.totalRuns).toBe(0);
      expect(tm.passCount).toBe(0);
      expect(tm.failCount).toBe(0);
      expect(tm.errorCount).toBe(0);
      expect(tm.avgDurationMs).toBeNull();
      expect(tm.p50DurationMs).toBeNull();
      expect(tm.p95DurationMs).toBeNull();
      expect(tm.throughputTasksPerMin).toBe(0);
    } finally {
      d.stop();
      await startPromise;
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
