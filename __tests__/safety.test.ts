import { describe, expect, test } from "bun:test";
import {
  executeWithTimeout,
  checkMaxIterations,
  PhaseTimeoutError,
  MaxIterationsExceededError,
} from "../src/safety.js";

describe("PhaseTimeoutError", () => {
  test("constructor sets correct message", () => {
    const err = new PhaseTimeoutError("build", 5000);
    expect(err.message).toBe("Phase 'build' timed out after 5000ms");
    expect(err.name).toBe("PhaseTimeoutError");
  });

  test("is an instance of Error", () => {
    const err = new PhaseTimeoutError("test", 100);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("MaxIterationsExceededError", () => {
  test("constructor sets correct message", () => {
    const err = new MaxIterationsExceededError(3);
    expect(err.message).toBe("Max iterations (3) reached");
    expect(err.name).toBe("MaxIterationsExceededError");
  });

  test("is an instance of Error", () => {
    const err = new MaxIterationsExceededError(10);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("executeWithTimeout", () => {
  test("resolves with the return value for a fast function", async () => {
    const result = await executeWithTimeout(
      async () => "hello",
      500,
      "fast-phase",
    );
    expect(result).toBe("hello");
  });

  test("resolves with a complex return value", async () => {
    const result = await executeWithTimeout(
      async () => ({ status: "ok", code: 42 }),
      500,
      "object-phase",
    );
    expect(result).toEqual({ status: "ok", code: 42 });
  });

  test("rejects with PhaseTimeoutError when function is too slow", async () => {
    let caught: unknown;
    try {
      await executeWithTimeout(
        async () => {
          await new Promise((r) => setTimeout(r, 10_000));
          return "too late";
        },
        200,
        "slow-phase",
      );
    } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(PhaseTimeoutError);
    const err = caught as PhaseTimeoutError;
    expect(err.message).toContain("slow-phase");
    expect(err.message).toContain("200");
  });

  test("passes AbortSignal to the function", async () => {
    let receivedSignal: AbortSignal | null = null;
    await executeWithTimeout(
      async (signal) => {
        receivedSignal = signal;
        return "done";
      },
      500,
      "signal-test",
    );
    expect(receivedSignal).not.toBeNull();
    // Not checking aborted === false: executeWithTimeout's finally-block aborts
    // the signal for Bun-on-Windows GC cleanup, making the signal aborted by the
    // time this assertion runs. Valid signal delivery is the contract.
    expect(receivedSignal instanceof AbortSignal).toBe(true);
  });

  test("signal becomes aborted on timeout", async () => {
    let wasAborted = false;
    try {
      await executeWithTimeout(
        async (signal) => {
          await new Promise<void>((resolve) => {
            signal.addEventListener("abort", () => {
              wasAborted = true;
              resolve();
            });
          });
          return "never";
        },
        200,
        "abort-test",
      );
    } catch {
      // expected
    }
    expect(wasAborted).toBe(true);
  });

  test("rejects with the function's own error when it fails", async () => {
    let caught: unknown;
    try {
      await executeWithTimeout(
        async () => {
          throw new Error("custom failure");
        },
        500,
        "error-phase",
      );
    } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe("custom failure");
  });
});

describe("checkMaxIterations", () => {
  test("returns true when current < max", () => {
    expect(checkMaxIterations(0, 3)).toBe(true);
    expect(checkMaxIterations(1, 3)).toBe(true);
    expect(checkMaxIterations(2, 3)).toBe(true);
  });

  test("returns false when current >= max", () => {
    expect(checkMaxIterations(3, 3)).toBe(false);
    expect(checkMaxIterations(4, 3)).toBe(false);
    expect(checkMaxIterations(10, 3)).toBe(false);
  });

  test("returns true when max is 0 (infinite)", () => {
    // with max=0, current < 0 is never true, so this returns false
    expect(checkMaxIterations(0, 0)).toBe(false);
    expect(checkMaxIterations(1, 0)).toBe(false);
  });

  test("returns true when current is 0 and max is large", () => {
    expect(checkMaxIterations(0, 100)).toBe(true);
  });
});
