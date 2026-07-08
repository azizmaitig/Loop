# agent-loop v4: Semantic Recall

## TL;DR

> **Quick Summary**: Fix v3's broken agentmemory HTTP routes and add pre-phase semantic recall — load past lessons from agentmemory before each phase execution, log context to console. Also fix `process.exit()` killing async memory writes.
>
> **Deliverables**:
> - Fixed HTTP routes in `agentmemory.ts` (3 endpoints corrected)
> - Pre-phase recall hook `recallBeforePhase()` in `memory-hooks.ts`
> - Wiring in `loop.ts`: console context log before each shell command
> - `await onLoopComplete` + SIGINT grace period for clean shutdown
> - TDD tests for all new behavior
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES — 2 waves
> **Critical Path**: Fix routes → add recall hook → wire in loop.ts → await fix → SIGINT

---

## Context

### Current State (v3)
- `agentmemory.ts` uses wrong REST paths: `POST /api/memory`, `POST /api/recall`, `POST /api/lesson` — all return 404
- `onLoopComplete` is fire-and-forget (`void`), but `process.exit(0)` on the next line kills async writes before they complete
- No pre-phase context loading — phases execute without knowledge of past lessons
- `--memory` CLI flag was just added (was missing from parseArgs)
- 143 tests passing across 11 files

### Target State (v4)
```
Loop start → load lessons → ┌─ Phase 1: [memory] Context: ... → execute phase
                             ├─ Phase 2: [memory] Context: ... → execute phase
                             └─ Phase N: [memory] Context: ... → execute phase
Loop complete → await onLoopComplete → episodic save + pulse + archive → exit
SIGINT → 2s grace → flush pending writes → exit
```

### Metis Review
**Identified Gaps** (addressed):
- Recall query scope: Task + phase name combined (e.g. "demo: scan")
- SIGINT: Interactive confirmation prompt ("Are you sure? y/N") with 10s timeout — never force-exit without consent
- Recall limit: 5 lessons max per phase
- Daemon mode: Out of scope (no memory hooks currently)
- v3 migration: No persisted lessons from v3 (wrong routes → silent null)

---

## Work Objectives

### Core Objective
Fix agentmemory HTTP routes and add pre-phase semantic recall that loads past lessons from agentmemory, logs them to console, and ensures clean shutdown.

### Concrete Deliverables
- `agentmemory.ts` — all 4 functions using correct `/agentmemory/*` paths
- `memory-hooks.ts` — new `logPhaseContext()` function for pre-phase recall
- `loop.ts` — pre-phase recall call + `await onLoopComplete` + SIGINT confirmation prompt
- `__tests__/agentmemory.test.ts` — updated mocks for correct routes
- `__tests__/memory-hooks.test.ts` — new tests for pre-phase recall

### Definition of Done
- [ ] `bun test` → all existing 143 tests pass + new tests pass
- [ ] `bun run loop.ts start --task demo --memory` shows `[memory] Context:` before each phase
- [ ] Archive file persists to `70-Memory/history/` after loop exit
- [ ] Ctrl+C prompts "Are you sure? (y/N)" with 10s timeout — no data loss

### Must Have
- Fix 4 URL paths in `agentmemory.ts`: saveEpisodic, recallLessons, saveLesson, pushPulse
- Add `logPhaseContext(phase, config)` — calls `recallLessons("{taskName}: {phaseName}")`, logs result to console
- Wire in `loop.ts` before `executeShellCommand` on each phase
- Change `void onLoopComplete` → `await onLoopComplete` in `runLoop()`
- SIGINT handler: interactive confirmation prompt ("Are you sure? y/N") with 10s timeout
- TDD: write failing test first, then implement

### Must NOT Have (Guardrails)
- No new CLI flags (`--memory` is the single flag)
- No new fields on `PhaseDef` or `LoopConfig`
- No transport change (keep raw HTTP per ADR-0001)
- No daemon mode changes
- No retry logic, caching, or response formatting
- No changes to state machine, safety, plugins, evaluate, API modules
- No changing exported function signatures in `agentmemory.ts`

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (bun test, agentmemory MCP tools)
- **Automated tests**: TDD (RED → GREEN → REFACTOR)
- **Framework**: bun test
- **Mocking**: global fetch override (agentmemory.test.ts) + mock.module (memory-hooks.test.ts)

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

```
Wave 1 (Foundation — 3 parallel):
├── 1. Verify agentmemory REST API response shapes (curl)
├── 2. Fix HTTP routes in agentmemory.ts (TDD)
├── 3. Fix process.exit race — await onLoopComplete + SIGINT grace period

Wave 2 (After Wave 1 — 2 parallel):
├── 4. Add pre-phase recall: logPhaseContext() in memory-hooks.ts (TDD)
├── 5. Wire recall into loop.ts phase loop

Wave FINAL (3 parallel reviews):
├── F1. Plan compliance audit (oracle)
├── F2. Code quality + regression test
├── F3. Real QA: --memory flag end-to-end
```

