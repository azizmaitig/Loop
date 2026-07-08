# Implementation Plan: Execute Phases Extraction

## Overview

Extract a shared `executePhases()` function used by both `loop.ts` (`tick()`) and
`daemon.ts` (`processQueue()`). The shared function lives in `src/execute-phases.ts`
and accepts an `ExecutionDeps` interface. Both callers wire their real deps.

See ADR-0004 for full architecture decision.

## Architecture Decisions

- Standalone async function, not a class method
- `ExecutionDeps` interface with: mcp client, llm provider, evaluate function, saveState function
- Both loop.ts and daemon.ts import and call it
- Loop.ts drops ~30 LOC, daemon.ts drops ~50 LOC (on top of the task-processor extraction)

## Task List

### Phase 1: Extraction

- [ ] **Task 1.1**: Create `src/execute-phases.ts`
  - Define and export `ExecutionDeps` interface
  - Define and export `executePhases(phases: PhaseDef[], deps: ExecutionDeps): Promise<PhaseResult[]>`
  - Extract the common algorithm from loop.ts tick() and daemon.ts processQueue():
    1. Iterate phases
    2. Call MCP or LLM per phase (based on phase config)
    3. Evaluate each result
    4. Collect results array
  - Acceptance: module compiles, interface is clean
  - Files: `src/execute-phases.ts` (new)
  - Scope: Small (1 file)

- [ ] **Task 1.2**: Wire into loop.ts
  - Replace tick() body with call to `executePhases()`
  - Construct ExecutionDeps from loop state
  - Remove now-unused imports and variables
  - Acceptance: `bun test __tests__/loop-*.test.ts` passes
  - Files: `src/loop.ts`, `src/execute-phases.ts`
  - Scope: Small (2 files)

- [ ] **Task 1.3**: Wire into daemon.ts
  - Replace processQueue() body with call to `executePhases()`
  - Construct ExecutionDeps from daemon state
  - Acceptance: `bun test __tests__/daemon*.test.ts` passes
  - Files: `src/daemon.ts`, `src/execute-phases.ts`
  - Scope: Small (2 files)

### Checkpoint: Extraction
- [ ] `bun test` passes
- [ ] loop.ts tick() delegates to executePhases()
- [ ] daemon.ts processQueue() delegates to executePhases()

### Phase 2: Tests

- [ ] **Task 2.1**: Add unit tests for execute-phases.ts
  - Test with fake ExecutionDeps (no real MCP/LLM/IO)
  - Cover: single phase, multiple phases, phase failure, evaluate fail, empty phases
  - Acceptance: `bun test __tests__/execute-phases.test.ts` passes
  - Files: `__tests__/execute-phases.test.ts` (new)
  - Scope: Small (1 file)

### Checkpoint: Tests
- [ ] `bun test` passes
- [ ] New test file covers happy + failure paths

### Phase 3: Cleanup

- [ ] **Task 3.1**: Remove dead code
  - Remove any private helpers in loop.ts or daemon.ts that were only used for phase execution and are now dead
  - Update CONTEXT.md: add execute-phases.ts to module table
  - Acceptance: `bun test` passes, no dead exports
  - Files: `src/loop.ts`, `src/daemon.ts`, `CONTEXT.md`
  - Scope: Small (2-3 files)

### Checkpoint: Complete
- [ ] `bun test` passes
- [ ] CONTEXT.md updated with execute-phases.ts
- [ ] ADR-0004 implemented as designed
- [ ] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| loop.ts and daemon.ts have different phase semantics | Med | Audit both callers before extraction; annotate any differences with ponytail: comments |
| ExecutionDeps interface changes as we extract | Low | Keep deps minimal; add fields only when both callers need them |
| Breaking existing daemon/loop tests | High | Run full test suite after each task |

## Verification

- [ ] `bun test` — all 392 existing tests pass
- [ ] `bun run src/index.ts start --task demo` works
- [ ] `bun run src/daemon.ts` boots and processes tasks
