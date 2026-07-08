# agent-loop v2 Plan

## TL;DR

> **Quick Summary**: Upgrade agent-loop from a zero-dep shell orchestrator to a hybrid LLM-powered loop with daemon mode, plugin hooks, and semantic evaluation.
>
> **Deliverables**:
> - LLM-as-executor + LLM-as-controller (dual MCP integration)
> - Persistent daemon with HTTP/WebSocket API
> - Plugin system (`.ts` hook convention)
> - Semantic evaluation (LLM judges output contextually)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Core types → LLM dispatch → Daemon → Plugins → Integration

---

## Context

### Design Decisions (from grilling session)

| Question | Decision |
|----------|----------|
| LLM model | **Both**: phase executor (dispatches MCP calls per phase) AND loop controller (LLM decides state transitions) |
| Daemon | **Both**: background process AND HTTP/WS API for state/control |
| Plugin unit | **Both**: simple `.ts` hook convention AND npm packages side-by-side with v1 shell execution |
| Semantic rubric | **LLM-inferred**: no explicit rubric — LLM judges output from phase name/context |

### Sharpened Glossary (for CONTEXT.md)

**Phase Executor (LLM)**:
A phase that dispatches an MCP tool call instead of a shell command. Defined by `{ mcpServer, tool, prompt }` in PhaseDef.

**Loop Controller (LLM)**:
The LLM receives phase results and emits transition events (RUN, VERIFY, COMPLETE, LOOP, FAILED, ABORT). Replaces hardcoded transition rules when enabled.

**Daemon**:
A long-lived agent-loop process that runs iterations on a schedule or trigger, exposing an HTTP/WebSocket API for state querying and control.

**Plugin**:
A file (`.ts` or npm package) exporting `onPhaseStart`, `onPhaseEnd`, `onError` hooks. Loaded from a `plugins/` directory or node_modules.

**Semantic Evaluation**:
Phase results include a `judgment: { passed: boolean, reason: string, confidence: number }` field, produced by LLM from phase context and stdout. Falls back to exit code if no LLM.

---

## Work Objectives

### Core Objective
Upgrade agent-loop v1 (shell-only, sequential, exit-code-gated) to v2 (LLM-augmented, daemonizable, plugin-extensible, semantically-evaluated).

### Concrete Deliverables
- Updated types (PhaseDef gains LLM/plugin/evaluation fields)
- MCP dispatch engine (calls MCP tools from phases)
- LLM controller mode (LLM decides state transitions)
- Daemon mode (background process + HTTP API)
- Plugin loader (file convention + hook execution)
- Semantic evaluator (LLM-based judgment)
- Updated CONTEXT.md

### Must Have
- v1 behavior unchanged when no LLM/daemon/plugins configured
- All v1 tests still pass
- Plugin hooks fire correctly around phases
- Daemon exposes state and can be controlled via API

### Must NOT Have (Guardrails)
- No npm dependencies beyond what v1 already has (keep Bun stdlib)
- No breaking changes to the v1 PhaseDef/LoopConfig interfaces (add optional fields only)
- No YAML parser replacement (keep the custom ~70 LOC parser)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (bun test)
- **Automated tests**: TDD
- **Framework**: bun test

### QA Policy
- **CLI/TUI**: interactive_bash — Run agent-loop commands, validate output
- **API**: Bash (curl) — Send requests, assert status + response fields
- **Library/Module**: Bash (bun/node REPL) — Import, call functions, compare output

---

## Execution Strategy

