# 2026-06-05 Server Refactor Runtime Observability Snapshot Report

## Summary

Moved runtime observability response assembly out of `src/server.js` into a pure helper in `src/server-transport-state.js`.

New helper:

- `buildRuntimeObservabilitySnapshot()`

This keeps `src/server.js` focused on collecting live runtime inputs, while `src/server-transport-state.js` owns the shape of the observability snapshot returned through health/runtime surfaces.

## Changes

- `src/server-transport-state.js`
  - Added `buildRuntimeObservabilitySnapshot()`.
  - The helper assembles:
    - `transport`
    - `queue`
    - `preflight`
    - `sessions`
  - It preserves the existing fields for pending command/result counts, historical failure totals, recent failure summary, preflight recovery totals, and tracked session totals.
- `src/server.js`
  - `getRuntimeObservabilitySnapshot()` now computes/caches runtime inputs and delegates response assembly to `buildRuntimeObservabilitySnapshot()`.
  - No WS/SSE dispatch, polling fallback, pending command delivery, or runtime counter mutation paths were changed.
- `tests/server-transport-state.test.js`
  - Added coverage for the runtime observability snapshot helper.
- `docs/server-refactor-extracted-files.md`
  - Updated `src/server-transport-state.js` responsibilities.
  - Updated current `src/server.js` line count.
  - Moved runtime observability snapshot assembly out of the next-candidate list.

## Current File Sizes

- `src/server.js`: 12,829 lines
- `src/server-transport-state.js`: 1,298 lines
- `tests/server-transport-state.test.js`: 730 lines
- `docs/server-refactor-extracted-files.md`: 87 lines

## Validation

- `node --test tests/server-transport-state.test.js`
  - passed: 21
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 619
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

- `getRuntimeOpsSnapshot()` still assembles a broader runtime response in `src/server.js`.
- Queue diagnostics input assembly is still close to WS ack and polling fallback behavior, so it should be split in smaller test-backed slices.
- Keep `docs/server-refactor-extracted-files.md` updated after every future extraction.

## Next Recommended Task

Extract a small runtime ops response assembly helper, or start with a narrower helper for `pluginUiMetrics` / live-session selection used by `getRuntimeOpsSnapshot()`.
