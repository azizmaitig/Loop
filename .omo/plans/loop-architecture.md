# Agent Loop — Generic Loop Orchestrator

## TL;DR

> **Quick Summary**: Build a generic, minimal loop orchestrator with a simplified 4-state machine (init→run→verify→done + loopback). CLI-invoke-and-exit, synchronous phase execution, shell command dispatch (command + exit code + timeout), file-based state, per-phase safety guards. Not coupled to 88-Labs research states or LLM/model providers.
>
> **Deliverables**:
> - `10-Projects/11-Active/agent-loop/` — project scaffold with Bun + TypeScript
> - Generic 4-state phase runner (init → run → verify → done + loopback)
> - Shell command phase definition (command, expectedExitCode, timeout)
> - CLI entry point (`bun run loop.ts`)
> - STATE.md + per-run output directory
> - Safety layer (per-phase timeout, max iterations)
> - Unit tests (tests-after)
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Scaffold → State Machine → State → Safety → CLI → Integration Demo → Verification

---

## Context

### Original Request
Design a general autonomous agent loop architecture (memory, skills, MCPs, safety, scoring) the correct way. After extensive research of 88-Labs, loop-engineering, AutoR, Sibyl, Arbor, and other loop architectures, the approach was narrowed to extracting the generic kernel from the existing 88-Labs v4.2.0 infrastructure.

### Interview Summary
**Key Discussions**:
- **Relationship to 88-Labs**: This loop is NOT coupled to 88-Labs. It's a standalone generic orchestrator with 4 states (init→run→verify→done), not the 10 research-specific states from 88-Labs. 88-Labs can consume this later if desired.
- **Execution model**: CLI-invoke-and-exit (`bun run loop.ts start <task-def>`). Synchronous phase execution. No daemon, no watch mode.
- **Phase dispatch**: Shell command dispatch in v1. Each phase = a command + expected exit code + timeout. No LLM/model coupling. No MCP tool dispatch. Replaceable with any executor later.
- **Scoring**: Binary phase-level pass/fail in v1. No 0-100 scores, no L0-L3 levels.
- **Config**: TypeScript config object in v1. No YAML/JSON file parser.
- **State**: STATE.md file-based. agentmemory integration deferred to v2.
- **Location**: `10-Projects/11-Active/agent-loop/` (consistent with vault conventions)
- **Test strategy**: Tests-after with `bun test`. No TDD for v1.

**Research Findings**:
- 88-Labs (v4.2.0): 10-state research loop (`idle→context_bridge→search→process→synthesize→report→persist→signal_check→consolidate→done`). Used as a reference for phase-runner patterns but NOT copied. Our generic loop uses 4 states: init→run→verify→done + loopback.
- Loop-engineering (cobusgreyling): dev-ops focused, YAML-driven pattern registry, Loop Readiness Score (0-100). Used for safety concepts only (timeout, max iterations).
- rowan-agent (aiiiirobyte): Bun-native orchestrator with route→plan→execute→verify. Reference for state schema (lastPhase, exitCode, phaseHistory).
- bareagent (hamr0): Zero-dep think→act→observe loop. Reference for "Goal in → actions out" contract.
- helixent (Esinimi): ReAct with typed error handling. Reference for clean error types.
- Decision: v1 phases are **shell commands** (not LLM calls, not MCP tools). Simplest possible contract. Replaceable later.

### Metis Review
**Identified Gaps** (addressed):
- **Q: 88-Labs relationship?** → Resolved: NOT a copy. 4 generic states (init→run→verify→done), not 10 research states from 88-Labs.
- **Q: Execution model?** → Resolved: CLI-invoke-and-exit, synchronous phases
- **Q: Phase dispatch?** → Resolved: shell commands in v1 (command + exit code + timeout). Not MCP tools, not LLM calls.
- **Q: Scoring system?** → Resolved: binary pass/fail. No scores/levels in v1
- **Q: Config format?** → Resolved: TypeScript config object. No YAML parser in v1
- **Q: Location in vault?** → Resolved: `10-Projects/11-Active/agent-loop/`
- **Q: Test strategy?** → Resolved: tests-after with `bun test`
- **Q: agentmemory integration?** → Deferred to v2. Not in scope for v1

---

## Work Objectives

### Core Objective
Build a standalone, minimal TypeScript/Bun loop orchestrator with a 4-state machine (init→run→verify→done), shell command phase execution, file-based state tracking, safety guards, and CLI entry. NOT coupled to 88-Labs research states or LLM providers.

