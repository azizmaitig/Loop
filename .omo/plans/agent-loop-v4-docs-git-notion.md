# agent-loop v4 — docs/git/Notion sync

## TL;DR

> **Quick Summary**: Update CONTEXT.md to match current v4 codebase reality, bump package.json to 0.4.0, commit pending changes, and sync project status to Notion.
>
> **Deliverables**:
> - CONTEXT.md rewritten to architecture overview (≤200 lines)
> - package.json version `0.0.1` → `0.4.0`
> - Git commit: conventional message, all changes staged
> - Notion: Launch Ops task status "Next" → "Done", project page summary updated
>
> **Estimated Effort**: Quick (~30 min work)
> **Parallel Execution**: Mostly sequential (dependencies are light)
> **Critical Path**: Task 1 → Task 4 → Task 5 → F1-F4

---

## Context

### Original Request
Update docs to match current v4 code, git commit, sync Notion.

### Interview Summary
**Key Discussions**:
- Project has 12 source files, ~1200 LOC, full v4 feature set (MCP exec, HTTP/WS API, plugins, agentmemory, evaluate, daemon)
- CONTEXT.md is stuck at v1 (6 files, ~330 LOC, no mention of MCP/API/plugins)
- package.json stuck at 0.0.1
- One pending change in `src/memory-hooks.ts` (archive path resolution fix)
- No feature/branching — commit direct to main
- ADR creation deferred (MCP/API/plugins decisions not documented yet)

**Research Findings**:
- 147 tests across 11 test files, all passing
- OpenSpec detected in vault root — but agent-loop itself isn't spec-driven
- Notion: task `392b4d21-b591-8144-ac74-f6d49b1f3f3c` in Launch Ops DB (status "Next")
- Notion: project page under App Launch HQ

### Metis Review
**Identified Gaps** (addressed via user confirmation):
- Version confirmed: 0.4.0
- Branch: direct to main
- CONTEXT.md: architecture overview, ≤200 lines
- Notion: task → "Done", project page → update summary
- ADRs: deferred
- Test strategy: run `npm test` before commit for regression

---

## Work Objectives

### Core Objective
Update agent-loop project documentation, version, git state, and Notion status to match the current v4 codebase.

### Concrete Deliverables
- `CONTEXT.md` — rewritten, ≤200 lines, architecture overview
- `package.json` — version field set to `0.4.0`
- Git working tree — clean commit with conventional message
- Notion Launch Ops task — status changed to "Done"
- Notion project page — summary reflects v4

### Definition of Done
- [ ] `head -5 CONTEXT.md` shows v4 architecture, not v1
- [ ] `cat package.json | grep '"version"'` shows `"0.4.0"`
- [ ] `git log --oneline -1` shows conventional commit message
- [ ] Notion task `392b4d21...` status field = "Done"
- [ ] Notion project page overview paragraph mentions v4

### Must Have
- CONTEXT.md ≤200 lines (`wc -l CONTEXT.md`)
- CONTEXT.md must mention all 12 source files at appropriate level
- package.json version change ONLY (no other fields modified)
- Commit message follows vault conventional commit format
- `npm test` passes before commit
- Notion task 392b4d21-b591-8144-ac74-f6d49b1f3f3c: status "Next" → "Done"
- Notion project page 392b4d21-b591-8152-9f9f-cd919f5adee6: summary updated

