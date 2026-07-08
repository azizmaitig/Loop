# Loop Upgrade v4 — Pulse Health Redesign

## TL;DR

> **Quick Summary**: Fix the pulse report's empty sections, stale git-dirty metric, and duplicate entries while adding a composite health score (0-100) with JSON trend tracking — keep the existing format but make it clean, accurate, and useful.
>
> **Deliverables**:
> - `.gitignore` fixed (exclude `node_modules/`, `.omo/`)
> - `pulse.ps1` fixed (no empty sections, no duplicates, structured formatting)
> - `pulse.sh` fixed (mirrors pulse.ps1 fixes)
> - `.stignore` checked (`.omo/` device-local for Syncthing)
> - Composite health score (0-100) in every pulse report
> - JSON trend store at `.omo/pulse-trend.json`
> - Actionable recommendations section
> - All changes git-committed
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: T2 → T5 → T7 → T8 → T9 → T10

---

## Context

### Original Request
"Make the vault pulse actually useful day-to-day" — the current report shows 602 uncommitted changes (always flat), empty "Today's Tasks" section, duplicate "Latest Knowledge" entries, and a trend that never changes.

### Interview Summary
**Key Discussions**:
- 602 uncommitted changes is a gitignore issue (node_modules, .omo/ not excluded)
- Empty "Today's Tasks" because `00-System/Daily-Logs/` doesn't exist
- "Latest Knowledge" has duplicates because KB has 4 Index.md files
- User confirmed: fix the noise, keep the format

**User Decisions**:
- **pulse.sh**: Fix both pulse.ps1 AND pulse.sh (mirror critical fixes)
- **pulse.md consumer**: Humans (Obsidian) — human-readable format
- **Gitignore fix**: YES — exclude node_modules, .omo at source
- **Performance budget**: Up to 60s (within current pulse timeout)
- **Health score**: Kiroshi 4-factor — link density (25%), freshness (25%), connectivity/orphans (25%), consistency/streak (25%)
- **Score thresholds**: Green 80-100, Yellow 50-79, Red 0-49 (tune after 30 days)
- **Trend tracking**: YES — JSON state store at `.omo/pulse-trend.json`
- **Scope**: All 7 proposals (full upgrade)
- **Format**: Keep existing format. Fix issues, add sections, don't redesign.

**Research Findings**:
- Kiroshi Health Score: composite 0-100 from 4 sub-scores (links, freshness, connectivity, consistency)
- Vault Operator: 9-category health audit (orphans, broken links, tag hygiene)
- FAI Knowledge Staleness: categorized fresh/aging/stale with weighted scoring
- Production PowerShell patterns: JSON state store, structured logging, trend delta computation
- Vault has 1088 .md files, 20 active projects, 67 session archives, 26 commits/week
- Knowledge Base: 4 Index.md files (root + 3 subdirs) → duplicate entries
- Daily-Logs directory: does NOT exist → empty "Today's Tasks"

### Metis Review
**Identified Gaps** (addressed):
- Missing core objective → fixed: one crisp sentence
- Missing scope IN/OUT → added explicit Must Have / Must NOT Have
- Missing test strategy → added: agent-executed QA
- pulse.sh parity → user confirmed: fix both
- pulse.md consumer → user confirmed: humans (Obsidian)
- Gitignore root cause → user confirmed: fix gitignore first
- Outstanding questions → all resolved

---

## Work Objectives

### Core Objective
Fix the pulse report's empty sections, stale git-dirty metric, and duplicate entries while adding a composite health score (0-100) with trend tracking — keep the existing report format but make it clean, accurate, and useful.

### Concrete Deliverables
- `.gitignore` excludes `node_modules/`, `.omo/`, generated files
- `pulse.ps1` produces clean report: no empty sections, no duplicate entries, structured sections
- `pulse.sh` mirrors the critical fixes (no empty sections, no duplicates)
- `.stignore` includes `.omo/` for device-local state
- Pulse report has "## Vault Health" section with score + sub-scores
- Pulse report has "## Recommendations" section with actionable items
- `.omo/pulse-trend.json` stores machine-readable state for delta computation
- All changes git-committed

