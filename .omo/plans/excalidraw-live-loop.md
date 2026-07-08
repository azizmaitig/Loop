# Excalidraw Live Agent Loop

## TL;DR

> **Quick Summary**: Create a standalone Node.js script that continuously polls the Excalidraw canvas, detects command text drawn by the user, executes them via existing MCP tools, and writes results back — plus extend the server to expose MCP tools via WebSocket.
>
> **Deliverables**:
> - `excalidraw-live-loop.mjs` — the poll loop script
> - `index.ts` — 4 new WS message handlers (scientific_prisma, mermaid_to_excalidraw, apply_scientific_palette, get_scientific_palettes)
> - `excalidraw-live-loop.test.mjs` — TDD vitest tests
> - npm deps: `ws` (loop script), `bufferutil` (optional perf)
>
> **Estimated Effort**: Short (~2h)
> **Parallel Execution**: YES — 2 waves + final

---

## Context

### Original Request
Create an agent-side poll loop for the excalidraw-agent bridge that watches canvas changes, detects commands drawn by the user, executes them, and writes results back to the canvas.

### Interview Summary
**Key Discussions**:
- Trigger: Canvas changes polled every ~1.5s (not event-driven)
- Format: Standalone Node.js script (long-running process)
- Response mode: Canvas-as-UI — user draws commands, agent executes
- Command set: PRISMA N/N/N/N, → flowchart ..., → palette <name>, → read
- Connection: WebSocket :9877 as CLI client (no Origin header)
- Server must be extended to expose MCP scientific/mermaid tools via WS

**Web Research Findings**:
- `perMessageDeflate: false` mandatory for long-running ws clients (memory fragmentation)
- Exponential backoff with jitter required to avoid reconnection storms
- `bufferutil` optional dep for 10-15% frame masking perf
- Excalidraw issue #9038: shape cache misses on remote elements (agent writes slower)
- MCP tools (scientific, mermaid) are stdio-only — must add WS handlers

---

## Work Objectives

### Core Objective
Create a standalone Node.js script that continuously polls the Excalidraw canvas, detects command text drawn by the user, executes them via existing MCP tools, and writes results back to the canvas — plus extend the server to make MCP tools accessible via WebSocket.

### Concrete Deliverables
- `.opencode/mcp-servers/excalidraw-agent-server/src/excalidraw-live-loop.mjs` — poll loop script
- `.opencode/mcp-servers/excalidraw-agent-server/src/index.ts` — 4 new WS case branches + import additions
- `.opencode/mcp-servers/excalidraw-agent-server/src/__tests__/excalidraw-live-loop.test.mjs` — TDD tests
- `package.json` — `bufferutil` optional dep added

### Must Have
- Script polls canvas every ~1.5s
- Detects text commands: PRISMA N/N/N/N, → flowchart ..., → palette <name>, → read
- Executes commands via existing handleToolCall()
- Writes results back to canvas as elements
- Handles WS reconnection with exponential backoff (500ms→30s, jitter)
- Handles SIGINT/SIGTERM gracefully
- Idempotent: same command text not re-executed on next poll
- Execution lock: skips poll if previous command still running
- Unknown commands logged but don't crash

### Must NOT Have (Guardrails)
- No new MCP tools — only WS handlers for existing ones
- No undo/history/persistence
- No multi-canvas support
- No monitoring UI or health endpoints
- No new commands beyond the initial 4
- No changes to tools.ts or existing tool logic

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (vitest, existing test patterns at server.test.ts)
- **Automated tests**: TDD (RED → GREEN → REFACTOR)
- **Framework**: vitest

### QA Policy
Every task MUST include agent-executed QA scenarios.
- Server changes: `npm test` — no regressions
- Loop script: standalone test via vitest with mocked WS
- Integration: Playwright or manual WS client test

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Server extension — prepare the ground):
├── T1: Add 4 WS message handlers to index.ts
├── T2: Add bufferutil optional dep to package.json
└── T3: TDD test for WS handler extension

