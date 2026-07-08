# Build Autonomous Agent Loops in OpenCode Vault

## TL;DR

> **Quick Summary**: Build the infrastructure to run unattended AI agent loops in your OpenCode vault — a memory spine, maker-checker sub-agent pair, /goal-style evaluator, and OS-scheduled recurring execution — then wire them into a working vault-pulse loop.
>
> **Deliverables**:
> - Validated assumptions (Windows headless mode, slot persistence, background tasks)
> - Installed opencode-scheduler plugin with Windows schtasks backend
> - agentmemory slots for loop state (config, state, kill-switch, logs)
> - Maker-checker sub-agent pair (task() based with adversarial review)
> - /goal-style evaluator (separate cheap model checks condition)
> - One working end-to-end loop: vault pulse (daily vault health report)
> - Integration tested with 3 consecutive runs
>
> **Estimated Effort**: Medium (4-6 hours)
> **Parallel Execution**: YES - 3 waves + final review
> **Critical Path**: Validate assumptions → Memory spine → Maker-checker → Evaluator → Scheduler → Vault-pulse loop → Integration test

---

## Context

### Original Request
"Build autonomous AI agent loops that run in my OpenCode vault setup on Windows."

### Interview Summary
**Key Discussions**:
- Context limits are the #1 concern — solved via short atomic tasks + agentmemory as external state (each task starts fresh)
- No `/goal` or `/loop` built into OpenCode — must build equivalents using task() sub-agents
- agentmemory is already fully wired (51 MCP tools, 22 hooks, 4-tier consolidation)
- Two existing scheduler plugins: `opencode-scheduler` (different-ai, 397 stars) and `opencode-scheduled-tasks` (jdormit, 4 stars)
- MVP = exactly ONE loop type (vault pulse). No generic framework. No concurrency. No UI/dashboard.

**Research Findings**:
- `opencode-scheduler` supports Windows via schtasks, non-interactive mode, no-overlap guarantee, timeoutSeconds. 397 stars, active.
- `opencode-scheduled-tasks` has markdown task files with frontmatter, /loop command, session_name for stateful tasks. Smaller (4 stars).
- agentmemory's `memory_slot` system is the TODO.md/memory spine — durable, thread-safe, survives between sessions
- `task()` with `run_in_background=true` enables parallel sub-agents
- `task(category="quick")` uses a cheaper/faster model — ideal for evaluator role

### Metis Review
**Identified Gaps** (addressed):
- **Failure/recovery model**: 3 retries per iteration, then mark FAILED in slot. No infinite retry.
- **Termination/halting**: Vault-pulse loop runs once per scheduled trigger. Not indefinite. Evaluator checks if pulse was completed.
- **Kill switch**: `memory_slot("loop-kill-switch")` — all loops check at start. Set to "STOP" to abort.
- **Resource caps**: Hard limits per iteration (max 5 tool calls, 60s wall clock, checked before each step)
- **Scope creep locked**: No generic framework, no UI, no concurrency, no git push without approval
- **Assumptions need validation**: Task 1-2 are pure validation tests before building anything
- **No file deletion**: Loop explicitly prohibited from using destructive tools

---

## Work Objectives

### Core Objective
Build and validate one complete end-to-end autonomous agent loop (vault pulse) in the OpenCode vault, with all four supporting components: memory spine, maker-checker pair, /goal evaluator, and OS-scheduled execution.

### Concrete Deliverables
- Working assumption validations: headless OpenCode, slot persistence, background tasks
- Installed opencode-scheduler with Windows schtasks
- Agentmemory slots: `loop-config`, `loop-state`, `loop-kill-switch`, `loop-last-run`
- Maker-checker sub-agent pair (task-based)
- /goal-style evaluator (task(category="quick") based)
- One vault-pulse loop running on schedule
- Integration evidence: 3 consecutive successful runs with validated state

### Definition of Done
- [ ] All 4 validation checks pass (Tasks 1-2)
- [ ] opencode-scheduler installed and a test task executes on schedule
- [ ] Maker-checker pair correctly rejects bad work and accepts good work
- [ ] Evaluator correctly identifies met vs unmet conditions
- [ ] Vault-pulse loop runs, writes pulse report to a slot, and completes
- [ ] Integration test shows 3 consecutive successful pulse runs

