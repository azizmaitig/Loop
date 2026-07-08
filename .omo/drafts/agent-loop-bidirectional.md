# Draft: agent-loop-bidirectional

**Status:** exploring → writing plan

## Intent
- intent: CLEAR
- review_required: false

## Decisions
- Direction A (Loop→OpenCode): existing `command: opencode run` works, just needs timeout/output capture hardening in task-processor.ts
- Direction B (OpenCode→Loop): MCP server at `.opencode/mcp-servers/agent-loop-mcp/` wrapping daemon REST API
- Tools: enqueue_task, get_status, list_loops, list_history, get_task, start_loop, stop_loop, pause_loop — maps to existing daemon routes
- MCP server uses @modelcontextprotocol/sdk + Zod (same pattern as excalidraw-agent-server)
- Registered in vault `.opencode/opencode.json` (shared across all projects)

## Daemon API surface mapped
| MCP Tool | Daemon Endpoint |
|---|---|
| enqueue_task | POST /task |
| get_status | GET /state |
| list_loops | GET /loops |
| list_history | GET /api/history |
| get_task | GET /api/tasks/:id |
| start_loop | POST /loops/:id/start |
| stop_loop | POST /loops/:id/stop |
| pause_loop | POST /api/pause |

## Findings (from explore)
- routes.ts: 256 lines, 17 route handlers (already complete)
- Existing MCP servers use @modelcontextprotocol/sdk + Zod + tsx
- Daemon defaults to port 3000, LOOP_API_KEY env for auth
