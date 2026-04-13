# WebSocket Limited Command Channel Validation

Date: 2026-04-13

## Scope

Verification artifacts for the experimental limited WS command channel:

- WS submit -> ack -> result for read-only commands (staged if unavailable)
- HTTP-vs-WS comparison on command lifecycle (`get_selection`)
- explicit staged reason instead of flaky failure when submit path is not implemented

## Run

```bash
node --test tests/websocket-command-channel.integration.test.js
```

Live repro:

```bash
BASE_URL=http://127.0.0.1:3846 \
PLUGIN_ID=page:ws-repro \
TARGET_NODE_ID=10:1 \
node scripts/repro-websocket-channel.mjs
```

## Interpretation

- If WS submit channel is implemented:
  - test expects ack/result visibility for read-only submit probe
- If WS is still mirror-only:
  - test is intentionally skipped with:
    - `WS command submit/ack/result not implemented yet (mirror-only websocket mode still active)`
  - repro includes:
    - `wsSubmitProbe.stagedReason`
