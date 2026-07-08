# agent-loop: OpenSpec Integration + Cross-Platform Shell

## TL;DR

> **Quick Summary**: Add OpenSpec spec-driven development to agent-loop with two changes: (1) lightweight architecture overview spec documenting existing code, (2) full spec-to-implementation cycle for cross-platform shell support (Unix/Mac alongside Windows).
>
> **Deliverables**:
> - `openspec/` directory with config.yaml, one architecture spec, one cross-platform shell change
> - Cross-platform shell execution: OS auto-detection, `cmd.exe` on Windows, `sh -c` on Unix/Mac
> - TDD tests for all new cross-platform behavior
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: OpenSpec setup → arch spec → cross-platform proposal → cross-platform impl

---

## Context

### Original Request
Add OpenSpec spec-driven development infrastructure to agent-loop, following vault conventions. Full spec coverage — document existing architecture AND specify + implement cross-platform shell support.

### Interview Summary
**Key Discussions**:
- **Spec intent**: Two separate OpenSpec changes, not one — avoids conflating documentation with specification
- **Change 1 (`arch-spec`)**: Lightweight architecture overview spec referencing CONTEXT.md (not per-module deep-dives). Confirmed useful as formal OpenSpec entry point.
- **Change 2 (`cross-platform-shell`)**: Full proposal→design→specs→tasks→implement cycle for cross-platform shell support
- **Arch spec only**: Chose lightweight overview over per-module specs (CONTEXT.md already covers per-module detail)
- **Implementation**: Cross-platform shell was chosen as the first forward-spec feature

**Vault OpenSpec Conventions** (sourced from `openspec/changes/migrate-opencode-windows-native/`):
- Change directory: `openspec/changes/{name}/`
- Artifacts: `proposal.md` (Why, What Changes, Capabilities, Impact), `design.md` (Context, Goals/Non-Goals, Decisions, Risks), `tasks.md` (module-grouped checkboxes), `specs/{capability}/spec.md`
- Metadata: `.openspec.yaml` at change root
- Project config: `openspec/config.yaml`

### Metis Review
**Identified Gaps** (addressed):
- **Documentation vs specification**: Split into two separate changes to avoid conflating reverse-documentation with forward-specification
- **CONTEXT.md overlap**: Arch spec is lightweight and references CONTEXT.md as source of truth — no duplication
- **Vault pattern break**: Arch spec (documenting existing code) breaks forward-only OpenSpec pattern — accepted by user as minimal, intentional deviation
- **Test strategy**: Change 1 = docs-only (agent QA), Change 2 = TDD (bun test, 147 existing tests)

---

## Work Objectives

### Core Objective
Add OpenSpec spec-driven development to agent-loop, documented with a lightweight architecture overview spec, then spec and implement cross-platform shell support (Unix/Mac + Windows).

### Concrete Deliverables
- `openspec/config.yaml` — project-level OpenSpec config
- `openspec/changes/openspec-integration/` — architecture documentation artifacts
- `openspec/changes/cross-platform-shell/` — cross-platform shell proposal→design→specs→tasks
- `src/shell.ts` — OS detection + shell command abstraction
- `loop.ts` — updated to use unified shell executor
- `__tests__/shell.test.ts` — TDD tests for shell abstraction

### Definition of Done
- [ ] `cat openspec/config.yaml` → exists with valid project context
- [ ] `cat openspec/changes/openspec-integration/proposal.md` → architecture overview documented
- [ ] `cat openspec/changes/cross-platform-shell/tasks.md` → cross-platform implementation tasks listed
- [ ] `bun test __tests__/shell.test.ts` → all shell tests pass
- [ ] `bun test` → all 147+ existing tests + new tests pass
- [ ] `bun run loop.ts start --task demo` → runs successfully on Windows (cmd.exe)
- [ ] `bun run loop.ts start --task demo` → runs successfully on Unix/Mac (sh)

### Must Have
- `openspec/` directory with config.yaml and one active change
- Architecture overview spec documenting: state machine, persistence, safety, CLI, MCP, plugins, API, memory hooks
- Cross-platform shell abstraction: `src/shell.ts` with `detectShell()` and `buildCommand()`
- `loop.ts`: replace `['cmd.exe', '/c', command]` with unified shell call
- TDD tests: RED→GREEN→REFACTOR for each implementation task
- Existing tests continue to pass (147+)

