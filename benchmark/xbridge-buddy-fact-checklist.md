# xbridge에 반영할 Buddy 사실 기반 체크리스트

이 문서는 `Buddy 내부 구현을 복제한다`는 관점이 아니라, `공개 자료와 관찰로 확인된 범위 안에서 xbridge에 안전하게 반영할 것`을 정리한 체크리스트입니다.

## 1. 사실로 볼 수 있는 것

### Figma 플러그인 구조

- [ ] 플러그인 메인 코드와 UI iframe은 분리된 실행 컨텍스트다.
- [ ] 메인 코드는 Figma 문서에 접근 가능하고, UI는 브라우저 API에 접근 가능하다.
- [ ] 두 컨텍스트는 메시지 패싱으로 통신한다.
- [ ] postMessage로 오가는 데이터는 직렬화 가능한 값이어야 한다.

근거:
- [How Plugins Run](https://developers.figma.com/docs/plugins/how-plugins-run/)
- [postMessage](https://developers.figma.com/docs/plugins/api/properties/figma-ui-postmessage/)

### Buddy 제품 포지셔닝

- [ ] Buddy는 Figma 안에서 작동하는 AI 디자인 에이전트로 소개된다.
- [ ] Buddy는 frames 생성, components 사용, variables 적용, auto layout 설정, variants 빌드, pages 재정리까지 다룬다고 공개적으로 주장한다.
- [ ] Buddy는 `No terminal. No IDE. No API keys or config files.`를 강조한다.
- [ ] Buddy는 `Choose your model`을 제공한다.

근거:
- [Anima Buddy 소개](https://animaapp.com/blog/product-updates/ai-design-agent-for-figma-design-with-ai-in-canvas/?source=user_profile---------6----------------------------)

### 실제 관찰된 UX

- [ ] 작업 로그가 짧은 콘솔형 문장으로 보인다.
- [ ] 완료 뒤 결과 요약과 후속 액션 제안이 붙는다.
- [ ] design system 관련 토글/표시가 메인 흐름에 노출된다.
- [ ] 모델명, 새 채팅, 대화 목록, 후속 액션이 작업 UX에 포함된다.

근거:
- 로컬 스크린샷 관찰
- 기존 benchmark 문서 내 직접 관찰 정리

## 2. 사실처럼 쓰면 안 되는 것

아래는 `가능성은 있지만 공개적으로 확인된 사실은 아닌 것`입니다. xbridge 설계 아이디어로는 쓸 수 있지만, Buddy의 실제 구현 근거로 말하면 안 됩니다.

- [ ] Buddy가 노드 전체를 JSON으로 직렬화해 LLM에 보낸다고 단정
- [ ] Buddy가 LLM으로부터 `Figma Plugin API 코드`를 받아 eval한다고 단정
- [ ] Buddy가 Claude Sonnet 4.6을 정확히 어떤 endpoint/transport로 호출하는지 단정
- [ ] Buddy가 design system을 시스템 프롬프트에 어떤 포맷으로 넣는지 단정
- [ ] Buddy의 retry, caching, backoff, JWT/OAuth 구조를 단정
- [ ] Buddy가 WebSocket/SSE를 실제로 쓴다고 단정

이 항목들은 `추정` 또는 `일반적인 구현 패턴`으로만 적어야 합니다.

## 3. xbridge에 바로 반영할 것

### 엔진

- [ ] `Context Model`을 selection-local 기준으로 더 강화
- [ ] component / instance / variant / variable / auto layout 정보를 한 컨텍스트 객체로 전달
- [ ] 자연어를 바로 실행하지 않고 `Action Plan` 계층을 둠
- [ ] `Executor`와 `Verifier`를 분리

### 제품 구조

- [ ] 기능 분류를 `생성 / 변형 / 정리 / 참조` 4축으로 재정의
- [ ] 단순 채팅보다 `작업 로그 -> 결과 요약 -> 후속 액션` 흐름을 메인 UX로 삼음
- [ ] design system 상태를 메인 작업 흐름 안에서 표시

### 디자인 시스템 인지

- [ ] selection 주변 구조뿐 아니라 component/instance 관계를 우선 이해
- [ ] variable bindings와 auto layout 정보를 기본 문맥으로 취급
- [ ] 디자인 시스템 자산 추천을 별도 읽기 primitive가 아니라 contextModel 일부로 포함

## 4. xbridge에서 하지 말아야 할 것

- [ ] `Buddy도 그럴 것`이라는 이유만으로 codegen/eval 구조를 도입
- [ ] MCP 문서를 Buddy 내부 구조의 증거처럼 사용
- [ ] transport/protocol 세부 구현을 Buddy 사실처럼 문서화
- [ ] 공식 근거가 없는 문장을 제품 PRD에 확정 사실로 올리기

## 5. 다음 구현 우선순위

1. `Context Model`을 실제 variant/override/component 추천 품질에 더 강하게 연결
2. `Action Plan Schema` 도입
3. `Executor + Verifier` 분리
4. `작업 로그 / 결과 요약 / 후속 액션`을 엔진 결과와 직접 연결
5. AI 설정 패널보다 `작업 콘솔 경험`을 먼저 안정화

## 6. 문서 사용 규칙

- 이 문서는 `Buddy에 대해 확실히 말할 수 있는 것`만 안전하게 남기는 용도입니다.
- 새로운 분석 문서를 추가할 때는 먼저 이 체크리스트를 기준으로 `사실 / 추정`을 나눕니다.
- 확실치 않은 항목은 `xbridge 설계 가설`로만 이동합니다.
