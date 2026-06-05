# Xbridge RAG 기반 Buddy 추월 개선 로드맵

## 목적

Xbridge가 Buddy와 같거나 더 나은 Figma 플러그인이 되려면, 단순히 답변 형식을 흉내 내는 수준을 넘어 사용자의 요청마다 적절한 제품 지식, QA 기준, Figma 제약, 안전 실패 규칙을 자동으로 가져와야 한다. 이를 위해 Bridge -> Codex pipeline에 로컬 RAG 지식 검색 결과를 포함한다.

## 현재 적용

`src/designer-knowledge-rag.js`에 로컬 지식 검색기를 추가했다. 초기 정적 요약 코퍼스에 더해, 현재는 allowlist 문서를 heading/paragraph 단위 chunk로 읽어 `pipeline.retrieval.results`에 함께 넣는다.

현재 검색 대상은 다음 범주다.

- Buddy식 evidence-first 응답 계약
- Bridge -> Codex -> Figma pipeline 구조
- Designer Workflow QA 매트릭스
- 브리지 콘솔/채팅 응답 표시 UX
- streaming-first transport와 queue safety
- Figma `documentAccess: dynamic-page` 제약
- 이미지 기반 화면 재구성 품질 게이트
- 디자인 시스템 registry/component/token 지식

`buildDesignerPipelineSnapshot`은 사용자 요청, intent, target type, read command, context hint를 query로 묶고 관련 지식 조각을 `pipeline.retrieval`에 넣는다. Codex CLI prompt는 이 검색 결과를 로컬 RAG 지식으로 사용해 QA 기준과 진행 UX, 안전 실패 기준을 보강하도록 지시한다.

응답 번들은 `knowledgeReferences`를 포함한다. 브리지 UI는 이를 assistant 답변의 `참조한 기준` 섹션으로 렌더링해 사용자가 “어떤 내부 기준/문서가 분석에 영향을 줬는지”를 확인할 수 있다.

## Buddy 대비 개선 방향

Buddy의 강점은 자연어 요청을 “작업 세션”으로 보여주는 UX다. Xbridge는 여기에 다음 장점을 추가할 수 있다.

- 로컬 브리지의 실제 command/readback 증거
- RAG로 검색된 내부 QA/운영 지식
- Figma 공식 제약에 맞춘 async/dynamic-page 처리
- 실패를 숨기지 않는 safety contract
- before/after export artifact와 runtime queue 증거

즉 Buddy처럼 그럴듯하게 답하는 것이 아니라, “무엇을 읽었고 어떤 내부 기준으로 판단했는지”를 사용자가 추적할 수 있게 만든다.

## 다음 단계

1. 완료: 정적 코퍼스를 실제 문서 chunk 인덱스로 확장했다.
2. 진행 중: docs와 DS registry 문서는 같은 retrieval interface로 묶였다. QA run result와 token snapshot은 다음 단계에서 동적 evidence source로 승격한다.
3. 진행 중: 서버 응답 번들에 `knowledgeReferences`를 추가했다. Codex structured output의 `usedKnowledgeIds`는 아직 미적용이다.
4. 완료: 브리지 UI에 `참조한 기준` assistant 섹션과 필터를 추가했다.
5. 완료: live runner에 `RAG01`을 추가해 `/api/designer/chat` 응답의 `knowledgeReferences`와 `document_chunk` 참조를 실제 Figma 세션에서 검증한다.

## QA 기준

- 분석/수정/생성 요청의 pipeline snapshot에 `retrieval.results`가 포함된다.
- 응답은 검색된 기준을 맹목적으로 복붙하지 않고, 현재 Figma evidence와 결합한다.
- 데이터가 없을 때도 가능한 진단과 판단 제한을 분리한다.
- RAG 결과가 없는 경우에도 기존 deterministic evidence-first 응답은 유지된다.

## 2026-06-01 적용 증거

- `node --test tests/designer-knowledge-rag.test.js tests/ai-designer-server-contract.test.js tests/ui-designer-contract.test.js`: 34 pass
- `node --test tests/codex-cli-runner.test.js tests/ai-designer-chat-api.integration.test.js`: 74 pass, 12 skipped
- `npm test`: 561 tests, 549 pass, 12 skipped, 0 fail
- live Designer Workflow runner with explicit pluginId: `docs/qa/runs/designer-workflow-2026-06-01T14-41-52-326Z/results.json`, 32/32 pass
