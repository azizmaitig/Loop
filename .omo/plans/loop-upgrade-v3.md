# Loop Upgrade v3 — Scheduled Task Fix & Circuit Breaker

## TL;DR

> **Quick Summary**: Fix the broken daily vault-pulse scheduled task (exit code -2147024894) and add circuit breaker resilience so repeated failures trigger backoff instead of retrying forever.
>
> **Deliverables**:
> - Timeout handling fix: 30s→60s + proper exit code handling
> - Circuit breaker state machine in `.omo/loop-circuit-breaker.json`
> - Pulse health metrics in the report output
> - Self-test script for circuit breaker state transitions
> - Loop scripts git-committed
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES — 2 tasks independent
> **Critical Path**: Task 1 → Task 2/3 (parallel) → Task 4 → Task 5

---

## Context

### Original Request
"Fix only" scope for the loop system — the vault-pulse scheduled task failed at 08:00 with ERROR_CANCELLED (-2147024894). Add circuit breaker resilience.

### Interview Summary
**Key Discussions**:
- Vault-pulse scheduled task returns -2147024894 (ERROR_CANCELLED) — timed out
- pulse-test task (simple cmd.exe echo) works fine
- Manual tests all pass (3 consecutive runs in prior upgrade)
- User confirmed fix-only scope

**Design Decisions** (user confirmed):
- **Circuit breaker storage**: Dedicated `.omo/loop-circuit-breaker.json`
- **Timeout fix**: Increase from 30s → 60s
- **CB thresholds**: 3 consecutive failures → OPEN, 30min cool-down, 2 successful probes → CLOSED
- **Failure definition**: Non-zero exit code from pulse.ps1 OR timeout

**Research Findings**:
- Cordum's circuit breaker pattern (2026): 3-failure trip, 30s-30min open window, 2-probe close
- TheoryDelta 9 Gates: Error recovery gate #3 requires backoff, not retry-forever
- Hermes Gateway issue #13655: stale PID files caused restart loops — your fix avoids this

### Metis Review
**Identified Gaps** (addressed):
- Missing core objective statement → added
- Missing test strategy → added
- Circuit breaker storage design → user confirmed dedicated file
- Threshold values → user confirmed 3/30min/2

---

## Work Objectives

### Core Objective
Fix the broken scheduled vault-pulse task (exit code -2147024894) and add circuit breaker resilience so repeated failures trigger backoff instead of retrying forever.

### Concrete Deliverables
- Timeout in loop-vault-pulse.ps1 increased from 30s → 60s
- Exit code handling improved (non-zero/timeout → tracked as failure)
- Circuit breaker state machine: CLOSED → OPEN (3 failures) → HALF_OPEN (30min) → CLOSED (2 successes)
- Pulse report contains a `## Circuit Breaker Health` section
- Self-test script at `00-System/Tools/test-circuit-breaker.ps1`
- All 3 loop scripts git-committed

### Must Have
- Circuit breaker file atomically written (temp file + rename)
- Circuit breaker checked BEFORE every pulse.ps1 call — skip if OPEN
- Pulse report includes CB state + failure count + last failure + last success
- Self-test proves OPEN → HALF_OPEN → CLOSED transitions work
- Git commit with conventional message

### Must NOT Have (Guardrails)
- No reusable circuit breaker module — inline in loop-vault-pulse.ps1 only
- No changes to loop-evaluator.ps1 or loop-maker-checker.ps1 (except git commit)
- No changes to pulse.ps1 itself — only the wrapper is touched
- No token/cost enforcement (future upgrade)
- No HITL checkpoints
- No durable iteration-level checkpointing

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (PowerShell, OpenCode)
- **Automated tests**: Tests-after (each task verified by QA scenarios)
- **Evidence**: Saved to `.omo/evidence/loop-v3-{scenario}.{ext}`

### QA Policy
Every task MUST include agent-executed QA scenarios.
- **PowerShell tests**: Run commands, assert exit codes, check file contents
- **Circuit breaker tests**: Inject failures, verify state transitions
- **Scheduled task**: Verify schtasks entry exists and has correct command
- **Git**: Verify commit via git log

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation):
├── Task 1: Increase timeout 30s→60s + exit code handling [quick]
├── Task 4: Create circuit breaker test script [quick]

