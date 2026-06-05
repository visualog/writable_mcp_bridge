# 2026-06-05 Server Refactor Failure Code Classifier Handoff

## task

Continue the `src/server.js` refactor by moving command failure-code classification into `src/server-transport-state.js`.

## context

This slice follows the command lifecycle/failure recording extraction. The local `getFailureCode(error)` helper in `src/server.js` was replaced with the pure exported helper `classifyCommandFailureCode(error, { runtimeErrorClass })`.

The helper preserves the old behavior without importing `BridgeRuntimeError` into `server-transport-state.js`:

- if `error instanceof runtimeErrorClass` and `error.code` is a string, use that code
- otherwise return `ERR_COMMAND_FAILED`

Current live server state:

- `serverVersion`: `0.5.65`
- `transportHealth.grade`: `healthy`
- active plugin: `page:33276:16484`
- `agent-preflight`: `ok: true`, `runtimeOpsOk: true`, `failures: []`

Current file sizes:

- `src/server.js`: 12,901 lines
- `src/server-transport-state.js`: 1,030 lines
- `tests/server-transport-state.test.js`: 475 lines

## changedFiles

- `src/server.js`
  - Imports `classifyCommandFailureCode`.
  - Removes local `getFailureCode(error)`.
  - Calls `classifyCommandFailureCode(error, { runtimeErrorClass: BridgeRuntimeError })` in `recordCommandFailure()`.
- `src/server-transport-state.js`
  - Adds `classifyCommandFailureCode`.
- `tests/server-transport-state.test.js`
  - Adds coverage for runtime-error code preservation and fallback behavior.
- `docs/reports/2026-06-05-server-refactor-failure-code-classifier-report.md`
  - Completion report for this slice.
- `docs/handoff/2026-06-05-server-refactor-failure-code-classifier-handoff.md`
  - This continuation handoff.

## tests

- `node --test tests/server-transport-state.test.js`
  - passed: 13
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 611
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

- `src/server-transport-state.js` and `tests/server-transport-state.test.js` remain untracked because they were introduced by the ongoing refactor series.
- The next extractions should stay pure and avoid moving command queue mutation, WS dispatch, or polling fallback state until those areas have narrower tests.

## nextSteps

1. Extract lifecycle/recent-window trimming helpers next if they can be represented as pure list operations.
2. Keep `recentCommandLifecycles`, `recentCommandFailures`, and runtime counters owned by `src/server.js`.
3. Validate every slice with `node --check src/server.js`, `node --test tests/server-transport-state.test.js`, `node --test tests/session-state-heartbeat-preflight.test.js`, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.
4. Continue using `/health -> /api/pages -> target read API` for live Figma validation.

## continuationPrompt

Continue in `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`. Read `docs/handoff/2026-06-05-server-refactor-failure-code-classifier-handoff.md` first. Continue the server refactor with the next small pure-helper extraction from `src/server.js`, preferably lifecycle/recent-window trimming. Do not revert unrelated dirty files. Keep HTTP fallback and WS/SSE behavior unchanged. Validate with targeted tests, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.