Wave 2 (Live loop script — the main deliverable):
├── T4: excalidraw-live-loop.mjs skeleton (WS connect, poll, reconnect, shutdown)
├── T5: Command detection engine (text parsing, idempotency)
├── T6: Command execution dispatch (call handleToolCall, write results)
└── T7: TDD tests for live loop script

Wave FINAL (4 parallel reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high)
└── F4: Scope fidelity check (deep)
```

### Dependency Matrix
- **T1**, **T2**, **T3**: Independent — all Wave 1, parallel
- **T4**: T3 (needs WS handler to exist) — Wave 2
- **T5**, **T6**, **T7**: T4 (needs script skeleton) — Wave 2, parallel

### Agent Dispatch Summary
- **Wave 1**: 3 × `quick`
- **Wave 2**: 4 × `unspecified-low`
- **Final**: 4 (oracle, unspecified-high ×2, deep)

---

## TODOs

- [x] 1. `index.ts` — Add 4 WS message handlers for scientific/mermaid tools

  **What to do**:
  - In `src/index.ts`, add 4 new `case` branches to the WS message `switch` statement (alongside scene_read, scene_write, etc.)
  - Each case calls `handleToolCall()` from tools.ts directly (these are pure computation — no WS forward needed)
  - The 4 types and their argument mappings:
    - `scientific_prisma` → args: `{ records_identified, records_screened, reports_retrieved, studies_included }`
    - `mermaid_to_excalidraw` → args: `{ mermaid: string }`
    - `apply_scientific_palette` → args: `{ elements, palette }`
    - `get_scientific_palettes` → args: `{ palette? }`
  - The tool result's `elements` array must be returned as the WS response
  - Handle errors: catch from handleToolCall, return `{ type: "error", message }` on failure

  **Must NOT do**:
  - Don't modify tools.ts or add new MCP tools
  - Don't forward to wrapper — these are computation-only
  - Don't add dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: Follows existing pattern, ~20 lines of boilerplate

  **Parallelization**: Wave 1 — parallel with T2, T3 | Blocks: None | Blocked By: None

  **References**:
  - `.opencode/mcp-servers/excalidraw-agent-server/src/index.ts:261-360` — Existing WS switch statement (add new cases alongside)
  - `.opencode/mcp-servers/excalidraw-agent-server/src/tools.ts:193-235` — handleToolCall() function to call
  - `.opencode/mcp-servers/excalidraw-agent-server/src/tools.ts:44-182` — Tool schemas for argument requirements
  - Existing CLI client pattern: read.js — `{ type: "scene_read" }` response handling

  **Acceptance Criteria**:
  - [ ] 4 new case branches in index.ts WS handler
  - [ ] Each calls handleToolCall() with correct args
  - [ ] Results returned as WS response
  - [ ] Errors caught and returned as WS error response
  - [ ] `npm test` passes

  **QA Scenarios**:
  ```
  Scenario: WS scientific_prisma called
    Tool: Bash — write test script that connects to WS :9877, sends { type: "scientific_prisma", records_identified: 200, records_screened: 100, reports_retrieved: 50, studies_included: 25 }, verifies response contains elements
    Preconditions: MCP server + wrapper app running
    Steps:
      1. Run test script against WS :9877
      2. Assert response.elements has 7 elements (4 boxes + 3 arrows)
      3. Assert no error in response
    Expected Result: PRISMA elements returned
    Evidence: .omo/evidence/task-1-ws-prisma.txt

  Scenario: WS mermaid call
    Tool: Bash test script
    Preconditions: Same
    Steps:
      1. Send { type: "mermaid_to_excalidraw", mermaid: "flowchart TD A[Start] --> B[End]" }
    Expected Result: elements array with rectangle + text + arrow
    Evidence: .omo/evidence/task-1-ws-mermaid.txt

  Scenario: Unknown tool returns error
    Tool: Bash test script
    Steps:
      1. Send { type: "scientific_prisma" } with missing args
    Expected Result: error response, not crash
    Evidence: .omo/evidence/task-1-ws-error.txt
  ```
  **Commit**: YES (with T2, T3)
  - Message: `feat(excalidraw-bridge): add WS handlers for scientific/mermaid MCP tools`
  - Files: `index.ts`
  - Pre-commit: `npm test`

- [x] 2. `package.json` — Add `bufferutil` optional dependency

**What to do**:
  - Add `"bufferutil": {"optional": true}` to `devDependencies` or as a separate optional dep
  - Actually modern npm: `npm install --save-optional bufferutil@latest` in the server directory

  **Must NOT do**:
  - Don't make it a required dependency — it's optional

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: Single npm install command

  **Parallelization**: Wave 1 — parallel | Blocks: None | Blocked By: None

  **References**:
  - `.opencode/mcp-servers/excalidraw-agent-server/package.json`

  **Acceptance Criteria**:
  - [ ] bufferutil in package.json under optionalDependencies
  - [ ] `npm ls bufferutil` shows it

  **QA Scenarios**:
  ```
  Scenario: bufferutil installed
    Tool: Bash (npm ls bufferutil)
    Steps:
      1. cd .opencode/mcp-servers/excalidraw-agent-server
      2. npm ls bufferutil
    Expected Result: bufferutil listed
    Evidence: .omo/evidence/task-2-bufferutil.txt
  ```
  **Commit**: YES (with T1, T3)

- [x] 3. TDD — Test for WS handler extension

  **What to do**:
  - Write vitest tests in `src/__tests__/excalidraw-live-loop.test.mjs` (or .ts matching existing pattern)
  - Test RED: write failing test for WS handler routing (mocked WS connection)
  - After T1 implementation: test passes
  - Test cases:
    - scientific_prisma with valid args → returns elements
    - scientific_prisma with missing args → returns error
    - mermaid_to_excalidraw with valid mermaid → returns elements
    - apply_scientific_palette with valid args → returns elements
    - get_scientific_palettes → returns palette list
    - Unknown type → returns error

  **Must NOT do**:
  - Don't test the full live-loop (separate task T7)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`
  - Reason: Follows existing test pattern

  **Parallelization**: Wave 1 — parallel | Blocks: T4 | Blocked By: None

  **References**:
  - `.opencode/mcp-servers/excalidraw-agent-server/src/__tests__/server.test.ts` — Existing test pattern to follow
  - `.opencode/mcp-servers/excalidraw-agent-server/vitest.config.ts` — Test config
  - `.opencode/mcp-servers/excalidraw-agent-server/src/tools.ts` — Tool handlers being tested

  **Acceptance Criteria**:
  - [ ] Test file created
  - [ ] All test cases pass
  - [ ] `npm test` passes

  **QA Scenarios**:
  ```
  Scenario: TDD tests pass
    Tool: Bash (npm test)
    Steps:
      1. cd .opencode/mcp-servers/excalidraw-agent-server
      2. npm test
    Expected Result: All tests pass including new WS handler tests
    Evidence: .omo/evidence/task-3-tdd-pass.txt
  ```
  **Commit**: YES (with T1, T2)

