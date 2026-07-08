# Plan: Skill Consolidation

## TL;DR

> **Quick Summary**: Copy 8 skills from C: drive locations to vault `.opencode/skills/`, remove 4 duplicates from C:, delete 1 empty orphan, reconcile officecli version divergence. Then git-track the vault skills.
>
> **Deliverables**:
> - 5 understand-anything skills copied to vault (understand-chat, understand-dashboard, understand-diff, understand-knowledge, understand-onboard)
> - 2 security skills copied to vault (security-research, security-review)
> - Officecli reconciled (vault gets newer 290-line version)
> - 4 C: duplicates removed (3 junctions removed, 1 directory deleted)
> - `document-skills/` empty orphan deleted
> - All `.opencode/skills/` git-tracked
>
> **Estimated Effort**: Short
> **Parallel Execution**: Mostly sequential (copy → delete → verify → commit)
> **Critical Path**: Copy → Delete → Verify → Commit

---

## Context

### Original Request
Consolidate skills scattered across C: and D: drives into vault as single source of truth.

### Interview Summary
**Key Decisions**:
- Copy unique C: skills to vault, delete duplicate C: copies
- Vault is source of truth
- Officecli: merge newer `.claude` version into vault (keep `.claude` copy for Claude Code)
- `document-skills/` empty orphan: delete
- npm packages (superpowers, etc.): stay untouched (plugin-managed)
- All vault `.opencode/skills/` to be git-committed after consolidation

**Key Discoveries**:
- All `understand*` skills in `.agents/skills/` are **Windows junctions** pointing to `C:\Users\azizm\.understand-anything\repo\understand-anything-plugin\skills\`
- 3 duplicates (understand, understand-domain, understand-explain) — vault copies are identical to source
- 5 new skills (understand-chat, understand-dashboard, understand-diff, understand-knowledge, understand-onboard) — not in vault
- Officecli vault copy (412 lines) is older than `.claude` copy (415 lines)
- Vault `.opencode/skills/` is **not git-tracked** (0 files committed)

### Metis Review
**Identified Gaps** (addressed):
- Officecli version divergence (vault 412 vs `.claude` 415 lines) → Merge: vault gets newer
- Vault skills not git-tracked → Plan includes `git add` + commit
- Junction handling (deleting junctions vs the target) → Remove junctions, leave target intact
- `document-skills` empty orphan → Delete
- `test-driven-development` in both vault + superpowers npm → Vault takes precedence (noted)

---

## Work Objectives

### Core Objective
Consolidate C: drive skill directories (`.agents/`, `.claude/`, `.cache/opencode/skills/`) into the vault `.opencode/skills/` as the single source of truth — copy unique skills, remove duplicates, reconcile officecli version, enable git tracking.

### Concrete Deliverables
- 8 skills copied to vault (5 from understand-anything repo, 2 from `.cache/opencode/skills/`, 1 merged officecli)
- 4 C: drive duplicates removed (3 junctions + 1 real directory)
- `document-skills/` empty orphan deleted from vault
- All `.opencode/skills/` committed to git

### Must Have
- All 8 source directories are fully copied to vault (entire directory, including any non-SKILL.md files)
- Copied files are byte-for-byte identical to originals
- C: drive deletions only remove what's specified — nothing extra
- Junction removals leave the target repo (`C:\Users\azizm\.understand-anything\`) intact
- `.claude/skills/officecli/` is preserved for Claude Code
- Vault `.opencode/skills/` is git-committed

### Must NOT Have (Guardrails)
- No SKILL.md content editing (reorganization only)
- No touching `.cache/opencode/packages/` or npm plugin skills
- No changes to `opencode.json`, MCP configs, agentmemory, or workflows
- No touching `00-System/Skills/README.md` (separate task)
- No touching `00-System/Skills/archive/` (148 ECC reference skills)
- No touchig `C:\Users\azizm\.understand-anything\` repo or its contents
- No renaming, restructuring, or normalizing skill directory names

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: N/A (file reorganization, no code)
- **Automated tests**: NONE
- **Framework**: N/A
- **Verification method**: File existence checks, byte-for-byte diff, junction status check, git status

### QA Policy
Every task includes agent-executed QA scenarios. Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Copy phase — all independent copies):
├── Task 1: Copy 5 understand-anything skills to vault [quick]
├── Task 2: Copy 2 security skills to vault [quick]
└── Task 3: Merge officecli (overwrite vault with .claude version) [quick]

Wave 2 (Cleanup phase — after Wave 1):
├── Task 4: Remove 4 C: drive duplicates [quick]
└── Task 5: Delete document-skills empty orphan [quick]

Wave 3 (Verification — after Wave 2):
├── Task 6: Verify all copies + deletions [quick]

Wave FINAL:
├── Task F1: Git add + commit vault skills [git]
└── Task F2: Final verification sweep [quick]
```

