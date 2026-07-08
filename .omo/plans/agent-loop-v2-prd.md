# PRD: agent-loop v2

## Problem Statement

agent-loop v1 is a capable shell-phase orchestrator with a 4-state machine, but it's limited to exit-code-based evaluation, sequential shell execution, and manual invocation. As the vault's loop infrastructure grows, v1 can't:

- Use LLMs to evaluate phase output semantically instead of just checking exit codes
- Run autonomously as a background daemon
- Extend behavior without modifying core source code
- Be controlled programmatically via an API

## Solution

Add four capabilities to agent-loop while preserving full backward compatibility:

1. **LLM integration** — phases can dispatch MCP tool calls, and the LLM can act as the loop controller deciding state transitions
2. **Daemon mode** — run as a background process with an HTTP/WebSocket API
3. **Plugin system** — extend behavior via hook-exporting modules without touching core
4. **Semantic evaluation** — LLM judges phase output contextually, falling back to exit codes

All new features are opt-in. v1 configs work identically.

## User Stories

1. As a loop operator, I want phases to call MCP tools (not just shell commands), so that I can integrate LLM analysis directly into my workflow.
2. As a loop operator, I want the LLM to decide the next state transition based on phase results, so that complex workflows can adapt dynamically.
3. As a developer, I want agent-loop to run as a background daemon, so that it can process iterations on a schedule without manual intervention.
4. As a developer, I want to query the daemon's current state via HTTP, so that I can monitor loop progress from external tools.
5. As a developer, I want to start/stop/trigger loop iterations via HTTP, so that I can control the loop programmatically.
6. As a developer, I want to receive real-time state changes via WebSocket, so that I can build live dashboards.
7. As a plugin author, I want to hook into phase lifecycle (start, end, error), so that I can add custom behavior without modifying core code.
8. As a plugin author, I want my plugin to be a single .ts file in a plugins/ directory, so that setup is trivial.
9. As a loop operator, I want phase results to include an LLM-generated judgment with a pass/fail verdict and reasoning, so that I can understand why a phase passed or failed beyond its exit code.
10. As a loop operator, I want semantic evaluation to fall back to exit codes when no LLM is configured, so that v1 phases continue to work.
11. As a developer, I want the daemon to persist state on shutdown, so that I can resume after restarts.
12. As a developer, I want all v2 features to be optional, so that v1 behavior is completely unchanged when no new config is provided.

## Implementation Decisions

### LLM Integration — Two Modes

**Phase Executor mode**: PhaseDef gains an optional `llm` field specifying an MCP server, tool, and prompt. When present, the phase dispatches an MCP tool call instead of a shell command. The result is still wrapped in PhaseResult.

**Loop Controller mode**: When `llmController: true` in config, after phase execution the LLM receives phase results and emits a transition event (RUN, VERIFY, COMPLETE, LOOP, FAILED, ABORT). Falls back to the hardcoded TRANSITIONS table if the LLM returns an invalid event or is unavailable.

Both modes can be used independently or together.

### Daemon Mode

New `--daemon` flag starts agent-loop as a persistent background process. Runs iterations on a configurable interval. Exposes a built-in HTTP server (Bun.serve, zero deps) with:

- `GET /state` — current LoopState
- `POST /start` — trigger loop start
- `POST /stop` — stop running loop
- `POST /trigger` — trigger a single iteration
- WebSocket at `/ws` — real-time state change streaming

Graceful shutdown via SIGINT/SIGTERM persists state snapshot.

### Plugin System

Plugins are modules (`.ts` files in `plugins/` directory or npm packages) that export lifecycle hooks:

- `onPhaseStart(phase, state)` — before phase execution
- `onPhaseEnd(phase, result, state)` — after phase execution and evaluation
- `onError(error, phase)` — on phase error

Hooks are collected into `phaseResult.pluginResults`. Plugin failures are caught and logged, never crash the loop.

### Semantic Evaluation

New `evaluatePhase()` function constructs an LLM prompt from the phase name, description, and captured stdout. The LLM returns a structured Judgment: `{ passed, reason, confidence }`. Falls back to `{ passed: exitCode === expected, reason: 'exit code', confidence: 1.0 }` when no LLM is configured.

### Types (All Additive — No Breaking Changes)

- `PhaseDef`: gains optional `llm`, `pluginHooks` fields
- `PhaseResult`: gains optional `judgment`, `pluginResults` fields
- `LoopConfig`: gains optional `daemon`, `llmController`, `plugins` fields
- New type `Judgment`: `{ passed: boolean, reason: string, confidence: number }`

## Testing Decisions

### Test Philosophy

Test external behavior through the highest feasible seam. Prefer testing through the CLI entry point (`bun run loop.ts start`) for integration, and module-level exports for unit tests. Do not test internal helpers or private functions directly.

### Seams

1. **CLI entry point** (`loop.ts`) — the highest seam. Integration tests run the full loop with mock phases and verify state output in `_agent-loop-output/`.
2. **Module exports** — each new module (mcp.ts, evaluate.ts, plugins.ts, daemon.ts, api.ts) exports a single public function. Test these directly.
3. **State persistence** — already tested in v1 via `state.test.ts`.

### Prior Art

- `state-machine.test.ts` — tests transition validation, allowed events, terminal states
- `state.test.ts` — tests read/write STATE.md, JSON fallback
- `safety.test.ts` — tests timeout enforcement, iteration caps
- `config.test.ts` — tests CLI arg parsing with mergeConfig

New tests follow the same pattern: flat test files in `__tests__/`, using `bun test`, no test framework dependencies.

## Out of Scope

- MCP server implementation — agent-loop consumes MCP tools, doesn't host them
- Plugin registry or marketplace — plugins are local files or npm packages
- GUI dashboard — the HTTP API enables external dashboards but isn't one itself
- Cross-platform service installation — daemon mode is a process, not a system service installer
- LLM provider abstraction — MCP tools abstract the LLM; agent-loop doesn't add another layer

## Further Notes

- All v2 features are additive and optional. A v1 config file with no new fields produces identical behavior to v1.
- The existing custom YAML parser (no `js-yaml` dep) is preserved.
- The 20-iteration hard cap in safety.ts still applies in daemon mode.
- The existing SIGINT handler is extended to also signal the daemon's HTTP server to shut down gracefully.