### Must Have
- Kill-switch mechanism that actually stops a running loop
- Hard resource caps (max tool calls, max duration) enforced per iteration
- Loop runs unattended via Windows Task Scheduler
- State persists between loop iterations (agentmemory slots)
- Maker and checker use separate task() calls with different models

### Must NOT Have (Guardrails)
- No generic loop abstraction/framework — MVP is hardcoded to vault-pulse
- No concurrency — exactly one loop at a time
- No UI/dashboard/monitoring — agentmemory tools are sufficient
- No git push — loop can commit but NOT push to remote
- No file deletion tools — loop explicitly blocked from `bash rm`
- No infinite loops — every iteration has defined halting condition
- No slot overflow — loop checks slot size before appending

### Spec Framework Integration
- **Detected Framework**: OpenSpec
- **Active Specs**: Check `openspec/specs/` directory
- **Available Commands**: `/opsx:propose`, `/opsx:apply`, `/opsx:archive`

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: YES (agentmemory, OpenCode task(), PowerShell)
- **Automated tests**: Tests-after (each task verified by its QA scenarios)
- **Evidence**: Saved to `.omo/evidence/task-{N}-{scenario}.{ext}`

### QA Policy
Every task MUST include agent-executable QA scenarios with concrete commands, selectors, data, and assertions.

- **Validation checks**: Use Bash (PowerShell) — run commands, assert output
- **agentmemory checks**: Use Bash with `memory_slot_get` equivalent tools
- **Scheduler checks**: Use `schtasks /query` to verify Windows Task Scheduler entries
- **Loop integration**: Run loop iterations, inspect slot content after each

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + validation):
├── Task 1: Validate headless OpenCode + slot persistence + background tasks [quick]
├── Task 2: Install opencode-scheduler, verify schtasks integration [quick]
├── Task 3: Create loop memory slots + kill-switch mechanism [quick]

Wave 2 (Core components — MAX PARALLEL):
├── Task 4: Build maker-checker sub-agent pair [unspecified-high]
├── Task 5: Build /goal-style evaluator [unspecified-high]

Wave 3 (Integration — blocks on Wave 1 + 2):
├── Task 6: Wire scheduler with first vault-pulse loop [unspecified-high]
├── Task 7: Integration test — 3 consecutive pulse runs, verify state [unspecified-high]

Wave FINAL (After ALL tasks — 4 parallel reviews, then user ok):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
├── Task F4: Scope fidelity check (deep)
```

---

## TODOs

- [ ] 1. Validate assumptions

  **What to do**:
  - Test 1: Run `opencode run --non-interactive` with a simple prompt. Verify it returns output and exits with code 0. If `--non-interactive` doesn't exist, try `-p` (prompt flag) or pipe piped input. Document the working invocation.
  - Test 2: Create an agentmemory slot, write to it, restart OpenCode, read it back. Verify persistence.
  - Test 3: Launch a background task via `task(run_in_background=true)` that writes to a slot. Wait 10s. Verify slot content appeared.

  **Must NOT do**:
  - Don't build production code yet — these are throwaway validation probes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Trivial validation probes, each takes <2 minutes
  - **Skills**: `[]`
    - Pure validation — no special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3)
  - **Blocks**: Tasks 4, 5, 6, 7
  - **Blocked By**: None (start immediately)

  **References**:
  - `AGENTS.md` — OpenCode CLI commands reference
  - `70-Memory/00-index.md` — agentmemory setup details
  - OpenCode docs: `https://open-code.ai/en/docs/cli` — CLI flags reference

  **Acceptance Criteria**:
  - [ ] `opencode -p "hello"` or equivalent exits 0 and prints output
  - [ ] Slot created in one session, read successfully in a new session
  - [ ] Background task writes to slot, slot content verified after 10s

  **QA Scenarios**:
  ```
  Scenario: Headless mode works
    Tool: Bash (PowerShell)
    Preconditions: OpenCode installed, provider configured
    Steps:
      1. Run: opencode -p "output the text: TEST_PASS" -q
      2. Check exit code is 0
      3. Check output contains "TEST_PASS"
    Expected Result: opencode runs headless, returns output, exits cleanly
    Evidence: .omo/evidence/task-1-headless.txt

  Scenario: Agentmemory slot persists
    Tool: Bash (PowerShell)
    Preconditions: agentmemory daemon running
    Steps:
      1. Run: agentmemory memory_slot_create label="test-persist" content="hello"
      2. Verify creation succeeded
      3. Close OpenCode, reopen
      4. Run: agentmemory memory_slot_get label="test-persist"
    Expected Result: content is "hello" after restart
    Evidence: .omo/evidence/task-1-slot-persist.txt

  Scenario: Background task works
    Tool: Bash (PowerShell)
    Steps:
      1. Launch task(category="quick", run_in_background=true, prompt="Write 'bg_ok' to loop-state slot")
      2. Wait 10 seconds
      3. Check loop-state slot content
    Expected Result: slot contains "bg_ok"
    Evidence: .omo/evidence/task-1-background.txt

  Scenario: Headless mode handles permissions without hanging
    Tool: Bash (PowerShell)
    Preconditions: OpenCode installed
    Steps:
      1. Run: echo "list files in current dir" | opencode run --dangerously-skip-permissions --format json
      2. Check process exits within 60 seconds
      3. Check exit code
    Expected Result: Does not hang waiting for user input. Returns output or clear error.
    Evidence: .omo/evidence/task-1-no-hang.txt
  ```

  **Commit**: NO (validation only)

