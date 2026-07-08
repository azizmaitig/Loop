# agent-loop v6 — Daemon + Multi-loop + UI + Maker/Checker

## TL;DR

> **Quick Summary**: Transform agent-loop from a CLI-runnable loop orchestrator into a **persistent daemon** with task queue, multi-loop orchestration (same process, shared state), embedded vanilla SPA dashboard, optional maker/checker phases, and auto-generated loop-engineering conventions.
>
> **Deliverables**:
> - Daemon mode (`agent-loop daemon`) with API + cron + file watch triggers
> - Task queue (sequential FIFO) with `_loop-history/` persistence
> - Multi-loop orchestration (`loops.yaml` + API config, shared global state)
> - Vanilla HTML/JS SPA dashboard (3 pages: live, history, detail)
> - Maker/checker plugin (optional, disabled by default)
> - `agent-loop init` convention scaffold + STATE.md auto-update
> - End-to-end test suite (~50+ new tests)
> - CONTEXT.md + ADR-0003 (daemon architecture)
>
> **Estimated Effort**: Large (4 work streams, ~15 new/modified files)
> **Parallel Execution**: YES — Wave 1 (4 parallel), Wave 2 (2 parallel), Wave 3 (sequential), Wave FINAL (4 parallel)
> **Critical Path**: Types → daemon → task-queue → multi-loop → UI → maker-checker → conventions → integration → docs

---

## Context

### Original Request
Build v6 of agent-loop: operationalize it as a persistent daemon with multi-loop orchestration, embedded UI dashboard, and optional maker/checker phases. Integrate patterns from loop-engineering repo (L1/L2/L3, conventions, maker/checker split).

### Interview Summary (grill-with-docs)

**Key Decisions** (4 axes, user chose by number):

**1. Daemon + Task Queue**
- Tasks arrive via **API REST + cron + file watch** (all three trigger sources)
- Daemon **stays alive** after task completion, waits for next task
- History logged to **SQLite/JSON** format
- Persistence: each task → log file + result in **`_loop-history/`**

**2. Multi-loop Orchestration**
- All child loops share the **same global state** (no isolation)
- Child loops configured via **`loops.yaml`** file AND **API** (POST /loops)
- Daemon can **start, monitor, and stop** child loops
- Same process (no subprocess spawning)

**3. UI Dashboard**
- **Vanilla HTML/JS SPA** served by Bun.serve (0 build step, no framework)
- **3 pages**: live dashboard (WebSocket real-time), task history, task detail
- **Read-write** controls: start/stop/trigger tasks from UI

