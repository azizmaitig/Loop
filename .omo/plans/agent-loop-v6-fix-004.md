# agent-loop-v6-fix-004 - Work Plan

## TL;DR (For humans)
<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
<!-- Plain English for a non-engineer: NO file paths, NO todo numbers, NO wave/agent/tool names. -->

**What you'll get:** 3 spec bugs in ISSUE-004 fixed — unknown child IDs return 404 (not 400), trigger-fired tasks actually run instead of silently failing, and the orchestrator tells you whether a child was started, not found, or already running.

**Why this approach:** Minimal diff — 3 files changed, no new dependencies, no architectural changes. Each fix is the smallest thing that makes the spec pass.

**What it will NOT do:** Refactor the shotgun-surgery or custom-YAML-parser code review findings — those are standards calls, not spec violations. No new endpoints. No changes to triggers, task queue, history, or loop.ts CLI.

**Effort:** Short
**Risk:** Low - 2 files changed, existing tests cover all edge cases
**Decisions to sanity-check:** 409 Conflict vs 400 for "already running" status. Subprocess overhead from `bun run loop.ts` for trigger-fired tasks (acceptable until measured).

Your next move: **Approve** this plan. Full execution detail follows below.

---

> TL;DR (machine): Short, Low risk — fix 3 spec bugs in ISSUE-004 across 2 source files + types + tests

## Scope
### Must have
- Bug 1: POST /loops/:id/start and /loops/:id/stop return 404 for unknown child ID (spec compliance)
- Bug 2: Trigger-fired tasks enqueue a working command instead of dead `run-plan`
- Bug 3: startChild/stopChild return distinguishable errors for "not found" vs "already running/not running"
- Types.ts: Add StartChildResult, StopChildResult union types
- Update all existing tests to match new return types + HTTP status codes

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No changes to triggers.ts, task-queue.ts, history.ts, plan-executor.ts, loop.ts, plugins.ts, api.ts, state-machine.ts
- No new endpoints or API surface
- No architectural refactoring of the custom YAML parser or route registration patterns
- No fixing --cron/--watch-dir scope creep (harmless)
- No changing the daemon.ts executeTask mechanism
- No adding new dependencies (npm or otherwise)

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after existing passing tests + new assertions for error paths
- Framework: bun:test
- Evidence: `bun test` output showing all 249+ tests pass

## Execution strategy
### Parallel execution waves
Wave 1: Fix bug 3 + bug 1 (coupled — bug 1 depends on bug 3's distinguishable errors)
Wave 2: Fix bug 2 (independent — can parallelize with Wave 1 in execution)
Wave 3: Final verification (blocked on both)

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. Fix collapsed errors + HTTP codes | none | 3 | 2 |
| 2. Fix dead run-plan command | none | 3 | 1 |
| 3. Final verification | 1, 2 | none | - |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->

### Wave 1 — Fix Bug 3 (collapsed errors) + Bug 1 (400→404)

- [ ] 1. Fix startChild/stopChild return types + update daemon.ts routes + update types.ts
  What to do: Change `startChild(id): Promise<boolean>` → `Promise<StartChildResult>` and `stopChild(id): Promise<boolean>` → `Promise<StopChildResult>`. Add union type aliases to types.ts. Update daemon.ts route handlers to return 404 for 'not_found', 409 for 'already_running'/'not_running'. Update orchestrator.ts internal callers (deregisterChildTriggers does not call stopChild, so no cascade).
  Parallelization: Wave 1 | Blocked by: none | Blocks: 2,3
  References:
  - src/orchestrator.ts:74-101 (startChild + stopChild bodies)
  - src/daemon.ts:148-166 (route handlers that consume results)
  - src/types.ts (add StartChildResult, StopChildResult type aliases)
  Acceptance criteria:
  - `bun test __tests__/orchestrator.test.ts` passes
  - POST /loops/nonexistent/start → 404 (not 400)
  - POST /loops/nonexistent/stop → 404 (not 400)
  - POST /loops/{id}/start twice → second returns 409
  - POST /loops/{id}/stop on already-stopped → returns 409
  QA scenarios: Run `bun test` — expect 249+ tests pass (3 existing tests updated). Manually start daemon and curl test the 4 endpoint combinations.
  Commit: Y | fix(agent-loop-v6): distinguishable error states for startChild/stopChild + correct HTTP codes

### Wave 2 — Fix Bug 2 (dead run-plan command)

- [ ] 2. Fix run-plan shell command in orchestrator.ts
  What to do: Change `run-plan ${child.planPath}` to `bun run loop.ts start --plan "${child.planPath}" --max-iterations 1` at both locations (orchestrator.ts:86 and :138). Add ponytail comment noting subprocess overhead.
  Must NOT do: Do not modify triggers.ts, task-queue.ts, or daemon.ts executeTask. Do not add any new imports.
  Parallelization: Wave 2 | Blocked by: none (independent of Wave 1) | Blocks: none
  References:
  - src/orchestrator.ts:86 — `run-plan ${child.planPath}` in startChild initial enqueue
  - src/orchestrator.ts:138 — `run-plan ${child.planPath}` in trigger onFire callback
  - loop.ts supports `start --plan <path>` via plan-executor plugin (loop.ts:723-726)
  - daemon.ts:245 — executeTask spawns `cmd.exe /c <command>` — confirms shell command expectation
  Acceptance criteria:
  - `bun test` passes (no test changes needed — trigger tests use mock task queue, not actual execution)
  - No reference to `run-plan` remains in orchestrator.ts
  - `cmd.exe /c "bun run loop.ts start --plan "./plan.yaml" --max-iterations 1"` is a valid command
  QA scenarios: Run `bun test` — expect 249+ tests pass. Verify with grep that `run-plan` no longer appears in orchestrator.ts.
  Commit: Y | fix(agent-loop-v6): replace dead run-plan command with working bun subprocess

### Wave 3 — Final verification

- [ ] 3. Final verification: full test suite + drift check
  What to do: Run `bun test` (expect all pass). Run `bun run src/index.ts` typecheck. Grep for remaining `run-plan` references. Verify the plan's Must NOT have list is respected (no changes to triggers.ts, task-queue.ts, history.ts, loop.ts).
  Parallelization: Wave 3 | Blocked by: 1, 2 | Blocks: none
  References: All files changed in this plan
  Acceptance criteria: All checks pass, no drift from scope boundaries
  QA scenarios: Automated in fix plan review
  Commit: N (verification only)

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Plan compliance audit
- [ ] F2. Code quality review
- [ ] F3. Real manual QA
- [ ] F4. Scope fidelity

## Commit strategy
- Commit 1: `fix(agent-loop-v6): distinguishable error states for startChild/stopChild + correct HTTP codes`
  (Types.ts + orchestrator.ts:74-101 + daemon.ts:148-166 + test updates)
- Commit 2: `fix(agent-loop-v6): replace dead run-plan command with working bun subprocess`
  (orchestrator.ts:86,138)

## Success criteria
- `bun test` passes (all 249+ tests, 0 failures)
- POST /loops/nonexistent/start → 404
- POST /loops/nonexistent/stop → 404
- POST /loops/{id}/start × 2 → second returns 409
- POST /loops/{id}/stop on stopped child → 409
- grep for `run-plan` in orchestrator.ts returns 0 matches
- No changes to triggers.ts, task-queue.ts, history.ts, loop.ts, plan-executor.ts
