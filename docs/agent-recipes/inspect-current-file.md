# Inspect Current File

Use this when you need to know which Figma file/session is connected.

## Preferred Flow

1. `GET /health`
2. Pick a `pluginId` from `activePlugins`.
3. If multiple sessions exist, use `GET /api/sessions`.
4. Use `GET /api/pages?pluginId=<pluginId>` to confirm page access.

## Notes

- `activePlugins` is a live session list, not a full account file list.
- Closed Figma plugin windows may remain stale until retention cleanup.
- Figma app and Figma Beta can register different sessions against the same local server.

## Avoid

Do not start by scanning `src/server.js` for routes. Use `docs/writable-mcp-bridge.openapi.yaml` and this recipe first.
