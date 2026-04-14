# Session State

Xbridge can have multiple plugin sessions because Figma, Figma Beta, and different files can all connect to the same local server.

## Meanings

- `registered`: plugin has registered metadata, but may not have recent heartbeat.
- `live`: active enough for command delivery.
- `stale`: previously seen, but not safe for current reads.
- `offline`: no usable session.

## Safe Flow

1. Use `/health.activePlugins`.
2. If ambiguous, use `/api/sessions`.
3. For page work, confirm with `/api/pages?pluginId=<pluginId>`.
4. If page metadata is wrong, reload/re-register the plugin in the target Figma file.

## Common Mistake

Do not assume a page id from another file or app belongs to the current session.
