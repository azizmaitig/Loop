# 0011 — Wiring healCommand / maxRetries into the engine (spec only)

## Status

Spec for a **separate future change**. This ADR documents exactly what must be done to
make the `code` stage's `healCommand` + `maxRetries: 3` (authored in
`.omo/plans/build-app-pipeline.yaml`, rail R1) actually execute. **This plan does NOT
implement it** — it only authors the pipeline template + ADR-0010/0011. Editing `src/`
is out of scope for the build-app-pipeline plan (planner role, AGENTS.md L1 report-only
until L2).

## Context

ADR-0009 established that the per-phase heal/retry seam was **dead code**:
`execute-phases.ts` read `healCommand`/`maxRetries` off the phase via `as unknown as
Record`, but `PhaseDef` (`src/types.ts:3-12`) has no such fields and `plan-executor.ts`
(`:25-38`) only copies `id`→`name`, `command`, `timeoutMs`, `llm`. So in plan-driven mode
those values are always `undefined` and the `if` never entered. ADR-0009 deleted the dead
block rather than reviving it.

The build-app-pipeline template nonetheless authors `healCommand` + `maxRetries: 3` on
the `code` stage (rail R1, redefined). Until this ADR is implemented, those fields are
**no-ops**: a `code` failure ends the run via the command's non-zero exit
(`execute-phases.ts:104-110`), gated only by timeoutMs + the `--max-iterations` cap. This
ADR specifies making them real in a future change.

`src/recovery.ts` already defines `RecoveryStrategy.healAndRetry` (with a `HealConfig`
shape `{ healCommand, maxRetries }`). It has **no live caller**. The wiring is therefore
small — a mapping addition plus re-invoking the block — not a redesign.

## Decision (precise spec for the future change)

Three surgical edits, in this order:

### 1. `src/types.ts` — add heal fields to `PhaseDef`

```ts
export interface PhaseDef {
  name: string;
  command: string;
  expectedExitCode: number;
  timeoutMs: number;
  llm?: /* existing union */;
  pluginHooks?: string[];
  healCommand?: string;   // NEW
  maxRetries?: number;    // NEW
}
```

(Keep `PlanYamlTask` as-is — it already declares `healCommand?`/`maxRetries?` at
`src/types.ts:77-78`. Only `PhaseDef` needs the addition.)

### 2. `src/plan-executor.ts` — map the fields in `beforeLoop` (`:25-38`)

Inside the `doc.tasks.map(...)` that builds `phases`, add:

```ts
healCommand: task.healCommand,
maxRetries: task.maxRetries,
```

so a phase carries the heal config when the YAML provides it.

### 3. `src/execute-phases.ts` — revive the post-fail heal/retry block

Replace the current dead-code comment at `:104-110` with a real post-fail branch that,
when `phase.healCommand` is present and `ctx.runCommand` is injected:

```ts
if (result.exitCode !== 0 && phase.healCommand && ctx.runCommand) {
  const { healed } = await RecoveryStrategy.healAndRetry(
    ctx, phase, result,
    { healCommand: phase.healCommand, maxRetries: phase.maxRetries ?? 1 },
  );
  if (healed) { /* continue to next phase */ }
  else { /* notify caller as today (failTerminal path) */ }
}
```

`RecoveryStrategy.healAndRetry` (recovery.ts) already implements the loop: run
`healCommand` up to `maxRetries` times, and on heal success re-run `phase.command`;
if the re-run exits 0, mutate `result` to `pass` in place. No change to recovery.ts
itself is required — only a caller.

### Constraints preserved

- No parallel execution (ADR-0002 / CONTEXT.md v8). Heal re-runs are sequential.
- `verify` remains the non-LLM hard gate; heal only applies to stages that opt in via
  `healCommand` (today: `code`). It must NOT attach an `llm` block or change the
  exit-code contract.
- Max attempts per the template is `maxRetries: 3` (rail R1); escalate to `failTerminal`
  after exhaustion — consistent with AGENTS.md "max 3 fix attempts per item."

## Consequences

- The `code` stage's `healCommand`/`maxRetries` become live: a build/test failure triggers
  up to 3 heal attempts before the run fails, instead of terminating on first failure.
- `design-critique` / `review` / `evaluate` LLM `passed:false` still do NOT fail a phase
  unless the command exits non-zero (`loop-runner.ts` resolveHardcoded) — unaffected.
- `execute-phases.ts` regression test must lock the new behavior (heal on fail, terminal
  on exhaustion) before merge.

## Out of scope (explicitly NOT done here)

- No edits to `src/` in the build-app-pipeline plan. This is a distinct future change.
- No auto-pickup / self-advancing (that is ADR-0010, which also depends on this wiring).
- No change to `PhaseDef.llm` or the verify gate.

## References

- `src/types.ts:3-12` (PhaseDef — add heal fields here)
- `src/types.ts:77-78` (PlanYamlTask already has healCommand/maxRetries)
- `src/plan-executor.ts:25-38` (beforeLoop mapping — add the two fields)
- `src/execute-phases.ts:104-110` (post-fail hook — revive block here)
- `src/recovery.ts` (`RecoveryStrategy.healAndRetry` + `HealConfig` — already defined, unwired)
- `src/loop-runner.ts:120-125` (resolveHardcoded — LLM passed:false does not fail phase)
- `docs/adr/0009-recovery-guard-separation.md` (heal left unwired)
- `.omo/plans/build-app-pipeline.yaml` (the `code` stage that authors the no-op-until-wired fields)