**4. Maker/Checker + Conventions**
- Maker/checker is an **optional plugin** (disabled by default, toggleable via config)
- Daemon **auto-updates STATE.md** after every run
- `agent-loop init` scaffolds STATE.md / LOOP.md / AGENTS.md (like loop-engineering's loop-init)

**From loop-engineering repo** (absorbed patterns):
- L1/L2/L3 levels (report → fix → autonomous) — phases must respect levels
- STATE.md / LOOP.md / AGENTS.md markdown conventions
- Maker/checker split pattern

### Current State (v5)
- Bun/TS, 4-state machine, 182 tests, ~1500 LOC, 13 src files
- CLI entry: `bun run src/index.ts start`
- Plan-driven: `--plan <path>` flag
- Plugin system: 5 hooks (onPhaseStart, onPhaseEnd, onError, beforeLoop, afterLoop)
- Agentmemory hooks: fire-and-forget HTTP to localhost:3111
- HTTP/WS API: GET /state, POST /start/stop/trigger, WebSocket broadcasts
- Safety: AbortController timeouts, max 20 iterations, SIGINT handler

**Existing ADRs**: 
- `0001-raw-http-agentmemory-transport.md`
- `0002-plan-driven-execution.md`

---

## Work Objectives

### Core Objective
Build agent-loop v6: production-grade daemon with multi-loop orchestration, embedded dashboard, and maker/checker support — operationalizing the loop for 24/7 use.

### Concrete Deliverables

| # | Deliverable | Files |
|---|-------------|-------|
| 1 | Daemon types + shared state | `src/types.ts`, `src/state.ts` |
| 2 | Daemon entry point + lifecycle | `src/daemon.ts`, `loop.ts` |
| 3 | Task queue + history persistence | `src/task-queue.ts`, `src/history.ts` |
| 4 | Multi-loop orchestration + loops.yaml | `src/orchestrator.ts`, `src/loops-config.ts` |
| 5 | File watch + cron triggers | `src/triggers.ts` |
| 6 | SPA dashboard (3 pages) | `src/dashboard/` (or inline in daemon.ts) |
| 7 | Maker/checker plugin | `src/maker-checker-plugin.ts` |
| 8 | Conventions scaffold + STATE.md update | `src/init.ts`, updated `src/state.ts` |
| 9 | Integration tests | `__tests__/daemon.test.ts`, `__tests__/multi-loop.test.ts`, etc. |
| 10 | CONTEXT.md update + ADR-0003 | `CONTEXT.md`, `docs/adr/0003-daemon-architecture.md` |

### Definition of Done
- [ ] `bun test` passes (all existing 182 tests + new v6 tests)
- [ ] `bun loop.ts daemon` starts, accepts tasks via API/cron/watch, completes them
- [ ] `_loop-history/` has task logs after execution
- [ ] `loops.yaml` config loaded at daemon start, children startable/stopable
- [ ] Dashboard at `http://localhost:3000/dashboard` shows live state via WebSocket
- [ ] Maker/checker plugin runs as optional pass-through
- [ ] `agent-loop init` scaffolds STATE.md / LOOP.md / AGENTS.md
- [ ] STATE.md auto-updated after every run

### Must Have
- **Daemon**: `bun loop.ts daemon` starts persistent process with API (port 3000). POST /task queues a task. GET /state returns current state. Daemon stays alive after task completion.
- **Task Queue**: Sequential FIFO. Tasks from API, cron schedule, or file watch (new `.plan.yaml` in watched dir). History persisted to `_loop-history/{task-id}/`.
- **Multi-loop**: `loops.yaml` defines children with name, config, plan path. API can also create/modify/start/stop children. All share `state.json` global state.
- **Triggers**: Cron internal scheduler (defined in config or loops.yaml). File watch via Bun's `fs.watch` for `.plan.yaml` files in a configured directory.
- **Dashboard**: GET /dashboard returns SPA (vanilla HTML inlined or served from `src/dashboard/index.html`). 3 routes: `/` (live), `/history` (list), `/task/:id` (detail). POST controls via fetch.
- **Maker/Checker**: Plugin with `enabled: false` default. `makerPhase` → auto-schedule `checkerPhase`. checker evaluates maker output, can fail/reject.
- **Conventions**: `agent-loop init` creates STATE.md, LOOP.md, AGENTS.md with defaults. Daemon updates STATE.md after each run (status, last-run, active children).
- TDD: every new module has test file. Minimum 50 new tests across all modules.
- No new npm dependencies. Zero runtime deps maintained.

### Must NOT Have (Guardrails)
- No subprocess isolation for child loops (same process, shared state)
- No per-child security sandboxing
- No React or build step for the dashboard (vanilla only)
- No persistent database beyond JSON/SQLite files
- No docker/container packaging
- No distributed multi-machine orchestration
- No breaking changes to existing v5 plugin interface (backward compatible)
- No removal of existing v5 features (CLI `--plan`, agentmemory hooks)
- No changes to src/mcp.ts, src/evaluate.ts, src/safety.ts
- No changes to existing src/index.ts barrel export

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES — 182 existing tests via `bun test`
- **Automated tests**: TDD (write test first, then implement)
- **Framework**: `bun test`
- **TDD targets**: task-queue, orchestrator, triggers, maker-checker plugin, init scaffold, integration tests

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.omo/evidence/agent-loop-v6/task-{N}-{scenario-slug}.{ext}`.

- **Daemon/API**: Use `bun -e` or curl against localhost — start daemon in background, call endpoints, validate JSON response
- **CLI**: Use bash — run `bun loop.ts daemon`, `bun loop.ts init`, validate output and exit code
- **File I/O**: Use bash — read/write `_loop-history/`, `loops.yaml`, STATE.md, verify content
- **WebSocket/UI**: Use `curl` for HTTP, Playwright or chrome-devtools for browser rendering verification
- **Examples**: fixture `.plan.yaml` files, fixture `loops.yaml` files in `src/__tests__/fixtures/`

---

## Execution Strategy

### Waves

```
Wave 1 (Foundation — parallel, 4 tasks):
├── Task 1: Types + config for daemon/multi-loop/triggers
├── Task 2: Daemon entry point + API server skeleton
├── Task 3: Task queue + history persistence
└── Task 4: Triggers (cron + file watch)

Wave 2 (Orchestration — parallel, 2 tasks):
├── Task 5: Multi-loop orchestrator + loops.yaml parser
└── Task 6: Conventions scaffold (init.ts) + STATE.md auto-update

Wave 3 (UI + Plugin — sequential, depends on Wave 1+2):
├── Task 7: Maker/checker plugin
├── Task 8: SPA dashboard (3 pages, vanilla, WebSocket)
└── Task 9: Integration tests + wiring everything together

Wave 4 (Docs — after all implementation):
└── Task 10: CONTEXT.md update + ADR-0003

Wave FINAL (parallel — after ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality + test sanity (unspecified-high)
├── Task F3: Manual QA + edge cases (unspecified-high)
└── Task F4: Scope fidelity check (deep)
       → Present results → Get explicit user okay

Critical Path: Task 1 → Task 5 → Task 8 → Task 9 → Task 10 → F1-F4
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2, 3, 4, 5 | 1 |
| 2 | 1 | 5, 8, 9 | 1 |
| 3 | 1 | 9 | 1 |
| 4 | 1 | 9 | 1 |
| 5 | 1, 2 | 9 | 2 |
| 6 | — | 9 | 2 |
| 7 | 1 | 9 | 3 |
| 8 | 2, 5 | 9 | 3 |
| 9 | 3, 4, 5, 6, 7, 8 | 10 | 3 |
| 10 | 9 | F1-F4 | 4 |

---

## TODOs

- [ ] 1. Types + config for daemon/multi-loop/triggers

  **What to do**:
  - Add to `src/types.ts`:
    - `DaemonConfig { port: number, triggers: TriggerConfig[], historyDir: string, loopsConfigPath?: string, ui: { enabled: boolean } }`
    - `TriggerConfig { type: 'api' | 'cron' | 'watch', name: string, schedule?: string (cron), watchDir?: string, pattern?: string }`
    - `TaskDef { id: string, command: string, timeoutMs?: number, llm?: {...}, source: 'api' | 'cron' | 'watch', createdAt: string, status: 'queued' | 'running' | 'completed' | 'failed' }`
    - `ChildLoopDef { name: string, configPath?: string, planPath?: string, triggers?: TriggerConfig[], enabled: boolean }`
    - `DaemonState { version: string, startedAt: string, running: boolean, taskQueue: TaskDef[], activeChildren: string[], globalState: Record<string, any> }`
  - Add to `src/config.ts`:
    - `DEFAULT_DAEMON_CONFIG: DaemonConfig`
    - `parseDaemonArgs(argv: string[])` — parses `daemon` subcommand, `--port`, `--loops-config`, `--watch-dir`, `--history-dir`
    - `parseLoopsConfig(path: string): ChildLoopDef[]` — reads `loops.yaml`, validates schema
    - `mergeDaemonConfig(...sources)` — layered merge similar to existing mergeConfig
  - Add types for maker/checker:
    - `MakerCheckerConfig { enabled: boolean, makerModel?: string, checkerModel?: string, autoApprove?: boolean, maxCheckerRetries: number }`
  - Write TDD tests for all new types and config parsers
  - Must have: `bun test` passes with new type tests

  **Must NOT do**:
  - Don't change existing PhaseDef, LoopConfig, LoopResult types
  - Don't implement any daemon logic (just types + config parsing)
  - Don't add dependencies

  **Category**: `quick` — type definitions + config parsers, well-scoped

  **Parallelization**: Wave 1, parallel with Tasks 2-4. Blocks everything.

  **Acceptance Criteria**:
  - [ ] All new types exported from `src/types.ts`
  - [ ] `parseDaemonArgs('daemon', '--port', '4000')` returns correct DaemonConfig
  - [ ] `parseLoopsConfig` handles valid, missing, and invalid loops.yaml
  - [ ] TDD tests for all new parsers
  - [ ] `bun test` passes

  **Commit**: NO (groups with Task 9)

- [ ] 2. Daemon entry point + API server skeleton

  **What to do**:
  - Create `src/daemon.ts`:
    - `startDaemon(config: DaemonConfig): Promise<void>` — main entry point
    - Creates `DaemonState`, initializes task queue (empty), sets `running: true`
    - Starts Bun.serve on config.port
    - Loads `loops.yaml` if configured (calls parseLoopsConfig → orchestrator)
    - Registers triggers (calls trigger initializers from Task 4)
    - Blocks indefinitely (daemon stays alive)
    - `stopDaemon()` — gracefully stops triggers, completes current task, shuts down server
  - Create API endpoints (expand `src/api.ts` or new inline routes):
    - `GET /state` → returns `DaemonState` JSON
    - `POST /task` → body: `{ command: string, timeoutMs?: number, llm?: {...} }` → queues task
    - `POST /stop` → graceful daemon stop
    - `GET /health` → `{ status: 'ok', uptime: number, queuedTasks: number, activeChildren: number }`
  - Update `loop.ts` CLI:
    - `bun loop.ts daemon [--port 3000] [--loops-config ./loops.yaml]` → calls startDaemon
    - `bun loop.ts daemon --help` → prints daemon usage
  - Wire existing state machine into daemon: when daemon starts, it doesn't run a loop — it waits. When a task is queued, it runs one loop iteration with that task.
  - Write TDD tests:
    - Daemon starts on config.port
    - GET /health returns 200
    - POST /task queues a task (task appears in /state with status 'queued')
    - POST /stop shuts down gracefully

  **Must NOT do**:
  - Don't implement task execution yet (Task 3 handles queue → history flow)
  - Don't implement multi-loop orchestration (Task 5)
  - Don't implement UI (Task 8)
  - Don't change existing src/index.ts barrel export

  **Category**: `deep` — daemon lifecycle needs understanding of Bun.serve, existing loop infrastructure

  **Parallelization**: Wave 1, parallel with Tasks 1, 3, 4. Depends on Task 1.

  **Acceptance Criteria**:
  - [ ] `bun loop.ts daemon` starts and serves on port 3000
  - [ ] `GET /health` returns JSON with status 'ok'
  - [ ] `POST /task` with valid body returns 201 and task appears in queue
  - [ ] `POST /stop` shuts down within 2s
  - [ ] TDD tests pass

  **Commit**: NO (groups with Task 9)

- [ ] 3. Task queue + history persistence

  **What to do**:
  - Create `src/task-queue.ts`:
    - `TaskQueue` class:
      - `enqueue(task: TaskDef): void` — adds to FIFO queue
      - `dequeue(): TaskDef | null` — gets next task (sets status 'running')
      - `complete(taskId: string, result: PhaseResult): void` — marks completed
      - `fail(taskId: string, error: string): void` — marks failed
      - `peek(): TaskDef[]` — returns queued + running tasks
      - `cancel(taskId: string): boolean` — cancels a queued task (not running)
    - Queue is in-memory, serialized to `DaemonState.taskQueue`
    - Sequential execution: only one task runs at a time
  - Create `src/history.ts`:
    - `TaskHistory { taskId: string, command: string, status: string, startedAt: string, completedAt: string, duration: number, phases: PhaseResult[], source: string }`
    - `saveTaskHistory(baseDir: string, history: TaskHistory): Promise<string>` — writes to `_loop-history/{taskId}/task.json`
    - `readTaskHistory(baseDir: string, taskId: string): Promise<TaskHistory | null>`
    - `listTaskHistory(baseDir: string): Promise<TaskHistorySummary[]>` — lists all tasks with summary fields
    - Format: JSON files. One directory per task with task.json + optional phase logs.
  - Wire to daemon: when daemon has queued tasks, it executes them sequentially:
    - Dequeue → create loop run (using existing state machine) → on complete → save history → update STATE.md → dequeue next
  - Write TDD tests:
    - Queue: enqueue/dequeue/complete/fail lifecycle
    - Queue respects FIFO order
    - Cannot dequeue while running
    - History: save/read/list roundtrip
    - History directory structure correct
    - Integration: daemon queues task → completes → history file exists

  **Must NOT do**:
  - Don't implement parallel execution (v6 stays sequential)
  - Don't add external dependencies for JSON writing
  - Don't implement multi-loop orchestration here (Task 5)
  - Don't change existing state.ts persistence

  **Category**: `unspecified-high` — queue + file I/O with edge cases

  **Parallelization**: Wave 1, parallel with Tasks 1, 2, 4. Depends on Task 1.

  **Acceptance Criteria**:
  - [ ] TaskQueue FIFO: enqueue(A) → enqueue(B) → dequeue = A → complete(A) → dequeue = B
  - [ ] dequeue returns null when queue empty or task running
  - [ ] `saveTaskHistory` creates `_loop-history/{taskId}/task.json` with correct fields
  - [ ] `listTaskHistory` returns all tasks sorted by creation time (newest first)
  - [ ] `readTaskHistory` returns null for nonexistent tasks
  - [ ] TDD tests pass

  **Commit**: NO (groups with Task 9)

- [ ] 4. Triggers (cron + file watch)

  **What to do**:
  - Create `src/triggers.ts`:
    - `CronTrigger`:
      - `register(schedule: string, onTick: () => void): { stop: () => void }`
      - Parses cron expression (simple 5-field: minute hour day month weekday)
      - Sets intervals for next tick
      - Self-corrects: if a tick is missed (daemon busy), skips, doesn't queue duplicate
    - `FileWatchTrigger`:
      - `register(watchDir: string, pattern: string, onFile: (path: string) => void): { stop: () => void }`
      - Uses `fs.watch` on the directory
      - Filters by pattern (e.g., `*.plan.yaml`)
      - Debounce: waits 500ms after file appears before triggering (avoid partial writes)
      - Reads the file, parses it as a plan (reuses `readPlan` from v5), queues tasks
      - Moves processed files to `.processed/` subdirectory
    - `TriggerManager`:
      - `addTrigger(config: TriggerConfig, queueFn: (task: TaskDef) => void): void`
      - `startAll(): void`
      - `stopAll(): void`
      - Maps trigger type to implementation
  - Wire into daemon: Triggers are registered at daemon start. When a trigger fires, it calls `taskQueue.enqueue()`.
  - Periodically: daemon checks taskQueue → executes if not empty → wait if empty
  - Handle cron edge cases:
    - Daemon starts mid-cron-cycle → computes next match from current time
    - Schedule change → deregister old, register new (via API update)
  - Write TDD tests:
    - Cron: schedule fires at expected time (use short intervals like `* * * * *` = every minute, test with mock clock)
    - File watch: file appears in dir → trigger fires (use temp dir + write file)
    - File watch: debounce works (rapid writes → single trigger)
    - TriggerManager: start/stop lifecycle
    - TriggerManager: all types registered correctly

  **Must NOT do**:
  - Don't install cron parsing libraries — implement simple 5-field parser (minute hour day month weekday) — it covers 95% of use cases and keeps zero-dep
  - Don't use `fs.watch` recursive on large directories — config specifies a single directory
  - Don't implement distributed locking or multi-process safety
  - Don't handle Windows-specific file watch edge cases (macOS/Linux focused, forward error on Windows)

  **Category**: `unspecified-high` — cron parsing + fs.watch + debounce logic

  **Parallelization**: Wave 1, parallel with Tasks 1-3. Depends on Task 1.

  **References**:
  - `src/plan-parser.ts:readPlan` — reuse for file watch plan parsing
  - `src/task-queue.ts:TaskQueue` — triggers call enqueue

  **Acceptance Criteria**:
  - [ ] CronTrigger fires callback at correct times (test with mock clock)
  - [ ] FileWatchTrigger fires when new `.plan.yaml` appears in watched dir
  - [ ] FileWatchTrigger debounces multiple rapid writes
  - [ ] TriggerManager.startAll() / stopAll() works
  - [ ] Processed files moved to `.processed/`
  - [ ] TDD tests pass

  **Commit**: NO (groups with Task 9)

- [ ] 5. Multi-loop orchestrator + loops.yaml parser

  **What to do**:
  - Create `src/orchestrator.ts`:
    - `LoopOrchestrator` class:
      - `constructor(globalState: SharedState)` — all children share same state reference
      - `addChild(def: ChildLoopDef): string` — registers a child loop config, returns child ID
      - `removeChild(childId: string): boolean` — deregisters and stops child
      - `startChild(childId: string): Promise<boolean>` — starts a child loop
      - `stopChild(childId: string): Promise<boolean>` — stops a child loop
      - `getChildState(childId: string): ChildLoopState | null` — returns child's current state
      - `listChildren(): ChildLoopSummary[]` — all children with name/id/status
      - `loadFromConfig(path: string): Promise<void>` — reads loops.yaml and adds all children
  - `ChildLoopState { id: string, name: string, status: 'stopped' | 'running' | 'error', lastRun?: string, config: ChildLoopDef }`
  - Child loops execute in the same process, sharing the global state.json
  - Each child has its own task queue? NO — all children share the main daemon task queue. A "child loop" is essentially a named configuration group (its own plan, its own triggers, its state tracked separately).
  - Actually re-reading the user's choice: "All children share same global state" + "parent can start/monitor/stop children". Let me refine:
    - Children share `state.json` (same file)
    - Each child can be started/stopped independently
    - When started, the child registers its plan and triggers with the daemon
    - When stopped, its triggers are deregistered
    - Children are not isolated processes — they are logical groupings within the same daemon
  - Create `src/loops-config.ts` (or reuse from Task 1):
    - `parseLoopsConfig(path: string): ChildLoopDef[]` — reads YAML, validates
    - `loops.yaml` schema: `loops: [{ name: string, planPath?: string, triggers?: TriggerConfig[], enabled: boolean }]`
  - API endpoints (add to daemon.ts routes):
    - `GET /loops` → list all children
    - `GET /loops/:id` → child state
    - `POST /loops/:id/start` → start child
    - `POST /loops/:id/stop` → stop child
    - `POST /loops` → create new child
    - `DELETE /loops/:id` → remove child
  - Write TDD tests:
    - Orchestrator: add/remove/list children
    - Orchestrator: start/stop lifecycle (state transitions)
    - Orchestrator: loadFromConfig parses loops.yaml correctly
    - Orchestrator: child stop while running doesn't crash
    - API endpoints work

  **Must NOT do**:
  - Don't implement process isolation or subprocess spawning
  - Don't implement per-child security/limits
  - Don't change existing state.ts (children share it, don't modify it)
  - Don't add dependencies for YAML (reuse existing custom YAML parser from state.ts/plan-parser.ts)

  **Category**: `deep` — orchestrator needs careful state machine design for child lifecycle

  **Parallelization**: Wave 2, depends on Task 1 and Task 2. Parallel with Task 6.

  **Acceptance Criteria**:
  - [ ] Orchestrator: addChild returns ID, listChildren shows it
  - [ ] Orchestrator: startChild changes status to 'running', stopChild to 'stopped'
  - [ ] Orchestrator: loadFromConfig parses valid loops.yaml and registers all children
  - [ ] API: GET /loops returns array, POST /loops/:id/start returns 200
  - [ ] TDD tests pass

  **Commit**: NO (groups with Task 9)

- [ ] 6. Conventions scaffold + STATE.md auto-update

  **What to do**:
  - Create `src/init.ts`:
    - `initProject(dir: string): Promise<InitResult>` — scaffolds convention files
    - Creates `STATE.md`:
      ```yaml
      ---
      # Loop State — agent-loop
      last_run: never
      active_children: []
      high_priority: []
      watch_items: []
      ---
      ```
    - Creates `LOOP.md`:
      ```yaml
      # Loop Behavior
      level: L1  # L1=report, L2=fix, L3=autonomous
      safety:
        max_fix_attempts: 3
        denylist: [".env", "auth/", "payments/"]
      conventions:
        maker_checker: false
        worktree_isolation: false
      ```
    - Creates `AGENTS.md`:
      ```yaml
      # AGENTS.md — agent-loop conventions
      ## Loop Mode
      - Start in L1 report-only mode
      - Read STATE.md before any triage
      - Update STATE.md after every loop run
      ## Safety
      - Never push or merge without human approval
      - Never edit .env, .env.*, auth/, payments/
      - Max 3 fix attempts per item; escalate after that
      ```
    - `InitResult { created: string[], warnings: string[] }` — reports which files were created, skips existing
  - Update `src/state.ts` to auto-update STATE.md:
    - `updateStateMd(state: LoopState, daemonState?: DaemonState): Promise<void>`
    - Writes YAML frontmatter to STATE.md with: last_run, active_children, high_priority items, watch items
    - Called after every loop iteration completes
    - Does NOT overwrite human edits to the markdown body section (only frontmatter)
  - CLI entry:
    - `bun loop.ts init` — calls initProject(process.cwd())
    - `bun loop.ts init --dir /path/to/project` — calls initProject with custom dir
  - Wire into daemon: after each task completes, `updateStateMd` is called automatically
  - Write TDD tests:
    - init creates all 3 files with correct default content
    - init skips existing files (no overwrite without --force)
    - updateStateMd writes correct YAML frontmatter
    - updateStateMd preserves human-edited markdown body
    - `bun loop.ts init` exits 0 and prints created files

  **Must NOT do**:
  - Don't overwrite existing files without explicit --force flag
  - Don't modify the markdown body of STATE.md (only frontmatter)
  - Don't add dependencies for markdown/YAML (reuse custom parser)
  - Don't implement maker/checker here (Task 7)

  **Category**: `unspecified-high` — file scaffolding + frontmatter update logic

  **Parallelization**: Wave 2, independent of Tasks 1-5. Parallel with Task 5.

  **Acceptance Criteria**:
  - [ ] `bun loop.ts init` creates STATE.md, LOOP.md, AGENTS.md with correct defaults
  - [ ] Running `init` again skips existing files (doesn't overwrite)
  - [ ] `updateStateMd` writes correct YAML frontmatter to STATE.md
  - [ ] Human-added content in STATE.md body is preserved after updateStateMd
  - [ ] Daemon auto-calls updateStateMd after each completed task
  - [ ] TDD tests pass

  **Commit**: NO (groups with Task 9)

- [ ] 7. Maker/checker plugin

  **What to do**:
  - Create `src/maker-checker-plugin.ts`:
    - Export `createMakerCheckerPlugin(config: MakerCheckerConfig): Plugin`
    - Implements Plugin interface (same 5 hooks as v5)
    - **How it works**:
      - `onPhaseStart(phase, state)`:
        - If `phase.type === 'maker'`, this phase is the "maker" step
        - Maker phase runs normally (executes the command/LLM)
      - `onPhaseEnd(phase, result, state)`:
        - If the completed phase was a 'maker' AND result.status === 'success':
          - Auto-schedule a 'checker' phase right after, before the next phase
          - Checker phase is a special phase: `{ name: phase.name + ':checker', command: 'checker:' + phase.name, llm: { model: config.checkerModel, prompt: 'Review the output of the maker phase and determine if it's correct...' } }`
          - If `config.autoApprove` is false, checker phase is marked `requiresHumanReview: true`
        - If the completed phase was a 'checker':
          - Evaluate the checker's judgment
          - If checker says 'failed' AND retries < maxCheckerRetries → re-enqueue the maker phase with incremented retry counter
          - If checker says 'failed' AND retries >= maxCheckerRetries → mark phase as FAILED with 'checker rejected after N retries'
          - If checker says 'passed' → continue normally
    - Config (from `MakerCheckerConfig` type in Task 1):
      - `enabled: boolean` (default false)
      - `makerModel?: string` (default: model from phase config)
      - `checkerModel?: string` (default: same as maker)
      - `autoApprove: boolean` (default false — means human must approve)
      - `maxCheckerRetries: number` (default 2)
    - Must be loaded via config or `--plugins` flag, not auto-loaded
    - Write TDD tests:
      - Plugin loads with enabled=false → no-op hooks
      - Plugin with enabled=true → maker phase completed → checker phase scheduled
      - Checker passes → phase marked completed
      - Checker fails → retry maker up to maxCheckerRetries
      - Checker fails after max retries → phase FAILED
      - autoApprove=true → no human review marker
      - autoApprove=false → phase has requiresHumanReview

  **Must NOT do**:
  - Don't implement actual AI evaluation of checker output — the checker is a phase that executes an LLM prompt and returns a judgment. The content of the judgment is evaluated by the phase result (exit code / status), not by parsing LLM text.
  - Actually let me reconsider — the checker needs to evaluate the maker's *output*. That evaluation requires reading the maker's artifacts and making a judgment.
  - Refined approach: Checker phase receives the maker phase's result (stdout/stderr/files created) as context. The checker LLM prompt includes: "You are reviewing the output of a maker task. Task was: '{maker.command}'. Output was: '{maker.stdout}'. Determine if the output is correct and complete. Reply with PASS or FAIL and a reason."
  - Don't change Plugin interface (reuse existing 5 hooks)
  - Don't implement human approval UI (autoApprove=false just means phase won't auto-continue — it waits)

  **Category**: `unspecified-high` — plugin logic with retry state machine

  **Parallelization**: Wave 3, depends on Task 1 (types). Sequential with Tasks 8-9.

  **References**:
  - `src/plugins.ts:Plugin` — interface to implement
  - `src/opencode-plugin.ts` — existing plugin pattern to follow
  - `src/types.ts:PhaseDef, PhaseResult, LoopState` — types used by hooks

  **Acceptance Criteria**:
  - [ ] `createMakerCheckerPlugin(config)` returns Plugin with correct hooks
  - [ ] enabled=false → hooks are no-ops
  - [ ] enabled=true → onPhaseEnd of maker phase schedules checker phase
  - [ ] Checker passes → flow continues normally
  - [ ] Checker fails → retry maker (up to maxCheckerRetries)
  - [ ] Checker fails after max retries → phase FAILED
  - [ ] autoApprove=false → phase has requiresHumanReview flag
  - [ ] TDD tests pass

  **Commit**: NO (groups with Task 9)

- [ ] 8. SPA dashboard (3 pages)

  **What to do**:
  - Create `src/dashboard/` directory (or inline in daemon.ts for simplicity):
    - `index.html` — single HTML file with embedded `<style>` and `<script>`
    - No build step, no framework, no npm dependencies
  - **Routing**: Client-side hash routing:
    - `#/` — Live dashboard (WebSocket connection to `/ws`)
    - `#/history` — Task history list (fetch GET /api/history)
    - `#/task/:id` — Task detail (fetch GET /api/tasks/:id)
  - **Live dashboard page**:
    - Current daemon state (running/stopped, uptime)
    - Currently running task (if any): name, duration, status
    - Queued tasks (FIFO list)
    - Active child loops list with status
    - Controls: Start/Stop daemon, Trigger task input
    - WebSocket auto-reconnect
    - Auto-refresh every 1s via WS events
  - **History page**:
    - Table of completed tasks: id, command, status, duration, source, timestamp
    - Sortable by date (newest first), filterable by status
    - Click row → navigate to detail page
    - Pagination (20 per page)
  - **Task detail page**:
    - Full task info: command, source, timestamps, duration, status
    - Phase-by-phase breakdown (from history JSON)
    - Log output per phase
    - Re-run button (POST /task with same command)
  - **Serve from daemon**:
    - `GET /dashboard` → serves `index.html` (inline in response or from file)
    - `GET /api/history` → paginated history list
    - `GET /api/tasks/:id` → single task detail
    - WS `/ws` → broadcasts daemon state changes (task queued, started, completed)
    - Static files: served directly from `src/dashboard/` or inlined via Bun.serve
  - **Styling**: Minimal, functional. Dark theme. CSS custom properties. Think terminal dashboard aesthetic.
  - **No JavaScript framework**: Vanilla JS. Use `fetch()` for REST, `new WebSocket()` for real-time. Hash routing with `window.onhashchange`.
  - HTML file can be large (self-contained). Target: under 500 lines (HTML+CSS+JS all in one file).
  - Write test:
    - Start daemon, fetch GET /dashboard → returns 200 with text/html
    - Verify DOM elements: dashboard heading, state display

  **Must NOT do**:
  - Don't add React, Vue, Svelte, or any framework
  - Don't add build step (no vite, webpack, esbuild)
  - Don't add npm dependencies for frontend
  - Don't make the UI a separate server (must be served by daemon's Bun.serve)
  - Don't implement complex state management in JS (keep it simple)

  **Category**: `unspecified-high` — full dashboard with WS, routing, and controls

  **Parallelization**: Wave 3, depends on Task 2 (daemon API) and Task 5 (multi-loop for loop controls). Sequential with Task 7, parallel with Task 9.

  **Acceptance Criteria**:
  - [ ] `GET /dashboard` returns HTML page with all 3 routes
  - [ ] Live dashboard shows daemon state, task queue, active children
  - [ ] History page lists completed tasks from `_loop-history/`
  - [ ] Task detail page shows full phase breakdown with logs
  - [ ] Controls work: start/stop daemon, trigger task
  - [ ] WebSocket connection established and receives state updates
  - [ ] TDD test: GET /dashboard returns 200

  **Commit**: NO (groups with Task 9)

