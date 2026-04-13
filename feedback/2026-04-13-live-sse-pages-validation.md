# Live SSE + Pages Validation

Date: 2026-04-13

## Goal

Reproduce a minimal live bridge validation for:

- health OK
- SSE endpoint responds
- metadata OK
- pages endpoint OK for a live `pluginId`

## Prerequisites

1. Start bridge (`npm run start:keychain` or equivalent).
2. Open the Figma plugin on the target file and keep it connected.
3. Identify:
   - `PLUGIN_ID` (for example `page:817:417`)
   - `TARGET_NODE_ID` (a readable node for metadata)

## One-command Repro

```bash
PLUGIN_ID=page:817:417 \
TARGET_NODE_ID=10:1 \
scripts/repro-live-sse-pages.sh
```

## Expected Signals

- `/health` returns `ok: true` and includes your plugin in `activePlugins`
- `/api/events` responds with SSE frames (`event:`/`data:` lines)
- `/api/pages?pluginId=...` returns page list for the live session
- `/api/get-metadata` returns `ok: true` with XML (and JSON when `includeJson: true`)
