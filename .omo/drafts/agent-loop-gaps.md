---
slug: agent-loop-gaps
intent: clear
review_required: false
status: approved
pending_action: write .omo/plans/agent-loop-gaps.md
approach: Fix 4 gaps in agent-loop v7: CI pipeline, trigger e2e verification, budget parser consistency, stale daily-triage plan
---

## Gate

- [x] User approved scope via "ok" at m0220
- [x] Scope: CI pipeline, trigger e2e, budget parser, stale plan
- [x] Test strategy: agent-executed QA per todo
- [x] No high-accuracy review needed (user did not request it)

## Decisions ledger

| Decision | Resolution | Source |
|----------|-----------|--------|
| CI provider | GitHub Actions | User chose (DS store question) |
| Dashboard SPA | Already exists (859 lines) - out of scope | Exploration |
| Agentmemory hooks | Already exist - out of scope | Exploration |
| Budget parser | budget.ts handles malformed JSON - stale plan is the problem | Exploration |