- [ ] 2. Install opencode-scheduler

  **What to do**:
  - Install `opencode-scheduler` plugin by different-ai (397 stars, mature, Windows schtasks support)
  - Add `"plugin": ["opencode-scheduler"]` to `.opencode/opencode.json`
  - Install via npm: `npm install opencode-scheduler`
  - Register the plugin with OpenCode
  - Verify schtasks backend: create a test job that echoes to a file, check Task Scheduler
  - Configure permissions for non-interactive mode (all auto-allow for scheduled runs)

  **Must NOT do**:
  - Don't use jdormit/opencode-tasks — it has 4 stars and less Windows testing
  - Don't write a custom PowerShell scheduler — opencode-scheduler already handles schtasks

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Plugin installation requires npm, config file editing, and OS-level schtasks verification
  - **Skills**: `[]`
    - Standard tools suffice (Bash, Read, Edit)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3)
  - **Blocks**: Task 6
  - **Blocked By**: None (start immediately)

  **References**:
  - `https://github.com/different-ai/opencode-scheduler` — plugin README, commands, install guide
  - `.opencode/opencode.json` — existing config to modify
  - OpenCode plugin docs: `https://open-code.ai/en/docs/plugins`

  **Acceptance Criteria**:
  - [ ] opencode-scheduler installed and visible in plugin list
  - [ ] Test scheduled job appears in `schtasks /query`
  - [ ] Test scheduled job executes and writes output to a file
  - [ ] Non-interactive permissions work (no hanging on approval prompts)

  **QA Scenarios**:
  ```
  Scenario: Plugin installed
    Tool: Bash (PowerShell)
    Steps:
      1. Check opencode.json contains "opencode-scheduler" in plugins
      2. Run scheduled job creation command
    Expected Result: Plugin registered, job creation command succeeds
    Evidence: .omo/evidence/task-2-plugin-installed.txt

  Scenario: Test job runs on schedule
    Tool: Bash (PowerShell)
    Steps:
      1. Create a test job: schedule writing "pulse_ok" to a test file every 5 minutes
      2. Run: schtasks /query /tn "OpenCode\*" /v
      3. Trigger the job manually if possible
      4. Wait for execution, check test file exists
    Expected Result: schtasks shows the job, output file created with content
    Evidence: .omo/evidence/task-2-schtasks.txt

  Scenario: Non-interactive permissions work
    Tool: Bash (PowerShell)
    Steps:
      1. Configure loop permissions to auto-allow reads/writes
      2. Run a test prompt headless
      3. Verify it completes without asking for permission
    Expected Result: No approval prompts, process exits cleanly
    Evidence: .omo/evidence/task-2-permissions.txt
  ```

  **Commit**: NO (plugin install is config change, separate from vault code)

