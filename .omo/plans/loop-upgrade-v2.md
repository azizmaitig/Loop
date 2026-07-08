# Loop Upgrade v2 — Resilience & Trending

## Overview
Add concurrent-run prevention, stuck-state recovery, cross-pulse trend tracking, and pulse.ps1 timeout handling to the vault-pulse loop. All changes are in a single file: `00-System/Tools/loop-vault-pulse.ps1`.

## Architecture Decisions
- **PID lock file** over named mutex (simple, survives crashes via stale detection)
- **Local slot file** continues as state store (`.omo/loop-slots.json`) — no agentmemory dependency
- **Inline timeout** via `Start-Job` + `Wait-Job` for pulse.ps1 (no external module needed)
- **Trend stored as previous values** in slot:loop-last-run — parsed on each run, no new slot needed

---

## Task List

### Task 1: Concurrent-run prevention (PID lock)

**Description**: Add a `.omo/pulse.lock` file mechanism. If a lock file exists and is <30min old, the script exits with code 0 (don't queue). If >30min, treat as stale crash and proceed.

**Implementation**:
1. At line ~114: Read kill-switch → check lock
2. Write current PID + timestamp to lock file
3. On exit (both 0 and 1): remove lock file
4. Use a trap/handle for crash cleanup

**Acceptance Criteria**:
- [x] Run script twice simultaneously → second exits early with "locked" message
- [x] Remove lock file during a wait → script resumes
- [x] Stale lock (>30min) → script warns and proceeds

**Files touched**: `00-System/Tools/loop-vault-pulse.ps1`

---

### Task 2: Stuck state recovery

**Description**: Before setting state to RUNNING, check if it's already RUNNING from a previous crash. If so, log a warning and note it in the pulse report.

**Implementation**:
1. Read `slot:loop-state` before setting it
2. If value is `RUNNING`, set `$CrashedRecovery = $true`
3. Add a `## Crashed Recovery` section to the pulse report when true
4. Read `slot:loop-last-run` and include it as partial data hint

**Acceptance Criteria**:
- [x] Normal run: no crash section in report
- [x] Simulated crash: set state to RUNNING manually → script shows "⚠️ Previous run crashed"

**Files touched**: `00-System/Tools/loop-vault-pulse.ps1`

---

### Task 3: Pulse.ps1 timeout wrapper

**Description**: The existing `& $PulseScript` blocks until pulse.ps1 finishes (can be slow on large vaults). Wrap it with `Start-Job` + 30s timeout. If it times out, fall back to reading the existing pulse.md.

**Implementation**:
1. Replace `& $PulseScript 2>&1 | Out-String` with:
   - `Start-Job { param($s) & $s } -ArgumentList $PulseScript`
   - `Wait-Job -Timeout 30` → if null, kill job and set `$PulseGenerated = $false`
2. The fallback (`Read existing pulse.md`) already exists

**Acceptance Criteria**:
- [x] Normal run: pulse.ps1 completes within 30s → same as before
- [x] Slow pulse.ps1: script falls back to existing pulse.md, warning printed

**Files touched**: `00-System/Tools/loop-vault-pulse.ps1`

---

### Task 4: Trend tracking (diff vs last pulse)

**Description**: Parse previous `slot:loop-last-run` report for key numbers (uncommitted changes, project count, recent files count). Calculate deltas and add a `## Trend` section to the report.

**Implementation**:
1. After reading slot:loop-last-run, extract:
   - `Uncommitted changes: (\d+)` → prevChanges
   - `^## Projects$` then count lines until next heading → prevProjects
2. Calculate: `deltaChanges = currentChanges - prevChanges`
3. Add trend indicators: `↑` for increase, `↓` for decrease, `=` for same
4. Add section: `## Trend\n- Changes since last pulse: ${deltaChanges} uncommitted\n- Projects: ${prevProjects} → ${currentProjects}`

**Acceptance Criteria**:
- [x] First run (no previous data): trend section shows "no previous data"
- [x] Subsequent run: shows delta for uncommitted changes
- [x] Trend indicators correct (↑/↓/=)

**Files touched**: `00-System/Tools/loop-vault-pulse.ps1`

---

### Task 5: Extend recent-files window to 7 days

**Description**: Change `AddDays(-1)` to `AddDays(-7)` so the pulse shows files from the last week, not just 24 hours. This prevents empty recent-files sections after idle days.

**Implementation**:
1. Line 215: `$_.LastWriteTime -gt (Get-Date).AddDays(-1)` → `AddDays(-7)`
2. Add label: `## Recent Files (last 7 days, up to 10)`

**Acceptance Criteria**:
- [x] Pulse report shows "last 7 days" in heading
- [x] Shows files older than 24h but less than 7 days

**Files touched**: `00-System/Tools/loop-vault-pulse.ps1`

---

## Dependency Map
```
Task 1 (PID lock)     — no deps, insert at top
Task 2 (stuck state)  — no deps, reads state before step 3
Task 3 (timeout)      — no deps, replaces &-call in step 4
Task 4 (trend)        — depends on Task 3's slot:loop-last-run read
Task 5 (7-day window) — no deps, one-line change
```

Tasks 1, 2, 3, and 5 are fully independent. Task 4 depends on Task 3 having a clean slot:loop-last-run read.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Lock file not cleaned on crash | Low | Stale detection (>30min) handles this |
| Job timeout kills pulse.ps1 mid-write | Low | pulse.md is the fallback, not the primary output |
| Trend parsing fails on format change | Low | Parser uses regex, fails gracefully with "?" |

## Verification
- [x] Script runs with exit 0
- [x] Lock file created and cleaned
- [x] All 4 slot keys intact after run
- [x] Trend section present (with data or "no previous")
- [x] pulse.md written with new sections
