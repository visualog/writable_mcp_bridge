# Xbridge Designer Workflow QA 결과 보고서 - 2026-06-01 22:05 KST

## 요약

이번 검수는 사용자가 Figma에서 자연어로 디자인 작업을 요청하는 흐름을 기준으로, 브리지 읽기/쓰기, 응답 UX, 네트워크 안정성, pending queue 상태를 함께 확인했다.

결론은 다음과 같다.

- 한국어 테스트 계획을 별도 작성했다: `docs/qa/figma-designer-workflow-test-plan-20260601.ko.md`
- 최신 로컬 `/health` 기준 현재 서버는 정상 응답하지만 active Figma plugin session은 없다: `transport=standby`, `commandReadiness=unavailable`, `writeReadiness=unavailable`, `activeSessionResolution.reason=no_live_session`
- 브리지 재시작 후 `pendingTotal=0`, `pendingResultsTotal=0`, `recentFailedTotal=0`으로 안정화됐다.
- 실제 Figma write smoke는 create/rename/update/readback/delete까지 통과했다.
- 실제 Figma Designer Workflow 러너는 과거 live artifact에서 RAG01, L01-L30, N01-N06까지 통과했고, 최신 release 기준은 RAG01, DS01, L01-L31, N01-N06 전체 readback evidence를 요구하도록 강화됐다.
- 비포/애프터 캡처는 macOS 화면 캡처가 아니라 Figma `export-node` 결과로 저장하도록 개선했다.
- 최신 fresh 검증 기준 `npm test`는 578 tests, 566 pass, 12 skipped, 0 fail이다.
- 기존 문제의 핵심 원인은 긴 읽기/export 요청, validator의 pending queue 정리 타이밍, 그리고 안전 실패 후 write readiness 회복 판정이 느렸던 점으로 좁혀졌다.

## 캡처

### 비포: 작업 전 Figma 패널 상태

![before](/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/qa/captures/xbridge-before-figma-primitive-limited-20260601.png)

### 애프터: 브리지 재시작 및 검증 후 Figma 패널 상태

![after](/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/qa/captures/xbridge-after-figma-panel-20260601.png)

참고: 현재 턴에서 로컬 파일로 확보한 비포 캡처는 “문제 발생 직전 원본”이 아니라, 기존 히스토리가 남아 있는 Figma 패널 상태를 다시 찍은 것이다. 사용자가 대화에 첨부한 이전 Appshot이 실제 최초 문제 장면이며, 로컬 파일 경로로는 접근할 수 없었다.

### 실제 러너 비포: Figma fixture export

![runner before](/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/qa/runs/designer-workflow-2026-06-01T14-16-01-300Z/captures/before.png)

### 실제 러너 애프터: L01-L30 실행 후 fixture export

![runner after](/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/qa/runs/designer-workflow-2026-06-01T14-16-01-300Z/captures/after.png)

참고: 러너 애프터 이미지는 실제 제품 화면 품질 평가용 산출물이 아니라, 동일 fixture에 레이아웃/정렬/반복 편집/안전 실패 케이스를 연속 적용한 mutation 증거다. 따라서 화면이 가로로 길게 늘어난 것은 L02, L06, L07, L22의 Auto Layout/분배 테스트가 누적된 결과다.

## 적용한 개선

| 구분 | 내용 |
| --- | --- |
| 테스트 계획 | 실제 디자이너 작업을 L01-L31로 분리하고 prompt, selection, expected change, readback evidence, failure handling 필드를 강제 |
| 런타임 안정성 | HTTP client disconnect 시 pending command를 abandon 처리할 수 있는 서버-side cleanup hook 추가 |
| 런타임 관측성 | queue observability에 `clientAbortedCommandTotal`, `clientAbortedCommandByType` 추가 |
| 응답 안정성 | `jsonResponse`가 이미 닫힌 response에 쓰지 않도록 guard 추가 |
| 테스트 보강 | async predicate를 기다릴 수 있도록 `waitForCondition` 개선 |
| 실제 workflow runner | RAG01, DS01, L01-L31, N01-N06을 Figma fixture/DS evidence/readiness 기준으로 자동 실행하는 `scripts/run-figma-designer-workflow-live-qa.mjs` 추가 |
| 캡처 안정성 | `screencapture` 오염을 피하기 위해 fixture node를 `/api/export-node`로 PNG 저장 |
| readiness 회복 | 안전 실패 이후 정상 write가 성공하면 `writeReadiness`가 ready로 회복되도록 서버 판정 수정 |
| RAG 보강 | pipeline snapshot에 로컬 지식 검색 `retrieval.results`를 포함해 Buddy식 응답/QA/안전 실패/transport 기준을 Codex에 전달 |

## 실제 Figma 검증 결과

| 항목 | 결과 | 증거 |
| --- | --- | --- |
| Health | 통과 | HTTP 200, `transportHealth.grade=healthy`, `commandReadiness=ready`, `writeReadiness=ready` |
| Runtime queue | 통과 | `pendingTotal=0`, `pendingResultsTotal=0`, `recentFailedTotal=0` |
| Multi-session safety | 주의 필요 | live session 3개로 `activeSessionResolution.status=ambiguous`, explicit `pluginId` 필요 |
| Selection read | 통과 | `page:33276:16484`, 선택 노드 `33392:3972000`, `npay_asset_08 2`, `RECTANGLE` |
| Write smoke | 통과 | create -> rename -> update -> readback -> delete |
| Readback | 통과 | 생성 노드 `33423:454365`, readback name `QA Designer Workflow Smoke 20260601 renamed`, type `FRAME` |
| Designer Workflow Runner | 과거 live artifact 통과, 최신 release 기준은 fail 처리 | `designer-workflow-2026-06-01T23-13-19-373Z`는 기존 32/32 pass였지만 최신 summary gate 재요약 시 `DS01`/`L31` missing으로 release fail |
| Runner 대상 | 통과 | pluginId `page:33276:16484`, rootNodeId `33437:454494`, createdNodeCount 14 |
| Runner 캡처 | 통과 | before export 147ms, after export 193ms |
| Safety failure recovery | 통과 | L11 등 안전 실패 후 recovery write 성공, `writeReadiness=ready` |
| Group/Ungroup fallback | 통과 | L09 wrapper frame 생성 + childCount 2 readback, L10 자식 이동 + wrapper 삭제 readback |

## 속도 및 네트워크 증거

| 항목 | 측정값 |
| --- | --- |
| `/health` | 약 6.7ms, HTTP 200 |
| `/api/runtime-ops` | 약 2.6ms, HTTP 200 |
| selection read | 26ms |
| create node | 141ms |
| rename node | 143ms |
| update node | 78ms |
| readback detail | 11ms |
| delete node | 8ms |
| runner before export-node | 147ms |
| runner after export-node | 193ms |
| runner recovery write | 7ms |
| runner final health | 5ms, `commandReadiness=ready`, `writeReadiness=ready` |
| runner final runtime | 3ms, `pendingTotal=0`, `pendingResultsTotal=0`, `recentFailedTotal=0` |
| WS dispatch success rate | 1.0 |
| fallback rate | 0 |

