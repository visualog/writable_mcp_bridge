# 2026-06-05 Server Refactor Queue Observability Store Report

## Task

Continue the `src/server.js` refactor by moving command lifecycle/failure array ownership into a tested queue observability store.

## Completed

- Added `createQueueObservabilityStore()` in `src/server-transport-state.js`.
- Moved ownership of command lifecycle/failure history out of `src/server.js`.
- Updated `src/server.js` to use store methods for:
  - lifecycle recording
  - failure recording
  - lifecycle summary/timeline
  - recent failure summary
  - write readiness lifecycle/failure lookup
  - queue diagnostics lifecycle tail
- Removed direct `recentCommandFailures` and `recentCommandLifecycles` arrays from `src/server.js`.
- Kept WS/SSE command dispatch, command delivery, queue maps, runtime counters, and HTTP polling fallback unchanged.
- Added regression coverage for the store in `tests/server-transport-state.test.js`.

## Evidence

- `node --test tests/server-transport-state.test.js`
  - 18 pass, 0 fail
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - 38 pass, 0 fail
- `npm test`
  - 616 pass, 0 fail, 12 skipped
- `curl -s --max-time 5 http://127.0.0.1:3846/health`
  - `ok: true`
  - `serverVersion: 0.5.65`
  - `transportHealth.grade: healthy`
  - active plugin: `page:33276:16484`
- `node scripts/agent-preflight.mjs`
  - `ok: true`
  - `transportHealth.grade: healthy`
  - `runtimeOpsOk: true`
  - `failures: []`

## Size Impact

- `src/server.js`: 12,859 lines
- `src/server-transport-state.js`: 1,182 lines
- `tests/server-transport-state.test.js`: 619 lines

This slice reduced `src/server.js` by 42 lines from the previous 12,901-line state while moving actual lifecycle/failure history ownership into the extracted module.

## Changed Files

- `src/server.js`
- `src/server-transport-state.js`
- `tests/server-transport-state.test.js`
- `docs/reports/2026-06-05-server-refactor-queue-observability-store-report.md`
- `docs/handoff/2026-06-05-server-refactor-queue-observability-store-handoff.md`

## Risks

- The store still assumes lifecycle/failure entries are append-ordered oldest to newest.
- `src/server.js` still owns pending command maps, runtime counters, dispatch, and fallback behavior.
- Future store expansion should avoid absorbing live command delivery state until that path has dedicated tests.

## Recommended Next Task

Inspect `getRuntimeObservabilitySnapshot()` and `getRuntimeOpsSnapshot()` for another pure snapshot assembly extraction. This is now a better next target than queue lifecycle/failure history, because that ownership has moved into the store.
