# 서버 리팩터링 핸드오프: Transport Health 입력 분리

## task

`src/server.js`를 계속 줄이기 위해, 읽기 전용 transport/server state input assembly를 테스트 가능한 helper로 분리한다.

## context

직전 작업에서는 transport health의 live input counting을 분리했다. `server.js`는 여전히 live store를 소유하지만, `src/server-transport-state.js`가 주입받은 입력을 읽어서 client/session/event 수를 계산한다.

완료된 helper:

- `buildTransportHealthInputs()`

이 helper가 계산하는 값:

- active SSE client 수
- active WS client 수
- active live plugin session 수
- recent runtime event 총량

이 helper는 `getSessionState()`를 callback으로 받는다. 그래서 session lifecycle 규칙은 계속 `server.js` 쪽 소유로 남는다.

## changedFiles

- `src/server.js`
- `src/server-transport-state.js`
- `tests/server-transport-state.test.js`
- `docs/server-refactor-extracted-files.md`
- `docs/reports/2026-06-05-server-refactor-transport-health-inputs-report.md`
- `docs/handoff/2026-06-05-server-refactor-transport-health-inputs-handoff.md`

## tests

```text
node --test tests/server-transport-state.test.js
PASS: 28 tests

node --check src/server.js
PASS

node --check src/server-transport-state.js
PASS

node --test tests/session-state-heartbeat-preflight.test.js
PASS: 38 tests

npm test
PASS: 638 tests, 626 pass, 12 skipped, 0 fail

curl -s --max-time 5 http://127.0.0.1:3846/health
PASS: ok=true, transportHealth.grade=healthy, active plugin page:33276:16484

node scripts/agent-preflight.mjs
PASS: ok=true, runtimeOpsOk=true, transportHealth.grade=healthy
```

## risks

- session lifecycle mutation이나 pruning을 `src/server-transport-state.js`로 옮기지 말 것.
- WS/SSE 동작 검증이 계속 필요한 동안 HTTP polling fallback을 제거하지 말 것.
- Queue diagnostics 분리는 transport health 입력 집계보다 결합도가 높다. pending commands, pending results, lifecycle history, fallback/ack timing을 읽기 때문이다.
- unrelated dirty worktree 파일은 보존할 것.

## nextSteps

1. `src/server.js`의 `getQueueDiagnostics()`를 확인한다.
2. pending command/result store를 변경하지 않고 queue diagnostics 입력을 준비하는 helper 테스트를 `tests/server-transport-state.test.js`에 먼저 추가한다.
3. `src/server-transport-state.js`에 helper를 구현한다.
4. `server.js`는 live map 소유와 helper 호출만 담당하게 유지한다.
5. 아래 검증을 실행한다.

```text
node --test tests/server-transport-state.test.js
node --check src/server.js
node --check src/server-transport-state.js
node --test tests/session-state-heartbeat-preflight.test.js
npm test
curl -s --max-time 5 http://127.0.0.1:3846/health
node scripts/agent-preflight.mjs
```

## continuationPrompt

다음 태스크 진행. `docs/handoff/2026-06-05-server-refactor-transport-health-inputs-handoff.md`를 먼저 읽고, `getQueueDiagnostics()`의 read-only input assembly 분리를 TDD로 진행해. 완료 후 `docs/server-refactor-extracted-files.md`, report, handoff 문서를 한국어로 업데이트하고 검증 결과를 남겨.
