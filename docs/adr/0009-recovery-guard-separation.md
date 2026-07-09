# 0009 — Recovery vs Guard separation (heal left unwired)

## Context

RC-2 of the architecture review flagged a "retry/heal seam" spanning `src/execute-phases.ts` (auto-heal block, lines 103-131) and `src/task-processor.ts` (failure handling + budget drain). On inspection the premise was weaker than it looked:

- `execute-phases.ts:103-131` is the **only** retry loop, and it is **dead code** — it reads `healCommand`/`maxRetries` off the `phase` object via `as unknown as Record`, but `PhaseDef` has no such fields and `plan-executor.ts` (lines 25-38) only copies `id→name, command, timeoutMs, llm` into the phase. In plan-driven mode those are always `undefined`, so the `if` at line 107 never enters.
- `task-processor.ts` has **no** retry loop. It has three distinct failure-adjacent behaviors: `executeTask` marks failure (`taskQueue.fail`, line 113), and `processQueue` drains the queue *before execution* when the budget guard trips (lines 133-149).

So there is no duplicated retry pattern. There are **three genuinely different domain events** currently lumped under "command failed → now what":

| Event | When | Has a result? | Current code |
|-------|------|---------------|--------------|
| Verify-heal (intended, unwired) | after a verify phase fails | yes | execute-phases.ts:103-131 (dead) |
| Task failure | after a daemon task exec throws / unsafe | yes | task-processor.ts:111-114 |
| Budget cancel-report | **before** a task runs | no | task-processor.ts:133-149 |

The third event fires *before* any execution and has no result object. Forcing it into a post-execution `handleOutcome(result)` would require inventing a fake "cancelled" result for something that never ran.

## Decision

Model recovery as **two separate hook points**, not one:

- **`Guard`** — pre-execution decision: "should this task/phase run at all?" Covers budget cap (report-only/exceeded), pause, and command safety. A guard outcome of "no" means the task never executes. `cancel-report` is a **guard** outcome, not a recovery.
- **`RecoveryStrategy`** — post-execution decision: "now that this ran and did not pass, what next?" Variants: `healAndRetry` (run a fix command, re-run the verify phase) and `failTerminal` (mark failed, broadcast). Only meaningful when a real `result` exists.

The deepened module is `src/recovery.ts` exporting both interfaces. `healAndRetry` is defined as a recovery variant but has **no live caller** — the dead heal block in `execute-phases.ts` is deleted rather than revived.

## Rationale

- **Cancel-report is a gate, not a recovery.** It intercepts before `executeTask` is ever called. Modelling it as a post-execution outcome would fabricate a result. The domain says "don't run" — that is a guard.
- **Heal and Fail are true post-execution recoveries.** Both hold a real `result`. They differ only in outcome (retry vs terminate), which is exactly a `RecoveryStrategy` variant set.
- **Two hook points match the existing seams.** `executePhaseGroup` already has a post-execution spot (the heal block) and `processQueue` already gates before `executeTask` (budget at line 128, pause at 155). The design gives those spots proper interfaces instead of inline logic — minimal blast radius.
- **We do not know why heal was originally unwired** (accidental drop in the `plan-executor.ts` mapping, or deliberate abandonment). Reviving it would bake in an unconfirmed assumption. Defining the variant behind `RecoveryStrategy` gives heal a correct home *if* wanted, with zero commitment now. Wiring later is a ~5-line mapping addition, not a redesign.

Passes the deletion test: removing `recovery.ts` would push the guard/recovery logic back into `execute-phases.ts` and `task-processor.ts`, not eliminate it.

## Considered Options

- **Unify everything into one `handleOutcome(result)` router (option γ)** — rejected. Cancel-report has no result; feeding it a stub pseudo-result lies to the type system and conflates "didn't run" with "ran and failed."
- **Keep them separate, no unifying module (option β)** — rejected as under-reaching. The budget/pause/safety gate and the fail/heal decision are each repeated inline today; a `recovery.ts` seam makes them testable and gives heal a home.
- **Delete dead heal + revive heal properly (wire `healCommand`/`maxRetries` into `PhaseDef` + `plan-executor.ts`)** — rejected for this change. Couples deletion of dead code with addition of live code, muddying verification, and commits to an unconfirmed intent.
- **Guard + Recovery as two hook points, heal defined-but-unwired (chosen)** — clean separation, lowest risk, pays down the sprawl without reviving abandoned behavior.

## Consequences

- `execute-phases.ts`: delete lines 103-131 (dead heal block) and the `as unknown as Record` casts at 105-106. Post-execution recovery routes through `RecoveryStrategy` instead of inline logic.
- `task-processor.ts`: budget/pause/safety gate extracted to `Guard.shouldRun(task)`; `executeTask` failure routes through `RecoveryStrategy.failTerminal`.
- `recovery.ts` (new): `Guard` + `RecoveryStrategy` with `healAndRetry` (defined, no caller) and `failTerminal`.
- `plan-executor.ts`: `healCommand`/`maxRetries` stay unmapped until heal is intentionally revived.
- `CONTEXT.md`: added glossary terms **Guard**, **Recovery**, **Cancel-report**.

## Related

- ADR-0004: Shared `executePhaseGroup()` — the post-execution spot this recovery hooks into.
- ADR-0008: Unified shell execution — `recovery.ts` consumers call `runCommand` from `shell.ts`, not raw spawns.
- RC-2 architecture review finding: "Deepen the retry/heal seam."