---

## TODOs

- [x] 1. Verify agentmemory REST API response shapes

  **What to do**:
  - Start agentmemory (`npx @agentmemory/agentmemory` or `agentmemory`)
  - Curl each endpoint to confirm response shape before writing code:
    - `POST /agentmemory/remember` — save episodic/pulse
    - `POST /agentmemory/lesson/recall` — search lessons (or `/agentmemory/lessons/search`)
    - `POST /agentmemory/lesson/save` — save lesson (or `POST /agentmemory/lessons`)
  - Document the exact request/response JSON schema for each

  **Must NOT do**:
  - Don't skip this — tests written against wrong shapes will pass with mocks but fail at runtime

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 1, can run in parallel with tasks 2, 3

  **QA Scenarios**:
  ```
  Scenario: Verify remember endpoint
    Tool: Bash (curl)
    Preconditions: agentmemory running on localhost:3111
    Steps:
      1. curl -s -o result.json -w "%{http_code}" http://localhost:3111/agentmemory/remember -X POST -H "Content-Type: application/json" -d '{"content":"test episodic","type":"episodic","project":"agent-loop-test"}'
      2. Assert: HTTP status 200 or 201
      3. Read result.json and record response shape
    Expected Result: Endpoint returns success with JSON body containing saved memory ID
    Evidence: .omo/evidence/task-1-remember-response.txt

  Scenario: Verify lesson recall endpoint
    Tool: Bash (curl)
    Preconditions: agentmemory running
    Steps:
      1. curl -s -o recall.json http://localhost:3111/agentmemory/lesson/recall -X POST -H "Content-Type: application/json" -d '{"query":"demo: scan","limit":5}'
      2. Record the JSON structure
    Expected Result: Returns JSON array or {results: [...]} shape
    Evidence: .omo/evidence/task-1-recall-response.txt
  ```

  **Evidence to Capture**:
  - [ ] Response shape for remember endpoint
  - [ ] Response shape for lesson recall endpoint
  - [ ] Response shape for lesson save endpoint

  **Commit**: NO (research task)

- [x] 2. Fix HTTP routes in agentmemory.ts (TDD)

  **What to do**:
  - **RED**: Update `__tests__/agentmemory.test.ts` — change mockFetch expectations from `/api/*` to `/agentmemory/*`
  - **GREEN**: Update `src/agentmemory.ts`:
    - `saveEpisodic`: POST `/api/memory` → POST `/agentmemory/remember`
    - `recallLessons`: POST `/api/recall` → POST `/agentmemory/lesson/recall` (adjust response path if shape differs)
    - `saveLesson`: POST `/api/lesson` → POST `/agentmemory/lesson/save`
    - `pushPulse`: POST `/api/memory` → POST `/agentmemory/remember` (keep `type: "pulse"`)
  - **REFACTOR**: Clean up any response parsing that assumed wrong shape
  - Verify: `bun test __tests__/agentmemory.test.ts` → all 27 pass

  **Must NOT do**:
  - Don't change function signatures — only URL paths and response field access
  - Don't refactor `agentmemoryFetch` helper

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 1, blocked by task 1 (response shapes)

  **QA Scenarios**:
  ```
  Scenario: Route fix — bun test passes
    Tool: Bash
    Preconditions: None
    Steps:
      1. bun test __tests__/agentmemory.test.ts 2>&1
    Expected Result: All 27 tests pass (updated URL assertions + response shape)
    Evidence: .omo/evidence/task-2-route-tests.txt
  ```

  **References**:
  - `src/agentmemory.ts:18-36` — `agentmemoryFetch` helper, only path strings change
  - `src/agentmemory.ts:58-78` — `saveEpisodic`: /api/memory → /agentmemory/remember
  - `src/agentmemory.ts:85-91` — `recallLessons`: /api/recall → /agentmemory/lesson/recall
  - `src/agentmemory.ts:164-167` — `saveLesson`: /api/lesson → /agentmemory/lesson/save
  - `src/agentmemory.ts:173-183` — `pushPulse`: /api/memory → /agentmemory/remember
  - `__tests__/agentmemory.test.ts` — mockFetch URL assertions + response shape mocks

  **Acceptance Criteria**:
  - TDD:
    - [ ] RED: Test file updated with new URL expectations, tests fail
    - [ ] GREEN: URL paths fixed in agentmemory.ts, all tests pass
    - [ ] REFACTOR: Clean, no commented code

  **Evidence to Capture**:
  - [ ] RED phase output (tests failing)
  - [ ] GREEN phase output (tests passing)
  - [ ] Route verification: grep agentmemory.ts for `/api/` — zero matches

  **Commit**: YES
  - Message: `fix(agentmemory): correct REST API routes — /api/* → /agentmemory/*`
  - Files: `src/agentmemory.ts`, `__tests__/agentmemory.test.ts`
  - Pre-commit: `bun test __tests__/agentmemory.test.ts`

