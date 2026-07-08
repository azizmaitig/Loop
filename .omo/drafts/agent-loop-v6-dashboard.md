---
slug: agent-loop-v6-dashboard
status: approved
intent: clear
pending-action: write .omo/plans/agent-loop-v6-dashboard.md
approach: One self-contained HTML SPA + WebSocket support in daemon.ts, no framework or build step
---

# Draft: agent-loop-v6-dashboard

## Components (topology ledger)
| id | outcome | status | evidence |
|----|---------|--------|----------|
| src/dashboard/index.html | Self-contained SPA, 3 hash routes, dark theme | active | ISSUE-005-dashboard.md |
| daemon.ts WebSocket + /dashboard | Serve HTML + WS upgrade + broadcast events | active | daemon.ts:81-213 |
| Existing REST APIs | Consumed by SPA (state, history, tasks, loops) | active | daemon.ts:94-210 |

## Open assumptions (announced defaults)
| assumption | default | rationale | reversible? |
|-----------|---------|-----------|-------------|
| No frameworks | Vanilla HTML/JS/CSS, one-file SPA | Spec says so; zero deps, zero build | No — spec requirement |
| Bun.serve WebSocket | Native WS in Bun.serve websocket handler | Bun has first-class WS support, no extra dep | Yes — could swap to a WS lib |
| Dark theme only | No light mode | Terminal-dashboard aesthetic per spec | Yes — could add CSS media query later |
| WS broadcasts on task/child state transitions | No polling | Real-time is the goal, reduces API load | Yes — fallback to polling |

## Findings (cited - path:lines)

### Existing APIs the SPA will consume
- src/daemon.ts:94-97 — GET /state → daemon status, queue length, current task
- src/daemon.ts:129-135 — GET /api/history?page=N&pageSize=20 → paginated task list
- src/daemon.ts:137-146 — GET /api/tasks/:id → full task detail with logs
- src/daemon.ts:110-127 — POST /task { command } → enqueue new task
- src/daemon.ts:104-108 — POST /stop → graceful shutdown
- src/daemon.ts:174-177 — GET /loops → list child loops with status
- src/daemon.ts:148-159 — POST /loops/:id/start → start child
- src/daemon.ts:161-172 — POST /loops/:id/stop → stop child

### WebSocket needed
- No existing WS endpoint in daemon.ts
- Bun.serve supports WebSocket natively via `websocket: {}` config
- Need to track connected clients + broadcast on state changes
- Events: state_change (daemon status/queue), task_completed, child_status_change

### Current daemon architecture
- daemon.ts:81-213 — Bun.serve fetch handler, currently all REST + 404 fallback
- Adding WS requires adding `websocket` property to the Bun.serve config + WS upgrade in fetch
- The daemon already has access to taskQueue (task state changes) and orchestrator (child state changes)

## Decisions (with rationale)

### D1 — Single HTML file vs separate files
**Decision**: Single `index.html` with inline CSS/JS.
**Rationale**: Simplest serving (no build step, no extra files to resolve). Spec explicitly says self-contained HTML. Keeps deployment to one file read from disk.

### D2 — WebSocket broadcasting hooks
**Decision**: Add WebSocket clients Set to Daemon class. Hook broadcasts at task completion/failure (taskQueue events) and child start/stop (orchestrator events). Periodic state broadcasts on a timer (every 2s) for UI refresh.
**Rationale**: Event-driven for mutations, timer for general state. Simple, covers all cases without complex event wiring.

### D3 — Filesystem serving
**Decision**: Read `src/dashboard/index.html` once at daemon start, cache in memory, serve on GET /dashboard.
**Rationale**: No file system overhead per request. The HTML is static, never changes at runtime.

## Scope IN
- Create `src/dashboard/index.html` — self-contained vanilla SPA
- 3 hash-routed pages: Live (#/), History (#/history), Task detail (#/task/:id)
- Dark terminal theme, CSS custom properties, monospace logs
- WebSocket connection with auto-reconnect
- Controls: stop daemon, trigger task, start/stop child, re-run task
- WS events: state_change, task_completed, child_status_change
- GET /dashboard → serves index.html
- GET /ws → WebSocket upgrade
- Integration test: start daemon, fetch dashboard, verify WS connects

## Scope OUT (Must NOT have)
- No frameworks, no build step, no npm dependencies
- No light mode (dark theme only)
- No authentication/authorization
- No dashboard customization/persistence
- No charts or graphs beyond simple text/CSS indicators
- No changes to existing REST API contracts
- No changes to task-queue.ts, orchestrator.ts, triggers.ts, history.ts

## Open questions
None — spec is well-defined and codebase clear.

## Approval gate
status: approved
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
