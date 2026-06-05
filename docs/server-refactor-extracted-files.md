# server.js 분리 파일 정리

마지막 업데이트: 2026-06-05

## 목적

이 문서는 `src/server.js` 리팩터링 과정에서 분리된 서버 파일을 계속 추적하기 위한 문서다. `src/server.js`에서 새로운 책임이 빠져나오거나, 이미 분리된 서버 모듈의 역할이 커질 때마다 이 문서를 함께 갱신한다.

`src/server.js`는 점점 "조립 지점"에 가까워져야 한다. 즉, 프로세스 시작, 실시간 소켓, 플러그인 명령 전달, 모듈 연결을 담당하고, 세부 계산이나 응답 조립은 분리된 파일이 맡는 구조가 목표다.

현재 `src/server.js` 크기: 12,651 lines.

## 분리된 서버 파일

| 파일 | 쉬운 설명 | 담당하는 일 | 담당하지 말아야 할 일 |
| --- | --- | --- | --- |
| `src/server-token-export.js` | 토큰 export 작업을 `server.js`에서 떼어낸 파일. | 토큰 export 파일명 생성, chunk 단위 토큰 export 흐름, export 결과 파일 저장. | HTTP 라우팅, 실시간 소켓 생명주기, 플러그인 세션 소유. |
| `src/server-tool-definitions.js` | 브리지가 MCP 클라이언트에 공개하는 도구 목록을 만드는 파일. | MCP tool schema와 definition 조립. | 실제 tool 실행, 명령 queue 전달, 런타임 상태 관리. |
| `src/server-command-dispatch.js` | MCP tool 호출을 브리지 명령으로 바꾸고 timeout 정책을 계산하는 파일. | 명령 timeout 계산, bulk bind timeout 계산, MCP tool handler factory. | HTTP route 처리, websocket client 생명주기, plugin session map 관리. |
| `src/server-designer-routes.js` | AI Designer 관련 HTTP endpoint를 처리하는 route 모듈. | Designer route 목록, route 판별, designer route handler 생성. | 저수준 server listener, command queue 내부, Figma plugin socket 관리. |
| `src/server-routes.js` | 안정적인 저위험 HTTP route를 route table로 처리하는 파일. | stable route table 생성, stable route handler 생성, route dispatch helper. | Designer 전용 orchestration, websocket frame 처리, MCP stdio 처리. |
| `src/server-transport-state.js` | transport, session, queue 상태를 읽기 쉬운 snapshot으로 계산하는 파일. | active session 선택, live plugin id 추출, primary live session 선택, 최근 transport activity 요약, transport health 입력 집계, transport health 응답 조립, read/write readiness 계산, transport health 등급 판정, runtime observability/runtime ops 응답 조립, plugin UI metrics 추출, queue diagnostics snapshot, command lifecycle/failure history store. | live pending command 전달, websocket dispatch, polling fallback 실행, raw runtime counter 변경. |

## 현재 집중 파일: `src/server-transport-state.js`

이 파일은 처음에는 transport/session 상태 계산용 작은 helper 모음이었지만, 지금은 transport와 queue observability의 순수 계산 로직을 담는 중심 파일이 되었다.

현재 주요 역할은 다음과 같다.

- session snapshot에서 active live session 선택
- 준비된 live session snapshot에서 live plugin id 추출
- 준비된 live session snapshot에서 primary live session 선택
- 최근 websocket ack/result와 polling fallback 신호 요약
- live SSE/WS/session store에서 transport health 입력을 읽기 전용으로 집계
- transport health 등급, trend, counter, 사용자 표시 문구 조립
- active recovery와 ignored recovery 요약
- read health와 transport health 등급 판정
- command failure code 분류
- 최근 failure/lifecycle history trimming
- command lifecycle/failure record 생성
- `createQueueObservabilityStore()`를 통한 lifecycle/failure history 소유
- lifecycle summary와 timeline view 생성
- 최근 failure summary 생성
- counter와 health summary로 runtime observability snapshot 조립
- 준비된 diagnostics로 runtime ops response snapshot 조립
- session snapshot에서 plugin UI metrics 추출
- queue diagnostics snapshot 생성
- command readiness snapshot 생성
- write readiness 입력 선택과 write readiness snapshot 생성

쉽게 말하면, `server.js`는 브리지에서 명령을 실제로 움직이고, `server-transport-state.js`는 그 움직임이 지금 어떤 상태인지 설명한다.

## 분리된 테스트 파일

| 파일 | 검증하는 내용 |
| --- | --- |
| `tests/server-token-export.test.js` | 토큰 export artifact와 chunk 동작. |
| `tests/server-tool-definitions.test.js` | MCP tool definition 형태와 dynamic-page 필드. |
| `tests/server-command-dispatch.test.js` | 명령 timeout 정책과 tool dispatch wiring. |
| `tests/server-designer-routes.test.js` | Designer route module 경로와 route 동작. |
| `tests/server-routes.test.js` | stable route table과 handler 동작. |
| `tests/server-transport-state.test.js` | transport/read/write readiness, queue diagnostics, lifecycle/failure summary, queue observability store. |

## 업데이트 규칙

`src/server.js`에서 새로운 책임을 분리할 때는 아래 항목을 함께 갱신한다.

1. "분리된 서버 파일" 표에 파일을 추가하거나 기존 행을 수정한다.
2. 함수 이름만 나열하지 말고, 사람이 바로 이해할 수 있는 쉬운 역할 설명을 적는다.
3. 그 파일이 담당하는 일과 담당하지 말아야 할 일을 함께 적는다.
4. 대응되는 테스트 파일이나 테스트 범위를 적는다.
5. 검증 후 `src/server.js` line count를 최신 값으로 갱신한다.

## 현재 다음 후보

| 후보 | 다음 후보인 이유 | 위험도 |
| --- | --- | --- |
| Queue diagnostics 입력 조립 | `getQueueDiagnostics()`가 아직 pending command snapshot을 `server.js` 안에서 준비한다. | 중간: WS ack와 polling fallback 정책에 가깝다. |
| Runtime ops live 입력 조립 | `server.js`의 `buildRuntimeOpsSnapshot()` 호출부가 아직 active session resolution, live snapshot, UI metrics, queue diagnostics를 모아 넘긴다. | 중간: endpoint 표면이 넓으므로 읽기 전용 input shaping부터 작게 분리해야 한다. |

## 검증 기준

각 server refactor 조각마다 아래 검증을 기본으로 실행한다.

```bash
node --check src/server.js
node --check src/server-transport-state.js
node --test tests/server-transport-state.test.js
node --test tests/session-state-heartbeat-preflight.test.js
npm test
curl -s --max-time 5 http://127.0.0.1:3846/health
node scripts/agent-preflight.mjs
```
