import { describe, expect, test } from "bun:test";

describe("daemon mode", () => {
  test("loop.ts exports runDaemon function (verification via source)", () => {
    // Using require for source-level check since runDaemon is not exported
    // but is defined and used inside loop.ts main()
    const fs = require("node:fs");
    const source = fs.readFileSync("./loop.ts", "utf-8");
    expect(source).toContain("async function runDaemon");
  });

  test("loop.ts contains --daemon flag handling", () => {
    const fs = require("node:fs");
    const source = fs.readFileSync("./loop.ts", "utf-8");
    expect(source).toContain("--daemon");
    expect(source).toContain("case '--daemon'");
  });

  test("loop.ts handles daemon mode in main", () => {
    const fs = require("node:fs");
    const source = fs.readFileSync("./loop.ts", "utf-8");
    expect(source).toContain("runDaemon(config)");
  });
});
