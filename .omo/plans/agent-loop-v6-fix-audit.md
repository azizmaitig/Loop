# agent-loop-v6-fix-audit - Work Plan

## TL;DR (For humans)

**What you'll get:** The CRITICAL security hole in the daemon's POST /task endpoint patched (now requires an API key), the TypeScript type errors fixed, the plan-path injection risks blocked, and the project documentation brought up to date with the real v6 state.

**Why this approach:** The audit found an unauthenticated RCE vector — any client on your network could run arbitrary commands on your machine. Fixing that is ship-blocker priority. Everything else here is the minimum to get from 3/4 failed audits to green on re-check.

**What it will NOT do:** Not refactoring deep nesting, not adding a structured logger, not setting up CI, not rate limiting. Strictly the must-fix audit findings.

**Effort:** Short
**Risk:** Low — all changes are small, isolated, testable
**Decisions to sanity-check:** The auth mechanism (env var, skipped when unset), command validation rules (which chars to block)

Your next move: approve. Execution is 4 small tasks, ~15 min.

---

> TL;DR (machine): Short effort, Low risk. 4 parallel tasks: (1) auth gate + command sanitization on POST /task, (2) planPath injection fix in orchestrator, (3) 10 tsc errors, (4) STATE.md version update.

## Scope
### Must have
- Auth gate on POST /task, POST /stop, POST /loops/* via LOOP_API_KEY env var
- Shell metacharacter validation on task.command before Bun.spawn
- planPath shell metacharacter validation in orchestrator.ts (startChild + trigger onFire)
- All 10 TypeScript errors fixed
- STATE.md test count updated from 182 to 302
- STATE.md v6 features section added

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No rate limiting
- No CI/CD setup
- No deep nesting refactors
- No structured logger
- No changes to triggers.ts internals

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: tests-after (existing tests + assertions on new behavior)
- Evidence: `.omo/evidence/fix-<N>.md`

## Execution strategy
### Parallel execution waves
- Wave 1: Task 1 (auth) and Task 3 (tsc) can run in parallel — no shared files
- Task 2 (planPath) depends on TriggerDef type fix (part of Task 3)
- Task 4 (STATE.md) is independent

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. Auth gate + cmd sanitization | None | None | 3, 4 |
| 2. planPath injection fix | 3 (TriggerDef type) | None | 4 |
| 3. Fix 10 tsc errors | None | 2 | 1, 4 |
| 4. STATE.md update | None | None | 1, 3 |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [x] 1. Auth gate + command sanitization
  What to do / Must NOT do: Add `LOOP_API_KEY` env var check to daemon.ts. When set, require `Authorization: Bearer <key>` header on POST /task, POST /stop, POST /loops, POST /loops/:id/start, POST /loops/:id/stop. GET endpoints stay open. When env var is unset, ALL endpoints stay open (backward compat for local dev). Also validate `task.command` before Bun.spawn: reject commands containing `;`, `&`, `|`, `` ` ``, `$`, `\n`, `\r`. Return 401 for missing/wrong auth, 400 for rejected command. Do NOT change executeTask to use array-spawn (keep cmd.exe /c for compat). Do NOT add auth to GET endpoints. Do NOT add rate limiting.
  Parallelization: Wave 1 | Blocked by: None | Blocks: None
  References: `src/daemon.ts:140-156` (POST /task handler), `src/daemon.ts:321-350` (executeTask), `src/daemon.ts:1-30` (imports/config), all route handlers for POST endpoints
  Acceptance criteria (agent-executable): `LOOP_API_KEY=secret bun run loop.ts daemon` → POST /task without header returns 401, with `Authorization: Bearer secret` returns 201. Without env var, POST /task returns 201 as before. Command with `;` returns 400. All existing tests pass (302).
  QA scenarios: Start daemon with LOOP_API_KEY=test123, curl POST /task without auth → 401. With auth header → 201. Without env var → 201 regardless. curl with command "echo hi; rm -rf /" → 400. Evidence `.omo/evidence/fix-1-auth.md`
  Commit: Y | `fix(agent-loop): add auth gate + command sanitization to daemon POST endpoints`

- [x] 2. planPath injection fix
  What to do / Must NOT do: In orchestrator.ts, validate `planPath` before string interpolation into shell commands. Add a `isSafePath(path: string): boolean` helper that rejects paths containing `;`, `&`, `|`, `` ` ``, `$`, `(`, `)`, `\n`, `\r`. Apply in startChild (line 86) and registerChildTriggers onFire callback (line 139). Return appropriate errors when validation fails. Do NOT change the shell command structure itself (keep `bun run loop.ts start --plan ...`). Do NOT modify triggers.ts or task-queue.ts. Depends on TriggerDef being properly exported from types.ts (fixed in Task 3).
  Parallelization: Wave 1 | Blocked by: Task 3 (TriggerDef type) | Blocks: None
  References: `src/orchestrator.ts:86` (startChild enqueue), `src/orchestrator.ts:139` (trigger onFire enqueue), `src/orchestrator.ts:26` (trigger processing)
  Acceptance criteria (agent-executable): orchestrator with planPath containing `;` returns error. Normal paths like `./plans/foo.yaml` work. All existing tests pass (302).
  QA scenarios: Call startChild with planPath="./plans/good.yaml" → ok. Call with planPath="./plans/bad;rm -rf /" → returns error. Evidence `.omo/evidence/fix-2-planpath.md`
  Commit: Y | `fix(agent-loop): sanitize planPath against shell injection in orchestrator`

- [x] 3. Fix 10 tsc errors
  What to do / Must NOT do: Fix all 10 TypeScript errors. The root cause chain: TriggerDef is defined in triggers.ts but used in types.ts without import, causing 3 errors. Fix: move TriggerDef type definition to types.ts, re-export from triggers.ts. Other errors: api.ts WebSocket type mismatch (ServerWebSocket vs WebSocket — align types or use `any` cast), api.ts port may be undefined (add non-null assertion or fallback), daemon.ts `opts.cron` may be undefined (narrow type), daemon.ts `this.server.port` port may be undefined (non-null assertion). mcp.ts `getWriter` not on FileSink type (Bun type issue — cast or check). Do NOT change runtime behavior. Do NOT add runtime guards that change behavior — only type annotations.
  Parallelization: Wave 1 | Blocked by: None | Blocks: Task 2
  References: `src/types.ts:146,157` (TriggerDef usage without import), `src/triggers.ts:251-253` (TriggerDef definition), `src/orchestrator.ts:3` (wrong import path), `src/api.ts:80,86,92` (WebSocket + port types), `src/daemon.ts:50,264,265` (undefined types), `src/mcp.ts:61` (getWriter type)
  Acceptance criteria (agent-executable): `tsc --noEmit` exits 0. `bun test` — 302 pass, 0 fail. No new console.log statements added.
  QA scenarios: Run `bun run tsc --noEmit` or `npx tsc --noEmit` — expect exit 0. Run `bun test` — expect 302 pass. Evidence `.omo/evidence/fix-3-tsc.md`
  Commit: Y | `fix(agent-loop): resolve 10 TypeScript errors including TriggerDef type relocation`

- [x] 4. STATE.md update
  What to do / Must NOT do: Read STATE.md. Update test count from 182 to 302. Add a "## v6 Features" section listing: daemon, task queue, triggers (cron + file watch), multi-loop orchestrator, maker/checker plugin, dashboard SPA, WebSocket. Keep all existing content (triage items, watch items, uncommitted changes list). Do NOT add ADRs. Do NOT modify any code files.
  Parallelization: Wave 1 | Blocked by: None | Blocks: None
  References: `STATE.md`
  Acceptance criteria (agent-executable): STATE.md test count shows 302. "v6 Features" section exists with all 7 features. Existing triage/watch content is preserved.
  QA scenarios: Read STATE.md after edit — verify test count is 302, v6 features section lists daemon/task queue/triggers/multi-loop/dashboard/maker-checker/websocket. Evidence `.omo/evidence/fix-4-state.md`
  Commit: Y | `docs(agent-loop): update STATE.md with correct test count and v6 features`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE.
- [x] F1. `bun test` — 302 pass, 0 fail
- [x] F2. `tsc --noEmit` — exit 0
- [x] F3. Auth gate verification: LOOP_API_KEY set → POST /task without auth → 401
- [x] F4. Auth gate verification: LOOP_API_KEY unset → POST /task → 201
- [x] F5. Command validation: POST /task with "echo hi; rm -rf /" → 400
- [x] F6. planPath validation: orchestrator with malicious path → error
- [x] F7. STATE.md: test count 302, v6 features present

## Commit strategy
- 4 commits (one per task), conventional format
- Commit order: 3 (tsc) → 2 (planPath) → 1 (auth) → 4 (STATE.md)
- All on current branch, no push without approval

## Success criteria
- [ ] `tsc --noEmit` exits 0
- [ ] `bun test` — 302 pass, 0 fail
- [ ] CRITICAL RCE vector blocked (auth + command validation)
- [ ] HIGH planPath injection blocked
- [ ] STATE.md accurate (test count 302, v6 features cataloged)
