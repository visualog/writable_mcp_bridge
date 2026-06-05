# 2026-06-05 Server Refactor Write Readiness Inputs Handoff

## task

Continue the `src/server.js` refactor by extracting write-readiness input selection into `src/server-transport-state.js`.

## context

The previous slice moved lifecycle/failure history ownership into `createQueueObservabilityStore()`. This slice moved the `getWriteReadinessSnapshot()` pre-input logic that chooses:

- latest successful write lifecycle timestamp
- most recent write failure within `RECENT_FAILURE_WINDOW_MS`

New helper:

- `buildWriteReadinessInputs({ now, recentCommandLifecycles, recentCommandFailures, failureWindowMs, isWriteCommandType })`

Current live server state:

- `serverVersion`: `0.5.65`
- `transportHealth.grade`: `healthy`
- active plugin: `page:33276:16484`
- `agent-preflight`: `ok: true`, `runtimeOpsOk: true`, `failures: []`

Current file sizes:

- `src/server.js`: 12,849 lines
- `src/server-transport-state.js`: 1,221 lines
- `tests/server-transport-state.test.js`: 644 lines

## changedFiles

- `src/server.js`
  - Imports `buildWriteReadinessInputs`.
  - Uses the helper in `getWriteReadinessSnapshot()`.
  - Keeps command dispatch, queue maps, runtime counters, WS/SSE, and HTTP fallback unchanged.
- `src/server-transport-state.js`
  - Adds `buildWriteReadinessInputs`.
- `tests/server-transport-state.test.js`
  - Adds coverage for latest write success and in-window write failure selection.
- `docs/reports/2026-06-05-server-refactor-write-readiness-inputs-report.md`
  - Completion report for this slice.
- `docs/handoff/2026-06-05-server-refactor-write-readiness-inputs-handoff.md`
  - This continuation handoff.

## tests

- `node --test tests/server-transport-state.test.js`
  - passed: 19
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 617
  - failed: 0
  - skipped: 12
- `curl -s --max-time 5 http://127.0.0.1:3846/health`
  - `ok: true`
  - `transportHealth.grade: healthy`
- `node scripts/agent-preflight.mjs`
  - `ok: true`
  - `runtimeOpsOk: true`
  - `failures: []`

## risks

- The helper relies on caller-provided write command classification.
- Lifecycle/failure ordering remains oldest-to-newest.
- `src/server-transport-state.js` and `tests/server-transport-state.test.js` remain untracked because they were introduced by this refactor series.

## nextSteps

1. Inspect `getRuntimeObservabilitySnapshot()` and `getRuntimeOpsSnapshot()` for pure snapshot assembly extraction.
2. Consider extracting active pending recovery count calculation if runtime snapshot extraction is too broad.
3. Keep WS/SSE dispatch, pending command delivery, queue maps, runtime counters, and HTTP polling fallback unchanged.
4. Validate every slice with `node --check src/server.js`, `node --test tests/server-transport-state.test.js`, `node --test tests/session-state-heartbeat-preflight.test.js`, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.

## continuationPrompt

Continue in `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`. Read `docs/handoff/2026-06-05-server-refactor-write-readiness-inputs-handoff.md` first. Continue the server refactor with the next small runtime-observability extraction. Do not alter WS/SSE command dispatch, pending command delivery, runtime counters, or HTTP polling fallback. Do not revert unrelated dirty files. Validate with targeted tests, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.