### Must Have
- Gitignore excludes node_modules/, .omo/, temp/generated files
- Pulse.ps1 skips "Today's Tasks" when Daily-Logs dir missing (no empty heading)
- Pulse.ps1 deduplicates "Latest Knowledge" (unique basenames only)
- Pulse.ps1 reports meaningful git metrics (commits last 7 days, not uncommitted count)
- Pulse.ps1 computes 4-factor health score: link density, freshness, connectivity, consistency
- Pulse report contains "Vault Health" section with score + sub-score breakdown
- Pulse report contains "Recommendations" section (≥2 actionable items)
- Trend JSON stored at .omo/pulse-trend.json, read-previous/delta-compute/write-current
- All changes git-committed conventionally

### Must NOT Have (Guardrails)
- No PKM audit features (orphan files, broken links, tag hygiene, weak clusters)
- No agentmemory ingestion
- No alerting/notification infrastructure
- No Obsidian dashboard rendering
- No cross-device trend sync
- No changes to loop-evaluator.ps1 or loop-maker-checker.ps1
- No changes to circuit breaker state machine (keep v3 design)
- No changes to scheduled task configuration
- No changes to loop-vault-pulse.ps1 except the pulse report template (keep lock, CB, kill-switch intact)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (PowerShell + git)
- **Automated tests**: None (PowerShell scripts, no test framework)
- **Agent QA**: Every task verified by running the script and checking output

### QA Policy
Every task MUST include agent-executed QA scenarios.
- **PowerShell tests**: Run pulse.ps1, examine output for empty sections, duplicates, score presence
- **Gitignore tests**: Verify git status count drops significantly
- **Trend tests**: Run pulse twice, verify trend JSON has both entries
- **Health score tests**: Verify score is 0-100 and non-null

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — all parallel):
├── Task 1: Fix .gitignore [quick]
├── Task 2: Fix pulse.ps1 base issues [unspecified-high]
├── Task 3: Fix pulse.sh [quick]
└── Task 4: Add Syncthing guard [quick]

Wave 2 (Health metrics — after Wave 1, T5→T7 sequential):
├── Task 5: Add health metric scanner to pulse.ps1 [unspecified-high]
├── Task 6: Add JSON trend store (parallel with T5) [quick]
└── Task 7: Add health score + recommendations (after T5) [unspecified-high]

Wave 3 (Integration — after Wave 2):
├── Task 8: Wire new sections into loop-vault-pulse.ps1 [unspecified-high]
├── Task 9: End-to-end integration test [quick]
└── Task 10: Git commit all [quick]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix
- **1**: — → 5, 8
- **2**: — → 5, 6, 7
- **3**: — → 10
- **4**: — → 10
- **5**: 1, 2 → 7, 8
- **6**: 2 → 8
- **7**: 5 → 8
- **8**: 5, 6, 7 → 9, 10
- **9**: 8 → 10
- **10**: 3, 4, 8, 9 → F1-F4

---

## TODOs

