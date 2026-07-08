# agent-loop v5 — OpenCode orchestrator plugin

## TL;DR

> **Quick Summary**: Build an OpenCode orchestrator plugin that reads a `.plan.yaml` file and executes tasks as loop phases through agent-loop's existing v4 infrastructure.
>
> **Deliverables**:
> - Extended Plugin interface (beforeLoop + afterLoop) in `plugins.ts`
> - `src/opencode-plugin.ts` implementing the plugin
> - `src/plan-parser.ts` for YAML plan parsing
> - `loop.ts` CLI `--plan` flag
> - TDD test suite
> - CONTEXT.md + version bump to 0.5.0
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Types → Plugin interface → Parser → OpenCodePlugin → Wire → Integration test → Docs
> **Existing Codebase**: 12 src files (~1200 LOC), 147 tests (11 files), v0.4.0

---

## Context

### Original Request
Build v5 of agent-loop: an OpenCode orchestrator plugin that "takes a plan and works on it" — consumes a `.plan.yaml` companion file and executes each task as a loop phase.

### Interview Summary
**Key Discussions**:
- Plugin interface extends 3→5 hooks: add `beforeLoop(planPath: string): PhaseDef[]` and `afterLoop(result: LoopResult): void \| Promise<void>`. Existing 3 hooks (`onPhaseStart`, `onPhaseEnd`, `onError`) unchanged.
- YAML plan companion at `.omo/plans/{plan}.plan.yaml`. Per-task schema: `id`, `command` (natural language), `timeoutMs?` (number), `llm?` (object: `mcpServer?`, `tool?`, `prompt`). Loop maps `llm` to `PhaseDef.llm` and executes via existing `executeMcpPhase`.
- CLI `--plan` flag on `loop.ts` (e.g., `bun loop.ts --plan .omo/plans/foo.plan.yaml`)
- `beforeLoop` return REPLACES `LoopConfig.phases` entirely — plan-driven vs config-driven mode.
- `afterLoop` writes completion summary **both** in-place to `.plan.yaml` (per-task status/timestamps) **and** logs to agentmemory via existing `memory-hooks.ts`.
- Sequential execution within a loop — no parallel execution in v5.
- TDD: write tests first for each new concern.

**Research Findings**:
- `src/plugins.ts`: Plugin interface has 3 hooks (onPhaseStart, onPhaseEnd, onError) with HookContext type. `loadPlugins(paths: string[])` does dynamic import by file path. `executeHooks(hookName, ...args)` iterates loaded plugins and calls matching hook. Plugin must export `createPlugin(): Plugin`.
- `src/types.ts`: `PhaseDef { name, command, expectedExitCode?, timeoutMs?, llm?, pluginHooks? }`, `LoopConfig { phases, plugins?, memory? }`, `LoopState`, `PhaseResult { status, stdout?, stderr?, exitCode?, error? }`, `LoopResult`.
- `src/mcp.ts`: `executeMcpPhase(phase: PhaseDef)` spawns JSON-RPC subprocess — requires `phase.llm` to be set (returns error status if missing).
- `src/memory-hooks.ts`: `onLoopComplete`, `onPhaseFailed`, `logPhaseContext` — fire-and-forget HTTP to agentmemory at localhost:3111.
- `loop.ts` (root): Not a v4 file — needs to be created for v5. Existing entry is `src/index.ts` (barrel export, library mode).
- `config.ts`: `parseLoopArgs()` handles CLI args (no `--plan` yet), `DEFAULT_CONFIG` has hard cap of 20 max iterations.
- `package.json`: version `0.4.0`, `"module": "src/index.ts"`, no `bin` field.

### Metis Review
**Identified Gaps** (all addressed in grilling):
- **Plugin hook count mismatch**: Code has 3 hooks, CONTEXT.md claims 5, user discussion assumed 5. Resolution: Extend 3→5 cleanly.
- **Config-passing mechanism**: Plugin loading accepts file paths only — no config. Resolution: `beforeLoop(planPath)` returns PhaseDef[] — replaces phases dynamically.
- **Task→phase mapping undefined**: Prometheus plan tasks are prose with acceptance criteria. Resolution: YAML companion with `command` + `llm` fields per task, mapped to `PhaseDef`.
- **Parallel vs sequential**: Loop is strictly sequential. Resolution: v5 doesn't add parallel — each phase runs one task sequentially.
- **Plan state ownership**: Dual persistence — plugin writes to `.plan.yaml` AND agentmemory via existing hooks.
- **Plan file path resolution**: CLI `--plan` flag, not env var or convention.
- **Execution path for `command` tasks**: `executeMcpPhase` requires `phase.llm`. Resolution: YAML schema includes optional `llm` per task — tasks without `llm` use fallback execution path (direct shell command).
- **CONTEXT.md stale**: Claims 5 hook points (code has 3), wrong CLI path (src/index.ts vs loop.ts). Deferred: fixed in final docs task.

