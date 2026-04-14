# Figma Beta Vs Figma App

Both apps can connect to the same Xbridge server, but they create separate plugin sessions.

## What This Means

- The same server can show sessions from different apps.
- `activePlugins` is not a file browser.
- A page id from one app/file may fail in another session.

## Safe Flow

1. Open the target app and file.
2. Reload or re-register the Xbridge plugin there.
3. Run `/health`.
4. Use that `pluginId` for `/api/pages` and read APIs.

## Operator Note

If another agent reports a different active page than you expect, it may be connected to the other Figma app session.
