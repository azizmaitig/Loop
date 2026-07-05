# Loop State — agent-loop

Last run: 2026-07-05

## High Priority (loop is acting or waiting on human)

### 1. First-ever triage — loop has never been exercised
- **What**: STATE.md had "Last run: never". Loop infrastructure is set up (LOOP.md, AGENTS.md, budget, constraints, skills/triage) but no loop run has ever completed.
- **Why**: Without a baseline run, there's no evidence the loop pipeline works end-to-end.
- **Action**: Schedule/run `opencode run "Run loop-triage" --agent loop-triage` to confirm the loop operates correctly.
- **Effort**: Small (one-shot validation).

### 2. Branch is `vault/skill-consolidation`, not `main`
- **What**: Active development is on a long-running consolidation branch, 36 commits ahead of `origin/main` with no PR or merge path established.
- **Why**: Agent-loop code is unreviewed and unreachable from main. This blocks L2+ fixes from being landed.
- **Action**: Open a PR from `vault/skill-consolidation` → `main` with the agent-loop changes, or decide on a merge strategy.
- **Effort**: Medium (review 36 commits, resolve any conflicts).

### 3. Uncommitted changes across 7+ agent-loop files
- **What**: Modified working tree: CONTEXT.md, __tests__/plugins.test.ts, loop.ts, package.json (bumped to 0.5.0), src/index.ts, src/plugins.ts, src/types.ts.
- **Why**: These changes represent a version bump + feature work (plan-executor plugin integration) that isn't persisted. If worktree is lost, so is this work.
- **Action**: Review and commit the pending changes, or revert if exploratory.
- **Effort**: Small (review diff, commit).

## Watch Items (monitor, do not act yet)

### 4. Agentmemory integration tests can't complete locally
- **Observation**: `agentmemory.test.ts` and `memory-hooks.test.ts` show "Connection refused" / "Aborted" for agentmemory endpoints. Tests still pass (graceful fallback), but no actual agentmemory connectivity is verified.
- **Why**: agentmemory daemon (`localhost:3111`) needs to be running for end-to-end memory hook validation.
- **Trigger**: If agentmemory integration becomes a loop dependency, start the daemon before loop runs.

### 5. Multiple stale plan drafts
- **Observation**: `.omo/drafts/` contains: agent-loop-v5-opencode-plugin.md, agent-loop-real-pipeline.md, openspec-integration.md. Only v5-opencode-plugin has a corresponding plan in `.omo/plans/`.
- **Why**: Drafts may represent abandoned or superseded approaches. Unclear which (if any) are still active.
- **Action**: Archive or delete abandoned drafts to reduce noise.

### 6. No CI pipeline configured
- **Observation**: No `.github/workflows/` or CI config in the agent-loop project. 302 tests pass locally but there's no automated gate.
- **Why**: Without CI, regressions can go silent until manual test runs.
- **Trigger**: Before L2+ changes are merged to main, add at minimum a `bun test` step.

## Recent Noise (ignored this run)

- Vault-wide file deletions (skill consolidation) — large diff volume but agent-loop specific changes are focused and intentional.
- Other project changes (PFE, Momento, 88-Labs) — outside scope of agent-loop triage.

## v6 Features

- **Daemon** — HTTP server with REST API for task management, WebSocket state broadcasting, and dashboard SPA
- **Task queue** — In-memory FIFO queue with status tracking, timeout support, and persistent history
- **Triggers (cron + file watch)** — Time-based (cron expression) and filesystem-based (directory watch) task triggers
- **Multi-loop orchestrator** — Manages multiple child loop instances with lifecycle control (start/stop), YAML config loading, and per-loop trigger registration
- **Maker/checker plugin** — Dual-phase execution with automated verification and confidence-based judgment
- **Dashboard SPA** — Real-time monitoring via single-page application served by the daemon
- **WebSocket** — Bidirectional state broadcasting to connected clients with automatic reconnection

---
Run log: 2026-07-05 — First triage run. 302 tests pass (0 fail). No CI failures or open issues. Loop has never executed before.
