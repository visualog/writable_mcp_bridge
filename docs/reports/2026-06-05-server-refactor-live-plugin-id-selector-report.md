# 2026-06-05 Server Refactor Live Plugin Id Selector Report

## Summary

Moved live plugin id projection out of `src/server.js` into a pure helper in `src/server-transport-state.js`.

New helper:

- `buildLivePluginIdsSnapshot()`

This keeps `src/server.js` responsible for collecting live session snapshots, while `src/server-transport-state.js` owns the projection that turns those snapshots into runtime ops active plugin ids.

## Changes

- `src/server-transport-state.js`
  - Added `buildLivePluginIdsSnapshot()`.
  - The helper returns non-empty string `pluginId` values from prepared live session snapshots.
- `src/server.js`
  - `getRuntimeOpsSnapshot()` now calls `buildLivePluginIdsSnapshot(liveSnapshots)`.
  - WS/SSE dispatch, pending command delivery, runtime counters, and HTTP polling fallback were not changed.
- `tests/server-transport-state.test.js`
  - Added coverage for live plugin id projection.
- `docs/server-refactor-extracted-files.md`
  - Updated `src/server-transport-state.js` role.
  - Updated current `src/server.js` line count.
  - Removed the completed live plugin id selector from next candidates.

## Current File Sizes

- `src/server.js`: 12,814 lines
- `src/server-transport-state.js`: 1,379 lines
- `tests/server-transport-state.test.js`: 937 lines
- `docs/server-refactor-extracted-files.md`: 90 lines

## Validation

- `node --test tests/server-transport-state.test.js`
  - passed: 25
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 623
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

- Queue diagnostics input assembly remains sensitive because it annotates commands with WS ack and fallback delay state.
- Transport health recent activity calculation remains in `src/server.js` and is tied to runtime counters and event history.
- Keep `docs/server-refactor-extracted-files.md` updated after every future extraction.

## Next Recommended Task

Reassess remaining `src/server.js` runtime helpers and choose between:

- a small queue diagnostics input assembly slice
- a small transport health recent activity selector
