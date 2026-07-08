# agent-loop-wire-patterns - Work Plan

## TL;DR (For humans)

**What you'll get:** Your agent-loop daemon gets the safety gear and operational patterns from the loop-engineering playbook — a run-count budget guard, a kill switch (pause), git worktree isolation for safe fixes, and two ready-to-run loop patterns (daily triage + PR babysitter).

**Why this approach:** Your loop has all the engine power (daemon, triggers, task queue, LLM). What it's missing is the operational discipline to run safely 24/7 — budgets so it doesn't burn tokens, a pause button, and standard loop patterns so you can start using it daily without reinventing the wheel each time.

**What it will NOT do:** Not adding new engine features (no DAG, no retry, no human-in-the-loop). Not setting up CI/CD. Not wiring GitHub connectors — those come after.

**Effort:** Medium
**Risk:** Low — all changes layer on top of existing infrastructure, zero core rewrites
**Decisions to sanity-check:** The pattern priority order (Daily Triage first) and the default 100-run budget cap.

Your next move: approve the plan. Implementation is 3 waves, ~8 commits.

---

> TL;DR (machine): Medium effort, Low risk. Wire loop-engineering operational patterns (budget guard, kill switch, worktree isolation, run log, daily triage, PR babysitter, multi-loop collision, skill ports) into agent-loop. 3 waves, 8 todos, ~8 fresh commits. Zero core rewrites.

## Scope
### Must have
- Budget guard: run counting, configurable daily cap (default 100 runs), early exit at 80%/100%
- Kill switch: STATE.md `paused: true` flag, POST /api/pause endpoint, daemon reads before each task
- Worktree isolation: `src/worktree.ts` helper — create/discard git worktrees, run command inside, verify result
- Run log: append `loop-run-log.md` with run_id, pattern, tokens_used, outcome, timestamp
- Daily triage pattern: `plans/daily-triage.yaml` with cron trigger, LLM reads STATE.md, writes prioritized report (no external integrations)
- PR babysitter pattern: `plans/pr-babysitter.yaml` to check open PRs, report status
- Multi-loop collision: priority table, `acting_on` flag per pattern, skip if conflict
- Skill adaptation: agent-loop-compatible versions of loop-engineering skills (loop-triage, minimal-fix, loop-verifier, loop-budget)

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No full port of all 17 loop-engineering starters (only Daily Triage + PR Babysitter)
- No GitHub connector setup (user decides which MCP servers to wire)
- No CI/CD pipeline
- No core engine rewrites (daemon, task queue, triggers, orchestrator stay as-is)
- No webhook listener (cron-only polling)
- No new npm dependencies

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after + agent-executed QA per todo
- Evidence: .omo/evidence/task-<N>-agent-loop-wire-patterns.md

## Execution strategy
### Parallel execution waves
- Wave 1 (safety): 4 todos in parallel — budget guard, kill switch, worktree, run log
- Wave 2 (patterns): 3 todos — daily triage, PR babysitter, multi-loop collision
- Wave 3 (skills): 1 todo — port 4 skills

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. Budget guard | None | None | 2, 3, 4 |
| 2. Kill switch | None | None | 1, 3, 4 |
| 3. Worktree isolation | None | None | 1, 2, 4 |
| 4. Run log | None | None | 1, 2, 3 |
| 5. Daily triage pattern | 1, 4 (budget + run log) | None | 6 |
| 6. PR babysitter pattern | 3 (worktree) | None | 5 |
| 7. Multi-loop collision | None | None | 5, 6 |
| 8. Port skills | None | None | 5, 6, 7 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Budget guard — run counting + daily cap + early exit
  What to do / Must NOT do: Create `src/budget.ts` that counts task runs in last 24h from loop-run-log.md, checks against configurable daily cap (default 100 runs). At 80% → force report-only mode (task runs logged but not executed). At 100% → exit immediately. Daemon checks budget before executing each task. Budget uses run count (not tokens or dollars) — simplest tracking, O(1), works with any LLM provider. Do NOT modify daemon's existing task execution loop structure — add a check before executeTask().
  Parallelization: Wave 1 | Blocked by: None | Blocks: 5
  References: `src/daemon.ts` (task execution), `src/config.ts` (config pattern), `loop-engineering/skills/loop-budget/SKILL.md` (budget logic reference)
  Acceptance criteria (agent-executable): `bun test __tests__/budget.test.ts` passes. Daemon exits when run cap exceeded. 80% cap triggers report-only mode. Cap configurable via LOOP_DAILY_RUN_CAP env var (default 100).
  QA scenarios: Test budget reads loop-run-log.md correctly. Test 80% threshold forces report-only. Test 100% threshold stops daemon. Test configurable cap via env var. Evidence `.omo/evidence/task-1-agent-loop-wire-patterns.md`
  Commit: Y | feat(agent-loop): add run-count budget guard with configurable daily cap

