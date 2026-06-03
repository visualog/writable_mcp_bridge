# Buddy 운영 모델 역설계 계약

이 문서는 Buddy를 그대로 복제하기 위한 문서가 아니라, 관찰 가능한 동작을 Xbridge에서 재현 가능한 계약으로 나눈 것입니다. 구현자는 이 계약을 기준으로 intent, read, audit, report, progress UX를 독립적으로 테스트할 수 있어야 합니다.

## 1. Intent Contract

입력:

- 사용자 자연어 요청
- 현재 Figma 파일명, 페이지명, 선택 노드 이름과 타입
- 첨부 이미지 또는 생성된 화면 context

출력:

```json
{
  "intentKind": "primitive_color_analysis | component_improvement_analysis | frame_ux_ui_review | image_based_screen_reconstruction | design_system_alignment | failure_partial_data_response",
  "targetScope": "selection | frame | page | image | generated_screen",
  "needsDesignSystem": true,
  "needsTokenSnapshot": true,
  "expectedReportShape": ["evidence", "strengths", "issues", "priorities", "next_actions"]
}
```

규칙:

- `프리미티브`, `컬러`, `토큰`, `Foundation`, `Color`가 같이 나오면 token snapshot을 우선 읽습니다.
- `컴포넌트`, `variant`, `instance`, `override`가 나오면 component detail과 instance detail을 우선 읽습니다.
- `화면`, `UX`, `UI`, `리뷰`, `개선점`은 layout tree와 text node 요약을 우선 읽습니다.
- `이미지`, `동일한 화면`, `재구성`은 export image, OCR/role map, build quality validation이 필요합니다.
- 실패/부분 데이터 상황에서도 intent를 `unknown`으로 버리지 않고, 읽을 수 있는 최소 근거를 반환합니다.

## 2. Read Strategy Contract

Buddy식 read는 “무엇을 읽었는지”가 사용자에게 보여야 합니다.

| Intent | 필수 read | 보조 read | 사용자 노출 action |
| --- | --- | --- | --- |
| primitive color | `get_selection`, `get_metadata`, `get_node_details`, `export_design_tokens` | `get_variable_defs` | `Read Figma frame` |
| component | `get_selection`, `get_node_details`, `get_instance_details` | `get_component_variant_details`, `search_instances` | `Read Figma frame`, `Inspect component properties` |
| frame UX/UI | `get_selection`, `get_metadata`, `get_node_details` | `list_text_nodes`, `snapshot_selection` | `Read Figma frame` |
| image reconstruction | `export_node`, image analysis | `bulk_create_nodes`, readback validation | `Read selected image`, `Create Figma nodes`, `Validate output` |
| design-system alignment | `get_node_details`, `search_design_system`, `export_design_tokens` | `search_file_components`, `search_library_assets` | `Search design system assets` |
| partial/failure | whatever succeeds | command status/warnings | `Report partial evidence` |

## 3. Evidence Extraction Contract

각 도메인은 raw read result를 바로 답변하지 않고 evidence model로 압축합니다.

Primitive color evidence:

```json
{
  "collectionCount": 7,
  "variableCount": 548,
  "primitiveCollection": "0.1. primitives",
  "colorBucketCount": 198,
  "colorScaleGroups": [
    { "group": "light/Red", "steps": [20, 30, 50, 60, 80], "alpha": true }
  ],
  "sampleVariables": [
    { "name": "light/Blue/60", "value": "#3182F6" }
  ]
}
```

Component evidence:

```json
{
  "nodeType": "INSTANCE | COMPONENT | COMPONENT_SET",
  "componentName": "Button",
  "variantPropertyCount": 3,
  "componentPropertyCount": 5,
  "overrideCount": 2,
  "autoLayout": "HORIZONTAL | VERTICAL | NONE"
}
```

Frame UX evidence:

```json
{
  "childCount": 42,
  "textNodeCount": 18,
  "autoLayoutFrameCount": 9,
  "spacingSamples": [8, 12, 16, 24],
  "geometry": { "width": 390, "height": 844 }
}
```

Image reconstruction evidence:

```json
{
  "recognizedRoleCount": 13,
  "createdNodeCount": 61,
  "coordinateCoverage": "52/59",
  "textCoverage": "18/20",
  "overlapCount": 1,
  "fallbackIconCount": 1
}
```

## 4. Domain QA Contract

QA rule은 evidence를 issue로 바꿉니다.

Primitive color rules:

- `missing_scale_steps`: 색상군별 `10..100` 단계 누락
- `alpha_naming_mismatch`: dark black alpha가 white alpha 값을 가짐
- `similar_color_family`: Blue와 LightBlue처럼 RGB distance가 임계값 이하
- `mode_coverage_gap`: Light와 Dark의 단계 수 또는 alpha 제공 범위 차이
- `semantic_reference_gap`: semantic/theme이 primitive와 일관되게 연결되지 않음

Component rules:

- `variant_gap`: 필수 상태 variant가 없음
- `override_risk`: 인스턴스 override가 많아 시스템 컴포넌트 의도가 흐려짐
- `property_naming_drift`: property명이 역할보다 시각 속성 중심
- `reuse_opportunity`: 직접 그린 레이어를 기존 컴포넌트로 대체 가능

Frame UX/UI rules:

- `hierarchy_weakness`: 제목, 주요 액션, 보조 정보의 대비가 약함
- `spacing_inconsistency`: 동일 계층 spacing이 여러 값으로 흔들림
- `touch_target_risk`: 모바일 터치 대상이 작음
- `scanability_risk`: 반복 리스트나 데이터 밀도가 높아 훑어보기 어려움

Image reconstruction rules:

- `editable_layer_coverage_gap`: 인식된 role 대비 생성된 editable node가 부족
- `text_coverage_gap`: OCR 텍스트가 생성 레이어에 충분히 반영되지 않음
- `coordinate_coverage_gap`: 좌표가 없는 주요 role이 많음
- `visual_sanity_regression`: 겹침, origin stack, fallback icon, helper label 노출

## 5. Report Composition Contract

Buddy식 리포트는 항상 같은 순서를 지킵니다.

```text
{도메인} 분석 결과
{분석 완료 또는 부분 완료 선언}

근거
- 읽은 데이터 이름과 숫자

잘 구성된 부분
- 유지할 점

개선이 필요한 부분
1. [높음] 구체 대상: 이유

요약 우선순위
- high: 실행 제목 (대상)

다음 액션
- 바로 실행 가능한 후속 작업

판단 제한
- 부족한 데이터가 있을 때만 마지막에 분리
```

코드 계약:

- `src/buddy-report-composer.js`의 `composeBuddyStyleAuditReport`를 사용합니다.
- 도메인 audit module은 `evidence`, `strengths`, `issues`, `priorities`, `recommendations`, `limits`만 반환하면 됩니다.
- user-facing summary는 generic “데이터 부족” 문구로 시작하면 안 됩니다.

## 6. Progress UX Contract

진행 상태는 다음 6개만 사용합니다.

| State | Label | Action |
| --- | --- | --- |
| reading | 읽는 중 | Read Figma frame |
| analyzing | 분석 중 | Analyze evidence |
| validating | 검증 중 | Validate result |
| completed | 완료 | Complete report |
| partial | 부분 완료 | Report partial evidence |
| failed | 실패 | Explain failure |

코드 계약:

- `src/buddy-report-composer.js`의 `BUDDY_PROGRESS_STATES`와 `buildBuddyProgressTimeline`이 기준입니다.
- UI는 임의 문구를 만들기보다 state contract에서 label/action을 가져와야 합니다.

## 7. Failure Fallback Contract

실패 응답도 다음 순서를 지킵니다.

1. 성공한 read와 usable evidence를 먼저 말합니다.
2. 실패한 read와 영향 범위를 분리합니다.
3. 판단 불가가 아니라 “어떤 판단은 가능하고 어떤 판단은 불가능한지”를 나눕니다.
4. 다시 시도할 때 필요한 구체 입력을 제시합니다.

예:

```text
부분 완료
근거: selection과 node detail은 읽었고, token snapshot은 실패했습니다.
가능한 진단: 레이어 구조와 선택 범위는 분석 가능합니다.
판단 제한: 실제 primitive 값의 스케일 누락은 token export가 필요합니다.
다음 액션: token export를 재시도하거나 특정 컬러군 frame을 선택해 주세요.
```

## 8. Regression Contract

회귀 테스트는 최소 다음을 검증합니다.

- 샘플 6종이 고정되어 있는가
- 요청이 intent로 분류되는가
- 필요한 read command가 실행되는가
- evidence가 report 앞부분에 있는가
- QA issue와 priority가 포함되는가
- 데이터 부족 문구가 첫 진단을 대체하지 않는가
- deterministic report가 Codex 후처리에 의해 덮어써지지 않는가
