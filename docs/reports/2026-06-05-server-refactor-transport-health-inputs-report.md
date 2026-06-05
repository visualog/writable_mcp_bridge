# 서버 리팩터링 리포트: Transport Health 입력 분리

날짜: 2026-06-05

## 요약

`src/server.js`의 `getTransportHealthSnapshot()`에 남아 있던 transport health live input counting을 `src/server-transport-state.js`의 `buildTransportHealthInputs()`로 분리했다. 이 helper는 SSE/WS client Set, plugin session Map, recent runtime events를 읽기 전용으로 집계하고, live session 판정은 기존 `getSessionState()` callback에 맡긴다.

## 완료한 작업

- `buildTransportHealthInputs()` 추가.
- `getTransportHealthSnapshot()`을 recent activity 수집, transport counter 참조, health input helper 호출, response builder 호출 구조로 축소.
- `tests/server-transport-state.test.js`에 읽기 전용 live input counting 테스트 추가.
- `docs/server-refactor-extracted-files.md`에 transport health 입력 집계 역할과 최신 line count 반영.

## 변경 파일

- `src/server.js`
  - active SSE/WS client 수와 live plugin session 수 집계를 `buildTransportHealthInputs()` 호출로 이동.
- `src/server-transport-state.js`
  - 읽기 전용 transport health input 집계 helper 추가.
- `tests/server-transport-state.test.js`
  - helper가 Set/Map 크기와 live session 수를 계산하고 store를 변경하지 않는지 검증.
- `docs/server-refactor-extracted-files.md`
  - `src/server-transport-state.js` 역할과 다음 후보 목록 업데이트.

## 크기 현황

```text
12651 src/server.js
 1624 src/server-transport-state.js
 1090 tests/server-transport-state.test.js
   93 docs/server-refactor-extracted-files.md
```

## 검증 결과

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

## 위험과 주의점

- `buildTransportHealthInputs()`는 live store를 읽지만 변경하지 않는다. 이 원칙을 유지해야 한다.
- `getSessionState()`는 `server.js`에서 주입된다. session lifecycle 규칙을 generic helper로 옮기지 않기 위한 의도적 경계다.
- Queue diagnostics 입력 조립은 pending command map과 WS fallback state를 다루기 때문에 다음 단계에서 더 주의가 필요하다.
- worktree에는 기존 수정/미추적 파일이 많다. 이번 조각은 위에 적은 파일만 변경했다.

## 다음 추천 작업

Queue diagnostics 입력 조립 분리를 시작한다. 첫 단계는 작게 잡는다. pending command snapshot과 age bucket을 읽기 전용 입력으로 준비하고, 기존 `buildQueueDiagnosticsSnapshot()`에 넘기는 구조로 분리한다.
