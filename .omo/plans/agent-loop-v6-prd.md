# PRD: agent-loop v6 — Daemon + Multi-loop + UI + Maker/Checker

## Problem Statement

agent-loop v5 is a CLI-run loop orchestrator: you start it, it runs N iterations, it stops. It works for one-shot automated tasks but can't operate as a persistent 24/7 service. There's no way to queue tasks, schedule recurring runs, watch for incoming work, run multiple independent loops, monitor progress from a browser, or add a safety review step between "agent writes" and "change is applied." The v6 goal is to operationalize agent-loop into a long-lived daemon with task queue, multi-loop orchestration, an embedded web dashboard, and optional maker/checker review phases.

## Solution

Transform agent-loop from a CLI-runnable loop into a **persistent daemon** with:

1. **Daemon mode** (`bun loop.ts daemon`) — stays alive 24/7, accepts tasks via API/cron/file watch, executes them sequentially, logs results
2. **Task queue** — FIFO queue, sequential execution, history persisted to `_loop-history/`
3. **Multi-loop orchestration** — parent daemon manages multiple child loops (same process, shared state), configured via `loops.yaml` or API
4. **Embedded SPA dashboard** — vanilla HTML/JS served by Bun.serve, 3 pages (live, history, detail), read-write controls
5. **Maker/checker plugin** — optional phase type where one agent writes and another reviews before the change is accepted
6. **Loop-engineering conventions** — `agent-loop init` scaffolds STATE.md/LOOP.md/AGENTS.md, daemon auto-updates STATE.md after each run

All of this is backward compatible with v5: existing `bun loop.ts start`, `--plan`, `--plugins`, and `--memory` continue working unchanged.

## User Stories

1. As a developer, I want to run `bun loop.ts daemon` so that the daemon stays alive 24/7 and waits for tasks instead of running once and exiting
2. As a developer, I want to queue tasks via `POST /task` so that I can submit work to the daemon from scripts or other tools
3. As a developer, I want tasks to execute sequentially (FIFO) so that they don't conflict with each other
4. As a developer, I want completed tasks persisted to `_loop-history/` so that I can inspect past runs, logs, and results
5. As a developer, I want to define cron schedules for tasks so that the daemon runs recurring work (e.g., daily triage at 9am)
6. As a developer, I want to drop a `.plan.yaml` file into a watched directory so that the daemon picks it up and executes it automatically
7. As a developer, I want to define multiple child loops in `loops.yaml` so that different projects or workflows run independently under the same daemon
8. As a developer, I want to start/stop child loops via API so that I can control workflow execution from scripts
9. As a developer, I want all child loops to share the same global state so that they can coordinate and share data
10. As a developer, I want to add child loops dynamically via API so that I don't need to restart the daemon for configuration changes
11. As a developer, I want to open `http://localhost:3000/dashboard` in a browser so that I can see live daemon state, task queue, and active children
12. As a developer, I want a task history page so that I can review past runs sorted by date or filtered by status
13. As a developer, I want a task detail page so that I can see phase-by-phase logs, duration, and status for a specific run
14. As a developer, I want to start/stop the daemon and trigger tasks from the dashboard so that I don't need a terminal for common operations
15. As a developer, I want WebSocket real-time updates on the dashboard so that I see state changes without refreshing
16. As a developer, I want an optional maker/checker plugin so that agent outputs are reviewed before they are accepted (safety gate)
17. As a developer, I want the maker/checker to retry failed checks up to a configurable limit so that transient issues don't fail the whole workflow
18. As a developer, I want the maker/checker to be disabled by default so that existing loops are unaffected
19. As a developer, I want `agent-loop init` to scaffold STATE.md, LOOP.md, and AGENTS.md so that new projects have the loop-engineering conventions from the start
20. As a developer, I want the daemon to auto-update STATE.md after each run so that the markdown files always reflect the latest state
21. As a developer, I want the daemon to preserve human edits to STATE.md markdown body when updating frontmatter so that notes and annotations survive updates
22. As a developer, I want existing v5 features (`bun loop.ts start`, `--plan`, `--memory`, `--plugins`, `--llm`) to keep working so that the upgrade is risk-free
23. As a developer, I want zero new npm dependencies so that the project stays lightweight and easy to audit

## Implementation Decisions

### Architecture

The daemon extends the existing `runDaemon()` function in `loop.ts` (currently a setInterval-based tick loop). The v6 daemon replaces the interval approach with a **persistent event loop** that waits for tasks from three sources:

```
Task sources:  API (POST /task) ─┐
               Cron trigger    ──┤──→ Task Queue (FIFO) → Execute Loop → _loop-history/
               File watch      ──┘                              ↓
                                                            Update STATE.md
```

### Daemon State Machine

```
  IDLE ──task queued──> QUEUED ──dequeue──> RUNNING ──complete──> IDLE
                                               │
                                               └──error──> IDLE (error logged)
```

The daemon is always in one of three states: IDLE (waiting), QUEUED (tasks waiting), RUNNING (executing). This is separate from the loop's 4-state machine (init/run/verify/done) which runs inside each task execution.

### Task Queue

- In-memory FIFO queue, serialized to `DaemonState.taskQueue` for crash recovery
- Sequential: only one task runs at a time
- Three sources: API (POST /task), cron (scheduled), file watch (new .plan.yaml)
- History: each task → `_loop-history/{taskId}/task.json` with full phase logs

