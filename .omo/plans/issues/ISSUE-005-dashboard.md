# ISSUE-005 — Dashboard SPA

## What to build

An embedded web dashboard served by the daemon at `GET /dashboard`. Vanilla HTML/JS/CSS — no framework, no build step. 3 client-side pages, real-time WebSocket updates, read-write controls.

- Create `src/dashboard/` with a single `index.html` (self-contained HTML+CSS+JS):
  - Dark theme, terminal-dashboard aesthetic
  - 3 hash routes:
    - `#/` — Live dashboard: daemon state, current task, queued tasks, active children, controls
    - `#/history` — Task history table: sortable by date, filterable by status, paginated (20/page)
    - `#/task/:id` — Task detail: full command, phase-by-phase breakdown with logs, re-run button
- WebSocket connection to `/ws` for real-time updates:
  - Auto-reconnect on disconnect
  - Events: state_change, task_completed, child_status_change
- Controls (POST via fetch):
  - Stop daemon
  - Trigger a task (text input + submit)
  - Start/stop child loops (per child)
- Serve from daemon:
  - `GET /dashboard` → serves index.html
  - Static resources inline or from `src/dashboard/` directory
- Styling: CSS custom properties, minimal, functional. Think `tailwind`-less, dark mode, monospace for logs.
- Test: start daemon, fetch GET /dashboard → returns 200 text/html with correct structure

## Acceptance Criteria

- [ ] `GET /dashboard` returns self-contained HTML page
- [ ] Live dashboard (`#/`) shows daemon state, task queue, active children
- [ ] History page (`#/history`) lists tasks, paginated, sortable
- [ ] Task detail page (`#/task/:id`) shows phase logs
- [ ] Controls work: trigger task, stop daemon, start/stop child
- [ ] WebSocket connects and receives state updates
- [ ] WS auto-reconnects on disconnect
- [ ] No framework/build step — vanilla HTML/JS only
- [ ] Old browsers don't crash (graceful degradation)
- [ ] All existing tests pass

## Blocked by

- ISSUE-002 (history endpoints for history page + task detail)
- ISSUE-004 (child loop controls for the dashboard)
