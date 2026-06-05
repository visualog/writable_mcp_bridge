# 2026-06-05 Server Refactor Live Plugin Id Selector Handoff

## task

Continue `src/server.js` refactor by extracting live plugin id projection from runtime ops input preparation.

## context

The durable extracted-file map is:

- `docs/server-refactor-extracted-files.md`

This slice added:

- `buildLivePluginIdsSnapshot()` in `src/server-transport-state.js`

`src/server.js` still collects live session snapshots, but the projection from live snapshots to active plugin ids now lives in `src/server-transport-state.js`.

Current live server state:

- `serverVersion`: `0.5.65`
- `transportHealth.grade`: `healthy`
- active plugin: `page:33276:16484`
- `agent-preflight`: `ok: true`, `runtimeOpsOk: true`, `failures: []`

Current file sizes:

- `src/server.js`: 12,814 lines
- `src/server-transport-state.js`: 1,379 lines
- `tests/server-transport-state.test.js`: 937 lines
- `docs/server-refactor-extracted-files.md`: 90 lines

## changedFiles

- `src/server.js`
  - Imports `buildLivePluginIdsSnapshot()`.
  - Uses the helper inside `getRuntimeOpsSnapshot()`.
- `src/server-transport-state.js`
  - Adds `buildLivePluginIdsSnapshot()`.
- `tests/server-transport-state.test.js`
  - Adds coverage for live plugin id projection.
- `docs/server-refactor-extracted-files.md`
  - Updates `src/server-transport-state.js` responsibilities and next candidates.
- `docs/reports/2026-06-05-server-refactor-live-plugin-id-selector-report.md`
  - Completion report for this slice.
- `docs/handoff/2026-06-05-server-refactor-live-plugin-id-selector-handoff.md`
  - This continuation handoff.

## tests

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
- `node scripts/agent-preflight.mjs`
  - `ok: true`
  - `runtimeOpsOk: true`
  - `failures: []`

## risks

- `src/server-transport-state.js` and `tests/server-transport-state.test.js` remain untracked from this refactor series.
- Do not change pending command delivery, websocket dispatch, polling fallback execution, or raw runtime counter mutation without dedicated tests.
- Queue diagnostics input assembly remains sensitive because it annotates commands with WS ack and fallback delay state.

## nextSteps

1. Reassess remaining runtime helpers in `src/server.js`.
2. Prefer a small queue diagnostics input assembly slice if it can avoid changing WS ack or fallback policy behavior.
3. Otherwise extract a smaller transport health recent activity selector first.
4. Update `docs/server-refactor-extracted-files.md` after every extracted-file role change.
5. Validate with `node --check src/server.js`, `node --test tests/server-transport-state.test.js`, `node --test tests/session-state-heartbeat-preflight.test.js`, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.

## continuationPrompt

Continue in `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`. Read `docs/handoff/2026-06-05-server-refactor-live-plugin-id-selector-handoff.md` first. Reassess remaining runtime helpers in `src/server.js`; pick a small safe extraction, likely queue diagnostics input assembly or a transport health recent activity selector. Keep `docs/server-refactor-extracted-files.md` updated after every extracted-file role change. Do not alter WS/SSE command dispatch, pending command delivery, runtime counters, or HTTP polling fallback. Do not revert unrelated dirty files. Validate with targeted tests, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.