- [x] 4. `excalidraw-live-loop.mjs` — Skeleton: WS connect, poll loop, reconnect, shutdown

**What to do**:
  - Create `src/excalidraw-live-loop.mjs`
  - **WS connect**: Connect to `ws://localhost:9877` as CLI client (no Origin header)
    - Use `ws` npm package (need ping/pong control)
    - Set `perMessageDeflate: false`
  - **Poll loop**: `setInterval` every 1500ms, send `{ type: "scene_read", requestId: <uuid> }`
    - Track `sceneVersion` from response to short-circuit full reads
  - **Reconnect**: On WS close/error, exponential backoff
    - Base: 500ms, cap: 30000ms
    - Jitter: multiply by `0.5 + Math.random() * 0.5`
    - Reset on successful connect
  - **Shutdown**: `process.on('SIGINT')` / `SIGTERM`
    - Clear interval
    - Close WS
    - Exit 0
  - **Logging**: All output to stderr (console.error), stdout reserved for potential JSON output
  - Add `"start:live": "node src/excalidraw-live-loop.mjs"` to package.json scripts

  **Must NOT do**:
  - Don't add command detection yet (T5)
  - Don't add command execution yet (T6)
  - Don't add health monitoring
  - Don't use globalThis.WebSocket (need ws package for perMessageDeflate control)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`
  - Reason: Core script skeleton, ~80 lines

  **Parallelization**: Wave 2 | Blocks: T5, T6, T7 | Blocked By: T3

  **References**:
  - `.opencode/mcp-servers/excalidraw-agent-server/src/index.ts:15-19` — ws import pattern
  - `.opencode/mcp-servers/excalidraw-agent-server/src/index.ts:171-183` — Ping/pong pattern (server side)
  - `.opencode/skills/excalidraw-agent/commands/read.js` — CLI client template (connect, message handle, settled guard, timeout)
  - WebSocket reconnection guide from research: exponential backoff with jitter, `perMessageDeflate: false`, `bufferedAmount` check

  **Acceptance Criteria**:
  - [ ] Script connects to WS :9877
  - [ ] Polls scene_read every 1500ms
  - [ ] Reconnects with exponential backoff on disconnect
  - [ ] SIGINT/SIGTERM → graceful exit 0
  - [ ] perMessageDeflate: false
  - [ ] Logs to stderr
  - [ ] npm start:live script registered

  **QA Scenarios**:
  ```
  Scenario: Script connects and polls
    Tool: Bash — run script in background, check stderr logs
    Preconditions: MCP server running on :9877
    Steps:
      1. node src/excalidraw-live-loop.mjs &
      2. sleep 3
      3. Check stderr for "connected" and "poll" messages
      4. kill %1
    Expected Result: Script connects, polls, exits cleanly
    Evidence: .omo/evidence/task-4-connect.txt

  Scenario: Scripts exits on SIGINT
    Tool: Bash
    Steps:
      1. Start script
      2. Send SIGINT
    Expected Result: Process exits with code 0, WS closed
    Evidence: .omo/evidence/task-4-shutdown.txt
  ```
  **Commit**: YES
  - Message: `feat(excalidraw-bridge): add excalidraw-live-loop.mjs skeleton`
  - Files: `src/excalidraw-live-loop.mjs`, `package.json`
  - Pre-commit: `npm test`

