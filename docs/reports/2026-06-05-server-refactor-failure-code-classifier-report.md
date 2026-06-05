# 2026-06-05 Server Refactor Failure Code Classifier Report

## Task

Continue reducing `src/server.js` by extracting command failure-code classification into `src/server-transport-state.js`.

## Completed

- Added `classifyCommandFailureCode(error, options)` to `src/server-transport-state.js`.
- Replaced the local `getFailureCode(error)` helper in `src/server.js`.
- Preserved the previous runtime-error behavior by requiring the caller to pass the runtime error class:
  - only instances of the supplied class can contribute their string `code`
  - all other errors fall back to `ERR_COMMAND_FAILED`
- Added regression coverage in `tests/server-transport-state.test.js`.

## Evidence

- `node --test tests/server-transport-state.test.js`
  - 13 pass, 0 fail
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - 38 pass, 0 fail
- `npm test`
  - 611 pass, 0 fail, 12 skipped
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

- `src/server.js`: 12,901 lines
- `src/server-transport-state.js`: 1,030 lines
- `tests/server-transport-state.test.js`: 475 lines

## Changed Files

- `src/server.js`
- `src/server-transport-state.js`
- `tests/server-transport-state.test.js`
- `docs/reports/2026-06-05-server-refactor-failure-code-classifier-report.md`
- `docs/handoff/2026-06-05-server-refactor-failure-code-classifier-handoff.md`

## Risks

- This extraction intentionally keeps `BridgeRuntimeError` ownership in `src/server.js`; `server-transport-state.js` remains decoupled by receiving the runtime error class as an option.
- Future queue refactors should continue to avoid changing WS/SSE dispatch or HTTP polling fallback semantics.

## Recommended Next Task

Extract a small lifecycle trimming helper or recent-window helper next. Keep mutation ownership in `src/server.js` until the transport-state module has enough pure test coverage around each projection.
