# agent-loop-bidirectional - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** OpenCode can control your loop daemon via MCP tools (enqueue tasks, check status, manage loops), and loop plan tasks can call OpenCode back via CLI. Closed feedback loop between the two systems.

**Why this approach:** MCP server wrappers are a proven pattern in this vault (excalidraw-agent-server, etc.). Direction A (opencode CLI in tasks) already works — just needs hardening. Both directions are independent, so they build in parallel.

**What it will NOT do:** No OTel/metrics wiring. No daemon auth integration (LOOP_API_KEY already exists, MCP server passes it through). No GUI.

**Effort:** Short (MCP server ~300 lines, task hardening ~50 lines)
**Risk:** Low — no changes to daemon core logic, just a new MCP wrapper + minor task-processor hardening
**Decisions to sanity-check:** Port (default 3000), MCP server location (vault-wide .opencode/mcp-servers/)

Your next move: approve. Full execution detail follows below.

---

> TL;DR (machine): Short, Low — MCP server wrapping daemon API + opencode CLI hardening in task-processor

## Scope
### Must have
- Direction B: MCP server at `.opencode/mcp-servers/agent-loop-mcp/` with 8 tools wrapping daemon REST API
- Direction B: Registered in vault `.opencode/opencode.json` under `mcp.agent-loop-daemon`
- Direction A: task-processor.ts captures stdout/stderr/output from opencode CLI execution

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No changes to daemon routes.ts (API surface is complete)
- No changes to loop.ts, orchestrator.ts, or triggers.ts
- No new npm dependencies in agent-loop (MCP server has its own package.json)
- No auth integration with LOOP_API_KEY (MCP server passes Bearer token if env set)

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after (MCP server: unit test per tool + integration test against live daemon)
- Evidence: .omo/evidence/task-1-agent-loop-bidirectional.md, task-2-agent-loop-bidirectional.md

## Execution strategy
### Parallel execution waves
Wave 1 — 2 parallel tasks (MCP server ≠ task-processor hardening)

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. MCP server | — | — | 2 |
| 2. task-processor hardening | — | — | 1 |
| 3. Register MCP in opencode.json | 1 | — | — |
| 4. Integration test | 3 | — | — |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Create agent-loop MCP server
  What to do / Must NOT do: Create `.opencode/mcp-servers/agent-loop-mcp/package.json` with `@modelcontextprotocol/sdk` and `zod`. Create `src/index.ts` with MCP server exposing 8 tools that call daemon REST API at `http://localhost:3000`. Tools: enqueue_task (POST /task), get_status (GET /state), list_loops (GET /loops), list_history (GET /api/history), get_task (GET /api/tasks/:id), start_loop (POST /loops/:id/start), stop_loop (POST /loops/:id/stop), pause_loop (GET+POST /api/pause). Read DAEMON_PORT env var (default 3000), optional LOOP_API_KEY for Bearer auth. Do NOT add any tools that don't map 1:1 to existing daemon routes. Do NOT edit any agent-loop src/ files.
  Parallelization: Wave 1 | Blocked by: — | Blocks: 3
  References: `.opencode/mcp-servers/excalidraw-agent-server/` (pattern), `src/routes.ts` (daemon API surface), `@modelcontextprotocol/sdk` (Server, StdioServerTransport, tools, zod)
  Acceptance criteria: `cd .opencode/mcp-servers/agent-loop-mcp && bun run src/index.ts` starts and prints MCP server info
  QA scenarios: Happy: MCP server starts, responds to tools/list. Failure: daemon not running returns meaningful errors. Evidence: .omo/evidence/task-1-agent-loop-bidirectional.md
  Commit: N (part of vault)

- [ ] 2. Harden opencode CLI execution in task-processor.ts
  What to do / Must NOT do: In `src/task-processor.ts`, the `executeTask` function runs shell commands. Ensure `opencode run` commands get stdout/stderr captured and returned in the task result. Specifically: if `task.command` starts with `opencode`, capture stdout+stderr from the child process and attach it to the task result. Use `Bun.spawn` or `Bun.spawnSync` with `stdio: ['pipe', 'pipe', 'pipe']`. Add max output capture (64KB). Do NOT add any opencode-specific dependencies. Do NOT change existing non-opencode command behavior.
  Parallelization: Wave 1 | Blocked by: — | Blocks: —
  References: `src/task-processor.ts:executeTask` (shell execution), `src/task-queue.ts` (Task type with result fields)
  Acceptance criteria: `bun test __tests__/task-processor.test.ts` passes
  QA scenarios: Happy: opencode command returns output in task result. Failure: opencode command times out captures partial output. Evidence: .omo/evidence/task-2-agent-loop-bidirectional.md
  Commit: N (part of vault)

- [ ] 3. Register MCP server in vault opencode.json
  What to do / Must NOT do: Add entry to `D:\projects\obsidian\second brain\.opencode\opencode.json` under `mcp` key: `"agent-loop-daemon": { "type": "local", "command": ["tsx", "src/index.ts"], "cwd": ".opencode/mcp-servers/agent-loop-mcp/", "enabled": false }`. Use `tsx` for dev (matches excalidraw-agent-server pattern). Set `enabled: false` so it doesn't auto-start — user enables manually when daemon is running. Do NOT modify any existing MCP entries.
  Parallelization: Wave 2 | Blocked by: 1 | Blocks: 4
  References: `.opencode/opencode.json` (vault root), excalidraw-agent-server pattern at same path
  Acceptance criteria: opencode.json is valid JSON, `mcp.agent-loop-daemon` entry exists
  QA scenarios: Happy: `jq .mcp[\"agent-loop-daemon\"] .opencode/opencode.json` returns the entry. Evidence: .omo/evidence/task-3-agent-loop-bidirectional.md
  Commit: N (vault-wide config)

- [ ] 4. E2E integration test (MCP server ↔ daemon)
  What to do / Must NOT do: Start daemon on port 3000. Start MCP server. Call each of the 8 MCP tools and verify they return expected results against the live daemon. Test: enqueue_task (creates task, returns 201), get_status (returns daemon state), list_loops (returns child loops), list_history (returns paginated list), get_task (returns single task detail), start_loop/stop_loop (changes child state). Stop both after test. Do NOT leave daemon or MCP server running.
  Parallelization: Wave 2 | Blocked by: 3 | Blocks: —
  References: `src/daemon.ts` (start/stop), `.opencode/mcp-servers/agent-loop-mcp/src/index.ts` (MCP tools)
  Acceptance criteria: All 8 MCP tool calls return successful responses
  QA scenarios: Happy: enqueue+get_status+list_loops all return 200. Failure: daemon down returns error message from each tool. Evidence: .omo/evidence/task-4-agent-loop-bidirectional.md
  Commit: N

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. `bun test` passes (all existing tests still pass)
- [ ] F2. MCP server starts and tools/list returns 8 tools
- [ ] F3. MCP server responds to enqueue_task with 201
- [ ] F4. No changes to daemon core (routes.ts, daemon.ts, orchestrator.ts, triggers.ts unchanged)

## Commit strategy
N/A — no commits needed. Config + new server are part of the vault.

## Success criteria
- OpenCode MCP tools: enqueue_task, get_status, list_loops, list_history, get_task, start_loop, stop_loop, pause_loop all work
- Loop plan tasks with `command: opencode run` capture output properly
- All existing tests pass
