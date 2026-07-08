# Draft: agent-loop-cron-triggers

## Metadata
- intent: CLEAR
- review_required: false

## Approach
Add a cron trigger entry to `_loops.yaml` and a Windows scheduled task that auto-starts the daemon on login.

## Open decisions
- Cron expression: `*/5 * * * *` (every 5 min) — easy to verify, adjustable later
- Plan: reuse `plans/file-watch-demo.yaml` for simplicity — it has echo + LLM tasks
- Windows task: `schtasks /create` on logon with 30s delay, runs in background
- Port: 3000 (existing, already working)
- Daemon args: `--port 3000 --loops-config _loops.yaml`
