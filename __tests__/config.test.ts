import { describe, expect, test } from "bun:test";
import {
  DEFAULT_CONFIG,
  mergeConfig,
} from "../src/config.js";
import type { LoopConfig } from "../src/types.js";

describe("DEFAULT_CONFIG", () => {
  test("maxIterations is 3", () => {
    expect(DEFAULT_CONFIG.maxIterations).toBe(3);
  });

  test("phaseTimeoutMs is 60000", () => {
    expect(DEFAULT_CONFIG.phaseTimeoutMs).toBe(60000);
  });

  test("taskName is 'default-task'", () => {
    expect(DEFAULT_CONFIG.taskName).toBe("default-task");
  });

  test("phases is empty array", () => {
    expect(DEFAULT_CONFIG.phases).toEqual([]);
  });
});

describe("mergeConfig", () => {
  test("returns base config when override is empty", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {});
    expect(merged.maxIterations).toBe(DEFAULT_CONFIG.maxIterations);
    expect(merged.phaseTimeoutMs).toBe(DEFAULT_CONFIG.phaseTimeoutMs);
    expect(merged.taskName).toBe(DEFAULT_CONFIG.taskName);
  });

  test("preserves values from override", () => {
    const override: Partial<LoopConfig> = {
      taskName: "custom-task",
      phaseTimeoutMs: 30000,
    };
    const merged = mergeConfig(DEFAULT_CONFIG, override);
    expect(merged.taskName).toBe("custom-task");
    expect(merged.phaseTimeoutMs).toBe(30000);
    expect(merged.maxIterations).toBe(DEFAULT_CONFIG.maxIterations);
  });

  test("overrides maxIterations when below cap", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { maxIterations: 5 });
    expect(merged.maxIterations).toBe(5);
  });

  test("enforces hard cap of 20 for maxIterations", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { maxIterations: 50 });
    expect(merged.maxIterations).toBe(20);
  });

  test("enforces hard cap of 20 at the boundary", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { maxIterations: 20 });
    expect(merged.maxIterations).toBe(20);
  });

  test("enforces hard cap of 20 with negative value", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { maxIterations: -5 });
    expect(merged.maxIterations).toBe(-5);
  });

  test("merges phases from override", () => {
    const phases = [
      { name: "lint", command: "", expectedExitCode: 0, timeoutMs: 60000 },
    ];
    const merged = mergeConfig(DEFAULT_CONFIG, { phases });
    expect(merged.phases).toEqual(phases);
  });

  test("override does not mutate base config", () => {
    const origIterations = DEFAULT_CONFIG.maxIterations;
    mergeConfig(DEFAULT_CONFIG, { maxIterations: 10 });
    expect(DEFAULT_CONFIG.maxIterations).toBe(origIterations);
  });
});