- [x] 5. `excalidraw-live-loop.mjs` — Command detection engine

**What to do**:
  - Add command detection to the poll loop from T4
  - **Detection logic** (in the poll handler, after scene_read response):
    1. Diff current scene against `lastProcessedHash` (based on canvas version, not stringify)
    2. If changed: scan all elements for `type === "text"` AND `!containerId` (independent text) AND `!groupIds.length` (not grouped)
    3. Check if text matches any command pattern:
       - `/^PRISMA\s+(\d+)\/(\d+)\/(\d+)\/(\d+)$/i`
       - `/^→\s*flowchart\s+(.+)$/i` (or `/^->\s*flowchart\s+(.+)$/i` for ascii)
       - `/^→\s*palette\s+(\w+)$/i`
       - `/^→\s*read$/i`
    4. Check idempotency: skip if command text + element position already in `processedCommands` Set
    5. If matched: set `busy = true` (execution lock), execute (see T6)
    6. If not matched: log "Unknown command" but don't crash
  - **Processed commands tracking**: Set of `${text}:${x}:${y}` — pruned when >100 entries (oldest first, or just keep last 100)

  **Must NOT do**:
  - Don't execute anything here — just detect and queue
  - Don't match text elements inside groups or bound to shapes
  - Don't crash on unknown patterns — log and continue

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`
  - Reason: Pure logic, ~60 lines

  **Parallelization**: Wave 2 — parallel with T6, T7 | Blocks: None | Blocked By: T4

  **References**:
  - `.opencode/mcp-servers/excalidraw-agent-server/src/tools.ts:527-759` — Tool argument schemas to know what params each command needs

  **Acceptance Criteria**:
  - [ ] PRISMA N/N/N/N detected → parsed into 4 numbers
  - [ ] → flowchart ... detected → rest of text extracted as mermaid string
  - [ ] → palette X detected → X extracted as palette name
  - [ ] → read detected → no-op, just acknowledge
  - [ ] Unknown text ignored (logged, not executed)
  - [ ] Same command on consecutive polls not re-executed (idempotent)
  - [ ] Text in groups NOT detected
  - [ ] Text bound to shapes NOT detected

  **QA Scenarios**:
  ```
  Scenario: PRISMA command parsed
    Tool: Unit test (vitest)
    Steps:
      1. Feed "PRISMA 200/100/50/25" to detection engine
    Expected Result: command="prisma", args={ records_identified: 200, records_screened: 100, reports_retrieved: 50, studies_included: 25 }
    Evidence: .omo/evidence/task-5-parsed-prisma.txt

  Scenario: Unknown text ignored
    Tool: Unit test
    Steps:
      1. Feed "hello world" to detection engine
    Expected Result: no command detected, no error thrown
    Evidence: .omo/evidence/task-5-ignored.txt

  Scenario: Text in group ignored
    Tool: Unit test with grouped element
    Steps:
      1. Feed element with type=text, groupIds=["g1"]
    Expected Result: skipped
    Evidence: .omo/evidence/task-5-grouped.txt
  ```
  **Commit**: YES (with T6, T7)

- [x] 6. `excalidraw-live-loop.mjs` — Command execution dispatch + result writing

**What to do**:
  - Add execution logic after detection (T5):
  - **Dispatch by command type**:
    - `prisma`: Call handleToolCall(`scientific_prisma`, args) → get elements → write to canvas
    - `flowchart`: Call handleToolCall(`mermaid_to_excalidraw`, { mermaid }) → get elements → write
    - `palette`: First scene_read to get current elements → call handleToolCall(`apply_scientific_palette`, { elements, palette }) → write back
    - `read`: Just update lastProcessedHash, no canvas write
  - **Writing results**: Send `{ type: "scene_write", elements: [...], requestId: uuid }` via WS
    - Position results at x+200, y from the command text position (offset approach)
    - For PRISMA: offset so it doesn't overlap the command text
  - **Error handling**:
    - If tool call returns error → inject error text element on canvas near the command text
    - WS send error → log, don't crash
    - WS send buffer check: skip if `ws.bufferedAmount > 1e6`
  - **Execution lock**: Set `busy = true` before starting, `false` after done. Poll handler skips if busy.
  - **Rate limiting**: If busy, skip this poll cycle. Next cycle picks up new changes.

  **Must NOT do**:
  - Don't do complex layout — fixed offset is fine
  - Don't delete the command text (user removes it manually)
  - Don't parallelize command execution (one at a time)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`
  - Reason: Dispatch logic + WS write, ~50 lines

  **Parallelization**: Wave 2 — parallel with T5, T7 | Blocks: None | Blocked By: T4

  **References**:
  - `.opencode/mcp-servers/excalidraw-agent-server/src/tools.ts:193-235` — handleToolCall() signature
  - `.opencode/skills/excalidraw-agent/commands/write.js` — scene_write WS pattern with retry
  - `.opencode/mcp-servers/excalidraw-agent-server/src/zod-schemas.ts:22-25` — scene_write schema (elements array)

  **Acceptance Criteria**:
  - [ ] PRISMA command → scene_write with 7+ diagram elements on canvas
  - [ ] flowchart command → scene_write with converted elements
  - [ ] palette command → scene_write with recolored elements
  - [ ] read command → no scene_write, just version update
  - [ ] Error on tool → error text element written near command
  - [ ] WS buffer full → skip, next cycle retries
  - [ ] Busy → skip poll, don't queue

  **QA Scenarios**:
  ```
  Scenario: PRISMA execution
    Tool: Integration test via WS
    Preconditions: MCP server + wrapper app running
    Steps:
      1. Write text element "PRISMA 200/100/50/25" on canvas
      2. Wait for poll cycle (max 3s)
      3. Read canvas — check new elements present
    Expected Result: PRISMA flow diagram elements appear on canvas
    Evidence: .omo/evidence/task-6-prisma-exec.txt

  Scenario: Error text on canvas
    Tool: Integration test via WS
    Steps:
      1. Write text element "PRISMA abc/def/ghi/jkl"
      2. Wait for poll cycle
    Expected Result: Error text element appears near command
    Evidence: .omo/evidence/task-6-error-text.txt
  ```
  **Commit**: YES (with T5, T7)

