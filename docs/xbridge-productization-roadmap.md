# Xbridge Productization Roadmap

작성일: 2026-05-18

대상:

- `xbridge` 현재 구현
- 목표 경험: Figma 안에서 자연어로 읽기, 설명, 제안, 적용까지 이어지는 제품형 AI 플러그인

관련 문서:

- [xbridge-vs-buddy-public-comparison.md](/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/xbridge-vs-buddy-public-comparison.md:1)
- [figma-plugin-communication-contract.md](/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/figma-plugin-communication-contract.md:1)
- [plugin-reference-comparison-for-xbridge.md](/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/plugin-reference-comparison-for-xbridge.md:1)

## 목표

`xbridge`를 "로컬 브리지 기반 개발자 도구"에서 "Figma 사용자가 바로 이해하고 쓸 수 있는 AI 작업 플러그인"으로 재구성한다.

최종 사용자 경험은 아래를 목표로 한다.

1. 사용자가 플러그인을 연다
2. 자연어로 요청한다
3. AI가 현재 선택/페이지를 읽고 설명하거나 수정 제안을 만든다
4. 필요하면 바로 적용한다
5. 적용 결과와 이유를 Figma 안에서 이해할 수 있다

## 핵심 원칙

### 1. 브리지는 숨기고 작업 경험을 앞에 둔다

사용자는 `plugin/register`, `heartbeat`, `transport`를 보고 싶지 않다.

사용자가 먼저 보는 것은 아래여야 한다.

- 무엇을 할 수 있는가
- 지금 선택한 대상에 대해 무엇을 해줄 수 있는가
- 수정 전에 어떤 변화가 일어나는가

### 2. Codex를 1급 backend로 올린다

여러 provider를 넓게 물리는 구조보다 `Codex CLI backend`를 중심 실행기로 삼는다.

역할 분리:

- plugin main: Figma read/write
- bridge server: session 선택, context 조립, command apply
- Codex backend: reasoning, explanation, inspect, suggestion, structured write plan 생성

### 3. inspect, suggest, apply를 분리하되 한 흐름처럼 보이게 한다

내부 계약은 분리한다.

- inspect: 읽고 설명
- suggest: 바꿀 방안 제안
- apply: 명시적 command 실행

하지만 UI에서는 한 작업처럼 이어져야 한다.

### 4. 자유 텍스트보다 구조적 응답을 우선한다

bridge와 plugin은 prose scraping이 아니라 JSON 계약을 소비해야 한다.

핵심 응답 타입:

- `inspect_result`
- `suggestion_bundle`
- `write_plan`
- `apply_result`

## 제품화 목표 상태

출시 관점의 목표 상태는 아래와 같다.

### 사용자 관점

- 플러그인을 열면 바로 가능한 작업이 보인다
- 선택이 있으면 selection-aware prompt가 먼저 제안된다
- AI 응답이 generic하지 않고 Figma 구조를 실제로 반영한다
- 적용 전 preview 또는 변경 요약이 보인다
- 실패 시 이유가 명확하다

### 기술 관점

- `Codex CLI`가 inspect/suggest/write-plan의 기본 백엔드다
- plugin UI가 server 응답을 다시 임의 요약하지 않는다
- active session 결정권은 서버에 일원화된다
- `ui <-> main`과 `ui <-> server` 계약이 문서와 코드에서 일치한다
- write action은 항상 explicit command로만 실행된다

## 단계별 로드맵

## Phase 0. 구조 안정화

목적:

- 현재 구현의 drift를 줄이고, Codex 중심 재구성의 발판을 만든다

완료 기준:

- `inspect_selection`의 local fallback 요약 제거 또는 축소
- communication contract 기준으로 현재/목표/어긋남이 코드 작업 항목으로 연결됨
- provider 경로와 Codex 경로가 코드에서 분리 식별 가능

주요 작업:

1. `figma-plugin/ui.js`에서 `buildInspectSelectionReport(...)` 의존 경로를 줄인다
2. `Main -> UI` 메시지 타입을 실제 사용 기준으로 정리한다
3. `src/server.js`에서 designer chat, read-context, apply 경로를 구조적으로 분리한다
4. 실패 메시지를 `selection 없음`, `session 없음`, `read 실패`, `AI 실패`, `apply 실패` 축으로 정규화한다

리스크:

- UI fallback을 급하게 제거하면 당장 빈 응답처럼 보일 수 있다
- 먼저 server 응답 품질을 보강해야 한다

진행 상태:

- 2026-05-18 기준 `inspect_selection`의 UI local 요약 fallback은 제거됐다.
- server는 inspect 응답에 `designerSuggestionBundle.codex.status`를 함께 남기기 시작했다.

## Phase 1. Codex Inspect Backend

목적:

- `inspect_selection`을 첫 번째 Codex 전용 경로로 전환한다

왜 여기부터 시작하는가:

- 읽기 중심이라 write safety 부담이 낮다
- 사용자 체감 가치가 즉시 크다
- context 조립과 structured output 계약을 먼저 검증할 수 있다

완료 기준:

- `inspect_selection`이 `Codex CLI`를 기본 백엔드로 사용
- 응답이 JSON schema를 통과
- UI는 server/Codex 결과를 그대로 표시
- 동일 selection에 대해 응답 품질이 기존 rule-based fallback보다 안정적

주요 작업:

1. `inspect_selection` 전용 payload 스키마 정의
2. `codex exec --output-schema ...` wrapper 추가
3. context payload를 selection-first로 축소
4. inspect 결과 타입 정의
5. timeout, schema failure, insufficient context fallback 정의

권장 응답 구조 예시:

