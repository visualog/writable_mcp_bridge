# Xbridge vs Buddy Public Comparison

조사일: 2026-05-18

대상:

- `xbridge` 현재 로컬 구현
- Figma Community plugin `1616481120325792817`
- 공개 이름/소개 기준: `Buddy - Figma Design Agent`

## 목적

이 문서는 공개적으로 확인 가능한 정보만 기준으로 `xbridge`와 Buddy를 비교한다.

중요:

- `xbridge`는 로컬 코드와 문서를 직접 읽어 확인했다.
- Buddy는 공개 소개 페이지와 listing 설명만 확인했다.
- 따라서 Buddy의 내부 구현 구조는 추정하지 않고, 공개 기능 설명 수준에서만 비교한다.

## 한 줄 결론

사용자에게 보이는 문제 정의는 매우 비슷하다. 둘 다 "Figma 안에서 자연어로 디자인 작업을 돕는 에이전트/코파일럿"에 가깝다. 다만 현재 확인 가능한 범위에서 `xbridge`는 로컬 브리지 기반의 개발자 지향 시스템이고, Buddy는 설치 후 바로 쓰는 제품형 AI 플러그인에 더 가깝다.

## 1. 공개 정보 기준 Buddy 요약

2026-05-18 기준 공개 설명에서 확인되는 Buddy의 핵심 포지셔닝은 아래와 같다.

- Figma 안에서 AI 디자인 에이전트처럼 동작
- 텍스트 프롬프트로 새 UI를 생성
- 기존 화면을 수정
- user flow를 탐색
- 반복 작업을 자동화
- components, variables, Auto Layout, design system을 활용

이 설명은 Anima의 Buddy 소개 페이지와 블로그, 플러그인 listing 계열 사이트에서 공통적으로 보인다.

## 2. xbridge 현재 구현 요약

`xbridge`는 현재 다음 구조를 가진다.

- Figma plugin main
- plugin UI
- localhost bridge server
- stdio MCP server
- AI/provider 호출 계층

핵심 특징:

- 플러그인이 직접 canvas read/write를 수행
- 로컬 브리지가 active session 선택과 context 조립을 담당
- `POST /api/designer/chat`과 `POST /api/designer/read-context`를 통해 AI 디자이너 흐름 제공
- polling, SSE, WebSocket transport를 함께 운용
- text update, node update, component property, variant, variable binding, style apply 등 실제 authoring command를 제공

즉 `xbridge`는 단순 채팅 플러그인이 아니라, Figma write bridge를 중심으로 한 agent runtime에 가깝다.

## 3. 겹치는 부분

공개 정보 기준으로 두 제품이 겹치는 지점은 아래와 같다.

### 3.1 자연어 기반 작업 요청

- Buddy: prompt로 UI 생성/수정/자동화
- xbridge: plugin UI의 AI 디자이너 채팅과 designer API 경로를 통해 자연어 요청 처리

### 3.2 기존 디자인 자산 활용

- Buddy: components, variables, Auto Layout, design system 활용을 공개적으로 강조
- xbridge: `search_design_system`, `get_variable_defs`, component property/variant, variable binding command를 실제 구현

### 3.3 읽기 후 쓰기 흐름

- Buddy: 기존 화면을 읽고 수정하는 제품 경험을 전면에 둠
- xbridge: selection/page/node/component/instance/variable 읽기 후 write command 실행 구조를 이미 가짐

### 3.4 반복 작업 자동화

- Buddy: 반복 작업 자동화가 공개 설명에 포함됨
- xbridge: bulk update, rename, node update, compose 계열 command로 반복 변경에 유리한 구조를 가짐

## 4. 현재 확인 가능한 차이

### 4.1 제품 경험 vs 개발자 지향 구조

Buddy는 공개 설명상 사용자가 바로 쓰는 AI product처럼 보인다.

반면 xbridge는 현재:

- 로컬 서버 실행 필요
- 플러그인 세션 연결 필요
- bridge health/transport 상태 관리 필요
- MCP/agent/backend 통합을 의식한 구조

즉 사용자 경험보다 시스템 구조가 먼저 드러난다.

### 4.2 로컬 브리지 가시성

Buddy 공개 설명에서는 로컬 브리지나 별도 세션 transport가 전면에 드러나지 않는다.

xbridge는 반대로 다음이 핵심 구조다.

- localhost bridge
- plugin/register
- plugin/heartbeat
- polling fallback
- SSE
- WebSocket

즉 xbridge는 "AI plugin"이라기보다 "AI plugin을 가능하게 하는 bridge platform" 성격이 더 강하다.

