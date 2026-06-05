# 2026-06-05 Server Refactor Primary Live Session Selector Report

## Summary

Moved primary live session selection out of `src/server.js` into a pure helper in `src/server-transport-state.js`.

New helper:

- `buildPrimaryLiveSessionSnapshot()`

This keeps `src/server.js` responsible for collecting live session snapshots and active session resolution, while `src/server-transport-state.js` owns the selector rule used by runtime ops write-readiness input preparation.

## Changes

- `src/server-transport-state.js`
  - Added `buildPrimaryLiveSessionSnapshot()`.
  - The helper selects the live snapshot whose `pluginId` matches `activeSessionResolution.primaryPluginId`.
  - If no matching primary snapshot exists, it falls back to the first live snapshot.
  - If no live snapshots exist, it returns `null`.
- `src/server.js`
  - `getRuntimeOpsSnapshot()` now calls `buildPrimaryLiveSessionSnapshot({ liveSnapshots, activeSessionResolution })`.
  - WS/SSE dispatch, pending command delivery, runtime counters, and HTTP polling fallback were not changed.
- `tests/server-transport-state.test.js`
  - Added coverage for primary match, first-live fallback, and empty-live fallback.
- `docs/server-refactor-extracted-files.md`
  - Updated `src/server-transport-state.js` role.
  - Updated current `src/server.js` line count.
  - Updated next refactor candidates.

## Current File Sizes

- `src/server.js`: 12,813 lines
- `src/server-transport-state.js`: 1,372 lines
- `tests/server-transport-state.test.js`: 914 lines
- `docs/server-refactor-extracted-files.md`: 90 lines

## Validation

- `node --test tests/server-transport-state.test.js`
  - passed: 24
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 622
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

- `getRuntimeOpsSnapshot()` still maps live snapshots to active plugin ids in `src/server.js`.
- Queue diagnostics input assembly remains sensitive because it annotates commands with WS ack and fallback delay state.
- Keep `docs/server-refactor-extracted-files.md` updated after every future extraction.

## Next Recommended Task

Extract the live plugin id selector from `getRuntimeOpsSnapshot()`, then reassess whether to start the larger queue diagnostics input assembly.