- [x] 1. Fix .gitignore to exclude node_modules/, .omo/, and generated files

  **What to do**:
  - Edit `.gitignore` in vault root
  - Add explicit entries:
    ```
    node_modules/
    .omo/
    generated/
    *.log
    pulse-test-output.txt
    ```
  - Verify existing patterns don't conflict
  - **After editing .gitignore, untrack already-cached files**: `git rm --cached -r .omo/` (this removes .omo/ from git's index without deleting the files)
  - Also run `git rm --cached -r node_modules/` if node_modules was previously tracked
  - Run `git status --short` before and after to confirm the count drops significantly

  **Must NOT do**:
  - Don't add patterns that would exclude vault content files (.md, .ps1, .sh, .json)
  - Don't remove existing gitignore entries
  - Don't use `git rm -r` (without `--cached`) — that would DELETE the files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple text file edit, single file
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 8
  - **Blocked By**: None (start immediately)

  **References**:
  - `.gitignore` — current gitignore file
  - `AGENTS.md:162-165` — `.stignore` device-local items pattern (working-memory.md, opencode data)
  - Research finding: 602 uncommitted changes is inflated by node_modules and .omo/ files

  **Acceptance Criteria**:
  - [ ] .omo/ is excluded from git tracking
  - [ ] node_modules/ is excluded from git tracking
  - [ ] git status count drops from 602 to <100 (mostly vault content)
  - [ ] Vault .md/.ps1/.sh files are still tracked

  **QA Scenarios**:
  ```
  Scenario: Gitignore fix reduces uncommitted count
    Tool: Bash (PowerShell)
    Steps:
      1. git status --short | Measure-Object
    Expected Result: Count significantly less than 602 (target: <100)
    Evidence: .omo/evidence/loop-v4-task1-git-status.txt

  Scenario: Vault content still tracked
    Tool: Bash
    Steps:
      1. git check-ignore 00-System/Tools/pulse.ps1
    Expected Result: File is NOT ignored (returns empty)
    Evidence: .omo/evidence/loop-v4-task1-content-tracked.txt
  ```

  **Evidence to Capture**:
  - [ ] git status count before and after
  - [ ] Confirmation vault content files are not ignored

  **Commit**: NO (groups with Task 10)

- [x] 2. Fix pulse.ps1 — suppress empty sections, deduplicate, use meaningful git metrics

  **What to do**:
  - Edit `00-System/Tools/pulse.ps1`
  - Fix 1 — "Today's Tasks" section:
    - Check if `00-System/Daily-Logs/$Today.md` exists
    - If NOT: skip the entire section (don't emit the heading)
    - If YES: emit the section as before
  - Fix 2 — "Latest Knowledge" deduplication:
    - After collecting file basenames, apply `Select-Object -Unique`
    - Or use a hash set to track seen names
  - Fix 3 — Replace uncommitted changes count with meaningful git metrics:
    - Remove the 602-style raw count from pulse.ps1 (it's handled by loop-vault-pulse.ps1's wrapper)
    - Add: commits in last 7 days: `git log --oneline --since="7 days ago" --count`
    - Add: active branches (local, not remote)
  - Fix 4 — General structure:
    - Add explicit `-Depth 2` to Knowledge Base scan (avoid excessive recursion)
    - Ensure all sections handle missing data gracefully

  **Must NOT do**:
  - Don't change the overall output format (keep markdown sections)
  - Don't add health scoring here (that's Task 5)
  - Don't change pulse.sh (that's Task 3)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple coordinated changes, edge case handling
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6, 7
  - **Blocked By**: None (start immediately)

  **References**:
  - `00-System/Tools/pulse.ps1` — Current 54-line pulse generator
  - `00-System/Tools/loop-vault-pulse.ps1:569-631` — The report template that consumes pulse.ps1 output
  - Research: Daily-Logs directory does NOT exist, KB has 4 Index.md files

  **Acceptance Criteria**:
  - [ ] No "Today's Tasks" heading when Daily-Logs dir missing
  - [ ] "Latest Knowledge" shows unique entries (no duplicate Index)
  - [ ] Git metric shows commits last 7 days (not raw uncommitted count)
  - [ ] KB scan uses -Depth 2
  - [ ] Script completes under 10s on current vault
  - [ ] Running pulse.ps1 produces valid markdown output

  **QA Scenarios**:
  ```
  Scenario: No empty Today's Tasks section
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\pulse.ps1
      2. Check 70-Memory/context/pulse.md for "Today's Tasks"
    Expected Result: If Daily-Logs dir missing, "Today's Tasks" heading NOT present
    Evidence: .omo/evidence/loop-v4-task2-no-empty-section.txt

  Scenario: No duplicate Knowledge entries
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\pulse.ps1
      2. Check output for duplicate basenames
    Expected Result: Each basename appears at most once
    Evidence: .omo/evidence/loop-v4-task2-no-dupes.txt

  Scenario: Git metrics are meaningful
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\pulse.ps1
      2. Check output for commits count
    Expected Result: Commits in last 7 days > 0
    Evidence: .omo/evidence/loop-v4-task2-git-metrics.txt
  ```

  **Evidence to Capture**:
  - [ ] No empty "Today's Tasks" heading
  - [ ] No duplicate entries in Latest Knowledge
  - [ ] Git commits count in output

  **Commit**: NO (groups with Task 10)

- [x] 3. Fix pulse.sh — mirror critical fixes from pulse.ps1

  **What to do**:
  - Edit `00-System/Tools/pulse.sh`
  - Mirror the exact same fixes from Task 2:
    - Fix 1: Skip "Today's Tasks" section when Daily-Logs dir missing (use `[ -f ]` check)
    - Fix 2: Deduplicate Knowledge entries (use `sort -u` after collecting basenames)
    - Fix 3: Use meaningful git metrics instead of raw count
    - Add `-maxdepth 2` to find command for Knowledge Base scan
  - Keep the bash idiom and style consistent with the existing file

  **Must NOT do**:
  - Don't rewrite in a different language (keep as bash)
  - Don't fix pulse.ps1 bugs in pulse.sh only (mirror, don't diverge)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Mirror fixes, small bash script (~50 lines)
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Task 10
  - **Blocked By**: None (start immediately)

  **References**:
  - `00-System/Tools/pulse.sh` — Current bash pulse generator
  - Task 2 implementation — pulse.ps1 fixes to mirror

  **Acceptance Criteria**:
  - [ ] pulse.sh skips Today's Tasks when Daily-Logs dir missing
  - [ ] pulse.sh deduplicates Knowledge entries
  - [ ] pulse.sh uses -maxdepth 2 for KB scan
  - [ ] pulse.sh produces valid output (can be verified by reading output)

  **QA Scenarios**:
  ```
  Scenario: pulse.sh has no empty Today's Tasks
    Tool: Bash (bash)
    Steps:
      1. Check pulse.sh for Daily-Logs existence check
    Expected Result: Uses [ -f ] or similar check before emitting heading
    Evidence: .omo/evidence/loop-v4-task3-sh-fix.txt

  Scenario: pulse.sh deduplicates and limits depth
    Tool: Bash (bash)
    Steps:
      1. Check pulse.sh for sort -u or dedup logic
      2. Check pulse.sh for -maxdepth in the find command (must be before the -path, not after -exec)
      3. Verify syntax: `find 20-Knowledge-Base -maxdepth 2 -name "*.md"` (BSD find requires -maxdepth before tests)
    Expected Result: Knowledge entries deduplicated, -maxdepth 2 placed correctly before -name filter
    Evidence: .omo/evidence/loop-v4-task3-sh-dedup.txt
  ```

  **Evidence to Capture**:
  - [ ] Daily-Logs check present in pulse.sh
  - [ ] Dedup logic present in pulse.sh

  **Commit**: NO (groups with Task 10)