- [x] 7. TDD — Tests for live loop script

**What to do**:
  - Write vitest tests in `src/__tests__/excalidraw-live-loop.test.mjs`
  - Test scenarios:
    - Command detection engine (T5): all 4 patterns, unknown text, grouped text, bound text
    - Idempotency: same command detected twice → only executed once
    - Execution lock: busy flag prevents concurrent execution
    - Reconnection: mock WS close → verify reconnection attempt
    - Shutdown: SIGINT → verify cleanup
    - WS buffer full: bufferedAmount > 1e6 → verify skip

  **Must NOT do**:
  - Don't test full end-to-end with real canvas (that's QA)
  - Don't test the WS handler extension (covered by T3)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `[]`
  - Reason: Unit tests following existing pattern

  **Parallelization**: Wave 2 — parallel | Blocks: None | Blocked By: T4

  **References**:
  - `.opencode/mcp-servers/excalidraw-agent-server/src/__tests__/server.test.ts` — Test pattern
  - `.opencode/mcp-servers/excalidraw-agent-server/vitest.config.ts` — Config

  **Acceptance Criteria**:
  - [ ] All command detection scenarios tested
  - [ ] Idempotency tested
  - [ ] Execution lock tested
  - [ ] Reconnection tested (mocked)
  - [ ] Shutdown tested
  - [ ] `npm test` passes

  **QA Scenarios**:
  ```
  Scenario: All live loop tests pass
    Tool: Bash (npm test)
    Steps:
      1. cd .opencode/mcp-servers/excalidraw-agent-server
      2. npm test
    Expected Result: All tests pass
    Evidence: .omo/evidence/task-7-tests-pass.txt
  ```
  **Commit**: YES (with T5, T6)

