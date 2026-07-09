# 0010 — Path B: self-advancing stage-pipeline (meta-plan + StageManager)

## Status

Proposed (design only). Not yet implemented. Path B is an optional future upgrade
to the build-app-pipeline (`.omo/plans/build-app-pipeline.yaml`). It does NOT change
the 10-stage order or the executor; it adds a layer that lets the loop advance/repeat
individual stages instead of re-running the whole plan.

## Context

The current `build-app-pipeline.yaml` is executed by `src/plan-executor.ts` as a flat
list of phases. Each phase runs once in array order; `--max-iterations N` re-loops the
**entire** plan N times on pass (`loop-runner.ts:122` → `COMPLETE` at
`iteration >= maxIterations-1`). There is:

- no cross-stage product state beyond the `.build/*.md` files each stage writes,
- no notion of "re-do stage 4 because stage 7 found a design gap" without rebuilding
  everything,
- no event that auto-picks up a changed artifact and re-runs downstream stages.

For long builds this is expensive: a late-stage failure (e.g. `test` or `review`) forces
a full rebuild from `read-state` if the owner wants to iterate. Path B addresses this by
introducing a meta-plan that treats each of the 10 stages as an independently addressable
node with explicit onPass/onFail transitions.

## Decision

Add a `pipeline.yaml` meta-plan layer above the existing stage plan:

```yaml
# pipeline.yaml (Path B — speculative, not wired yet)
stages:
  - id: read-state
    plan: .omo/plans/build-app-pipeline.yaml#read-state
    onPass: next
    onFail: loop        # re-run this stage (subject to maxRetries once ADR-0011 lands)
  - id: planning
    plan: .omo/plans/build-app-pipeline.yaml#planning
    onPass: next
    onFail: loop
  # ... research, design, design-critique, code, test, review, evaluate, verify ...
  - id: verify
    plan: .omo/plans/build-app-pipeline.yaml#verify
    onPass: done
    onFail: jump:design   # optional short-circuit back to design instead of full restart
```

Components:

- **`pipeline.yaml`** — the meta-plan. Lists `stages[]`; each entry points at a single
  stage (by `id` anchor into the existing `build-app-pipeline.yaml`) and declares
  `onPass` / `onFail` transitions (`next`, `loop`, `done`, or `jump:<stage>`).
- **`StageManager`** — a new orchestration module that consumes `pipeline.yaml`, tracks
  the current stage, persists cross-stage product state to
  `{{TARGET_DIR}}/.build/stages.yaml`, and advances/repeats stages per the transitions.
  It owns the five safety rails from `build-app-pipeline.yaml` (R1 recovery guard,
  R2 file-based context, R3 scope-creep, R4 evidence-not-claim, R5 checkpoint/resume) as
  operational responsibilities rather than as plan-embedded comments.
- **`plan-generator`** (optional, LLM) — given a `spec.md`, emits a `pipeline.yaml`
  variant (e.g. omitting `deploy`, or inserting an extra `proto` stage). This is the
  most speculative piece and requires a configured LLM controller.

### fileWatch auto-pickup — SPECULATIVE

`src/orchestrator.ts:158-162` already defines a `fileWatch` trigger that, when fired,
enqueues `bun run loop.ts start --plan "<path>" --max-iterations 1`
(`orchestrator.ts:150`). This means the *mechanism* for "artifact changed → re-run a
stage" exists. However, it requires a configured `ChildLoopDef` with a `watchDir`
(and optionally `pattern`) in a `loops.yaml`. **No such child-loop config currently
exists**, so the auto-pickup path is not active today.

Therefore: the claim that "editing `design.md` automatically re-runs `design-critique`
→ `code`" is **speculative / not yet wired**. It depends on a future child-loop config
(and, for true per-stage re-runs, on `StageManager` from this ADR plus the heal wiring
from ADR-0011). Label it future work until a `loops.yaml` child-loop with `watchDir` is
authored and verified.

## Consequences

- The 10-stage order and per-stage `command`/`llm`/`timeoutMs` definitions in
  `build-app-pipeline.yaml` stay authoritative; `pipeline.yaml` references them by anchor.
- `StageManager` becomes the single owner of the 5 rails, reducing duplication across
  stage tasks.
- No parallel execution is introduced — `CONTEXT.md` (v8 architecture) and ADR-0002
  (no parallel) still hold; `stages[]` are sequential by `next` transition.
- Real per-stage `loop`/`jump` retry still requires ADR-0011 (heal wiring) before it
  can survive a command failure; until then `onFail: loop` only re-runs a stage that
  fails *transiently* within the existing iteration cap.

## Alternatives considered

- **Path A (status quo):** keep the flat plan + whole-plan `--max-iterations`. Simpler,
  but every iteration rebuilds from `read-state`; rejected for long builds only.
- **In-plan goto:** encode jumps as `healCommand` in the existing plan. Rejected — that
  overloads the (currently unwired) heal seam and is less legible than a dedicated
  `pipeline.yaml`.

## References

- `docs/adr/0002-plan-driven-execution.md` (phases run in array order)
- `docs/adr/0003-checkpoint-crash-recovery.md` (resume)
- `docs/adr/0009-recovery-guard-separation.md` (heal left unwired)
- `src/orchestrator.ts:140-164` (LoopOrchestrator trigger enqueue + fileWatch)
- `src/plan-executor.ts:21-50` (beforeLoop task→phase mapping)
- `src/types.ts:165-176` (TriggerDef / ChildLoopDef — fileWatch needs explicit config)
- `CONTEXT.md` (v8 architecture: no parallel execution)
- `.omo/plans/build-app-pipeline.yaml` (the 10 stages this meta-plan references)
