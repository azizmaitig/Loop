import { describe, expect, test } from "bun:test";
import { StateMachine, StateMachineError } from "../src/state-machine.js";
import type { StateMachineState } from "../src/types.js";

describe("StateMachine - init state", () => {
  test("starts in 'init' by default", () => {
    const sm = new StateMachine();
    expect(sm.currentState).toBe("init");
  });

  test("accepts custom initial state", () => {
    const sm = new StateMachine("verify");
    expect(sm.currentState).toBe("verify");
  });

  test("isTerminal returns false for init", () => {
    const sm = new StateMachine("init");
    expect(sm.isTerminal()).toBe(false);
  });

  test("allowedEvents returns RUN and ABORT from init", () => {
    const sm = new StateMachine("init");
    expect(sm.allowedEvents().sort()).toEqual(["ABORT", "RUN"]);
  });
});

describe("StateMachine - happy path transitions", () => {
  test("init --RUN--> run", () => {
    const sm = new StateMachine("init");
    const next = sm.transition("RUN");
    expect(next).toBe("run");
    expect(sm.currentState).toBe("run");
  });

  test("run --VERIFY--> verify", () => {
    const sm = new StateMachine("run");
    const next = sm.transition("VERIFY");
    expect(next).toBe("verify");
    expect(sm.currentState).toBe("verify");
  });

  test("verify --COMPLETE--> done", () => {
    const sm = new StateMachine("verify");
    const next = sm.transition("COMPLETE");
    expect(next).toBe("done");
    expect(sm.currentState).toBe("done");
  });

  test("full pipeline: init -> run -> verify -> done", () => {
    const sm = new StateMachine("init");
    sm.transition("RUN");
    expect(sm.currentState).toBe("run");
    sm.transition("VERIFY");
    expect(sm.currentState).toBe("verify");
    sm.transition("COMPLETE");
    expect(sm.currentState).toBe("done");
  });
});

describe("StateMachine - loopback", () => {
  test("verify --LOOP--> init", () => {
    const sm = new StateMachine("verify");
    const next = sm.transition("LOOP");
    expect(next).toBe("init");
    expect(sm.currentState).toBe("init");
  });

  test("full loop: init -> run -> verify -> LOOP back to init", () => {
    const sm = new StateMachine("init");
    sm.transition("RUN");
    sm.transition("VERIFY");
    sm.transition("LOOP");
    expect(sm.currentState).toBe("init");
  });
});

describe("StateMachine - abort from any state", () => {
  const states: StateMachineState[] = ["init", "run", "verify"];

  for (const state of states) {
    test(`${state} --ABORT--> done`, () => {
      const sm = new StateMachine(state);
      const next = sm.transition("ABORT");
      expect(next).toBe("done");
      expect(sm.currentState).toBe("done");
    });
  }
});

describe("StateMachine - failure path", () => {
  test("verify --FAILED--> done", () => {
    const sm = new StateMachine("verify");
    const next = sm.transition("FAILED");
    expect(next).toBe("done");
    expect(sm.currentState).toBe("done");
  });
});

describe("StateMachine - invalid transitions", () => {
  test("init --VERIFY--> throws", () => {
    const sm = new StateMachine("init");
    expect(() => sm.transition("VERIFY")).toThrow(StateMachineError);
  });

  test("init --COMPLETE--> throws", () => {
    const sm = new StateMachine("init");
    expect(() => sm.transition("COMPLETE")).toThrow(StateMachineError);
  });

  test("init --LOOP--> throws", () => {
    const sm = new StateMachine("init");
    expect(() => sm.transition("LOOP")).toThrow(StateMachineError);
  });

  test("init --FAILED--> throws", () => {
    const sm = new StateMachine("init");
    expect(() => sm.transition("FAILED")).toThrow(StateMachineError);
  });

  test("run --RUN--> throws", () => {
    const sm = new StateMachine("run");
    expect(() => sm.transition("RUN")).toThrow(StateMachineError);
  });

  test("run --COMPLETE--> throws", () => {
    const sm = new StateMachine("run");
    expect(() => sm.transition("COMPLETE")).toThrow(StateMachineError);
  });

  test("run --LOOP--> throws", () => {
    const sm = new StateMachine("run");
    expect(() => sm.transition("LOOP")).toThrow(StateMachineError);
  });

  test("run --FAILED--> throws", () => {
    const sm = new StateMachine("run");
    expect(() => sm.transition("FAILED")).toThrow(StateMachineError);
  });

  test("verify --RUN--> throws", () => {
    const sm = new StateMachine("verify");
    expect(() => sm.transition("RUN")).toThrow(StateMachineError);
  });

  test("verify --VERIFY--> throws", () => {
    const sm = new StateMachine("verify");
    expect(() => sm.transition("VERIFY")).toThrow(StateMachineError);
  });

  test("done --any--> throws", () => {
    const sm = new StateMachine("done");
    expect(() => sm.transition("RUN")).toThrow(StateMachineError);
    expect(() => sm.transition("VERIFY")).toThrow(StateMachineError);
    expect(() => sm.transition("COMPLETE")).toThrow(StateMachineError);
    expect(() => sm.transition("LOOP")).toThrow(StateMachineError);
    expect(() => sm.transition("FAILED")).toThrow(StateMachineError);
    expect(() => sm.transition("ABORT")).toThrow(StateMachineError);
  });

  test("unknown event from any state throws", () => {
    const sm = new StateMachine("init");
    expect(() => sm.transition("BOGUS")).toThrow(StateMachineError);
  });

  test("error message includes event name and current state", () => {
    const sm = new StateMachine("init");
    let caught: unknown;
    try { sm.transition("VERIFY"); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(StateMachineError);
    const err = caught as StateMachineError;
    expect(err.message).toContain("VERIFY");
    expect(err.message).toContain("init");
    expect(err.name).toBe("StateMachineError");
  });
});

describe("StateMachine - isTerminal", () => {
  test("isTerminal returns true for 'done'", () => {
    const sm = new StateMachine("done");
    expect(sm.isTerminal()).toBe(true);
  });

  test("isTerminal returns false for non-terminal states", () => {
    const nonTerminal: StateMachineState[] = ["init", "run", "verify"];
    for (const state of nonTerminal) {
      const sm = new StateMachine(state);
      expect(sm.isTerminal()).toBe(false);
    }
  });
});

describe("StateMachine - allowedEvents", () => {
  test("init allows RUN, ABORT", () => {
    const sm = new StateMachine("init");
    expect(sm.allowedEvents().sort()).toEqual(["ABORT", "RUN"]);
  });

  test("run allows VERIFY, ABORT", () => {
    const sm = new StateMachine("run");
    expect(sm.allowedEvents().sort()).toEqual(["ABORT", "VERIFY"]);
  });

  test("verify allows COMPLETE, LOOP, FAILED, ABORT", () => {
    const sm = new StateMachine("verify");
    expect(sm.allowedEvents().sort()).toEqual(["ABORT", "COMPLETE", "FAILED", "LOOP"]);
  });

  test("done allows no events", () => {
    const sm = new StateMachine("done");
    expect(sm.allowedEvents()).toEqual([]);
  });
});