```
Wave 1 (S1: LLM phase execution — 3 parallel):
├── 1. Update core types (additive)
├── 2. MCP dispatch module
└── 3. Semantic evaluator module

Wave 2 (S2+S3+S4 — 4 parallel):
├─── S2 ─── 4. LLM loop controller
├─── S3 ─── 5. Plugin loader + hook executor
├─── S4 ─── 6. Daemon mode
└─── S4 ─── 7. HTTP/WS API server

Wave 3 (S5: Integration — 3 parallel):
├── 8. Wire all modules into loop.ts
├── 9. CLI flag additions
└── 10. Tests for all new modules

Wave FINAL (4 parallel reviews):
├── F1. Plan compliance audit (oracle)
├── F2. Code quality + v1 regression (unspecified-high)
├── F3. Real QA: daemon + LLM + plugins (unspecified-high)
└── F4. Scope fidelity check (deep)
```

---

## TODOs

### S1: LLM-capable phase execution (MCP dispatch + semantic eval)
*Notion card: [v2] S1*
*No blockers. Start immediately.*

- [x] 1. Update core types

  **What to do**:
  - Add optional fields to `PhaseDef`: `llm?: { mcpServer: string, tool: string, prompt: string }`, `pluginHooks?: string[]`
  - Add `Judgment` type: `{ passed: boolean, reason: string, confidence: number }`
  - Add to `PhaseResult`: `judgment?: Judgment`, `pluginResults?: Record<string, any>`
  - Add to `LoopConfig`: `daemon?: { intervalMs: number, port?: number }`, `llmController?: boolean`, `plugins?: string[]`
  - All new fields optional — v1 code compiles unchanged

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 1, blocks S2-S5

  **QA Scenarios**:
  - TypeScript compiles with v1-only PhaseDef (no new fields)
  - TypeScript compiles with v2 PhaseDef (all fields populated)
  - v1 tests pass without modification

- [x] 2. MCP dispatch module

  **What to do**:
  - Add `src/mcp.ts` — exports `executeMcpPhase(phase: PhaseDef): Promise<PhaseResult>`
  - Bun.spawn an MCP-compatible subprocess or call via stdio JSON-RPC
  - Collect stdout/stderr, wrap in PhaseResult with status/timeout

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 1 (parallel with 1, 3)

  **QA Scenarios**:
  - Call with invalid mcpServer → returns status: 'error' with descriptive message
  - Timeout triggers abort controller → returns status: 'error'
  - Valid call returns PhaseResult with stdout captured

- [x] 3. Semantic evaluator module

  **What to do**:
  - Add `src/evaluate.ts` — exports `evaluatePhase(phase: PhaseDef, result: PhaseResult): Promise<Judgment>`
  - Constructs LLM prompt from phase name + phase description + captured stdout
  - Returns `{ passed, reason, confidence }`
  - Falls back to `{ passed: exitCode === expectedExitCode, reason: 'exit code', confidence: 1.0 }` if no LLM configured

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 1 (parallel with 1, 2)

  **QA Scenarios**:
  - No LLM configured → returns exit-code-based judgment
  - LLM configured → returns structured Judgment object
  - Empty stdout → returns plausible judgment (not crash)

---

### S2: LLM loop controller
*Notion card: [v2] S2*
*Blocked by: S1 (TODO 1). Wave 2.*

- [x] 4. LLM loop controller

  **What to do**:
  - Add optional LLM-based transition in loop.ts
  - When `llmController: true` in config, after phase execution, send phase results to LLM
  - LLM returns which event to fire (RUN, VERIFY, COMPLETE, LOOP, FAILED, ABORT)
  - Fallback to hardcoded TRANSITIONS table if LLM unavailable or returns invalid event
  - Wire into the main loop iteration

  **Recommended Agent Profile**: `deep`
  **Parallelization**: Wave 2 (runs parallel with S3, S4)
  **QA Scenarios**:
  - `llmController: false` → uses hardcoded transitions (v1 behavior)
  - `llmController: true` → LLM decides next state
  - LLM returns invalid event → falls back to hardcoded

---

### S3: Plugin system
*Notion card: [v2] S3*
*Blocked by: S1 (TODO 1). Wave 2.*