- [ ] 9. Integration tests + wiring

  **What to do**:
  - Wire everything together in `loop.ts` and `src/daemon.ts`:
    - Daemon starts → loads loops.yaml → registers triggers → starts API → begins polling queue
    - Task arrives via API/cron/watch → enqueued → daemon picks it up → runs loop → saves history → updates STATE.md → checks queue again
    - Child loop can be started/stopped via API
    - Maker/checker plugin runs if enabled in config
    - Dashboard accessible at /dashboard
  - Create integration test file `__tests__/v6-integration.test.ts`:
    - **Test 1: Full daemon lifecycle**
      - Start daemon on random port
      - POST /health → 200
      - POST /task with valid body → 201
      - Wait for task to complete (poll /state)
      - Check `_loop-history/` has task logs
      - Check STATE.md updated (frontmatter has last_run)
      - POST /stop → daemon stops
    - **Test 2: Multi-loop via API**
      - Start daemon
      - POST /loops with child config → 201
      - GET /loops → child in list
      - POST /loops/:id/start → child starts
      - POST /loops/:id/stop → child stops
      - DELETE /loops/:id → child removed
    - **Test 3: File watch trigger**
      - Start daemon with watch dir
      - Create `.plan.yaml` in watched dir
      - Wait for daemon to pick it up
      - Verify task completed in history
      - Verify `.plan.yaml` moved to `.processed/`
    - **Test 4: Maker/checker roundtrip**
      - Start daemon with maker-checker enabled
      - POST /task with maker phase
      - Verify both maker + checker phases executed
      - Verify history shows both phases
    - **Test 5: Conventions**
      - Run `bun loop.ts init` in temp dir
      - Verify STATE.md, LOOP.md, AGENTS.md exist
      - Verify they have correct default content
    - **Test 6: Dashboard**
      - Start daemon
      - Fetch GET /dashboard → 200 HTML
      - Fetch GET /api/history → 200 JSON
    - **Test 7: Edge cases**
      - Queue multiple tasks → execute sequentially
      - Cancel queued task → not executed
      - Invalid task body → 400 error
      - Daemon restart → history persists
      - Nonexistent loops.yaml → graceful warning, not crash
  - All tests use:
    - Random ports (avoid port conflicts in CI)
    - Temp directories for history/state
    - Cleanup after each test (stop daemon, remove temp dirs)
    - `beforeAll`/`afterAll` for daemon lifecycle

  **Must NOT do**:
  - Don't test every edge case in integration (unit tests handle that)
  - Don't add external dependencies for testing
  - Don't rely on real agentmemory for tests (mock or disable)
  - Don't require running agentmemory daemon for tests

  **Category**: `deep` — integration requires understanding all v6 components

  **Parallelization**: Wave 3, depends on all Tasks 2-8. Last implementation task.

  **Acceptance Criteria**:
  - [ ] All 7+ integration tests pass
  - [ ] `bun test` passes (all 182 existing + new v6 tests)
  - [ ] Daemon starts/accepts/executes tasks in sequence
  - [ ] Multi-loop API works end-to-end
  - [ ] File watch trigger works end-to-end
  - [ ] Maker/checker executes both phases
  - [ ] Conventions scaffold creates correct files
  - [ ] Dashboard serves at GET /dashboard

  **Commit**: YES
  - Message: `feat(agent-loop): v6 daemon with multi-loop, UI, maker/checker`
  - Files: All new + modified files

