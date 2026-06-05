# 2026-06-05 Server Refactor Plugin UI Metrics Projection Report

## Summary

Moved plugin UI metrics projection out of `src/server.js` into a pure helper in `src/server-transport-state.js`.

New helper:

- `buildPluginUiMetricsSnapshot()`

This keeps `src/server.js` responsible for reading session snapshots, while `src/server-transport-state.js` owns the response projection that exposes plugin UI metrics in runtime ops.

## Changes

- `src/server-transport-state.js`
  - Added `buildPluginUiMetricsSnapshot()`.
  - The helper filters sessions without `uiMetrics` and returns the stable runtime ops fields:
    - `pluginId`
    - `state`
    - `staleMs`
    - `fileName`
    - `pageName`
    - `uiMetrics`
- `src/server.js`
  - `getRuntimeOpsSnapshot()` now calls `buildPluginUiMetricsSnapshot(getSessionSnapshots({ includeStale: true, now }))`.
  - WS/SSE dispatch, pending command delivery, runtime counters, and HTTP polling fallback were not changed.
- `tests/server-transport-state.test.js`
  - Added coverage for plugin UI metrics projection.
- `docs/server-refactor-extracted-files.md`
  - Updated `src/server-transport-state.js` role.
  - Updated current `src/server.js` line count.
  - Updated next refactor candidates.

## Current File Sizes

- `src/server.js`: 12,814 lines
- `src/server-transport-state.js`: 1,356 lines
- `tests/server-transport-state.test.js`: 866 lines
- `docs/server-refactor-extracted-files.md`: 88 lines

## Validation

- `node --test tests/server-transport-state.test.js`
  - passed: 23
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 621
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

- `getRuntimeOpsSnapshot()` still prepares live plugin ids and primary live session selection in `src/server.js`.
- Queue diagnostics input assembly remains sensitive because it annotates commands with WS ack and fallback delay state.
- Keep `docs/server-refactor-extracted-files.md` updated after every future extraction.

## Next Recommended Task

Extract primary live session selection from live snapshots, then consider the larger queue diagnostics input assembly only after that smaller selector is covered.