## 자동 검증

| 명령 | 결과 |
| --- | --- |
| `node --check src/server.js` | 통과 |
| `node --test tests/session-state-heartbeat-preflight.test.js` | 38 pass, 0 fail |
| `npm run validate:streaming-first` | 통과, duration 1815ms, transport healthy, command/write ready |
| `npm run validate:streaming-first:soak:quick` | 2/2 통과, 평균 1880ms |
| `npm test` | 최신 fresh run 기준 578 tests, 566 pass, 12 skipped, 0 fail |
| `node scripts/run-figma-designer-workflow-live-qa.mjs` | 현재 active plugin session이 없어 `no_live_session` readiness artifact 생성 |

## RAG 기반 개선

이번 추가 개선에서 `src/designer-knowledge-rag.js`를 추가했다. 브리지는 사용자 요청, intent, target type, read command, context hint를 query로 만들어 다음 지식 조각을 검색한다.

- Buddy식 evidence-first 응답 계약
- Bridge -> Codex -> Figma pipeline 구조
- Designer Workflow QA 매트릭스
- 브리지 콘솔/채팅 응답 표시 UX
- streaming-first transport와 queue safety
- Figma `documentAccess: dynamic-page` 제약
- 이미지 기반 화면 재구성 품질 게이트
- 디자인 시스템 registry/component/token 지식

검색 결과는 `buildDesignerPipelineSnapshot`의 `retrieval` 필드로 Codex CLI에 전달된다. Codex prompt도 `pipeline.retrieval.results`를 로컬 RAG 지식으로 사용해 QA 기준, 진행 UX, 안전 실패 기준을 보강하도록 수정했다.

검증:

- `tests/designer-knowledge-rag.test.js`에서 콘솔 UX 요청과 디자인 편집 요청이 올바른 지식 조각을 검색하는지 확인
- `tests/ai-designer-server-contract.test.js`에서 pipeline snapshot에 retrieval 결과가 포함되는지 확인
- `tests/codex-cli-runner.test.js`와 fixture에서 Codex prompt에 RAG instruction과 retrieval payload가 들어가는지 확인

## 발견한 문제점

### 1. 여러 Figma 세션이 동시에 열리면 기본 세션 추론이 위험하다

심각도: 높음

현재 `Agent_skill_test`, `FDS v2.0 -테스트용`, `FDS_Inspector`가 동시에 live session으로 잡힌다. health가 `requiresExplicitPluginId=true`를 정상 표시하므로 서버 진단은 맞지만, UI/CLI 요청이 `default`로 흘러가면 잘못된 파일에 쓰기 작업이 갈 수 있다.

개선 필요:

- 모든 mutation API와 AI designer 실행 경로에서 현재 패널의 pluginId를 강제 전달
- ambiguous 상태에서 pluginId가 없으면 write는 거부
- 응답 UI에 “현재 대상 파일/페이지/선택 노드”를 항상 표시

### 2. 이전 장기 요청 실패가 사용자가 보기에는 “오락가락”처럼 보인다

심각도: 높음

이전 검수에서 `/api/designer/read-context`, `/api/export-design-tokens`가 client timeout을 만들었고, 그 뒤 validator가 `pending queue item`을 보고 실패했다. 재시작 후 현재 상태는 깨끗하지만, 장기 요청이 실패했을 때 사용자가 이해할 수 있는 상태 메시지와 cleanup contract가 더 명확해야 한다.

개선 필요:

- 긴 작업은 즉시 job acknowledgement를 주고 진행률을 streaming
- client disconnect, timeout, partial artifact를 서로 다른 상태로 표시
- abandoned/unclaimed 결과를 active pending queue와 분리

### 3. 비포 캡처 자동 수집 체계가 없었다

심각도: 중간

이번 턴에서 로컬 before 캡처를 나중에 확보하면서 최초 문제 장면과 완전히 동일한 파일 캡처를 남기지 못했다. 사용자가 요구한 “비포/애프터” 품질을 자동으로 만족하려면 테스트 실행기가 요청 직전과 직후를 항상 찍어야 한다.

개선 필요:

- QA runner에서 `before.png`, `after.png`, `runtime-before.json`, `runtime-after.json`을 자동 저장
- Figma 전면 전환 실패나 Codex 창 캡처 오염을 감지
- 캡처 파일명을 test id와 timestamp로 고정

진행 상태:

- 화면 전체 `screencapture` 방식은 실제로 Chrome 권한 팝업과 다른 앱이 섞여 오염되는 문제가 확인됐다.
- 이번 개선에서 runner 캡처를 `/api/export-node` 기반 PNG로 바꿨고, 최신 실행의 before/after는 fixture 노드만 포함한다.

### 4. 안전 실패 후 write readiness가 바로 회복되지 않았다

심각도: 높음

초기 runner의 L15, L16처럼 의도적으로 잘못된 style/variable 요청을 보내 안전 실패를 검증하면 서버 health가 `writeReadiness=degraded`로 남았다. 이후 정상 rename write가 성공해도 기존 로직은 “최근 write 실패가 있었다”만 보고 degraded를 유지했다.

개선 내용:

- 최근 write 실패 이후 더 늦은 시점의 정상 write 성공이 있으면 `recentWriteFailureRecovered=true`로 표시
- 이 경우 `writeReadiness`를 `ready`로 복구
- 회귀 테스트 `write readiness recovers after a successful write follows a command failure` 추가
- 실제 Figma runner에서 안전 실패 후 recovery write를 수행했고 최종 `writeReadiness=ready` 확인

### 5. 일부 Designer Workflow는 아직 기능 미지원 또는 fixture 의존으로 남아 있다

심각도: 중간

실제 파일의 변수/컬렉션 후보가 필요한 L16 semantic variable binding까지 token export 기반 후보 선택과 `fills.color` binding readback으로 승격했다. 이번 runner는 지원 제한을 성공으로 위장하지 않고, 가능한 작업은 실제 mutation/readback으로 바꾸는 방향으로 정리했다. L09 group, L10 ungroup은 native API가 없어도 frame wrapping fallback과 unwrap fallback으로 실제 mutation/readback 검증까지 승격했고, L15 border/shadow는 manual visual style fallback으로, L16 variable binding은 token export 후보 선택 + bound variable readback으로, L19 variant mapping은 전용 component set fixture를 생성해 실제 variant property mutation/readback 검증으로, L27 locked safety는 locked fixture mutation 차단과 readback으로, L28 hidden safety는 hidden fixture mutation 차단과 readback으로, L29 image card resize는 image fill 보존 readback으로, L30 instance override는 지원 가능한 component property 경로로, L31 mask safety는 `isMask` fixture mutation 차단/readback 경로로 승격했다.

개선 필요:

- group/ungroup native API가 추가되기 전까지 frame wrapping/unwrap fallback 정책 유지 및 회귀 검증
- style lookup은 `documentAccess: dynamic-page` 환경에서 async style API 사용
- L16은 token export에서 usable semantic color variable 후보를 고른 뒤 `fills.color` binding과 bound variable readback까지 연결했으며, 라이브 canvas artifact 갱신만 남아 있다.
- variant/component set fixture를 L19 회귀 게이트로 유지한다. 실제 DS component set 대상은 DS01 release 체크로 분리해 `XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=1`일 때 후보 검색 실패를 release 실패로 처리한다.
- hidden fixture는 L28로 runner에 추가했으며, plugin heartbeat가 복구되면 live artifact를 갱신한다.
- mask fixture는 L31로 runner에 추가했으며, plugin heartbeat가 복구되면 live artifact를 갱신한다.

## 남은 리스크

- L01-L30 전체를 실제 Figma runner로 수행한 과거 artifact가 있고, runner 기준 L09/L10은 frame fallback mutation, L15는 manual border/shadow fallback, L16은 token export 기반 variable binding, L19는 component set fixture 기반 variant mutation/readback, L27은 locked mutation 차단, L29는 image fill 보존 resize, L30은 component property 기반 instance override mutation/readback으로 승격했다.
- L31 mask fixture는 runner/계약에 추가했지만, 현재 active plugin session이 없어 실제 Figma artifact 갱신은 아직 대기 중이다.
- real DS component set mutation은 아직 live artifact가 없지만, DS01 release 체크를 runner에 추가해 실제 파일의 component/component set 후보 검색 근거를 별도 gate로 남기도록 했다.
- `npm test` 전체는 최종 패스에서 통과했다. 다만 skipped 12개는 legacy provider 계약이 Codex-first 경로로 대체되어 의도적으로 제외된 상태다.

## 2026-06-01 14:32 추가 검증

RAG와 응답 표시 경로를 보강한 뒤 최신 상태에서 다시 검증했다.

- RAG: 정적 요약만 쓰던 구조에서 allowlist 문서 chunk 검색을 함께 사용하도록 변경했다.
- 응답 번들: `knowledgeReferences`를 추가해 어떤 내부 기준 문서를 참조했는지 남긴다.
- 브리지 UI: assistant 답변에 `참조한 기준` 섹션과 필터를 추가했다.
- 서버: 일반 designer chat과 generated screen follow-up 모두 pipeline retrieval 결과를 번들에 연결한다.

검증 결과:

- `node --test tests/designer-knowledge-rag.test.js tests/ai-designer-server-contract.test.js tests/ui-designer-contract.test.js`: 34 pass
- `node --test tests/codex-cli-runner.test.js tests/ai-designer-chat-api.integration.test.js`: 74 pass, 12 skipped
- `node --check src/server.js`: pass
- `/health`: `ok=true`, `transport=healthy`, `commandReadiness=ready`, `writeReadiness=ready`, `activeSessionResolution=ambiguous`
- `npm test`: 과거 run 기준 561 tests, 549 pass, 12 skipped, 0 fail
- live Designer Workflow runner: `docs/qa/runs/designer-workflow-2026-06-01T14-32-30-336Z/results.json`, 31/31 pass
- latest live artifacts:
  - `docs/qa/runs/designer-workflow-2026-06-01T14-32-30-336Z/captures/before.png`
  - `docs/qa/runs/designer-workflow-2026-06-01T14-32-30-336Z/captures/after.png`

## 2026-06-01 14:41 추가 검증

RAG 전용 live assertion을 runner에 추가하고, ambiguous session 안전장치를 보강한 뒤 명시 pluginId로 다시 실행했다.

- Runner 변경:
  - `RAG01` 추가: `/api/designer/chat` 응답의 `knowledgeReferences` 확인
  - `document_chunk` 참조가 최소 1개 이상 없으면 실패
  - 실패 케이스가 있으면 `process.exitCode=1`
  - 여러 live session이 있으면 `XBRIDGE_QA_PLUGIN_ID` 없이는 mutation 시작 전 중단
- 실행 명령:
  - `XBRIDGE_QA_PLUGIN_ID="page:33276:16484" node scripts/run-figma-designer-workflow-live-qa.mjs`
- 결과:
  - `docs/qa/runs/designer-workflow-2026-06-01T14-41-52-326Z/results.json`
  - 32/32 pass
  - `RAG01` knowledgeReferenceCount: 4
  - health after: `transport=healthy`, `commandReadiness=ready`, `writeReadiness=ready`, `pendingTotal=0`, `pendingResultsTotal=0`

## 2026-06-02 UI 렌더링 보강

브리지 답변이 긴 텍스트 덩어리처럼 보이거나 섹션 표시가 오락가락하는 문제를 막기 위해, UI 소스 존재 여부만 보는 정적 테스트에서 한 단계 더 나아가 실제 assistant renderer 함수를 실행하는 계약 테스트를 추가했다.

- 추가 테스트:
  - `formatDesignerAssistantReply -> buildDesignerAssistantBlocks -> buildDesignerResponseFilterbar -> renderDesignerAssistantBlock` 흐름을 실제 샘플 bundle로 실행한다.
  - `근거`, `개선이 필요한 부분`, `요약 우선순위`, `다음 액션`, `참조한 기준`, `판단 제한`이 각각 chat card/filter section으로 분리되는지 확인한다.
  - RAG `knowledgeReferences`가 `designer-assistant-card-knowledge`와 `참조` 필터로 렌더링되는지 확인한다.
- 수정한 표시 버그:
  - RAG 설명 문장 안의 `근거`, `다음 액션` 같은 일반 단어를 섹션 제목으로 오인하던 과한 파싱을 완화했다.
  - 내부 section key인 `issue`, `action`을 다시 정규화할 때 `summary`로 떨어져 카드 class가 깨지던 문제를 수정했다.
- 검증:
  - `node --test tests/ui-designer-contract.test.js`: 26 pass
  - `npm test`: 563 tests, 551 pass, 12 skipped, 0 fail
  - `/health`: `ok=true`, `transport=healthy`, `commandReadiness=ready`, `writeReadiness=ready`, `activeSessionResolution=ambiguous`

## 2026-06-02 Assistant UI 스냅샷 검증

실제 Figma iframe 직접 DOM 검증 전 단계로, 브리지 UI의 동일 `ui.html` 렌더러 함수와 CSS를 사용해 assistant 답변 HTML/DOM/screenshot artifact를 생성하는 하네스를 추가했다.

- 명령:
  - `npm run qa:assistant-ui-snapshot`
- 생성 artifact:
  - `docs/qa/runs/assistant-response-ui-2026-06-01T22-52-09-558Z/assistant-response.html`
  - `docs/qa/runs/assistant-response-ui-2026-06-01T22-52-09-558Z/assistant-response.png`
  - `docs/qa/runs/assistant-response-ui-2026-06-01T22-52-09-558Z/snapshot.json`
- 검증 내용:
  - `summary`, `evidence`, `issue`, `priority`, `action`, `knowledge`, `limitation` 섹션이 모두 존재한다.
  - `designer-assistant-card-knowledge`, `designer-assistant-card-issue`, `designer-assistant-card-action`이 실제 HTML로 렌더링된다.
  - `참조` 필터가 렌더링된다.
  - RAG reference 문장 안의 `근거`, `다음 액션` 같은 단어가 가짜 섹션으로 쪼개지지 않는다.
  - Chrome headless screenshot 기준 760x1100 PNG가 생성됐고, 시각 확인상 카드/필터가 분리되어 보인다.