- [ ] 3. Create loop memory infrastructure

  **What to do**:
  - Create 4 persistent memory slots in agentmemory:
    1. `loop-config` — holds loop JSON config (enabled, schedule, max_iterations, allowed_tools)
    2. `loop-state` — current state (RUNNING, IDLE, FAILED) + last result summary
    3. `loop-kill-switch` — set to "STOP" to abort all loops, "RUN" to allow
    4. `loop-last-run` — timestamp, status, summary, error (if any) of last execution
  - Set size limits: 2000 chars for config, 2000 for state, 500 for kill-switch, 5000 for last-run
  - Write initial defaults: loop-kill-switch = "RUN", loop-state = "IDLE"
  - Document slot schema and usage in a note (not a full doc)

  **Must NOT do**:
  - Don't create more than 4 slots — scope creep
  - Don't over-engineer the schema — flat JSON strings, not nested objects
  - Don't build a "slot manager" abstraction — just create and document

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple memory slot creation via agentmemory MCP tools
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2)
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: None (start immediately)

  **References**:
  - agentmemory MCP tools: `memory_slot_create`, `memory_slot_get`, `memory_slot_replace`
  - `AGENTS.md` → agentmemory section — existing setup details
  - Metis guardrail: slots must not overflow — 2KB default limit per slot

  **Acceptance Criteria**:
  - [ ] loop-config slot exists and contains valid JSON
  - [ ] loop-state slot exists, initial value "IDLE"
  - [ ] loop-kill-switch slot exists, initial value "RUN"
  - [ ] loop-last-run slot exists, initial value empty/null
  - [ ] Read/write cycle on each slot works (create → read → update → read)

  **QA Scenarios**:
  ```
  Scenario: All slots created
    Tool: Bash (agentmemory MCP or equivalent)
    Steps:
      1. Call memory_slot_get for each slot
      2. Verify all 4 exist with correct initial values
    Expected Result: loop-config={...}, loop-state="IDLE", loop-kill-switch="RUN", loop-last-run=null
    Evidence: .omo/evidence/task-3-slots-created.txt

  Scenario: Read-write cycle works
    Tool: Bash
    Steps:
      1. Write "TEST" to loop-state
      2. Read loop-state
      3. Restore "IDLE"
    Expected Result: Read returns "TEST", then restores correctly
    Evidence: .omo/evidence/task-3-rw-cycle.txt
  ```

  **Commit**: NO (memory state, not code)

---

- [ ] 4. Build maker-checker sub-agent pair

  **What to do**:
  - Create a reusable pattern in a PowerShell script `00-System/Tools/loop-maker-checker.ps1`:
    - Maker: `task(category="deep", prompt="Do X")` — does the actual work
    - Checker: `task(category="quick", prompt="Verify that X was done correctly")` — reviews the work
    - If checker fails, loop maker again with the critique (up to 3 retries)
    - If checker passes, mark iteration as DONE in loop-state
  - The pair MUST use **different models**: maker on the primary model, checker on a cheaper model (`category="quick"` maps to cheaper model in OpenCode)
  - Implement adversarial review pattern (inspired by santa-method skill): checker gets specific criteria to verify, not open-ended "is this good?"

  **Must NOT do**:
  - Don't let the maker also check its own work — that's the whole point of the split
  - Don't make the checker powerful/expensive — cheap model is intentional
  - Don't implement infinite retry — max 3 attempts, then FAILED state

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires thoughtful implementation of the maker-checker split pattern
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1, 3 (need validated assumptions + slots)

  **References**:
  - santa-method skill at `.opencode/skills/santa-method/SKILL.md` — adversarial review pattern
  - Claude Code source architecture (Gist analysis) → maker-checker split is "single most useful structural move"
  - `task()` function — categories: deep (maker), quick (checker)

  **Acceptance Criteria**:
  - [ ] Maker task executes and produces output
  - [ ] Checker task reviews the output against specific criteria
  - [ ] When maker does correct work, checker returns PASS
  - [ ] When maker does incorrect work, checker returns FAIL with reasons
  - [ ] After 3 failed retries, iteration marked FAILED in loop-state

  **QA Scenarios**:
  ```
  Scenario: Happy path — correct work
    Tool: Bash
    Steps:
      1. Run maker task: "Write 'hello world' to a test file"
      2. Run checker task: "Verify the file contains 'hello world'"
      3. Check result
    Expected Result: Checker returns PASS
    Evidence: .omo/evidence/task-4-maker-checker-pass.txt

  Scenario: Adversarial path — incorrect work
    Tool: Bash
    Steps:
      1. Run maker task: "Write 'goodbye world' to a test file"
      2. Run checker task with criteria: "Verify file contains 'hello world'"
      3. Check result
    Expected Result: Checker returns FAIL with specific reason (wrong content)
    Evidence: .omo/evidence/task-4-maker-checker-fail.txt

  Scenario: Retry limit enforced
    Tool: Bash
    Steps:
      1. Set up a task that will always fail
      2. Run maker-checker with max_retries=3
      3. Verify it stops after 3 attempts
    Expected Result: State is FAILED, no more retries
    Evidence: .omo/evidence/task-4-retry-limit.txt
  ```

  **Commit**: NO (tooling script)

