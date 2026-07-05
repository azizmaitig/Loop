# agent-loop — v5 Architecture

Bun/TS loop orchestrator: 4-state machine, plugin phases, MCP execution, agentmemory hooks, HTTP/WS API, plan-driven execution. Zero runtime deps. ~1500 LOC (13 src files), 182 tests (15 test files).

## Architecture

```mermaid
mindmap
  root((agent-loop v5))
    Core Engine
      index.ts
      types.ts
      state-machine.ts
      state.ts
      safety.ts
      config.ts
      plugins.ts
      plan-executor.ts
    Infrastructure
      mcp.ts
      api.ts
    Agentmemory
      agentmemory.ts
      memory-hooks.ts
    Evaluation
      evaluate.ts
```

## Modules by Subsystem

### Core Engine (8 files)
| File | Role |
|------|------|
| index.ts | Barrel export (12 lines) |
| types.ts | Core types: StateMachineState, PhaseDef, LoopConfig, PhaseResult, LoopState, LoopResult, Judgment |
| state-machine.ts | 4-state (init/run/verify/done) × 6-event flat lookup, ~49 LOC |
| state.ts | Dual persistence: STATE.md (YAML frontmatter) + state.json, custom YAML parser, ~147 LOC |
| safety.ts | executeWithTimeout (AbortController), max iterations cap (20), SIGINT handler, ~73 LOC |
| config.ts | DEFAULT_CONFIG, parseLoopArgs, mergeConfig (hard cap 20), ~81 LOC |
| plugins.ts | Plugin interface, HookContext, loadPlugins (dynamic import), executeHooks at 5 lifecycle points, ~116 LOC |
| plan-executor.ts | Custom YAML parser, parsePlanYaml / stringifyPlanYaml, plan-driven loop plugin (beforeLoop / afterLoop), ~98 LOC |

### Infrastructure (2 files)
| File | Role |
|------|------|
| mcp.ts | MCP subprocess execution via JSON-RPC 2.0 over stdin/stdout, ~167 LOC |
| api.ts | Bun.serve HTTP/WS server: GET /state, POST /start/stop/trigger, WebSocket broadcasts, ~103 LOC |

### Agentmemory (2 files)
| File | Role |
|------|------|
| agentmemory.ts | HTTP client to localhost:3111 (fetch), 5 endpoints: save, recall, archive, lesson, pulse, ~183 LOC |
| memory-hooks.ts | Lifecycle callbacks: onLoopComplete, onPhaseFailed, logPhaseContext, ~194 LOC |

### Evaluation (1 file)
| File | Role |
|------|------|
| evaluate.ts | LLM-based semantic evaluation or exit-code fallback, Judgment type with passed/reason/confidence, ~81 LOC |

## Data Flow

1. CLI → config.ts parses args (including `--plan <path>`), merges with DEFAULT_CONFIG
2. plan-executor.ts `beforeLoop` reads `.plan.yaml` → maps tasks to PhaseDef[]
3. index.ts → state-machine.ts drives loop: execute phases → collect results → evaluate → persist → repeat or exit
4. Each phase runs via mcp.ts (MCP subprocess) or evaluate.ts (LLM eval)
5. plan-executor.ts `afterLoop` writes status/duration/completedAt back to `.plan.yaml`
6. state.ts persists after every transition (~6 writes per iteration)
7. plugins.ts hooks into lifecycle — loadPlugins + executeHooks at 5 points
8. memory-hooks.ts fires on completion/failure — fire-and-forget HTTP to agentmemory
9. api.ts serves state over HTTP/WS when daemon mode is active

## State Machine

```
  init ──RUN──> run ──VERIFY──> verify ──COMPLETE──> done
                   ^                  |
                   └──── LOOP ────────┘
```

| State | Events → Next |
|-------|-------------|
| init | RUN → run, ABORT → done |
| run | VERIFY → verify, ABORT → done |
| verify | COMPLETE → done, LOOP → init, FAILED → done, ABORT → done |
| done | (terminal) |