## 2026-06-02 L09/L10 실제 mutation 승격

Designer Workflow runner에서 기존에 safe limitation으로 처리하던 group/ungroup 계열 케이스 중 L09/L10을 실제 Figma mutation/readback 케이스로 승격했다.

- 실행 명령:
  - `XBRIDGE_QA_PLUGIN_ID="page:33276:16484" node scripts/run-figma-designer-workflow-live-qa.mjs`
- 결과:
  - `docs/qa/runs/designer-workflow-2026-06-01T22-57-15-951Z/results.json`
  - 32/32 pass
  - `pendingTotal=0`, `pendingResultsTotal=0`, `recentFailedTotal=0`
- L09:
  - action: `frame wrapping fallback mutation`
  - `button-group-wrapper` frame 생성
  - `button-a`, `button-b`를 wrapper로 이동
  - readback: wrapper `type=FRAME`, `childCount=2`
- L10:
  - action: `move_node + delete_node unwrap fallback`
  - wrapper 안의 버튼을 root로 되돌림
  - wrapper 삭제
  - readback: wrapper는 `Target node not found`, 버튼 2개는 정상 readback
- 의미:
  - native group/ungroup API가 없어도 사용자가 “묶어줘/풀어줘”라고 요청했을 때 가능한 안전한 대체 편집 경로를 검증했다.
- 회귀 검증:
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/ui-designer-contract.test.js`: 26 pass

## 2026-06-02 L19 variant mutation 승격

Designer Workflow runner에서 기존에 “variant 축/값이 맞지 않으면 안전 실패”만 확인하던 L19를 실제 component set 기반 mutation/readback 케이스로 승격했다.

- 변경 내용:
  - `variant-source-state-default`, `variant-source-state-disabled` fixture를 각각 component로 승격
  - 두 component를 `QA/Button` component set으로 결합
  - 대상 variant에 `Size=Large`, `Tone=Primary`, `State=Default`를 적용
  - `/api/get-component-variant-details`로 component set을 다시 읽고 대상 variant의 `variantProperties.Size === "Large"`를 검증
- 최신 실행:
  - `docs/qa/runs/designer-workflow-2026-06-01T23-13-19-373Z/results.json`
  - 32/32 pass
  - createdNodeCount: 20
  - L19 component set: `33438:454579`
  - L19 target variant: `33438:454577`
  - readback: `State=Default, Size=Large, Tone=Primary`, `variantProperties.Size=Large`
- 의미:
  - 사용자가 “버튼 상태/크기/톤을 바꿔줘”라고 요청했을 때 단순 실패 처리만 보는 것이 아니라, 실제 Figma variant 편집 경로를 검증한다.
  - 아직 실제 FDS 라이브러리 component set 매핑까지는 아니지만, Xbridge의 component set 생성, variant 변경, readback 계약이 하나의 QA 케이스로 연결됐다.

## 2026-06-02 L30 component property override 승격

Designer Workflow runner에서 기존에 “지원되지 않는 instance override는 안전 실패”로만 처리하던 L30을 지원 가능한 component property 변경 경로로 승격했다.

- 변경 내용:
  - L18에서 생성한 local component에 `Label` TEXT component property를 추가
  - Figma가 실제로 생성한 property key를 `/api/list-component-properties`로 readback
  - `Label#...` key를 사용해 `/api/set-component-properties`로 instance property 값을 변경
  - 변경 후 다시 `/api/list-component-properties`로 `Updated label` 값을 검증
- 최신 실행:
  - `docs/qa/runs/designer-workflow-2026-06-01T23-13-19-373Z/results.json`
  - 32/32 pass
  - L30 configurable instance: `33438:454580`
  - L30 property key: `Label#33438:2`
  - readback: `updatedProperty.value=Updated label`
- 의미:
  - 사용자가 “인스턴스 안의 텍스트를 고쳐줘”라고 요청했을 때 무조건 실패시키지 않고, component property로 노출된 안전한 편집면은 실제로 수정한다.
  - 인스턴스 내부 레이어 직접 수정/분리처럼 파괴적일 수 있는 작업은 여전히 confirmation 대상이며, 자동 mutation 범위에서 제외한다.
- 회귀 검증:
  - `npm test`: full-suite 부하에서 streaming soak가 1회성 timeout fail을 반복 재현
  - 원인: 기능 실패가 아니라 SSE/WS/selection 관측 창이 full-suite 부하 대비 좁았음
  - 조치: concurrent/moderate/extended soak integration test의 관측 timeout을 `sse=2200ms`, `ws=3500ms`, `selection=3200ms` 기준으로 조정
  - `node --test tests/streaming-first-soak.integration.test.js`: 4 pass
  - `npm test`: 563 tests, 551 pass, 12 skipped, 0 fail

## 2026-06-02 L15 border/shadow fallback mutation 구현

Designer Workflow runner에서 기존에 “effect style id가 없으면 안전 실패”만 확인하던 L15를 실제 manual visual style mutation 경로로 확장했다.

- 변경 내용:
  - `/api/update-node`가 `strokeColor`, `strokeWeight`, `dropShadow` payload를 plugin으로 전달한다.
  - Figma plugin `updateSceneNode`가 수동 stroke와 `DROP_SHADOW` effect를 실제 노드에 적용한다.
  - `get-node-details` readback snapshot에 `strokeWeight`, `strokes`, `effects`를 포함해 적용 여부를 확인할 수 있게 했다.
  - L15 runner는 먼저 invalid effect style id가 안전하게 실패하는지 확인한 뒤, 수동 border/shadow fallback을 적용하고 readback으로 검증한다.
- L15 기대 동작:
  - style id/key가 없다는 사실은 숨기지 않고 실패 근거로 유지한다.
  - 사용자가 요청한 “기본 border와 shadow”는 명시 수동값 fallback으로 적용한다.
  - readback에서 `strokeWeight=1`, `strokes[0].hex=D0D7E2`, `effects[].type=DROP_SHADOW`, `effects[].color.hex=0F172A`를 확인한다.
