---
slug: agent-loop-fixes-v2
intent: clear
review_required: false
status: approved
pending_action: write .omo/plans/agent-loop-fixes-v2.md
approach: Fix 3 issues: (1) llm-api.test.ts mock fails on custom endpoints, (2) agentmemory hooks E2E verification, (3) dashboard path resolution
---

## Gate

- [x] User approved at m0294
- [x] Scope: test fix, agentmemory E2E, dashboard
- [x] No high-accuracy review needed

## Decisions ledger

| Decision | Resolution | Source |
|----------|-----------|--------|
| Test fix | Fix `safeBodySnippet` to handle short bodies + make mock URL-agnostic | Exploration |
| Agentmemory | E2E test only — code already wired, just needs running daemon | Exploration |
| Dashboard | Fix path resolution in daemon.ts (use `import.meta.dirname + '/../dashboard/'`) | Exploration |