---

## Work Objectives

### Core Objective
Build agent-loop v5: OpenCode orchestrator plugin that reads a `.plan.yaml` file and executes each task as a loop phase through the existing loop infrastructure.

### Concrete Deliverables
- Extended `Plugin` interface in `src/plugins.ts` (+`beforeLoop`, +`afterLoop`)
- `PlanDef`, `TaskDef`, `PlanLoopResult` types in `src/types.ts`
- `src/plan-parser.ts` — reads + validates `.plan.yaml`
- `src/opencode-plugin.ts` — implements `createPlugin()` with `beforeLoop`/`afterLoop`
- `loop.ts` — CLI entry point with `--plan` flag, wire to plugin lifecycle
- Updated `CONTEXT.md` + `package.json` version 0.5.0
- TDD test suite for parser, plugin, and integration

### Definition of Done
- [ ] `bun test` passes (all existing 147 tests + new v5 tests)
- [ ] `bun loop.ts --plan .omo/plans/test.plan.yaml` completes all phases
- [ ] `.plan.yaml` updated with per-task status/timestamps after loop completes
- [ ] agentmemory receives completion notification via existing hooks

### Must Have
- Plugin interface extended with `beforeLoop(planPath: string): PhaseDef[]` and `afterLoop(result: LoopResult): void | Promise<void>` — signatures finalized in `src/plugins.ts`
- `src/opencode-plugin.ts` exports `createPlugin(): Plugin` (matches existing convention in plugins.test.ts)
- `src/plan-parser.ts` handles: valid YAML, file-not-found, invalid schema — returns `PlanDef` or throws typed error
- `loop.ts` CLI: `--plan` flag parsed via `parseLoopArgs`, loads plugin dynamically, calls `beforeLoop`, replaces phases, runs loop, calls `afterLoop`
- `afterLoop` writes completion status **both** in-place to `.plan.yaml` **and** via `memory-hooks.ts` to agentmemory
- TDD: `bun test __tests__/plugins.test.ts` passes for extended interface; new test files for parser + plugin
- All new code follows existing patterns: `Plugin` export convention, `HookContext` typing, error handling (throw + catch)

### Must NOT Have (Guardrails)
- No changes to existing 3 hooks signatures (`onPhaseStart`, `onPhaseEnd`, `onError`)
- No parallel execution within the loop (v5 stays sequential)
- No `bin` field added to `package.json`
- No Prometheus plan generator changes (Prometheus still produces `.omo/plans/*.md` — `.plan.yaml` is a manual companion)
- No hot reload, multi-plugin ordering, or dependency resolution across tasks
- No new dependencies (use Bun built-ins for YAML — `Bun.file()` + `JSON.parse()` or simple custom parser to stay zero-dep)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES — 147 existing tests across 11 files via `bun test`
- **Automated tests**: TDD (write test first, then implement, then refactor)
- **Framework**: `bun test`
- **TDD targets**: plan-parser (schema validation), opencode-plugin (beforeLoop → PhaseDef, afterLoop → YAML write), integration (--plan → loop → summary)

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.omo/evidence/agent-loop-v5/task-{N}-{scenario-slug}.{ext}`.

- **Library/Module**: Use `bun` REPL or test runner — import function, call with test input, assert output
- **CLI**: Use `interactive_bash` (tmux) — run `bun loop.ts --plan <path>`, validate output and exit code
- **File I/O**: Use `bash` — read `.plan.yaml` before/after, diff to verify updates
- **Examples**: fixture `.plan.yaml` files at `src/__tests__/fixtures/`

---

## Execution Strategy

### Parallel Execution Waves

> Wave 1 is parallel foundation (types + CLI skeleton). Waves 2-3 are sequential by nature (parser → plugin → wire → docs).

```
Wave 1 (Foundation — parallel, day 1):
├── Task 1: Plan types + extended Plugin interface [quick]
└── Task 2: loop.ts CLI skeleton with --plan flag [quick]

Wave 2 (Implementation — depends on Wave 1):
├── Task 3: Plan YAML parser [unspecified-high]
└── Task 4: OpenCodePlugin implementation [deep]

Wave 3 (Integration — depends on Wave 2):
├── Task 5: Wire plugin → loop runner + integration test [deep]

Wave 4 (Docs — depends on Wave 3):
└── Task 6: Update CONTEXT.md + bump version [quick]

