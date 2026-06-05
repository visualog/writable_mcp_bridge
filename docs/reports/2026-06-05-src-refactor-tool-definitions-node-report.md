# src 순차 리팩터링 리포트: node/import/update tool definitions 분리

작성일: 2026-06-05

## 작업 요약

`src/server-tool-definitions.js`에 남아 있던 node/import/update 계열 tool definition 11개를 `src/constants/server-tool-definitions-node.js`로 분리했다.

이번 작업은 정적 schema 위치만 바꾸는 리팩터링이다. `buildToolDefinitions()` public API와 반환 순서, 각 tool name/schema는 유지했다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `src/constants/server-tool-definitions-node.js` | node/import/update tool definition 11개를 반환하는 `buildNodeToolDefinitions()`를 추가했다. |
| `src/server-tool-definitions.js` | node/import/update schema 본문을 제거하고 `...buildNodeToolDefinitions()`로 조립하도록 변경했다. |
| `tests/server-tool-definitions.test.js` | node/import/update 분리 후에도 mutation 다음 순서가 유지되는지 검증하는 테스트를 추가했다. |
| `docs/server-refactor-extracted-files.md` | 새 node constants 파일 역할, 현재 분리 묶음, 다음 후보, 검증 기준을 갱신했다. |

## 분리된 tool definition

| tool | 쉬운 설명 |
| --- | --- |
| `preview_changes` | 실제 변경 없이 node update 묶음을 미리 보는 요청 schema. |
| `rename_node` | 단일 node 이름 변경 요청 schema. |
| `bulk_rename_nodes` | 여러 node 이름 변경 요청 schema. |
| `bulk_update_texts` | 여러 text node 문구 변경 요청 schema. |
| `update_node` | 단일 node의 표시, 색상, 크기, 위치, layout, text 속성 변경 요청 schema. |
| `bulk_update_nodes` | 여러 node update 요청 schema. |
| `bulk_create_nodes` | 여러 node 생성 요청 schema. |
| `create_node` | 단일 first-slice node 생성 요청 schema. |
| `import_library_component` | library component/component set import 요청 schema. |
| `find_or_import_component` | local component 검색 또는 library import 요청 schema. |
| `reuse_or_create_component` | component 재사용 또는 local component 생성 요청 schema. |

## 줄 수 변화

| 파일 | 줄 수 |
| --- | ---: |
| `src/server-tool-definitions.js` | 735 |
| `src/constants/server-tool-definitions-core.js` | 85 |
| `src/constants/server-tool-definitions-read.js` | 199 |
| `src/constants/server-tool-definitions-discovery.js` | 190 |
| `src/constants/server-tool-definitions-mutation.js` | 228 |
| `src/constants/server-tool-definitions-node.js` | 329 |
| `tests/server-tool-definitions.test.js` | 151 |

## TDD 기록

1. RED: `tests/server-tool-definitions.test.js`에 `buildNodeToolDefinitions()` import와 순서 보존 테스트를 먼저 추가했다.
2. RED 결과: `ERR_MODULE_NOT_FOUND`로 `src/constants/server-tool-definitions-node.js`가 없어서 실패했다.
3. GREEN: 새 node constants 파일을 추가하고 기존 `buildToolDefinitions()`가 이를 사용하도록 변경했다.
4. 전체 검증 결과: 대상 테스트와 `npm run check:all` 모두 통과했다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `node --test tests/server-tool-definitions.test.js` | 통과: 6 pass |
| `node --check src/server-tool-definitions.js` | 통과 |
| `node --check src/constants/server-tool-definitions-node.js` | 통과 |
| `npm run check:all` | 통과: 643 tests, 631 pass, 12 skipped, 0 fail |
| `curl -s --max-time 5 http://127.0.0.1:3846/health` | 통과: `ok=true`, `transportHealth.grade=healthy` |

## 리스크와 판단

- 실제 Figma node 생성/수정 실행부, component 검색 실행부, dispatch, queue, websocket, polling fallback은 건드리지 않았다.
- `create_node`, `bulk_create_nodes`, `import_library_component`의 동적 enum은 새 constants 파일에서 기존 helper를 그대로 호출한다.
- `preview_changes`, `update_node`, `bulk_update_nodes`의 반복 schema는 새 파일 안에서 공통 객체로 정리했지만 공개 필드 구성은 유지했다.
- `src/server-tool-definitions.js`는 735줄로 줄었지만 아직 500줄 이상이다.

## 다음 권장 태스크

다음으로는 `build_screen_from_design_system`부터 `build_layout`까지의 compose/layout 계열 tool definition을 `src/constants/server-tool-definitions-compose.js` 같은 constants 파일로 분리하는 것이 좋다.
