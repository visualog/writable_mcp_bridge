# Server Refactor Report: Transport Health Snapshot Builder

Date: 2026-06-05

## Summary

`src/server.js`의 transport health 응답 조립 로직을 `src/server-transport-state.js`의 순수 헬퍼 `buildTransportHealthSnapshot()`로 분리했다. 이번 조각은 SSE/WS 클라이언트 수와 live plugin 수를 세는 런타임 접근은 `server.js`에 남기고, grade/summary/rate/trend/counter 응답 객체를 만드는 계산만 모듈로 옮긴 저위험 분리다.

## Completed Work

- `buildTransportHealthSnapshot()` 추가.
- `server.js`의 `getTransportHealthSnapshot()`을 live input 수집 + 순수 헬퍼 호출 구조로 축소.
- `tests/server-transport-state.test.js`에 transport health 응답 조립 테스트 추가.
- `docs/server-refactor-extracted-files.md`에 이번 분리 역할을 반영.

## Changed Files

- `src/server.js`
  - `classifyTransportHealth` 직접 import 제거.
  - transport health grade/trend/rate/copy 조립을 `buildTransportHealthSnapshot()` 호출로 대체.
- `src/server-transport-state.js`
  - transport health 응답 조립 헬퍼 추가.
- `tests/server-transport-state.test.js`
  - healthy 등급, counter/rate/trend, isolated fallback recovery 필드 검증 추가.
- `docs/server-refactor-extracted-files.md`
  - `src/server-transport-state.js` 역할에 transport health response assembly 추가.

## Size Snapshot

```text
12653 src/server.js
 1580 src/server-transport-state.js
 1045 tests/server-transport-state.test.js
   92 docs/server-refactor-extracted-files.md
```

## Validation

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

## Risks

- Live SSE/WS client counting and live plugin session counting still live in `server.js`; that is intentional for this slice.
- Queue diagnostics input assembly is still more sensitive because it touches pending command maps, lifecycle stores, and session state.
- Worktree has many unrelated existing modified/untracked files; this task only changed the files listed above.

## Next Recommended Task

Extract transport health live input counting into a small helper only if the boundary stays read-only and does not mutate client/session stores. If that feels too intertwined, reassess queue diagnostics input assembly and extract only pure input normalization first.
