# src 순차 리팩터링 리포트: tool definitions core 분리

작성일: 2026-06-05

## 작업 요약

`src/server-tool-definitions.js`의 가장 앞쪽에 있던 기본/세션/Figma REST tool definition 7개를 `src/constants/server-tool-definitions-core.js`로 분리했다.

이번 작업은 기능 변경 없이 정적 schema 목록만 이동했다. 기존 public API인 `buildToolDefinitions()`는 유지했고, 반환되는 tool 순서도 그대로 유지했다.

## 변경 파일

| 파일 | 변경 내용 |
| --- | --- |
| `package.json` | `npm run check:all` 스크립트를 추가했다. 내용은 `npm run check && npm test`다. |
| `src/constants/server-tool-definitions-core.js` | core tool definition 7개를 반환하는 `buildCoreToolDefinitions()`를 추가했다. |
| `src/server-tool-definitions.js` | core tool definition을 새 constants 모듈에서 가져와 기존 배열 앞에 펼치도록 변경했다. |
| `tests/server-tool-definitions.test.js` | core tool definition 분리 후에도 기존 tool 순서가 유지되는지 검증하는 테스트를 추가했다. |
| `docs/plans/2026-06-05-src-sequential-refactor-plan.md` | 위험도 낮은 파일부터 순차 리팩터링하는 작업계획서를 저장했다. |
| `docs/server-refactor-extracted-files.md` | 새 분리 파일 역할과 검증 기준을 갱신했다. |

## 줄 수 변화

| 파일 | 줄 수 |
| --- | ---: |
| `src/server-tool-definitions.js` | 1,803 |
| `src/constants/server-tool-definitions-core.js` | 85 |
| `tests/server-tool-definitions.test.js` | 44 |

## TDD 기록

1. RED: `tests/server-tool-definitions.test.js`에 `buildCoreToolDefinitions()` import와 순서 보존 테스트를 먼저 추가했다.
2. RED 결과: `ERR_MODULE_NOT_FOUND`로 `src/constants/server-tool-definitions-core.js`가 없어서 실패했다.
3. GREEN: 새 constants 파일을 추가하고 기존 `buildToolDefinitions()`가 이를 사용하도록 변경했다.
4. GREEN 결과: `node --test tests/server-tool-definitions.test.js` 통과.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `node --test tests/server-tool-definitions.test.js` | 통과: 2 pass |
| `node --check src/server-tool-definitions.js` | 통과 |
| `node --check src/constants/server-tool-definitions-core.js` | 통과 |
| `node --check src/server.js` | 통과 |
| `npm run check:all` | 통과: 639 tests, 627 pass, 12 skipped, 0 fail |
| `curl -s --max-time 5 http://127.0.0.1:3846/health` | 통과: `ok=true`, `transportHealth.grade=healthy` |

## 참고

처음 `npm run check:all`을 sandbox 안에서 실행했을 때는 여러 통합 테스트가 `listen EPERM 127.0.0.1`로 실패했다. 같은 명령을 승인된 외부 실행으로 재시도하자 통과했다. 이는 코드 변경 실패가 아니라 로컬 포트 listen 제한 때문이었다.

## 다음 권장 태스크

다음으로는 `src/server-tool-definitions.js`에서 read/detail 계열 tool definition을 별도 constants 파일로 한 묶음 더 분리하는 것이 가장 안전하다. 정적 schema 이동만 수행하면 동작 변경 없이 파일 크기를 계속 줄일 수 있다.