- [x] 4. Add Syncthing guard — ensure .omo/ is in .stignore

  **What to do**:
  - Check if `.stignore` exists in vault root
  - If not → create it with:
    ```
    .omo/
    .omo/*
    node_modules/
    ```
  - If exists → verify `.omo/` is already present; add if missing
  - This ensures circuit breaker state, slot storage, and trend data stay device-local

  **Must NOT do**:
  - Don't add overly broad ignore patterns
  - Don't remove existing .stignore entries

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file check/add, trivial
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Task 10
  - **Blocked By**: None (start immediately)

  **References**:
  - `.stignore` (may not exist) — Syncthing ignore file
  - `AGENTS.md:147-174` — Device-local section; lists working-memory.md, opencode DB/config, agentmemory data
  - `AGENTS.md:162-165` — `.stignore` device-local entries (pattern to follow)

  **Acceptance Criteria**:
  - [ ] .omo/ is in .stignore
  - [ ] .omo/* is in .stignore
  - [ ] Existing .stignore entries preserved
  - [ ] node_modules/ also in .stignore (if file was created)

  **QA Scenarios**:
  ```
  Scenario: .omo/ in .stignore
    Tool: Bash
    Steps:
      1. Select-String -Path .stignore -Pattern ".omo"
    Expected Result: .omo/ is listed
    Evidence: .omo/evidence/loop-v4-task4-stignore.txt
  ```

  **Evidence to Capture**:
  - [ ] .omo/ listed in .stignore

  **Commit**: NO (groups with Task 10)

- [x] 5. Add health metric scanner to pulse.ps1 (Kiroshi 4-factor: link density, freshness, connectivity, consistency)

  **What to do**:
  - Edit `00-System/Tools/pulse.ps1`
  - Add a new "Vault Health" section that computes a Kiroshi-style 4-factor health score:
    1. **Link density (25%)** — count `[[wikilinks]]` in content .md files vs file count
       - **Sample approach**: Scan ONLY content directories (10-Projects/, 20-Knowledge-Base/, 70-Memory/) — skip .omo/, node_modules/, .git/ to keep scan fast
       - `Get-ChildItem -Path "10-Projects","20-Knowledge-Base","70-Memory" -Filter *.md -Recurse | ForEach-Object { Select-String -Pattern '\[\[([^\]]+)\]\]' -Path $_ }`
       - Score = min(25, actual_links_per_file / 3 * 25)
    2. **Freshness (25%)** — % of files edited in last 30 days
       - `Get-ChildItem *.md -Recurse -Exclude "node_modules/*", ".omo/*" | Where LastWriteTime -gt (Get-Date).AddDays(-30) | Measure-Object`
       - Score = min(25, fresh_count / total_count * 25)
    3. **Connectivity (25%)** — orphan detection (files with 0 inbound wikilinks)
       - Parse content .md files for `[[target]]`, collect targets → find files NOT targeted
       - Score = min(25, (1 - orphan_count / total_count) * 25)
    4. **Consistency (25%)** — writing streak (days with edits in last 14 days)
       - Check git log for commits per day in last 14 days
       - Score = min(25, active_days / 14 * 25)
  - Total score = sum of 4 sub-scores (0-100)
  - Add score color: Green ≥80, Yellow ≥50, Red <50
  - **Performance guard**: Use `$timer = [Diagnostics.Stopwatch]::StartNew()`, abort scan if > 120s
  - **Edge case guard**: Use `[Math]::Max(1, $totalFiles)` to prevent division by zero

  **Must NOT do**:
  - Don't modify existing sections of pulse.ps1 (preserve all current output)
  - Don't write trend data here (that's Task 6)
  - Don't add external dependencies

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Complex PowerShell scripting, file scanning, scoring algorithm
  - **Skills**: `["code-review-and-quality"]`
    - `code-review-and-quality`: Ensures PowerShell code quality, edge cases, and error handling

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Tasks 7, 8
  - **Blocked By**: Tasks 1, 2

  **References**:
  - Kiroshi Health Score: 4 equal factors (link density, freshness, connectivity, consistency)
  - `00-System/Tools/pulse.ps1` — Target file
  - PowerShell: `Select-String -Pattern '\[\[([^\]]+)\]\]'` for wikilink detection
  - PowerShell: `[Diagnostics.Stopwatch]` for performance measurement

  **Acceptance Criteria**:
  - [ ] Health score computed as 0-100 integer
  - [ ] All 4 sub-scores present with individual values
  - [ ] Score color-coded: Green/Yellow/Red
  - [ ] Division by zero handled (empty vault)
  - [ ] Scanner aborts if > 45s
  - [ ] Existing pulse.ps1 sections unchanged

  **QA Scenarios**:
  ```
  Scenario: Health score is 0-100
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\pulse.ps1
      2. Check pulse.md for "Vault Health" section
    Expected Result: Score is integer between 0-100, all 4 sub-scores present
    Evidence: .omo/evidence/loop-v4-task5-score.txt

  Scenario: Score color is correct
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\pulse.ps1
      2. Check score color indicator
    Expected Result: Green ≥80, Yellow ≥50, Red <50
    Evidence: .omo/evidence/loop-v4-task5-color.txt

  Scenario: Performance within limit
    Tool: Bash (PowerShell)
    Steps:
      1. Measure-Command { .\00-System\Tools\pulse.ps1 }
    Expected Result: Under 45s
    Evidence: .omo/evidence/loop-v4-task5-perf.txt
  ```

  **Evidence to Capture**:
  - [ ] Score output with all 4 sub-scores
  - [ ] Score color matches threshold
  - [ ] Execution time under 45s

  **Commit**: NO (groups with Task 10)

- [x] 6. Add JSON trend store at .omo/pulse-trend.json

  **What to do**:
  - Edit `00-System/Tools/pulse.ps1`
  - Add a `Write-TrendData` function at the end:
    - Read previous entries from `.omo/pulse-trend.json` (graceful if missing/corrupt)
    - Append new entry with: timestamp, score, subScores (linkDensity, freshness, connectivity, consistency), fileCount, commitCount
    - **FIFO eviction**: Sort entries by timestamp ascending, keep latest 90, discard oldest. Use explicit sort before truncation to handle out-of-order entries.
    - Atomic write: write to `.tmp` file → `Rename-Item`
  - Call `Write-TrendData` after health score computation
  - Add a trend line to pulse output: `Score: 72 -> 74 (+2)` based on previous entry delta

  **Must NOT do**:
  - Don't store personally identifiable data (no file paths, no content)
  - Don't keep more than 90 entries
  - Don't fail if trend file is corrupt (reset gracefully)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Well-defined function, known pattern from CB atomic write
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 8
  - **Blocked By**: Task 2

  **References**:
  - `.omo/loop-circuit-breaker.json` pattern — existing atomic write
  - `loop-vault-pulse.ps1:165-189` — Write-CircuitBreaker (temp file + rename)

  **Acceptance Criteria**:
  - [ ] Trend JSON written to .omo/pulse-trend.json
  - [ ] JSON valid with timestamp + score + subScores
  - [ ] Two runs = two entries (append, not overwrite)
  - [ ] Corrupt JSON resets gracefully
  - [ ] Max 90 entries enforced
  - [ ] Atomic write (temp + rename)

  **QA Scenarios**:
  ```
  Scenario: Trend JSON created on first run
    Tool: Bash (PowerShell)
    Steps:
      1. Remove-Item .omo/pulse-trend.json -Force -ErrorAction SilentlyContinue
      2. .\00-System\Tools\pulse.ps1
      3. Get-Content .omo/pulse-trend.json | ConvertFrom-Json
    Expected Result: Valid JSON with 1 entry, score + timestamp
    Evidence: .omo/evidence/loop-v4-task6-trend-created.txt

  Scenario: Second run appends
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\pulse.ps1
      2. Get-Content .omo/pulse-trend.json | ConvertFrom-Json | Measure-Object
    Expected Result: 2 entries
    Evidence: .omo/evidence/loop-v4-task6-trend-appended.txt
  ```

  **Evidence to Capture**:
  - [ ] Trend JSON valid with 1+ entries
  - [ ] Entries appended
  - [ ] Atomic write pattern

  **Commit**: NO (groups with Task 10)

- [x] 7. Add health score and recommendations section to pulse report

  **What to do**:
  - Edit `00-System/Tools/pulse.ps1`
  - Add a "## Vault Health" section:
    ```
    ## Vault Health
    - Overall Score: **74/100** 🟡
    - Link Density: 18/25 (X links per file)
    - Freshness: 22/25 (XX% files edited in 30d)
    - Connectivity: 20/25 (X% orphan files)
    - Consistency: 14/25 (X active days in last 14)
    ```
  - Add a "## Recommendations" section with auto-generated items:
    - If link density < 15: "Add more wikilinks (target: ≥3 links/note)"
    - If freshness < 15: "Review stale notes — XX files untouched for 30+ days"
    - If connectivity < 15: "Add backlinks to XX orphan files"
    - If consistency < 10: "Write more consistently — only X active days in 14"
    - If overall < 50: "Vault health needs attention — focus on low sub-scores"
  - Max 5 recommendations (don't overwhelm)

  **Must NOT do**:
  - Don't include specific file paths (too noisy)
  - Don't remove existing sections

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Conditional report formatting, score rendering
  - **Skills**: `["code-review-and-quality"]`
    - `code-review-and-quality`: Ensures report output quality, edge case handling for empty score scenarios

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 8
  - **Blocked By**: Task 5

  **References**:
  - `00-System/Tools/pulse.ps1` — Target file

  **Acceptance Criteria**:
  - [ ] "Vault Health" section with score 0-100
  - [ ] All 4 sub-scores listed
  - [ ] "Recommendations" with ≥2 items
  - [ ] Recommendations relevant to actual scores
  - [ ] Existing sections unchanged

  **QA Scenarios**:
  ```
  Scenario: Vault Health section present
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\pulse.ps1
      2. Select-String -Path 70-Memory/context/pulse.md -Pattern "Vault Health"
    Expected Result: Section found with score
    Evidence: .omo/evidence/loop-v4-task7-health-section.txt

  Scenario: Recommendations present
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\pulse.ps1
      2. Select-String -Path 70-Memory/context/pulse.md -Pattern "Recommendations"
    Expected Result: Section found with ≥2 items
    Evidence: .omo/evidence/loop-v4-task7-recs.txt
  ```

  **Evidence to Capture**:
  - [ ] Vault Health section with score
  - [ ] Recommendations section

  **Commit**: NO (groups with Task 10)

- [x] 8. Wire new sections into loop-vault-pulse.ps1 report template

  **What to do**:
  - Edit `00-System/Tools/loop-vault-pulse.ps1`
  - **Increase** `$PulseTimeoutSeconds` from 60 to 120 (line ~32): the new health scanner may take ~60s on its own, and the 60s timeout would cause false "timed_out" results
  - In the report template (Step 6, lines ~569-631):
    - The raw pulse.ps1 output is already included in the "Raw Pulse Output" section
    - Add a reference to the health score from pulse.ps1 in the report header area
    - Read `.omo/pulse-trend.json` and include the trend delta in the "Trend" section:
      - Replace the current trend logic (uncommitted changes diff) with score-based trend
      - Show: `Health Score: 72 -> 74 (+2)` instead of `Uncommitted: 602 -> 602 (= 0)`
    - Keep all existing sections (Circuit Breaker Health, Pulse Execution, etc.) unchanged
    - The "Projects" section should remain — it lists active projects from directory scan

  **Must NOT do**:
  - Don't change circuit breaker logic, kill switch, PID lock, or any non-report functionality
  - Don't remove existing sections
  - Don't touch loop-evaluator.ps1 or loop-maker-checker.ps1

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integrating new metrics into existing report template, careful modifications
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 9, 10
  - **Blocked By**: Tasks 5, 6, 7

  **References**:
  - `00-System/Tools/loop-vault-pulse.ps1:569-631` — Report template
  - `00-System/Tools/loop-vault-pulse.ps1:526-564` — Current trend tracking section
  - `00-System/Tools/loop-vault-pulse.ps1:593-631` — Full report assembly

  **Acceptance Criteria**:
  - [ ] Trend section shows score-based delta (not uncommitted changes)
  - [ ] Health score referenced in report header or trend
  - [ ] All existing loop-vault-pulse sections unchanged
  - [ ] Circuit breaker, kill switch, PID lock unchanged
  - [ ] Report still valid markdown

  **QA Scenarios**:
  ```
  Scenario: Trend shows health score delta
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\loop-vault-pulse.ps1
      2. Check output for "Health Score" in Trend section
    Expected Result: Trend section shows score delta (not uncommitted count)
    Evidence: .omo/evidence/loop-v4-task8-trend-score.txt

  Scenario: CB section still present
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\loop-vault-pulse.ps1
      2. Check output for "Circuit Breaker Health"
    Expected Result: Section present with state, failures, successes
    Evidence: .omo/evidence/loop-v4-task8-cb.txt
  ```

  **Evidence to Capture**:
  - [ ] Score delta in trend section
  - [ ] CB section unchanged

  **Commit**: NO (groups with Task 10)

- [x] 9. End-to-end integration test

  **What to do**:
  - Run the full pipeline: `.\00-System\Tools\loop-vault-pulse.ps1`
  - Verify everything works together:
    1. Kill-switch check passes
    2. PID lock acquired
    3. Circuit breaker check: CLOSED
    4. pulse.ps1 runs within 60s
    5. Health score computed (0-100)
    6. Recommendations generated
    7. Trend JSON updated
    8. Report written to pulse.md
    9. Circuit breaker updated (successes incremented)
    10. Exit code 0
  - Run twice to verify trend tracking works across runs

  **Must NOT do**:
  - Don't modify any files in this task
  - Don't leave stale test data

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Running commands and verifying output
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 10
  - **Blocked By**: Task 8

  **References**:
  - All modified files from Tasks 1-8

  **Acceptance Criteria**:
  - [ ] loop-vault-pulse.ps1 exits 0
  - [ ] pulse.md contains Vault Health section
  - [ ] pulse.md contains Recommendations section
  - [ ] Trend JSON has entries from both runs
  - [ ] Circuit breaker still CLOSED
  - [ ] No evidence of stale data or errors

  **QA Scenarios**:
  ```
  Scenario: Full pipeline runs successfully
    Tool: Bash (PowerShell)
    Steps:
      1. .\00-System\Tools\loop-vault-pulse.ps1
      2. Check $LASTEXITCODE
    Expected Result: Exit 0
    Evidence: .omo/evidence/loop-v4-task9-exit-code.txt

  Scenario: All report sections present
    Tool: Bash (PowerShell)
    Steps:
      1. Check pulse.md for all expected sections
    Expected Result: Vault Health, Recommendations, Circuit Breaker Health, Pulse Execution, Trend sections all present
    Evidence: .omo/evidence/loop-v4-task9-sections.txt
  ```

  **Evidence to Capture**:
  - [ ] Exit code 0
  - [ ] All report sections present

  **Commit**: NO (groups with Task 10)

- [x] 10. Git commit all changes

  **What to do**:
  - Stage + commit:
    - `00-System/Tools/pulse.ps1`
    - `00-System/Tools/pulse.sh`
    - `00-System/Tools/loop-vault-pulse.ps1`
    - `.gitignore`
    - `.stignore` (if created/modified)
  - Message: `feat(vault): add vault health score, trend tracking, and clean up pulse report`
  - Pre-commit: run `.\00-System\Tools\pulse.ps1` and verify no errors

  **Must NOT do**:
  - No .omo evidence files in commit
  - No .omo/pulse-trend.json in commit
  - No git push

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Git operations
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Tasks 3, 4, 8, 9

  **References**:
  - `AGENTS.md:108` — Conventional commit format (`feat|fix|refactor|docs|test|chore: <desc>`)
  - V3 commit pattern: `6b79500 feat(vault): add circuit breaker resilience...`

  **Acceptance Criteria**:
  - [ ] git log shows new commit with all 4-5 files
  - [ ] git status clean for those files
  - [ ] Conventional commit format
  - [ ] No evidence files in commit

  **QA Scenarios**:
  ```
  Scenario: Git commit succeeds
    Tool: Bash (git)
    Steps:
      1. git log --oneline -3
      2. git diff --name-only HEAD~1..HEAD
    Expected Result: Latest commit shows pulse.ps1, pulse.sh, loop-vault-pulse.ps1
    Evidence: .omo/evidence/loop-v4-task10-git.txt
  ```

  **Evidence to Capture**:
  - [ ] Git log shows conventional commit
  - [ ] Working tree clean for modified files

  **Commit**: YES
  - Message: `feat(vault): add vault health score, trend tracking, and clean up pulse report`
  - Files: `00-System/Tools/pulse.ps1`, `00-System/Tools/pulse.sh`, `00-System/Tools/loop-vault-pulse.ps1`, `.gitignore`, `.stignore`
  - Pre-commit: `.\00-System\Tools\pulse.ps1` — must exit 0

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, run pulse.ps1, check output). For each "Must NOT Have": search for forbidden patterns. Check evidence files exist.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Review all changed files for: Powershell quality, error handling, no hardcoded paths, edge cases handled. Check .gitignore is correct, .stignore entry present.
  Output: `Scripts [PASS/FAIL] | Gitignore [PASS/FAIL] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: Daily-Logs missing, KB empty, first run with no trend baseline.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  1:1 compliance: everything in scope was built, nothing beyond scope. Check "Must NOT do" compliance. Check pulse.sh mirrors pulse.ps1.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **Final commit**: `feat(vault): add vault health score, trend tracking, and clean up pulse report`
  Pre-commit: run pulse.ps1 and verify all sections populated, score is 0-100
  Files: `00-System/Tools/pulse.ps1`, `00-System/Tools/pulse.sh`, `.gitignore`, `.stignore`, `00-System/Tools/loop-vault-pulse.ps1`

---

## Success Criteria

### Verification Commands
```powershell
# Run pulse and check output
.\00-System\Tools\pulse.ps1
# Expected: No empty "Today's Tasks" heading, no duplicate Knowledge entries, "## Vault Health" section with score

# Check git status after fix
git status --short | Measure-Object | Select-Object -ExpandProperty Count
# Expected: Significantly less than 602

# Check trend JSON
Test-Path .omo/pulse-trend.json
Get-Content .omo/pulse-trend.json | ConvertFrom-Json
# Expected: Valid JSON with score, fileCount, freshness, linkDensity, connectivity fields

# Check git commit
git log --oneline -3
# Expected: feat(vault): add vault health score...
```

### Final Checklist
- [ ] .gitignore excludes node_modules/, .omo/
- [ ] pulse.ps1 has no empty Today's Tasks heading
- [ ] pulse.ps1 Latest Knowledge shows unique entries
- [ ] pulse.sh mirrors critical fixes
- [ ] .stignore includes .omo/
- [ ] pulse report has "Vault Health" section with score 0-100
- [ ] pulse report has "Recommendations" with ≥2 items
- [ ] trend JSON stores score and sub-scores
- [ ] git log shows conventional commit
- [ ] git status under 100 changes (proves gitignore fix)
