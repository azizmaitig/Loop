import { describe, expect, test } from "bun:test";
import { parseArgs } from "../src/cli.js";

describe("daemon mode", () => {
  test("parseArgs handles --daemon flag correctly", () => {
    const args = parseArgs(["start", "--daemon"]);
    expect(args.daemon).toBe(true);
  });

  test("loop.ts can be imported without error", async () => {
    // Verify the entry point module compiles and loads cleanly
    await expect(import("../loop.js")).resolves.toBeDefined();
  });
});