### Concrete Deliverables
- `10-Projects/11-Active/agent-loop/` — project directory with Bun + TypeScript
- `loop.ts` — CLI entry point (reads task config, runs phases, writes state)
- `src/state-machine.ts` — 4-state phase runner (init→run→verify→done + loopback)
- `src/config.ts` — TypeScript config interface + default config (phases as shell commands)
- `src/state.ts` — STATE.md read/write with schemas
- `src/safety.ts` — per-phase timeout + max iterations guard + shell command executor
- `src/types.ts` — all type definitions (PhaseDef = command + expectedExitCode + timeout)
- `STATE.md` — Example state file (generated at runtime)
- Unit tests for each module

### Definition of Done
- [ ] `bun test` passes (unit tests)
- [ ] `bun run loop.ts start --help` prints usage
- [ ] `bun run loop.ts start 'hello'` runs a demo 3-phase loop (shell commands), exits 0, produces `_agent-loop-output/state.json`
- [ ] Safety guard kills a stuck phase after configurable timeout (via AbortController)
- [ ] 100% of state machine states are reachable in tests (init→run→verify→done + loopback)

### Must Have
- Sequential phase execution with 4-state machine: init → run → verify → done + loopback
- Shell command phase definition: each phase = command string + expectedExitCode + timeoutMs
- Per-phase timeout (configurable per phase, default 60s, via AbortController)
- Max iterations guard (default 10, hard cap 20)
- STATE.md file-based persistence (human-readable YAML frontmatter, git-friendly)
- Exit code 0 on success, non-zero on failure
- Every module has `bun test` unit tests

### Must NOT Have (Guardrails)
- **No scoring system** — no 0-100 scores, no L0-L3 levels. Binary pass/fail only
- **No YAML/JSON config parser** — TypeScript config objects only
- **No daemon / watch mode** — CLI-invoke-and-exit only
- **No agentmemory integration** — deferred to v2
- **No human gates** — deferred to v2
- **No sub-agent spawning** — shell command dispatch only. No LLM/model calls, no MCP tool dispatch
- **No LLM/model coupling** — v1 phases are raw shell commands. No OpenAI calls, no model inference
- **No plugin system** — deferred until 3+ phase types exist
- **No web dashboard** — CLI output only
- **No SQLite/DB** — STATE.md + JSON files only
- **No dependency on 88-Labs** — this is a standalone extraction, not a shared module

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (bun test, vitest in other projects)
- **Automated tests**: Tests-after
- **Framework**: `bun test` (built-in, no vitest dependency needed)
- **Coverage target**: Every module has tests. State machine has 100% state/transition coverage.

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use Bash (bun) — Import, instantiate, call functions, assert output
- **CLI**: Use Bash — Run `bun run loop.ts` with args, validate exit code + output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — all independent):
├── Task 1: Project scaffold + tsconfig + bun init [quick]
├── Task 2: Types — all shared types and interfaces [quick]
├── Task 3: Config — default config + config interface [quick]

Wave 2 (After Wave 1 — core modules, MAX PARALLEL):
├── Task 4: State machine — 4-state phase runner (depends: 2, 3) [quick]
├── Task 5: State — STATE.md reader/writer (depends: 2) [quick]
├── Task 6: Safety — timeout + max iterations guard (depends: 2) [quick]

Wave 3 (After Wave 2 — integration + tests):
├── Task 7: CLI — loop.ts entry point (depends: 4, 5, 6) [quick]
├── Task 8: Tests — unit tests for all modules (depends: 4, 5, 6, 7) [quick]
├── Task 9: Integration demo — run the full loop end-to-end [quick]

Wave FINAL (After ALL):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA — execute every scenario (unspecified-high)
└── Task F4: Scope fidelity check (deep)
→ Present results → Get explicit user okay

