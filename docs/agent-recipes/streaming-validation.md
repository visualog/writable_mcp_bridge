# Streaming Validation

Use this after changes to SSE, WebSocket, command delivery, or fallback logic.

## Quick Validation

```bash
node scripts/validate-streaming-first.mjs
```

## Soak Validation

```bash
node scripts/validate-streaming-first-soak.mjs --profile=quick
node scripts/validate-streaming-first-soak.mjs --profile=standard
```

Use `--profile=long` only after standard passes.

## Test Suite

```bash
node --test tests/websocket-command-channel.integration.test.js tests/ws-events.integration.test.js tests/streaming-first-validation.integration.test.js
```

## What To Watch

- `/health.transportHealth.grade`
- `fallbackRate`
- active SSE/WS client counts
- recent ack/result/fallback counters
- queue pending counts in `/api/runtime-ops`

## Record A Candidate

After a meaningful validation or streaming fix, create an xlog candidate:

```bash
node scripts/create-xlog-candidate.mjs \
  --title "streaming fallback reason improved" \
  --tag xbridge \
  --tag streaming \
  --test "npm test"
```
