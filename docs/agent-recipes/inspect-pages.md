# Inspect Pages

Use this to discover pages in the currently open Figma file.

## Request

```bash
curl -s "http://127.0.0.1:3846/api/pages?pluginId=<pluginId>"
```

## Expected Result

The response should include page ids/names for the file attached to that plugin session.

## Troubleshooting

- If `/health` is OK but `/api/pages` hangs, check whether the plugin session is stale.
- If only one page appears, confirm the Figma plugin was reloaded after switching files/apps.
- If `pluginId` is wrong, use `/health.activePlugins` or `/api/sessions` to pick the current one.

See `../troubleshooting/session-state.md`.