Critical Path: Task 1 → Task 4 → Task 7 → Task 8 → Task F1-F4 → user okay
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 3
```

### Dependency Matrix

- **1-3**: - - 4-6, 1
- **4**: 2, 3 - 7, 2
- **5**: 2 - 7, 2
- **6**: 2 - 7, 2
- **7**: 4, 5, 6 - 8, 9, 3
- **8**: 4, 5, 6, 7 - F1-F4, 4
- **9**: 7 - F1-F4, 4

### Agent Dispatch Summary

- **1**: **3** — T1 → `quick`, T2 → `quick`, T3 → `quick`
- **2**: **3** — T4 → `quick`, T5 → `quick`, T6 → `quick`
- **3**: **3** — T7 → `quick`, T8 → `quick`, T9 → `quick`
- **FINAL**: **4** — F1 → `oracle`, F2 → `unspecified-high`, F3 → `unspecified-high`, F4 → `deep`

---

## TODOs

- [x] 1. Project Scaffold — `10-Projects/11-Active/agent-loop/`

  **What to do**:
  - Create `10-Projects/11-Active/agent-loop/` directory
  - `bun init` with TypeScript
  - Set up: `tsconfig.json` (strict), `package.json` (name: `agent-loop`, type: `module`)
  - Create directory structure: `src/`, `__tests__/`
  - Add `.gitignore` (node_modules, dist, _agent-loop-output/)
  - Add `bun test` script to `package.json`

  **Must NOT do**:
  - No dependencies beyond Bun stdlib and TypeScript types
  - No vitest/jest — use `bun test` built-in

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `docker-patterns`: No container needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6, 7, 8
  - **Blocked By**: None (can start immediately)

  **References**:
  - `88-Labs/package.json` — Reference for Bun project structure (use `type: "module"`)
  - `88-Labs/config.md` — State machine design patterns to extract
  - `88-Labs/INDEX.md` — Phase architecture reference

  **Acceptance Criteria**:
  - [ ] `ls 10-Projects/11-Active/agent-loop/src/` exists
  - [ ] `ls 10-Projects/11-Active/agent-loop/__tests__/` exists
  - [ ] `bun test` runs successfully (zero tests = pass)

  **QA Scenarios**:
  ```
  Scenario: Project scaffold works
    Tool: Bash
    Preconditions: None
    Steps:
      1. ls "10-Projects/11-Active/agent-loop/src/"
      2. ls "10-Projects/11-Active/agent-loop/__tests__/"
      3. cd "10-Projects/11-Active/agent-loop" && bun test
    Expected Result: Directory exists, bun test passes (0 tests)
    Evidence: .omo/evidence/task-1-scaffold.txt
  ```

  **Commit**: YES
  - Message: `feat(agent-loop): scaffold project structure`
  - Files: `10-Projects/11-Active/agent-loop/**`

- [x] 2. Types — All shared types and interfaces

  **What to do**:
  - Create `src/types.ts` with:
    - `LoopConfig` — `{ taskName: string, phases: PhaseDef[], maxIterations: number, phaseTimeoutMs: number }`
    - `PhaseDef` — shell command contract: `{ name: string, command: string, expectedExitCode: number, timeoutMs: number }`
    - `LoopState` — `{ currentState: StateMachineState, iteration: number, phaseResults: Record<string, PhaseResult>, startTime: string, errors: string[] }`
    - `StateMachineState` — 4 generic states: `'init' | 'run' | 'verify' | 'done'`
    - `PhaseResult` — `{ status: 'pass' | 'fail' | 'error', exitCode: number, stdout: string, stderr: string, durationMs: number, evidencePath: string }`
    - `LoopResult` — `{ finalState: StateMachineState, iterationsCompleted: number, allPhasesPassed: boolean, totalDurationMs: number }`
  - Export all types from `src/index.ts`

  **Must NOT do**:
  - No Zod schemas in v1 — plain TypeScript interfaces only
  - No enum classes — union types are sufficient
  - No research-specific types (no search/synthesize/report entities)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `api-and-interface-design`: Overkill for simple type definitions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Tasks 4, 5, 6, 7, 8
  - **Blocked By**: None (can start immediately)

  **References**:
  - `rowan-agent` state schema pattern — `lastPhase`, `exitCode`, `phaseHistory` as reference for LoopState structure

  **Acceptance Criteria**:
  - [ ] `src/types.ts` exists with all 6 type declarations
  - [ ] `PhaseDef.command` is a `string` (shell command), `PhaseDef.expectedExitCode` is a `number`
  - [ ] TypeScript compiles: `bun run tsc --noEmit` passes

  **QA Scenarios**:
  ```
  Scenario: Types compile cleanly
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun run tsc --noEmit src/types.ts
    Expected Result: Exit code 0, no type errors
    Evidence: .omo/evidence/task-2-types-compile.txt

  Scenario: PhaseDef uses shell command contract
    Tool: Bash
    Preconditions: Task 1 + 2 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "import { PhaseDef } from './src/types'; const p: PhaseDef = { name: 'test', command: 'echo hello', expectedExitCode: 0, timeoutMs: 5000 }; console.log('ok');"
    Expected Result: "ok" printed, no type errors
    Evidence: .omo/evidence/task-2-shell-contract.txt
  ```

  **Commit**: YES (group with Task 1)
  - Message: `feat(agent-loop): add types`

- [x] 3. Config — Default config object + CLI argument parser

  **What to do**:
  - Create `src/config.ts` with:
    - `DEFAULT_CONFIG` — reasonable defaults (3 max iterations, 60s phase timeout, 20 max iterations hard cap)
    - `parseLoopArgs(args: string[])` — parses CLI arguments into a partial LoopConfig
    - `mergeConfig(base: LoopConfig, override: Partial<LoopConfig>)` — merges user overrides
  - Use Bun's `parseArgs` or minimal manual parsing (no yargs/commander dependency)
  - Export from `src/index.ts`

  **Must NOT do**:
  - No YAML/JSON file parser — config is purely programmatic
  - No external CLI library

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 4, 7
  - **Blocked By**: Task 2 (types)

  **References**:
  - `88-Labs/config.md:9-17` — Iteration parameters pattern (defaults, max, descriptions)

  **Acceptance Criteria**:
  - [ ] `src/config.ts` exists with DEFAULT_CONFIG, parseLoopArgs, mergeConfig
  - [ ] `bun run tsc --noEmit` passes
  - [ ] Hard cap of 20 max iterations cannot be overridden

  **QA Scenarios**:
  ```
  Scenario: Default config is valid
    Tool: Bash
    Preconditions: Tasks 1 + 2 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "import { DEFAULT_CONFIG } from './src/config'; console.log(JSON.stringify(DEFAULT_CONFIG));"
    Expected Result: JSON printed with default values (maxIterations: 3, phaseTimeoutMs: 60000)
    Evidence: .omo/evidence/task-3-default-config.txt

  Scenario: Hard cap enforced
    Tool: Bash
    Preconditions: Tasks 1 + 2 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "import { mergeConfig, DEFAULT_CONFIG } from './src/config'; const merged = mergeConfig(DEFAULT_CONFIG, { maxIterations: 100 }); console.log(merged.maxIterations);"
    Expected Result: 20 (hard cap, not 100)
    Evidence: .omo/evidence/task-3-hardcap.txt
  ```

  **Commit**: YES (group with Task 1)
  - Message: `feat(agent-loop): add config`

- [x] 4. State Machine — 4-state phase runner

  **What to do**:
  - Create `src/state-machine.ts` with:
    - 4 generic states: `init → run → verify → done` with loopback `verify → init` (for next iteration)
    - `StateMachine` class with:
      - `currentState: StateMachineState`
      - `transition(event: string): StateMachineState` — transitions based on event
      - `allowedEvents(): string[]` — returns valid events for current state
      - `isTerminal(): boolean` — returns true for `done` state
    - Transition matrix:
      - `init` → `RUN` → `run`
      - `run` → `VERIFY` → `verify`
      - `verify` → `COMPLETE` → `done` (all phases passed, loop complete)
      - `verify` → `LOOP` → `init` (more iterations needed)
      - `verify` → `FAILED` → `done` (max iterations reached or fatal error)
      - `any` → `ABORT` → `done` (SIGINT/manual stop)
    - Error transitions: any state → `done` on `ABORT` event, verify → `done` on `FAILED`

  **Must NOT do**:
  - No XState or external state machine library
  - No 88-Labs research-specific states (search/process/synthesize/etc.)
  - No generative AI — hand-write the transition matrix (~8 transitions)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential within Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `bareagent` pattern — "Goal in → actions out" minimal state model
  - `88-Labs/config.md:214-256` — Transition matrix PATTERN only (not states). Use the guard/error pattern, not the research-specific states.

  **Acceptance Criteria**:
  - [ ] 4 states defined as union type: `'init' | 'run' | 'verify' | 'done'`
  - [ ] All primary transitions work: init→run→verify→done
  - [ ] Loopback transition works: verify→init (on `LOOP` event)
  - [ ] Abort transition works: any state→done (on `ABORT` event)
  - [ ] Failure transition: verify→done (on `FAILED` event)
  - [ ] Terminal detection: `isTerminal()` returns true only for `done`
  - [ ] Invalid transitions throw `StateMachineError`

  **QA Scenarios**:
  ```
  Scenario: Full happy path (single iteration)
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { StateMachine } from './src/state-machine';
        const sm = new StateMachine();
        console.log(sm.currentState, '--RUN-->', sm.transition('RUN'));
        console.log(sm.currentState, '--VERIFY-->', sm.transition('VERIFY'));
        console.log(sm.currentState, '--COMPLETE-->', sm.transition('COMPLETE'));
        console.log('terminal:', sm.isTerminal());
      "
    Expected Result: "init --RUN--> run", "run --VERIFY--> verify", "verify --COMPLETE--> done", "terminal: true"
    Evidence: .omo/evidence/task-4-happy-path.txt

  Scenario: Loopback (multi-iteration)
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { StateMachine } from './src/state-machine';
        const sm = new StateMachine();
        sm.transition('RUN'); sm.transition('VERIFY');
        console.log('before loopback:', sm.currentState);
        console.log('after loopback:', sm.transition('LOOP'));
      "
    Expected Result: "before loopback: verify", "after loopback: init"
    Evidence: .omo/evidence/task-4-loopback.txt

  Scenario: Abort from any state
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { StateMachine } from './src/state-machine';
        const sm = new StateMachine();
        sm.transition('RUN');
        console.log('abort from run:', sm.transition('ABORT'));
        console.log('terminal:', sm.isTerminal());
      "
    Expected Result: "abort from run: done", "terminal: true"
    Evidence: .omo/evidence/task-4-abort.txt

  Scenario: Invalid transition throws
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { StateMachine } from './src/state-machine';
        const sm = new StateMachine();
        try { sm.transition('COMPLETE'); } catch(e) { console.log('caught:', e.message); }
      "
    Expected Result: "caught: Cannot transition from init with event COMPLETE"
    Evidence: .omo/evidence/task-4-invalid.txt
  ```

  **Commit**: YES (group with Task 5, 6)
  - Message: `feat(agent-loop): add state machine, state, safety modules`

- [x] 5. State — STATE.md reader/writer

  **What to do**:
  - Create `src/state.ts` with:
    - `readState(path: string): Promise<LoopState | null>` — reads STATE.md (YAML frontmatter or JSON)
    - `writeState(path: string, state: LoopState): Promise<void>` — writes STATE.md with YAML frontmatter
    - `createInitialState(config: LoopConfig): LoopState` — creates initial state from config
    - `updatePhaseResult(state: LoopState, phaseName: string, result: PhaseResult): LoopState` — immutable update
  - Format: YAML frontmatter `---` block in STATE.md (human-readable in git)
  - Version field in state for future migration support

  **Must NOT do**:
  - No database — file-based only
  - No agentmemory integration in v1

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4, 6 within Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 2

  **References**:
  - `70-Memory/context/working-memory.md` — Existing STATE.md YAML frontmatter pattern in this vault

  **Acceptance Criteria**:
  - [ ] `readState` returns `null` for non-existent file
  - [ ] `readState` correctly reads back a state written by `writeState`
  - [ ] `createInitialState` produces valid state with all fields
  - [ ] `updatePhaseResult` returns a new object (immutable — original unchanged)
  - [ ] Written STATE.md is valid YAML frontmatter

  **QA Scenarios**:
  ```
  Scenario: Round-trip state write then read
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { writeState, readState, createInitialState } from './src/state';
        import { DEFAULT_CONFIG } from './src/config';
        const state = createInitialState(DEFAULT_CONFIG);
        await writeState('_test-state.md', state);
        const loaded = await readState('_test-state.md');
        console.log('currentPhase:', loaded?.currentPhase);
        console.log('match:', loaded?.currentPhase === state.currentPhase);
      "
    Expected Result: "currentPhase: init", "match: true"
    Evidence: .omo/evidence/task-5-roundtrip.txt

  Scenario: Read non-existent file
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { readState } from './src/state';
        const result = await readState('_nonexistent-state.md');
        console.log('result:', result);
      "
    Expected Result: "result: null"
    Evidence: .omo/evidence/task-5-null.txt

  Scenario: Immutable update
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { createInitialState, updatePhaseResult } from './src/state';
        import { DEFAULT_CONFIG } from './src/config';
        const s1 = createInitialState(DEFAULT_CONFIG);
        const s2 = updatePhaseResult(s1, 'scan', { status: 'pass', exitCode: 0, stdout: 'ok', stderr: '', durationMs: 100, evidencePath: '' });
        console.log('same ref:', s1 === s2);
        console.log('s1 phases:', Object.keys(s1.phaseResults).length);
        console.log('s2 phases:', Object.keys(s2.phaseResults).length);
      "
    Expected Result: "same ref: false", "s1 phases: 0", "s2 phases: 1"
    Evidence: .omo/evidence/task-5-immutable.txt
  ```

  **Commit**: YES (group with Task 4, 6)
  - Message: `feat(agent-loop): add state.md persistence`

- [x] 6. Safety — per-phase timeout + max iterations guard

  **What to do**:
  - Create `src/safety.ts` with:
    - `executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number, phaseName: string): Promise<T>` — wraps a phase execution with timeout. Rejects if timeout exceeded.
    - `checkMaxIterations(currentIteration: number, maxIterations: number): boolean` — returns false if max reached
    - `SafetyConfig` — timeout per phase, max iterations, hard cap
  - Timeout uses `AbortController` + `setTimeout`
  - Hard cap: 20 max iterations (cannot be overridden, enforced at config merge level)
  - Export from `src/index.ts`

  **Must NOT do**:
  - No circuit breaker (deferred to v2)
  - No kill switch file sentinel (deferred to v2)
  - No token budgets (deferred to v2)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 4, 5 within Wave 2)
  - **Parallel Group**: Wave 2 (with Tasks 4, 5)
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Task 2

  **References**:
  - `helixent` typed error handling pattern — `PhaseTimeoutError`, `MaxIterationsExceededError` as reference for structured error types

  **Acceptance Criteria**:
  - [ ] `executeWithTimeout` resolves normally for fast functions
  - [ ] `executeWithTimeout` rejects for functions that exceed timeout
  - [ ] `checkMaxIterations` returns false when iteration >= max
  - [ ] `checkMaxIterations` returns true when iteration < max
  - [ ] Hard cap of 20 enforced at config level (config.ts already does this)

  **QA Scenarios**:
  ```
  Scenario: Phase completes within timeout
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { executeWithTimeout } from './src/safety';
        const result = await executeWithTimeout(async () => 'done', 5000, 'test-phase');
        console.log('result:', result);
      "
    Expected Result: "result: done"
    Evidence: .omo/evidence/task-6-fast.txt

  Scenario: Phase exceeds timeout
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { executeWithTimeout } from './src/safety';
        try {
          await executeWithTimeout(async () => { await new Promise(r => setTimeout(r, 20000)); return 'slow'; }, 500, 'slow-phase');
        } catch(e) { console.log('caught:', e.message); }
      "
    Expected Result: "caught: Phase 'slow-phase' timed out after 500ms"
    Evidence: .omo/evidence/task-6-timeout.txt

  Scenario: Max iterations guard
    Tool: Bash
    Preconditions: Tasks 1-3 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun -e "
        import { checkMaxIterations } from './src/safety';
        console.log('iter 2 of 3:', checkMaxIterations(2, 3));
        console.log('iter 3 of 3:', checkMaxIterations(3, 3));
        console.log('iter 4 of 3:', checkMaxIterations(4, 3));
      "
    Expected Result: "iter 2 of 3: true", "iter 3 of 3: false", "iter 4 of 3: false"
    Evidence: .omo/evidence/task-6-maxiter.txt
  ```

  **Commit**: YES (group with Task 4, 5)
  - Message: `feat(agent-loop): add safety guards`

- [x] 7. CLI — `loop.ts` entry point

  **What to do**:
  - Create `loop.ts` at project root as entry point with:
    - `bun run loop.ts start --phases <phase1,phase2,...>` — run phases by name from config
    - `bun run loop.ts start --task <taskDef>` — run a built-in demo task
    - `bun run loop.ts start --help` — print usage
    - Integration wiring: uses StateMachine for transitions, State for persistence, Safety for guards
    - Shell command executor utility: `executeShellCommand(command: string, timeoutMs: number): Promise<PhaseResult>` — spawns a child process via `Bun.spawn()` or `child_process.execFile()`, captures stdout/stderr, enforces timeout via AbortController
    - Loop execution flow:
      1. Parse args, resolve phase config (build PhaseDef[] from --phases or inline config)
      2. Initialize state machine → transition to `init`
      3. Write initial STATE.md
      4. For each iteration (up to maxIterations):
         a. Transition to `run`
         b. For each phase in order:
            - Execute shell command via `executeShellCommand()` (wrapped in Safety timeout)
            - Record PhaseResult (capture exitCode, stdout, stderr, duration)
            - Write updated STATE.md
         c. Transition to `verify`
         d. If all phases passed AND iteration < maxIterations → loopback (`LOOP`)
         e. If all phases passed AND iteration >= maxIterations → complete (`COMPLETE`)
         f. If any phase failed → abort (`FAILED`)
      5. Exit with code 0 (COMPLETE/done) or non-zero (FAILED/ABORT)
    - `_agent-loop-output/` directory for runtime artifacts
    - SIGINT handler: transitions to `ABORT`, writes current state, exits 1

  **Must NOT do**:
  - No daemon mode — single invocation per task
  - No watch mode
  - No LLM/model calls in v1 — pure shell command dispatch
  - No MCP tool calls — shell commands only

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential within Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 8, 9)
  - **Blocks**: Tasks 8, 9, F1-F4
  - **Blocked By**: Tasks 4, 5, 6

  **References**:
  - `Bun.spawn()` docs — Use Bun's built-in spawn for child process execution (no `node:child_process` needed)
  - `bareagent` pattern: "Goal in → actions out" — the loop receives task → executes commands → produces result

  **Acceptance Criteria**:
  - [ ] `bun run loop.ts start --help` prints usage with all flags
  - [ ] `bun run loop.ts start --task 'demo'` runs a demo 3-phase loop (all shell commands) and exits 0
  - [ ] `_agent-loop-output/state.json` exists after a run
  - [ ] `_agent-loop-output/state.json` shows all phases completed with exit codes + stdout
  - [ ] SIGINT (Ctrl+C) gracefully writes partial state with currentState "done" (ABORT transition)

  **QA Scenarios**:
  ```
  Scenario: CLI help prints usage
    Tool: Bash
    Preconditions: Tasks 4, 5, 6 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun run loop.ts start --help
    Expected Result: Prints usage instructions, exit code 0
    Evidence: .omo/evidence/task-7-help.txt

  Scenario: Demo loop runs 3 shell commands successfully
    Tool: Bash
    Preconditions: Tasks 4, 5, 6 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun run loop.ts start --task 'demo'
      3. code=$?; echo "exit: $code"
      4. cat _agent-loop-output/state.json
    Expected Result: Exit code 0, state.json shows currentState "done", 3 phases with exitCode=0, stdout captured
    Evidence: .omo/evidence/task-7-demo-run.txt

  Scenario: Phase failure exits non-zero
    Tool: Bash
    Preconditions: Tasks 4, 5, 6 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun run loop.ts start --phases 'failing-phase'
      3. code=$?; echo "exit: $code"
    Expected Result: Exit code non-zero (phase command fails → loop FAILED → exit 1)
    Evidence: .omo/evidence/task-7-failure.txt
  ```

  **Commit**: YES
  - Message: `feat(agent-loop): add CLI entry point`

- [x] 8. Tests — Unit tests for all modules

  **What to do**:
  - Create `__tests__/state-machine.test.ts` — tests for all 6 transitions, error paths, terminal detection, loopback
  - Create `__tests__/state.test.ts` — tests for read/write roundtrip, immutable updates, null read
  - Create `__tests__/safety.test.ts` — tests for timeout, max iterations, hard cap
  - Create `__tests__/config.test.ts` — tests for defaults, hard cap enforcement, merge logic
  - All tests use `bun test` (no vitest/jest)
  - Coverage target: every module has tests. State machine has 100% state/transition coverage.

  **Must NOT do**:
  - No integration tests in this task (those are in Task 9)
  - No vitest/jest dependency — use bun's built-in test runner

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential within Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 7, 9)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 4, 5, 6, 7

  **References**:
  - Existing vault test patterns: `00-System/Tools/loop-evaluator.ps1` — evaluation pattern for structured JSON testing
  - `src/state-machine.ts` — The 6 transitions defined in Task 4 (RUN, VERIFY, COMPLETE, LOOP, FAILED, ABORT)
  - `src/types.ts` — PhaseResult interface with exitCode/stdout/stderr fields for test assertions

  **Acceptance Criteria**:
  - [ ] `bun test __tests__/state-machine.test.ts` passes (all transitions)
  - [ ] `bun test __tests__/state.test.ts` passes (read/write/immutability)
  - [ ] `bun test __tests__/safety.test.ts` passes (timeout/maxiter)
  - [ ] `bun test __tests__/config.test.ts` passes (defaults/merge)
  - [ ] `bun test` passes (all tests)

  **QA Scenarios**:
  ```
  Scenario: All unit tests pass
    Tool: Bash
    Preconditions: Tasks 4, 5, 6, 7 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun test
    Expected Result: All test suites pass, 0 failures
    Evidence: .omo/evidence/task-8-all-tests.txt

  Scenario: State machine has full transition coverage
    Tool: Bash
    Preconditions: Tasks 4, 5, 6, 7 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun test __tests__/state-machine.test.ts 2>&1 | tail -5
    Expected Result: Shows all transition tests passing
    Evidence: .omo/evidence/task-8-state-machine-tests.txt
  ```

  **Commit**: YES (group with Task 7)
  - Message: `test(agent-loop): add unit tests`

- [x] 9. Integration Demo — End-to-end holistic verification of the loop orchestrator running a complete life cycle

  **What to do**:
  - The entire loop runs through a complete lifecycle: init → run → verify → done (with shell commands)
  - Create a demo config with 3 shell command phases:
    - `scan`: `echo "scanning..."` (exit 0)
    - `analyze`: `echo "analyzed: 42 items"` (exit 0)
    - `report`: `echo "report generated"` (exit 0)
  - The demo verifies:
    1. State machine transitions: init→run→verify→done
    2. Each shell command executes, exit code 0, stdout captured
    3. STATE.md is written and readable at each checkpoint
    4. Safety timeout wraps each phase
    5. CLI exits with code 0 after reaching `done`
    6. Output directory contains complete state.json with phase results
    7. Multi-iteration loopback: config with 2 iterations, verify LOOP transition works

  **Must NOT do**:
  - No real LLM/model calls
  - No MCP tool calls — shell commands only

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential within Wave 3)
  - **Parallel Group**: Wave 3 (with Tasks 7, 8)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 7

  **References**:
  - `src/state-machine.ts` — 4-state machine for the demo to exercise (init→run→verify→done + loopback)
  - `src/cli.ts` or `loop.ts` — CLI entry point that the demo invokes

  **Acceptance Criteria**:
  - [ ] `bun run loop.ts start --task 'demo'` exits 0
  - [ ] `_agent-loop-output/state.json` shows `currentState: "done"`
  - [ ] All 3 shell commands executed (phaseResults has 3 entries, all exitCode=0)
  - [ ] stdout captured for each phase (e.g., "scanning...", "analyzed: 42 items")
  - [ ] STATE.md file exists and is valid YAML frontmatter
  - [ ] Multi-iteration test: 2 iterations run, phase results show 6 entries (3 phases × 2 iters)

  **QA Scenarios**:
  ```
  Scenario: Full loop completes all 4 states with shell commands
    Tool: Bash
    Preconditions: Task 7 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun run loop.ts start --task 'demo'
      3. cat _agent-loop-output/state.json | bun -e "const d=require('node:fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('final state:', j.currentState); console.log('phases:', Object.keys(j.phaseResults).length); Object.values(j.phaseResults).forEach(p => console.log(p.name, p.exitCode, p.stdout));"
    Expected Result: "final state: done", 3 phases, each with exitCode=0 and stdout text
    Evidence: .omo/evidence/task-9-integration.txt

  Scenario: Multi-iteration loopback
    Tool: Bash
    Preconditions: Task 7 complete
    Steps:
      1. cd "10-Projects/11-Active/agent-loop"
      2. bun run loop.ts start --task 'demo-2iter'
      3. cat _agent-loop-output/state.json | bun -e "const d=require('node:fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); console.log('final state:', j.currentState); console.log('iterations:', j.iteration); console.log('total phases:', Object.keys(j.phaseResults).length);"
    Expected Result: "final state: done", iterations=2, total phases=6 (3 × 2)
    Evidence: .omo/evidence/task-9-multi-iter.txt
  ```

  **Commit**: YES (group with Task 7)
  - Message: `test(agent-loop): add integration demo`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read `.omo/plans/loop-architecture.md` end-to-end. For each "Must Have": verify implementation exists (read file, run command). For each "Must NOT Have": search codebase for forbidden patterns (scoring system, YAML parser, daemon, agentmemory integration, human gates, sub-agent spawning, plugin system, web dashboard, SQLite, 88-Labs research states, LLM/model calls). Check evidence files exist in `.omo/evidence/`. Compare deliverables against plan — especially verify that phases use shell commands (not tool dispatch), state machine has 4 states (not 10), and PhaseDef uses command+exitCode contract.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty config, invalid state file, rapid repeated invocations. Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Success Criteria

### Verification Commands
```bash
cd "10-Projects/11-Active/agent-loop"
bun test                          # All unit tests pass
bun run loop.ts start --help     # Prints usage, exits 0
bun run loop.ts start --task 'demo'  # Runs 3 shell command phases, exits 0
cat _agent-loop-output/state.json # Verify currentState: "done", 3 phase results with exitCode=0
bun run tsc --noEmit             # No TypeScript errors
```

### Final Checklist
- [x] All 9 implementation tasks complete ✓
- [x] All 4 verification tasks (F1-F4) complete ✓
- [x] All "Must Have" present
- [x] All "Must NOT Have" absent
- [x] All tests pass
- [ ] User explicitly approves final results