Wave FINAL (parallel — after ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality + test sanity (unspecified-high)
├── Task F3: Manual QA + edge cases (unspecified-high)
└── Task F4: Scope fidelity check (deep)
       → Present results → Get explicit user okay

Critical Path: Task 1 → Task 4 → Task 5 → Task 6 → F1-F4 → user okay
Parallel Speedup: ~25% (Wave 1 parallel, rest sequential)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 3, 4 | 1 |
| 2 | — | 5 | 1 |
| 3 | 1 | 4 | 2 |
| 4 | 1, 3 | 5 | 2 |
| 5 | 2, 4 | 6 | 3 |
| 6 | 5 | F1-F4 | 4 |

---

## TODOs

- [ ] 1. Plan types + extended Plugin interface

  **What to do**:
  - Add `PlanDef`, `TaskDef`, `PlanLoopResult` types to `src/types.ts`
    - `TaskDef { id: string, command: string, timeoutMs?: number, llm?: { mcpServer?: string, tool?: string, prompt?: string } }`
    - `PlanDef { tasks: TaskDef[] }`
    - `PlanLoopResult { taskId: string, status: string, exitCode?: number, startedAt?: string, completedAt?: string, error?: string }`
  - Add `beforeLoop(planPath: string): PhaseDef[]` and `afterLoop(result: LoopResult): void | Promise<void>` to `Plugin` interface in `src/plugins.ts`
  - Add `planPath?: string` to `LoopConfig` in `src/types.ts`
  - Run TDD: write test for new Plugin interface methods → verify TypeScript compiles
  - Update `HookContext` type if needed (likely no change — `beforeLoop` takes `planPath`, `afterLoop` takes `LoopResult`)

  **Must NOT do**:
  - Don't change existing `onPhaseStart`, `onPhaseEnd`, `onError` signatures
  - Don't change `PhaseDef` structure (it already has `llm`, `timeoutMs`, `command`)
  - Don't add dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick` — small, well-defined type changes across 2 files
  - **Skills**: none needed (TypeScript + existing codebase patterns)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: Task 3, Task 4
  - **Blocked By**: None

  **References**:
  - `src/types.ts:PhaseDef` — Existing phase definition to model TaskDef against
  - `src/types.ts:LoopConfig` — Existing config type — add `planPath?` field
  - `src/types.ts:LoopResult` — Result type passed to afterLoop
  - `src/plugins.ts:Plugin` — Interface to extend — match existing async method signatures
  - `src/plugins.test.ts` — Existing plugin test patterns

  **Acceptance Criteria**:
  - [ ] `src/types.ts` exports `PlanDef`, `TaskDef`, `PlanLoopResult`
  - [ ] `src/plugins.ts` exports updated `Plugin` interface with `beforeLoop` + `afterLoop`
  - [ ] `bun test src/__tests__/plugins.test.ts` passes (existing tests + new interface stub)
  - [ ] TypeScript compiles: `bun run tsc --noEmit` (or equivalent check)

  **QA Scenarios**:

  ```
  Scenario: Plugin interface compiles with new methods
    Tool: Bash (bun)
    Preconditions: Working tree clean, bun installed
    Steps:
      1. Run `bun test src/__tests__/plugins.test.ts`
    Expected Result: All existing tests pass, new type definitions compile
    Failure Indicators: TypeScript error if beforeLoop/afterLoop signatures don't match PhaseDef/LoopResult types
    Evidence: .omo/evidence/agent-loop-v5/task-1-plugin-interface-compiles.txt

  Scenario: PlanDef/TaskDef schema instantiable
    Tool: Bash (node REPL)
    Preconditions: types.ts exports PlanDef
    Steps:
      1. Run `bun -e "import { PlanDef } from './src/types'; const p: PlanDef = { tasks: [{ id: '1', command: 'test' }] }; console.log('ok')"`
    Expected Result: Console outputs "ok", no type errors
    Evidence: .omo/evidence/agent-loop-v5/task-1-types-instantiable.txt
  ```

  **Evidence to Capture**:
  - [ ] Task 1: `task-1-plugin-interface-compiles.txt` — bun test output
  - [ ] Task 1: `task-1-types-instantiable.txt` — node REPL output

  **Commit**: NO (groups with Task 5)

- [ ] 2. CLI skeleton with `--plan` flag

  **What to do**:
  - Create `loop.ts` at project root (alongside existing `src/` directory)
  - Add `--plan` CLI argument parsing: `parseLoopArgs` in `src/config.ts` accepts `--plan <path>` → stores in `LoopConfig.planPath`
  - Wire `--plan` into `DEFAULT_CONFIG` defaults (undefined by default)
  - `loop.ts` prints usage info when `--plan` is missing or `--help` is passed
  - `loop.ts` validates file exists at `--plan` path → graceful error if not found
  - Wire `--plan` value through to LoopConfig so downstream code can access it
  - Wire `--verbose` flag for debug output
  - Create `loop.ts` as a thin CLI wrapper — no loop logic itself, just parses args and passes to the runner
  - Add `loop.ts` to `package.json#bin`? **NO** — deferred per Must NOT Have. `loop.ts` is run as `bun loop.ts --plan ...`

  **Must NOT do**:
  - Don't add `bin` field to `package.json`
  - Don't implement loop execution (that's later tasks)
  - Don't change existing CLI behavior (src/index.ts is library mode, loop.ts is new)

  **Recommended Agent Profile**:
  - **Category**: `quick` — single-file CLI wrapper with arg parsing
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 5
  - **Blocked By**: None

  **References**:
  - `src/config.ts:parseLoopArgs` — Existing CLI arg parsing pattern to extend
  - `src/config.ts:DEFAULT_CONFIG` — Skeleton config structure
  - `src/types.ts:LoopConfig` — Config type — will have `planPath?` field after Task 1

  **Acceptance Criteria**:
  - [ ] `loop.ts` exists at project root
  - [ ] `bun loop.ts --help` prints usage info (exit 0)
  - [ ] `bun loop.ts --plan .omo/plans/nonexistent.plan.yaml` prints error (exit non-zero)
  - [ ] `bun loop.ts` without `--plan` prints error message
  - [ ] `parseLoopArgs('--plan', 'foo.plan.yaml')` returns `{ planPath: 'foo.plan.yaml' }` in config
  - [ ] `bun test src/__tests__/config.test.ts` passes (existing config tests)

  **QA Scenarios**:

  ```
  Scenario: --help flag
    Tool: Bash (bun)
    Preconditions: loop.ts exists at root
    Steps:
      1. Run `bun loop.ts --help`
    Expected Result: Exits with code 0, prints usage text including --plan flag
    Evidence: .omo/evidence/agent-loop-v5/task-2-help-flag.txt

  Scenario: Missing --plan flag
    Tool: Bash (bun)
    Preconditions: loop.ts exists
    Steps:
      1. Run `bun loop.ts`
    Expected Result: Exits with non-zero code, prints error about --plan flag
    Evidence: .omo/evidence/agent-loop-v5/task-2-missing-plan.txt

  Scenario: Nonexistent plan file
    Tool: Bash (bun)
    Preconditions: loop.ts exists
    Steps:
      1. Run `bun loop.ts --plan .omo/plans/nonexistent.plan.yaml`
    Expected Result: Exits with non-zero code, prints "not found" error
    Evidence: .omo/evidence/agent-loop-v5/task-2-nonexistent-plan.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-2-help-flag.txt`
  - [ ] `task-2-missing-plan.txt`
  - [ ] `task-2-nonexistent-plan.txt`

  **Commit**: NO (groups with Task 5)