- [x] 5. Plugin loader + hook executor

  **What to do**:
  - Add `src/plugins.ts` — exports `loadPlugins(config): Plugin[]` and `executeHooks(hook: string, context)`
  - Scans `plugins/` directory for `.ts` files, dynamic imports them
  - Each plugin exports `onPhaseStart?(phase, state)`, `onPhaseEnd?(phase, result, state)`, `onError?(error, phase)`
  - Hooks collected into pluginResults on PhaseResult

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 2 (runs parallel with S2, S4)
  **QA Scenarios**:
  - Empty `plugins/` directory → no hooks fired, no error
  - Plugin with all 3 hooks → each hook fires at correct lifecycle point
  - Plugin throws in onPhaseStart → error caught, loop continues

---

### S4: Daemon mode + HTTP/WS API
*Notion card: [v2] S4*
*Blocked by: S1 (TODO 1). Wave 2.*

- [x] 6. Daemon mode

  **What to do**:
  - Add daemon entry point: `loop.ts daemon` or `--daemon` flag
  - Runs loop iterations on a configurable interval (daemon.intervalMs)
  - Detaches from terminal (no stdin required)
  - Graceful shutdown on SIGINT/SIGTERM with state snapshot

  **Recommended Agent Profile**: `deep`
  **Parallelization**: Wave 2 (parallel with 7, S2, S3)
  **QA Scenarios**:
  - Start daemon → process stays alive
  - SIGINT → state saved, process exits with code 0
  - Interval-based iteration runs and completes

- [x] 7. HTTP/WS API server

  **What to do**:
  - Add lightweight HTTP server on configurable port (default: 3099)
  - Endpoints: GET /state, POST /start, POST /stop, POST /trigger
  - WebSocket for streaming logs/state changes in real-time
  - Built with Bun.serve (zero deps)

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 2 (parallel with 6, S2, S3)
  **QA Scenarios**:
  - GET /state → returns current LoopState JSON
  - POST /start → starts loop iteration, returns 200
  - WebSocket → receives state change events

---

### S5: Integration wiring + CLI + tests
*Notion card: [v2] S5*
*Blocked by: S1, S2, S3, S4. Wave 3.*

- [x] 8. Wire modules into loop.ts

  **What to do**:
  - Phase execution order: onPhaseStart hooks -> shell/MCP -> collect -> evaluate -> onPhaseEnd
  - Transition decision: LLM controller (if enabled) -> hardcoded fallback

  **Recommended Agent Profile**: `deep`
  **Parallelization**: Wave 3 (blocked by 2-7)
  **QA Scenarios**:
  - Default config (no new flags) -> v1 behavior identical
  - Full v2 config -> all modules fire in correct order

- [x] 9. CLI flag additions

  **What to do**:
  - Add flags: `--daemon`, `--llm`, `--plugins`, `--port`
  - Update config.ts mergeConfig to parse new flags
  - Update --help output

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 3 (blocked by 8)
  **QA Scenarios**:
  - `bun run loop.ts start --help` -> shows new flags
  - Unknown flag -> graceful error, not crash

- [x] 10. Tests

  **What to do**:
  - Add test files for: mcp.test.ts, evaluate.test.ts, plugins.test.ts, daemon.test.ts, api.test.ts
  - Test each module's happy path, error path, and fallback behavior

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 3 (blocked by 2-7)
  **QA Scenarios**:
  - `bun test` -> all v1 + v2 tests pass

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle` — ✅ APPROVE
- [x] F2. **Code Quality + v1 Regression** — `unspecified-high` — ✅ APPROVE
- [x] F3. **Real QA** — daemon + LLM + plugins — `unspecified-high` — ✅ APPROVE
- [x] F4. **Scope Fidelity Check** — `deep` — ✅ APPROVE

---

## Execution

Per `/ask-matt` flow, next step is **`/to-prd`** (turn grilling + plan into a PRD), then **`/to-issues`** to split into grabable issues.

Load `plan-notion-sync` skill when creating the PRD/issues to sync to Notion Launch Operations.
