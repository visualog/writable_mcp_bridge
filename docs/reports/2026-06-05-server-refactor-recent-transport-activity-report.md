# 2026-06-05 Server Refactor Recent Transport Activity Report

## Summary

Moved recent transport activity summarization out of `src/server.js` into a pure helper in `src/server-transport-state.js`.

New helper:

- `buildRecentTransportActivitySnapshot()`

This keeps `src/server.js` responsible for storing recent runtime events, while `src/server-transport-state.js` owns the calculation that summarizes recent websocket ack/result and polling fallback signals.

## Changes

- `src/server-transport-state.js`
  - Added `buildRecentTransportActivitySnapshot()`.
  - The helper counts recent:
    - websocket ack events
    - websocket result events
    - command delivered events
    - polling fallback delivered events
  - It computes `recentSignalTotal` and rounded `fallbackRate`.
- `src/server.js`
  - `getRecentTransportActivitySnapshot()` now delegates to `buildRecentTransportActivitySnapshot()`.
  - Removed the local runtime-event window predicate from `server.js`.
  - WS/SSE dispatch, pending command delivery, runtime counters, and HTTP polling fallback were not changed.
- `tests/server-transport-state.test.js`
  - Added coverage for recent transport activity summary calculation.
- `docs/server-refactor-extracted-files.md`
  - Updated `src/server-transport-state.js` role.
  - Updated current `src/server.js` line count.
  - Narrowed the next transport candidate to transport health snapshot calculation.

## Current File Sizes

- `src/server.js`: 12,763 lines
- `src/server-transport-state.js`: 1,445 lines
- `tests/server-transport-state.test.js`: 988 lines
- `docs/server-refactor-extracted-files.md`: 91 lines

## Validation

- `node --test tests/server-transport-state.test.js`
  - passed: 26
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 624
  - failed: 0
  - skipped: 12
- `curl -s --max-time 5 http://127.0.0.1:3846/health`
  - `ok: true`
  - `transportHealth.grade: healthy`
  - active plugin: `page:33276:16484`
- `node scripts/agent-preflight.mjs`
  - `ok: true`
  - `runtimeOpsOk: true`
  - `failures: []`

## Risks

- `getTransportHealthSnapshot()` still computes grade, fallback pressure, isolated fallback recovery, and response copy in `src/server.js`.
- Queue diagnostics input assembly remains sensitive because it annotates commands with WS ack and fallback delay state.
- Keep `docs/server-refactor-extracted-files.md` updated after every future extraction.

## Next Recommended Task

Extract a pure transport health response assembly helper, leaving live client/session counting in `src/server.js`.
