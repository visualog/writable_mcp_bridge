# 2026-06-04 Server Refactor Completion Handoff

## task

Complete the remaining `src/server.js` size-reduction/refactor tasks from `docs/plans/2026-05-27-xbridge-stabilization-and-server-refactor.md`.

## context

All six planned extraction tasks are complete:

1. Token export orchestration extracted to `src/server-token-export.js`.
2. MCP tool definitions extracted to `src/server-tool-definitions.js`.
3. MCP command dispatch extracted to `src/server-command-dispatch.js`.
4. AI Designer HTTP route orchestration extracted to `src/server-designer-routes.js`.
5. Stable HTTP route table extracted to `src/server-routes.js`.
6. Transport/session status calculators extracted to `src/server-transport-state.js`.

`src/server.js` now acts more like a composition root for the extracted modules while keeping the existing HTTP/SSE/WS behavior and plugin command contracts intact.

Current line counts:

```text
13641 src/server.js
   96 src/server-transport-state.js
  306 src/server-routes.js
  657 src/server-designer-routes.js
  904 src/server-command-dispatch.js
 1882 src/server-tool-definitions.js
  449 src/server-token-export.js
17935 total
```

The final task moved pure active-session resolution and transport/read health grading out of `src/server.js` without moving raw socket lifecycle code.

## changedFiles

- `src/server.js`
- `src/server-token-export.js`
- `src/server-tool-definitions.js`
- `src/server-command-dispatch.js`
- `src/server-designer-routes.js`
- `src/server-routes.js`
- `src/server-transport-state.js`
- `tests/server-token-export.test.js`
- `tests/server-tool-definitions.test.js`
- `tests/server-command-dispatch.test.js`
- `tests/server-designer-routes.test.js`
- `tests/server-routes.test.js`
- `tests/server-transport-state.test.js`

The worktree still contains many pre-existing unrelated dirty/untracked files from the broader release work. Do not infer that every dirty file belongs to this refactor.

## tests

Passed:

```bash
node --check src/server.js
node --check src/server-transport-state.js
node --test tests/server-transport-state.test.js tests/session-state-heartbeat-preflight.test.js tests/ws-events.integration.test.js tests/websocket-command-channel.integration.test.js
npm test
curl -s http://127.0.0.1:3846/health
node scripts/agent-preflight.mjs
```

Key results:

- Targeted Task 6 tests: `66` pass, `0` fail.
- Full suite: `613` tests, `601` pass, `12` skipped, `0` fail.
- Live health: `ok: true`, `serverVersion: 0.5.65`, `transportHealth.grade: healthy`, active plugin `page:33276:16484`.
- Agent preflight: `ok: true`, `runtimeOpsOk: true`, `transportHealth.grade: healthy`.

Note: `node scripts/agent-preflight.mjs` fails inside the restricted sandbox because Node `fetch` is blocked with `connect EPERM 127.0.0.1:3846`. It passed when rerun with approved local network access.

## risks

- `src/server.js` is still large at 13,641 lines. The planned extraction work reduced the largest routing/tool/transport calculators, but the file still contains substantial bridge orchestration, command queue state, websocket lifecycle, and AI Designer helper logic.
- Several existing tests still depend on source-level contracts. Future extractions should keep behavior tests close to the moved modules and avoid broad implementation-string assertions where possible.
- The running local server used for `/health` and `agent-preflight` may not be automatically restarted from the latest edited source. Syntax and integration tests validate the edited source; live health validates the currently running bridge process.

## nextSteps

- No remaining tasks in the `2026-05-27` refactor plan.
- If additional size reduction is desired, the next best candidates are:
  - Extract command queue/readiness snapshot projection from `src/server.js`.
  - Extract websocket frame parsing and client lifecycle into a transport module.
  - Extract remaining AI Designer image/debug helper orchestration into a dedicated module.
- Before further extraction, run the same baseline:

```bash
node --check src/server.js
node --test tests/session-state-heartbeat-preflight.test.js tests/ws-events.integration.test.js tests/websocket-command-channel.integration.test.js
npm test
```
