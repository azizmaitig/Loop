# agent-loop -- Context

## Terminology

| Term | Definition |
|------|------------|
| agent-loop | Official project name. Bun/TS orchestrator, zero runtime deps. |
| phase | One step in the 4-state machine lifecycle (init/run/verify/done). |
| iteration | Full cycle through all 4 states. |
| run | One `bun run loop.ts start` invocation from the CLI. |
| loop | The orchestrator system itself: state machine + phase executor + persistence + safety. |
| StateMachine | Flat-lookup 4-state, 6-event state machine. |
| PhaseDef | Interface defining one shell command phase: `{ name, command, expectedExitCode, timeoutMs }`. |
| STATE.md | Human-readable YAML frontmatter state file written to `_agent-loop-output/`. |
| state.json | Machine-parseable JSON state file written alongside STATE.md. |
| LoopState | Runtime representation of current state, iteration, phase results, errors. |
| v1 invariant | No LLM, no MCP, no daemon, no YAML parser dep, no SQLite, no plugin system. |
| memory | Collective term for v3's agentmemory integration layer: per-session persistence, lesson extraction, session archiving, health pulse. |
| episodic save | One-time write of a session summary to agentmemory when the loop completes. Per-session (not per-iteration), fire-and-forget, no retry. Distinct from the per-transition filesystem persistence (STATE.md + state.json). |
| lesson | A novel failure pattern extracted after a phase fails. Deduplicated by error content hash. Saved via agentmemory HTTP API. Serves as cross-session memory for future runs. |
| session archive | Markdown file written to `70-Memory/history/{date-path}/{timestamp}-{taskName}.md` on loop completion. Format: YAML frontmatter + free-form markdown body (matching vault convention). Falls back to `_agent-loop-output/session-archive/` when vault path is unavailable. |
| health pulse | Numeric score pushed to agentmemory on loop completion. Computed as `passingPhases / totalPhases` (0.0–1.0). Logged to console transparently so the user sees what factors contributed. |
| memory transport | Raw HTTP (`fetch()` to `localhost:3111`) — NOT an MCP subprocess. Chosen over the existing `mcp.ts` infra because subprocess spawn adds latency and failure surface for a lightweight operation. See ADR-0001. |
| memory hooks | Lifecycle callbacks in `loop.ts` that call agentmemory functions: `onLoopComplete` (episodic save + health pulse + session archive), `onPhaseFailed` (lesson extraction). All fire-and-forget — no await in the critical path, errors swallowed. Guarded by `memory.enabled: false` config flag. |

## Architecture

```
                         CLI args
                            |
                            v
                   +------------------+
                   |  loop.ts         |  entry point, arg parsing, phase resolution
                   |  (main())        |
                   +--------+---------+
                            |
                            v
                   +------------------+
                   |  StateMachine    |  4-state flat lookup
                   |  (state-machine) |  6 events, TRANSITIONS[state][event]
                   +--------+---------+
                            |
              +-------------+-------------+
              |             |             |
              v             v             v
     +-------------+  +----------+  +----------+
     | Phase       |  | State    |  | Safety   |
     | Executor    |  | Persist  |  | Guards   |
     | (loop.ts    |  | (state)  |  | (safety) |
     |  shellCmd)  |  |          |  |          |
     +------+------+  +-----+----+  +-----+----+
            |                |              |
            v                v              v
     Bun.spawn          STATE.md        AbortController
     cmd.exe /c         state.json      maxIterations cap
                                        SIGINT handler
```

## State Machine

4 states, 6 events, flat lookup table in `TRANSITIONS[state][event]`.

### States

```
  +-------+     +-------+     +---------+     +-------+
  | init  | --> |  run  | --> | verify  | --> | done  |
  +-------+     +-------+     +---------+     +-------+
      ^                           |
      +----- LOOP (all pass) -----+
```

### Transition Table

