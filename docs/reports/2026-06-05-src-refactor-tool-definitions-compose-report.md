# src 순차 리팩터링 리포트: compose/layout tool definitions 분리

작성일: 2026-06-05

## 작업 요약

`src/server-tool-definitions.js`에 남아 있던 compose/layout 계열 tool definition 7개를 `src/constants/server-tool-definitions-compose.js`로 분리했다.

이번 작업은 정적 schema 위치만 바꾸는 리팩터링이다. `buildToolDefinitions()` public API와 반환 순서, 각 tool name/schema는 유지했다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `src/constants/server-tool-definitions-compose.js` | compose/layout tool definition 7개를 반환하는 `buildComposeToolDefinitions()`를 추가했다. |
| `src/server-tool-definitions.js` | compose/layout schema 본문을 제거하고 `...buildComposeToolDefinitions()`로 조립하도록 변경했다. |
| `tests/server-tool-definitions.test.js` | compose/layout 분리 후에도 node 다음 순서가 유지되는지 검증하는 테스트를 추가했다. |
| `docs/server-refactor-extracted-files.md` | 새 compose constants 파일 역할, 현재 분리 묶음, 다음 후보, 검증 기준을 갱신했다. |

## 분리된 tool definition

| tool | 쉬운 설명 |
| --- | --- |
| `build_screen_from_design_system` | design system 친화적인 screen scaffold 생성 요청 schema. |
| `validate_external_compose_input` | 외부 analyzer payload를 compose 계약에 맞게 검증하는 요청 schema. |
| `get_compose_metrics` | compose/validation runtime metrics 조회 schema. |
| `compose_screen_from_intents` | semantic section intent로 screen을 compose하는 요청 schema. |
| `analyze_selection_to_compose` | reference selection 분석 후 compose까지 이어가는 요청 schema. |
| `build_finance_summary_mock` | finance summary mock screen 생성 요청 schema. |
| `build_layout` | declarative helper tree 기반 layout 생성 요청 schema. |

## 줄 수 변화

| 파일 | 줄 수 |
| --- | ---: |
| `src/server-tool-definitions.js` | 197 |
| `src/constants/server-tool-definitions-compose.js` | 433 |
| `src/constants/server-tool-definitions-node.js` | 329 |
| `tests/server-tool-definitions.test.js` | 178 |

## TDD 기록

1. RED: `tests/server-tool-definitions.test.js`에 `buildComposeToolDefinitions()` import와 순서 보존 테스트를 먼저 추가했다.
2. RED 결과: `ERR_MODULE_NOT_FOUND`로 `src/constants/server-tool-definitions-compose.js`가 없어서 실패했다.
3. GREEN: 새 compose constants 파일을 추가하고 기존 `buildToolDefinitions()`가 이를 사용하도록 변경했다.
4. 전체 검증 결과: 대상 테스트와 `npm run check:all` 모두 통과했다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `node --test tests/server-tool-definitions.test.js` | 통과: 7 pass |
| `node --check src/server-tool-definitions.js` | 통과 |
| `node --check src/constants/server-tool-definitions-compose.js` | 통과 |
| `npm run check:all` | 통과: 644 tests, 632 pass, 12 skipped, 0 fail |
| `curl -s --max-time 5 http://127.0.0.1:3846/health` | 통과: `ok=true`, `transportHealth.grade=healthy` |

## 리스크와 판단

- 실제 compose 실행부, layout builder, command dispatch, queue, websocket, polling fallback은 건드리지 않았다.
- 반복되는 `referenceAnalysis`, section, layout tree schema는 새 constants 파일 안에서 공통 상수로 정리했다.
- `src/server-tool-definitions.js`는 197줄이 되어 500줄 미만 목표를 충족했다.

## 다음 권장 태스크

다음으로는 `create_instance`부터 `undo_last_batch`까지의 node operation 계열 tool definition을 `src/constants/server-tool-definitions-operations.js` 같은 constants 파일로 분리하는 것이 좋다. 이 작업까지 하면 `src/server-tool-definitions.js`는 거의 순수 조립 파일이 된다.
