# ISSUE-007 — Conventions (init + STATE.md auto-update)

## What to build

`agent-loop init` scaffolds loop-engineering convention files (STATE.md, LOOP.md, AGENTS.md). The daemon auto-updates STATE.md after every completed task, preserving human edits in the markdown body.

- Create `src/init.ts`:
  - `initProject(dir: string): Promise<InitResult>` — creates files in dir
  - `STATE.md` with YAML frontmatter: `last_run`, `active_children`, `high_priority`, `watch_items`
  - `LOOP.md` with default level: L1, safety denylist, conventions
  - `AGENTS.md` with loop mode rules and safety guidelines
  - Does NOT overwrite existing files (unless `--force`)
  - Returns `{ created: string[], warnings: string[] }`
- Update `src/state.ts` (or daemon.ts):
  - `updateStateMd(state: LoopState, daemonState?: DaemonState): Promise<void>`
  - Writes YAML frontmatter only — preserves human body
  - Called after each completed task (from daemon event loop)
- CLI:
  - `bun loop.ts init` → initProject(cwd)
  - `bun loop.ts init --dir /path/to/project` → custom dir
- Wire into daemon: after each task completion → save history → update STATE.md
- Handle edge cases: STATE.md doesn't exist yet (create it), body edits preserved, concurrent writes not possible (sequential execution)

## Acceptance Criteria

- [ ] `bun loop.ts init` creates STATE.md, LOOP.md, AGENTS.md with defaults
- [ ] Running init again skips existing files (no overwrite)
- [ ] `bun loop.ts init --force` overwrites existing files
- [ ] Daemon auto-updates STATE.md frontmatter after each task
- [ ] Human-added content in STATE.md body is preserved after update
- [ ] `updateStateMd` creates STATE.md if it doesn't exist
- [ ] All existing tests pass

## Blocked by

- ISSUE-002 (task execution must exist for STATE.md auto-update)
