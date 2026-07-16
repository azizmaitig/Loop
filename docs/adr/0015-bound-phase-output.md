# 0015 — Bound per-phase raw output in LoopState (offload-to-disk)

Per-phase `PhaseResult.stdout` / `stderr` retain the FULL shell output in the
in-memory `LoopState` for the lifetime of the run. Across `maxIterations` (cap 20)
and verbose phases (e.g. `bun run build`), this lets the `state` object and the
re-serialized `state.json` grow without bound within a single iteration's retained
output, increasing RAM and checkpoint-serialize cost.

Note: cross-iteration accumulation is ALREADY bounded — `applyTransition`
(`src/transition.ts:27`) clears `phaseResults` on every `LOOP` transition, and the
daemon fires each scheduled run through a fresh `runLoop`/`LoopState`. The residual
risk is per-phase raw-output size × `maxIterations`, not cross-iteration growth.

## Decision

- Keep `PhaseResult.stdout` / `stderr` as live string fields, but **cap them in
  memory to `PHASE_OUTPUT_TAIL = 2000` chars**.
- When a phase's raw output exceeds 2000 chars, the FULL output is written to disk
  at `_agent-loop-output/runs/<planName|taskName>/<iter>-<phase>.log`, and
  `PhaseResult.stdoutPath` / `stderrPath` (optional, set only when offloaded) point
  to that file. The in-memory `stdout`/`stderr` hold only the 2000-char tail.
- Small phases (output ≤ 2000 chars, e.g. `type STATE.md`) are NOT offloaded — no
  extra file IO for the common case.
- Offload files are cleaned up on full successful completion, alongside the existing
  checkpoint clear (`loop-runner.ts` `clearCheckpoint` on `allPassed`).
- Field names unchanged → `evaluate.ts`, `eval-core.ts`, `loop-runner.ts:63`
  (`stdout.slice(0,500)`), logging, and all existing tests keep working without
  rewrite.

## Rationale

| Factor | Offload-to-disk + tail (chosen) | Truncate-only (no disk) | Cap-no-disk (N=50KB) |
|--------|--------------------------------|--------------------------|----------------------|
| Memory bound | Hard cap 2000 chars/phase | Hard cap N chars/phase | Hard cap 50KB/phase |
| Full output on crash | Survives on disk for debug | Lost | Lost |
| File IO cost | Only when output > 2000 | None | None |
| Debuggability | Full output retrievable | Lost | In memory, huge |
| Blast radius | Low (field names kept) | Low | Low |

Mirrors the repo's established "disk is authoritative, checkpoint as source of
truth" philosophy (ADR-0003) and the production pattern of offloading bulky tool
output to a filesystem reference (LangChain Deep Agents offloads >20K tokens;
Anthropic multi-agent externalizes completed-phase output).

## Considered Options

- **Cross-iteration ring buffer** — discarded: `applyTransition` already clears
  `phaseResults` on LOOP, so a ring buffer would be redundant dead code.
- **Rename `stdout`→`stdoutTail` + `stdoutPath`** — discarded: cleaner vocabulary
  but touches every reader and ~33 test files for no behavioral gain.
- **Always offload (every phase, even small)** — discarded: needless file IO for
  the dominant small-phase case (`type STATE.md`, build success).

## Consequences

- `LoopState.phaseResults[phase]` memory is bounded to ~2000 chars/phase regardless
  of raw output volume; `state.json` serialization cost stays flat across iterations.
- Full phase output remains available on disk for post-mortem / crash debugging.
- New module or helper: output-offload logic lives in `src/execute-phases.ts`
  (where `result` is built) or a small `src/output-store.ts`; offload dir created
  under `OUTPUT_DIR/runs/`.
- New config key optional: `phaseOutputTailChars` (default 2000) — not required for
  the initial implementation.
- Tests: add cases for (a) small output stays inline, (b) large output offloaded +
  tail retained, (c) offload files cleaned on completion.