- [ ] 10. CONTEXT.md update + ADR-0003

  **What to do**:
  - Update `CONTEXT.md`:
    - Replace v5-only Architecture section with v6 architecture
    - Add domain glossary (from grilling session — daemon, task queue, child loop, maker/checker, etc.)
    - Add daemon state machine diagram
    - Add multi-loop structure diagram
    - Add dashboard (UI) section
    - Add maker/checker plugin section
    - Add conventions section (init + STATE.md auto-update)
    - Move v5 architecture to "v5 (current)" subsection
    - Update module count (13 → ~22 files)
    - Update test count (182 → ~250+)
    - Update Quick Start with v6 commands
    - Add ADR-0003 reference in Key Decisions
  - Create `docs/adr/0003-daemon-architecture.md`:
    - Title: "ADR-0003: Daemon architecture with embedded UI"
    - Status: Accepted
    - Context: Need for persistent operation, multi-loop orchestration, user-facing dashboard
    - Decision:
      1. Same-process execution for child loops (no subprocess) — simplicity over isolation
      2. Shared global state across all children — simplicity over isolation
      3. Vanilla SPA served by Bun.serve — zero build step, zero deps
      4. JSON file history — simple inspection, portable
      5. Custom 5-field cron parser — covers 95% of needs, zero deps
      6. Maker/checker as optional plugin — doesn't affect existing loops
    - Consequences: Children can crash daemon, state coupling, no horizontal scaling
  - Update `package.json`: bump version to `0.6.0`
  - Run `bun test` to confirm no regression

  **Must NOT do**:
  - Don't change any source code (docs-only + version)
  - Don't rewrite CONTEXT.md entirely — incremental, preserving v5 reference
  - Don't add npm dependencies
  - Don't change existing scripts or configs

  **Category**: `quick` — docs edit + ADR + version bump

  **Parallelization**: Wave 4, depends on Task 9 (final implementation). Blocks nothing.

  **Acceptance Criteria**:
  - [ ] CONTEXT.md updated with v6 architecture, glossary, diagrams
  - [ ] v5 moved to "v5 (current)" subsection
  - [ ] `docs/adr/0003-daemon-architecture.md` exists with all sections
  - [ ] `package.json` version is `0.6.0`
  - [ ] `bun test` passes

  **Commit**: YES
  - Message: `docs(agent-loop): v6 daemon architecture docs + ADR-0003`
  - Files: CONTEXT.md, docs/adr/0003-daemon-architecture.md, package.json

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run daemon, call endpoints). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.omo/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality + Test Sanity** — `unspecified-high`
  Run `tsc --noEmit` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Manual QA + Edge Cases** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: daemon crash recovery, task cancellation mid-execution, malformed loops.yaml, dashboard with no history.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Commit | Message | Files |
