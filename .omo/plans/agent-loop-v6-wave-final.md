# agent-loop-v6-wave-final - Work Plan

## TL;DR (For humans)

**What you'll get:** Four parallel checks on the finished v6 loop — code quality, security, performance, and documentation — to make sure everything is solid before you ship it.

**Why this approach:** All 7 v6 issues are done and committed. Running these audits in parallel is the fastest way to catch any blind spots without slowing down.

**What it will NOT do:** Not adding new features, not writing new tests, not setting up CI. Pure audit.

**Effort:** Short
**Risk:** Low - audits only, no code changes unless a real bug is found
**Decisions to sanity-check:** The audit criteria boundaries — what each check covers and where it stops.

Your next move: approve the plan. Audits run in ~5 minutes.

---

> TL;DR (machine): Short effort, Low risk. 4 parallel audits on committed agent-loop v6 (302 tests, clean tree, v0.5.0). Code quality (Biome lint + typecheck), Security (OWASP + secret scan), Performance (profile + leak check), Doc audit (STATE.md/LOOP.md/AGENTS.md). All must pass.

## Scope
### Must have
- Run `bunx biome check src/` on all source files
- TypeScript typecheck (`bun run tsc --noEmit` or `tsc --noEmit`)
- Security scan: grep for hardcoded secrets, command injection in shell exec, input validation gaps
- Performance profile: daemon startup time, WS broadcast, queue throughput, setInterval cleanup
- Doc audit: STATE.md matches actual codebase, LOOP.md/AGENTS.md accurate, ADRs exist and are up-to-date
- Evidence files written to `.omo/evidence/task-<N>-agent-loop-v6-wave-final.md`

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No code changes unless a real bug is found (if found, write a separate fix plan)
- No CI/CD setup
- No browser/UI QA (headless limitation)
- No load testing beyond basic profiling
- No new test files

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: none (audit only, no code changes)
- Evidence: `.omo/evidence/task-<N>-agent-loop-v6-wave-final.md`

## Execution strategy
### Parallel execution waves
- Wave 1: All 4 audits run in parallel (independent, no shared state)
- Wave FINAL: Results synthesized into a single pass/fail verdict

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. Code quality | None | None | 2, 3, 4 |
| 2. Security scan | None | None | 1, 3, 4 |
| 3. Performance profile | None | None | 1, 2, 4 |
| 4. Doc audit | None | None | 1, 2, 3 |
| F1-F4. Synthesize results | 1, 2, 3, 4 | Final verdict | None |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Code quality audit
  What to do / Must NOT do: Run Biome lint check on src/, run TypeScript typecheck (tsc --noEmit), review code for SRP violations, deep nesting (>3), magic strings/numbers, untested error paths. Do NOT modify any files.
  Parallelization: Wave 1 | Blocked by: None | Blocks: None
  References (executor has NO interview context - be exhaustive): `src/*.ts` (all source files), `__tests__/*.test.ts` (test files for coverage awareness)
  Acceptance criteria (agent-executable): `bunx biome check src/` exits 0; `tsc --noEmit` exits 0; no findings below severity "info" in any of: deep nesting >3, magic literals, untested error branches
  QA scenarios: Run `bunx biome check src/` and capture full output. Run `tsc --noEmit` and capture. Grep for `console.log` (should be zero in prod code). Grep for magic numbers (literals other than 0/1/-1 in business logic). Evidence `.omo/evidence/task-1-agent-loop-v6-wave-final.md`
  Commit: N (audit only)