## Key Decisions

- **ADR-0001**: Raw HTTP (fetch to localhost:3111) over MCP subprocess for agentmemory — lower latency, smaller failure surface (`docs/adr/0001-raw-http-agentmemory-transport.md`)
- **Custom YAML parser**: No js-yaml dep. state.ts parses YAML frontmatter + falls back to JSON
- **Fire-and-forget memory ops**: All agentmemory calls are fire-and-forget with 2s timeout, no retry, errors swallowed
- **Ponytail patterns**: Flat lookup state machine (no OOP), AbortController for timeouts, mutable global for SIGINT

## Plan-Driven Execution

The `--plan <path>` CLI flag enables plan-driven mode. When set, the loop loads a `.plan.yaml` file before the first iteration and writes results back after completion.

### Flow

1. `--plan path/to/plan.yaml` parsed by config.ts → `LoopConfig.planPath`
2. `beforeLoop` hook (plan-executor.ts) reads `.plan.yaml` via custom YAML parser, maps tasks to `PhaseDef[]`, and populates the loop's phase queue
3. Loop executes phases normally (state-machine driven)
4. `afterLoop` hook (plan-executor.ts) writes `status`/`duration`/`completedAt` back to `.plan.yaml`
5. Updated plan file serves as a persistent record of execution results

### Implementation

- `plan-executor.ts` contains `parsePlanYaml()` (reads `.plan.yaml` → `PhaseDef[]`) and `stringifyPlanYaml()` (writes `LoopResult` back to YAML)
- Custom YAML parser — no js-yaml dependency, consistent with state.ts approach
- Plugin export: `createPlugin()` returns `{ name: "plan-executor", beforeLoop, afterLoop }` — registered via `plugins` config or auto-loaded when `--plan` is set
- New types in `types.ts`: `PhaseResult` gains `duration` and `completedAt` fields; `LoopConfig` gains optional `planPath`

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| maxIterations | 3 (cap 20) | Loop iterations |
| task | "demo" | Task preset name |
| phases | all | Comma-separated phase filter |
| timeout | 30000 | Per-phase timeout ms |
| memory.enabled | false | Enable agentmemory hooks |
| port | 3000 | API server port |
| plugins | [] | Plugin file paths |
| planPath | undefined | Path to `.plan.yaml` for plan-driven execution |

## Plugin System

5 hook points: `onPhaseStart` / `onPhaseEnd` / `onError` / `beforeLoop` / `afterLoop`. Plugins are dynamically imported modules exporting `createPlugin(): Plugin`. Used by memory-hooks and plan-executor internally; extensible for user plugins.

## Test Strategy

182 tests across 15 test files. Run: `bun test __tests__/`

| Area | Files |
|------|-------|
| State machine | state-machine.test.ts |
| Persistence | state.test.ts |
| Safety | safety.test.ts |
| Config | config.test.ts |
| MCP execution | mcp.test.ts |
| Plugins | plugins.test.ts |
| Plan types | plan-types.test.ts |
| Plan executor | plan-executor.test.ts |
| Loop + plan integration | loop-plan.test.ts |
| Loop integration | loop-integration.test.ts |
| Agentmemory | agentmemory.test.ts |
| Memory hooks | memory-hooks.test.ts |
| API server | api.test.ts |
| Evaluation | evaluate.test.ts |
| Daemon | daemon.test.ts |

## Quick Start

```bash
bun run src/index.ts start --task demo                     # run demo
bun run src/index.ts start --task demo --max-iterations 3   # 3 iterations
bun run src/index.ts start --task demo --phases scan,report # filter phases
bun run src/index.ts start --plan path/to/plan.yaml        # plan-driven execution
bun run src/index.ts start --help                           # all options
```

State output: `_agent-loop-output/STATE.md` + `_agent-loop-output/state.json`.