|--------|---------|-------|
| Final implementation | `feat(agent-loop): v6 daemon with multi-loop, UI, maker/checker` | All new + modified source files |
| Docs | `docs(agent-loop): v6 daemon architecture docs + ADR-0003` | CONTEXT.md, docs/adr/0003-daemon-architecture.md, package.json |

Pre-commit: `bun test` (all existing 182 + new v6 tests pass)

---

## Success Criteria

### Verification Commands
```bash
bun test                                                     # All tests pass (~250+)
bun loop.ts daemon                                           # Daemon starts on :3000
curl http://localhost:3000/health                             # {"status":"ok",...}
curl -X POST http://localhost:3000/task -d '{"command":"echo hi"}'  # Task queued
curl http://localhost:3000/dashboard                          # SPA dashboard HTML
bun loop.ts init                                             # Scaffolds STATE.md etc.
ls _loop-history/                                            # Task history exists
ls loops.yaml                                                 # Multi-loop config
```

### Final Checklist
- [ ] Daemon starts, stays alive, accepts tasks via API/cron/watch
- [ ] Tasks execute sequentially, history persists to `_loop-history/`
- [ ] Multi-loop: `loops.yaml` + API, shared state, start/stop lifecycle
- [ ] Dashboard: 3 pages, real-time WebSocket, start/stop/trigger controls
- [ ] Maker/checker: optional plugin, disabled by default, retry + approve logic
- [ ] Conventions: `agent-loop init` scaffold, STATE.md auto-update
- [ ] All Must Have present
- [ ] All Must NOT Have absent
- [ ] All tests pass
- [ ] 2 commits: `feat(agent-loop): v6...` + `docs(agent-loop): v6...`