- [ ] 2. Security audit
  What to do / Must NOT do: Scan all src/ for hardcoded secrets (API keys, tokens, passwords, private keys). Audit all shell command construction (Bun.spawnSync, exec, cmd.exe /c) for command injection. Audit input validation on all HTTP endpoints and trigger configs. Check plan-executor.yaml parser for path traversal. Do NOT modify any files.
  Parallelization: Wave 1 | Blocked by: None | Blocks: None
  References: `src/daemon.ts` (HTTP endpoints, WS), `src/orchestrator.ts` (shell commands), `src/plan-executor.ts` (YAML parsing + exec), `src/triggers.ts` (cron/file-watch), `src/task-queue.ts` (command execution), `src/api.ts` (REST API)
  Acceptance criteria (agent-executable): No secrets found in src/ (false positives for example/test values documented). No unsanitized user input reaches Bun.spawnSync or exec. All shell commands use parameterized args, not string interpolation. No path traversal in plan paths.
  QA scenarios: Grep for: API[Kk]ey|api_key|secret|token|password|-----BEGIN in src/. Grep for all `spawnSync`, `exec`, `cmd.exe`, `Bun.spawn` occurrences — inspect each for unsanitized input. Trace input flow from `POST /task` body to executeTask. Evidence `.omo/evidence/task-2-agent-loop-v6-wave-final.md`
  Commit: N (audit only)

- [ ] 3. Performance profile
  What to do / Must NOT do: Measure daemon startup time (< 500ms target). Verify WS broadcast completes under 50ms for 5 children. Check task queue sequential throughput (> 10 trivial tasks/s). Verify all setInterval/clearTimeout pairs are clean (no leaked timers on stop()). Do NOT modify any files.
  Parallelization: Wave 1 | Blocked by: None | Blocks: None
  References: `src/daemon.ts` (start/stop, WS broadcast, intervals), `src/task-queue.ts` (sequential loop), `src/orchestrator.ts` (child process lifecycle), `__tests__/daemon-v6.test.ts` (existing lifecycle tests)
  Acceptance criteria (agent-executable): Daemon.start() resolves under 500ms. `broadcast()` on 5-child state completes under 50ms. TaskQueue processes 10 echo tasks in under 2s. All intervals from `setInterval()` have matching `clearInterval()` in stop/shutdown paths.
  QA scenarios: Profile with `performance.now()` wrappers in daemon.ts start(). Count setInterval/clearInterval calls across all src/. Simulate 10 sequential echo tasks via POST /task, measure wall-clock. Evidence `.omo/evidence/task-3-agent-loop-v6-wave-final.md`
  Commit: N (audit only)

- [ ] 4. Doc audit
  What to do / Must NOT do: Verify STATE.md accurately reflects current codebase (v0.5.0, 302 tests, 22 files, all v6 features). Check LOOP.md and AGENTS.md consistency with actual architecture. Verify ADRs exist for key decisions. Check `docs/adr/` directory exists and contains relevant ADRs. Do NOT modify any files.
  Parallelization: Wave 1 | Blocked by: None | Blocks: None
  References: `STATE.md` (project state), `LOOP.md` (loop conventions), `AGENTS.md` (agent configs), `docs/adr/` (architecture decisions)
  Acceptance criteria (agent-executable): STATE.md version matches package.json version (0.5.0). STATE.md test count matches actual (302). LOOP.md describes the phases correctly. AGENTS.md has no stale/dead agents. ADRs exist for v6 architecture decisions.
  QA scenarios: Read STATE.md, cross-reference version/tests/metrics against `bun test` output and `package.json`. Read LOOP.md — does the described workflow match the actual CLI? Read AGENTS.md — are all referenced agents defined? Evidence `.omo/evidence/task-4-agent-loop-v6-wave-final.md`
  Commit: N (audit only)

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. Synthesize all 4 audit reports into a single pass/fail verdict
- [ ] F2. If any audit FAILED, surface specific findings with file:line references
- [ ] F3. If all PASS, declare Wave FINAL complete — agent-loop v6 is ready to ship
- [ ] F4. Optionally create GitHub release notes from commit log

## Commit strategy
No commits — pure audit. If bugs found, separate fix plan.

## Success criteria
- [ ] Code quality: Biome + tsc pass with zero errors
- [ ] Security: No secrets, no command injection vectors, all input validated
- [ ] Performance: Startup <500ms, WS <50ms, queue >10 tasks/s, no leaked timers
- [ ] Docs: STATE.md current, LOOP.md/AGENTS.md accurate, ADRs present
- [ ] All 4 evidence files written to `.omo/evidence/`
