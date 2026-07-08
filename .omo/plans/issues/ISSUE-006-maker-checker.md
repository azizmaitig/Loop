# ISSUE-006 — Maker/checker plugin

## What to build

An optional plugin that adds a review phase after every maker phase. When a maker phase completes successfully, the plugin auto-schedules a checker phase that evaluates the maker's output. If the checker fails, the maker is retried up to a configurable limit.

- Create `src/maker-checker-plugin.ts`:
  - Export `createMakerCheckerPlugin(config: MakerCheckerConfig): Plugin`
  - Implements Plugin interface (5 hooks: onPhaseStart, onPhaseEnd, onError, beforeLoop, afterLoop)
  - **`onPhaseEnd(phase, result, state)`**:
    - If completed phase was 'maker' AND result.status === 'success':
      - Auto-inject a 'checker' phase after this phase
      - Checker gets the maker's output as context (stdout, stderr, files)
      - Checker LLM prompt: "Review this output. Is it correct? Reply PASS or FAIL."
    - If completed phase was 'checker':
      - Evaluate judgment
      - Pass → continue normally
      - Fail + retries < max → re-enqueue maker phase
      - Fail + retries >= max → mark phase FAILED
  - Config: `enabled` (default false), `makerModel`, `checkerModel`, `autoApprove` (default false), `maxCheckerRetries` (default 2)
- Must be loaded explicitly — not auto-loaded
- Follows existing plugin pattern (same as plan-executor or opencode-plugin)
- Write TDD tests:
  - enabled=false → hooks are no-ops
  - enabled=true → maker completes → checker scheduled
  - Checker passes → flow continues
  - Checker fails → retry maker (up to max)
  - Exhausted retries → phase FAILED

## Acceptance Criteria

- [ ] `createMakerCheckerPlugin({enabled: false})` returns Plugin with no-op hooks
- [ ] `createMakerCheckerPlugin({enabled: true})` → onPhaseEnd of maker schedules checker
- [ ] Checker pass → next phase proceeds normally
- [ ] Checker fail → maker re-enqueued (retry)
- [ ] Max retries exhausted → phase FAILED
- [ ] Plugin loaded via `--plugins` or `plugins` config (not auto-loaded)
- [ ] Existing Plugin interface unchanged
- [ ] All existing tests pass

## Blocked by

- ISSUE-001 (plugin system must be available — existing, but daemon must load plugins)
