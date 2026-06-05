# 2026-06-05 Server Refactor Queue Observability Store Handoff

## task

Continue the `src/server.js` refactor by moving command lifecycle/failure array ownership into a tested queue observability store.

## context

This slice followed the command recording state-update extraction. The previous slice moved append+trim calculations; this slice moved the lifecycle/failure arrays themselves behind `createQueueObservabilityStore()`.

New store:

- `createQueueObservabilityStore({ lifecycleLimit, failureWindowMs, failureHistoryLimit, runtimeErrorClass })`

Store methods used by `src/server.js`:

- `recordLifecycle(command, status, now, extra)`
- `recordFailure(command, error, now)`
- `trimFailures(now)`
- `getLifecycleEntries()`
- `getFailureEntries()`
- `getLifecycleSummary(options)`
- `getTimelineTail(options)`
- `getFailureSummary(now)`

Current live server state:

- `serverVersion`: `0.5.65`
- `transportHealth.grade`: `healthy`
- active plugin: `page:33276:16484`
- `agent-preflight`: `ok: true`, `runtimeOpsOk: true`, `failures: []`

Current file sizes:

- `src/server.js`: 12,859 lines
- `src/server-transport-state.js`: 1,182 lines
- `tests/server-transport-state.test.js`: 619 lines

## changedFiles

- `src/server.js`
  - Replaces `recentCommandFailures` and `recentCommandLifecycles` arrays with `queueObservability`.
  - Uses store methods in lifecycle/failure recording and observability snapshot paths.
  - Keeps pending command maps, runtime counters, WS/SSE dispatch, and HTTP fallback unchanged.
- `src/server-transport-state.js`
  - Adds `createQueueObservabilityStore()`.
- `tests/server-transport-state.test.js`
  - Adds coverage for store-owned lifecycle/failure history and summaries.
- `docs/reports/2026-06-05-server-refactor-queue-observability-store-report.md`
  - Completion report for this slice.
- `docs/handoff/2026-06-05-server-refactor-queue-observability-store-handoff.md`
  - This continuation handoff.

## tests

- `node --test tests/server-transport-state.test.js`
  - passed: 18
- `node --check src/server.js`
  - passed
- `node --check src/server-transport-state.js`
  - passed
- `node --test tests/session-state-heartbeat-preflight.test.js`
  - passed: 38
- `npm test`
  - passed: 616
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

- Store history ordering assumes append order from runtime command completion/failure.
- `src/server.js` still owns live pending command maps and dispatch behavior. Do not move those into the store without focused delivery/fallback tests.
- `src/server-transport-state.js` and `tests/server-transport-state.test.js` remain untracked because they were introduced by this refactor series.

## nextSteps

1. Inspect `getRuntimeObservabilitySnapshot()` and `getRuntimeOpsSnapshot()` for pure snapshot assembly extraction.
2. Consider extracting write readiness pre-input selection into a helper if runtime snapshot assembly is too broad.
3. Keep WS/SSE dispatch, command delivery, pending command maps, and HTTP polling fallback unchanged.
4. Validate every slice with `node --check src/server.js`, `node --test tests/server-transport-state.test.js`, `node --test tests/session-state-heartbeat-preflight.test.js`, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.

## continuationPrompt

Continue in `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`. Read `docs/handoff/2026-06-05-server-refactor-queue-observability-store-handoff.md` first. Continue the server refactor with the next small runtime-observability or write-readiness extraction. Do not alter WS/SSE command dispatch, pending command delivery, or HTTP polling fallback. Do not revert unrelated dirty files. Validate with targeted tests, `npm test`, `/health`, and `node scripts/agent-preflight.mjs`.
