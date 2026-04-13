# WebSocket Stage 2 Inspection Validation

Date: 2026-04-13

## Scope

Deterministic verification artifacts for Stage 2 inspection command parity:

- HTTP vs WS result comparison for supported inspection commands.
- WS mirror lifecycle checks (`command.enqueued`, `command.delivered`, `command.completed`) for WS-triggered reads.
- explicit deferred path coverage for unsupported WS inspection commands.

## Deterministic Test

```bash
node --test tests/websocket-stage2-inspection.integration.test.js
```

What this test validates:

- Supported WS commands:
  - `get_metadata`
  - `get_node_details`
  - `get_component_variant_details`
  - `get_instance_details`
- For each supported command:
  - HTTP response is `200` + `ok: true`
  - WS receives `ws.command.ack` and `ws.command.result`
  - WS result payload equals HTTP result payload
  - mirrored lifecycle events exist for the WS-triggered command id
- Deferred WS command:
  - `search_nodes`
  - deterministic expectation: `ws.command.error` with `ERR_WS_UNSUPPORTED_COMMAND`

## Live Repro Automation

```bash
BASE_URL=http://127.0.0.1:3846 \
PLUGIN_ID=page:ws-stage2-inspection \
node scripts/repro-websocket-stage2-inspection.mjs
```

Interpretation:

- `supported[]` entries should report:
  - `httpOk: true`
  - `wsAck: true`
  - `wsResult: true`
  - `equalResult: true`
- `deferred[]` entries are expected to report:
  - `wsUnsupported: true`
  - with documented `deferredReason`

## Deferred / Staged Cases

- `search_nodes` remains staged for WS request handling.
- Reason:
  - it is not currently part of `WS_INBOUND_READ_COMMANDS`.
  - bridge should continue using HTTP/SSE as the authoritative path for this case until WS support is implemented.