- 로컬 검증:
  - `node --check figma-plugin/code.js`: pass
  - `node --check src/server.js`: pass
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/ui-designer-contract.test.js`: 27 pass
  - `node --test tests/streaming-first-soak.integration.test.js`: 4 pass
  - `npm test`: 564 tests, 552 pass, 12 skipped, 0 fail
- 라이브 재검증 상태:
  - `/health`: `ok=true`, `serverVersion=0.5.65`, `activePluginCount=0`, `commandReadiness=unavailable`, `writeReadiness=unavailable`
  - `/api/sessions?includeStale=true`: 기존 3개 세션은 모두 stale 상태
  - 따라서 이번 L15 코드는 로컬/계약 검증까지 완료했고, 실제 Figma canvas mutation은 plugin panel heartbeat가 다시 살아난 뒤 `XBRIDGE_QA_PLUGIN_ID="page:33276:16484" node scripts/run-figma-designer-workflow-live-qa.mjs`로 재실행해야 한다.

## 2026-06-02 L29 image fill 보존 resize 구현

Designer Workflow runner에서 기존에 “image/mask fixture가 없으면 지원 제한을 보고한다”로 처리하던 L29를 이미지 카드 전용 fixture 기반 mutation/readback 케이스로 승격했다.

- 변경 내용:
  - runner가 `image-card-a`, `image-card-b` RECTANGLE fixture를 생성하고 `imageDataBase64`와 `imageScaleMode=FILL`로 실제 image fill을 적용한다.
  - `get-node-details` readback snapshot에 `fills`의 `type`, `imageHash`, `scaleMode`가 포함되도록 plugin snapshot을 확장했다.
  - L29 runner가 `/api/bulk-update-nodes`로 두 이미지 카드의 크기를 `160 x 96`으로 맞춘 뒤 readback에서 geometry와 image fill 보존 여부를 검증한다.
- L29 기대 동작:
  - 사용자가 “이미지 카드들을 같은 크기로 맞춰줘”라고 요청하면 이미지 crop/mask 자체를 임의 변경하지 않고 컨테이너 크기만 맞춘다.
  - readback에서 두 카드의 `geometry.width=160`, `geometry.height=96`을 확인한다.
  - readback에서 `fills[].type=IMAGE`, 기존 `imageHash` 유지, `scaleMode=FILL` 유지를 확인한다.
- 로컬 검증:
  - `node --check figma-plugin/code.js`: pass
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/ui-designer-contract.test.js`: 27 pass
  - `npm test`: 564 tests, 552 pass, 12 skipped, 0 fail
- 라이브 재검증 상태:
  - `/health`: `ok=true`, `serverVersion=0.5.65`, `activePluginCount=0`, `commandReadiness=unavailable`, `writeReadiness=unavailable`
  - `/api/sessions?includeStale=true`: 기존 3개 세션은 모두 stale 상태
  - 현재 active plugin session이 없어 실제 Figma canvas mutation artifact는 아직 갱신하지 못했다.
  - plugin heartbeat가 active로 복구되면 L15/L29가 포함된 live workflow runner를 재실행해야 한다.

## 2026-06-02 L16 semantic variable binding 구현

Designer Workflow runner에서 기존에 “존재하지 않는 variable id는 실패해야 한다”로 처리하던 L16을 실제 token export 기반 variable binding/readback 케이스로 승격했다.

- 변경 내용:
  - runner가 `/api/export-design-tokens`를 호출하고 반환된 artifact `filePath`를 읽어 현재 파일의 COLOR variable 후보를 고른다.
  - 후보 선택은 `semantic`, `surface`, `background`, `container`, `theme` 같은 이름/컬렉션 힌트를 우선하고, 후보가 없으면 임의 바인딩 대신 실패로 남긴다.
  - `/api/bind-variable`에 `property="fills.color"`와 실제 `variableId`를 전달한다.
  - `get-node-details` readback snapshot에 `boundVariables`를 포함해 `fills`가 같은 variable id에 묶였는지 검증한다.
- L16 기대 동작:
  - 사용자가 “이 배경색을 semantic surface 변수에 연결해줘”라고 요청하면 먼저 현재 파일의 token artifact에서 쓸 수 있는 semantic/surface COLOR variable을 찾는다.
  - 후보가 있으면 `fills.color`에 바인딩하고, readback에서 `boundVariables.fills[].variableId`가 후보 variable id와 같은지 확인한다.
  - 후보가 없으면 임의 변수/색상으로 대체하지 않고 후보 부족을 보고한다.
- 로컬 검증:
  - `node --check figma-plugin/code.js`: pass
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/ui-designer-contract.test.js`: 27 pass
  - `node --test tests/bind-variable.test.js`: 6 pass
  - `node --test tests/token-export-contract.test.js`: 19 pass
  - `npm test`: 564 tests, 552 pass, 12 skipped, 0 fail
- 라이브 재검증 상태:
  - `/health`: `ok=true`, `serverVersion=0.5.65`, `activePluginCount=0`, `commandReadiness=unavailable`, `writeReadiness=unavailable`
  - `/api/sessions?includeStale=true`: `sessions=[]`, 기존 stale sessions는 prune 완료
  - 현재 active plugin session이 없어 실제 Figma canvas mutation artifact는 아직 갱신하지 못했다.
  - plugin heartbeat가 active로 복구되면 L15/L16/L29가 포함된 live workflow runner를 재실행해야 한다.

## 2026-06-02 L27 locked safety 구현

Designer Workflow runner에서 기존에 “locked 상태 API가 없으면 지원 제한”으로 처리하던 L27을 실제 locked fixture 기반 안전 차단/readback 케이스로 승격했다.

- 변경 내용:
  - Figma plugin node snapshot에 `locked` 상태를 포함했다.
  - `/api/update-node`와 `/api/preview-changes`가 `locked`, `allowLocked` payload를 plugin으로 전달한다.
  - `updateSceneNode`는 대상 노드가 `locked=true`이고 `allowLocked=true`가 없으면 mutation을 거부한다.
  - runner가 `locked-safety-target` fixture를 만들고 `locked=true`로 설정한 뒤, 명시 허용 없는 resize mutation이 실패하는지 검증한다.
- L27 기대 동작:
  - 사용자가 “선택한 화면 전체를 정리해줘”처럼 광범위 작업을 요청해도 locked node는 자동 수정하지 않는다.
  - readback에서 `locked=true`, 기존 `geometry.width=72`, `geometry.height=72`가 보존되는지 확인한다.
  - locked node 변경이 필요하면 skipped/blocked로 보고하고 명시 확인을 요구해야 한다.
- 로컬 검증:
  - `node --check figma-plugin/code.js`: pass
  - `node --check src/server.js`: pass
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/ui-designer-contract.test.js`: 27 pass
  - `npm test`: 564 tests, 552 pass, 12 skipped, 0 fail
- 라이브 재검증 상태:
  - 현재 active plugin session이 없어 실제 Figma canvas mutation artifact는 아직 갱신하지 못했다.
  - plugin heartbeat가 active로 복구되면 L15/L16/L27/L28/L29/L31이 포함된 live workflow runner를 재실행해야 한다.

## 2026-06-02 L28 hidden safety 구현

Designer Workflow runner에서 기존에 “숨김 상태만 확인”하던 L28을 실제 hidden fixture 기반 안전 차단/readback 케이스로 승격했다.

- 변경 내용:
  - Figma plugin update preview와 실제 update 경로가 `visible=false` 대상 노드를 `allowHidden=true` 없이 수정하지 못하도록 차단한다.
  - `/api/update-node`, `/api/preview-changes`, MCP `update_node` 경로가 `allowHidden` payload를 plugin으로 전달한다.
  - runner가 `hidden-safety-target` fixture를 `visible=false`로 만든 뒤, 명시 허용 없는 resize/fill mutation이 실패하는지 검증한다.
- L28 기대 동작:
  - 사용자가 “숨겨진 레이어까지 포함해서 정리해줘”처럼 범위가 넓은 요청을 하더라도 hidden node는 자동 수정하지 않는다.
  - readback에서 `visible=false`, 기존 `geometry.width=72`, `geometry.height=72`가 보존되는지 확인한다.
  - hidden node 변경이 필요하면 skipped/blocked로 보고하고 명시 확인을 요구해야 한다.
- 로컬 검증:
  - `node --check figma-plugin/code.js`: pass
  - `node --check src/server.js`: pass
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/ui-designer-contract.test.js`: 27 pass
  - `node --test tests/create-node.test.js tests/ui-designer-contract.test.js`: 35 pass
  - `npm test`: 564 tests, 552 pass, 12 skipped, 0 fail
- 라이브 재검증 상태:
  - `/health`: `ok=true`, `serverVersion=0.5.65`, `transportHealth.grade=standby`, `activePluginCount=0`, `commandReadiness=unavailable`, `writeReadiness=unavailable`
  - `/api/sessions?includeStale=true`: `sessions=[]`
  - 현재 active plugin session이 없어 실제 Figma canvas mutation artifact는 아직 갱신하지 못했다.
  - plugin heartbeat가 active로 복구되면 L15/L16/L27/L28/L29/L31이 포함된 live workflow runner를 재실행해야 한다.

## 2026-06-02 L31 mask safety 구현

Designer Workflow runner에서 별도 fixture가 부족하다고 남아 있던 mask safety를 `isMask` 기반 차단/readback 케이스로 승격했다.

- 변경 내용:
  - Figma plugin node snapshot과 preview state에 `isMask` 상태를 포함했다.
  - `/api/update-node`, `/api/preview-changes`, MCP `update_node` 경로가 `isMask`, `allowMask` payload를 plugin으로 전달한다.
  - `updateSceneNode`와 update preview는 대상 노드가 `isMask=true`이고 `allowMask=true`가 없으면 mutation을 거부한다.
  - runner가 `mask-safety-target` fixture를 만들고 `isMask=true`로 설정한 뒤, 명시 허용 없는 resize/fill mutation이 실패하는지 검증한다.
- L31 기대 동작:
  - 사용자가 “마스크로 잘린 이미지 카드까지 포함해서 정리해줘”라고 요청해도 mask node는 자동 수정하지 않는다.
  - readback에서 `isMask=true`, 기존 `geometry.width=88`, `geometry.height=88`이 보존되는지 확인한다.
  - mask 변경이 필요하면 skipped/blocked로 보고하고 명시 확인을 요구해야 한다.
- 로컬 검증:
  - `node --check figma-plugin/code.js`: pass
  - `node --check src/server.js`: pass
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/create-node.test.js tests/ui-designer-contract.test.js`: 35 pass
  - `node --test tests/streaming-first-validation.integration.test.js`: 2 pass
  - `node --test tests/streaming-first-soak.integration.test.js`: 4 pass
  - `npm test`: 564 tests, 552 pass, 12 skipped, 0 fail
- 라이브 재검증 상태:
  - 현재 active plugin session이 없어 실제 Figma canvas mutation artifact는 아직 갱신하지 못했다.
  - plugin heartbeat가 active로 복구되면 L15/L16/L27/L28/L29/L31이 포함된 live workflow runner를 재실행해야 한다.

## 2026-06-02 DS01 release component evidence gate 추가

Designer Workflow runner에 실제 디자인 시스템 컴포넌트 후보를 검색하는 release 전용 체크를 추가했다. 이 체크는 특정 요청별 분석기가 아니라, 브리지가 “사용자 요청 → Figma/DS 데이터 읽기 → 근거 기반 응답/제약 보고” 파이프라인을 수행할 수 있는지 검증하는 release gate다.

- 변경 내용:
  - `scripts/run-figma-designer-workflow-live-qa.mjs`에 `DS01 Design System Component Evidence` 케이스를 추가했다.
  - `XBRIDGE_QA_DS_FILE_KEY` 또는 active session의 `fileKey`와 `FIGMA_ACCESS_TOKEN`이 있으면 `/api/search-file-components`로 실제 file component 후보를 검색한다.
  - 기본 실행에서는 fileKey/token이 없을 때 `skip` evidence로 남기고, `XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=1`이면 missing credential 또는 후보 없음이 release 실패가 된다.
  - summary에 `skipTotal`을 추가해 release 필수 검증과 일반 smoke 검증을 구분한다.
- DS01 기대 동작:
  - 실제 DS 파일에서 button/component set 후보의 `key`, `nodeId`, `name`, `containingFrame`을 evidence로 남긴다.
  - 후보가 없으면 임의 대체나 variant mutation을 하지 않고, 파일키/토큰/쿼리 범위 문제를 명시한다.
  - release 검수에서는 이 케이스가 pass되지 않으면 “Buddy 수준의 DS 근거 기반 컴포넌트 분석”이 검증됐다고 보지 않는다.
- 로컬 검증:
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/ui-designer-contract.test.js`: pass 대상
- 라이브 재검증 상태:
  - 현재 active plugin session이 없어 실제 DS01 live artifact는 아직 갱신하지 못했다.
  - plugin heartbeat와 `FIGMA_ACCESS_TOKEN`, `XBRIDGE_QA_DS_FILE_KEY`가 준비되면 `XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=1 node scripts/run-figma-designer-workflow-live-qa.mjs`로 release gate를 실행한다.

## 2026-06-02 Designer Workflow summary gate 추가

기존 live runner의 `results.json`은 개별 케이스 pass/fail을 담지만, release 관점의 필수 evidence 누락을 사람이 직접 해석해야 했다. 이 때문에 “전체 pass처럼 보이지만 release 필수 근거가 빠진 상태”를 자동으로 드러내는 요약기를 추가했다.

- 변경 내용:
  - `scripts/summarize-designer-workflow-qa.mjs`를 추가했다.
  - 입력 `results.json`에서 pass/skip/fail, health/readiness, pending queue, capture 경로, required evidence를 Markdown으로 요약한다.
  - `--require-release-gates` 옵션을 켜면 `RAG01`, `DS01`이 missing/skip/fail일 때 exit code 1로 실패한다.
  - summary에 `Required Evidence` 테이블을 넣어 RAG, DS, safety, network 케이스의 증거를 한눈에 볼 수 있게 했다.
  - live runner가 종료될 때 `summary.md`를 자동 생성하고 stdout에 `summaryPath`와 `qaSummary`를 포함한다.
- 검증:
  - `node --test tests/designer-workflow-qa-summary.test.js`: 2 pass
  - `node --test tests/ui-designer-contract.test.js`: summary 자동 생성 계약 포함 pass
  - 기존 live artifact `docs/qa/runs/designer-workflow-2026-06-01T23-13-19-373Z/results.json`에 적용한 결과 `summary.md`가 생성됐고, `Release-required case DS01 is missing`으로 release verdict가 fail 처리됐다.
- 의미:
  - 이제 “runner 케이스가 모두 pass”라는 좁은 판정과 “Buddy 수준의 근거 기반 release gate 통과”를 분리할 수 있다.
  - live Figma 재실행 후에는 runner가 자동 생성한 `summary.md`까지 pass여야 release pass로 본다.

## 2026-06-02 live readiness artifact 추가

현재처럼 Figma 안의 Xbridge plugin session이 active가 아니면 live workflow runner는 canvas mutation/readback을 수행할 수 없다. 이전에는 이 상태가 `No live pluginId available` 스택트레이스로만 보일 수 있어, 사용자는 테스트가 왜 중단됐는지 QA 산출물로 확인하기 어려웠다.

- 변경 내용:
  - `src/designer-workflow-readiness-report.js`를 추가했다.
  - live runner가 pluginId를 찾지 못하거나 여러 live session 중 명시 선택이 필요하면 `live-readiness.json`과 `live-readiness.md`를 run directory에 저장한다.
  - readiness 리포트에는 `/health` 응답 기준 serverVersion, transport, command/read readiness, `activeSessionResolution`, `livePluginIds`, next action을 포함한다.
  - 이 산출물은 pass가 아니라 blocked-run evidence로 취급한다.
- 실제 확인:
  - 현재 `/health`: `transport=standby`, `commandReadiness=unavailable`, `writeReadiness=unavailable`, `activeSessionResolution.reason=no_live_session`
  - 현재 `/api/sessions?includeStale=true`: `sessions=[]`
  - 실행 artifact: `docs/qa/runs/designer-workflow-2026-06-02T04-12-39-827Z/live-readiness.json`
  - Markdown artifact: `docs/qa/runs/designer-workflow-2026-06-02T04-12-39-827Z/live-readiness.md`
- 검증:
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs`: pass
  - `node --test tests/designer-workflow-readiness-report.test.js tests/ui-designer-contract.test.js tests/designer-workflow-qa-summary.test.js`: 31 pass