### 4.3 공개 기능 설명의 추상도

Buddy는 "디자인 생성/수정/탐색/자동화"를 사용자 언어로 설명한다.

xbridge의 현재 문서와 구현은 상대적으로 아래 같은 시스템 언어가 강하다.

- session
- transport
- command readiness
- read context
- plugin command dispatch

이 차이는 단순 문구 차이가 아니라 제품 완성도 체감에 직접 영향을 준다.

### 4.4 아키텍처 공개 수준

`xbridge`는 내부 구조가 명확하다.

- plugin main/UI 분리
- bridge server
- AI/provider layer
- command contract

Buddy는 공개 정보만으로는 내부가 다음 중 무엇인지 알 수 없다.

- 원격 SaaS 중심인지
- 로컬 helper가 있는지
- 자체 모델 orchestration인지
- 단순 prompt-to-design wrapper인지

따라서 현재 시점에는 "기능 목적은 유사"까지는 말할 수 있지만, "구현 구조도 동일"이라고 말할 수는 없다.

## 5. 제품 관점에서의 해석

공개 설명만 놓고 보면 Buddy는 이미 `xbridge`가 가고 싶어 하는 사용자 경험을 어느 정도 제품화한 사례로 읽힌다.

즉 xbridge 관점에서 중요한 질문은 "같은 기능이 있나?"보다 아래에 가깝다.

1. 사용자가 처음 열었을 때 무엇을 할 수 있다고 바로 이해하는가
2. 자연어 요청에서 실제 canvas 변경까지 몇 단계가 필요한가
3. transport와 세션 복잡성이 사용자 경험 앞에 드러나는가
4. design system 활용이 내부 capability가 아니라 사용자 가치로 보이는가

이 기준으로 보면 Buddy는 제품 포지셔닝이 강하고, xbridge는 현재 infra 포지셔닝이 강하다.

## 6. xbridge에 주는 시사점

### 6.1 브리지보다 작업 경험을 앞에 내세워야 한다

`xbridge`는 내부적으로 bridge가 핵심이어도, 사용자는 "브리지"보다 "무엇을 해주나"를 먼저 본다.

우선순위:

- 선택한 컴포넌트 설명
- spacing critique
- variant/property 수정
- copy rewrite
- frame 생성/정리

이런 작업 경험을 전면에 세워야 한다.

### 6.2 채팅에서 실행까지의 경로를 짧게 만들어야 한다

Buddy류 제품 경험과 경쟁하려면:

- inspect
- suggest
- apply

세 단계를 분리하되, 사용자에게는 한 흐름처럼 보여야 한다.

### 6.3 design system 활용을 제품 메시지로 끌어올려야 한다

현재 xbridge는 design system 관련 capability가 실제로 많다.

- component property
- variant
- variable defs
- variable binding
- library asset/component search

하지만 이건 내부 capability로 보일 뿐, 사용자 가치 언어로 충분히 번역돼 있지 않다.

### 6.4 Codex 중심 backend 재구성은 제품화에 유리하다

Buddy와 같은 유형의 경험을 목표로 한다면, provider를 여러 개 붙이는 구조보다 `Codex backend + structured result + explicit Figma command apply`로 단순화하는 편이 유리하다.

이유:

- 응답 계약을 통일하기 쉽다
- inspect/suggest/apply 흐름을 한 계층에서 관리하기 쉽다
- provider별 예외 처리와 UI drift를 줄이기 쉽다

## 7. 실무 결론

2026-05-18 기준 공개 정보로 판단하면 Buddy는 `xbridge`와 완전히 다른 제품이 아니라, 같은 문제를 더 제품적으로 포장한 유사 카테고리의 플러그인으로 보인다.

그래서 `xbridge`의 다음 과제는 단순히 기능을 더 붙이는 것이 아니라 아래 셋이다.

1. bridge 구조를 숨기고 작업 경험을 전면에 내세우기
2. 자연어 요청에서 Figma 적용까지의 단계를 더 짧게 만들기
3. Codex 중심 backend로 재구성해 응답/적용 계약을 단순화하기

## 참고 출처

- Buddy 소개: `https://www.animaapp.com/figma-ai`
- Buddy 관련 블로그: `https://www.animaapp.com/blog/genai/figma-ai-design-agent/`
- Buddy listing 요약: `https://fig-stats.com/plugins/1616481120325792817`
- xbridge 로컬 문서:
  - `README.md`
  - `docs/figma-plugin-communication-contract.md`
  - `docs/plugin-reference-comparison-for-xbridge.md`
