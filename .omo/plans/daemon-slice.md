# Implementation Plan: Daemon Slice (routes + task-processor)

## Overview

Extract HTTP/WS route handlers and task processing logic from `daemon.ts` (572 LOC)
into separate `routes.ts` and `task-processor.ts` modules behind `DaemonAPI` and
`TaskContext` seams. `daemon.ts` becomes orchestration only (~160 LOC).

See ADR-0003 for full architecture decisions.

## Architecture Decisions

- **`DaemonAPI` interface** — routes get a narrow interface to daemon state
- **`TaskContext` value object** — task processor gets all deps injected
- **No new classes** — standalone functions, explicit deps

## Task List

### Phase 1: Task processor extraction

- [ ] **Task 1.1**: Create `src/task-processor.ts` with `processTask(context: TaskContext)`
  - Extract `Daemon.processQueue()` logic into a standalone async function
  - Define and export `TaskContext` interface (task + config + deps)
  - Move related imports from daemon.ts
  - Acceptance: `processTask()` accepts a `TaskContext` and returns `Promise<void>`
  - Files: `src/task-processor.ts` (new), `src/daemon.ts` (modify)
  - Scope: Medium (3-4 files)

- [ ] **Task 1.2**: Wire `processTask` into daemon.ts
  - Replace `this.processQueue()` body with call to `processTask()`
  - Construct `TaskContext` from daemon state at call site
  - Acceptance: `bun test __tests__/daemon*.test.ts` passes
  - Files: `src/daemon.ts`
  - Scope: Small (1-2 files)

- [ ] **Task 1.3**: Add unit tests for task-processor.ts
  - Test with fake TaskContext (no IO)
  - Cover: success, LLM call, MCP call, budget exceeded, save failure
  - Acceptance: `bun test __tests__/task-processor.test.ts` passes
  - Files: `__tests__/task-processor.test.ts` (new)
  - Scope: Medium (1 file)

### Checkpoint: Task Processor
- [ ] `bun test __tests__/daemon*.test.ts` passes
- [ ] `bun test __tests__/task-processor.test.ts` passes
- [ ] `bun test` passes (all existing tests)

### Phase 2: Routes extraction

- [ ] **Task 2.1**: Define `DaemonAPI` interface in `src/daemon-api.ts`
  - Extract from Daemon class's public surface: getState, start, stop, taskQueue, triggerManager, orchestrator, broadcast
  - Export the interface and a `type DaemonAPI = ...` type alias
  - Files: `src/daemon-api.ts` (new)
  - Scope: XS (1 file)

- [ ] **Task 2.2**: Create `src/routes.ts` with `registerRoutes(server, api: DaemonAPI)`
  - Extract all Bun.serve route handlers from Daemon class to standalone functions
  - WS upgrade + message handler extracted alongside HTTP routes
  - Routes receive `DaemonAPI` instead of accessing `this.*`
  - Acceptance: `bun test __tests__/daemon*.test.ts` passes
  - Files: `src/routes.ts` (new), `src/daemon.ts` (modify)
  - Scope: Medium (3-4 files)

- [ ] **Task 2.3**: Wire routes into daemon.ts
  - Call `registerRoutes(server, this)` in `Daemon.start()` instead of inline handlers
  - Update `Daemon.start()` to create server config and pass it to `registerRoutes`
  - Acceptance: `bun test __tests__/daemon*.test.ts` passes
  - Files: `src/daemon.ts`
  - Scope: Small (1-2 files)

- [ ] **Task 2.4**: Add unit tests for routes.ts
  - Test with mock DaemonAPI using a test server (Bun.serve in test mode)
  - Cover: GET /health, GET /state, POST /start, POST /stop, task CRUD, loops CRUD, LLM proxy
  - Acceptance: `bun test __tests__/routes.test.ts` passes
  - Files: `__tests__/routes.test.ts` (new)
  - Scope: Medium (1-2 files)

### Checkpoint: Routes
- [ ] `bun test __tests__/daemon*.test.ts` passes
- [ ] `bun test __tests__/routes.test.ts` passes
- [ ] `bun test` passes (all existing tests)

### Phase 3: Cleanup

- [ ] **Task 3.1**: Trim daemon.ts to orchestration-only (~160 LOC)
  - Remove private methods that moved to routes.ts or task-processor.ts
  - Keep: constructor, start(), stop(), server lifecycle, wiring
  - Acceptance: daemon boots and serves routes correctly
  - Files: `src/daemon.ts`
  - Scope: Small (1 file)

### Checkpoint: Complete
- [ ] All tests pass: `bun test`
- [ ] Manual: start daemon, hit health endpoint, queue a task
- [ ] ADR-0003 implemented as designed
- [ ] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WS broadcast coupling | Med | Extract broadcast into DaemonAPI; routes never touch raw WS clients |
| DaemonAPI grows too large | Med | Keep it minimal — only what routes actually need, not the full Daemon surface |
| Breaking daemon integration tests | High | Run daemon tests after each task; fix immediately |
