import { describe, expect, test, mock, afterEach, beforeEach, spyOn } from "bun:test";
import type { PhaseDef, PhaseResult, LoopConfig, LoopState } from "../src/types.js";

// ── Shared mutable state for recallLessons mock ──
let recallLessonsReturn: any[] = [];
const mockSaveEpisodic = mock(() => Promise.resolve(null));
const mockRecallLessons = mock(async () => recallLessonsReturn);
const mockArchiveSession = mock(() => Promise.resolve(null));
const mockSaveLesson = mock(() => Promise.resolve(null));
const mockPushPulse = mock(() => Promise.resolve(null));

// ── Mock agentmemory module BEFORE importing memory-hooks ──
mock.module("../src/agentmemory.js", () => ({
  saveEpisodic: mockSaveEpisodic,
  recallLessons: mockRecallLessons,
  archiveSession: mockArchiveSession,
  saveLesson: mockSaveLesson,
  pushPulse: mockPushPulse,
}));

import { computeHealthScore, onPhaseFailed, onLoopComplete, logPhaseContext } from "../src/memory-hooks.js";

// ── Reset mocks before each test ──
// mockClear preserves the implementation (from the mock() factory),
// only clearing call history. mockReset would kill the implementation
// causing the function to return undefined instead of Promise.resolve(null).
// We also restore mockRecallLessons default in case a test overrode it.
beforeEach(() => {
  recallLessonsReturn = [];
  mockSaveEpisodic.mockClear();
  mockRecallLessons.mockClear();
  mockRecallLessons.mockImplementation(async () => recallLessonsReturn);
  mockArchiveSession.mockClear();
  mockSaveLesson.mockClear();
  mockPushPulse.mockClear();
});

// ── Fixtures ──

function testState(overrides: Partial<LoopState> = {}): LoopState {
  return {
    currentState: "done",
    iteration: 1,
    phaseResults: {},
    startTime: "2026-07-03T00:00:00.000Z",
    errors: [],
    ...overrides,
  };
}

function phaseDef(name = "build"): PhaseDef {
  return { name, command: "npm run build", expectedExitCode: 0, timeoutMs: 30000 };
}

function phaseResult(overrides: Partial<PhaseResult> = {}): PhaseResult {
  return {
    status: "fail",
    exitCode: 1,
    stdout: "",
    stderr: "Error: something broke",
    durationMs: 100,
    evidencePath: "",
    ...overrides,
  };
}

function baseConfig(memoryEnabled = true): LoopConfig {
  return {
    taskName: "test-task",
    phases: [phaseDef()],
    maxIterations: 3,
    phaseTimeoutMs: 60000,
    ...(memoryEnabled ? { memory: { enabled: true } } : {}),
  };
}

// ── computeHealthScore ──

describe("computeHealthScore", () => {
  test("returns 0 when there are no phase results", () => {
    const state = testState({ phaseResults: {} });
    expect(computeHealthScore(state)).toBe(0);
  });

  test("returns 1 when all phases pass", () => {
    const state = testState({
      phaseResults: {
        a: { status: "pass", exitCode: 0, stdout: "", stderr: "", durationMs: 10, evidencePath: "" },
        b: { status: "pass", exitCode: 0, stdout: "", stderr: "", durationMs: 20, evidencePath: "" },
      },
    });
    expect(computeHealthScore(state)).toBe(1);
  });

  test("returns 0.5 when half of phases pass", () => {
    const state = testState({
      phaseResults: {
        a: { status: "pass", exitCode: 0, stdout: "", stderr: "", durationMs: 10, evidencePath: "" },
        b: { status: "fail", exitCode: 1, stdout: "", stderr: "err", durationMs: 20, evidencePath: "" },
      },
    });
    expect(computeHealthScore(state)).toBe(0.5);
  });

  test("returns 0 when no phases pass", () => {
    const state = testState({
      phaseResults: {
        a: { status: "fail", exitCode: 1, stdout: "", stderr: "", durationMs: 10, evidencePath: "" },
        b: { status: "error", exitCode: 2, stdout: "", stderr: "", durationMs: 20, evidencePath: "" },
      },
    });
    expect(computeHealthScore(state)).toBe(0);
  });
});

// ── onPhaseFailed ──