### Must NOT Have (Guardrails)
- No per-module deep-dive spec files (CONTEXT.md is the source of truth)
- No modifications to CONTEXT.md
- No other feature work beyond cross-platform shell
- No npm publish, GitHub CI/CD, or GitHub repo setup
- No changes to state machine, plugins, API server, agentmemory, or evaluate modules
- No adding new dependencies (Bun's `process.platform` is available natively)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test, 147 existing tests across 11 files)
- **Automated tests**: TDD (RED → GREEN → REFACTOR) for Change 2 implementation
- **Framework**: bun test
- **Change 1 (arch spec)**: Documentation only — verified by agent QA (read files, confirm content)

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

```
Wave 1 (OpenSpec Foundation — 3 parallel):
├── 1. Create openspec/ dir + config.yaml [quick]
├── 2. Write openspec-integration proposal + design [writing]
├── 3. Write arch overview spec [writing]

Wave 2 (Cross-Platform Planning — 2 parallel):
├── 4. Write cross-platform-shell proposal + design [writing]
├── 5. Write cross-platform specs + tasks [writing]

Wave 3 (Cross-Platform Implementation — 2 parallel TDD):
├── 6. Create src/shell.ts — OS detection, shell abstraction, buildCommand() [unspecified-high]
├── 7. Update loop.ts — use unified shell executor [quick]

Wave 4 (Cross-Platform Tests — TDD):
├── 8. Create __tests__/shell.test.ts — OS detection, shell selection, edge cases [unspecified-high]
├── 9. Update loop.ts tests — shell integration (TDD) [unspecified-high]

Wave FINAL (4 parallel reviews):
├── F1. Plan compliance audit (oracle)
├── F2. Code quality + regression test (unspecified-high)
├── F3. Cross-platform end-to-end QA (unspecified-high)
├── F4. OpenSpec completeness check (deep)

Critical Path: Task 1 → Task 4 → Task 6 → Task 8 → Task 9 → F1-F4 → user ok
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 3 (Wave 1)
```

### Dependency Matrix
- 1: - - 2, 3, 4, 5
- 2: 1 - -
- 3: 1 - -
- 4: 1 - 6, 8
- 5: 4 - 6, 8
- 6: 4, 5 - 7, 8
- 7: 6 - 9
- 8: 6 - 9
- 9: 7, 8 - F2, F3

---

## TODOs

- [ ] 1. Create openspec/ directory + config.yaml

  **What to do**:
  - Create `agent-loop/openspec/` directory (if not exists): `mkdir -p openspec/changes`
  - Create `openspec/config.yaml` with project context:
    ```yaml
    schema: spec-driven

    context: |
      Project: agent-loop — Bun/TS orchestrator, zero runtime deps.
      Current version: v4 (state machine, persistence, safety, CLI, MCP, plugins, API, agentmemory, daemon)
      Source: ~330 LOC across 12 source files + 147 tests across 11 test files
      Invariants: No LLM, no MCP, no daemon (v1); no YAML parser dep; no SQLite
      Shell: Currently Windows-only (cmd.exe /c), cross-platform coming
      Entry: bun run loop.ts start [options]

    rules:
      proposal:
        - Keep proposals under 500 words
        - Always include scope and non-goals
      tasks:
        - Break tasks into chunks of max 2 hours
        - Reference test commands for each task where applicable
    ```
  - Create placeholder `openspec/changes/.gitkeep`

  **Must NOT do**:
  - Don't create deep directory trees — only the skeleton needed

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 1, can run in parallel with tasks 2, 3

  **Acceptance Criteria**:
  - [ ] `Test-Path openspec/config.yaml` → `True`
  - [ ] `Test-Path openspec/changes/.gitkeep` → `True`

  **Evidence to Capture**:
  - [ ] Directory tree listing of `openspec/`

  **Commit**: NO (groups with tasks 2-3)

- [ ] 2. Write openspec-integration change: proposal + design

  **What to do**:
  Create `openspec/changes/openspec-integration/`:

  **proposal.md** (~200 words):
  ```
  ## Why
  agent-loop has no formal specification system. Architecture is documented in a single CONTEXT.md file with no change tracking, no spec-driven development flow, and no link to the vault's OpenSpec workflow. Adding OpenSpec enables proposal-driven feature development, per-change tasks, and spec-verified implementations.

  ## What Changes
  - Add `openspec/config.yaml` with project context
  - Create `openspec/changes/openspec-integration/` with architecture overview spec
  - Architecture overview spec documents: state machine, persistence, safety, CLI, MCP, plugins, API, agentmemory
  - CONTEXT.md remains the detailed source of truth; the OpenSpec spec references it

  ## Capabilities
  ### New Capabilities
  - `openspec-project`: agent-loop becomes an OpenSpec-managed project aligned with vault conventions

  ### Modified Capabilities
  <!-- No existing specs to modify -->

  ## Impact
  - `openspec/config.yaml` — new file
  - `openspec/changes/openspec-integration/` — new directory with 5 artifacts
  - No source code changes
  ```

  **design.md**:
  ```
  ## Context
  agent-loop is a Bun/TS orchestrator with zero runtime deps. Currently documented via CONTEXT.md (~300 lines). The vault uses OpenSpec for spec-driven development at repo root. Adding project-level OpenSpec enables the same workflow for agent-loop feature development.

  ## Goals / Non-Goals
  **Goals:**
  - agent-loop has an `openspec/` directory following vault conventions
  - Architecture overview spec exists as the formal OpenSpec entry point
  - Future features (starting with cross-platform shell) follow proposal→design→specs→tasks→implement

  **Non-Goals:**
  - Per-module deep-dive specs (CONTEXT.md remains source of truth)
  - Modifying CONTEXT.md or any source code
  - GitHub/npm publishing

  ## Decisions
  1. **CONTEXT.md as source of truth** — Arch spec references CONTEXT.md rather than duplicating it. Keeps one detailed truth.
  2. **Lightweight overview** — One consolidated spec, not per-module. Avoids creating 9 spec files that duplicate CONTEXT.md.
  3. **Vault convention alignment** — Same proposal/design/tasks/specs format as existing changes.

  ## Risks / Trade-offs
  | Risk | Mitigation |
  |------|-----------|
  | Arch spec drifts from CONTEXT.md | Spec explicitly references CONTEXT.md as living document |
  | OpenSpec workflow unused after setup | Cross-platform shell change is the immediate follow-through |
  ```

  **Must NOT do**:
  - Don't write more than 300 words per artifact
  - Don't fabricate content that doesn't match actual architecture
  - Don't create per-module specs

  **Recommended Agent Profile**: `writing`
  **Parallelization**: Wave 1, can run in parallel with tasks 1, 3

  **Acceptance Criteria**:
  - [ ] `Test-Path openspec/changes/openspec-integration/proposal.md` → `True`
  - [ ] `Test-Path openspec/changes/openspec-integration/design.md` → `True`
  - [ ] Proposal covers: Why, What Changes, Capabilities, Impact
  - [ ] Design covers: Context, Goals/Non-Goals, Decisions, Risks

  **Evidence to Capture**:
  - [ ] Read both files and confirm structure matches vault convention
  - [ ] Compare with `openspec/changes/migrate-opencode-windows-native/` for format compliance

  **Commit**: NO (groups with tasks 1, 3)

- [ ] 3. Write architecture overview spec

  **What to do**:
  Create `openspec/changes/openspec-integration/specs/architecture/spec.md`:

  A single consolidated spec covering the entire agent-loop architecture. Follow vault Gherkin-style format. Keep it lightweight — ~100 lines max.

  Structure:
  ```markdown
  # Architecture Overview

  ## Agent Loop Orchestrator

  > The orchestrator runs user-defined phases through a 4-state machine, persists state to disk, enforces safety, and optionally integrates with MCP tools, plugins, and agentmemory.

  ## Modules

  ### State Machine
  - **File**: `src/state-machine.ts`
  - **Contract**: 4 states (init→run→verify→done), 6 events, flat TRANSITIONS lookup
  - **Verification**: `bun test __tests__/state-machine.test.ts`
  - **Detail**: See `CONTEXT.md#state-machine`

  ### Persistence
  - **File**: `src/state.ts`
  - **Contract**: Dual-file write (STATE.md + state.json) after every transition
  - **Verification**: `bun test __tests__/state.test.ts`
  - **Detail**: See `CONTEXT.md#state-persistence`

  (Repeat pattern for each module: safety, CLI/loop, MCP, plugins, API, agentmemory, evaluation)
  ```

  Modules to document (one paragraph each, reference CONTEXT.md):
  1. State Machine — 4 states, 6 events, flat lookup
  2. Persistence — dual-file (STATE.md + state.json), custom YAML
  3. Safety — per-phase timeout, max iterations guard, SIGINT handler
  4. CLI/Entry — loop.ts arg parsing, task registry, phase resolution
  5. MCP Execution — src/mcp.ts, MCP tool dispatch
  6. Plugin System — lifecycle hooks, dynamic import
  7. API Server — HTTP/WS, Bun.serve
  8. Agentmemory — HTTP transport, episodic save, lesson, health pulse, session archive
  9. Evaluation — semantic phase evaluation
  10. Config — default config, CLI overrides

  **Must NOT do**:
  - Don't copy-paste CONTEXT.md content — use references
  - Don't create per-module spec files (one consolidated spec only)
  - Don't write Gherkin scenarios for existing behavior (no "should" assertions for already-shipped code)

  **Recommended Agent Profile**: `writing`
  **Parallelization**: Wave 1, can run in parallel with tasks 1, 2

  **Acceptance Criteria**:
  - [ ] `Test-Path openspec/changes/openspec-integration/specs/architecture/spec.md` → `True`
  - [ ] All 10 modules documented with file path, contract summary, test command, CONTEXT.md reference
  - [ ] No per-module spec files exist

  **Evidence to Capture**:
  - [ ] Read spec and verify all 10 modules covered
  - [ ] Count lines: should be ~100 max

  **Commit**: YES (with 1, 2)
  - Message: `docs(openspec): add project-level OpenSpec with architecture overview spec`
  - Files: `openspec/*`

- [ ] 4. Write cross-platform-shell proposal + design

  **What to do**:
  Create `openspec/changes/cross-platform-shell/proposal.md`:
  ```markdown
  ## Why
  agent-loop's shell executor is hardcoded to Windows: `Bun.spawn(['cmd.exe', '/c', command])`. This fails on Unix/Mac. Cross-platform shell support is the most common blocker for running agent-loop outside Windows, and the highest-value first feature to spec and implement.

  ## What Changes
  - Add `src/shell.ts` with OS detection and unified shell command builder
  - Update `loop.ts` to use the new shell abstraction
  - Add tests for shell detection and command building

  ## Capabilities
  ### New Capabilities
  - `cross-platform-shell`: Unified shell execution that auto-selects `cmd.exe` (Windows) or `sh -c` (Unix/Mac)

  ### Modified Capabilities
  - `CLI/Entry`: loop.ts shell invocation is abstracted through `src/shell.ts`

  ## Impact
  - `src/shell.ts` — new file
  - `loop.ts` — updated to import and use shell abstraction
  - `__tests__/shell.test.ts` — new test file
  ```

  Create `openspec/changes/cross-platform-shell/design.md`:
  ```markdown
  ## Context
  agent-loop currently uses `Bun.spawn(['cmd.exe', '/c', command])` in `loop.ts:executeShellCommand`. This is the only shell invocation point in the codebase. Bun runs on Windows, macOS, and Linux. `process.platform` is available without dependencies.

  ## Goals / Non-Goals
  **Goals:**
  - agent-loop runs on Windows via `cmd.exe /c`
  - agent-loop runs on Unix/Mac via `sh -c`
  - OS detection is explicit, automatic, and testable
  - All 147+ existing tests pass unchanged

  **Non-Goals:**
  - Supporting exotic shells (fish, tcsh, powershell without cmd.exe)
  - Configurable shell override via CLI flags
  - Supporting different shell for each phase
  - Modifying daemon mode or plugin system

  ## Decisions
  1. **`process.platform` for OS detection** — Zero deps, Bun-native, reliable. `process.platform === 'win32'` → `cmd.exe`, else → `sh`.
  2. **Separate `src/shell.ts` module** — Single responsibility, testable in isolation, importable by both loop.ts and tests.
  3. **Same `-c` flag pattern** — Both `cmd.exe /c` and `sh -c` use the same "run command then exit" semantics.
  4. **TDD** — Write shell detection tests before implementation.

  ## Risks / Trade-offs
  | Risk | Mitigation |
  |------|-----------|
  | WSL's `process.platform` returns `linux` but `cmd.exe` exists | WSL uses `sh` by default — correct behavior |
  | Cross-platform CI can't verify both platforms in one run | Test detects platform at runtime; platform-conditional assertions |
  | `sh` is not `bash` — POSIX vs bash syntax | Demo task uses `echo` — POSIX-safe. Document that phase commands must be POSIX-compatible for cross-platform use |
  ```

  **Must NOT do**:
  - Don't implement yet — this is planning only
  - Don't add shell config options to CLI

  **Recommended Agent Profile**: `writing`
  **Parallelization**: Wave 2, blocked by task 1 (openspec/ exists)

  **Acceptance Criteria**:
  - [ ] `Test-Path openspec/changes/cross-platform-shell/proposal.md` → `True`
  - [ ] `Test-Path openspec/changes/cross-platform-shell/design.md` → `True`

  **Evidence to Capture**:
  - [ ] Read both files and confirm format matches vault convention

  **Commit**: NO (groups with tasks 6-9)

- [ ] 5. Write cross-platform specs + tasks

  **What to do**:
  Create `openspec/changes/cross-platform-shell/specs/shell-abstraction/spec.md`:
  ```markdown
  # Shell Abstraction

  ## Build Shell Command

  > The system auto-detects the operating system and selects the appropriate shell executor.

  ### Scenario: Windows shell
  WHEN `process.platform === 'win32'`
  THEN `buildCommand('echo hello')` returns `['cmd.exe', '/c', 'echo hello']`

  ### Scenario: Unix/Mac shell
  WHEN `process.platform !== 'win32'`
  THEN `buildCommand('echo hello')` returns `['sh', '-c', 'echo hello']`

  ### Scenario: Empty command
  WHEN command is empty string
  THEN `buildCommand('')` returns `['cmd.exe', '/c', '']` on Windows, `['sh', '-c', '']` on Unix

  ## OS Detection

  ### Scenario: Windows detection
  WHEN running on Windows
  THEN `isWindows()` returns `true`

  ### Scenario: Non-Windows detection
  WHEN running on macOS or Linux
  THEN `isWindows()` returns `false`
  ```

  Create `openspec/changes/cross-platform-shell/tasks.md`:
  ```markdown
  ## 1. Shell Abstraction Module

  - [ ] 1.1 Create `src/shell.ts` with `isWindows()`, `buildShellArgs()`, `buildCommand()` exports
  - [ ] 1.2 Create `__tests__/shell.test.ts` with platform-specific tests

  ## 2. Loop Integration

  - [ ] 2.1 Update `loop.ts`: import `buildCommand`, replace `['cmd.exe', '/c', command]` with `buildCommand(command)`
  - [ ] 2.2 Update existing tests if shell invocation assertions exist
  - [ ] 2.3 Run full test suite: `bun test`

  ## 3. Final Verification

  - [ ] 3.1 `bun test` — all tests pass
  - [ ] 3.2 `bun run loop.ts start --task demo` — runs on current platform
  ```

  Create `openspec/changes/cross-platform-shell/.openspec.yaml`:
  ```yaml
  created: 2026-07-04
  status: open
  type: feature
  ```

  **Must NOT do**:
  - Don't implement — planning only
  - Don't write specs for other features

  **Recommended Agent Profile**: `writing`
  **Parallelization**: Wave 2, blocked by task 4

  **Acceptance Criteria**:
  - [ ] `Test-Path openspec/changes/cross-platform-shell/specs/shell-abstraction/spec.md` → `True`
  - [ ] `Test-Path openspec/changes/cross-platform-shell/tasks.md` → `True`
  - [ ] `Test-Path openspec/changes/cross-platform-shell/.openspec.yaml` → `True`
  - [ ] Spec covers: Windows shell, Unix/Mac shell, empty command edge case

  **Evidence to Capture**:
  - [ ] Read spec and confirm Gherkin coverage
  - [ ] Read tasks and confirm implementable checkboxes

  **Commit**: NO (groups with tasks 6-9)

- [ ] 6. Create src/shell.ts — OS detection + shell abstraction (TDD)

  **What to do**:
  - **RED**: Write `__tests__/shell.test.ts` with failing tests first
  - **GREEN**: Create `src/shell.ts` with:

    ```typescript
    export function isWindows(): boolean {
      return process.platform === 'win32';
    }

    export function buildShellArgs(command: string): string[] {
      return isWindows()
        ? ['cmd.exe', '/c', command]
        : ['sh', '-c', command];
    }

    export function buildCommand(command: string): string[] {
      return buildShellArgs(command);
    }
    ```

  - **REFACTOR**: Clean exports, no dead code

  **Tests (TDD)**:
  ```typescript
  describe('buildShellArgs', () => {
    it('returns cmd.exe args on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(buildShellArgs('echo hi')).toEqual(['cmd.exe', '/c', 'echo hi']);
    });
    it('returns sh args on non-Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(buildShellArgs('echo hi')).toEqual(['sh', '-c', 'echo hi']);
    });
    it('handles empty command', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(buildShellArgs('')).toEqual(['cmd.exe', '/c', '']);
    });
  });

  describe('isWindows', () => {
    it('returns true for win32', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      expect(isWindows()).toBe(true);
    });
    it('returns false for darwin', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      expect(isWindows()).toBe(false);
    });
    it('returns false for linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
      expect(isWindows()).toBe(false);
    });
  });
  ```

  **Must NOT do**:
  - Don't add shell config or CLI flags
  - Don't modify `process.platform` permanently — restore after each test

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 3, blocked by tasks 4, 5

  **References**:
  - `loop.ts:174-213` — `executeShellCommand`, needs the new abstraction
  - `loop.ts:183` — current: `Bun.spawn(['cmd.exe', '/c', command], ...)`

  **Acceptance Criteria**:
  - TDD: RED (tests fail) → GREEN (tests pass) → REFACTOR
  - [ ] `bun test __tests__/shell.test.ts` → all 6 tests pass

  **Evidence to Capture**:
  - [ ] RED phase output
  - [ ] GREEN phase output

  **Commit**: YES (groups with task 7)
  - Message: `feat(shell): add cross-platform shell abstraction with OS detection`
  - Files: `src/shell.ts`, `__tests__/shell.test.ts`
  - Pre-commit: `bun test __tests__/shell.test.ts`

- [ ] 7. Update loop.ts — use unified shell executor

  **What to do**:
  - Import: `import { buildCommand } from './src/shell.js';`
  - In `executeShellCommand()`, replace:
    ```typescript
    const proc = Bun.spawn(['cmd.exe', '/c', command], {
    ```
    With:
    ```typescript
    const proc = Bun.spawn(buildCommand(command), {
    ```
  - Verify no other hardcoded `cmd.exe` references in `loop.ts`
  - Run `bun test` — all existing tests must pass

  **Must NOT do**:
  - Don't change `executeShellCommand` signature
  - Don't modify phase execution logic

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 3, blocked by task 6

  **References**:
  - `loop.ts:174-213` — `executeShellCommand`, the only shell invocation
  - `src/shell.ts` — `buildCommand()` to import

  **Acceptance Criteria**:
  - [ ] `bun test` → all tests pass
  - [ ] `grep "cmd.exe" loop.ts` → zero matches
  - [ ] `bun run loop.ts start --task demo` → runs successfully

  **Evidence to Capture**:
  - [ ] grep output
  - [ ] `bun test` output

  **Commit**: YES (groups with task 6)
  - Message: `refactor(loop): use buildCommand from shell.ts instead of hardcoded cmd.exe`
  - Files: `loop.ts`
  - Pre-commit: `bun test`

- [ ] 8. Verify daemon mode shares same shell path

  **What to do**:
  - Trace: `runDaemon()` → phase loop → `executeShellCommand(phase.command, phase.timeoutMs)` → `buildCommand(command)`
  - Since `executeShellCommand` is **shared** between `runLoop()` and `runDaemon()`, fixing it in task 7 already covers daemon mode
  - Confirm by reading the call site in daemon mode

  **Must NOT do**:
  - Don't modify daemon logic

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 4, blocked by task 7

  **Acceptance Criteria**:
  - [ ] Code trace confirms single shell invocation path
  - [ ] `bun test` → all tests pass including daemon tests

  **Evidence to Capture**:
  - [ ] Trace showing shared `executeShellCommand` function

  **Commit**: NO (covered by task 7)

- [ ] 9. Complete cross-platform change artifacts

  **What to do**:
  - Update `openspec/changes/cross-platform-shell/tasks.md` — mark impl tasks as `[x]`:
    ```markdown
    ## 1. Shell Abstraction Module
    - [x] 1.1 Create `src/shell.ts` ...
    - [x] 1.2 Create `__tests__/shell.test.ts` ...

    ## 2. Loop Integration
    - [x] 2.1 Update `loop.ts` ...
    - [x] 2.2 Update existing tests ...
    - [x] 2.3 Run full test suite: `bun test`

    ## 3. Final Verification
    - [ ] 3.1 `bun test` — all tests pass
    - [ ] 3.2 `bun run loop.ts start --task demo` — runs on current platform
    ```
  - Update `.openspec.yaml` status

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 4, blocked by tasks 6-8

  **Acceptance Criteria**:
  - [ ] tasks.md reflects completed checkboxes

  **Evidence to Capture**:
  - [ ] Read tasks.md

  **Commit**: NO (covered by tasks 6-7)

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present results to user for explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. Verify: all "Must Have" implemented (arch spec written, cross-platform shell built, tests passing). All "Must NOT Have" absent (no per-module specs, no CONTEXT.md edits, no other feature work). Evidence files exist in .omo/evidence/.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality + Regression** — `unspecified-high`
  Run `bun test` (all pass). Run `tsc --noEmit`. Check changed files: shell.ts, loop.ts, shell.test.ts. No `as any`, no `@ts-ignore`, no empty catches, no dead code. Verify `process.platform` mock properly restored in tests.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Cross-Platform End-to-End QA** — `unspecified-high`
  Run on current platform: `bun run loop.ts start --task demo`. Verify phases execute with correct shell. Run `bun test` — all pass. If on Windows: verify `buildCommand` returns `cmd.exe /c`. If on Unix: verify `sh -c`.
  Output: `Scenarios [N/N pass] | VERDICT`

- [ ] F4. **OpenSpec Completeness Check** — `deep`
  Verify every file listed in the plan exists. For each spec: confirm structure matches vault convention (proposal has Why/What/Capabilities/Impact, design has Context/Goals/Decisions/Risks, tasks has checkboxes). Check cross-platform spec scenarios are implementable. No loose files outside change directories.
  Output: `Changes [N/N complete] | Specs [N/N valid] | Format [PASS/FAIL] | VERDICT`

---

## Commit Strategy

- **1**: `docs(openspec): add project-level OpenSpec with architecture overview spec`
  Files: `openspec/config.yaml`, `openspec/changes/openspec-integration/*`
- **2**: `feat(shell): add cross-platform shell abstraction with OS detection`
  Files: `src/shell.ts`, `__tests__/shell.test.ts`
- **3**: `refactor(loop): use buildCommand from shell.ts instead of hardcoded cmd.exe`
  Files: `loop.ts`
- **FINAL**: All commits applied after F1-F4 approve, user confirms ok

---

## Success Criteria

### Verification Commands
```bash
bun test                                           # All tests pass (147 + new)
bun run loop.ts start --task demo                  # Runs on current platform
grep "cmd.exe" loop.ts                             # Zero matches
Test-Path openspec/config.yaml                     # True
Test-Path openspec/changes/openspec-integration/proposal.md   # True
Test-Path openspec/changes/cross-platform-shell/tasks.md      # True
Test-Path openspec/changes/cross-platform-shell/specs/shell-abstraction/spec.md  # True
```

### Final Checklist
- [ ] openspec/ directory with config.yaml
- [ ] openspec-integration change complete (proposal, design, arch spec, tasks, .openspec.yaml)
- [ ] cross-platform-shell change complete (proposal, design, specs, tasks, .openspec.yaml)
- [ ] src/shell.ts with isWindows(), buildShellArgs(), buildCommand()
- [ ] loop.ts uses buildCommand() instead of hardcoded cmd.exe
- [ ] __tests__/shell.test.ts with 6+ tests
- [ ] All existing tests pass unchanged
- [ ] demo task runs on current platform

