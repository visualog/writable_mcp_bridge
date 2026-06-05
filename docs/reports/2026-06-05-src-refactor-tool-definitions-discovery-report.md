# src 순차 리팩터링 리포트: discovery/annotation tool definitions 분리

작성일: 2026-06-05

## 작업 요약

`src/server-tool-definitions.js`에 남아 있던 discovery/annotation 계열 tool definition 9개를 `src/constants/server-tool-definitions-discovery.js`로 분리했다.

이번 작업은 정적 schema 위치만 바꾸는 리팩터링이다. `buildToolDefinitions()` public API와 반환 순서, 각 tool name/schema는 유지했다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `src/constants/server-tool-definitions-discovery.js` | discovery/annotation tool definition 9개를 반환하는 `buildDiscoveryToolDefinitions()`를 추가했다. |
| `src/server-tool-definitions.js` | discovery/annotation schema 본문을 제거하고 `...buildDiscoveryToolDefinitions()`로 조립하도록 변경했다. |
| `tests/server-tool-definitions.test.js` | discovery/annotation 분리 후에도 read 다음 순서가 유지되는지 검증하는 테스트를 추가했다. |
| `docs/server-refactor-extracted-files.md` | 새 discovery constants 파일 역할과 검증 기준을 갱신했다. |

## 분리된 tool definition

| tool | 쉬운 설명 |
| --- | --- |
| `analyze_reference_selection` | 선택한 reference를 화면 섹션 초안으로 분석하는 schema. |
| `add_annotation` | 단일 노드 annotation 추가/교체/삭제 요청 schema. |
| `bulk_add_annotations` | 여러 노드 annotation 일괄 추가 요청 schema. |
| `search_design_system` | 로컬/외부 design system asset 검색 요청 schema. |
| `search_instances` | selection, target, page 범위의 instance 검색 요청 schema. |
| `search_library_assets` | REST 기반 library component/style 검색 요청 schema. |
| `recreate_snapshot` | 저장된 snapshot을 target parent 아래에 재생성하는 요청 schema. |
| `search_file_components` | Figma file response의 component metadata 검색 요청 schema. |
| `list_component_properties` | 선택 또는 지정 노드의 component property 조회 요청 schema. |

## 줄 수 변화

| 파일 | 줄 수 |
| --- | ---: |
| `src/server-tool-definitions.js` | 1,428 |
| `src/constants/server-tool-definitions-core.js` | 85 |
| `src/constants/server-tool-definitions-read.js` | 199 |
| `src/constants/server-tool-definitions-discovery.js` | 190 |
| `tests/server-tool-definitions.test.js` | 94 |
| `tests/token-export-contract.test.js` | 240 |

## TDD 기록

1. RED: `tests/server-tool-definitions.test.js`에 `buildDiscoveryToolDefinitions()` import와 순서 보존 테스트를 먼저 추가했다.
2. RED 결과: `ERR_MODULE_NOT_FOUND`로 `src/constants/server-tool-definitions-discovery.js`가 없어서 실패했다.
3. GREEN: 새 discovery constants 파일을 추가하고 기존 `buildToolDefinitions()`가 이를 사용하도록 변경했다.
4. 전체 검증 결과: 대상 테스트와 `npm run check:all` 모두 통과했다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `node --test tests/server-tool-definitions.test.js` | 통과: 4 pass |
| `node --check src/server-tool-definitions.js` | 통과 |
| `node --check src/constants/server-tool-definitions-discovery.js` | 통과 |
| `npm run check:all` | 통과: 641 tests, 629 pass, 12 skipped, 0 fail |
| `curl -s --max-time 5 http://127.0.0.1:3846/health` | 통과: `ok=true`, `transportHealth.grade=healthy` |

## 리스크와 판단

- 런타임 command 실행부, route, queue, websocket, polling fallback은 건드리지 않았다.
- `add_annotation`과 `bulk_add_annotations`의 동적 enum은 새 constants 파일에서 기존 `listSupportedAnnotationPropertyTypes()`를 그대로 호출한다.
- 현재 `src/server-tool-definitions.js`는 1,428줄로 여전히 크다. 다음 분리도 정적 schema 묶음부터 진행하는 것이 안전하다.

## 다음 권장 태스크

다음으로는 `src/server-tool-definitions.js`의 text/style/variable/component mutation 계열 schema를 작은 묶음으로 분리하는 것이 좋다. 실제 mutation 실행부는 건드리지 않고 tool definition schema만 이동하면 위험도를 낮게 유지할 수 있다.
