# 0001 — Raw HTTP transport for agentmemory integration

Memory operations (episodic save, lesson extraction, health pulse) communicate with the agentmemory daemon via raw HTTP (`fetch()` to `http://localhost:3111`) rather than through the existing MCP subprocess infrastructure in `src/mcp.ts`.

## Context

The vault runs `@agentmemory/mcp` as a background daemon on localhost:3111. It exposes 51 tools over JSON-RPC via both stdio (MCP protocol) and HTTP. The agent-loop already has `src/mcp.ts` which spawns MCP server binaries as subprocesses and calls tools via JSON-RPC over stdin/stdout.

The obvious default was to extend `mcp.ts` to call agentmemory's tools through the same subprocess pattern. We chose not to.

## Decision

- Memory operations use `fetch()` directly to `http://localhost:3111`
- Zero new subprocesses are spawned for memory operations
- The `src/agentmemory.ts` module wraps 5 HTTP endpoints: save, recall, archive, lesson, pulse
- All calls are fire-and-forget with `AbortSignal.timeout(2000)` and no retry

## Rationale

| Factor | MCP subprocess | Raw HTTP |
|--------|---------------|----------|
| Subprocess per call | Yes — spawn + JSON-RPC handshake per memory op | None — reuse existing daemon connection |
| Failure surface | Spawn failures (PATH, binary missing, OOM) + protocol errors | Connection refused + timeout only |
| Fire-and-forget ergonomics | `PhaseResult` with 7 irrelevant fields | `boolean` — saved or not |
| Error handling | Inherits `PhaseTimeoutError`, `StateMachineError` | `catch` → return `false` |
| Latency overhead | ~10-50ms per subprocess spawn | Zero |

Memory ops must be invisible to the loop. A subprocess spawn that can fail for OS-level reasons (missing binary, PATH misconfiguration, resource limits) is a worse failure mode than a `fetch` that either connects or doesn't.

## Considered Options

- **Existing MCP infra** — discarded because `PhaseResult` is the wrong shape for a memory operation. A boolean return is more honest.
- **No agentmemory at all** — discarded because v3's objective is cross-session memory.

## Consequences

- Agentmemory's 51 MCP tools are not directly callable from the memory hook layer. If v4 needs advanced agentmemory features (graph queries, facet tags, vector search), the transport must be extended or switched.
- The memory module is transport-coupled to HTTP — changing to another backend means rewriting `src/agentmemory.ts`.