- [ ] 5. Build /goal-style evaluator

  **What to do**:
  - Create `00-System/Tools/loop-evaluator.ps1` — a condition checker
  - Takes a goal condition string and evidence, runs `task(category="quick", prompt="Has this condition been met? Condition: {condition}. Evidence: {evidence}. Respond with PASS or FAIL.")`
  - Uses a CHEAP/FAST model (via `category="quick"`) — separate from the actor model
  - Returns structured result: `{"met": true/false, "evidence": "...", "remaining": "...", "reasoning": "..."}`
  - If evaluator returns FAIL, the loop should report what's still needed

  **Must NOT do**:
  - Don't use the same model for evaluation as for execution — defeats the purpose
  - Don't make evaluator expensive — cheap model is designed to be fast
  - Don't let the evaluator make changes — read-only check only

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires clean implementation of the evaluator pattern with structured output
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 4, 6)
  - **Blocks**: Task 7
  - **Blocked By**: Tasks 1, 3

  **References**:
  - Claude Code /goal internals: Stop hook + separate Haiku model evaluates condition
  - Anthropic research: "agents asked to evaluate their own work tend to confidently praise mediocre quality"
  - `task(category="quick")` — maps to cheaper model

  **Acceptance Criteria**:
  - [ ] Evaluator correctly identifies when a condition IS met
  - [ ] Evaluator correctly identifies when a condition is NOT met
  - [ ] Evaluator returns structured JSON with met, evidence, remaining fields
  - [ ] Evaluator uses a different (cheaper) model path than the maker

  **QA Scenarios**:
  ```
  Scenario: Condition met
    Tool: Bash
    Steps:
      1. Write "vault pulse OK" to loop-last-run
      2. Run evaluator with condition: "loop-last-run contains 'pulse OK'"
      3. Check result
    Expected Result: {"met": true, ...}
    Evidence: .omo/evidence/task-5-eval-met.txt

  Scenario: Condition not met
    Tool: Bash
    Steps:
      1. Clear loop-last-run slot
      2. Run evaluator with condition: "loop-last-run contains 'pulse OK'"
      3. Check result
    Expected Result: {"met": false, "remaining": "..."}
    Evidence: .omo/evidence/task-5-eval-unmet.txt

  Scenario: Cheap model used
    Tool: Bash (inspect task output)
    Steps:
      1. Run evaluator
      2. Check which model was used (from task metadata or log)
    Expected Result: Model is a cheaper/faster variant, not the primary model
    Evidence: .omo/evidence/task-5-eval-model.txt
  ```

  **Commit**: NO (tooling script)

