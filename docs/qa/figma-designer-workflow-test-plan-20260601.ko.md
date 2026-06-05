# Xbridge Figma Designer Workflow QA 계획 - 2026-06-01

## 목적

이 문서는 Xbridge를 단순한 Figma 읽기 도구가 아니라, 사용자가 Figma 안에서 디자인 작업을 자연어로 요청했을 때 안정적으로 읽고, 판단하고, 수정하고, 다시 검증하는 작업 보조 에이전트로 검수하기 위한 한국어 실행 계획이다.

검수 범위는 세 축으로 본다.

- 디자이너 작업성: 레이아웃, 레이어 구조, 스타일, 컴포넌트, 반복 편집, 화면 개선, 안전한 실패 처리
- 브리지 안정성: Figma 세션 라우팅, WS/SSE/HTTP fallback, pending queue, timeout, 재연결
- 응답 UX: 한 번에 긴 로그처럼 덤프하지 않고, 현재 Codex 채팅처럼 단계별 메시지와 구조화된 답변으로 보여주는지

## 실행 원칙

1. 실제 Figma 패널에서 시작한다. API만 통과해도 패널 UX가 깨지면 실패다.
2. 모든 write 테스트는 변경 후 `get_node_details` 또는 runtime lifecycle로 readback evidence를 남긴다.
3. 위험한 편집은 자동 실행보다 preview, confirmation, refusal, partial guidance를 우선한다.
4. 여러 Figma 파일이 열려 있으면 반드시 explicit `pluginId`를 사용한다.
5. 데이터가 부족해도 가능한 진단은 먼저 하고, 제한 사항은 마지막에 분리해서 표시한다.
6. 네트워크/속도 검수는 `/health`, `/api/runtime-ops`, streaming validator, soak quick을 같이 본다.

## 공통 기록 양식

| 필드 | 기록 내용 |
| --- | --- |
| Prompt | 사용자가 브리지 입력창에 넣은 자연어 요청 |
| Selection | Figma 파일, 페이지, 선택 노드 id/name/type |
| Expected Figma Change | 실제 캔버스에서 기대하는 변경 |
| Readback Evidence | 변경 후 node detail, runtime lifecycle, screenshot, artifact path |
| Failure Handling | unsupported/locked/hidden/ambiguous 상황에서 기대하는 안전한 실패 |

## 실행 단계

| 단계 | 목적 | 필수 테스트 |
| --- | --- | --- |
| Smoke | 매일 빠른 확인 | health, session, selection read, inspect answer, create/rename/readback/delete |
| Standard | 기능 작업 후 확인 | Smoke + L01-L06, L12-L16, L19, L21-L24, L27-L31 + validator |
| Release | 배포 전 확인 | Standard + RAG01, DS01, L01-L31 전체 + N01-N06 + token/image/component/transport/soak |

## 자동 실행 러너

실제 Figma live session에 대해 다음 명령으로 Designer Workflow fixture를 생성하고 RAG01, DS01, L01-L31, N01-N06을 실행한다. 여러 Figma 파일/탭에서 Xbridge가 동시에 live이면 `XBRIDGE_QA_PLUGIN_ID`를 반드시 명시한다.

```bash
XBRIDGE_QA_PLUGIN_ID="page:..." node scripts/run-figma-designer-workflow-live-qa.mjs
```

러너는 다음 산출물을 남겨야 한다.

- `docs/qa/runs/designer-workflow-*/results.json`
- `docs/qa/runs/designer-workflow-*/captures/before.png`
- `docs/qa/runs/designer-workflow-*/captures/after.png`

`before.png`와 `after.png`는 macOS 화면 전체 캡처가 아니라 Figma node export여야 한다. 다른 앱, 권한 팝업, 브라우저 창이 섞이면 실패로 본다.

RAG01은 `/api/designer/chat` 응답에 `knowledgeReferences`가 포함되고 그중 최소 1개가 `document_chunk`인지 확인한다. 이 케이스가 실패하면 브리지 답변이 내부 QA/RAG 기준을 실제 응답 근거로 남기지 못한 것으로 본다.

안전 실패가 기대되는 케이스는 실패를 성공처럼 숨기지 않는다. `failureHandling`에 “왜 자동 수정하지 않았는지”, “대체 경로가 무엇인지”, “실제 mutation으로 승격하려면 어떤 fixture/API가 필요한지”를 남긴다.

## L. Designer Workflow Editing

### Designer Workflow Coverage Matrix