```typescript
// src/state-machine.ts -- ponytail: flat lookup, no OOP pattern
const TRANSITIONS = {
  init:   { RUN: 'run',   ABORT: 'done' },
  run:    { VERIFY: 'verify', ABORT: 'done' },
  verify: { COMPLETE: 'done', LOOP: 'init', FAILED: 'done', ABORT: 'done' },
  done:   {},
};
```

| Current State | Allowed Events | Next States |
|---------------|---------------|-------------|
| init | RUN, ABORT | run, done |
| run | VERIFY, ABORT | verify, done |
| verify | COMPLETE, LOOP, FAILED, ABORT | done, init, done, done |
| done | (none, terminal) | -- |

### API

- `StateMachine(initialState?)` -- constructor, defaults to `init`
- `transition(event)` -- advances state, throws `StateMachineError` on invalid event
- `allowedEvents()` -- returns `string[]` of valid events from current state
- `isTerminal()` -- returns `true` when state is `done`

### 6 Events

| Event | Meaning |
|-------|---------|
| RUN | Start executing phases |
| VERIFY | Check phase results |
| COMPLETE | All phases passed, no more iterations |
| LOOP | All phases passed, more iterations remain |
| FAILED | One or more phases did not pass |
| ABORT | External or safety-triggered early exit |

## Phase Execution

Each phase is defined by `PhaseDef` and dispatched as a shell command.

```typescript
// src/types.ts
interface PhaseDef {
  name: string;            // human-readable label
  command: string;         // shell command to run
  expectedExitCode: number; // success code (typically 0)
  timeoutMs: number;       // per-phase timeout
}
```

Execution flow in `loop.ts`:

1. Bun.spawn with `cmd.exe /c <command>` (Windows native shell)
2. stdout and stderr collected via `Bun.readableStreamToText`
3. Result wrapped in `PhaseResult`
4. PhaseResult written to state via `updatePhaseResult()` (immutable spread)

```typescript
// src/types.ts
interface PhaseResult {
  status: 'pass' | 'fail' | 'error';
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  evidencePath: string;
}
```

The shell executor function `executeShellCommand` in `loop.ts` wraps `Bun.spawn` inside `executeWithTimeout` for cooperative cancellation via AbortSignal.

## State Persistence

Dual-file strategy for every state transition.

### Files

| File | Format | Purpose |
|------|--------|---------|
| `_agent-loop-output/STATE.md` | YAML frontmatter (---\nkey:val\n---) | Human-readable, git-diffable |
| `_agent-loop-output/state.json` | JSON | Machine-parseable, script consumption |

### Write-after-every-transition

State is written at these checkpoints in `loop.ts`:

1. Initial state (before any iteration)
2. After transition to `run`
3. After each phase execution
4. After transition to `verify`
5. After transition to `done` (COMPLETE, FAILED, LOOP reset)
6. Final state at loop exit

Total: approximately 6 writes per full iteration.

### Custom YAML Parser

No `js-yaml` dependency. `src/state.ts` contains a custom `serializeYamlFrontmatter` / `parseYamlFrontmatter` pair (~70 LOC) that handles:

- Simple key:value strings
- Quoted strings (single and double)
- Numbers and booleans
- Complex objects via JSON.parse (`phaseResults`, `errors`)

Reading is fallback chained: try YAML frontmatter first, fall back to plain JSON parse.

### API

```typescript
// src/state.ts
readState(path: string): Promise<LoopState | null>
writeState(path: string, state: LoopState): Promise<void>
createInitialState(config: LoopConfig): LoopState
updatePhaseResult(state: LoopState, phaseName: string, result: PhaseResult): LoopState
```

## Safety Layer

Three independent safety mechanisms, all in `src/safety.ts` except SIGINT which lives in `loop.ts`.

### Per-Phase Timeout

- `executeWithTimeout(fn, timeoutMs, phaseName)` uses `AbortController` + `Promise.race`
- On timeout: controller aborts, `PhaseTimeoutError` thrown
- Timer is `.unref()`d to avoid keeping the process alive
- Phase result captured as `{ status: 'error', stderr: 'Phase <name> timed out after <N>ms' }`

```typescript
// ponytail: AbortController, no custom timeout queue
async function executeWithTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  phaseName: string,
): Promise<T>
```

### Max Iterations Guard

- Hard cap of 20 in `mergeConfig()`: `Math.min(override.maxIterations, 20)`
- `checkMaxIterations(currentIteration, maxIterations)` returns boolean
- When cap reached, `MaxIterationsExceededError` thrown
- Default max iterations is 3

### SIGINT Handler

- Mutable global ref `let sigintState: LoopState | null` updated on every state change
- On SIGINT: sets `currentState = 'done'`, pushes error, writes both state files, exits code 1
- Write is fire-and-forget (`.catch(() => {})` -- no await in sync handler)
- State is always at most 1 phase behind (best-effort crash recovery)

```typescript
// loop.ts -- ponytail: mutable global, add actor model when multi-loop needed
let sigintState: LoopState | null = null;

process.on('SIGINT', () => {
  if (sigintState) {
    sigintState.currentState = 'done';
    sigintState.errors.push('Aborted by user (SIGINT)');
    writeBothStates(sigintState).catch(() => {});
  }
  process.exit(1);
});
```

## CLI Usage

All commands use `bun run loop.ts start` as the entry point.

```bash
# 1. Run the demo task (scan, analyze, report; 1 iteration, 30s per phase)
bun run loop.ts start --task demo

# 2. Run with 2 iterations (loops back after all phases pass)
bun run loop.ts start --task demo --max-iterations 2

# 3. Run only specific phases from the demo task
bun run loop.ts start --task demo --phases scan,report

# 4. Override per-phase timeout to 2 minutes
bun run loop.ts start --task demo --timeout 120000

# 5. Force the loop to hang (for testing SIGINT crash safety)
bun run loop.ts start --task demo --max-iterations 5 --timeout 60000

# 6. Print help
bun run loop.ts start --help
```

State output written to `_agent-loop-output/STATE.md` and `_agent-loop-output/state.json`.

## v1 vs v2

| Dimension | v1 (current) | v2 (planned) |
|-----------|-------------|--------------|
| LLM integration | None | Agent dispatch via MCP |
| MCP servers | None | Configurable MCP tool dispatch |
| Daemon | None | Persistent background process |
| Plugin system | None | Phase-level plugins |
| State persistence | Dual file (STATE.md + state.json) | Same, possibly plus DB |
| Phase execution | Bun.spawn shell commands | Shell + MCP + LLM hybrid |
| Scoring/evaluation | Pass/fail/error exit codes | Semantic evaluation, confidence |
| YAML parser | Custom inline (~70 LOC) | Same or js-yaml |
| Source LOC | ~330 (6 files) | 2000+ |
| Dependencies | 3 devDeps (types, @types/*) | TBD |

## File Listing

```
agent-loop/
  package.json              -- runtime config (3 devDeps)
  src/
    index.ts                -- barrel export (6 lines)
    types.ts                -- core types (StateMachineState, PhaseDef, LoopConfig, PhaseResult, LoopState, LoopResult)
    state-machine.ts        -- 4-state flat lookup (~49 LOC)
    state.ts                -- dual persistence (~147 LOC)
    safety.ts               -- timeout + iteration guard (~73 LOC)
    config.ts               -- default config + CLI arg parsing (~61 LOC)
  loop.ts                   -- CLI entry point, shell executor, SIGINT handler (~318 LOC)
  __tests__/
    state-machine.test.ts   -- transition validation, allowed events, terminal state, invalid transitions
    state.test.ts           -- read/write STATE.md, JSON fallback, createInitialState, updatePhaseResult
    safety.test.ts          -- timeout enforcement, iteration limits
    config.test.ts          -- CLI arg parsing, mergeConfig cap
```
