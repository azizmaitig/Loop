# agent-loop v3: Agentmemory Integration

## TL;DR

> **Quick Summary**: Wire agent-loop into the vault's existing agentmemory MCP server (localhost:3111) to add cross-session recall, lesson extraction, session archiving, and pulse health scoring.
>
> **Deliverables**:
> - Agentmemory client module (raw HTTP client to localhost:3111)
> - Per-session episodic persistence (one save at loop completion)
> - Per-run session archive to `70-Memory/history/`
> - Lesson extraction on novel failure patterns
> - Pulse health score push (transparent ratio)
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: agentmemory client → episodic save → recall → archive → lessons → pulse

---

## Context

### Current State (v2)
- Filesystem-only memory: `STATE.md` + `state.json` per run
- No cross-session recall — each run starts blank
- No connection to vault's agentmemory daemon
- No session archiving to `70-Memory/history/`
- No lesson/pattern extraction

### Target State (v3)
```
┌──────────────────────────────────────────┐
│           agent-loop v3                   │
│                                           │
│  ┌──────────┐    ┌──────────────────┐     │
│  │ Loop     │───►│ Episodic: save   │     │
│  │ Complete │    │ LoopState on     │     │
│  └──────────┘    │ completion       │     │
│                  └────────┬─────────┘     │
│  ┌──────────┐            │               │
│  │ On       │            │               │
│  │ Phase    │            │               │
│  │ Failed   │───► save lesson            │
│  └──────────┘                            │
│  ┌──────────┐                            │
│  │ On Done  │───► archive + pulse        │
│  │          │    70-Memory/history/      │
│  ┌──────────┐               │            │
│  │ On       │               │            │
│  │ Failure  │───► save lesson            │
│  │ Extract  │                            │
│  └──────────┘                            │
│  ┌──────────┐                            │
│  │ On Done  │───► archive to             │
│  │          │    70-Memory/history/      │
│  └──────────┘                            │
└──────────────────────────────────────────┘
```

### Research Findings
Industry consensus: three-tier memory (episodic/semantic/procedural). Agentmemory MCP provides 51 tools covering all three tiers. The vault already has it running.

---

## Work Objectives

### Core Objective
Wire agent-loop into agentmemory MCP so every run learns from past runs and contributes to vault memory.

### Concrete Deliverables
- `src/agentmemory.ts` — client module wrapping agentmemory HTTP API (raw fetch, not MCP subprocess)
- Episodic save hook (per-session, one save at loop completion)
- Session archiver (on done, writes to `70-Memory/history/`)
- Lesson extractor (on novel failure, saves lesson)
- Pulse push (on done, pushes transparent ratio score)
- No retry — fire-and-forget with `.catch(() => {})`
- Integration into loop.ts lifecycle
- Tests for all new modules

### Must Have
- agentmemory daemon at localhost:3111 is optional — loop works without it
- Zero new npm dependencies (use fetch/Bun.stdlib)
- All v1 + v2 tests still pass
- Non-blocking — memory ops never stall phase execution

### Must NOT Have (Guardrails)
- No breaking changes to existing types
- No agentmemory-specific logic in PhaseDef or LoopConfig (keep it in the hook layer)
- No writing to agentmemory from within phase execution (only at lifecycle points)

---

## Verification Strategy

### Test Decision
- **Infrastructure exists**: YES (bun test, agentmemory at localhost:3111)
- **Automated tests**: TDD
- **Framework**: bun test
- **Agentmemory mocking**: mock HTTP responses for deterministic tests

---

## Execution Strategy

```
Wave 1 (Foundation — 2 parallel):
├── 1. agentmemory client module (src/agentmemory.ts)
└── 2. Types + config for memory hooks

Wave 2 (After Wave 1 — 2 parallel):
├── 3. Episodic save hook (per-session) + session archiver
└── 4. Lesson extractor + pulse push

Wave 3 (After Wave 2 — 2 parallel):
├── 5. Wire into loop.ts lifecycle (onPhaseFailed + onLoopComplete)
└── 6. Tests (agentmemory.test.ts + memory-hooks.test.ts)

Wave FINAL (4 parallel reviews):
├── F1. Plan compliance audit
├── F2. Code quality + regression
├── F3. Real QA: agentmemory integration
└── F4. Scope fidelity check
```

---

## TODOs

- [x] 1. agentmemory client module

  **What to do**:
  - Add `src/agentmemory.ts` — exports functions wrapping the agentmemory MCP HTTP API
  - Functions: `saveEpisodic(state, taskName)`, `recallLessons(taskName)`, `archiveSession(state, taskName)`, `saveLesson(content, context)`, `pushPulse(healthScore)`
  - HTTP client via `fetch()` (Bun built-in, zero deps) to `http://localhost:3111`
  - All functions gracefully handle connection refused (no crash)
  - Fire-and-forget — no retry, no await in critical path, errors swallowed via `.catch(() => {})`

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 1

  **QA Scenarios**:
  - agentmemory not running → function returns null, no crash
  - agentmemory running → function returns response data
  - Timeout after 2s → function returns null

