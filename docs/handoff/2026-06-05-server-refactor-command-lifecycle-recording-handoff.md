# 2026-06-05 Server Refactor Command Lifecycle Recording Handoff

## task

Continue the `src/server.js` refactor by moving command lifecycle/failure recording projection logic into `src/server-transport-state.js`.

## context

The previous refactor slices already moved readiness, queue diagnostics, lifecycle summary/timeline, and recent failure summary builders out of `src/server.js`. This slice focused only on pure snapshot construction for command lifecycle and command failure records.

Current live server state:

- `serverVersion`: `0.5.65`
- `transportHealth.grade`: `healthy`
- active plugin: `page:33276:16484`
- `agent-preflight`: `ok: true`, `runtimeOpsOk: true`, `failures: []`

Current file sizes:

- `src/server.js`: 12,905 lines
- `src/server-transport-state.js`: 1,018 lines
- `tests/server-transport-state.test.js`: 453 lines

## changedFiles

- `src/server.js`
  - Imports `buildCommandLifecycleSnapshot` and `buildCommandFailureRecord`.
  - Uses extracted builders inside `recordCommandLifecycle()` and `recordCommandFailure()`.
  - Keeps mutable arrays and trimming calls local to the server.
- `src/server-transport-state.js`
  - Adds `buildCommandLifecycleSnapshot`.
  - Adds `buildCommandFailureRecord`.
- `tests/server-transport-state.test.js`
  - Adds coverage for lifecycle snapshot timing/failure metadata.
  - Adds coverage for expired failure status mapping.
- `docs/reports/2026-06-05-server-refactor-command-lifecycle-recording-report.md`
  - Completion report for this slice.
- `docs/handoff/2026-06-05-server-refactor-command-lifecycle-recording-handoff.md`
  - This continuation handoff.

## tests

- `node --test tests/server-transport-state.test.js`
  - passed: 12
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 610
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

- `getFailureCode(error)` remains in `src/server.js`; it can be extracted later, but it should be checked against all command failure paths first.
- Queue mutation ownership still belongs in `src/server.js`; keep future slices small and prefer pure projection builders before moving stateful behavior.
- `src/server-transport-state.js` and `tests/server-transport-state.test.js` are still untracked in the current worktree because they were introduced by this refactor series.

## nextSteps

1. Extract `getFailureCode(error)` into a tested helper if call-site inspection confirms it is command-transport specific.
2. Consider moving lifecycle trimming projection constants/helpers next, while keeping mutation calls in `src/server.js`.
3. Re-run `node --check src/server.js`, targeted transport-state tests, and `npm test` after each small slice.
4. Use `/health -> /api/pages -> target read API` for any live Figma validation, keeping HTTP fallback intact.

## continuationPrompt

Continue in `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`. Read `docs/handoff/2026-06-05-server-refactor-command-lifecycle-recording-handoff.md` first. Continue the server refactor with the next small pure-helper extraction from `src/server.js`, preferably failure-code classification or lifecycle trimming. Do not revert unrelated dirty files. Validate with `node --check src/server.js`, targeted `node --test`, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.