Wave 2 (After Wave 1 — core logic):
├── Task 2: Add circuit breaker state machine [unspecified-high]
├── Task 3: Add pulse health metrics [quick]

Wave 3 (After Wave 2 — finalize):
├── Task 5: Git commit all loop scripts [quick]

Wave FINAL (After ALL tasks):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real QA — run ALL scenarios (unspecified-high)
├── Task F4: Scope fidelity check (deep)
```

### Dependency Matrix
- **1**: - → 2, 3, 4
- **2**: 1, 4 → 5
- **3**: 1, 4 → 5
- **4**: - → 2, 3
- **5**: 2, 3 → F1-F4

### Agent Dispatch Summary
- **Wave 1**: 2 tasks — T1 → `quick`, T4 → `quick`
- **Wave 2**: 2 tasks — T2 → `unspecified-high`, T3 → `quick`
- **Wave 3**: 1 task — T5 → `quick`
- **Final**: 4 parallel reviews

---

## TODOs

- [x] 1. Increase pulse.ps1 timeout 30s → 60s + exit code handling

  **What to do**:
  - In `00-System/Tools/loop-vault-pulse.ps1`, find the `Wait-Job -Timeout 30` on line ~208
  - Change `-Timeout 30` to `-Timeout 60`
  - After `Wait-Job -Timeout 60`, improve exit code handling:
    - If job times out, set `$PulseTimeout = $true` (new variable)
    - Fall back to existing pulse.md as current code does
    - Record the timeout as a failure event for the circuit breaker
  - Ensure the outer script exits with code 0 even when pulse.ps1 times out (so Windows Task Scheduler sees success)
  - Add `$LastPulseResult` variable: "completed" or "timed_out" for the pulse report

  **Must NOT do**:
  - Don't change pulse.ps1 itself — only the wrapper in loop-vault-pulse.ps1
  - Don't add any circuit breaker logic here — that's Task 2
  - Don't add new files

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple numerical change + exit code path adjustment
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None (start immediately)

  **References**:
  - `00-System/Tools/loop-vault-pulse.ps1:206-221` — Current timeout block (lines ~206-221)
  - Current code: `$PulseJob | Wait-Job -Timeout 30`
  - Error code -2147024894 = ERROR_CANCELLED — means the outer opencode wrapper received the timeout

  **Acceptance Criteria**:
  - [ ] Timeout value changed to 60
  - [ ] Exit code 0 returned even when pulse.ps1 times out
  - [ ] `$PulseTimeout` set to `$true` on timeout
  - [ ] Fallback to existing pulse.md still works
  - [ ] Script does not hang longer than 65s

  **QA Scenarios**:
  ```
  Scenario: Timeout increased to 60s
    Tool: Bash (PowerShell)
    Preconditions: loop-kill-switch = "RUN"
    Steps:
      1. Grep for "Wait-Job -Timeout" in loop-vault-pulse.ps1
      2. Extract the timeout value
    Expected Result: Timeout value is 60
    Evidence: .omo/evidence/loop-v3-task1-timeout-value.txt

  Scenario: Script exits 0 even on pulse timeout
    Tool: Bash (PowerShell)
    Preconditions: pulse.ps1 is temporarily replaced with a sleep 90 script
    Steps:
      1. Run loop-vault-pulse.ps1
      2. Check exit code
      3. Check $PulseTimeout variable
    Expected Result: Exit 0, $PulseTimeout = true
    Evidence: .omo/evidence/loop-v3-task1-exit-code.txt
  ```

  **Evidence to Capture**:
  - [ ] Timeout value confirmed as 60
  - [ ] Exit code = 0 on timeout scenario

  **Commit**: NO (groups with Task 5)

- [x] 4. Create circuit breaker test script

  **What to do**:
  - Create `00-System/Tools/test-circuit-breaker.ps1`
  - Test script should:
    1. Override `$TripCount` to 1 (so one failure trips)
    2. Override `$CoolDownMinutes` to 0.01 (~0.6s)
    3. Inject a simulated failure → verify state = OPEN
    4. Wait for cool-down → run successful → verify state = HALF_OPEN
    5. Run successful again → verify state = CLOSED
    6. Run successful 3 times clean → verify state = CLOSED (no false trip)
   - Defines INLINE `Test-ReadCircuitBreaker` / `Test-WriteCircuitBreaker` functions in the test script itself (since Task 2's functions don't exist yet — Wave 1 runs before Wave 2)
  - Outputs PASS/FAIL per step with evidence to `.omo/evidence/`

  **Must NOT do**:
  - Don't test the real scheduler — unit-test the state machine only
  - Don't modify loop-vault-pulse.ps1 in this task

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple test script, ~50 lines
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None (start immediately)

  **References**:
  - `00-System/Tools/loop-evaluator.ps1:222-268` — Existing self-test pattern (Invoke-Evaluator scenario pattern)
  - Metis recommendation: "Write a test-circuit-breaker.ps1 that injects failures and verifies state transitions"
  - Circuit breaker state machine spec: CLOSED (normal) → OPEN (N failures) → HALF_OPEN (cool-down) → CLOSED (M successes)

  **Acceptance Criteria**:
  - [ ] Test script exists at `00-System/Tools/test-circuit-breaker.ps1`
  - [ ] Inject-failure test: CLOSED → OPEN transition verified
  - [ ] Cool-down test: OPEN → HALF_OPEN → CLOSED transition verified
  - [ ] Clean run test: stays CLOSED after 3 successes
  - [ ] Script exits 0 on all-pass, 1 on any failure

  **QA Scenarios**:
  ```
  Scenario: Test script runs and all transitions pass
    Tool: Bash (PowerShell)
    Preconditions: No existing .omo/loop-circuit-breaker.json
    Steps:
      1. Run: .\00-System\Tools\test-circuit-breaker.ps1
      2. Check exit code
      3. Check output for "ALL PASS" or "FAIL"
    Expected Result: Exit 0, "ALL PASS" in output
    Evidence: .omo/evidence/loop-v3-task4-test-pass.txt

  Scenario: Circuit breaker file cleaned after test
    Tool: Bash (PowerShell)
    Steps:
      1. Check that .omo/loop-circuit-breaker.json does not exist (test should clean up)
    Expected Result: No stale state file left behind
    Evidence: .omo/evidence/loop-v3-task4-cleanup.txt
  ```

  **Evidence to Capture**:
  - [ ] Test script exits 0 with "ALL PASS"
  - [ ] No stale circuit breaker file

  **Commit**: NO (groups with Task 5)

- [x] 2. Add circuit breaker state machine

  **What to do**:
  - In `00-System/Tools/loop-vault-pulse.ps1`, add TWO functions at the top (after the param block, before Step 1):
    1. `Read-CircuitBreaker` — reads `.omo/loop-circuit-breaker.json`, returns state object with defaults
    2. `Write-CircuitBreaker` — atomically writes state (temp file + rename) to `.omo/loop-circuit-breaker.json`
  - State object schema:
    ```json
    {
      "state": "CLOSED|OPEN|HALF_OPEN",
      "consecutiveFailures": 0,
      "consecutiveSuccesses": 0,
      "lastFailureTimestamp": null,
      "lastSuccessTimestamp": null,
      "lastStateChange": "ISO timestamp"
    }
    ```
  - Add circuit breaker check AFTER Step 1b (PID lock) and BEFORE Step 2 (read config):
    - If state = OPEN → calculate elapsed time since `lastStateChange`
    - If elapsed > 30min → transition to HALF_OPEN, log "Circuit breaker: OPEN → HALF_OPEN (cool-down elapsed)"
    - If state = OPEN and cool-down NOT elapsed → exit 0 with "Circuit breaker is OPEN, skipping run"
  - Add circuit breaker update AFTER pulse generation (Step 4):
    - If pulse succeeded (exit 0, no timeout) → `consecutiveFailures = 0`, `consecutiveSuccesses++`
    - If `state = HALF_OPEN` and `consecutiveSuccesses >= 2` → transition to CLOSED
    - If pulse failed (timeout or non-zero) → `consecutiveSuccesses = 0`, `consecutiveFailures++`
    - If `consecutiveFailures >= 3` → transition to OPEN, log "Circuit breaker: tripped OPEN after N failures"
  - All transitions logged with `Write-Host "[circuit-breaker] ..."`

  **Must NOT do**:
  - No external module dependencies
  - No changes outside loop-vault-pulse.ps1
  - No email/Slack alerts on circuit trip
  - No file locking on CB file (single process writes)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: State machine impl with file I/O, atomic writes, careful error handling
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1 + 4)
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 4

  **References**:
  - `00-System/Tools/loop-vault-pulse.ps1:31-108` — Read-Slot/Write-Slot pattern (file I/O to follow)
  - `00-System/Tools/loop-vault-pulse.ps1:124-148` — PID lock pattern
  - Cordum circuit breaker: trip=3, open=30min, close=2 successes

  **Acceptance Criteria**:
  - [ ] Read-CircuitBreaker returns defaults when file missing
  - [ ] Write-CircuitBreaker atomically writes valid JSON
  - [ ] OPEN + cool-down elapsed → HALF_OPEN
  - [ ] OPEN + cool-down NOT elapsed → exit 0 skip
  - [ ] 3 consecutive failures → OPEN
  - [ ] HALF_OPEN + 2 successes → CLOSED
  - [ ] All transitions logged to console

  **QA Scenarios**:
  ```
  Scenario: OPEN after 3 failures
    Tool: Bash (PowerShell)
    Steps:
      1. Set CB state to CLOSED, consecFailures=0
      2. Run loop with failing pulse, 3 times
      3. Read .omo/loop-circuit-breaker.json
    Expected: state=OPEN, consecFailures>=3
    Evidence: .omo/evidence/loop-v3-task2-cb-open.txt

  Scenario: CB skips when OPEN
    Tool: Bash (PowerShell)
    Steps:
      1. Set CB state=OPEN, lastStateChange=now
      2. Run loop-vault-pulse.ps1
    Expected: "Circuit breaker is OPEN, skipping run", exit 0
    Evidence: .omo/evidence/loop-v3-task2-cb-skip.txt

  Scenario: CB recovers after cool-down
    Tool: Bash (PowerShell)
    Steps:
      1. Set CB state=OPEN, lastStateChange=90min ago
      2. Run loop (succeeds) → read state
      3. Run again (succeeds) → read state
    Expected: Run 1: HALF_OPEN. Run 2: CLOSED
    Evidence: .omo/evidence/loop-v3-task2-cb-recover.txt
  ```

  **Evidence to Capture**:
  - [ ] OPEN after 3 failures
  - [ ] Skip message when OPEN
  - [ ] HALF_OPEN → CLOSED recovery

  **Commit**: NO (groups with Task 5)

- [x] 3. Add pulse health metrics to report

  **What to do**:
  - In `00-System/Tools/loop-vault-pulse.ps1`, add two sections to the report template
  - After Step 6 and before Step 7, insert:
    ```
    ## Circuit Breaker Health
    - State: ${CBState}
    - Consecutive failures: ${CBFailures}
    - Consecutive successes: ${CBSuccesses}
    - Last failure: ${CBLastFailure}
    - Last success: ${CBLastSuccess}
    - Last state change: ${CBLastChange}

    ## Pulse Execution
    - Result: ${PulseResult} (completed/timed_out/skipped)
    - Source: ${PulseSource}
    ```
  - Variables from circuit breaker (Task 2) + pulse result (Task 1)
  - If no CB file yet, show "(first run)" for state field

  **Must NOT do**:
  - Don't redesign report — just add sections
  - Don't modify existing sections
  - Don't add dependencies

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Tasks 1, 4)
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 5
  - **Blocked By**: Tasks 1, 4

  **References**:
  - `loop-vault-pulse.ps1:416-442` — Report template
  - `loop-vault-pulse.ps1:353-387` — Trend section pattern

  **Acceptance Criteria**:
  - [ ] "Circuit Breaker Health" section in pulse report
  - [ ] "Pulse Execution" section in pulse report
  - [ ] All fields populated, no broken markdown
  - [ ] Existing sections unchanged

  **QA Scenarios**:
  ```
  Scenario: Health metrics in pulse output
    Tool: Bash (PowerShell)
    Steps:
      1. Run loop-vault-pulse.ps1
      2. Check console output
      3. Check loop-last-run slot
    Expected: "Circuit Breaker Health" with populated fields
    Evidence: .omo/evidence/loop-v3-task3-health.txt

  Scenario: After failure state visible
    Tool: Bash (PowerShell)
    Steps:
      1. Trigger pulse failure
      2. Check health section
    Expected: Consecutive failures > 0
    Evidence: .omo/evidence/loop-v3-task3-failures.txt
  ```

  **Commit**: NO (groups with Task 5)

- [ ] 5. Git commit all loop scripts

  **What to do**:
  - Stage + commit:
    - `00-System/Tools/loop-vault-pulse.ps1`
    - `00-System/Tools/loop-maker-checker.ps1`
    - `00-System/Tools/loop-evaluator.ps1`
    - `00-System/Tools/test-circuit-breaker.ps1`
  - Message: `feat(vault): add circuit breaker resilience and fix scheduled task timeout`
  - Pre-commit: run test-circuit-breaker.ps1 and verify ALL PASS

  **Must NOT do**:
  - No loop-slots.json (runtime state)
  - No evidence files
  - No git push

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Final Verification Wave
  - **Blocked By**: Tasks 2, 3

  **Acceptance Criteria**:
  - [ ] git log shows new commit with loop scripts
  - [ ] git status clean for those files
  - [ ] Conventional commit format
  - [ ] Evidence files NOT in commit

  **QA Scenarios**:
  ```
  Scenario: Git commit works
    Tool: Bash (PowerShell)
    Steps:
      1. git log --oneline -5
      2. git diff --name-only HEAD~1..HEAD
    Expected: Latest commit shows loop scripts
    Evidence: .omo/evidence/loop-v3-task5-git.txt

  Scenario: Working tree clean
    Tool: Bash (PowerShell)
    Steps:
      1. git status --short
    Expected: No uncommitted loop scripts
    Evidence: .omo/evidence/loop-v3-task5-status.txt
  ```

  **Commit**: YES
  - Message: `feat(vault): add circuit breaker resilience and fix scheduled task timeout`
  - Files: `00-System/Tools/loop-vault-pulse.ps1`, `00-System/Tools/loop-maker-checker.ps1`, `00-System/Tools/loop-evaluator.ps1`, `00-System/Tools/test-circuit-breaker.ps1`
  - Pre-commit: `.\00-System\Tools\test-circuit-breaker.ps1` — must exit 0

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Verify: timeout=60s, exit 0 guaranteed, CB functions exist, state transitions correct, health sections present, git commit done.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Review loop-vault-pulse.ps1: atomic writes, no hardcoded paths, error handling on CB file, console logging for transitions.
  Output: `Scripts [PASS/FAIL] | VERDICT`

- [x] F3. **Real QA** — `unspecified-high`
  Execute ALL QA scenarios from ALL tasks. Test cross-task integration. Test edge cases: CB file missing, CB file corrupted.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  1:1 compliance: everything in scope was built, nothing beyond scope. Check "Must NOT do" (no evaluator/maker-checker changes).
  Output: `Tasks [N/N compliant] | Contamination [CLEAN] | VERDICT`

---

## Commit Strategy

- **Final commit**: `feat(vault): add circuit breaker resilience and fix scheduled task timeout`
  Pre-commit: `.\00-System\Tools\test-circuit-breaker.ps1` — must exit 0

---

## Success Criteria

### Verification Commands
```powershell
# Timeout change
Select-String -Path "00-System/Tools/loop-vault-pulse.ps1" -Pattern "Wait-Job -Timeout"
# Expected: -Timeout 60

# Circuit breaker file
Test-Path ".omo/loop-circuit-breaker.json"
# Expected: True (or created on first run)

# Health metrics
Select-String -Path "70-Memory/context/pulse.md" -Pattern "Circuit Breaker Health"
# Expected: found

# Git commit
git log --oneline -3
# Expected: feat(vault): add circuit breaker...
```

### Final Checklist
- [ ] Timeout changed to 60s
- [ ] Exit code 0 on timeout
- [ ] CB: 3 failures → OPEN
- [ ] CB: cool-down → HALF_OPEN
- [ ] CB: 2 successes → CLOSED
- [ ] Pulse report has Circuit Breaker Health section
- [ ] Pulse report has Pulse Execution section
- [ ] test-circuit-breaker.ps1 exits 0
- [ ] All 4 scripts git-committed
- [ ] No changes to evaluator/maker-checker
- [ ] No evidence files committed