- [x] 3. Fix process.exit race — await onLoopComplete + SIGINT confirmation

  **What to do**:
  - In `loop.ts` `runLoop()`:
    - Change `void onLoopComplete(state, config).catch(() => {})` (line 432) to `await onLoopComplete(state, config).catch(() => {})`
  - In `loop.ts` SIGINT handler (line 570-578):
    - Instead of immediate `process.exit(1)`, print: `[agent-loop] Are you sure you want to exit? (y/N)`
    - Set up stdin listener for single keypress: if 'y' or 'Y', call `process.exit(1)`
    - Add 10s timeout: `setTimeout(() => { /* continue loop */ }, 10000).unref()`
    - If 'n' or 'N' or timeout: print `[agent-loop] Continuing...` and resume (do NOT exit)
    - Store the resolve function so the loop knows to skip iteration cleanup
  - Update `__tests__/memory-hooks.test.ts` if needed (mock expectations may change with await)
  - Add test: `daemon.test.ts` style — verify `await` keyword is present at the hook call site

  **Must NOT do**:
  - Don't add retry logic
  - Don't modify `memory-hooks.ts` signatures
  - Don't exit automatically — always require explicit 'y' confirmation

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 1 (depends on nothing — independent change)

  **QA Scenarios**:
  ```
  Scenario: Verify await keyword present
    Tool: Bash (grep)
    Steps:
      1. grep -n "await onLoopComplete" loop.ts
    Expected Result: await onLoopComplete found
    Evidence: .omo/evidence/task-3-await-site.txt
  ```

  **References**:
  - `loop.ts:432` — current: `void onLoopComplete(...).catch(() => {})`
  - `loop.ts:570-578` — current SIGINT handler (immediate exit)

  **Acceptance Criteria**:
  - TDD:
    - [ ] RED: Test asserts `await onLoopComplete` is present, no match found
    - [ ] GREEN: `await` replaces `void`, confirmation prompt + 10s timeout added
  - [ ] `bun test` → 143+ tests pass

  **Commit**: YES
  - Message: `fix(loop): await onLoopComplete before exit, add interactive SIGINT confirmation`
  - Files: `loop.ts`
  - Pre-commit: `bun test`

