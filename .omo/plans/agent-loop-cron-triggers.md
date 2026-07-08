# agent-loop-cron-triggers - Work Plan

## TL;DR (For humans)

**What you'll get:** A cron trigger firing every 5 minutes against `plans/file-watch-demo.yaml`, plus the daemon auto-starting when you log into Windows. Drop a plan into `incoming/` or let the cron fire — both work.

**Why this approach:** Zero code changes — the daemon already supports cron triggers via `_loops.yaml` config. Windows `schtasks` is the native way to auto-start without extra tooling.

**What it will NOT do:** No REST API for runtime trigger management. No catch-up queue if the daemon was offline during a cron window. Those can be done as Wave 2.

**Effort:** Quick
**Risk:** Low — config changes only, no src/ modifications
**Decisions to sanity-check:** Cron expression (`*/5 * * * *`) — changeable any time. Port (3000). Daemon runs in a hidden window.

Your next move: approve. Full execution detail follows below.

---

> TL;DR (machine): Quick, Low — add cron entry to _loops.yaml + Windows schtasks auto-start daemon on login

## Scope
### Must have
- Add cron trigger entry (`*/5 * * * *`) to `_loops.yaml`
- Create Windows scheduled task to auto-start daemon `--port 3000 --loops-config _loops.yaml` at user login

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No changes to `src/` files
- No new npm dependencies
- No daemon code changes — config only

## Verification strategy
- Test decision: none (no code changes)
- Evidence: .omo/evidence/task-1-agent-loop-cron-triggers.md (YAML validity + schtasks export)

## Execution strategy
### Parallel execution waves
Wave 1 — 2 parallel tasks (independent: config file ≠ Windows task)

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. _loops.yaml cron entry | — | — | 2 |
| 2. Windows schtasks | — | — | 1 |

## Todos
> Implementation + Test = ONE todo. Never separate.
- [ ] 1. Add cron trigger entry to `_loops.yaml`
  What to do / Must NOT do: Add a second loop entry below the existing file-watch-demo entry. Cron expression `*/5 * * * *`, planPath `plans/file-watch-demo.yaml`. Use the `triggers:` block format (not `watchDir` shorthand). Do NOT modify or remove the existing file-watch-demo entry. Do NOT create new plan files.
  Parallelization: Wave 1 | Blocked by: — | Blocks: —
  References: `_loops.yaml` (current has file-watch-demo only), `src/orchestrator.ts:145-167` (trigger parsing), `src/triggers.ts:46-146` (CronTrigger), `src/types.ts:145-147` (TriggerDef)
  Acceptance criteria: `_loops.yaml` contains a cron entry with `*/5 * * * *` and planPath, YAML is parseable (no syntax errors)
  QA scenarios: `curl -s http://localhost:3000/loops` shows 2 children (file-watch + cron), both running
  Commit: N (not a commit-worthy milestone alone)
- [ ] 2. Register daemon as Windows startup task
  What to do / Must NOT do: Run `schtasks /create` to auto-start the daemon at user logon. Command: `bun run loop.ts daemon --port 3000 --loops-config _loops.yaml`. Working dir: `D:\projects\obsidian\second brain\10-Projects\11-Active\agent-loop`. Delay: 30s after logon. Run whether user is logged on or not. Do NOT change any existing schtasks entries.
  Parallelization: Wave 1 | Blocked by: — | Blocks: —
  References: `schtasks /create /?` for flags
  Acceptance criteria: `schtasks /query /tn "agent-loop-daemon"` returns the task with status "Ready"
  QA scenarios: `schtasks /query /v /tn "agent-loop-daemon" | findstr "Command Line"` shows the correct bun command
  Commit: N (no files changed)

## Final verification wave
- [ ] F1. `_loops.yaml` valid YAML — `bun run loop.ts daemon --port 3001 --validate-loops _loops.yaml` exits 0 (or manual parse check)
- [ ] F2. Daemon on 3000 shows 2 child loops via `curl -s http://localhost:3000/loops` — file-watch + cron both running
- [ ] F3. schtasks registered — `schtasks /query /tn "agent-loop-daemon"` returns Ready
- [ ] F4. No src/ files modified — `git diff -- src/` is empty

## Commit strategy
N/A — no source files changed. Only `_loops.yaml` modified (already tracked). If desired: `chore: add cron trigger entry to _loops.yaml`

## Success criteria
- Daemon starts on login, registers 2 child loops (file-watch + cron)
- Cron fires every 5 min, enqueues plan execution
- No src/ changes
