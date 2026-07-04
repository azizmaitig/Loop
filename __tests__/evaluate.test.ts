import { describe, expect, test } from "bun:test";
import { evaluatePhase } from "../src/evaluate.js";
import type { PhaseDef, PhaseResult } from "../src/types.js";

describe("evaluatePhase - exit code fallback", () => {
  test("returns passed when exit code matches expected", async () => {
    const phase: PhaseDef = {
      name: "test",
      command: "",
      expectedExitCode: 0,
      timeoutMs: 1000,
    };
    const result: PhaseResult = {
      status: "pass",
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 10,
      evidencePath: "",
    };
    const judgment = await evaluatePhase(phase, result);
    expect(judgment.passed).toBe(true);
    expect(judgment.reason).toBe("exit code");
    expect(judgment.confidence).toBe(1.0);
  });

  test("returns failed when exit code mismatches", async () => {
    const phase: PhaseDef = {
      name: "test",
      command: "",
      expectedExitCode: 0,
      timeoutMs: 1000,
    };
    const result: PhaseResult = {
      status: "fail",
      exitCode: 1,
      stdout: "",
      stderr: "error",
      durationMs: 10,
      evidencePath: "",
    };
    const judgment = await evaluatePhase(phase, result);
    expect(judgment.passed).toBe(false);
  });

  test("handles non-zero expected exit code", async () => {
    const phase: PhaseDef = {
      name: "test",
      command: "",
      expectedExitCode: 1,
      timeoutMs: 1000,
    };
    const result: PhaseResult = {
      status: "pass",
      exitCode: 1,
      stdout: "",
      stderr: "",
      durationMs: 10,
      evidencePath: "",
    };
    const judgment = await evaluatePhase(phase, result);
    expect(judgment.passed).toBe(true);
    expect(judgment.reason).toBe("exit code");
  });

  test("returns valid Judgment shape", async () => {
    const phase: PhaseDef = {
      name: "test",
      command: "",
      expectedExitCode: 0,
      timeoutMs: 1000,
    };
    const result: PhaseResult = {
      status: "pass",
      exitCode: 0,
      stdout: "",
      stderr: "",
      durationMs: 0,
      evidencePath: "",
    };
    const judgment = await evaluatePhase(phase, result);
    expect(judgment).toHaveProperty("passed");
    expect(judgment).toHaveProperty("reason");
    expect(judgment).toHaveProperty("confidence");
    expect(typeof judgment.passed).toBe("boolean");
    expect(typeof judgment.reason).toBe("string");
    expect(typeof judgment.confidence).toBe("number");
  });
});
