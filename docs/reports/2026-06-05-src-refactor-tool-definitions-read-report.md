# src 순차 리팩터링 리포트: read/detail tool definitions 분리

작성일: 2026-06-05

## 작업 요약

`src/server-tool-definitions.js`에 남아 있던 read/detail 계열 tool definition 11개를 `src/constants/server-tool-definitions-read.js`로 분리했다.

이번 작업은 정적 schema 위치만 바꾸는 리팩터링이다. `buildToolDefinitions()` public API와 반환 순서, 각 tool name/schema는 유지했다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `src/constants/server-tool-definitions-read.js` | read/detail tool definition 11개를 반환하는 `buildReadToolDefinitions()`를 추가했다. |
| `src/server-tool-definitions.js` | read/detail schema 본문을 제거하고 `...buildReadToolDefinitions()`로 조립하도록 변경했다. |
| `tests/server-tool-definitions.test.js` | read/detail 분리 후에도 core 다음 순서가 유지되는지 검증하는 테스트를 추가했다. |
| `tests/token-export-contract.test.js` | `pageId` schema 계약 검사를 새 read constants 파일을 대상으로 하도록 최소 수정했다. |
| `docs/server-refactor-extracted-files.md` | 새 read constants 파일 역할과 검증 기준을 갱신했다. |

## 줄 수 변화

| 파일 | 줄 수 |
| --- | ---: |
| `src/server-tool-definitions.js` | 1,611 |
| `src/constants/server-tool-definitions-core.js` | 85 |
| `src/constants/server-tool-definitions-read.js` | 199 |
| `tests/server-tool-definitions.test.js` | 69 |
| `tests/token-export-contract.test.js` | 240 |

## TDD 기록

1. RED: `tests/server-tool-definitions.test.js`에 `buildReadToolDefinitions()` import와 순서 보존 테스트를 먼저 추가했다.
2. RED 결과: `ERR_MODULE_NOT_FOUND`로 `src/constants/server-tool-definitions-read.js`가 없어서 실패했다.
3. GREEN: 새 read constants 파일을 추가하고 기존 `buildToolDefinitions()`가 이를 사용하도록 변경했다.
4. 첫 `check:all` 실패: `tests/token-export-contract.test.js`가 `src/server-tool-definitions.js` 본문에 read schema가 직접 있다고 가정해 실패했다.
5. 최소 수정: 해당 계약 테스트가 새 `src/constants/server-tool-definitions-read.js`를 검사하도록 변경했다.
6. GREEN 결과: 대상 테스트와 전체 `npm run check:all` 통과.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `node --test tests/server-tool-definitions.test.js` | 통과: 3 pass |
| `node --test tests/token-export-contract.test.js` | 통과: 19 pass |
| `node --check src/server-tool-definitions.js` | 통과 |
| `node --check src/constants/server-tool-definitions-core.js` | 통과 |
| `node --check src/constants/server-tool-definitions-read.js` | 통과 |
| `npm run check:all` | 통과: 640 tests, 628 pass, 12 skipped, 0 fail |
| `curl -s --max-time 5 http://127.0.0.1:3846/health` | 통과: `ok=true`, `transportHealth.grade=healthy` |

## 리스크와 판단

- 런타임 command 실행부는 건드리지 않았다.
- `export_node`의 `format.enum`은 새 constants 파일에서 기존 `listSupportedExportFormats()`를 그대로 호출한다.
- 기존 계약 테스트가 source location에 강하게 묶여 있었으므로, 앞으로 tool definition 분리 시 관련 source-inspection 테스트를 함께 갱신해야 한다.

## 다음 권장 태스크

다음으로는 `src/server-tool-definitions.js`의 annotation/design-system/search/replay 계열 schema를 작은 묶음으로 분리하는 것이 좋다. 아직 정적 schema 이동만으로 파일 크기를 줄일 수 있어 위험도가 낮다.