| 작업 유형 | 케이스 | 검수 의미 |
| --- | --- | --- |
| 레이아웃 편집 | L01-L07 | Auto Layout, padding, gap, alignment, distribution 요청을 자연어로 처리하고 layout/geometry readback으로 검증한다. |
| 레이어 구조 | L08-L12 | group/frame wrapping/ungroup/section 이동/naming 정리를 선택 범위 안에서 수행하거나 안전한 대안을 제시한다. |
| 스타일과 토큰 적용 | L13-L17 | fill, text style, stroke/effect, semantic variable binding, unbind를 token/style 근거가 있을 때만 적용한다. |
| 컴포넌트 작업 | L18-L20 | instance swap, variant/property update, component replacement를 후보 확인과 readback evidence 기반으로 처리한다. |
| 화면 개선 | L21-L23 | hierarchy polish, spacing normalize, redundant layer cleanup처럼 넓은 요청을 scoped action 또는 preview plan으로 바꾼다. |
| 반복/일괄 편집 | L24-L26 | 여러 버튼, 반복 카드, 테이블/리스트 행을 대상별 readback과 함께 일관되게 수정한다. |
| 안전/보호 편집 | L27-L31 | locked, hidden, masked, image, instance override는 무단 변경하지 않고 skip/refusal/confirmation을 남긴다. |

| ID | 영역 | Prompt | Selection | Expected Figma Change | Readback Evidence | Failure Handling |
| --- | --- | --- | --- | --- | --- | --- |
| L01 | Auto Layout | `선택한 카드 묶음을 세로 Auto Layout으로 정리하고 간격을 12로 맞춰줘` | 여러 자식이 있는 frame/group | 부모가 vertical auto layout, gap 12 | `layoutMode=VERTICAL`, `itemSpacing=12`, 자식 순서 유지 | 적용 불가 타입이면 frame wrapping 제안 |
| L02 | 방향 전환 | `이 버튼 그룹을 가로 정렬로 바꾸고 좌우 padding을 맞춰줘` | 버튼 그룹 frame | horizontal layout, padding 정규화 | layout/padding 값 readback | 혼합 선택이면 wrapper 생성 preview |
| L03 | Padding | `선택한 카드 padding을 16으로 통일해줘` | auto-layout card | padding 4방향 16 | paddingLeft/Right/Top/Bottom 확인 | auto layout이 아니면 적용 조건 설명 |
| L04 | Gap | `리스트 행 사이 간격을 8로 통일해줘` | row list | gap 8 또는 y delta 균일 | row geometry sample | absolute layout이면 이동 계획 먼저 제시 |
| L05 | 정렬 | `선택한 요소들의 왼쪽 기준선을 맞춰줘` | 다중 노드 | x 좌표 동일 | 선택 노드별 x readback | 단일 선택이면 추가 선택 안내 |
| L06 | 중앙 정렬 | `아이콘과 텍스트를 세로 중앙 정렬해줘` | icon/text pair | cross-axis center | center y 또는 alignItems 확인 | wrapper 필요 시 confirmation |
| L07 | 균등 분배 | `상단 탭들을 같은 간격으로 배치해줘` | tab nodes | x delta 균일 또는 auto layout spacing | geometry delta 비교 | constraints 충돌 시 제한 표시 |
| L08 | Frame wrapping | `선택한 레이어들을 하나의 프레임으로 묶어줘` | loose layers | 새 frame 생성, bounds 보존 | 새 frame id, child ids | locked/remote child는 skip |
| L09 | Group | `선택한 요소들을 그룹으로 묶어줘` | editable layers | group 또는 frame grouping | parent/children 구조 | group 미지원이면 frame 대안 |
| L10 | Ungroup | `불필요한 그룹을 풀고 레이어를 정리해줘` | group/frame | 자식이 부모로 이동, 시각 drift 없음 | before/after hierarchy | destructive이면 confirmation |
| L11 | Section 이동 | `선택한 컴포넌트를 Component 섹션 아래로 옮겨줘` | component/frame | parent section 변경 | parent id/name | 대상 section이 모호하면 중단 |
| L12 | 네이밍 | `선택한 모바일 화면 레이어 이름을 규칙에 맞게 정리해줘` | screen/frame | layer naming rule 적용 | name list before/after | rule preset 없으면 후보 제시 |
| L13 | Fill token | `선택한 버튼 색상을 primary 토큰으로 바꿔줘` | button/shape | fill token bind 또는 값 매칭 | fill/boundVariable 확인 | token 없으면 closest candidates |
| L14 | Text style | `제목 텍스트에 FDS heading 스타일을 적용해줘` | text node | text style/font 적용 | styleId/fontSize/fontWeight | style lookup 불가 시 제한 분리 |
| L15 | Stroke/effect | `선택한 카드에 기본 border와 shadow 스타일을 적용해줘` | card/frame | stroke/effect 적용 | strokes/effects readback | effect 미지원 시 수동값 안내 |
| L16 | Semantic variable | `이 배경색을 semantic surface 변수에 연결해줘` | shape/frame | semantic variable binding | variable id/key | collection/mode 충돌 설명 |
| L17 | Unbind | `색상 변수 연결을 해제하고 현재 색상은 유지해줘` | bound node | binding 제거, resolved color 유지 | binding 없음 + color 유지 | resolved value 없으면 confirmation |
| L18 | Instance swap | `이 아이콘을 검색 아이콘 인스턴스로 교체해줘` | icon instance | source component 변경 | instance/source readback | 다중 후보면 자동 교체 금지 |
| L19 | Variant | `선택한 버튼을 large / primary / disabled 상태로 바꿔줘` | button instance | variant properties 변경 | componentProperties | property 명칭 불일치 시 매핑 보고 |
| L20 | Component replacement | `직접 그린 버튼을 디자인 시스템 버튼 컴포넌트로 대체해줘` | drawn button layers | component instance로 대체, label 보존 | source component + text | 파괴적이면 backup/confirmation |
| L21 | 화면 계층 | `이 화면의 정보 계층을 더 명확하게 다듬어줘` | screen/frame | title/body/action hierarchy 개선 | typography/position 변화 | 광범위 수정은 preview 먼저 |
| L22 | Spacing normalize | `이 화면 전체 간격을 FDS 기준으로 정리해줘` | screen/frame | 반복 spacing 값 정규화 | spacing sample before/after | absolute nodes 많으면 scoped plan |
| L23 | 중복 정리 | `빈 프레임과 중복 텍스트를 정리해줘` | screen/frame | empty/redundant layer 삭제 또는 표시 | removed/skipped list | non-empty delete는 confirmation |
| L24 | 버튼 일괄 편집 | `선택한 버튼들을 모두 같은 높이와 radius로 맞춰줘` | multiple buttons | height/radius 통일 | 각 버튼 geometry/radius | instance는 supported/unsupported 분리 |
| L25 | 카드 반복 편집 | `카드 리스트의 제목/본문 간격을 모두 같게 맞춰줘` | card list | 카드 내부 spacing 통일 | card별 spacing sample | pattern 약하면 후보만 제시 |
| L26 | Table/list row | `테이블 행 높이를 40으로 통일하고 텍스트를 왼쪽 정렬해줘` | table/list | row height/text align 변경 | row geometry/text align | row 구조 혼합 시 partial report |
| L27 | Locked safety | `선택한 화면 전체를 정리해줘` | locked 포함 frame | editable만 변경 또는 no mutation | locked ids skipped | locked layer 자동 수정 금지 |
| L28 | Hidden safety | `숨겨진 레이어까지 포함해서 정리해줘` | hidden 포함 frame | hidden은 명시 확인 전 skip | hidden list/skipped | 명시 확인 없으면 거부 |
| L29 | Mask/image safety | `이미지 카드들을 같은 크기로 맞춰줘` | masked/image cards | container size 변경, mask/fill 보존 | image fill/mask 상태 | crop/mask 미지원 시 보존 우선 |
| L30 | Instance override safety | `인스턴스 안의 텍스트와 색상을 직접 고쳐줘` | component instance | 지원 override만 적용 | override props readback | detach 필요 시 confirmation |
| L31 | Mask node safety | `마스크로 잘린 이미지 카드까지 포함해서 정리해줘` | mask node 또는 masked image group | 명시 승인 전 mask node geometry/fill은 변경하지 않음 | `isMask` flag와 geometry가 유지됨 | `allowMask` 또는 동등한 확인 없이는 mask node mutation 거부 |

