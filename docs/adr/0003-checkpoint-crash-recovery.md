# 0003 — Checkpoint-based crash recovery

Plan-driven execution now saves a `.checkpoint.json` file after EVERY completed phase. On restart, the checkpoint is the authoritative source of progress. The plan YAML is only written on full loop completion — never partially.

## Context

v5's plan-executor writes `status`/`duration`/`completedAt` back to the plan YAML at the end of a loop run (`afterLoop` hook). This works for normal completion but fails on crash: if the subprocess (opencode) OOMs mid-run or disk fills up, the plan YAML is left in its original state with no record of what completed. The loop has no way to resume — it starts from scratch every time.

Two crashes from reality:
1. **C drive ENOSPC** during batch-6 — parseICS, templates, App.tsx edits partially written. After reboot, no resume path existed. Had to manually verify which edits persisted.
2. **JSC heap exhaustion** during batches 7-8 — opencode subprocess crashed with `ASSERTION FAILED: MemoryExhaustion`. The plan YAML had no completion data.

## Decision

- A `.checkpoint.json` file is written after every phase completes successfully (batch AND verify)
- The checkpoint is the **single authoritative source** of crash recovery state
- The plan YAML is only mutated on FULL loop completion (`afterLoop` runs only when `allPassed === true`)
- On restart with `--plan <path>`, the checkpoint is detected and the user is prompted: "Resume from checkpoint? (Y/n)"
- If resumed, completed tasks are filtered out; only pending tasks execute
- If declined, the checkpoint is cleared and a fresh run begins
- On full successful completion, the checkpoint is automatically cleared

## Rationale

| Factor | Save-after-every-phase (chosen) | afterLoop-only (v5) |
|--------|-------|---------|
| Crash recovery | Exact progress known, ±1 phase | Full restart from phase 0 |
| Plan YAML state | Pristine until full success | Partial writes; corrupted on crash |
| I/O cost | ~1 write per phase (negligible — JSON < 1KB) | Minimal (already writes once) |
| Complexity | New file + checkpoint module | Existing `afterLoop` only |
| Verification after crash | Manual for human audit; can check checkpoint JSON | Manual — no record of what passed |

**Why not mutate the plan YAML incrementally?** Writing partial status to a human-edited YAML file risks corruption — the custom YAML parser round-trips through a stringification that could lose fidelity on partial data. A machine-only JSON file is safer for incremental writes.

## Considered Options

- **Incremental plan YAML mutation** — write `status: pass` to the plan YAML after each phase. Discarded: round-trip YAML serialization may lose comments or formatting; partial-write corruption on crash could corrupt the plan file irreparably.
- **No checkpoint; rely on system-level retry** — restart the entire loop from a CI/orchestrator level. Discarded: a 9-hour calendar build restarting from phase 0 is wasteful when 7 phases already passed.
- **SQLite/sophisticated state store** — overkill. The checkpoint schema is 5 fields; a JSON file is simpler to debug, audit, and version.

## Consequences

- Plan YAML files remain clean (pristine pre-run state or fully completed). No partial status pollution.
- The checkpoint JSON is a machine artifact — humans debrief by reading the plan YAML (post-success) or the checkpoint (post-crash).
- On crash, users see a clear resume prompt with task count. No guessing how far the loop got.
- `afterLoop` (plan-executor) must check `allPassed` before writing. This is a behavioral change: `afterLoop` no longer writes on partial failure.
- The checkpoint module has zero dependencies (`Bun.file` + `JSON.parse`) — consistent with v5's zero-dep philosophy.