- [ ] 6. Wire scheduler with first vault-pulse loop

  **What to do**:
  - Create a scheduled job via opencode-scheduler: vault pulse runs daily at 8:00 AM
  - The job definition:
    1. Check `loop-kill-switch` — if "STOP", abort immediately
    2. Read `loop-config` for settings
    3. Set `loop-state` = "RUNNING" with timestamp
    4. Generate vault pulse: check file count, git status, recent changes, agentmemory stats
    5. Write pulse report to `loop-last-run`
    6. Set `loop-state` = "IDLE" with completion timestamp
  - Wire the maker-checker pair: maker generates the pulse, checker verifies the pulse has required fields (timestamp, status, summary)
  - Wire the evaluator: after pulse completes, evaluator checks "was pulse generated in the last hour?"
  - Configure permissions for non-interactive operation (all auto-allow for known tools)

  **Must NOT do**:
  - Don't let the loop push to git — only commit locally
  - Don't allow `bash rm` or destructive operations
  - Don't make the loop complex — vault pulse is intentionally simple (read-only stats gathering)
  - Don't run more than one loop concurrently

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration task — wires scheduler, maker-checker, evaluator, and slots together
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all previous wave)
  - **Parallel Group**: Wave 3 (with Task 7)
  - **Blocks**: Nothing (final implementation task)
  - **Blocked By**: Tasks 2, 4, 5 (scheduler + maker-checker + evaluator)

  **References**:
  - `00-System/Tools/pulse.sh` or `pulse.ps1` — existing vault pulse script (adapt from this)
  - opencode-scheduler docs — job creation, permissions for non-interactive
  - `70-Memory/00-index.md` — vault structure for pulse data sources

  **Acceptance Criteria**:
  - [ ] Scheduled job created in schtasks
  - [ ] Job triggers and completes without hanging
  - [ ] loop-last-run contains valid pulse report after execution
  - [ ] loop-state transitions: IDLE → RUNNING → IDLE
  - [ ] Maker-checker pair validates pulse content
  - [ ] Evaluator confirms pulse was generated
  - [ ] Kill switch works — set to STOP, next iteration aborts

  **QA Scenarios**:
  ```
  Scenario: Loop executes end-to-end
    Tool: Bash (PowerShell)
    Steps:
      1. Verify loop-kill-switch = "RUN"
      2. Trigger the vault-pulse job manually
      3. Wait for completion (up to 120s)
      4. Read loop-last-run slot
    Expected Result: loop-last-run has valid timestamp, pulse summary, status="completed"
    Evidence: .omo/evidence/task-6-loop-executed.txt

  Scenario: Kill switch stops loop
    Tool: Bash (PowerShell)
    Steps:
      1. Set loop-kill-switch = "STOP"
      2. Trigger vault-pulse job
      3. Check loop-state stays "IDLE" (aborted before starting)
    Expected Result: Loop does not execute, state remains IDLE
    Evidence: .omo/evidence/task-6-kill-switch.txt

  Scenario: Schtasks entry exists
    Tool: Bash (PowerShell)
    Steps:
      1. Run: schtasks /query /tn "OpenCode\opencode-vault-pulse"
    Expected Result: Task exists, schedule shows daily at 8 AM
    Evidence: .omo/evidence/task-6-schtasks.txt

  Scenario: Non-interactive permissions work
    Tool: Bash (PowerShell)
    Steps:
      1. Run the job in non-interactive mode
      2. Verify no hanging on approval prompts
    Expected Result: Job completes without user input
    Evidence: .omo/evidence/task-6-no-hang.txt

  Scenario: Resource caps enforced
    Tool: Bash (PowerShell)
    Steps:
      1. Set max_tool_calls=2 in loop-config
      2. Run vault-pulse (normally needs 4-5 tool calls)
      3. Check loop-state
    Expected Result: Loop hits cap, stops early, state shows "CAPPED" with partial results
    Evidence: .omo/evidence/task-6-resource-caps.txt
  ```

  **Commit**: NO (scheduler config is environment-specific)

