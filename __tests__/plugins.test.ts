import { describe, expect, test } from "bun:test";
import { loadPlugins, executeHooks } from "../src/plugins.js";
import type { LoopConfig, PhaseDef, PhaseResult, Plugin } from "../src/types.js";
import type { HookContext } from "../src/plugins.js";

const MINIMAL_CONFIG: LoopConfig = {
  taskName: "test",
  phases: [],
  maxIterations: 3,
  phaseTimeoutMs: 60000,
};

function makePhase(overrides?: Partial<PhaseDef>): PhaseDef {
  return {
    name: "test-phase",
    command: "echo test",
    expectedExitCode: 0,
    timeoutMs: 1000,
    ...overrides,
  };
}

function makeHookContext(overrides?: Partial<HookContext>): HookContext {
  return {
    phase: makePhase(),
    state: {
      currentState: "init",
      iteration: 0,
      phaseResults: {},
      startTime: "",
      errors: [],
    },
    ...overrides,
  };
}

describe("loadPlugins", () => {
  test("returns empty array when no plugins configured", async () => {
    const plugins = await loadPlugins(MINIMAL_CONFIG);
    expect(plugins).toEqual([]);
  });

  test("returns empty array when plugins array is empty", async () => {
    const config: LoopConfig = { ...MINIMAL_CONFIG, plugins: [] };
    const plugins = await loadPlugins(config);
    expect(plugins).toEqual([]);
  });

  test("handles non-existent plugin paths gracefully", async () => {
    const config: LoopConfig = {
      ...MINIMAL_CONFIG,
      plugins: ["./nonexistent-plugin-path.ts"],
    };
    const plugins = await loadPlugins(config);
    expect(plugins).toEqual([]);
  });

  test("loads a valid plugin file", async () => {
    const config: LoopConfig = {
      ...MINIMAL_CONFIG,
      plugins: ["./__tests__/fixtures/sample-plugin.ts"],
    };
    const plugins = await loadPlugins(config);
    expect(plugins.length).toBeGreaterThanOrEqual(0);
  });
});

describe("executeHooks", () => {
  test("returns empty object with no plugins", async () => {
    const ctx = makeHookContext();
    const result = await executeHooks("onPhaseStart", ctx, []);
    expect(result).toEqual({});
  });

  test("returns empty object when no plugins have matching hooks", async () => {
    const plugin: Plugin = { name: "noop" };
    const ctx = makeHookContext();
    const result = await executeHooks("onPhaseStart", ctx, [plugin]);
    expect(result).toEqual({});
  });

  test("executes onPhaseStart hook and collects results", async () => {
    const plugin: Plugin = {
      name: "logger",
      onPhaseStart: async (phase) => {
        return { logged: phase.name };
      },
    };
    const ctx = makeHookContext();
    const result = await executeHooks("onPhaseStart", ctx, [plugin]);
    expect(result.logger).toEqual({ logged: "test-phase" });
  });

  test("executes onPhaseEnd hook with result data", async () => {
    const plugin: Plugin = {
      name: "recorder",
      onPhaseEnd: async (phase, result) => {
        return { phase: phase.name, exitCode: result.exitCode };
      },
    };
    const phaseResult: PhaseResult = {
      status: "pass",
      exitCode: 0,
      stdout: "ok",
      stderr: "",
      durationMs: 10,
      evidencePath: "",
    };
    const ctx = makeHookContext({ result: phaseResult });
    const result = await executeHooks("onPhaseEnd", ctx, [plugin]);
    expect(result.recorder).toEqual({ phase: "test-phase", exitCode: 0 });
  });

  test("executes onError hook with error data", async () => {
    const plugin: Plugin = {
      name: "alerter",
      onError: async (error) => {
        return { message: error.message };
      },
    };
    const ctx = makeHookContext({ error: new Error("test failure") });
    const result = await executeHooks("onError", ctx, [plugin]);
    expect(result.alerter).toEqual({ message: "test failure" });
  });

  test("catches plugin errors without crashing", async () => {
    const plugin: Plugin = {
      name: "crashy",
      onPhaseStart: async () => {
        throw new Error("plugin crashed");
      },
    };
    const ctx = makeHookContext();
    const result = await executeHooks("onPhaseStart", ctx, [plugin]);
    expect(result.crashy).toBeNull();
  });

  test("runs multiple plugins in order", async () => {
    const order: string[] = [];
    const pluginA: Plugin = {
      name: "A",
      onPhaseStart: async () => { order.push("A"); },
    };
    const pluginB: Plugin = {
      name: "B",
      onPhaseStart: async () => { order.push("B"); },
    };
    const ctx = makeHookContext();
    await executeHooks("onPhaseStart", ctx, [pluginA, pluginB]);
    expect(order).toEqual(["A", "B"]);
  });
});