- [x] 2. Kill switch — STATE.md paused flag + /api/pause endpoint
  What to do / Must NOT do: Add `paused: true|false` to STATE.md read/write. Add POST /api/pause endpoint in daemon.ts (auth-gated, same as other endpoints). Daemon checks STATE.md paused flag before executing each task; if paused, skips and logs. Add GET /api/pause to read current state. Do NOT add new auth mechanisms — reuse existing x-api-key.
  Parallelization: Wave 1 | Blocked by: None | Blocks: None
  References: `src/daemon.ts` (route registration), `src/state.ts` (STATE.md read/write), `loop-engineering/LOOP.md` (kill switch concept)
  Acceptance criteria (agent-executable): POST /api/pause with body {"paused":true} → STATE.md contains paused: true. Daemon skips queued tasks when paused. POST /api/pause with {"paused":false} → resumes. Same API key auth as existing endpoints.
  QA scenarios: curl POST /api/pause pause + check STATE.md. Queue task when paused → verify skipped. Unpause → verify resumes. curl without auth → 401. Evidence `.omo/evidence/task-2-agent-loop-wire-patterns.md`
  Commit: Y | feat(agent-loop): add kill switch via STATE.md pause flag and API endpoint

- [x] 3. Worktree isolation — git worktree helper
  What to do / Must NOT do: Create `src/worktree.ts` with `createWorktree(branch, base?)` that runs `git worktree add ../agent-loop-wt-<branch> <base>`, returns the path. `runInWorktree(worktreePath, command)` runs a command inside the worktree. `discardWorktree(worktreePath)` runs `git worktree remove` + cleanup. `verifyInWorktree(worktreePath, testCommand)` runs tests and returns pass/fail. Do NOT implement any loop pattern logic — pure utility. Do NOT use any npm deps — pure Bun.spawn.
  Parallelization: Wave 1 | Blocked by: None | Blocks: 6
  References: `git worktree --help`, `src/daemon.ts` (Bun.spawn pattern), `loop-engineering/LOOP.md` (worktree discipline)
  Acceptance criteria (agent-executable): `bun test __tests__/worktree.test.ts` passes. Function creates worktree, runs command, returns output, cleans up on discard. Error handling for missing git repo.
  QA scenarios: Create worktree from agent-loop dir. Run `ls` inside it. Verify it's isolated. Discard it. Test with nonexistent branch → graceful error. Evidence `.omo/evidence/task-3-agent-loop-wire-patterns.md`
  Commit: Y | feat(agent-loop): add git worktree isolation utility module

- [x] 4. Run log — append-only loop-run-log.md
  What to do / Must NOT do: Create `src/run-log.ts` with `appendRunLog(entry)` that appends a JSON object to `loop-run-log.md` in the project root. Entry format: `{run_id, pattern, runs_count: number, outcome: 'pass'|'fail'|'error'|'paused'|'budget_exit', timestamp: ISO string, duration_ms: number}`. Create `readRunLog(hoursBack?)` that returns entries within the time window (used by budget guard). Create `countRunsLast24h()` that sums runs_count from last 24h. Do NOT modify existing history.ts patterns. Do NOT add any formatting beyond the JSON-per-line approach.
  Parallelization: Wave 1 | Blocked by: None | Blocks: 5
  References: `src/history.ts` (existing persistence pattern), `loop-engineering/loop-run-log.md` (format reference)
  Acceptance criteria (agent-executable): `bun test __tests__/run-log.test.ts` passes. Append 3 entries → loop-run-log.md exists with 3 lines. Read back returns entries. countRunsLast24h returns correct sum.
  QA scenarios: Append entry → verify file content. Read within time window → returns entries. Read outside → empty. countRunsLast24h with varied values → correct total. Evidence `.omo/evidence/task-4-agent-loop-wire-patterns.md`
  Commit: Y | feat(agent-loop): add loop-run-log.md with append/read/count utilities