- [x] 2. Types + config for memory hooks

  **What to do**:
  - Add `MemoryConfig` type: `{ enabled: boolean; agentmemoryUrl?: string; archivePath?: string }`
  - Add optional `memory?: MemoryConfig` to `LoopConfig`
  - Default: `{ enabled: false }` — no agentmemory calls unless explicitly configured

  **Recommended Agent Profile**: `quick`
  **Parallelization**: Wave 1

  **QA Scenarios**:
  - TypeScript compiles with `memory: { enabled: false }`
  - TypeScript compiles with `memory: { enabled: true, agentmemoryUrl: "http://localhost:3111" }`
  - Default config produces no agentmemory calls

- [x] 3. Episodic save hook (per-session) + session archiver

  **What to do**:
  - Add `src/memory-hooks.ts`
  - `onLoopComplete(state, config)`: calls `saveEpisodic` with a session summary (not raw LoopState — build a condensed summary with taskName, iteration count, pass/fail per phase, total duration)
  - `onLoopComplete`: also calls `archiveSession` to write markdown to `70-Memory/history/{year}/{month}/{day}/{hour}/{minute}/{timestamp}-{taskName}.md`
  - Only fires when `memory.enabled === true`
  - Session archive fallback: `_agent-loop-output/session-archive/` if vault path unavailable
  - No semantic recall in v3 — deferred to v4

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 2, blocked by 1, 2

  **QA Scenarios**:
  - `memory.enabled: false` → no calls to agentmemory
  - `memory.enabled: true` → saves session summary and archive on completion
  - agentmemory down → graceful skip, archive still written to filesystem

- [x] 4. Lesson extractor + pulse push

  **What to do**:
  - `onPhaseFailed(phase, result)`: if failure is novel (not seen in last 5 sessions), call `saveLesson(content: "Phase {name} failed with exit {code}: {stderr}", context: taskName)`
  - `onLoopComplete(state)`: compute health score as `passingPhases / totalPhases` (0.0–1.0), log to console transparently (e.g. `[memory] Health: 0.8 (4/5 phases passed)`), then push via `pushPulse({ score, taskName, timestamp })`
  - Novelty detection: simple string hash of error message, compare against recent lesson titles

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 2, blocked by 1, 2

  **QA Scenarios**:
  - Phase fails → lesson saved (if novel)
  - Same error repeats → no duplicate lesson
  - Loop completes → pulse score computed and pushed

- [x] 5. Wire into loop.ts lifecycle

  **What to do**:
  - Insert memory hooks at correct points in loop.ts: onPhaseFailed, onLoopComplete
  - Use `memory.enabled` flag to guard all calls
  - All memory hooks are fire-and-forget (no await in critical path — use Promise without await, errors caught)

  **Recommended Agent Profile**: `deep`
  **Parallelization**: Wave 3, blocked by 3, 4

  **QA Scenarios**:
  - `memory.enabled: false` → v2 behavior identical
  - `memory.enabled: true` → episodic save + archive + pulse fire on complete, lesson on fail
  - agentmemory down → loop continues, errors logged to stderr

- [x] 6. Tests

  **What to do**:
  - Test files: agentmemory.test.ts, memory-hooks.test.ts
  - Mock agentmemory HTTP responses
  - Test: enabled/disabled, success/failure, agentmemory down

  **Recommended Agent Profile**: `unspecified-high`
  **Parallelization**: Wave 3, blocked by 1, 3

  **QA Scenarios**:
  - `bun test` → all v1 + v2 + v3 tests pass
  - Mock response assertions

---

## Commit Strategy

- **Format**: Conventional commits (`feat:` for new features, `test:` for tests, `refactor:` for restructuring, `chore:` for config/CI)
- **When**: After each WAVE completes (Wave 1 → commit, Wave 2 → commit, Wave 3 → commit)
- **Squash**: All commits in a wave may be squashed into one before the Final Verification Wave
- **Verification before commit**: `bun test` must pass, `tsc --noEmit` must pass
- **Final commit**: After all F1-F4 reviewers approve, one final merge/squash commit

## Final Verification Wave

- [x] F1. **Plan Compliance Audit** — `oracle`
- [x] F2. **Code Quality + Regression** — `unspecified-high`
- [x] F3. **Real QA** — start loop with memory enabled, verify agentmemory receives data
- [x] F4. **Scope Fidelity Check** — `deep`

---

## Execution

Load `plan-notion-sync` skill when implementing to sync v3 issues to Notion Launch Operations.
