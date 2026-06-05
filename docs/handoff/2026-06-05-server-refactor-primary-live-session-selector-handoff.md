# 2026-06-05 Server Refactor Primary Live Session Selector Handoff

## task

Continue `src/server.js` refactor by extracting primary live session selection from runtime ops input preparation.

## context

The durable extracted-file map is:

- `docs/server-refactor-extracted-files.md`

This slice added:

- `buildPrimaryLiveSessionSnapshot()` in `src/server-transport-state.js`

`src/server.js` still collects live session snapshots and active session resolution, but the selector rule for choosing the primary live session now lives in `src/server-transport-state.js`.

Current live server state:

- `serverVersion`: `0.5.65`
- `transportHealth.grade`: `healthy`
- active plugin: `page:33276:16484`
- `agent-preflight`: `ok: true`, `runtimeOpsOk: true`, `failures: []`

Current file sizes:

- `src/server.js`: 12,813 lines
- `src/server-transport-state.js`: 1,372 lines
- `tests/server-transport-state.test.js`: 914 lines
- `docs/server-refactor-extracted-files.md`: 90 lines

## changedFiles

- `src/server.js`
  - Imports `buildPrimaryLiveSessionSnapshot()`.
  - Uses the helper inside `getRuntimeOpsSnapshot()`.
- `src/server-transport-state.js`
  - Adds `buildPrimaryLiveSessionSnapshot()`.
- `tests/server-transport-state.test.js`
  - Adds coverage for primary live session selection.
- `docs/server-refactor-extracted-files.md`
  - Updates `src/server-transport-state.js` responsibilities.
  - Updates current `src/server.js` line count and next candidates.
- `docs/reports/2026-06-05-server-refactor-primary-live-session-selector-report.md`
  - Completion report for this slice.
- `docs/handoff/2026-06-05-server-refactor-primary-live-session-selector-handoff.md`
  - This continuation handoff.

## tests

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
- `node scripts/agent-preflight.mjs`
  - `ok: true`
  - `runtimeOpsOk: true`
  - `failures: []`

## risks

- `src/server-transport-state.js` and `tests/server-transport-state.test.js` remain untracked from this refactor series.
- Do not change pending command delivery, websocket dispatch, polling fallback execution, or raw runtime counter mutation without dedicated tests.
- Queue diagnostics input assembly remains sensitive because it annotates commands with WS ack and fallback delay state.

## nextSteps

1. Extract the live plugin id selector from `getRuntimeOpsSnapshot()`.
2. After that, decide whether the next safe slice is queue diagnostics input assembly or transport health recent activity.
3. Update `docs/server-refactor-extracted-files.md` after every extracted-file role change.
4. Keep WS/SSE dispatch, pending command delivery, runtime counters, and HTTP polling fallback unchanged.
5. Validate with `node --check src/server.js`, `node --test tests/server-transport-state.test.js`, `node --test tests/session-state-heartbeat-preflight.test.js`, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.

## continuationPrompt

Continue in `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`. Read `docs/handoff/2026-06-05-server-refactor-primary-live-session-selector-handoff.md` first. Continue the server refactor with a small live-plugin-id selector extraction from `getRuntimeOpsSnapshot()`. Keep `docs/server-refactor-extracted-files.md` updated after every extracted-file role change. Do not alter WS/SSE command dispatch, pending command delivery, runtime counters, or HTTP polling fallback. Do not revert unrelated dirty files. Validate with targeted tests, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.