```json
{
  "intentKind": "inspect_selection",
  "summary": "현재 선택은 Button 인스턴스입니다.",
  "findings": [
    "variant는 size=lg, state=default 입니다."
  ],
  "recommendedActions": [
    {
      "label": "size를 md로 변경",
      "actionType": "set_variant_properties",
      "ready": true
    }
  ]
}
```

## Phase 2. Codex Suggest and Apply

목적:

- Codex가 설명만 하는 백엔드가 아니라, Figma command를 제안하는 백엔드가 되게 한다

완료 기준:

- text rewrite, spacing critique, variant/property update, simple layout fix가 structured plan으로 내려온다
- apply는 항상 explicit command preview 후 실행된다
- undo/rollback 경로가 유지된다

주요 작업:

1. `suggestion_bundle`과 `write_plan` 스키마 정의
2. command allowlist 정의
3. high-risk command와 low-risk command를 분리
4. preview 변화 요약 UI 추가
5. apply 결과와 실패 결과를 구조화

우선 적용 작업:

- `bulk_update_texts`
- `update_node`
- `set_variant_properties`
- `set_component_properties`
- `bind_variable`

진행 상태:

- 2026-05-18 기준 `bulk_update_texts` preview는 `XBRIDGE_CODEX_CLI_WRITE_ENABLED=1`일 때 Codex structured `write_plan` 초안을 받을 수 있다.
- confirm/apply는 기존 explicit command 경로를 그대로 사용한다.
- 같은 기준으로 `set_variant_properties`도 Codex structured `write_plan` preview/confirm 경로가 추가됐다.

보류 작업:

- 대규모 compose
- 광범위한 tree rewrite
- destructive delete 자동 실행

## Phase 3. 제품형 Plugin UX

목적:

- infra 지향 UI를 작업 지향 UI로 바꾼다

완료 기준:

- 첫 화면이 runtime ops가 아니라 작업 entry 중심이다
- prompt 추천, selection chips, quick actions가 있다
- transport/health는 보조 진단 패널로 내려간다
- 사용자는 "브리지"보다 "수정/설명/정리"를 먼저 체감한다

주요 작업:

1. 첫 화면 정보 구조 개편
2. selection-aware quick prompts 추가
3. inspect/suggest/apply 결과 카드 통일
4. runtime ops 패널을 secondary 위치로 이동
5. design system 작업을 사용자 언어로 재표현

권장 첫 화면 작업 예:

- "선택한 컴포넌트 설명"
- "텍스트 더 짧게 다듬기"
- "spacing 정리 제안"
- "variant/property 바꾸기"
- "디자인 시스템 기준으로 맞추기"

## Phase 4. Codex-Centric Backend Simplification

목적:

- provider 난립을 정리하고 backend contract를 단순화한다

완료 기준:

- 기본 backend가 Codex로 일원화
- provider별 예외 처리 분기가 크게 줄어듦
- host app과 Codex의 책임 경계가 문서와 코드에서 명확

주요 작업:

1. provider abstraction을 재정의
2. `Codex CLI backend`를 default path로 승격
3. host app은 deterministic read/write만 소유
4. Codex는 reasoning/suggestion/plan만 소유
5. artifact-first success detection과 schema-first output 처리를 공통화

## Phase 5. 출시 기준

목적:

- 내부 데모가 아니라 실제 배포 가능한 품질 기준을 세운다

완료 기준:

- 첫 실행 가이드가 1분 내 이해 가능
- 대표 작업 5개가 안정적으로 동작
- 실패 메시지가 사용자가 이해 가능한 언어로 정리됨
- 설계 시스템 문맥이 있는 파일에서 품질 저하 없이 동작

대표 작업 5개:

1. 선택한 인스턴스 설명
2. 선택한 텍스트 rewrite
3. 선택한 frame spacing critique
4. variant/property 수정
5. 단순 레이아웃 정리 제안 후 적용

## 우선순위 백로그

### 바로 해야 할 것

1. `inspect_selection` local fallback 제거 계획 수립
2. Codex inspect payload/schema 초안 작성
3. server의 Codex wrapper 추가
4. plugin UI 결과 카드 구조 단순화

### 그 다음 할 것

1. write-plan schema 정의
2. low-risk apply path 추가
3. quick prompt UX 추가
4. runtime ops 패널 후순위 배치

### 나중에 할 것

1. 대형 compose 자동화
2. provider 다중 지원 확장
3. 고급 multi-step autonomous edit

## 성공 지표

제품화 진행 여부는 아래 지표로 본다.

### 사용자 지표

- 첫 요청 성공률
- inspect 응답 만족도
- suggestion에서 apply까지 이어지는 비율
- 실패 후 재시도 성공률

### 시스템 지표

- Codex schema parse 성공률
- read-context latency
- apply 성공률
- session mismatch 비율
- UI local fallback 사용 비율

목표 방향:

- local fallback 사용 비율은 지속적으로 내려가야 한다
- inspect 응답의 majority path는 Codex structured output이어야 한다

## 결론

`xbridge`를 제품형 AI 플러그인으로 바꾸는 핵심은 기능 추가가 아니다. 브리지 복잡성을 사용자 경험 뒤로 밀고, `Codex backend + structured contracts + explicit Figma apply` 구조로 재정렬하는 것이다.

실행 순서는 명확하다.

1. `inspect_selection`을 Codex 전용 구조로 정리한다
2. suggestion/apply를 explicit command 계약으로 확장한다
3. plugin UI를 infra 중심에서 작업 중심으로 바꾼다
4. backend를 Codex 중심으로 단순화한다

이 순서가 가장 리스크가 낮고, 사용자 체감 가치는 가장 빨리 나온다.
