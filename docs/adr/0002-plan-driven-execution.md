# 0002 — Plan-driven execution

Agent-loop v5 adds a `--plan <path>` CLI flag that replaces runtime configuration with a `.plan.yaml` file. The plan file defines tasks executed sequentially by the loop — a mode where the external plan file, not agent-loop config, is the single source of truth for what runs.

## Context

v5 extends the plugin interface from 3 to 5 lifecycle hooks (`beforeLoop`, `afterLoop` added). The new `beforeLoop` hook reads `.plan.yaml` and returns `PhaseDef[]` that replace `LoopConfig.phases` entirely. The new `afterLoop` hook writes per-task status, duration, and `completedAt` back to the plan file, plus logs results to agentmemory.

Plan files use a custom YAML parser in `plan-executor.ts` — no external YAML library added. Plugins are loaded dynamically via the existing `loadPlugins()` mechanism.

## Decision

- `beforeLoop` reads `.plan.yaml` → returns `PhaseDef[]` that replace `LoopConfig.phases` entirely (replace, not merge)
- `afterLoop` writes per-task status/duration/completedAt back to `.plan.yaml` + logs to agentmemory
- Custom YAML parser in `plan-executor.ts` — no external YAML lib dependency
- Sequential execution only — parallel task execution is out of scope for v5
- Plugin is loaded dynamically via existing `loadPlugins()` mechanism

## Rationale

**Replace-over-merge** was chosen for three reasons:

| Factor | Replace | Merge |
|--------|---------|-------|
| Merge conflicts | None — single source of truth | Ambiguous ordering when plan + config both define phases |
| Predictability | Plan file is authoritative during plan-driven run | Half the phase list comes from config, half from plan |
| Failure mode | Missing plan file → error at startup, easy to diagnose | Partial merge may silently drop phases or duplicate them |

A custom YAML parser avoids adding a dependency for a single small schema. The plan file format is simple: a top-level `tasks` array with `id`, `command`, optional `timeoutMs`, and optional `llm`. Adding `js-yaml` for that is disproportionate.

## Considered Options

- **Merge plan tasks with existing phases** — discarded. Complex merge logic with ambiguous ordering. A config-driven phase and a plan-driven phase targeting the same position in the sequence would require conflict resolution heuristics.
- **Use JSON instead of YAML** — discarded. YAML is more human-editable for plan files that users write and read directly. Comments, trailing commas, and multi-line strings are common in hand-authoring workflows.

## Consequences

- Config-driven and plan-driven are mutually exclusive modes. The presence of `--plan` selects plan-driven mode; without it, config-driven mode behaves as v4.
- OpenCode CLI can drive agent-loop via plan files without modifying agent-loop's own config — useful for CI and scheduled runs.
- The custom YAML parser supports only the plan schema. If the schema expands (parallel tasks, conditional execution, retry policies), the parser must expand in lockstep.
- Plan file mutations by `afterLoop` mean the plan file is both input and output — users should version-control plan files or treat them as ephemeral.