- [ ] 7. Integration test — 3 consecutive vault-pulse runs

  **What to do**:
  - Run the vault-pulse loop 3 times consecutively (not waiting for schedule — trigger manually)
  - After each run, verify:
    - loop-last-run has valid content with timestamp
    - loop-state is "IDLE"
    - Kill switch is still "RUN"
    - Maker-checker pair passed on pulse content
    - Evaluator confirms pulse was generated
  - Verify no state corruption across runs (Run 2 doesn't see stale Run 1 data)
  - Verify slot sizes haven't overflowed
  - Verify agentmemory recorded all tool calls

  **Must NOT do**:
  - Don't run in production schedule yet — this is a controlled test
  - Don't skip any verification step — full validation of each run

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires orchestrating 3 loop runs and validating state after each
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential runs)
  - **Parallel Group**: Wave 3 (after Task 6)
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Tasks 4, 5, 6

  **References**:
  - Task 6 output (the actual loop implementation)
  - slot read/write patterns from Task 3

  **Acceptance Criteria**:
  - [ ] Run 1: pulse generated, state IDLE, no errors
  - [ ] Run 2: pulse generated (new timestamp), state IDLE, no stale data from Run 1
  - [ ] Run 3: pulse generated, state IDLE, slot sizes within limits
  - [ ] No state corruption across runs
  - [ ] Maker-checker passed for all 3 runs
  - [ ] Evaluator confirmed all 3 runs

  **QA Scenarios**:
  ```
  Scenario: Three consecutive runs succeed
    Tool: Bash (PowerShell)
    Steps:
      1. Trigger vault-pulse run 1
      2. Verify loop-last-run timestamp, state=IDLE
      3. Trigger vault-pulse run 2
      4. Verify new timestamp (different from run 1), state=IDLE
      5. Trigger vault-pulse run 3
      6. Verify new timestamp (different from run 2), state=IDLE
    Expected Result: All 3 runs complete successfully with increasing timestamps
    Evidence: .omo/evidence/task-7-three-runs.txt

  Scenario: No state corruption
    Tool: Bash (PowerShell)
    Steps:
      1. Check loop-config slot — unchanged from initial
      2. Check loop-kill-switch — unchanged, still "RUN"
      3. Check agentmemory recorded 3 distinct execution events
    Expected Result: Config and kill-switch unchanged, 3 execution events
    Evidence: .omo/evidence/task-7-no-corruption.txt

  Scenario: Slot sizes within limits
    Tool: Bash (PowerShell)
    Steps:
      1. Get length of loop-last-run content
      2. Get length of loop-state content
    Expected Result: All slots under their size limits
    Evidence: .omo/evidence/task-7-slot-sizes.txt
  ```

  **Commit**: NO (integration test — validation only)

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have" (kill switch, resource caps, unattended run, state persistence, separate models): verify implementation exists. For each "Must NOT Have" (no generic framework, no concurrency, no git push, no rm, no infinite loop): search for forbidden patterns. Check evidence files exist in .omo/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Review all changed files (00-System/Tools/*.ps1, opencode.json config). Check for: hardcoded paths, missing error handling, slot overflow risks, infinite loop potential, resource cap enforcement. Check AI slop: over-commenting, over-abstraction.
  Output: `Scripts [PASS/FAIL] | Config [PASS/FAIL] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (scheduler firing the loop, maker-checker verifying pulse, evaluator checking condition). Test edge cases: kill switch mid-execution, resource cap hit, slot overflow. Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff/implementation. Verify 1:1 — everything in scope was built, nothing beyond scope was built. Check "Must NOT do" compliance on every task. Detect contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN] | Unaccounted [CLEAN] | VERDICT`

---

## Commit Strategy

No commits for MVP infrastructure — this is all config, tooling, and slot creation. After validation and at least 3 successful pulse runs, commit:
```
feat(vault): add autonomous vault-pulse loop infrastructure
```
Files: `00-System/Tools/loop-maker-checker.ps1`, `00-System/Tools/loop-evaluator.ps1`, `.opencode/opencode.json`
Pre-commit: verify schtasks entry exists, verify all 4 slots exist with correct values

---

## Success Criteria

### Verification Commands
```powershell
# Check slots exist
agentmemory memory_slot_get label="loop-config"
agentmemory memory_slot_get label="loop-state"
agentmemory memory_slot_get label="loop-kill-switch"
agentmemory memory_slot_get label="loop-last-run"

# Check scheduler
schtasks /query /tn "OpenCode\opencode-vault-pulse"

# Check pulse ran
agentmemory memory_slot_get label="loop-last-run"

# Expected: valid JSON with timestamp, status="completed", summary="..."
```

### Final Checklist
- [ ] All 4 memory slots exist and contain valid data
- [ ] schtasks shows vault-pulse job with daily schedule
- [ ] Kill switch works (set to STOP, loop aborts)
- [ ] Maker-checker pair works (correct work accepted, incorrect rejected)
- [ ] Evaluator works (met conditions accepted, unmet rejected)
- [ ] 3 consecutive pulse runs documented with evidence
- [ ] No state corruption across runs
- [ ] Resource caps enforced (at least 1 scenario proving cap stops the loop)