- [x] 5. Daily triage pattern — plan.yaml + cron trigger + LLM triage report
  What to do / Must NOT do: Create `plans/daily-triage.yaml` with phases: (1) read STATE.md, (2) call LLM to triage contents into High Priority / Watch List / Recent Noise sections, (3) update STATE.md with report + last_run timestamp. Create `plans/daily-triage-cron.yaml` for the cron trigger that wraps it. Add integration with budget guard and run log. Write agent-loop-compatible version of loop-engineering's loop-triage SKILL.md into `skills/loop-triage/`. Do NOT read external sources (no GitHub, no CI, no issues) — STATE.md only. The LLM works with what STATE.md already contains.
  Parallelization: Wave 2 | Blocked by: 1 (budget) + 4 (run log) | Blocks: None
  References: `plans/*.yaml` (existing plan format), `src/triggers.ts` (cron trigger), `src/evaluate.ts` (LLM call), `loop-engineering/patterns/daily-triage.md`, `loop-engineering/skills/loop-triage/SKILL.md`
  Acceptance criteria (agent-executable): `bun run loop.ts start --plan plans/daily-triage.yaml` runs LLM triage and updates STATE.md. Cron trigger fires at schedule. Budget guard and run log entries are written.
  QA scenarios: Run plan manually → STATE.md has updated sections. Verify loop-run-log.md has entry for this run. Verify budget cap works (set cap to 0 → plan skipped). Evidence `.omo/evidence/task-5-agent-loop-wire-patterns.md`
  Commit: Y | feat(agent-loop): add daily triage pattern with LLM report and cron trigger

- [x] 6. PR babysitter pattern — plan.yaml to check and report on open PRs
  What to do / Must NOT do: Create `plans/pr-babysitter.yaml` with phases: (1) discover open PRs via GitHub CLI/MCP, (2) triage each PR (CI status, review comments, merge readiness), (3) update `pr-babysitter-state.md` with findings, (4) optionally spawn worktree fix for CI failures. Write agent-loop-compatible version of loop-engineering's minimal-fix and loop-verifier skills into `skills/minimal-fix/` and `skills/loop-verifier/`. Use the worktree utility from todo 3 for L2 fix attempts. Do NOT auto-merge or approve PRs — report only at L1.
  Parallelization: Wave 2 | Blocked by: 3 (worktree utility) | Blocks: None
  References: `plans/*.yaml` (plan format), `src/orchestrator.ts` (child loop execution), `src/worktree.ts` (from todo 3), `loop-engineering/patterns/pr-babysitter.md`, `loop-engineering/skills/minimal-fix/SKILL.md`, `loop-engineering/skills/loop-verifier/SKILL.md`
  Acceptance criteria (agent-executable): Plan runs without errors, outputs pr-babysitter-state.md with PR list. Worktree integration works when L2 fixes are needed.
  QA scenarios: Run plan → pr-babysitter-state.md exists with structured report. Run with no open PRs → empty report. Run with worktree fix → worktree created, command run, discarded. Evidence `.omo/evidence/task-6-agent-loop-wire-patterns.md`
  Commit: Y | feat(agent-loop): add PR babysitter pattern with worktree fix support

