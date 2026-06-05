# src 순차 리팩터링 작업계획서

작성일: 2026-06-05

## 목표

`src` 폴더에서 500줄 이상인 파일을 위험도가 낮은 순서로 1개씩 작게 분리한다. 기능 변경, public API 변경, 스타일 변경은 하지 않는다. 각 태스크는 완료 후 검증 결과와 다음 작업을 남긴다.

## 공통 규칙

- 한 번에 1개 파일만 리팩터링한다.
- 분리 단위는 `components`, `hooks`, `utils`, `constants` 중 현재 Node 서버 구조에 맞는 `utils` 또는 `constants`를 우선 사용한다.
- 기존 public export와 라우트, tool name, schema, 응답 shape는 유지한다.
- 새 파일은 기존 파일의 순수 데이터 또는 순수 helper만 옮긴다.
- 수정 후 `npm run check:all`을 실행한다.
- `check:all`이 없으면 첫 태스크에서 `npm run check && npm test`를 묶는 스크립트만 추가한다.
- 실패하면 원인을 기록하고 최소 수정으로 통과시킨다.
- 태스크마다 `docs/reports/`와 `docs/handoff/`에 한국어 문서를 저장한다.

## 우선순위

| 순서 | 대상 파일 | 현재 줄 수 | 위험도 | 이유 | 첫 분리 계획 |
|---:|---|---:|---|---|---|
| 1 | `src/server-tool-definitions.js` | 1,882 | 낮음 | 정적 tool schema 목록 중심이며 런타임 상태 의존이 작다. | core/session/REST tool 정의를 `src/constants/`로 분리한다. |
| 2 | `src/build-layout.js` | 2,074 | 낮음-중간 | 대부분 순수 layout helper 확장 로직이다. | helper type별 확장 함수를 `src/utils/`로 분리한다. |
| 3 | `src/ai-designer-intents.js` | 780 | 낮음-중간 | 키워드/intent 추론 규칙과 envelope 조립이 섞여 있다. | keyword tables를 `src/constants/`로 분리한다. |
| 4 | `src/ai-designer-suggestions-v2.js` | 786 | 중간 | 리포트/추천/액션 후보 생성이 섞여 있다. | audit report builder를 `src/utils/`로 분리한다. |
| 5 | `src/ai-designer-context.js` | 969 | 중간 | context model 생성과 execution 결과 정규화가 섞여 있다. | execution normalizer를 `src/utils/`로 분리한다. |
| 6 | `src/server-transport-state.js` | 1,624 | 중간 | 상태 진단, readiness, lifecycle store가 한 파일에 있다. | queue diagnostics 또는 readiness helper를 1개씩 분리한다. |
| 7 | `src/ai-designer-api.js` | 1,691 | 중간 | provider 설정, 번역 fallback, 응답 파서가 혼재한다. | provider constants와 local rewrite parser를 순차 분리한다. |
| 8 | `src/codex-cli-runner.js` | 3,145 | 중간-높음 | Codex 실행, image layout prompt, quality 검증이 깊게 연결되어 있다. | image layout constants부터 분리한다. |
| 9 | `src/server-command-dispatch.js` | 904 | 중간-높음 | command dispatch와 timeout policy가 결합되어 있다. | timeout policy만 먼저 `src/utils/`로 분리한다. |
| 10 | `src/server-designer-routes.js` | 657 | 중간-높음 | route handler가 dependency injection과 긴 분기문에 묶여 있다. | route별 handler 함수 1개씩 분리한다. |
| 11 | `src/designer-workflow-release-audit.js` | 509 | 중간 | evaluator와 markdown formatter가 섞여 있다. | markdown formatter를 `src/utils/`로 분리한다. |
| 12 | `src/server.js` | 12,651 | 높음 | API, 상태관리, 큐, WS/SSE, Designer workflow가 모두 남아 있다. | 이미 진행 중인 방식대로 queue/runtime helper를 1개씩 분리한다. |

## 태스크 1 상세 계획

대상: `src/server-tool-definitions.js`

1. `tests/server-tool-definitions.test.js`에 core tool definition 분리 모듈 테스트를 추가한다.
2. RED: 새 constants 모듈이 없어서 실패하는지 확인한다.
3. `src/constants/server-tool-definitions-core.js`를 추가해 core/session/REST tool 정의만 옮긴다.
4. `src/server-tool-definitions.js`는 새 constants 배열을 앞에 펼쳐 기존 순서와 결과를 유지한다.
5. `package.json`에 `check:all`을 추가한다.
6. `node --test tests/server-tool-definitions.test.js`, `npm run check:all`, `/health`를 확인한다.
7. 한국어 리포트와 핸드오프를 저장한다.

## 완료 기준

- `npm run check:all` 통과
- 기존 `buildToolDefinitions()` 반환 tool name/order/schema 유지
- 새 파일 역할이 리포트/핸드오프에 기록됨
- 다음 태스크가 명확히 남음
