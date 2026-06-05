# 2026-06-05 Server Refactor Runtime Ops Snapshot Report

## Summary

Moved `/api/runtime-ops` response assembly out of `src/server.js` into a pure helper in `src/server-transport-state.js`.

New helper:

- `buildRuntimeOpsSnapshot()`

This keeps `src/server.js` focused on collecting live inputs such as sessions, queue diagnostics, readiness snapshots, and transport health. `src/server-transport-state.js` now owns the final runtime ops response shape once those inputs are prepared.

## Changes

- `src/server-transport-state.js`
  - Added `buildRuntimeOpsSnapshot()`.
  - The helper assembles runtime ops fields:
    - `now`
    - `config`
    - `currentReadHealth`
    - `failures`
    - `sessions`
    - `activePlugins`
    - `activePluginId`
    - `activeSessionResolution`
    - `pluginUiMetrics`
    - `queue`
    - `transportHealth`
    - `commandReadiness`
    - `writeReadiness`
    - `observability`
- `src/server.js`
  - `getRuntimeOpsSnapshot()` now computes live inputs and delegates final response assembly to `buildRuntimeOpsSnapshot()`.
  - WS/SSE dispatch, pending command delivery, runtime counters, and HTTP polling fallback were not changed.
- `tests/server-transport-state.test.js`
  - Added coverage for runtime ops response assembly.
- `docs/server-refactor-extracted-files.md`
  - Updated `src/server-transport-state.js` role.
  - Updated current `src/server.js` line count.
  - Updated next refactor candidates.

## Current File Sizes

- `src/server.js`: 12,820 lines
- `src/server-transport-state.js`: 1,342 lines
- `tests/server-transport-state.test.js`: 804 lines
- `docs/server-refactor-extracted-files.md`: 87 lines

## Validation

- `node --test tests/server-transport-state.test.js`
  - passed: 22
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 620
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

- `getRuntimeOpsSnapshot()` still prepares live inputs in `src/server.js`, including plugin UI metrics, live plugin ids, primary live session, and readiness inputs.
- Queue diagnostics input assembly is still close to WS ack and polling fallback behavior. Extract it in smaller slices with focused tests.
- Keep `docs/server-refactor-extracted-files.md` updated after every future extraction.

## Next Recommended Task

Extract a narrow runtime ops live-input selector, such as plugin UI metrics projection or primary live session selection, before touching queue diagnostics input assembly.