- [x] 4. Add pre-phase recall: logPhaseContext() (TDD)

  **What to do**:
  - In `src/memory-hooks.ts`, add exported async function:
    ```typescript
    export async function logPhaseContext(
      phase: PhaseDef,
      config: LoopConfig,
    ): Promise<void> {
      if (!config.memory?.enabled) return;
      const query = `${config.taskName}: ${phase.name}`;
      void recallLessons(query).then((lessons) => {
        if (lessons && lessons.length > 0) {
          const top = lessons.slice(0, 5);
          for (const l of top) {
            const content = (l as Record<string, unknown>)?.content ?? '';
            console.log(`[memory] Context: ${String(content).slice(0, 200)}`);
          }
        } else {
          console.log(`[memory] No context available for "${query}"`);
        }
      }).catch(() => {});
    }
    ```
  - Fire-and-forget: `void` prefix, errors swallowed
  - **RED**: Write tests in `__tests__/memory-hooks.test.ts` using `mock.module` pattern (mock `recallLessons`):
    - `logPhaseContext` with `memory.enabled: false` → no console output
    - `logPhaseContext` with lessons returned → `[memory] Context:` logged for each
    - `logPhaseContext` with empty lessons → `[memory] No context available` logged
    - `logPhaseContext` with `recallLessons` throwing → no crash, no output
  - **GREEN**: Implement `logPhaseContext`
  - **REFACTOR**: Ensure no duplicate code with existing `onPhaseFailed` (they share `recallLessons`)

  **Must NOT do**:
  - Don't make it blocking — must be fire-and-forget
  - Don't add formatting libraries — plain `console.log` with `[memory]` prefix
  - Don't store recalled context on `LoopState` — console-only

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 2, blocked by task 1 (know response shape)

  **QA Scenarios**:
  ```
  Scenario: TDD cycle for logPhaseContext
    Tool: Bash
    Steps:
      1. bun test __tests__/memory-hooks.test.ts 2>&1
    Expected Result: All new recall tests pass, existing tests still pass
    Evidence: .omo/evidence/task-4-recall-tests.txt
  ```

  **References**:
  - `src/memory-hooks.ts:96-118` — `onPhaseFailed` pattern (fire-and-forget IIFE, recallLessons call)
  - `__tests__/memory-hooks.test.ts` — existing mock.module pattern for agentmemory
  - `src/agentmemory.ts:85-91` — `recallLessons` function signature

  **Acceptance Criteria**:
  - TDD:
    - [ ] RED: Tests for logPhaseContext written, fail (function doesn't exist)
    - [ ] GREEN: logPhaseContext implemented, tests pass
  - [ ] `bun test __tests__/memory-hooks.test.ts` → all tests pass

  **Commit**: YES (groups with task 5)
  - Message: `feat(memory-hooks): add logPhaseContext for pre-phase semantic recall`
  - Files: `src/memory-hooks.ts`, `__tests__/memory-hooks.test.ts`

- [x] 5. Wire recall into loop.ts phase loop

  **What to do**:
  - Import `logPhaseContext` in `loop.ts`
  - In `runLoop()` phase loop, before `executeShellCommand` (line 354), add:
    ```typescript
    void logPhaseContext(phase, config).catch(() => {});
    ```
  - In `runDaemon()` phase loop, same position (line 509), add the same call
  - Ensure it fires AFTER plugin hooks but BEFORE shell command execution
  - Verify: `bun run loop.ts start --task demo --memory` shows `[memory] Context:` lines

  **Must NOT do**:
  - Don't await it — must be fire-and-forget so it doesn't delay phase execution
  - Don't add to SIGINT path

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 2, blocked by task 4

  **QA Scenarios**:
  ```
  Scenario: Live demo run with --memory
    Tool: Bash
    Preconditions: agentmemory running
    Steps:
      1. bun run loop.ts start --task demo --memory 2>&1
      2. grep for "[memory] Context:" or "[memory] No context available"
    Expected Result: Each phase shows a [memory] line before execution
    Evidence: .omo/evidence/task-5-live-run.txt

  Scenario: Without --memory, no recall output
    Tool: Bash
    Steps:
      1. bun run loop.ts start --task demo 2>&1
      2. grep for "[memory]" (should be empty)
    Expected Result: No [memory] output without the flag
    Evidence: .omo/evidence/task-5-no-memory.txt
  ```

  **References**:
  - `loop.ts:346-395` — phase execution loop, insert after line 351 (plugin onPhaseStart), before line 354 (executeShellCommand)
  - `loop.ts:391` — existing `onPhaseFailed` call pattern (fire-and-forget, same style)

  **Acceptance Criteria**:
  - [ ] `bun test` → all tests pass
  - [ ] Live demo with `--memory` shows per-phase context lines
  - [ ] Live demo without `--memory` shows no memory output

  **Commit**: YES (groups with task 4)
  - Message: `feat(loop): wire logPhaseContext into phase execution loop`
  - Files: `loop.ts`
  - Pre-commit: `bun test`

---

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle` **APPROVED**
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality + Regression** — `unspecified-high` **APPROVED**
  Run `bun test` + `tsc --noEmit`. Check all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod (expected for memory context), duplicate code.
  Output: `Build [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real QA: --memory end-to-end** — `unspecified-high` **APPROVED**
  Start from clean state. Run `bun run loop.ts start --task demo --memory`. Verify: per-phase `[memory] Context:` lines appear, health score logged, archive file persists to `70-Memory/history/`. Run without `--memory`: verify no `[memory]` output. Test SIGINT: Ctrl+C, verify "Are you sure? (y/N)" prompt appears, 'n' continues, Ctrl+C again + 'y' exits.
  Output: `Scenarios [N/N pass] | VERDICT`

---

## Commit Strategy

- **1**: `fix(agentmemory): correct REST API routes — /api/* → /agentmemory/*`
- **2**: `fix(loop): await onLoopComplete before exit, add interactive SIGINT confirmation`
- **3**: `feat(memory-hooks): add logPhaseContext for pre-phase semantic recall`
- **4**: `feat(loop): wire logPhaseContext into phase execution loop`
- **FINAL**: All commits squash-merged after F1-F3 approve

---

## Success Criteria

### Verification Commands
```bash
bun test                              # All tests pass (143 + new)
bun run loop.ts start --task demo     # No [memory] output (--memory not passed)
bun run loop.ts start --task demo --memory  # [memory] Context: lines appear
```

### Final Checklist
- [ ] All "Must Have" present (routes fixed, recall wired, await fixed, SIGINT grace)
- [ ] All "Must NOT Have" absent (no new flags, no transport change, no daemon changes)
- [ ] All tests pass
- [ ] Archive file written to `70-Memory/history/` before process exit
