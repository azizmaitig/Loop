# ISSUE-002 — Task queue + history

## What to build

POST /task enqueues a task → daemon executes it sequentially → result persisted to `_loop-history/`. End-to-end: API → queue → execution → persistence.

- Create `src/task-queue.ts`:
  - `TaskQueue` class: enqueue/dequeue/complete/fail/cancel/peek
  - FIFO, sequential (only one task runs at a time)
  - In-memory, serialized to daemon state
- Create `src/history.ts`:
  - `saveTaskHistory(baseDir, taskHistory)` → writes to `_loop-history/{taskId}/task.json`
  - `readTaskHistory(baseDir, taskId)` → reads single task
  - `listTaskHistory(baseDir)` → returns summary list
  - Phase logs written as JSON, one file per phase
- Wire into daemon:
  - POST /task accepts `{ command: string, timeoutMs?: number, llm?: {...} }`
  - Daemon picks up queued tasks sequentially in its event loop
  - After task completes → save history → update STATE.md → pick next task
- API endpoints:
  - POST /task → 201 with task ID
  - GET /state → now shows queue length, current task status
  - GET /api/history → paginated list (20 per page, sort by date desc)
  - GET /api/tasks/:id → single task detail with phase logs
- Handle edge cases: empty queue (idle), invalid body (400)

## Acceptance Criteria

- [ ] POST /task with `{"command":"echo hi"}` → 201 with task ID
- [ ] Task appears in GET /state with status 'queued'
- [ ] Task moves to 'running' then 'completed'
- [ ] `_loop-history/{taskId}/task.json` exists after completion
- [ ] GET /api/history returns list with pagination
- [ ] GET /api/tasks/:id returns full detail with phase logs
- [ ] POST /task with invalid body returns 400
- [ ] Multiple tasks queued → execute in FIFO order
- [ ] GET /state shows queue correctly (length, current)
- [ ] All existing tests pass

## Blocked by

- ISSUE-001 (daemon skeleton must exist to wire into)
