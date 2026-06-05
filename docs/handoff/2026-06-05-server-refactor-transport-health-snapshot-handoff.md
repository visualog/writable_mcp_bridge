# Server Refactor Handoff: Transport Health Snapshot Builder

## task

Continue reducing `src/server.js` by extracting stable, testable transport/server state helpers without changing WS/SSE/HTTP fallback behavior.

## context

This handoff follows the recent transport activity extraction. The completed slice moved pure transport health response assembly out of `server.js` and into `src/server-transport-state.js`.

`server.js` still owns live runtime access:

- active SSE client counting
- active WS client counting
- live plugin session counting
- recent runtime event collection

`src/server-transport-state.js` now owns the pure response calculation:

- fallback pressure and effective fallback rate
- websocket dispatch success rate
- fallback incidence trend
- isolated fallback recovery detection
- transport health grade/summary/reason
- final transport health response shape

## changedFiles

- `src/server.js`
- `src/server-transport-state.js`
- `tests/server-transport-state.test.js`
- `docs/server-refactor-extracted-files.md`
- `docs/reports/2026-06-05-server-refactor-transport-health-snapshot-report.md`
- `docs/handoff/2026-06-05-server-refactor-transport-health-snapshot-handoff.md`

## tests

```text
node --check src/server.js
PASS

node --check src/server-transport-state.js
PASS

node --test tests/server-transport-state.test.js
PASS: 27 tests

node --test tests/session-state-heartbeat-preflight.test.js
PASS: 38 tests

npm test
PASS: 637 tests, 625 pass, 12 skipped, 0 fail

curl -s --max-time 5 http://127.0.0.1:3846/health
PASS: ok=true, transportHealth.grade=healthy, active plugin page:33276:16484

node scripts/agent-preflight.mjs
PASS: ok=true, runtimeOpsOk=true, transportHealth.grade=healthy
```

## risks

- Do not move live client/session store mutation into `src/server-transport-state.js`.
- Do not remove HTTP polling fallback while WS/SSE validation is still part of the bridge safety model.
- Queue diagnostics extraction has a higher coupling risk than this slice because it reads pending command queues and lifecycle histories.
- The repo has many unrelated dirty/untracked files. Preserve those boundaries.

## nextSteps

1. Inspect `getTransportHealthSnapshot()` again and decide whether live input counting can be extracted as a read-only helper.
2. If live input counting is too coupled, move to queue diagnostics input normalization instead of the queue store itself.
3. Keep using TDD for each server-state extraction:

```text
node --test tests/server-transport-state.test.js
node --test tests/session-state-heartbeat-preflight.test.js
node --check src/server.js
npm test
node scripts/agent-preflight.mjs
```

## continuationPrompt

다음 태스크 진행. `docs/handoff/2026-06-05-server-refactor-transport-health-snapshot-handoff.md`를 먼저 읽고, `src/server.js` 최적화를 계속 진행해. 우선 `getTransportHealthSnapshot()`의 live input counting 분리 가능성을 확인하고, 어렵다면 queue diagnostics input normalization 쪽으로 전환해. 완료 후 `docs/server-refactor-extracted-files.md`, report, handoff 문서를 업데이트하고 검증 결과를 남겨.