---

## Final Verification Wave

- [x] F1. Plan Compliance Audit — Read plan end-to-end. For each Must Have: verify implementation exists (read file, run test). For each Must NOT Have: search codebase for forbidden patterns. Check evidence files exist.
  Agent: oracle

- [x] F2. Code Quality Review — Run tsc linter and tests. Review for as any, ts-ignore, empty catches, console.log, unused imports.
  Agent: unspecified-high

- [x] F3. Real Manual QA — Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration (WS handler + detection + execution). Save to .omo/evidence/final-qa/.
  Agent: unspecified-high + playwright skill

- [x] F4. Scope Fidelity Check — For each task: read What to do, read actual diff. Verify 1:1 everything built, nothing beyond spec. Check Must NOT do compliance.
  Agent: deep

---

## Commit Strategy

- **Wave 1**: `feat(excalidraw-bridge): add WS handlers for scientific/mermaid MCP tools + bufferutil`
- **Wave 2**: `feat(excalidraw-bridge): add excalidraw-live-loop.mjs with command detection and execution`
- **Final**: (if needed) `fix(excalidraw-bridge): post-review fixes`

---

## Success Criteria

### Verification Commands
```bash
cd .opencode/mcp-servers/excalidraw-agent-server && npm test  # all tests pass
```

### Final Checklist
- [x] ALL 7 tasks completed and committed
- [x] F1-F4 all APPROVE
- [x] User explicitly confirms "ok"
