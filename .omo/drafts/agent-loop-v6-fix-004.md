---
slug: agent-loop-v6-fix-004
status: approved
intent: clear
pending-action: ready for execution — use /start-work
approach: Fix 3 spec bugs in ISSUE-004: (1) 400→404 for unknown child IDs, (2) dead run-plan shell command, (3) collapsed error states in startChild/stopChild
---

# Draft: agent-loop-v6-fix-004

## Components (topology ledger)
| id | outcome | status | evidence |
|----|---------|--------|----------|
| orchestrator.ts startChild/stopChild | Return discriminated results instead of bool | active | src/orchestrator.ts:74-101 |
| daemon.ts route handlers | Distinguish 404 vs 409 based on orchestrator result | active | src/daemon.ts:148-166 |
| orchestrator.ts run-plan enqueue | Replace dead command with valid `bun run loop.ts` command | active | src/orchestrator.ts:86,138 |
| orchestrator.test.ts | Update tests for new return types + HTTP codes | active | __tests__/orchestrator.test.ts:328-404 |

## Open assumptions (announced defaults)
| assumption | default | rationale | reversible? |
|-----------|---------|-----------|-------------|
| Subprocess overhead of `bun run loop.ts` per trigger fire | Accept for now | Dead command is worse than heavy command; optimize with in-process execution later | Yes — trivial to swap command string later |
| 409 Conflict for "already running" / "not running" | Return 409 | Semantically correct HTTP status for state conflict, not client error (400) | Yes — HTTP status is an API contract decision |

## Findings (cited - path:lines)

### Bug 1 — 400→404 for unknown child ID
- daemon.ts:151-153 — `startChild` returns `false`, handler sends 400
- daemon.ts:161-163 — `stopChild` returns `false`, handler sends 400
- Spec says: "Invalid child ID → 404"
- Test at orchestrator.test.ts:391-404 confirms 400 behavior (wrong)

### Bug 2 — Dead run-plan shell command
- orchestrator.ts:86 — `const enqueueCmd = child.planPath ? `run-plan ${child.planPath}` : child.name;`
- orchestrator.ts:138 — `this.taskQueue.enqueue(`run-plan ${child.planPath}`, { timeoutMs: 60000 });`
- daemon.ts:245 — ExecuteTask spawns `cmd.exe /c "run-plan ./plan.yaml"` — no such executable exists
- Task will always fail silently (spawn returns non-zero exit code)

### Bug 3 — Collapsed error states
- orchestrator.ts:74-91 — `startChild` returns `false` for BOTH not-found and already-running
- orchestrator.ts:93-101 — `stopChild` returns `false` for BOTH not-found and not-running
- Callers in daemon.ts can't distinguish → can't return correct HTTP status
- Tests at orchestrator.test.ts:86-96 and 108-117 only test `false` return, don't differentiate

## Decisions (with rationale)

### D1 — Return type for startChild/stopChild
Change from `Promise<boolean>` to `Promise<StartChildResult | StopChildResult>` using string union.
**Rationale**: String union is the simplest change that preserves the calling convention while adding distinguishability. No new classes, no discriminated union objects, no exceptions.
`StartChildResult = 'started' | 'not_found' | 'already_running'`
`StopChildResult = 'stopped' | 'not_found' | 'not_running'`

### D2 — HTTP status for state conflicts
Use 409 Conflict for "already running" and "not running" (stop on stopped child).
**Rationale**: RFC 7231 §6.5.8 — 409 indicates a conflict with the current state of the resource. 400 is a client error (malformed request). 404 is reserved for "not found".

### D3 — Dead command replacement
Replace `run-plan <path>` with `bun run loop.ts start --plan "<path>" --max-iterations 1`.
**Rationale**: This is a real, working command that invokes the plan-executor plugin through the existing CLI entry point. Spawns a subprocess per trigger fire, which is acceptable for the initial fix.

## Scope IN
- Fix 3 spec bugs in ISSUE-004 (daemon.ts, orchestrator.ts, types.ts, orchestrator.test.ts)
- Update return types of startChild/stopChild
- Update HTTP status codes for loop start/stop endpoints
- Update existing tests to match new behavior
- Add tests for distinguishable error states

## Scope OUT (Must NOT have)
- No architectural refactoring (shotgun surgery, speculative generality fixes from code review — those are standards judgement calls, not spec bugs)
- No changes to plan-executor.ts, triggers.ts, task-queue.ts, history.ts, or any other file not directly involved in the 3 bugs
- No new endpoints or API surface changes
- No changes to loop.ts CLI interface
- No fixing the "scope creep" items (--cron/--watch-dir flags, TriggerManager — those are harmless)

## Open questions
None — all 3 bugs are fully explored and solution is clear.

## Approval gate
status: drafting
<!-- When exploration is exhausted and unknowns are answered, set status: awaiting-approval. -->
<!-- That durable record is the loop guard: on a later turn read it and resume at the gate instead of re-running exploration. -->