### Dependency Matrix
- **1**: - → 4, 6
- **2**: - → 6
- **3**: - → 6
- **4**: 1 → 6
- **5**: - → 6
- **6**: 1,2,3,4,5 → F1, F2
- **F1**: 6 → -
- **F2**: 6 → -

### Agent Dispatch Summary
- **Wave 1**: 3 tasks → `quick`
- **Wave 2**: 2 tasks → `quick`
- **Wave 3**: 1 task → `quick`
- **Final**: 2 tasks → `git`, `quick`

---

## TODOs

- [x] 1. Copy 5 understand-anything junction skills to vault

  **What to do**:
  - Copy entire skill directories from the junction TARGET to vault:
    - `C:\Users\azizm\.understand-anything\repo\understand-anything-plugin\skills\understand-chat\` → `D:\projects\obsidian\second brain\.opencode\skills\understand-chat\`
    - Similarly for: understand-dashboard, understand-diff, understand-knowledge, understand-onboard
  - Use `Copy-Item -Recurse` to copy full directory trees
  - Do NOT copy from the junction itself — copy from the junction target path

  **Must NOT do**:
  - Do NOT touch `C:\Users\azizm\.agents\skills\` junctions yet (done in Task 4)
  - Do NOT modify any SKILL.md content

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file copy operation, no logic
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: N/A

  **Parallelization**:
  - **Can Run In Parallel**: YES (runs with Tasks 2, 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 4 (needs copies before deleting junctions), Task 6 (needs copies for verification)
  - **Blocked By**: None

  **References**:
  - Source base: `C:\Users\azizm\.understand-anything\repo\understand-anything-plugin\skills\`
  - Destination base: `D:\projects\obsidian\second brain\.opencode\skills\`
  - Confirm junction status: `(Get-Item "C:\Users\azizm\.agents\skills\understand-chat").Attributes` has `ReparsePoint`

  **Acceptance Criteria**:
  - [ ] All 5 destination directories exist with same file structure as source
  - [ ] `Get-ChildItem -Recurse` on each destination matches source

  **QA Scenarios**:
  ```
  Scenario: Verify understand-chat copied to vault
    Tool: Bash
    Preconditions: Copy completed
    Steps:
      1. Test-Path "D:\projects\obsidian\second brain\.opencode\skills\understand-chat\SKILL.md"
      2. Compare-Object (Get-ChildItem -Recurse "C:\Users\azizm\.understand-anything\repo\understand-anything-plugin\skills\understand-chat") (Get-ChildItem -Recurse "D:\projects\obsidian\second brain\.opencode\skills\understand-chat")
    Expected Result: Path exists. Diff shows no differences.
    Evidence: .omo/evidence/task-1-understand-chat.txt

  Scenario: Verify all 5 skills copied (same pattern for all)
    Tool: Bash
    Steps: Repeat for understand-dashboard, understand-diff, understand-knowledge, understand-onboard
    Expected Result: All 5 exist with matching file trees
    Evidence: .omo/evidence/task-1-all-five.txt
  ```

  **Evidence to Capture**:
  - [ ] Each evidence file shows source vs dest matching
  - [ ] No errors during copy

  **Commit**: NO

---

- [x] 2. Copy 2 security skills from .cache to vault

  **What to do**:
  - Copy from `.cache/opencode/skills/` to vault:
    - `C:\Users\azizm\.cache\opencode\skills\security-research\` → `D:\projects\obsidian\second brain\.opencode\skills\security-research\`
    - `C:\Users\azizm\.cache\opencode\skills\security-review\` → `D:\projects\obsidian\second brain\.opencode\skills\security-review\`
  - These are simple SKILL.md-only directories

  **Must NOT do**:
  - Do NOT delete from `.cache/` — cache is managed by OpenCode package system
  - Do NOT modify SKILL.md content

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 3)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 6
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `D:\projects\obsidian\second brain\.opencode\skills\security-research\SKILL.md` exists
  - [ ] `D:\projects\obsidian\second brain\.opencode\skills\security-review\SKILL.md` exists
  - [ ] Files match originals byte-for-byte

  **QA Scenarios**:
  ```
  Scenario: Verify security-research copied
    Tool: Bash
    Steps:
      1. Test-Path "D:\projects\obsidian\second brain\.opencode\skills\security-research\SKILL.md"
      2. $src = Get-FileHash "C:\Users\azizm\.cache\opencode\skills\security-research\SKILL.md"; $dst = Get-FileHash "D:\projects\obsidian\second brain\.opencode\skills\security-research\SKILL.md"; $src.Hash -eq $dst.Hash
    Expected Result: True
    Evidence: .omo/evidence/task-2-security-hashes.txt
  ```
  **Evidence to Capture**:
  - [ ] Hash comparison showing match

  **Commit**: NO

---

- [x] 3. Merge officecli — overwrite vault with newer .claude version

  **What to do**:
- Vault currently has 412-line officecli SKILL.md (older)
- `.claude/skills/officecli/SKILL.md` has 415-line version (newer — has `--find`/`--replace` syntax, Excel row-by-column selectors)
  - Copy `C:\Users\azizm\.claude\skills\officecli\` to `D:\projects\obsidian\second brain\.opencode\skills\officecli\` (overwrite vault copy)
  - `.claude/skills/officecli/` stays in place for Claude Code compatibility

  **Must NOT do**:
  - Do NOT delete the `.claude/skills/officecli/` source (it's kept for Claude Code)
  - Do NOT edit content

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Tasks 1, 2)
  - **Parallel Group**: Wave 1
  - **Blocks**: Task 6
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] Vault officecli SKILL.md is now 415 lines (matching `.claude` version)
  - [ ] `.claude/skills/officecli/SKILL.md` still exists

  **QA Scenarios**:
  ```
  Scenario: Verify officecli version merged
    Tool: Bash
    Steps:
      1. $vaultLines = (Get-Content "D:\projects\obsidian\second brain\.opencode\skills\officecli\SKILL.md").Count
      2. $claudeLines = (Get-Content "C:\Users\azizm\.claude\skills\officecli\SKILL.md").Count
      3. Test-Path "C:\Users\azizm\.claude\skills\officecli\SKILL.md"
    Expected Result: vault=415 lines, claude=415 lines, claude copy still exists
    Evidence: .omo/evidence/task-3-officecli-version.txt
  ```
  **Evidence to Capture**:
  - [ ] Line count proof
  - [ ] Claude copy existence proof

  **Commit**: NO

---

- [x] 4. Remove 4 C: drive duplicates

  **What to do**:
  - Remove 3 junctions from `.agents/skills/`:
    - `C:\Users\azizm\.agents\skills\understand` (junction → leave target intact)
    - `C:\Users\azizm\.agents\skills\understand-domain` (junction → leave target intact)
    - `C:\Users\azizm\.agents\skills\understand-explain` (junction → leave target intact)
  - Delete 1 real directory:
    - `C:\Users\azizm\.agents\skills\last30days\` (real directory, vault has full copy)

  **CRITICAL**: For junctions, use `Remove-Item` to remove the junction point only. Do NOT use `rm -rf` which follows junctions and destroys the target. Use `(Get-Item $path).Delete()` or `cmd /c rmdir` for junction-safe removal.

  **Must NOT do**:
  - Do NOT delete the junction TARGET (`C:\Users\azizm\.understand-anything\repo\`)
  - Do NOT delete `C:\Users\azizm\.claude\skills\officecli\` (kept for Claude Code)
  - Do NOT delete `C:\Users\azizm\.agents\skills\understand-chat\` etc. (5 new junction skills — source for Task 1, keep intact)
  - Do NOT delete `C:\Users\azizm\.cache\opencode\skills\security-*` (cache-managed)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 5)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: Task 1 (must copy first before deleting junctions that point to the source)

  **Acceptance Criteria**:
  - [ ] All 3 junctions removed: `Test-Path "C:\Users\azizm\.agents\skills\understand"` → False
  - [ ] Junction target intact: `Test-Path "C:\Users\azizm\.understand-anything\repo\understand-anything-plugin\skills\understand\SKILL.md"` → True
  - [ ] `last30days` directory deleted: `Test-Path "C:\Users\azizm\.agents\skills\last30days"` → False

  **QA Scenarios**:
  ```
  Scenario: Verify understand junction removed, target intact
    Tool: Bash
    Steps:
      1. Test-Path "C:\Users\azizm\.agents\skills\understand"
      2. Test-Path "C:\Users\azizm\.understand-anything\repo\understand-anything-plugin\skills\understand\SKILL.md"
    Expected Result: Junction path = False, Target = True (intact)
    Evidence: .omo/evidence/task-4-junction-removed.txt

  Scenario: Verify last30days deleted
    Tool: Bash
    Steps:
      1. Test-Path "C:\Users\azizm\.agents\skills\last30days"
    Expected Result: False
    Evidence: .omo/evidence/task-4-last30days-deleted.txt
  ```
  **Evidence to Capture**:
  - [ ] Junction removal proof for all 3
  - [ ] Target intact proof for understand-anything repo
  - [ ] last30days deletion proof

  **Commit**: NO

---

- [x] 5. Delete document-skills empty orphan from vault

  **What to do**:
  - Delete empty directory: `D:\projects\obsidian\second brain\.opencode\skills\document-skills\`
  - This directory has ZERO files — already verified as empty

  **Must NOT do**:
  - Do NOT delete any other document-related directories

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 4)
  - **Parallel Group**: Wave 2
  - **Blocks**: Task 6
  - **Blocked By**: None

  **Acceptance Criteria**:
  - [ ] `Test-Path "D:\projects\obsidian\second brain\.opencode\skills\document-skills"` → False

  **QA Scenarios**:
  ```
  Scenario: Verify document-skills deleted
    Tool: Bash
    Steps:
      1. Test-Path "D:\projects\obsidian\second brain\.opencode\skills\document-skills"
    Expected Result: False
    Evidence: .omo/evidence/task-5-orphan-deleted.txt
  ```
  **Evidence to Capture**:
  - [ ] Directory no longer exists

  **Commit**: NO

---

- [x] 6. Verify all copies + deletions

  **What to do**:
  - Run comprehensive verification sweep:
    1. All 8 copied skills exist at vault with correct files
    2. Copied officecli matches `.claude` version (line count, hash)
    3. 5 copied understand skills match source (file tree comparison)
    4. 3 junctions removed from `.agents/skills/`
    5. understand-anything junction target intact
    6. last30days deleted from `.agents/skills/`
    7. document-skills deleted from vault
  - Save all verification evidence

  **Must NOT do**:
  - Do NOT skip any verification step

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Reason**: Simple file existence and comparison checks
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (serial verification sweep)
  - **Parallel Group**: Wave 3
  - **Blocks**: F1 (git commit), F2 (final verification)
  - **Blocked By**: Tasks 1, 2, 3, 4, 5

  **References**:
  - All evidence from Tasks 1-5

  **Acceptance Criteria**:
  - [ ] All 8 copies verified
  - [ ] All 4 C: deletions verified
  - [ ] All 1 vault deletion verified
  - [ ] Junction targets intact
  - [ ] Officecli at vault matches `.claude` version

  **QA Scenarios**:
  ```
  Scenario: Full consolidation verification report
    Tool: Bash
    Steps:
      1. Run comprehensive verification script (see What to do above)
      2. Aggregate results into a single PASS/FAIL report
    Expected Result: ALL checks pass
    Evidence: .omo/evidence/task-6-verification-report.txt
  ```
  **Evidence to Capture**:
  - [ ] Full verification report

  **Commit**: NO

---

## Final Verification Wave

- [x] F1. **Git Add + Commit Vault Skills** — `git`
  Read `git status` to confirm only expected changes exist. `git add .opencode/skills/` and related changes. Commit with message: `chore(skills): consolidate C: drive skills into vault as single source of truth`
  - Verify: `git status` shows clean tree after commit
  - Blocked by: Task 6
  - Runs in parallel with: F2

- [x] F2. **Final Verification Sweep** — `quick`
  After F1: confirm `git log --oneline -1` shows the commit. Confirm `skill` tool (or `ls .opencode/skills/`) shows all ~117 skill directories. Do a quick sanity check that OpenCode can discover the new skills.
  - Verify: git log shows consolidation commit, skill count is ~117, no regressions
  - Blocked by: Task 6
  - Runs in parallel with: F1

---

## Commit Strategy

- **F1**: `chore(skills): consolidate C: drive skills into vault as single source of truth` — includes all copies, deletions, and orphan cleanup

---

## Success Criteria

### Verification Commands
```powershell
# Check all 8 copied skills exist
$skills = @("understand-chat","understand-dashboard","understand-diff","understand-knowledge","understand-onboard","security-research","security-review","officecli")
$skills | ForEach-Object { Test-Path "D:\projects\obsidian\second brain\.opencode\skills\$_\SKILL.md" }

# Check C: deletions
Test-Path "C:\Users\azizm\.agents\skills\understand"  # should be False
Test-Path "C:\Users\azizm\.agents\skills\last30days"   # should be False
Test-Path "D:\projects\obsidian\second brain\.opencode\skills\document-skills"  # should be False

# Check junction targets intact
Test-Path "C:\Users\azizm\.understand-anything\repo\understand-anything-plugin\skills\understand\SKILL.md"  # should be True

# Check Claude copy preserved
Test-Path "C:\Users\azizm\.claude\skills\officecli\SKILL.md"  # should be True

# Check git tracking
git status  # should show clean or only expected files
```

### Final Checklist
- [ ] All 8 copies verified byte-for-byte
- [ ] All 4 C: deletions confirmed
- [ ] Junction targets intact
- [ ] Claude Code officecli preserved
- [ ] document-skills orphan deleted
- [ ] Vault skills git-committed
- [ ] No unintended changes
