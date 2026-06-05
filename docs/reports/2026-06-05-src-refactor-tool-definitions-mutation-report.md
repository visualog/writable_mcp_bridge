# src 순차 리팩터링 리포트: text/style/variable/component mutation tool definitions 분리

작성일: 2026-06-05

## 작업 요약

`src/server-tool-definitions.js`에 남아 있던 text/style/variable/component mutation 계열 tool definition 11개를 `src/constants/server-tool-definitions-mutation.js`로 분리했다.

이번 작업은 정적 schema 위치만 바꾸는 리팩터링이다. `buildToolDefinitions()` public API와 반환 순서, 각 tool name/schema는 유지했다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `src/constants/server-tool-definitions-mutation.js` | mutation tool definition 11개를 반환하는 `buildMutationToolDefinitions()`를 추가했다. |
| `src/server-tool-definitions.js` | mutation schema 본문을 제거하고 `...buildMutationToolDefinitions()`로 조립하도록 변경했다. |
| `tests/server-tool-definitions.test.js` | mutation 분리 후에도 discovery 다음 순서가 유지되는지 검증하는 테스트를 추가했다. |
| `docs/server-refactor-extracted-files.md` | 새 mutation constants 파일 역할, 현재 집중 파일, 다음 후보, 검증 기준을 갱신했다. |

## 분리된 tool definition

| tool | 쉬운 설명 |
| --- | --- |
| `update_text` | 단일 text node 문구 변경 요청 schema. |
| `set_component_property` | instance component property 하나를 설정하는 요청 schema. |
| `set_component_properties` | instance component property 여러 개를 한 번에 설정하는 요청 schema. |
| `add_component_property` | local component/component set에 property를 추가하는 요청 schema. |
| `edit_component_property` | local component property 이름이나 기본값을 수정하는 요청 schema. |
| `set_variant_properties` | component set 안의 variant property 값을 설정하는 요청 schema. |
| `bind_variable` | 노드 property에 variable을 bind/unbind하는 요청 schema. |
| `bulk_bind_variables` | 여러 variable bind/unbind를 한 번에 보내는 요청 schema. |
| `apply_style` | 공유 style을 적용하거나 해제하는 요청 schema. |
| `create_component` | 기존 노드를 local component로 승격하는 요청 schema. |
| `create_component_set` | local component들을 component set으로 묶는 요청 schema. |

## 줄 수 변화

| 파일 | 줄 수 |
| --- | ---: |
| `src/server-tool-definitions.js` | 1,207 |
| `src/constants/server-tool-definitions-core.js` | 85 |
| `src/constants/server-tool-definitions-read.js` | 199 |
| `src/constants/server-tool-definitions-discovery.js` | 190 |
| `src/constants/server-tool-definitions-mutation.js` | 228 |
| `tests/server-tool-definitions.test.js` | 122 |

## TDD 기록

1. RED: `tests/server-tool-definitions.test.js`에 `buildMutationToolDefinitions()` import와 순서 보존 테스트를 먼저 추가했다.
2. RED 결과: `ERR_MODULE_NOT_FOUND`로 `src/constants/server-tool-definitions-mutation.js`가 없어서 실패했다.
3. GREEN: 새 mutation constants 파일을 추가하고 기존 `buildToolDefinitions()`가 이를 사용하도록 변경했다.
4. 전체 검증 결과: 대상 테스트와 `npm run check:all` 모두 통과했다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `node --test tests/server-tool-definitions.test.js` | 통과: 5 pass |
| `node --check src/server-tool-definitions.js` | 통과 |
| `node --check src/constants/server-tool-definitions-mutation.js` | 통과 |
| `npm run check:all` | 통과: 642 tests, 630 pass, 12 skipped, 0 fail |
| `curl -s --max-time 5 http://127.0.0.1:3846/health` | 통과: `ok=true`, `transportHealth.grade=healthy` |

## 리스크와 판단

- 실제 Figma mutation 실행부, dispatch, write queue, websocket, polling fallback은 건드리지 않았다.
- `add_component_property`, `bind_variable`, `bulk_bind_variables`, `apply_style`, `create_component`의 동적 enum은 새 constants 파일에서 기존 helper를 그대로 호출한다.
- `src/server-tool-definitions.js`는 1,207줄로 줄었지만 여전히 500줄 이상이다. 다음에도 정적 schema 묶음 단위로 진행하는 것이 안전하다.

## 다음 권장 태스크

다음으로는 `preview_changes`부터 `reuse_or_create_component`까지의 node/import/update 계열 tool definition을 `src/constants/server-tool-definitions-node.js` 같은 constants 파일로 분리하는 것이 좋다.
