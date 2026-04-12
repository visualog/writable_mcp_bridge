# Session-State, Heartbeat, and Preflight Operator Note

This note documents the bridge control-plane behavior for:
- preflight server checks (`/health`)
- plugin session state (`/plugin/register`, `/plugin/selection`, `/api/sessions`)
- heartbeat refresh (`/plugin/commands`)

## Endpoint Contract (Inputs and Expected Outputs)

| Flow | Method + Path | Required Input | Success Output (shape) |
| --- | --- | --- | --- |
| Preflight | `GET /health` | none | `200` with `{ ok: true, server: "writable-mcp-bridge", port: <number>, activePlugins: <string[]> }` |
| Register session | `POST /plugin/register` | JSON body with `pluginId` (optional; defaults to `"default"`), optional `fileKey`, `fileName`, `pageId`, `pageName` | `200` with `{ ok: true, pluginId: <string> }` |
| Publish selection | `POST /plugin/selection` | JSON body with `pluginId` (optional; defaults to `"default"`), `selection` array | `200` with `{ ok: true }` |
| Heartbeat poll | `GET /plugin/commands?pluginId=<id>` | query param `pluginId` optional (defaults to `"default"`) | `200` with `{ ok: true, commands: <array> }`; poll updates `lastSeenAt` |
| Session snapshot | `GET /api/sessions` | optional query `includeStale=true` | `200` with `{ ok: true, sessions: <array>, includeStale: <boolean>, now: <epochMs>, activeWindowMs: <number> }` |

## Session/Heartbeat State Semantics

- A session is marked active when `now - lastSeenAt <= SESSION_ACTIVE_WINDOW_MS`.
- `lastSeenAt` refreshes on:
  - `POST /plugin/register`
  - `POST /plugin/selection`
  - `GET /plugin/commands`
- `/health.activePlugins` includes only active sessions.
- `/api/sessions` excludes stale sessions by default; `includeStale=true` returns both active and stale.
- Sessions are removed when stale beyond `SESSION_RETENTION_MS` (pruned during snapshot/active resolution).

## Error Codes and Statuses

| Surface | Condition | Code/Status | Example |
| --- | --- | --- | --- |
| HTTP API | Invalid JSON body on POST routes | `400` | `{ ok: false, error: "Invalid JSON body" }` |
| HTTP API | Unknown route | `404` | `{ ok: false, error: "Unknown route: <METHOD> <PATH>" }` |
| HTTP API | Runtime/handler failure | `400` | `{ ok: false, error: "<message>" }` |
| JSON-RPC (MCP stdio) | Tool execution failure | `-32000` | error message propagated from handler |
| JSON-RPC (MCP stdio) | Unsupported JSON-RPC method | `-32601` | `"Unsupported method: <method>"` |
| JSON-RPC (MCP stdio) | Invalid JSON-RPC payload | `-32700` | `"Invalid JSON received"` |

## Quick Operator Checks

1. Run preflight: `curl -s http://127.0.0.1:3846/health`.
2. Confirm session state: `curl -s http://127.0.0.1:3846/api/sessions`.
3. Confirm stale visibility: `curl -s "http://127.0.0.1:3846/api/sessions?includeStale=true"`.
4. If plugin appears stale, verify heartbeat polling to `/plugin/commands` is still running.
