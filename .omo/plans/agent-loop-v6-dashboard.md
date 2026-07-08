# agent-loop-v6-dashboard - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** A live web dashboard for your daemon — see state, queue, children, and task history in real-time. Start/stop child loops, trigger tasks, stop the daemon. All from your browser, zero setup.

**Why this approach:** One self-contained HTML file, no build step, no npm install. Vanilla JS speaks directly to the existing REST APIs + new WebSocket. Dark terminal aesthetic matches the tool's character.

**What it will NOT do:** Add authentication, light mode, charts/graphs, or any build tooling. No changes to existing REST APIs.

**Effort:** Medium
**Risk:** Low — 2 files changed (index.html new, daemon.ts modified), no dependencies
**Decisions to sanity-check:** WebSocket events schema (what gets broadcast on each event type)

Your next move: **Approve** this plan.

---

> TL;DR (machine): Medium, Low risk — self-contained dark-themed dashboard SPA + WebSocket in daemon.ts

## Scope
### Must have
- src/dashboard/index.html — self-contained vanilla SPA, 3 pages, dark theme, controls
- GET /dashboard route in daemon.ts — serves the HTML
- WebSocket /ws — real-time broadcasts (state_change, task_completed, child_status_change)
- Controls: stop daemon, trigger task, start/stop child, re-run task
- Auto-reconnect WebSocket on disconnect
- Paginated task history (#/history)
- Task detail with logs + re-run (#/task/:id)

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No frameworks or build step — vanilla HTML/JS/CSS only
- No authentication/authorization
- No light mode (dark only)
- No charts, graphs, or visualization libraries
- No changes to task-queue.ts, orchestrator.ts, triggers.ts, history.ts
- No changes to existing API contracts (state, history, tasks, loops endpoints)
- No npm dependencies

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after (create daemon-v6.test.ts integration tests)
- Framework: bun:test
- Evidence: daemon test covers GET /dashboard → 200 HTML + WS connect

## Execution strategy
### Parallel execution waves
Wave 1 (parallel): HTML SPA (independent) + daemon WS + /dashboard route (independent)
Wave 2 (sequential): Integration tests

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. Create dashboard HTML | none | 3 | 2 |
| 2. Add WebSocket + /dashboard to daemon | none | 3 | 1 |
| 3. Integration tests | 1, 2 | - | - |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

### Wave 1a — Dashboard HTML SPA

- [ ] 1. Create src/dashboard/index.html — self-contained SPA
  What to do: Create single HTML file with inline CSS + JS. Dark theme (CSS custom props on :root), terminal-dashboard aesthetic. 3 hash routes (JS router via hashchange event): 
  - `#/` — Live: daemon status card, current task, queue list, children table with start/stop buttons, stop daemon button, trigger task form
  - `#/history` — Task history table, fetch GET /api/history?page=N, prev/next buttons, filter row by status, sortable columns (click header)
  - `#/task/:id` — Full task detail: command, status badge, exit code, stdout/stderr logs (monospace, scrollable), duration, re-run button (POST /task with same command)
  - WebSocket client: connect to `ws://host/ws`, auto-reconnect on close (3s delay), handle JSON messages: state_change → update live page, task_completed → update history, child_status_change → update children table
  - Fetch wrapper for REST calls to same origin
  - CSS: color-scheme dark, bg #0a0a0a, text #e0e0e0, accent #00ff88 (green), warning #ff8800, error #ff3333, card bg #1a1a1a, monospace font for all, CSS custom properties for all colors/sizes
  Must NOT do: No <script src> or <link href> to external files. No import statements. No build tools. Must work when served from any path (use relative URLs for API calls).
  Parallelization: Wave 1a | Blocked by: none | Blocks: 3
  References: ISSUE-005-dashboard.md (full spec), daemon.ts:94-210 (all REST API endpoints)
  Acceptance criteria: File exists at src/dashboard/index.html. Valid HTML5. No external dependencies. Three hash routes visible on navigation.
  QA scenarios: Open the file in a browser (file://) — pages render correctly, hash routing works. No console errors.
  Commit: Y | feat(agent-loop-v6): dashboard SPA — self-contained vanilla HTML/JS/CSS

### Wave 1b — Daemon WebSocket + /dashboard route

- [ ] 2. Add WebSocket support + /dashboard route to daemon.ts
  What to do: 
  - Read `src/dashboard/index.html` once at daemon start, cache as string
  - Add `GET /dashboard` before the 404 fallback: returns cached HTML with Content-Type text/html
  - Add `websocket` property to Bun.serve config:
    - `open(ws)`: add to Set of clients, send initial state snapshot
    - `close(ws)`: remove from Set
    - `message(ws, data)`: no-op (SPA is receive-only for WS, sends via REST)
  - Upgrade path: in fetch, if url.pathname === '/ws' → `server.upgrade(req)` returns true
  - Create private `broadcast(eventType, data)` method: iterate client set, send JSON `{ type, data, timestamp }`
  - Call `broadcast('state_change', this.getState())` every 2s via setInterval
  - Call `broadcast('task_completed', task)` after task queue completes/fails a task (in executeTask)
  - Call `broadcast('child_status_change', { id, status, name })` after startChild/stopChild via orchestrator hook
  Must NOT do: Do not modify orchestrator.ts, task-queue.ts, triggers.ts, history.ts. Do not change any existing route's behavior or response shape.
  Parallelization: Wave 1b | Blocked by: none | Blocks: 3
  References: daemon.ts:81-213 (existing fetch handler), Bun.serve WebSocket docs (websocket: { open, message, close }), ISSUE-005-dashboard.md
  Acceptance criteria: `GET /dashboard` returns 200 with text/html content-type. `GET /ws` returns 101 (WebSocket upgrade). On state change, WS clients receive JSON messages.
  QA scenarios: Start daemon, `curl http://localhost:3000/dashboard` → 200 HTML. WS connects via `bun -e "new WebSocket('ws://localhost:3000/ws').onmessage=e=>console.log(e.data)"`.
  Commit: Y | feat(agent-loop-v6): WebSocket + /dashboard route in daemon.ts

### Wave 2 — Integration tests

- [ ] 3. Add integration tests for dashboard + WebSocket
  What to do: In __tests__/daemon-v6.test.ts, add:
  - Test: start daemon, fetch GET /dashboard → 200 + Content-Type text/html + body includes 'Live', 'History', 'Task Detail'
  - Test: start daemon, WebSocket connect to /ws → onopen fires, onmessage receives state_change within 3s
  - Test: WebSocket auto-reconnect — close WS, verify new connection receives events
  Must NOT do: Do not test every UI interaction (those are verified by reading the HTML). Do not add a new test file.
  Parallelization: Wave 2 | Blocked by: 1, 2 | Blocks: none
  References: daemon.ts (new dashboard + WS code), __tests__/orchestrator.test.ts (existing daemon test patterns)
  Acceptance criteria: `bun test` — 294+ tests pass (3 new), all assertions green
  QA scenarios: Run `bun test __tests__/daemon-v6.test.ts` — new tests pass alongside existing
  Commit: Y | test(agent-loop-v6): dashboard + WebSocket integration tests

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit — all 3 todos complete, all must-haves delivered
- [ ] F2. `bun test` — 294+ pass, 0 fail
- [ ] F3. Manual: start daemon, open http://localhost:3000/dashboard in browser, verify 3 pages + WS live update
- [ ] F4. Scope fidelity — no changes to orchestrator.ts, task-queue.ts, etc.

## Commit strategy
- Commit 1: `feat(agent-loop-v6): dashboard SPA — self-contained vanilla HTML/JS/CSS`
- Commit 2: `feat(agent-loop-v6): WebSocket + /dashboard route in daemon.ts`
- Commit 3: `test(agent-loop-v6): dashboard + WebSocket integration tests`

## Success criteria
- `GET /dashboard` returns 200 with self-contained HTML
- `GET /ws` upgrades to WebSocket (101)
- WS clients receive state_change, task_completed, child_status_change events
- SPA renders 3 hash routes (#/, #/history, #/task/:id)
- Controls: trigger task, stop daemon, start/stop child all work via REST
- WebSocket auto-reconnects on disconnect
- `bun test` — all 294+ tests pass
- No changes to orchestrator.ts, task-queue.ts, triggers.ts, history.ts, loop.ts
