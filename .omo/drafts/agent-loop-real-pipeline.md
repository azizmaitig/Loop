# Draft: agent-loop — Real Pipeline PhaseDefs

## Context
agent-loop v2 is fully implemented (14/14 tasks, 108 tests). The only task is `DEMO_TASK` with echo commands. Next step: wire up real PhaseDef entries for a production pipeline.

## Key Questions (unanswered)
1. WHAT production pipeline should agent-loop orchestrate? (e.g., vault automation, code review, project management cycle?)
2. Which existing vault projects/tools should the phases call?
3. Should this be a CLI task or daemon-mode pipeline?
4. Any specific tools/scripts in the vault the loop should invoke?