describe("onPhaseFailed", () => {
  test("returns immediately when memory is disabled", () => {
    const config = baseConfig(false); // memory not enabled

    onPhaseFailed(phaseDef(), phaseResult(), config);

    expect(mockRecallLessons).not.toHaveBeenCalled();
    expect(mockSaveLesson).not.toHaveBeenCalled();
  });

  test("saves lesson for novel error when memory is enabled", async () => {
    recallLessonsReturn = []; // no prior lessons → novel

    onPhaseFailed(phaseDef(), phaseResult(), baseConfig());

    // Flush microtask queue from the fire-and-forget IIFE
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRecallLessons).toHaveBeenCalled();
    expect(mockSaveLesson).toHaveBeenCalled();
    const savedContent = mockSaveLesson.mock.calls[0]?.[0] as string;
    expect(savedContent).toContain("build");
    expect(savedContent).toContain("exit 1");
    expect(savedContent).toContain("something broke");
  });

  test("skips save when error matches a known lesson", async () => {
    // Mocked recallLessons will return a lesson whose content includes the error
    recallLessonsReturn = [{ content: "Error: something broke" }];

    onPhaseFailed(phaseDef(), phaseResult(), baseConfig());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRecallLessons).toHaveBeenCalled();
    expect(mockSaveLesson).not.toHaveBeenCalled();
  });

  test("does not throw when agentmemory is down", async () => {
    mockRecallLessons.mockImplementation(async () => {
      throw new Error("Connection refused");
    });

    // Should not throw — fire-and-forget catches internal errors
    onPhaseFailed(phaseDef(), phaseResult(), baseConfig());

    await new Promise((resolve) => setTimeout(resolve, 0));

    // saveLesson should NOT be called because recallLessons threw
    expect(mockSaveLesson).not.toHaveBeenCalled();
  });

  test("uses exit code when stderr is empty", async () => {
    recallLessonsReturn = [];

    onPhaseFailed(
      phaseDef("lint"),
      phaseResult({ stderr: "", exitCode: 2 }),
      baseConfig(),
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockSaveLesson).toHaveBeenCalled();
    const content = mockSaveLesson.mock.calls[0]?.[0] as string;
    expect(content).toContain("exit 2");
  });
});

// ── onLoopComplete ──

describe("onLoopComplete", () => {
  test("returns immediately when memory is disabled", async () => {
    const config = baseConfig(false);

    await onLoopComplete(testState(), config);

    expect(mockSaveEpisodic).not.toHaveBeenCalled();
    expect(mockPushPulse).not.toHaveBeenCalled();
    expect(mockArchiveSession).not.toHaveBeenCalled();
  });

  test("calls saveEpisodic and pushPulse and archiveSession when memory is enabled", async () => {
    const state = testState({
      iteration: 3,
      phaseResults: {
        scan: { status: "pass", exitCode: 0, stdout: "scanned", stderr: "", durationMs: 500, evidencePath: "" },
        report: { status: "fail", exitCode: 1, stdout: "", stderr: "report err", durationMs: 300, evidencePath: "" },
      },
    });
    const config = baseConfig(true);

    await onLoopComplete(state, config);

    // saveEpisodic: called with state and taskName
    expect(mockSaveEpisodic).toHaveBeenCalled();
    expect(mockSaveEpisodic.mock.calls[0]?.[1]).toBe("test-task");

    // pushPulse: called with health score 0.5 (1 of 2 passed)
    expect(mockPushPulse).toHaveBeenCalled();
    const score = mockPushPulse.mock.calls[0]?.[0] as number;
    expect(score).toBe(0.5);

    // archiveSession: called with state and taskName
    expect(mockArchiveSession).toHaveBeenCalled();
    expect(mockArchiveSession.mock.calls[0]?.[1]).toBe("test-task");
  });

  test("computes health score correctly for all-pass state", async () => {
    const state = testState({
      phaseResults: {
        a: { status: "pass", exitCode: 0, stdout: "", stderr: "", durationMs: 10, evidencePath: "" },
        b: { status: "pass", exitCode: 0, stdout: "", stderr: "", durationMs: 20, evidencePath: "" },
        c: { status: "pass", exitCode: 0, stdout: "", stderr: "", durationMs: 30, evidencePath: "" },
      },
    });

    await onLoopComplete(state, baseConfig());

    expect(mockPushPulse).toHaveBeenCalledWith(1);
  });

  test("does not throw when agentmemory calls fail", async () => {
    mockSaveEpisodic.mockImplementation(async () => {
      throw new Error("server down");
    });
    mockPushPulse.mockImplementation(async () => {
      throw new Error("server down");
    });
    mockArchiveSession.mockImplementation(async () => {
      throw new Error("server down");
    });

    // Should not throw — errors caught internally
    await expect(onLoopComplete(testState(), baseConfig())).resolves.toBeUndefined();
  });
});

// ── logPhaseContext ──

describe("logPhaseContext", () => {
  test("returns immediately when memory is disabled", () => {
    const config = baseConfig(false);

    logPhaseContext(phaseDef(), config);

    expect(mockRecallLessons).not.toHaveBeenCalled();
  });

  test("logs each lesson (max 5) when lessons are returned", async () => {
    recallLessonsReturn = [
      { content: "lesson 1" },
      { content: "lesson 2" },
      { content: "lesson 3" },
    ];
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    logPhaseContext(phaseDef("build"), baseConfig());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRecallLessons).toHaveBeenCalled();
    expect(mockRecallLessons.mock.calls[0]?.[0]).toContain("build");
    expect(logSpy).toHaveBeenCalledTimes(3);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[memory] Context:"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("lesson 1"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("lesson 2"));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("lesson 3"));
    logSpy.mockRestore();
  });

  test("logs no-context message when recallLessons returns empty", async () => {
    recallLessonsReturn = [];
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    logPhaseContext(phaseDef("scan"), baseConfig());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockRecallLessons).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('[memory] No context available for "test-task: scan"'),
    );
    logSpy.mockRestore();
  });

  test("does not throw when recallLessons rejects", async () => {
    mockRecallLessons.mockImplementation(async () => {
      throw new Error("Connection refused");
    });
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    logPhaseContext(phaseDef(), baseConfig());

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});