- [x] 7. Multi-loop collision — priority + acting_on mutual exclusion
  What to do / Must NOT do: Create `src/collision.ts` with a priority table (CI Sweeper > PR Babysitter > Dependency Sweeper > Post-Merge > Daily Triage). Each pattern state file gets an `acting_on: branch-or-pr-id | null` field. Before spawning, read all other pattern state files; if any `acting_on` matches the target, skip and log. Add a `readAllStateFiles()` helper that reads glob of `*-state.md` files. Do NOT modify existing orchestrator.ts — add as a separate utility module that patterns call before acting.
  Parallelization: Wave 2 | Blocked by: None | Blocks: None
  References: `src/orchestrator.ts` (child loop management), `loop-engineering/docs/multi-loop.md` (collision detection pattern)
  Acceptance criteria (agent-executable): `bun test __tests__/collision.test.ts` passes. readAllStateFiles returns parsed content of all *-state.md files. collision check returns 'skip' when acting_on matches, 'proceed' when clear.
  QA scenarios: Create pr-babysitter-state.md with acting_on, run collision check → skip. Clear acting_on → proceed. Multiple state files → all parsed. Evidence `.omo/evidence/task-7-agent-loop-wire-patterns.md`
  Commit: Y | feat(agent-loop): add multi-loop collision detection with priority-based mutual exclusion

- [x] 8. Port loop-engineering skills — agent-loop compatible versions
  What to do / Must NOT do: Create agent-loop-compatible versions of 4 loop-engineering skills in `skills/`:
    - `skills/loop-triage/SKILL.md` — triage CI failures, issues, commits into prioritized report
    - `skills/minimal-fix/SKILL.md` — smallest fix for one problem, with worktree + verification
    - `skills/loop-verifier/SKILL.md` — maker/checker review, default REJECT, runs tests itself
    - `skills/loop-budget/SKILL.md` — token budget guard behavior
  Adapt format to agent-loop's existing skill conventions (not copy-paste from loop-engineering repo). Reference loop-engineering patterns for intent, but make commands and paths agent-loop-native. Do NOT copy vault-level skill infrastructure.
  Parallelization: Wave 3 | Blocked by: None | Blocks: None
  References: `loop-engineering/skills/loop-triage/SKILL.md`, `loop-engineering/skills/minimal-fix/SKILL.md`, `loop-engineering/skills/loop-verifier/SKILL.md`, `loop-engineering/skills/loop-budget/SKILL.md`
  Acceptance criteria (agent-executable): All 4 SKILL.md files exist in `skills/`. Each has agent-loop-specific paths and commands (not loop-engineering references).
  QA scenarios: Read each SKILL.md — verify paths use agent-loop tree. Verify no loop-engineering-specific paths. Evidence `.omo/evidence/task-8-agent-loop-wire-patterns.md`
  Commit: Y | feat(agent-loop): port loop-engineering skills (triage, fix, verify, budget) to agent-loop format

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [x] F1. `bun test` — all existing tests pass (no regressions)
- [x] F2. `tsc --noEmit` — typecheck clean
- [x] F3. Daemon starts with new modules → health OK
- [x] F4. Budget guard: set cap to 0 → daemon stops at first task
- [x] F5. Kill switch: POST /api/pause → STATE.md paused=true
- [x] F6. Worktree: create/discard cycle works
- [x] F7. Run log: entries written and read back
- [x] F8. Daily triage plan runs end-to-end
- [x] F9. PR babysitter plan runs end-to-end
- [x] F10. Collision detection: skip/proceed logic correct
- [x] F11. Scope fidelity: no files outside agent-loop modified

## Commit strategy
8 commits (one per todo), all on `vault/skill-consolidation` branch. Conventional Commits with `feat(agent-loop):` prefix. After all todos, `bun test` full suite to confirm no regression.

## Success criteria
- [x] All 8 todos implemented + tested
- [x] `bun test` passes (no regressions)
- [x] `tsc --noEmit` passes
- [x] Budget guard prevents runaway token spend
- [x] Kill switch lets human pause/resume remotely
- [x] Worktree utility enables safe L2 fixes
- [x] Run log tracks all loop activity
- [x] Daily triage pattern produces actionable STATE.md reports
- [x] PR babysitter pattern checks PRs and reports status
- [x] Multi-loop collision prevents loops from fighting
- [x] Loop-engineering skills adapted for agent-loop