## 2026-06-02 Designer Workflow QA 계획 커버리지 가드 추가

Designer Workflow 테스트 계획이 L01-L31로 넓어졌지만, 문서 기반 계획은 이후 편집 과정에서 케이스나 필드가 빠져도 쉽게 눈치채기 어렵다. 이를 막기 위해 QA 계획 문서 자체를 회귀 테스트 대상으로 묶었다.

- 변경 내용:
  - `tests/figma-bridge-diverse-test-plan.test.js`를 추가했다.
  - `docs/qa/figma-bridge-diverse-test-plan-20260601.md`의 `L. Designer Workflow Editing` 표가 L01-L31 전체를 유지하는지 검사한다.
  - 각 케이스가 `Prompt`, `Selection`, `Expected Figma Change`, `Readback Evidence`, `Failure Handling` 필드를 비우지 않는지 검사한다.
  - Auto Layout/spacing, layer structure, style/token, component/variant, screen polish, repeated edit, locked/hidden/mask/image/instance safety 범주가 모두 남아 있는지 검사한다.
  - release gate인 DS01, `summary.md`, `live-readiness.json/md`, `XBRIDGE_QA_PLUGIN_ID`가 계획에 유지되는지 검사한다.
- 검증:
  - `node --test tests/figma-bridge-diverse-test-plan.test.js`: 2 pass
  - `node --test tests/figma-bridge-diverse-test-plan.test.js tests/designer-knowledge-rag.test.js tests/designer-workflow-readiness-report.test.js tests/designer-workflow-qa-summary.test.js tests/ui-designer-contract.test.js`: 37 pass

## 2026-06-02 Designer Workflow runner/plan 동기화 보강

추가 점검 중 실제 live runner에는 `L31 Mask Safety`가 있었지만 QA 계획 문서는 `L01-L30`으로만 release gate를 설명하고 있었다. 이 상태에서는 실행 러너가 더 넓은 검수를 하고 있어도 문서상 release 기준과 어긋나며, 이후 편집 중 특정 케이스가 누락되어도 쉽게 놓칠 수 있다.

- 변경 내용:
  - QA 계획의 release gate와 실행 순서를 `L01-L31` 기준으로 갱신했다.
  - `L31 Mask node safety`를 별도 Designer Workflow 케이스로 추가했다.
  - `tests/figma-bridge-diverse-test-plan.test.js`에 live runner source를 읽어 `RAG01`, `DS01`, `L01-L31`, `N01-N06`가 모두 존재하는지 확인하는 동기화 테스트를 추가했다.
  - runner가 `buildDesignerWorkflowReadinessReport`, `live-readiness.json`, `summarize-designer-workflow-qa.mjs`를 계속 포함하는지도 같은 테스트에서 확인한다.
- 검증:
  - `node --test tests/figma-bridge-diverse-test-plan.test.js`: 3 pass

## 2026-06-02 release summary gate 전체 L 케이스 검수 강화

기존 `summary.md` release gate는 `RAG01`, `DS01` 중심으로 release 필수 근거를 확인했다. 이 상태에서는 Designer Workflow matrix가 문서상 넓어져도, 실제 `results.json`에서 `L01-L31` 중 일부가 빠진 경우를 release failure로 잡지 못할 수 있었다.

- 변경 내용:
  - `scripts/summarize-designer-workflow-qa.mjs`가 release mode에서 `RAG01`, `DS01`, `L01-L31`, `N01-N06` 전체를 필수 케이스로 검사하도록 강화했다.
  - `Required Evidence` 표도 `L01-L31` 전체를 표시하도록 바꿔, 사람이 summary만 봐도 어떤 Designer Workflow 케이스가 빠졌는지 확인할 수 있게 했다.
  - `tests/designer-workflow-qa-summary.test.js`에 `L31` 누락 시 release gate가 실패해야 한다는 회귀 테스트를 추가했다.
- 검증:
  - `node --test tests/designer-workflow-qa-summary.test.js`: 3 pass
  - `node --test tests/figma-bridge-diverse-test-plan.test.js tests/designer-workflow-qa-summary.test.js tests/designer-workflow-readiness-report.test.js tests/designer-knowledge-rag.test.js tests/ui-designer-contract.test.js`: 39 pass
  - 기존 artifact `docs/qa/runs/designer-workflow-2026-06-01T23-13-19-373Z/results.json` 재요약 결과 release verdict는 `DS01` missing, `L31` missing으로 fail 처리됐다.

## 2026-06-02 release summary evidence 필수화

release gate가 `L01-L31` 전체 존재 여부를 확인하더라도, 각 케이스가 `pass` 라벨만 있고 실제 readback/evidence가 비어 있으면 “테스트를 잘 완수했다”는 근거가 부족하다. 따라서 release-required 케이스는 `pass`뿐 아니라 비어 있지 않은 `readbackEvidence`도 요구하도록 강화했다.

- 변경 내용:
  - `scripts/summarize-designer-workflow-qa.mjs`에 `hasReadbackEvidence` 검사를 추가했다.
  - release mode에서 `RAG01`, `DS01`, `L01-L31`, `N01-N06` 중 어떤 케이스든 `readbackEvidence`가 비어 있으면 release finding으로 기록한다.
  - `tests/designer-workflow-qa-summary.test.js`에 `L12`가 pass지만 evidence가 비어 있을 때 fail해야 한다는 회귀 테스트를 추가했다.