- [ ] 3. Plan YAML parser

  **What to do**:
  - Create `src/plan-parser.ts` with:
    - `readPlan(path: string): Promise<PlanDef>` — reads `.plan.yaml`, parses YAML, validates schema
    - `TaskDef` fields: `id` (required, string), `command` (required, string), `timeoutMs` (optional, number), `llm` (optional, `{ mcpServer?: string, tool?: string, prompt?: string }`)
    - Validation rules:
      - File must exist → throw `PlanNotFoundError(planPath)`
      - Valid YAML → parse, else throw `PlanParseError(planPath, parseError)`
      - `tasks` must be an array with at least 1 entry
      - Each task must have `id` (string) and `command` (string)
      - `timeoutMs` if present must be positive integer
      - `llm` if present must be object (no required sub-fields — any subset valid)
      - Unknown fields pass through (forward-compat)
    - `PlanNotFoundError` and `PlanParseError` custom error classes with `planPath` property
  - Create `src/__tests__/plan-parser.test.ts` with TDD tests:
    - Valid plan with 3 tasks → returns `PlanDef` with 3 entries
    - Plan with missing `command` → throws `PlanParseError`
    - Plan with empty tasks array → throws `PlanParseError`
    - File not found → throws `PlanNotFoundError`
    - Invalid YAML → throws `PlanParseError`
    - Plan with `llm` field → correctly parses llm subfields
    - Plan with `timeoutMs` → preserves value
  - Create `src/__tests__/fixtures/` with test `.plan.yaml` files:
    - `valid-three-tasks.plan.yaml` — 3 tasks with all fields
    - `valid-minimal.plan.yaml` — 1 task with just `id` + `command`
    - `missing-command.plan.yaml` — task without command
    - `empty-tasks.plan.yaml` — `tasks: []`
    - `with-llm.plan.yaml` — task with full llm sub-object

  **Must NOT do**:
  - Don't add js-yaml or other YAML dep — use Bun's `Bun.file()` + manual YAML parsing (or minimal custom parser matching state.ts pattern)
  - Don't implement beforeLoop/afterLoop logic here — that's Task 4
  - Don't modify existing types — `PlanDef`/`TaskDef` already added in Task 1

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high` — parser with error handling needs sound judgment on edge cases
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (after Wave 1 complete)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `src/types.ts:PlanDef, TaskDef` — Types to parse into
  - `src/state.ts` — state.ts has custom YAML parser for frontmatter — use similar approach for zero-dep YAML parsing
  - `src/types.ts:PhaseDef` — The target structure TaskDef maps into (for context)
  - `src/__tests__/plugins.test.ts` — Test pattern to follow (describe/it/expect)

  **Acceptance Criteria**:
  - [ ] `src/plan-parser.ts` exports `readPlan(path: string): Promise<PlanDef>`
  - [ ] `src/plan-parser.ts` exports `PlanNotFoundError`, `PlanParseError` with `planPath` property
  - [ ] `src/__tests__/plan-parser.test.ts` has minimum 7 tests (valid, minimal, missing-command, empty, not-found, invalid-yaml, with-llm)
  - [ ] `bun test src/__tests__/plan-parser.test.ts` → all tests PASS
  - [ ] Fixture files exist at `src/__tests__/fixtures/*.plan.yaml`

  **QA Scenarios**:

  ```
  Scenario: Parse valid plan with 3 tasks
    Tool: Bash (bun)
    Preconditions: src/plan-parser.ts exists, fixture files exist
    Steps:
      1. Run `bun -e "import { readPlan } from './src/plan-parser'; const p = await readPlan('./src/__tests__/fixtures/valid-three-tasks.plan.yaml'); console.log(JSON.stringify(p))"`
    Expected Result: JSON output with 3 tasks, each with id, command, and optional fields preserved
    Evidence: .omo/evidence/agent-loop-v5/task-3-parse-valid.txt

  Scenario: File not found error
    Tool: Bash (bun)
    Preconditions: plan-parser.ts exists
    Steps:
      1. Run `bun -e "import { readPlan, PlanNotFoundError } from './src/plan-parser'; try { await readPlan('./nonexistent.yaml'); } catch(e) { if(e instanceof PlanNotFoundError) console.log('CAUGHT:', e.planPath); }"`
    Expected Result: Console outputs "CAUGHT:" + the path string — typed error caught
    Evidence: .omo/evidence/agent-loop-v5/task-3-not-found-error.txt

  Scenario: Parse error on invalid YAML
    Tool: Bash (bun)
    Preconditions: Fixture with invalid YAML exists (or create inline)
    Steps:
      1. Run `bun -e "import { readPlan, PlanParseError } from './src/plan-parser'; try { await readPlan('./src/__tests__/fixtures/invalid-yaml.plan.yaml'); } catch(e) { if(e instanceof PlanParseError) console.log('CAUGHT:', e.message); }"`
    Expected Result: Console outputs "CAUGHT:" with parse error description
    Evidence: .omo/evidence/agent-loop-v5/task-3-parse-error.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-3-parse-valid.txt`
  - [ ] `task-3-not-found-error.txt`
  - [ ] `task-3-parse-error.txt`
  - [ ] `bun test src/__tests__/plan-parser.test.ts` output

  **Commit**: NO (groups with Task 5)

- [ ] 4. OpenCodePlugin implementation

  **What to do**:
  - Create `src/opencode-plugin.ts` implementing `Plugin` interface:
    - Export `createPlugin(): Plugin` (follows existing plugin convention from `plugins.test.ts`)
    - The plugin has `name: 'opencode'`
    - **`beforeLoop(planPath: string): PhaseDef[]`**:
      - Calls `readPlan(planPath)` from `src/plan-parser.ts`
      - Maps each `TaskDef` to `PhaseDef`:
        - `name` = `task.id` (converted to string)
        - `command` = `task.command`
        - `timeoutMs` = `task.timeoutMs` or falls back to `DEFAULT_CONFIG.timeout` (30000)
        - `llm` = `task.llm` (or undefined for command-only tasks)
        - `expectedExitCode` = 0 (default)
      - Returns `PhaseDef[]`
    - **`afterLoop(result: LoopResult): Promise<void>`**:
      - Reads `LoopResult.phases` — each has phase name (matching task id) + status/stderr/stdout/error/exitCode
      - Constructs `PlanLoopResult[]` from phase results
      - Rewrites `.plan.yaml` at `this.planPath` (stored from beforeLoop call path) with updated status per task
      - Existing `memory-hooks.ts` (`onLoopComplete` callback) fires independently — no need to trigger manually
      - Timestamps: `startedAt` and `completedAt` as ISO 8601 strings
  - Create `src/__tests__/opencode-plugin.test.ts` with TDD tests:
    - `createPlugin()` returns object with `name === 'opencode'`
    - `beforeLoop` with valid plan path returns `PhaseDef[]` with correct structure
    - `beforeLoop` with nonexistent path throws `PlanNotFoundError`
    - `beforeLoop` generates correct PhaseDef.llm from TaskDef.llm
    - `afterLoop` writes updated YAML to plan file
    - `afterLoop` handles empty result gracefully
    - Mock/integration: `beforeLoop` + `afterLoop` roundtrip preserves task ids

  **Must NOT do**:
  - Don't implement loop execution logic — the caller (loop.ts) handles phases after beforeLoop returns
  - Don't change `memory-hooks.ts` — existing hooks fire independently; plugin doesn't call them directly
  - Don't add file-locking or concurrency guards — v5 is sequential only
  - Don't modify `plugins.ts` or any existing plugin infrastructure

  **Recommended Agent Profile**:
  - **Category**: `deep` — plugin needs deep understanding of existing Plugin interface, types, and memory-hooks integration
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3, but depends on Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 1, Task 3

  **References**:
  - `src/plugins.ts:Plugin interface` — The interface to implement (with beforeLoop/afterLoop from Task 1)
  - `src/plugins.test.ts:describe('plugin')` — Test pattern for plugin — `createPlugin()` convention
  - `src/types.ts:PhaseDef, LoopResult, LoopState` — Types used by plugin hooks
  - `src/memory-hooks.ts:onLoopComplete` — Fire-and-forget agentmemory callback — will fire independently
  - `src/state.ts` — Custom YAML writing pattern for afterLoop's in-place update
  - `src/config.ts:DEFAULT_CONFIG` — Fallback timeout if task doesn't specify timeoutMs

  **Acceptance Criteria**:
  - [ ] `src/opencode-plugin.ts` exports `createPlugin(): Plugin`
  - [ ] `createPlugin()` returns object with `name: 'opencode'` and implements all 5 hook methods
  - [ ] `beforeLoop` returns `PhaseDef[]` — each entry has `name`, `command`, `timeoutMs`, `llm` mapped from `TaskDef`
  - [ ] `afterLoop` writes `.plan.yaml` with updated status/timestamps per task
  - [ ] `bun test src/__tests__/opencode-plugin.test.ts` → all tests PASS
  - [ ] Existing `bun test` still passes (no regressions)

  **QA Scenarios**:

  ```
  Scenario: beforeLoop returns PhaseDef array matching plan tasks
    Tool: Bash (bun)
    Preconditions: src/opencode-plugin.ts exists, valid fixture .plan.yaml exists
    Steps:
      1. Run `bun -e "import { createPlugin } from './src/opencode-plugin'; const plugin = createPlugin(); const phases = await plugin.beforeLoop('./src/__tests__/fixtures/valid-three-tasks.plan.yaml'); console.log(JSON.stringify(phases))"`
    Expected Result: JSON array of 3 PhaseDef objects — each has name, command, timeoutMs, llm
    Failure Indicators: Missing fields, wrong types, wrong count
    Evidence: .omo/evidence/agent-loop-v5/task-4-beforeloop-phases.txt

  Scenario: afterLoop writes status to .plan.yaml
    Tool: Bash (bun)
    Preconditions: Plugin exists, fixture .plan.yaml exists, a copy for mutating
    Steps:
      1. Copy fixture to temp test file
      2. Run `bun -e "import { createPlugin } from './src/opencode-plugin'; const p = createPlugin(); await p.beforeLoop('./test-temp.plan.yaml'); await p.afterLoop({ phases: [{ name: '1', status: 'success' }] });"`
      3. Read the plan file via `cat test-temp.plan.yaml`
    Expected Result: Plan YAML now has status/timestamp fields per task
    Evidence: .omo/evidence/agent-loop-v5/task-4-afterloop-status.txt

  Scenario: beforeLoop with nonexistent path throws typed error
    Tool: Bash (bun)
    Preconditions: Plugin exists
    Steps:
      1. Run the plugin with nonexistent path, catch PlanNotFoundError
    Expected Result: Throws PlanNotFoundError with correct path
    Evidence: .omo/evidence/agent-loop-v5/task-4-notfound.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-4-beforeloop-phases.txt`
  - [ ] `task-4-afterloop-status.txt`
  - [ ] `task-4-notfound.txt`
  - [ ] `bun test src/__tests__/opencode-plugin.test.ts` output

  **Commit**: NO (groups with Task 5)

- [ ] 5. Wire plugin → loop runner + integration test

  **What to do**:
  - Complete `loop.ts` at project root with full loop execution logic:
    - Parse args via `parseLoopArgs` (extended in Task 2 — recognizes `--plan`)
    - If `config.planPath` is set:
      1. Load OpenCodePlugin: dynamic import `src/opencode-plugin.ts`, call `createPlugin()`
      2. Call `plugin.beforeLoop(config.planPath)` → receives `PhaseDef[]`
      3. Replace `config.phases` with these PhaseDef entries
      4. Add plugin to `config.plugins` array so lifecycle hooks fire
    - Initialize `LoopState`, run phase loop:
      - For each phase in `config.phases`:
        - Call `executeHooks('onPhaseStart', phase, state)`
        - Call `executeMcpPhase(phase)` or fallback shell execution for command-only phases
        - Call `executeHooks('onPhaseEnd', phase, result, state)`
        - Collect results
    - After all phases complete:
      - Call `plugin.afterLoop(loopResult)` — writes completion summary + triggers agentmemory hooks
    - Handle errors gracefully:
      - If `beforeLoop` throws (PlanNotFoundError, PlanParseError) → log error, exit non-zero
      - If phase fails → existing error handling applies (FAILED state → DONE, afterLoop still called)
  - Create `src/__tests__/integration.opencode.test.ts` with integration test:
    - Full end-to-end test:
      1. Create temporary `.plan.yaml` with 2-3 tasks
      2. Run `bun loop.ts --plan <temp-plan-path>`
      3. Verify all phases executed (check stdout/stderr output)
      4. Verify `.plan.yaml` updated with per-task status
    - Edge case: empty plan file → graceful error, non-zero exit
    - Edge case: plan with unknown `llm` mcpServer → phase fails with error (existing mcp.ts behavior)

  **Must NOT do**:
  - Don't implement parallel phase execution (v5 stays sequential)
  - Don't add file-locking or concurrency safety
  - Don't modify `src/mcp.ts`, `src/plugins.ts`, or any existing v4 source beyond adding `--plan` arg parse (already done in Task 2)
  - Don't add `bin` field to package.json

  **Recommended Agent Profile**:
  - **Category**: `deep` — integration requires understanding full v4 loop flow, plugin pipeline, error handling. Deepest task.
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Blocks**: Task 6
  - **Blocked By**: Task 2, Task 4

  **References**:
  - `src/mcp.ts:executeMcpPhase` — Core phase execution function
  - `src/plugins.ts:loadPlugins, executeHooks` — Plugin lifecycle integration
  - `src/state-machine.ts` — State machine transitions
  - `src/safety.ts:executeWithTimeout` — Safety wrapper for phase execution
  - `src/config.ts:parseLoopArgs` — CLI arg parsing with --plan
  - `src/index.ts` — Existing barrel export (loop.ts is separate entry point)
  - `src/__tests__/daemon.test.ts` — Integration test patterns in existing codebase
  - `src/types.ts:LoopConfig, LoopState, PhaseResult, LoopResult` — Core execution types

  **Acceptance Criteria**:
  - [ ] `loop.ts` at root loads OpenCodePlugin when `--plan` is passed
  - [ ] `bun loop.ts --plan src/__tests__/fixtures/valid-three-tasks.plan.yaml` runs all phases to completion
  - [ ] `.plan.yaml` updated with per-task status/timestamps after completion
  - [ ] `bun test src/__tests__/integration.opencode.test.ts` → all PASS (end-to-end + edge cases)
  - [ ] `bun test` — all existing 147 tests still PASS (no regressions)
  - [ ] Error handling: nonexistent plan file → graceful error + non-zero exit

  **QA Scenarios**:

  ```
  Scenario: End-to-end plan execution
    Tool: Bash (bun + tmux recommended for long-running)
    Preconditions: All v5 code implemented, valid-three-tasks.plan.yaml fixture exists
    Steps:
      1. Run `bun loop.ts --plan src/__tests__/fixtures/valid-three-tasks.plan.yaml`
    Expected Result: Loop completes all 3 phases, exit code 0, each phase output visible
    Evidence: .omo/evidence/agent-loop-v5/task-5-e2e-output.txt

  Scenario: Plan YAML updated after execution
    Tool: Bash
    Preconditions: After e2e run, copy the plan file to inspect
    Steps:
      1. Copy the .plan.yaml to a temp location after loop completes
      2. Read it and look for status/timestamp fields per task
    Expected Result: Each task entry has `status`, `startedAt`, `completedAt` fields
    Evidence: .omo/evidence/agent-loop-v5/task-5-plan-updated.yaml

  Scenario: Nonexistent plan file → graceful error
    Tool: Bash
    Preconditions: loop.ts exists
    Steps:
      1. Run `bun loop.ts --plan /tmp/nonexistent.plan.yaml` (capture both stdout and stderr)
    Expected Result: Non-zero exit code, error message mentions "not found" or nonexistent path
    Evidence: .omo/evidence/agent-loop-v5/task-5-missing-plan-error.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-5-e2e-output.txt`
  - [ ] `task-5-plan-updated.yaml`
  - [ ] `task-5-missing-plan-error.txt`
  - [ ] `bun test` output showing all tests pass

  **Commit**: YES
  - Message: `feat(agent-loop): v5 OpenCode orchestrator plugin`
  - Files: All new + modified files

- [ ] 6. Update CONTEXT.md + bump version

  **What to do**:
  - Update `CONTEXT.md`:
    - Fix the Plugin hooks count: change "5 hook points" to "3 hooks (onPhaseStart, onPhaseEnd, onError)" + note v5 extended with beforeLoop/afterLoop
    - Update the mindmap: add `opencode-plugin.ts`, `plan-parser.ts`, `loop.ts` nodes
    - Add v5 section under Key Decisions or new section:
      - V5 OpenCode orchestrator plugin: beforeLoop/afterLoop, --plan flag, plan companion YAML
    - Update CLI path: change `bun run src/index.ts` to `bun loop.ts` for plan-driven mode
    - Update version reference: 0.4.0 → 0.5.0 throughout
    - Update module count: 12 → 15 files (add opencode-plugin.ts, plan-parser.ts, loop.ts)
    - Add PlanDef/TaskDef/PlanLoopResult to types listing
    - Update Quick Start with v5 --plan example
  - `package.json`: change `"version": "0.4.0"` → `"0.5.0"`
  - `package-lock.json`: update version field if present
  - Run `bun test` to confirm no regression

  **Must NOT do**:
  - Don't change any source code (this is docs-only + version)
  - Don't rewrite CONTEXT.md entirely — incremental update preserving existing content
  - Don't add new sections beyond what v5 introduces
  - Don't change dependency versions, scripts, or configs

  **Recommended Agent Profile**:
  - **Category**: `quick` — docs edit + single-line version change
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: NO (must reflect final implementation state)
  - **Blocks**: F1-F4
  - **Blocked By**: Task 5

  **References**:
  - `CONTEXT.md` — Current doc to update
  - `package.json` — Version field to bump
  - `package-lock.json` — Version field to bump (if present)

  **Acceptance Criteria**:
  - [ ] `CONTEXT.md` shows correct Plugin hooks count (3 + 2 = 5, described accurately)
  - [ ] `CONTEXT.md` mindmap includes `opencode-plugin.ts`, `plan-parser.ts`, `loop.ts`
  - [ ] `CONTEXT.md` has Quick Start with `--plan` example
  - [ ] `package.json` version is `0.5.0`
  - [ ] `package-lock.json` version matches (if lockfile exists)
  - [ ] `bun test` passes (no regression from docs-only change)

  **QA Scenarios**:

  ```
  Scenario: Verify CONTEXT.md accuracy
    Tool: Bash
    Preconditions: CONTEXT.md updated
    Steps:
      1. Run `bun -e "const md = await Bun.file('./CONTEXT.md').text(); console.log('Has beforeLoop:', md.includes('beforeLoop')); console.log('Has afterLoop:', md.includes('afterLoop')); console.log('Has loop.ts:', md.includes('loop.ts')); console.log('Lines:', md.split('\n').length)"`
    Expected Result: CONTEXT.md mentions beforeLoop, afterLoop, loop.ts. File under ~200 lines.
    Evidence: .omo/evidence/agent-loop-v5/task-6-context-check.txt

  Scenario: Verify package.json version
    Tool: Bash
    Preconditions: package.json updated
    Steps:
      1. Run `bun -e "console.log(JSON.parse(await Bun.file('./package.json').text()).version)"`
    Expected Result: "0.5.0"
    Evidence: .omo/evidence/agent-loop-v5/task-6-version.txt

  Scenario: Tests still pass after docs change
    Tool: Bash
    Preconditions: CONTEXT.md and package.json updated
    Steps:
      1. Run `bun test`
    Expected Result: All tests PASS (0 failures)
    Evidence: .omo/evidence/agent-loop-v5/task-6-tests-pass.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-6-context-check.txt`
  - [ ] `task-6-version.txt`
  - [ ] `task-6-tests-pass.txt`

  **Commit**: NO (groups with Task 5 — same commit: `feat(agent-loop): v5 OpenCode orchestrator plugin`)

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.omo/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality + Test Sanity** — `unspecified-high`
  Run `tsc --noEmit` + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Manual QA + Edge Cases** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty plan, invalid YAML, missing required fields, timeout during execution, plan file deleted mid-run.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Commit | Message | Files |
|--------|---------|-------|
| Final | `feat(agent-loop): v5 OpenCode orchestrator plugin` | All new + modified files |

Pre-commit: `bun test` (all 147 existing + new v5 tests pass)

---

## Success Criteria

### Verification Commands
```bash
bun test                                         # All tests pass
bun loop.ts --plan .omo/plans/test.plan.yaml     # Loop completes successfully
cat .omo/plans/test.plan.yaml                    # Shows per-task status/timestamps
```

### Final Checklist
- [ ] Plugin interface has `beforeLoop` + `afterLoop` — signatures match PhaseDef/LoopResult types
- [ ] `src/opencode-plugin.ts` exports `createPlugin()` — follows existing convention
- [ ] `src/plan-parser.ts` handles valid, missing, and invalid .plan.yaml
- [ ] `loop.ts --plan` flag loads plugin, runs loop, writes summary
- [ ] `afterLoop` writes to **both** .plan.yaml **and** agentmemory
- [ ] All Must Have present
- [ ] All Must NOT Have absent
- [ ] All tests pass
