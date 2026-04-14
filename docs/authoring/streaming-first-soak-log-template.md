# Streaming-First Long Soak Log Template

Date: YYYY-MM-DD

## Summary

Status: `pass` | `fail`
Command: `npm run validate:streaming-first:soak:long`
Base URL: `http://127.0.0.1:3846`
Profile: `long`
Iterations:
Passed:
Failed:
Concurrency:
Average duration:
Min duration:
Max duration:
Total duration:
Total delay:

## Environment

Pre-check:

- `/health`: `ok` | `fail`
- `/api/sessions`: `ok` | `fail`
- Active plugin:
- File:
- Page:
- Read health:
- Recent failures:

Server state:

- Restart confirmed:
- Latest code confirmed:
- Notes about any stale process or alternate local server:

## Transport Result

Capture the first clean evidence of each path, then summarize the steady-state behavior:

- `/health` and `/api/runtime-ops` parity
- SSE health event delivery
- WebSocket hello
- WebSocket direct read ACK / RESULT
- plugin command pickup ACK / RESULT
- polling fallback behavior

## Resource Snapshot

Peak values across the run:

- Peak RSS:
- Peak heap used:
- Peak heap total:
- Peak external memory:
- Peak array buffers:
- Max active handles:
- Max active requests:
- Peak user CPU:
- Peak system CPU:

## Failure Notes

If the run failed:

- First failing iteration:
- Plugin ID:
- Error:
- Failure count in that iteration:
- Whether the failure was immediate, intermittent, or late-run:
- Any pattern across later failures:

## Notes

- Include any server restart or process shadowing details here.
- Include whether the `standard` preflight passed before this run.
- Include any observations about reconnect loops, delayed ACK/RESULT, or resource growth.

## Follow-Up

- Next action:
- Whether a rerun is needed:
- Whether the failure points to transport regression or environment drift:
