# ISSUE-003 — Triggers (cron + file watch)

## What to build

The daemon can execute tasks from two additional sources beyond the API: cron schedules and file system watches.

- Create `src/triggers.ts`:
  - `CronTrigger` — simple 5-field parser (minute hour day month weekday). Self-correcting: missed ticks are skipped, not queued late.
  - `FileWatchTrigger` — uses `fs.watch` on a directory, filters by `*.plan.yaml` pattern, 500ms debounce (avoids partial-write triggers), moves processed files to `.processed/` subdirectory
  - `TriggerManager` — register/startAll/stopAll, maps trigger config to implementation
- Wire into daemon:
  - `--cron "0 9 * * *"` flag → register cron trigger
  - `--watch-dir ./plans/watch` flag → register file watch
  - Config also read from `loops.yaml` (if loaded)
  - Triggers call `taskQueue.enqueue()` when they fire
- Parses cron expressions correctly:
  - `* * * * *` (every minute)
  - `0 9 * * *` (daily 9am)
  - `0 */6 * * *` (every 6 hours)
- Handle edge cases: invalid cron expression (graceful error), watch dir doesn't exist (create it), debounce rapid writes, daemon starts mid-cron-cycle

## Acceptance Criteria

- [ ] `CronTrigger` fires callback at correct times (test with mock clock — short intervals)
- [ ] `FileWatchTrigger` fires when a `.plan.yaml` appears in watched dir
- [ ] File watch debounce: writing file in 3 rapid bursts → 1 trigger
- [ ] Processed file moved to `.processed/{filename}` after trigger
- [ ] `TriggerManager.startAll()` activates all registered triggers
- [ ] `TriggerManager.stopAll()` deactivates all
- [ ] Invalid cron expression → logged warning, trigger not registered
- [ ] Nonexistent watch dir → created automatically
- [ ] Wire into daemon: `--cron` and `--watch-dir` flags work
- [ ] All existing tests pass

## Blocked by

- ISSUE-002 (task queue must exist for triggers to enqueue onto)
