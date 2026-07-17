import { describe, expect, test } from "bun:test";
import { validatePlanSchema } from "../src/plan-schema.js";
import type { PlanYamlDoc } from "../src/types.js";

function plan(tasks: PlanYamlDoc["tasks"], extras: Partial<PlanYamlDoc> = {}): PlanYamlDoc {
  return { planName: "test-plan", tasks: tasks ?? [], ...extras };
}

describe("validatePlanSchema", () => {
  test("accepts a minimal valid plan", () => {
    const doc = plan([
      { id: "read-state", command: "type STATE.md" },
      { id: "verify", command: "bun test" },
    ]);
    expect(validatePlanSchema(doc)).toEqual([]);
  });

  test("accepts a valid LLM provider and MCP llm form", () => {
    const doc = plan([
      { id: "read-state", command: "type STATE.md" },
      { id: "judge", command: "type out.txt", llm: { provider: "opencode", prompt: "return {passed, reason, confidence}" } },
      { id: "mcp", command: "type out.txt", llm: { mcpServer: "fs", tool: "write", prompt: "x" } },
      { id: "verify", command: "bun test" },
    ]);
    expect(validatePlanSchema(doc)).toEqual([]);
  });

  test("flags empty command", () => {
    const doc = plan([
      { id: "read-state", command: "type STATE.md" },
      { id: "noop", command: "   " },
    ]);
    const errs = validatePlanSchema(doc);
    expect(errs.some((e) => e.rule === "empty-command")).toBe(true);
  });

  test("flags missing command", () => {
    const doc = plan([
      { id: "read-state", command: "type STATE.md" },
      // @ts-expect-error intentionally omitting command
      { id: "nocmd" },
    ]);
    const errs = validatePlanSchema(doc);
    expect(errs.some((e) => e.rule === "empty-command")).toBe(true);
  });

  test("flags duplicate ids", () => {
    const doc = plan([
      { id: "step", command: "echo a" },
      { id: "step", command: "echo b" },
    ]);
    const errs = validatePlanSchema(doc);
    expect(errs.some((e) => e.rule === "duplicate-id")).toBe(true);
  });

  test("flags unknown llm provider", () => {
    const doc = plan([
      { id: "read-state", command: "type STATE.md" },
      { id: "judge", command: "type out.txt", llm: { provider: "gemini", prompt: "x" } },
      { id: "verify", command: "bun test" },
    ]);
    const errs = validatePlanSchema(doc);
    expect(errs.some((e) => e.rule === "unknown-llm-provider")).toBe(true);
  });

  test("flags llm block without prompt but NOT a valid provider", () => {
    const doc = plan([
      { id: "read-state", command: "type STATE.md" },
      { id: "judge", command: "type out.txt", llm: { provider: "opencode", prompt: "" } },
      { id: "verify", command: "bun test" },
    ]);
    const errs = validatePlanSchema(doc);
    expect(errs.some((e) => e.rule === "missing-llm-prompt")).toBe(true);
    // provider is valid, so unknown-llm-provider must NOT fire
    expect(errs.some((e) => e.rule === "unknown-llm-provider")).toBe(false);
  });

  test("flags MCP llm form without tool (reaches the MCP branch)", () => {
    const doc = plan([
      { id: "read-state", command: "type STATE.md" },
      { id: "mcp", command: "type out.txt", llm: { mcpServer: "fs", tool: "", prompt: "x" } },
      { id: "verify", command: "bun test" },
    ]);
    const errs = validatePlanSchema(doc);
    const toolErr = errs.find((e) => e.rule === "missing-llm-tool");
    expect(toolErr).toBeDefined();
    // detail must identify the MCP form, proving the discriminated-union branch was taken
    expect(toolErr!.detail).toContain("MCP form");
    // an mcpServer-only object is not a provider form, so unknown-llm-provider must NOT fire
    expect(errs.some((e) => e.rule === "unknown-llm-provider")).toBe(false);
  });

  test("flags validator without criteria", () => {
    const doc = plan([
      { id: "read-state", command: "type STATE.md" },
      { id: "gen", command: "type out.txt", validator: { criteria: "" } },
      { id: "verify", command: "bun test" },
    ]);
    const errs = validatePlanSchema(doc);
    expect(errs.some((e) => e.rule === "validator-without-criteria")).toBe(true);
  });

  test("flags errors inside composites", () => {
    const doc = plan(
      [{ id: "read-state", command: "type STATE.md" }, { id: "verify", command: "bun test" }],
      { composites: [{ id: "build-and-test", phases: [{ id: "compile", command: "" }] }] },
    );
    const errs = validatePlanSchema(doc);
    expect(errs.some((e) => e.rule === "empty-command" && e.detail.includes('Composite "build-and-test"'))).toBe(true);
  });

  test("tolerates a composite with no phases (the ?. guard)", () => {
    const doc = plan(
      [{ id: "read-state", command: "type STATE.md" }, { id: "verify", command: "bun test" }],
      // @ts-expect-error intentionally omitting phases to exercise the optional-chain guard
      { composites: [{ id: "empty-composite" }] },
    );
    expect(validatePlanSchema(doc)).toEqual([]);
  });

  test("collects multiple distinct errors at once", () => {
    const doc = plan([
      { id: "dup", command: "echo a" },
      { id: "dup", command: "echo b" },
      { id: "bad", command: "", llm: { provider: "nope", prompt: "" } },
    ]);
    const errs = validatePlanSchema(doc);
    const rules = new Set(errs.map((e) => e.rule));
    expect(rules.has("duplicate-id")).toBe(true);
    expect(rules.has("empty-command")).toBe(true);
    expect(rules.has("unknown-llm-provider")).toBe(true);
    expect(rules.has("missing-llm-prompt")).toBe(true);
  });
});
