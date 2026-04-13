# WebSocket Contract Staging (Experimental)

Date: 2026-04-13

## Scope

Staged validation artifacts for an experimental WebSocket channel:

- handshake/connect
- hello payload
- event mirror reception (session + command lifecycle)
- disconnect cleanup (reconnect works)

These checks are intentionally contract-ready:

- If `/api/ws` is not implemented yet, tests skip with an explicit reason.
- If `/api/ws` exists, tests switch to active assertions automatically.
- If mirror capability is partial, tests skip with explicit partial-state reasons instead of flaky fails.

## Run

```bash
node --test tests/websocket-channel.contract.test.js
```

Optional live repro:

```bash
BASE_URL=http://127.0.0.1:3846 \
PLUGIN_ID=page:ws-repro \
node scripts/repro-websocket-channel.mjs
```

## Expected

- not implemented yet:
  - tests are reported as `skipped` with reason `WebSocket channel not implemented yet`
  - repro reports `reason: ws_upgrade_failed_or_unavailable` or similar
- implemented:
  - handshake succeeds
  - hello payload appears
  - at least one `session.*` and one `command.*` mirrored event appear
  - when available, explicit command lifecycle mirrors are observed:
    - `command.enqueued`
    - `command.delivered`
    - `command.completed`
  - closing one connection does not prevent a fresh reconnection