### Must NOT Have (Guardrails)
- No ADR creation (MCP/API/plugins deferred)
- No dependency version changes
- No script additions or config file edits
- No new features or code changes beyond documentation accuracy
- No Notion database schema changes or kanban board restructuring
- No lockfile changes unless `npm install` is required
- No orchestration/agent code (that's next session)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (bun test — 147 tests across 11 files)
- **Automated tests**: Tests-after (run existing suite for regression, no new tests for docs-only change)
- **Framework**: bun test

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/agent-loop-v4/task-{N}-{scenario}.{ext}`.

- **CONTEXT.md**: Use `wc -l`, grep for specific patterns
- **package.json**: Use `cat | grep` for version
- **Git**: Use `git log`, `git diff --cached`, `git status`
- **Notion**: Use Notion API tools — query task by ID, verify status field
- **Tests**: Use Bash — `npm test` or `bun test`, assert exit code 0

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — sequential by nature):
├── Task 1: Read current CONTEXT.md + src files [quick]
├── Task 2: Rewrite CONTEXT.md to v4 architecture overview [quick]
├── Task 3: Bump package.json version to 0.4.0 [quick]
├── Task 4: Update Notion task status + project page [quick]
└── Task 5: Git commit all changes [quick]

Wave FINAL (Review — parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality + test sanity (unspecified-high)
├── Task F3: Notion verification (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: Task 1 → Task 2 → Task 5 → F1-F4
Parallel Speedup: Minimal (mostly sequential, ~15% faster)
Max Concurrent: 4 (all in Wave FINAL)
```

### Dependency Matrix
- **1**: - → 2
- **2**: 1 → 5
- **3**: - → 5
- **4**: - → 5
- **5**: 2, 3, 4 → Final
- **F1-F4**: 5 → (parallel)

### Agent Dispatch Summary
- **Wave 1**: 5 tasks — all `quick`
- **Wave FINAL**: 4 tasks — `oracle`, `unspecified-high`, `unspecified-high`, `deep`

---

## TODOs

- [x] 1. Read current state: CONTEXT.md + src files + git status

  **What to do**:
  - Read `CONTEXT.md` entirely to understand current state
  - `ls src/*.ts` to get the current file list (should be 12 files)
  - `git status --porcelain` to confirm pending changes
  - `git log --oneline -5` to check existing commit message convention
  - Read each source file's top-level exports and purpose (just enough to describe architecture — not deep reads)
  - Record findings for use in Task 2

  **Must NOT do**:
  - Don't modify any files
  - Don't analyze implementation internals — just surface-level architecture mapping

  **Recommended Agent Profile**:
  > **Category**: `quick`
  >   - Reason: Pure reconnaissance — read files, no edits
  > **Skills**: none required

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundation task)
  - **Blocks**: Task 2 (CONTEXT.md rewrite depends on this)

  **References**:
  - `CONTEXT.md` — Current stale document to understand structure
  - `src/index.ts` — Main entry point, exports overview
  - `src/*.ts` — All 12 source files for file-count verification
  - `package.json` — Version field to confirm before bump

  **Acceptance Criteria**:
  - [ ] All 12 source file paths recorded with 1-line purpose each
  - [ ] Current `git status --porcelain` output captured
  - [ ] Existing commit message convention noted

  **QA Scenarios**:
  ```
  Scenario: Verify file list completeness
    Tool: Bash
    Preconditions: Navigate to agent-loop project root
    Steps:
      1. Run `ls src/*.ts | Measure-Object -Line` to confirm 12 files
      2. Run `git status --porcelain` to capture pending changes
    Expected Result: 12 source files listed, pending change in memory-hooks.ts visible
    Evidence: .omo/evidence/agent-loop-v4/task-1-file-list.txt
  ```

  **Evidence to Capture**:
  - [ ] Current file list + git status saved

  **Commit**: NO (grouped with Task 5)

---

- [x] 2. Rewrite CONTEXT.md to v4 architecture overview

  **What to do**:
  - Replace entire CONTEXT.md with architecture overview
  - Structure: TL;DR → Architecture → Modules (12 files grouped by subsystem) → Data Flow → Key Decisions → Configuration → Test Strategy → Quick Start
  - Must list all 12 source files grouped by subsystem:
    - **Core engine**: index.ts (entry), types.ts (types), state-machine.ts (loop), state.ts (persistence), safety.ts (abort/max iterations), config.ts (config), plugins.ts (hooks)
    - **Infrastructure**: mcp.ts (MCP execution), api.ts (HTTP/WS server)
    - **Agentmemory**: agentmemory.ts (storage), memory-hooks.ts (memory)
    - **Evaluation**: evaluate.ts (LLM eval)
  - Keep ≤200 lines total
  - Remove all v1-era content (single-file event loop, init commands, etc.)
  - Use Mermaid mindmap or flowchart if helpful (compact)
  - Cross-reference ADR-0001 (raw HTTP transport)

  **Must NOT do**:
  - Don't exceed 200 lines
  - Don't include implementation details or function signatures
  - Don't add setup guides for other projects
  - Don't document v1/v2/v3 history — just current state

  **Recommended Agent Profile**:
  > **Category**: `quick`
  >   - Reason: Single-file rewrite, well-defined scope, no complex logic
  > **Skills**: `markdown-mermaid-writing` (if Mermaid diagrams help)

  **Parallelization**:
  - **Can Run In Parallel**: NO (blocked by Task 1)
  - **Blocks**: Task 5 (commit)
  - **Blocked By**: Task 1

  **References**:
  - `CONTEXT.md` — Current file to replace (read in Task 1)
  - `src/index.ts` — Entry point, exports overview
  - `src/state-machine.ts` — Core loop
  - `src/state.ts` — State persistence
  - `src/safety.ts` — Abort/max iterations
  - `src/config.ts` — Configuration
  - `src/plugins.ts` — Plugin hooks
  - `src/mcp.ts` — MCP execution
  - `src/api.ts` — HTTP/WS server
  - `src/agentmemory.ts` — Agentmemory integration
  - `src/memory-hooks.ts` — Memory hooks
  - `src/evaluate.ts` — LLM evaluation
  - `src/types.ts` — Type definitions
  - `openspec/changes/agent-loop-initial/spec.md` — Original spec for reference

  **Acceptance Criteria**:
  - [ ] New CONTEXT.md written, ≤200 lines (`wc -l`)
  - [ ] All 12 source files mentioned in appropriate grouping
  - [ ] No v1-era content remains
  - [ ] ADR-0001 referenced

  **QA Scenarios**:
  ```
  Scenario: Line count compliance
    Tool: Bash
    Preconditions: CONTEXT.md rewritten
    Steps:
      1. Run `(Get-Content CONTEXT.md).Length` — assert ≤200
    Expected Result: Line count ≤200
    Evidence: .omo/evidence/agent-loop-v4/task-2-line-count.txt

  Scenario: No stale references
    Tool: Bash
    Preconditions: CONTEXT.md rewritten
    Steps:
      1. Search for any v1-era patterns: grep for "single file", "event loop" (old arch)
      2. Grep for old file names not in current src/
    Expected Result: No false positives from v1-era content
    Evidence: .omo/evidence/agent-loop-v4/task-2-no-stale.txt
  ```

  **Evidence to Capture**:
  - [ ] Line count
  - [ ] Absence of stale references

  **Commit**: NO (grouped with Task 5)

---

- [x] 3. Bump package.json version to 0.4.0

  **What to do**:
  - Edit `package.json`: change `"version": "0.0.1"` to `"version": "0.4.0"`
  - Do NOT change any other field
  - If `package-lock.json` exists and has a version field, update it too

  **Must NOT do**:
  - Don't touch `dependencies`, `devDependencies`, `scripts`, or any other field
  - Don't run `npm install`
  - Don't update engines or any non-version field

  **Recommended Agent Profile**:
  > **Category**: `quick`
  >   - Reason: Single field change, trivial

  **Parallelization**:
  - **Can Run In Parallel**: YES (no dependencies)
  - **Parallel Group**: Wave 1 (with Tasks 1, 4)
  - **Blocks**: Task 5 (commit)
  - **Blocked By**: None (can start immediately)

  **References**:
  - `package.json:version` — `"0.0.1"` → `"0.4.0"`
  - `package-lock.json:version` — if exists, must match

  **Acceptance Criteria**:
  - [ ] `cat package.json | grep '"version"'` shows `"0.4.0"`
  - [ ] No other `git diff package.json` changes beyond version

  **QA Scenarios**:
  ```
  Scenario: Version bump correct
    Tool: Bash
    Preconditions: Task 3 completed
    Steps:
      1. Run `(Get-Content package.json | ConvertFrom-Json).version`
    Expected Result: "0.4.0"
    Evidence: .omo/evidence/agent-loop-v4/task-3-version.txt

  Scenario: Lockfile version check
    Tool: Bash
    Preconditions: Task 3 completed, if package-lock.json exists
    Steps:
      1. If package-lock.json exists, check its version field too
    Expected Result: lockfile version also 0.4.0 if present
    Evidence: .omo/evidence/agent-loop-v4/task-3-lockfile.txt
  ```

  **Evidence to Capture**:
  - [ ] Version string confirmation

  **Commit**: NO (grouped with Task 5)

---

- [x] 4. Update Notion: task status + project page

  **What to do**:
  - **Step A — Task status update**:
    - Retrieve Launch Ops database to confirm task `392b4d21-b591-8144-ac74-f6d49b1f3f3c` exists
    - Query the data source to get current status field value (should be "Next")
    - Update the page property on page `392b4d21-b591-8144-ac74-f6d49b1f3f3c`: set Status property to "Done"
    - Re-query to verify the change took effect
  - **Step B — Project page update**:
    - Read project page `392b4d21-b591-8152-9f9f-cd919f5adee6` content via Markdown
    - Find the project summary/overview section
    - Update the content to reflect v4: ~1200 LOC, 12 modules, v4 features (MCP, HTTP/WS API, plugins, agentmemory, evaluate, daemon)

  **Must NOT do**:
  - Don't create new pages or databases
  - Don't modify any other tasks in the database
  - Don't restructure the project page layout
  - Don't change creation dates or other metadata

  **Recommended Agent Profile**:
  > **Category**: `quick`
  >   - Reason: Simple Notion API calls, well-documented tools

  **Parallelization**:
  - **Can Run In Parallel**: YES (independent of Tasks 2, 3)
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 5 (commit — conceptually, Notion is the project status sync)

  **References**:
  - Notion task: `392b4d21-b591-8144-ac74-f6d49b1f3f3c` (Launch Ops)
  - Notion project page: `392b4d21-b591-8152-9f9f-cd919f5adee6` (App Launch HQ)
  - Notion API: `retrieve-a-data-source` (get Launch Ops DB schema)
  - Notion API: `query-data-source` (find task)
  - Notion API: `patch-page` (update status property)
  - Notion API: `retrieve-page-markdown` (read project page)
  - Notion API: `update-page-markdown` (update project page)

  **Acceptance Criteria**:
  - [ ] Notion task `392b4d21-b591-8144-ac74-f6d49b1f3f3c` status = "Done" (verified via re-query)
  - [ ] Notion project page `392b4d21-b591-8152-9f9f-cd919f5adee6` summary mentions v4

  **QA Scenarios**:
  ```
  Scenario: Verify task status changed
    Tool: Notion API (query-data-source)
    Preconditions: Task 4 completed
    Steps:
      1. Query Launch Ops database for task 392b4d21-b591-8144-ac74-f6d49b1f3f3c
      2. Extract status property value
    Expected Result: status = "Done"
    Evidence: .omo/evidence/agent-loop-v4/task-4-notion-status.txt

  Scenario: Verify project page updated
    Tool: Notion API (retrieve-page-markdown)
    Preconditions: Task 4 completed
    Steps:
      1. Read project page 392b4d21-b591-8152-9f9f-cd919f5adee6 as Markdown
      2. Search for "v4" or "0.4.0" in content
    Expected Result: Project page mentions v4 in summary
    Evidence: .omo/evidence/agent-loop-v4/task-4-notion-page.md
  ```

  **Evidence to Capture**:
  - [ ] Task status confirmation
  - [ ] Project page updated content

  **Commit**: NO (Notion changes don't go in git)

---

- [x] 5. Git commit all changes

  **What to do**:
  - Stage all changed files: CONTEXT.md, package.json, src/memory-hooks.ts, (package-lock.json if versioned)
  - Verify only intended files are staged (`git diff --cached --name-only`)
  - Run `npm test` to confirm 147 tests still pass
  - Commit with conventional message: `docs(agent-loop): update CONTEXT.md to v4, bump to 0.4.0`
  - Do NOT push (user may want to review first)

  **Must NOT do**:
  - Don't push to remote
  - Don't amend existing commits
  - Don't commit untracked files or unintentional changes
  - Don't skip the test run

  **Recommended Agent Profile**:
  > **Category**: `quick`
  >   - Reason: Standard git workflow, no complex logic
  > **Skills**: `git-workflow-and-versioning`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 2, 3)
  - **Blocks**: All Final Wave tasks
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `git log --oneline -5` — for commit message convention
  - `git status` — verify clean working tree before/after
  - `npm test` — run test suite

  **Acceptance Criteria**:
  - [ ] `git status --porcelain` returns empty (clean working tree)
  - [ ] `git log --oneline -1` message matches conventional format
  - [ ] `git diff --cached --name-only` shows only CONTEXT.md, package.json, src/memory-hooks.ts
  - [ ] Tests pass (`bun test` exit 0)

  **QA Scenarios**:
  ```
  Scenario: Verify clean commit
    Tool: Bash
    Preconditions: Commit completed
    Steps:
      1. `git status --porcelain` — should be empty
      2. `git log --oneline -1` — should be conventional
      3. `git diff --cached --name-only` — should be empty (nothing staged after commit)
      4. `git diff HEAD~1 --name-only` — should show the 3-4 files
    Expected Result: Clean working tree, conventional message, correct files
    Evidence: .omo/evidence/agent-loop-v4/task-5-commit-status.txt

  Scenario: Tests still pass
    Tool: Bash
    Preconditions: Tests run before commit
    Steps:
      1. `bun test` or `npm test` — exit code 0
    Expected Result: All 147 tests pass
    Evidence: .omo/evidence/agent-loop-v4/task-5-test-results.txt
  ```

  **Evidence to Capture**:
  - [ ] Git log output
  - [ ] Staged files list
  - [ ] Test results

  **Commit**: YES
  - Message: `docs(agent-loop): update CONTEXT.md to v4, bump to 0.4.0`
  - Files: `CONTEXT.md`, `package.json`, `src/memory-hooks.ts`, `package-lock.json` (if versioned)
  - Pre-commit: `bun test`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read CONTEXT.md, check package.json, run git log, query Notion). For each "Must NOT Have": search codebase for ADR files, config changes, feature code — reject with file:line if found. Check evidence files exist in `.omo/evidence/agent-loop-v4/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality + Test Sanity** — `unspecified-high`
  Run `bun test`. Review CONTEXT.md for grammar, accuracy (cross-reference against source files). Check package.json diff is version-only. Verify commit message format.
  Output: `Tests [PASS/FAIL] | CONTEXT.md [PASS/FAIL] | Package.json [PASS/FAIL] | Commit [PASS/FAIL] | VERDICT`

- [x] F3. **Notion Verification** — `unspecified-high`
  Query Launch Ops database for task 392b4d21-b591-8144-ac74-f6d49b1f3f3c. Assert status = "Done". Read project page 392b4d21-b591-8152-9f9f-cd919f5adee6. Assert summary mentions v4/0.4.0.
  Output: `Task Status [Done/PENDING] | Project Page [UPDATED/STALE] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git diff HEAD~1). Verify 1:1 — everything in spec was done, nothing beyond spec was added. Check "Must NOT do" compliance. Detect any unaccounted changes.
  Output: `Tasks [N/N compliant] | Scope Creep [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **5**: `docs(agent-loop): update CONTEXT.md to v4, bump to 0.4.0` — CONTEXT.md, package.json, src/memory-hooks.ts, (package-lock.json), `bun test`

---

## Success Criteria

### Verification Commands
```bash
# CONTEXT.md line count
(Get-Content CONTEXT.md).Length  # Expected: ≤200

# Version
(Get-Content package.json | ConvertFrom-Json).version  # Expected: "0.4.0"

# Git status
git status --porcelain  # Expected: (empty)

# Git diff from last commit
git diff HEAD~1 --name-only  # Expected: CONTEXT.md, package.json, src/memory-hooks.ts, (package-lock.json)

# Tests
bun test  # Expected: 147 passing, exit 0
```

### Final Checklist
- [ ] CONTEXT.md ≤200 lines, architecture overview, all 12 files referenced
- [ ] package.json version `0.4.0`
- [ ] `npm test` → all 147 pass
- [ ] Notion task status = "Done"
- [ ] Notion project page summary updated
- [ ] Git working tree clean, conventional commit message
- [ ] No ADRs, config changes, or feature code added beyond scope
