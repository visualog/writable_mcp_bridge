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
| `src/constants/server-tool-definitions-core.js` | tool definition 중 가장 앞에 있는 기본/세션/REST 도구 목록을 따로 담은 파일. | `get_active_plugins`, `get_selection`, `list_pages`, Figma REST 조회 도구의 schema 정의. | 전체 tool 목록 순서 결정, 동적 enum 조립, 실제 tool 실행. |
| `src/constants/server-tool-definitions-read.js` | 읽기와 상세 조회용 tool schema를 따로 담은 파일. | metadata, annotation read, node/detail read, variable/token read, text/search/snapshot/export read schema 정의. | mutation tool schema, Designer route 처리, 실제 read command 실행. |
| `src/constants/server-tool-definitions-discovery.js` | annotation, design system 검색, snapshot 재생처럼 탐색과 분석에 가까운 tool schema를 따로 담은 파일. | reference selection 분석, annotation 추가/일괄 추가, design system/library/component 검색, snapshot replay, component property 조회 schema 정의. | 실제 annotation 작성, REST/API 호출 실행, replay command 처리, 전체 tool 순서 결정. |
| `src/constants/server-tool-definitions-mutation.js` | text, style, variable, component 관련 쓰기 tool schema를 따로 담은 파일. | text update, component property 설정/추가/편집, variant property 설정, variable bind, style apply, component/component set 생성 schema 정의. | 실제 Figma mutation 실행, command dispatch, write queue 조절, create node/import/layout schema 정의. |
| `src/constants/server-tool-definitions-node.js` | node 이름/속성 변경, node 생성, library component import 관련 tool schema를 따로 담은 파일. | preview/update/rename/bulk update, create node, bulk create node, library component import, find-or-import, reuse-or-create schema 정의. | 실제 node 생성/수정 실행, component 검색 실행, command dispatch, compose/layout schema 정의. |
| `src/constants/server-tool-definitions-compose.js` | compose와 layout 생성용 tool schema를 따로 담은 파일. | design-system screen scaffold, external compose input 검증, compose metrics, intent 기반 screen compose, reference 분석 후 compose, finance mock, declarative layout schema 정의. | 실제 compose 실행, layout builder 실행, command dispatch, low-level node operation schema 정의. |
| `src/constants/server-tool-definitions-operations.js` | instance 생성, 이동, 정렬, 삭제, undo처럼 낮은 수준의 node operation tool schema를 따로 담은 파일. | create instance, duplicate, move, section move/promote, spacing normalize, naming rule, delete, reorder, boolean subtract, undo schema 정의. | 실제 mutation 실행, undo state 관리, queue/dispatch 처리, compose/layout schema 정의. |
| `src/server-command-dispatch.js` | MCP tool 호출을 브리지 명령으로 바꾸고 timeout 정책을 계산하는 파일. | 명령 timeout 계산, bulk bind timeout 계산, MCP tool handler factory. | HTTP route 처리, websocket client 생명주기, plugin session map 관리. |
| `src/server-designer-routes.js` | AI Designer 관련 HTTP endpoint를 처리하는 route 모듈. | Designer route 목록, route 판별, designer route handler 생성. | 저수준 server listener, command queue 내부, Figma plugin socket 관리. |
| `src/server-routes.js` | 안정적인 저위험 HTTP route를 route table로 처리하는 파일. | stable route table 생성, stable route handler 생성, route dispatch helper. | Designer 전용 orchestration, websocket frame 처리, MCP stdio 처리. |
| `src/server-transport-state.js` | transport, session, queue 상태를 읽기 쉬운 snapshot으로 계산하는 파일. | active session 선택, live plugin id 추출, primary live session 선택, 최근 transport activity 요약, transport health 입력 집계, transport health 응답 조립, read/write readiness 계산, transport health 등급 판정, runtime observability/runtime ops 응답 조립, plugin UI metrics 추출, queue diagnostics snapshot, command lifecycle/failure history store. | live pending command 전달, websocket dispatch, polling fallback 실행, raw runtime counter 변경. |

## 현재 집중 파일: `src/server-tool-definitions.js`

이 파일은 MCP 클라이언트에 공개되는 tool schema를 한곳에서 조립한다. 실행 로직은 직접 담당하지 않지만, tool 이름과 schema 순서가 public surface이기 때문에 작은 묶음 단위로만 분리한다.

현재 `src/server-tool-definitions.js` 크기: 19 lines.

현재 분리된 묶음은 다음과 같다.

- core: 세션/선택/page/Figma REST 조회 schema
- read: metadata, detail, token, snapshot, export read schema
- discovery: reference 분석, annotation, design system/search/replay schema
- mutation: text/style/variable/component 쓰기 schema
- node: node update/create/import/reuse schema
- compose: compose/layout 생성 schema
- operations: instance, move, delete, reorder, boolean, undo schema

쉽게 말하면, `server-tool-definitions.js`는 tool schema의 최종 목차이고, `src/constants/server-tool-definitions-*.js` 파일들은 목차에 꽂히는 장별 원고다.

## 분리된 테스트 파일

| 파일 | 검증하는 내용 |
| --- | --- |
| `tests/server-token-export.test.js` | 토큰 export artifact와 chunk 동작. |
| `tests/server-tool-definitions.test.js` | MCP tool definition 형태, dynamic-page 필드, core/read/discovery/mutation/node/compose/operations tool definition 분리 순서. |
| `tests/token-export-contract.test.js` | dynamic-page read command의 `pageId` 전달 계약과 분리된 read tool schema 위치. |
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
| `server-tool-definitions` 후속 안정화 | tool schema 묶음 분리는 완료되었다. 다음에는 과도하게 커진 constants 파일이 있는지 별도 기준으로 재검토한다. | 낮음: 현재는 조립 파일 역할이 선명하다. |

## 검증 기준

각 server refactor 조각마다 아래 검증을 기본으로 실행한다.

```bash
node --check src/server.js
node --check src/server-tool-definitions.js
node --check src/constants/server-tool-definitions-core.js
node --check src/constants/server-tool-definitions-read.js
node --check src/constants/server-tool-definitions-discovery.js
node --check src/constants/server-tool-definitions-mutation.js
node --check src/constants/server-tool-definitions-node.js
node --check src/constants/server-tool-definitions-compose.js
node --check src/constants/server-tool-definitions-operations.js
node --check src/server-transport-state.js
node --test tests/server-tool-definitions.test.js
node --test tests/token-export-contract.test.js
node --test tests/server-transport-state.test.js
node --test tests/session-state-heartbeat-preflight.test.js
npm run check:all
npm test
curl -s --max-time 5 http://127.0.0.1:3846/health
node scripts/agent-preflight.mjs
```