- 검증:
  - `node --test tests/designer-workflow-qa-summary.test.js`: 4 pass
  - `node --test tests/figma-bridge-diverse-test-plan.test.js tests/designer-workflow-qa-summary.test.js tests/designer-workflow-readiness-report.test.js tests/designer-knowledge-rag.test.js tests/ui-designer-contract.test.js`: 40 pass

## 2026-06-02 streaming validation 안정화

full-suite 부하에서 reconnect/validation 테스트가 간헐적으로 흔들린 원인을 같이 정리했다.

- 변경 내용:
  - extended reconnect soak는 full-suite 부하에서 SSE/WS 관측 창이 짧아 1/12 transient failure가 발생할 수 있어 extended 케이스의 timeout을 넓혔다.
  - soak failure가 발생하면 실패 iteration의 `healthOk`, `runtimeOpsOk`, `parityOk`, `sseOk`, `wsOk`, `failures`를 stderr에 출력하도록 진단을 강화했다.
  - streaming-first validation parity는 `health.activePlugins.length` 대신 `health.activeSessionResolution.livePluginIds` 기준으로 live session count를 비교하도록 수정했다. `activePlugins`에는 최근 등록/스트리밍 흔적이 섞일 수 있어 runtime live session 수와 직접 비교하면 거짓 실패가 날 수 있다.
  - validation 마지막 단계에서 `/api/runtime-ops`만 갱신하고 `/health`는 이전 스냅샷을 유지하던 문제를 수정했다. active window가 짧은 테스트에서 외부 live session이 stale로 빠지면 health/runtime count가 서로 다른 시점 기준이 되어 거짓 실패가 발생할 수 있었다.
- 검증:
  - `node --test tests/streaming-first-validation.integration.test.js`: 2 pass
  - `node --test tests/streaming-first-soak.integration.test.js`: 4 pass
  - `npm test`: 최신 fresh run 기준 578 tests, 566 pass, 12 skipped, 0 fail

## 2026-06-02 현재 상태 재검수

목표 달성 여부를 현재 상태 기준으로 다시 감사했다. 결론은 “offline/계약/요약 gate는 강화됐지만, active Figma plugin session이 없어 release live verdict는 아직 pass가 아니다”이다.

- 현재 `/health`:
  - `serverVersion=0.5.65`
  - `transport=standby`
  - `commandReadiness=unavailable`
  - `writeReadiness=unavailable`
  - `activeSessionResolution.reason=no_live_session`
- 현재 `/api/sessions?includeStale=true`:
  - `sessions=[]`
- 최신 live runner readiness artifact:
  - `docs/qa/runs/designer-workflow-2026-06-02T04-42-49-942Z/live-readiness.json`
  - `docs/qa/runs/designer-workflow-2026-06-02T04-42-49-942Z/live-readiness.md`
- 최신 자동 검증:
  - `node --test tests/figma-bridge-diverse-test-plan.test.js tests/designer-workflow-qa-summary.test.js tests/designer-workflow-readiness-report.test.js tests/designer-knowledge-rag.test.js tests/ui-designer-contract.test.js tests/streaming-first-validation.integration.test.js`: 42 pass
  - `npm test`: 578 tests, 566 pass, 12 skipped, 0 fail
  - `node --check scripts/run-figma-designer-workflow-live-qa.mjs && node --check scripts/summarize-designer-workflow-qa.mjs && node --check src/designer-workflow-readiness-report.js && node --check scripts/validate-streaming-first.mjs`: pass
- 최신 문서/게이트 정합성:
  - 한국어 Designer Workflow 계획도 L01-L31, DS01, RAG01, N01-N06 release 기준으로 갱신했다.
  - release summary는 RAG01, DS01, L01-L31, N01-N06 전체가 pass이고 비어 있지 않은 readbackEvidence를 가져야 pass한다.

## 2026-06-02 release readiness audit 추가

개별 runner 결과, readiness artifact, 응답 UI/RAG/회귀 테스트 증거가 서로 다른 파일에 흩어져 있으면 사용자가 “지금 release 가능한 상태인가?”를 직접 해석해야 한다. 이를 줄이기 위해 최종 release readiness 감사 스크립트를 추가했다.

- 변경 내용:
  - `src/designer-workflow-release-audit.js`를 추가해 bridge health, live Figma session, Designer Workflow release cases, assistant response UX, RAG evidence, regression test evidence를 하나의 gate로 평가한다.
  - `scripts/audit-designer-workflow-release-readiness.mjs`를 추가해 `/health`, `/api/sessions`, 최신 `results.json`, 최신 `live-readiness.json`을 읽고 `docs/qa/release-readiness-latest.json/md`를 생성한다.
  - `package.json`에 `npm run qa:release-readiness`를 추가했다.
  - QA 계획 문서와 한국어 실행 계획에 이 audit이 최종 release 판정임을 명시했다.
- 현재 실행 결과:
  - `npm run qa:release-readiness`: `status=blocked`, `reason=no_live_session`
  - JSON artifact: `docs/qa/release-readiness-latest.json`
  - Markdown artifact: `docs/qa/release-readiness-latest.md`
  - 현재 missing release cases: `DS01`, `L31`
  - regression gate: `npm test: 578 tests, 566 pass, 12 skipped, 0 fail`
  - assistant response UX gate: pass
  - live RAG evidence gate: current runtime이 `no_live_session`이므로 missing
- 검증:
  - `node --test tests/designer-workflow-release-audit.test.js tests/figma-bridge-diverse-test-plan.test.js tests/designer-workflow-qa-summary.test.js tests/designer-workflow-readiness-report.test.js`: 14 pass
  - `node --check scripts/audit-designer-workflow-release-readiness.mjs && node --check src/designer-workflow-release-audit.js`: pass

## 다음 실행 기준

1. Release 검수 전에는 DS01을 `XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=1`로 실행해 실제 DS component/component set 후보 근거를 갱신한다.
2. plugin heartbeat가 active로 복구되면 RAG01, DS01, L01-L31, N01-N06 전체 live workflow runner를 다시 실행해 canvas readback artifact를 갱신하고, `summarize-designer-workflow-qa.mjs --require-release-gates`로 summary verdict까지 갱신한다.
3. reconnect soak는 full-suite 부하를 반영한 timeout 기준을 유지하고, 이후에도 실패하면 실패 iteration의 `summary.failures`를 더 자세히 출력하도록 계측한다.
4. token export, image reconstruction, component instance, hidden/mask safety는 별도 fixture로 분리한다. hidden safety는 L28, mask safety는 L31에 들어갔고, 실제 DS component 후보 검색은 DS01 release gate로 분리했다.
5. 실제 Figma 플러그인 패널 screenshot/DOM 레벨에서 `참조한 기준` 섹션이 보이는지 검증한다. 현재는 동일 `ui.html` 기반 renderer/HTML/Chrome screenshot artifact까지 통과했다.
6. full `npm test`, streaming validator, live workflow runner, Designer Workflow `summary.md` release verdict가 모두 통과해야 release pass로 본다.