## 네트워크/속도 검수

| ID | 항목 | 기준 |
| --- | --- | --- |
| N01 | `/health` | HTTP 200, 1초 이내, `transportHealth.grade=healthy` |
| N02 | `/api/runtime-ops` | HTTP 200, `pendingTotal=0`, `pendingResultsTotal=0` |
| N03 | streaming-first validator | `npm run validate:streaming-first` 통과 |
| N04 | soak quick | `npm run validate:streaming-first:soak:quick` 2/2 통과 |
| N05 | write smoke latency | create/rename/update/readback/delete 각각 성공, 평균 수백 ms 수준 |
| N06 | multi-session safety | `activeSessionResolution.status=ambiguous`이면 explicit `pluginId` 없이는 mutation 금지 |

## 통과 기준

- L 섹션 31개 케이스가 모두 prompt, selection, expected change, readback evidence, failure handling을 갖는다.
- Smoke는 실제 Figma에서 read/write/readback/delete까지 통과한다.
- Standard는 최소 12개 designer workflow 케이스와 transport validator를 통과한다.
- Release는 `node scripts/run-figma-designer-workflow-live-qa.mjs`에서 RAG01, DS01, L01-L31, N01-N06이 모두 pass이고 비어 있지 않은 readback evidence를 가져야 한다.
- Release 최종 판정은 `node scripts/audit-designer-workflow-release-readiness.mjs`가 생성하는 `docs/qa/release-readiness-latest.md`에서 `Release readiness: PASS`여야 한다.
- 안전 실패를 유도한 뒤에도 recovery write 이후 `commandReadiness=ready`, `writeReadiness=ready`, `pendingTotal=0`, `pendingResultsTotal=0`이어야 한다.
- 실패 시에는 “무엇을 못 읽었는지”보다 “읽은 근거로 어디까지 판단 가능한지”가 먼저 표시된다.
- 보고서에는 문제점, 개선 필요 사항, 비포/애프터 캡처, 명령 검증 결과가 포함된다.
