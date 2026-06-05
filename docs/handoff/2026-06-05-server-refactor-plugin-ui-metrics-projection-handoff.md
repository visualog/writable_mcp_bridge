# 2026-06-05 Server Refactor Plugin UI Metrics Projection Handoff

## task

Continue `src/server.js` refactor by extracting plugin UI metrics projection from runtime ops input preparation.

## context

The durable extracted-file map is:

- `docs/server-refactor-extracted-files.md`

This slice added:

- `buildPluginUiMetricsSnapshot()` in `src/server-transport-state.js`

`src/server.js` still reads session snapshots, but the projection that filters and shapes plugin UI metrics for runtime ops now lives in `src/server-transport-state.js`.

Current live server state:

- `serverVersion`: `0.5.65`
- `transportHealth.grade`: `healthy`
- active plugin: `page:33276:16484`
- `agent-preflight`: `ok: true`, `runtimeOpsOk: true`, `failures: []`

Current file sizes:

- `src/server.js`: 12,814 lines
- `src/server-transport-state.js`: 1,356 lines
- `tests/server-transport-state.test.js`: 866 lines
- `docs/server-refactor-extracted-files.md`: 88 lines

## changedFiles

- `src/server.js`
  - Imports `buildPluginUiMetricsSnapshot()`.
  - Uses the helper inside `getRuntimeOpsSnapshot()`.
- `src/server-transport-state.js`
  - Adds `buildPluginUiMetricsSnapshot()`.
- `tests/server-transport-state.test.js`
  - Adds coverage for projecting only sessions that include `uiMetrics`.
- `docs/server-refactor-extracted-files.md`
  - Updates `src/server-transport-state.js` responsibilities.
  - Updates current `src/server.js` line count and next candidates.
- `docs/reports/2026-06-05-server-refactor-plugin-ui-metrics-projection-report.md`
  - Completion report for this slice.
- `docs/handoff/2026-06-05-server-refactor-plugin-ui-metrics-projection-handoff.md`
  - This continuation handoff.

## tests

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
- `node scripts/agent-preflight.mjs`
  - `ok: true`
  - `runtimeOpsOk: true`
  - `failures: []`

## risks

- `src/server-transport-state.js` and `tests/server-transport-state.test.js` remain untracked from this refactor series.
- Do not change pending command delivery, websocket dispatch, polling fallback execution, or raw runtime counter mutation without dedicated tests.
- Queue diagnostics input assembly remains sensitive because it annotates commands with WS ack and fallback delay state.

## nextSteps

1. Extract primary live session selection from live snapshots.
2. Keep live session collection itself in `server.js` for now.
3. Update `docs/server-refactor-extracted-files.md` after every extracted-file role change.
4. Keep WS/SSE dispatch, pending command delivery, runtime counters, and HTTP polling fallback unchanged.
5. Validate with `node --check src/server.js`, `node --test tests/server-transport-state.test.js`, `node --test tests/session-state-heartbeat-preflight.test.js`, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.

## continuationPrompt

Continue in `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`. Read `docs/handoff/2026-06-05-server-refactor-plugin-ui-metrics-projection-handoff.md` first. Continue the server refactor with a small primary-live-session selector extraction from `getRuntimeOpsSnapshot()`. Keep `docs/server-refactor-extracted-files.md` updated after every extracted-file role change. Do not alter WS/SSE command dispatch, pending command delivery, runtime counters, or HTTP polling fallback. Do not revert unrelated dirty files. Validate with targeted tests, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.