### Multi-loop Orchestration

- Child loops are **logical groupings** within the same daemon process, not separate processes
- All children share the same global `state.json`
- Children are declared in `loops.yaml` or via API (POST /loops)
- Parent can start/stop children independently
- When started, a child registers its plan and triggers with the daemon
- When stopped, its triggers are deregistered

### Dashboard

- Vanilla HTML/JS/CSS — no framework, no build step
- Served by the daemon's Bun.serve at `GET /dashboard`
- 3 client-side hash routes: `#/` (live), `#/history` (list), `#/task/:id` (detail)
- Real-time updates via existing WebSocket (`/ws`)
- Controls: POST /api/start, POST /api/stop, POST /api/trigger
- Dark theme, terminal-dashboard aesthetic

### Maker/Checker Plugin

- Optional plugin, disabled by default (`enabled: false`)
- When enabled: a `maker` phase completion → auto-schedule a `checker` phase
- Checker phase evaluates maker output (PASS/FAIL via LLM)
- On FAIL: retry maker up to `maxCheckerRetries` (default 2)
- On max retries exceeded: phase marked FAILED
- `autoApprove: false` (default) → checker can block the pipeline

### Triggers

- **Cron**: Simple 5-field parser (minute hour day month weekday). Self-correcting (missed ticks skipped, not queued late).
- **File watch**: `fs.watch` on configured directory, filters by pattern (`*.plan.yaml`), debounce 500ms, moves processed files to `.processed/`.

### Conventions

- `agent-loop init` creates STATE.md, LOOP.md, AGENTS.md with default content
- STATE.md auto-update: YAML frontmatter only (version, last_run, active_children, high_priority, watch_items)
- Human-added markdown body is preserved during auto-updates
- Loops config at `loops.yaml` in project root

### Backward Compatibility

- Existing `bun loop.ts start` unchanged
- Existing `--plan`, `--plugins`, `--memory`, `--llm`, `--daemon` flags unchanged
- Existing `src/index.ts` barrel export unchanged
- Existing `src/mcp.ts`, `src/evaluate.ts`, `src/safety.ts` unchanged
- Zero new npm dependencies

## Testing Decisions

### Seams

The **highest testing seam** is the daemon's API endpoints. Every feature (task queue, history, multi-loop, triggers) is exercised through the API:

| Feature | Seam | What to Test |
|---------|------|-------------|
| Task queue | POST /task → GET /state → history file | Queue, execute, persist |
| History | GET /api/history, GET /api/tasks/:id | List, detail, edge cases |
| Multi-loop | POST /loops, GET /loops, POST /loops/:id/start| Create, list, start/stop |
| Triggers | File watch: drop .plan.yaml → task completes | Auto-detect, execute |
| Maker/checker | POST /task with maker → both phases execute | Maker+checker lifecycle |
| Conventions | bun loop.ts init → files exist | Scaffold, skip, update |
| Dashboard | GET /dashboard → 200 HTML | Serve, WS connect |

### What Makes a Good Test

- Test external behavior (API responses, file state), not internal implementation
- Each test starts daemon on random port, creates temp dirs, cleans up after
- Unit tests for queue logic, trigger parsing, config validation
- Integration tests for cross-module flows

### Prior Art

- Existing `__tests__/daemon.test.ts` — integration test pattern for daemon
- Existing `__tests__/plugins.test.ts` — plugin lifecycle patterns
- Existing `__tests__/config.test.ts` — config parsing patterns

### New Test Modules

| File | Type | Tests |
|------|------|-------|
| `__tests__/task-queue.test.ts` | Unit | Queue FIFO, lifecycle, edge cases |
| `__tests__/history.test.ts` | Unit | Save/read/list, edge cases |
| `__tests__/triggers.test.ts` | Unit | Cron parsing, file watch, debounce |
| `__tests__/orchestrator.test.ts` | Unit | Add/remove/start/stop children |
| `__tests__/maker-checker.test.ts` | Unit | Plugin lifecycle, retry logic |
| `__tests__/init.test.ts` | Unit | Scaffold, skip, force overwrite |
| `__tests__/v6-integration.test.ts` | Integration | Daemon lifecycle, full workflows |

## Out of Scope

- No subprocess isolation for child loops (same process only)
- No per-child security sandboxing or CPU/memory limits
- No React or any build step for the dashboard (vanilla only)
- No persistent database beyond JSON/SQLite files
- No docker/container packaging or Kubernetes support
- No distributed multi-machine orchestration
- No breaking changes to v5 plugin interface, types, or config
- No removal of existing v5 features
- No changes to src/mcp.ts, src/evaluate.ts, src/safety.ts, src/index.ts
- No human approval UI for maker/checker (autoApprove=false means phase doesn't auto-continue, but no approval popup)

## Further Notes

- The plan is at `.omo/plans/agent-loop-v6-daemon.md` with full task breakdown
- Execution: multi-session. Wave 1 (parallel), Wave 2 (parallel), Wave 3 (sequential), Wave 4 (docs), Wave FINAL (4 parallel reviewers)
- Estimated ~15 new/modified files, ~50+ new tests
- Estimated net addition: ~2000 LOC (new) + ~500 LOC (modifications to existing)
