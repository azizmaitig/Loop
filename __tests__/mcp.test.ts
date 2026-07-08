import { describe, expect, test } from "bun:test";
import { executeMcpPhase } from "../src/mcp.js";
import type { PhaseDef } from "../src/types.js";

describe("executeMcpPhase", () => {
  test("returns error when phase has no llm config", async () => {
    const phase: PhaseDef = {
      name: "test",
      command: "",
      expectedExitCode: 0,
      timeoutMs: 1000,
    };
    const result = await executeMcpPhase(phase);
    expect(result.status).toBe("error");
    expect(result.stderr).toContain("No LLM/MCP configuration in phase");
  });

  test("handles spawn failure gracefully", async () => {
    const phase: PhaseDef = {
      name: "test",
      command: "",
      expectedExitCode: 0,
      timeoutMs: 1000,
      llm: {
        mcpServer: "nonexistent-binary-12345",
        tool: "test",
        prompt: "{}",
      },
    };
    const result = await executeMcpPhase(phase);
    expect(result.status).toBe("error");
  });

  test("returns valid PhaseResult shape on error", async () => {
    const phase: PhaseDef = {
      name: "test",
      command: "",
      expectedExitCode: 0,
      timeoutMs: 1000,
    };
    const result = await executeMcpPhase(phase);
    expect(result).toHaveProperty("status", "error");
    expect(result).toHaveProperty("exitCode");
    expect(result).toHaveProperty("stdout");
    expect(result).toHaveProperty("stderr");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("evidencePath");
  });
});
