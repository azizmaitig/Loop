# ISSUE-001 — Daemon skeleton

## What to build

Replace the existing `runDaemon()` setInterval-based loop with a persistent `Daemon` class that stays alive and accepts API requests. The daemon doesn't execute tasks yet (that's Issue-002) — it just starts, serves health/state endpoints, and waits.

- Create `src/daemon.ts` with a `Daemon` class:
  - `start()` — initializes state, starts Bun.serve, blocks
  - `stop()` — graceful shutdown
  - Internal event loop: polls a task queue (initially empty), waits when no tasks
- API endpoints (add to existing `src/api.ts` or create inline):
  - `GET /health` → `{ status: 'ok', uptime: number }`
  - `GET /state` → daemon state JSON (extends existing LoopState with daemon-specific fields)
  - `GET /api/version` → `{ version: '0.6.0' }`
- CLI: `bun loop.ts daemon` — refactor `main()` to route `daemon` subcommand to Daemon.start()
- Daemon does NOT yet execute tasks (no queue, no history). It just serves endpoints and idles.

## Acceptance Criteria

- [ ] `bun loop.ts daemon` starts and blocks (doesn't exit)
- [ ] `GET /health` returns JSON with status 'ok' and uptime
- [ ] `GET /state` returns daemon state JSON
- [ ] `GET /api/version` returns version string
- [ ] `POST /stop` shuts down daemon gracefully within 2s
- [ ] Daemon starts on configurable port (default 3000)
- [ ] Daemon starts on `--port 3099` when passed
- [ ] All existing `bun test` tests still pass
- [ ] Existing `bun loop.ts start` still works unchanged

## Blocked by

None — can start immediately.
