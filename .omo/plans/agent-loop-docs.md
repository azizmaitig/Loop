# agent-loop — Documentation Generation

## TL;DR

Generate CONTEXT.md (quick-ref + full walkthrough) for the agent-loop project and create a Notion page with 6 Architectural Decision Records.

---

## Context

Terminology and architecture are finalized after grilling session. All design decisions are locked. This plan only generates documentation artifacts.

### Terminology Map (Confirmed)

| Term | Definition |
|------|-----------|
| **agent-loop** | Official project name |
| **phase** | One step in 4-state machine (init/run/verify/done) |
| **iteration** | Full cycle through all 4 states |
| **run** | One `bun run loop.ts start` invocation |
| **loop** | The orchestrator system itself |
| **v1 invariant** | No LLM, no MCP, no daemon |
| **v2** | Adds LLM integration, MCP dispatch |

### ADR Candidates (All 6 Confirmed)

1. **4-State Machine** — init→run→verify→done + loopback (vs 88-Labs' 10 states)
2. **Shell Command Dispatch** — Bun.spawn(command, expectedExitCode) instead of MCP/LSP/LLM
3. **Dual State Persistence** — STATE.md (human-readable) + state.json (machine-parseable)
4. **SIGINT Crash Safety** — mutable global ref, write partial state on signal
5. **Zero Runtime Dependencies** — only TypeScript types, Bun stdlib (no zod, no frameworks)
6. **v1 Scope Boundary** — no LLM, no MCP, no daemon, no YAML parser, no SQLite, no scoring

---

## TODOs

- [x] 1. Write CONTEXT.md to agent-loop directory

  **What to do**:
  Write `10-Projects/11-Active/agent-loop/CONTEXT.md` with:
  - Quick-reference terminology table (agent-loop, phase, iteration, run, loop, StateMachine, PhaseDef, STATE.md, state.json, LoopState, v1 invariant)
  - Architecture overview with ASCII diagram (CLI → StateMachine → Phase Executor → State Persistence → Safety)
  - State machine description: 4 states (init→run→verify→done), 6 events (RUN/VERIFY/COMPLETE/LOOP/FAILED/ABORT), flat lookup table
  - Phase execution: PhaseDef interface, Bun.spawn shell dispatch, PhaseResult shape
  - State persistence: dual files (STATE.md YAML frontmatter + state.json JSON), write-after-every-transition strategy
  - Safety layer: per-phase timeout (AbortController), max iterations guard (hard cap 20), SIGINT handler (mutable global ref)
  - CLI usage: 5+ examples (demo, demo-2iter, phases filter, timeout override, hang)
  - v1 vs v2 comparison table
  - File listing (all 6 src modules, 4 test files, package.json)

  **References**:
  - Source code: `10-Projects/11-Active/agent-loop/src/*.ts`, `loop.ts`, `package.json`

  **QA Scenarios**:
  ```
  Scenario: CONTEXT.md exists and covers all sections
    Tool: Bash
    Steps:
      1. cat 10-Projects/11-Active/agent-loop/CONTEXT.md
    Expected Result: File exists with ≥20 lines covering: Quick Reference, Architecture, State Machine, Phase Execution, State Persistence, Safety, CLI Usage, v1 vs v2
    Evidence: .omo/evidence/task-1-context-exists.txt
  ```

- [x] 2. Create Notion page with 6 ADRs

  **What to do**:
  Use Notion MCP (`notion_API-post-page`) to create a new page in the user's workspace titled "agent-loop — Architecture Decision Records".
  
  The page should contain 6 ADR entries, each as a heading (##) with:
  
  **ADR 1: 4-State Machine**
  - Status: Accepted
  - Context: Generic loop needed states that work across domains, not just research
  - Decision: init→run→verify→done + loopback via flat lookup table TRANSITIONS[state][event]
  - Consequences: ~50 LOC vs 88-Labs' ~200 LOC 10-state machine; 6 events (RUN/VERIFY/COMPLETE/LOOP/FAILED/ABORT); invalid transitions throw StateMachineError; StateMachineError is checked; ponytail marker: no OOP state pattern
  
  **ADR 2: Shell Command Dispatch**
  - Status: Accepted
  - Context: Phase execution mechanism needed to be generic, testable, and replaceable
  - Decision: Each phase = { command: string, expectedExitCode: number, timeoutMs: number }. Executed via Bun.spawn on Windows (`cmd.exe /c`). Result = { status, exitCode, stdout, stderr, durationMs }
  - Consequences: Zero framework coupling; trivially testable (mock commands); replaceable later with MCP/LLM dispatch without changing state machine; shell injection risk is caller's responsibility; cross-platform path differences need awareness
  
  **ADR 3: Dual State Persistence**
  - Status: Accepted
  - Context: Need both human-readable state (developers reading .md) and machine-parseable state (scripts/tools consuming JSON)
  - Decision: Write both STATE.md (YAML frontmatter) and state.json (JSON) in parallel after every state transition and phase execution. STATE.md uses simple custom parser (no js-yaml dep). JSON written via Bun.write
  - Consequences: ~6 writes per iteration; two files to update (atomicity = best effort); no js-yaml dependency (custom parse/serialize is ~120 lines); git tracks STATE.md diffs naturally; _agent-loop-output/ directory keeps state files
  
  **ADR 4: SIGINT Crash Safety**
  - Status: Accepted
  - Context: Loop may be interrupted mid-execution. Need partial state capture for recovery/forensics
  - Decision: Mutable global `let sigintState: LoopState | null` ref updated on every state change. SIGINT handler writes current state to both files and exits with code 1. Write is fire-and-forget (no await in sync handler)
  - Consequences: ~10 LOC total; best-effort write (not guaranteed if disk is busy); state is always ≤1 phase behind; no recovery/replay logic in v1; ponytail marker: mutable global
  
  **ADR 5: Zero Runtime Dependencies**
  - Status: Accepted
  - Context: Agent-loop is a small orchestrator (~330 LOC). Adding dependencies (zod, ink, yargs) would bloat it 3-5x
  - Decision: Only TypeScript types + Bun stdlib. No zod (inline validation in state.ts parser), no cli framework (manual parseArgs in loop.ts), no js-yaml (custom YAML frontmatter parser)
  - Consequences: `bun install` installs 3 devDeps only (typescript, @types/bun, @types/node); total install time <1s; no transitive dependency audit needed; maintenance cost of ~120 LOC custom parser is acceptable for its simplicity
  
  **ADR 6: v1 Scope Boundary**
  - Status: Accepted
  - Context: Clear scope needed to prevent feature creep. "First shot correct working loop" means minimal, not all-features
  - Decision: v1 invariant = no LLM, no MCP, no daemon, no YAML parser, no SQLite, no scoring, no plugin system. These are deferred to v2. Agent-loop is a dumb shell command runner with safety guards
  - Consequences: ~330 LOC v1 instead of 2000+; 6 source files instead of 20+; clear upgrade path to v2; prevents architectural coupling to LLM/provider early; all guardrails documented in plan's Must NOT Have list

  **References**:
  - Notion MCP tools: `notion_API-post-page`
  - Parent: (use workspace root — pass empty parent or check docs)

  **QA Scenarios**:
  ```
  Scenario: Notion page created with all 6 ADRs
    Tool: Notion API
    Steps:
      1. Search for "agent-loop ADR" page
      2. Read page content
    Expected Result: Page has 6 ADR entries with headings ADR 1-6, each with Status/Context/Decision/Consequences
    Evidence: .omo/evidence/task-2-notion-adrs.txt
  ```
