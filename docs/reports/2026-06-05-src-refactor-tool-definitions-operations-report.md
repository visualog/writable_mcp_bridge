# src 순차 리팩터링 리포트: node operation tool definitions 분리

작성일: 2026-06-05

## 작업 요약

`src/server-tool-definitions.js`에 마지막으로 남아 있던 node operation 계열 tool definition 11개를 `src/constants/server-tool-definitions-operations.js`로 분리했다.

이번 작업은 정적 schema 위치만 바꾸는 리팩터링이다. `buildToolDefinitions()` public API와 반환 순서, 각 tool name/schema는 유지했다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `src/constants/server-tool-definitions-operations.js` | node operation tool definition 11개를 반환하는 `buildOperationToolDefinitions()`를 추가했다. |
| `src/server-tool-definitions.js` | 남은 operation schema 본문을 제거하고 `...buildOperationToolDefinitions()`로 조립하도록 변경했다. |
| `tests/server-tool-definitions.test.js` | operations 분리 후에도 compose 다음 순서가 유지되는지 검증하는 테스트를 추가했다. |
| `docs/server-refactor-extracted-files.md` | 새 operations constants 파일 역할, 현재 분리 묶음, 검증 기준을 갱신했다. |

## 분리된 tool definition

| tool | 쉬운 설명 |
| --- | --- |
| `create_instance` | local component/component set instance 생성 요청 schema. |
| `duplicate_node` | node 복제 요청 schema. |
| `move_node` | node를 다른 parent로 이동하는 요청 schema. |
| `move_section` | section-like container 이동/재정렬 요청 schema. |
| `normalize_spacing` | auto layout gap/padding 정규화 요청 schema. |
| `promote_section` | section을 더 주요 위치로 승격하는 preview/apply 요청 schema. |
| `apply_naming_rule` | subtree naming rule preview/apply 요청 schema. |
| `delete_node` | node 삭제 요청 schema. |
| `reorder_child` | 같은 parent 안에서 child index 재정렬 요청 schema. |
| `boolean_subtract` | subtract boolean operation 생성 요청 schema. |
| `undo_last_batch` | 최근 mutation batch undo 요청 schema. |

## 줄 수 변화

| 파일 | 줄 수 |
| --- | ---: |
| `src/server-tool-definitions.js` | 19 |
| `src/constants/server-tool-definitions-operations.js` | 184 |
| `src/constants/server-tool-definitions-compose.js` | 433 |
| `tests/server-tool-definitions.test.js` | 215 |

## TDD 기록

1. RED: `tests/server-tool-definitions.test.js`에 `buildOperationToolDefinitions()` import와 순서 보존 테스트를 먼저 추가했다.
2. RED 결과: `ERR_MODULE_NOT_FOUND`로 `src/constants/server-tool-definitions-operations.js`가 없어서 실패했다.
3. GREEN: 새 operations constants 파일을 추가하고 기존 `buildToolDefinitions()`가 이를 사용하도록 변경했다.
4. 전체 검증 결과: 대상 테스트와 `npm run check:all` 모두 통과했다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `node --test tests/server-tool-definitions.test.js` | 통과: 8 pass |
| `node --check src/server-tool-definitions.js` | 통과 |
| `node --check src/constants/server-tool-definitions-operations.js` | 통과 |
| `npm run check:all` | 통과: 645 tests, 633 pass, 12 skipped, 0 fail |
| `curl -s --max-time 5 http://127.0.0.1:3846/health` | 통과: `ok=true`, `transportHealth.grade=healthy` |

## 리스크와 판단

- 실제 mutation 실행부, undo state, command dispatch, queue, websocket, polling fallback은 건드리지 않았다.
- `src/server-tool-definitions.js`는 19줄이 되어 tool schema 조립 파일 역할만 남았다.
- tool schema 분리 자체는 완료되었지만 일부 constants 파일은 300줄 이상이므로, 이후에는 별도 기준으로 큰 constants 파일을 재평가할 수 있다.

## 다음 권장 태스크

`src/server-tool-definitions.js` 리팩터링 목표는 완료 상태다. 다음으로는 `src` 안의 다른 500줄 이상 파일 목록을 다시 확인해 위험도 낮은 다음 파일을 고르는 것이 좋다.
