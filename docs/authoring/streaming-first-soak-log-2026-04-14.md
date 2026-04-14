# Streaming-First Soak Log

Date: 2026-04-14

## Summary

Live `standard` soak validation passed after restarting the local Xbridge server with the latest code.

Result:

- Status: pass
- Command: `npm run validate:streaming-first:soak:standard`
- Base URL: `http://127.0.0.1:3846`
- Profile: `standard`
- Iterations: 20
- Passed: 20
- Failed: 0
- Concurrency: 1
- Average duration: 3365ms
- Min duration: 3322ms
- Max duration: 3446ms
- Total duration: 116988ms

## Environment

Pre-check:

- `/health`: OK
- `/api/sessions`: OK
- Active plugin: `page:2631:43`
- File: `Agent_skill_test`
- Page: `👋 디자인 원칙`
- Read health: `healthy`
- Recent failures: 0

Before restarting the server, the old process accepted HTTP/SSE but did not expose the latest WebSocket behavior. After restarting the server, the single validator passed and the standard soak passed.

## Transport Result

Each successful iteration confirmed:

- `/health` and `/api/runtime-ops` parity
- SSE health event delivery
- WebSocket hello
- WebSocket direct read ACK/RESULT
- plugin command pickup ACK/RESULT
- polling fallback behavior

## Resource Snapshot

Peak values across the run:

- Peak RSS: 66527232 bytes
- Peak heap used: 9717376 bytes
- Peak heap total: 13930496 bytes
- Peak external memory: 3409455 bytes
- Peak array buffers: 111268 bytes
- Max active handles: 4
- Max active requests: 0
- Peak user CPU: 228857 microseconds
- Peak system CPU: 35640 microseconds

## Notes

- The first live attempt failed because the running server process was stale relative to the checked-out code.
- The sandboxed Node process could not reliably reach the live local server; the final live validation was run outside the sandbox.
- `curl` health checks were useful for distinguishing server health from Node/WebSocket execution environment issues.

## Follow-Up

- Run `npm run validate:streaming-first:soak:long` once during a longer live session.
- If future standard soak fails immediately in every iteration, first confirm the server has been restarted from the latest code.
- If only later iterations fail, treat it as a transport stability regression and inspect the first failing iteration.
