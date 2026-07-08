# Draft: agent-loop v5 — OpenCode orchestrator plugin

## Requirements (confirmed)

- [x] OpenCode orchestrator plugin that reads a plan file and executes tasks as loop phases
- [x] Plugin implements agent-loop's Plugin interface (extend 3→5 hooks)
- [x] Plan format: YAML companion to .omo/plans/*.md
- [x] Loop calls plugin hooks: beforeLoop → load plan YAML, creates phases dynamically; afterLoop → writes completion summary
- [x] Plugin source at `src/opencode-plugin.ts`
- [x] Loop runner at root `loop.ts`
- [x] TDD: write tests first for each new concern

## Technical Decisions

- **Plugin interface extension**: Add `beforeLoop(planPath: string): PhaseDef[]` and `afterLoop(result: LoopResult): void | Promise<void>` to Plugin interface in plugins.ts. Existing hooks unchanged: `onPhaseStart(phase: PhaseDef, state: LoopState)`, `onPhaseEnd(phase: PhaseDef, result: PhaseResult, state: LoopState)`, `onError(error: Error, phase: PhaseDef)`.
- **Plan companion**: YAML file at `{plan}.plan.yaml` alongside `.omo/plans/{plan}.md`
- **Plan path to plugin**: CLI `--plan` flag on loop.ts
- **beforeLoop returns PhaseDef[]**: Return REPLACES LoopConfig.phases entirely. Clean separation — plan-driven mode vs config-driven mode.
- **afterLoop writes completion summary**: Both — updates .plan.yaml in-place (status/timestamps per task) AND agentmemory via existing memory-hooks.ts callbacks
- **Each phase runs a single task** via MCP execution (existing executeMcpPhase)
- **Sequential by default** within a loop (v5 doesn't add parallel execution)

### YAML Plan Companion Schema

```yaml
# .omo/plans/my-plan.plan.yaml
tasks:
  - id: 1
    command: update CONTEXT.md to v4 architecture overview
    timeoutMs: 30000
    llm:
      mcpServer: filesystem
      tool: writeFile
      prompt: "Rewrite CONTEXT.md describing all 12 source files..."
  - id: 2
    command: bump package.json version
    timeoutMs: 10000
    llm:
      mcpServer: filesystem
      tool: editFile
      prompt: "Change version from 0.0.1 to 0.4.0"
```

Per task: `id` (string), `command` (string — natural language instruction), `timeoutMs` (optional number), `llm` (object with `mcpServer?`, `tool?`, `prompt`). Loop maps `llm` to `PhaseDef.llm` and executes via existing `executeMcpPhase`. No cwd, env, or expectedExitCode fields needed.

### beforeLoop Integration

- beforeLoop loaded via existing `loadPlugins` mechanism (dynamic import by file path)
- beforeLoop returns PhaseDef[] → loop runner replaces LoopConfig.phases with this array
- OpenCode plugin's beforeLoop reads .plan.yaml, constructs PhaseDef[] with:
  - name = task.id
  - command = task.command
  - timeoutMs = task.timeoutMs or fallback to config default
- Existing executeHooks pipeline triggers onPhaseStart/onPhaseEnd/onError per phase

### afterLoop Integration

- Called after loop completes (all phases done or error)
- Reads final state, writes status/timestamps back to .plan.yaml
- Existing memory-hooks.ts (onLoopComplete, onPhaseFailed, logPhaseContext) fire independently
- Result: dual persistence — plan YAML updated + agentmemory notified

## Verification Strategy

- **Framework**: bun test (existing v4 test suite — 147 tests across 11 files)
- **Approach**: TDD — write failing test first, implement, refactor
- **Test targets**:
  - Plugin interface extension (beforeLoop/afterLoop signatures)
  - opencode-plugin.ts integration (plan loading, PhaseDef construction)
  - loop.ts --plan flag parsing and wiring
  - afterLoop completion summary (YAML write + agentmemory)
- **Agent QA**: Every task includes executable QA scenarios with specific steps and assertions (see plan TODOs)
- **Regression**: `bun test` must pass before commit

### Error Handling (mid-loop task failure)

- Existing loop handles failures: PhaseResult has `status`/`error`, FAILED state → DONE
- afterLoop receives the result — reports failures in completion summary
- No special v5 error logic needed — existing mechanics cover it

## Scope Boundaries

- INCLUDE: Plugin interface extension (beforeLoop/afterLoop), src/opencode-plugin.ts, loop.ts --plan flag wiring, .plan.yaml schema, TDD tests, completion summary (YAML in-place + agentmemory)
- EXCLUDE: Parallel execution within loop, CLI bin field (deferred), plan generator (Prometheus produces .plan.yaml), hot reload, multi-plugin ordering
- DEFERRED: CONTEXT.md 3-hook accuracy fix (CONTEXT.md currently says 5 hook points but code has 3 — will fix in docs pass after v5)
