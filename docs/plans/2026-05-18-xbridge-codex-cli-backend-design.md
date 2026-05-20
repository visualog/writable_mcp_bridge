# Xbridge Codex CLI Backend Design

이 문서는 `xbridge`에 `Codex CLI`를 백엔드 작업자로 붙이는 최소 적용 설계안이다. 목표는 모든 AI 경로를 바꾸는 것이 아니라, 현재 가장 흔들리는 `inspect_selection` 계열 작업을 먼저 안정화하는 것이다.

## 1. 왜 Codex CLI를 붙이려는가

현재 `xbridge`는 아래 경로에서 흔들린다.

- 선택 구조 읽기
- 읽은 결과를 사람 친화적인 설명으로 정리
- 응답 형식을 일정하게 유지
- 실패 시 다시 시도하거나 더 작은 단위로 재정리

로컬 오픈소스 모델은 짧은 카피 작업에는 쓸 수 있지만, 위처럼 `읽기 -> 판단 -> 구조화 출력 -> 검증`이 들어가는 흐름에서는 응답 형식과 안정성이 자주 흔들린다.

`Codex CLI`를 붙이면 다음을 얻을 수 있다.

- 구조화 출력(JSON Schema)
- 에이전트식 판단
- 도구 사용 전제의 작업 흐름
- `/goal` 기반 반복 완료 계약
- 재사용 가능한 skill 축적

한 줄로 정리하면:

`xbridge`는 계속 Figma 읽기/쓰기를 맡고, `Codex CLI`는 판단과 설명을 맡는다.

## 2. 적용 원칙

### 유지할 것

- Figma 읽기/쓰기는 계속 `xbridge`가 담당
- `Context Model v1`을 모델 입력의 기준으로 유지
- 간단한 텍스트 작업은 지금 경량 경로를 유지

### 바꿀 것

- 복잡한 `inspect_selection` 응답은 `Codex CLI`가 생성
- UI는 자연어를 다시 해석하지 않고, 정형 출력만 렌더
- 실패 시 generic fallback보다 구조화된 실패 이유를 우선 표시

### 하지 않을 것

- Codex가 직접 Figma API를 호출하게 하지 않음
- 모든 요청을 Codex CLI로 보내지 않음
- 기존 로컬 모델 경로를 한 번에 제거하지 않음

## 3. 가장 먼저 붙일 대상

1. `선택한 버튼/인스턴스의 variant와 override 설명`
2. `선택 프레임의 auto layout / spacing critique`
3. `현재 선택에 맞는 design system component 추천`

이 세 작업은 이미 `Context Model v1`과 `suggestions-v2`가 일부 뼈대를 갖고 있어서, Codex CLI를 얹기 가장 좋다.

## 4. 제안 구조

```text
Figma Plugin UI
  -> Xbridge Server
    -> read plan 실행
    -> Context Model v1 생성
    -> Codex CLI 호출
    -> structured JSON 응답 수신
    -> UI 렌더 또는 action preview 생성
```

역할 분리:

- `ui.html`
  - 요청 입력
  - 상태 표시
  - 결과 렌더
- `server.js`
  - 세션 해결
  - read plan 실행
  - contextModel 생성
  - Codex CLI 프로세스 실행
  - JSON Schema 검증
- `Codex CLI`
  - intent 해석
  - 설명/추천 생성
  - structured output 반환

## 5. 최소 호출 방식

초기 단계에서는 `codex exec`만 쓴다.

이유:

- 비대화형 실행이 가장 단순함
- 구조화 출력 검증이 쉬움
- 서버 프로세스 안에서 실행/timeout 관리가 쉬움

`/goal`은 2단계 이후에 붙인다.

## 6. 1단계 요청/응답 흐름

### 입력

서버가 Codex CLI에 넘기는 입력은 3개다.

1. `request`
2. `contextModel`
3. `output schema`

예시 입력 개념:

```json
{
  "request": "선택한 버튼 인스턴스의 variant와 override를 설명해줘",
  "contextModel": {
    "meta": {},
    "target": {},
    "selection": [],
    "focusedNode": {},
    "structure": {},
    "designSystem": {},
    "pageContext": {},
    "readMeta": {}
  }
}
```

### 출력

최소 출력은 JSON Schema로 강제한다.

#### inspect_selection 기본 schema

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["intent", "summary", "details", "followUp"],
  "properties": {
    "intent": { "type": "string" },
    "summary": { "type": "string" },
    "details": {
      "type": "array",
      "items": { "type": "string" }
    },
    "followUp": { "type": "string" }
  }
}
```

예시 출력:

```json
{
  "intent": "inspect_selection",
  "summary": "선택한 인스턴스의 variant와 override를 확인했습니다.",
  "details": [
    "원본 컴포넌트는 Button입니다.",
    "현재 variant 값은 style=fill, type=default, state=default, size=lg+ic 입니다.",
    "현재 override는 label, leading icon, trailing icon을 포함합니다."
  ],
  "followUp": "현재 variant와 override 차이를 먼저 기록하기"
}
```

## 7. 서버 설계

새 모듈 권장:

- `src/codex-cli-runner.js`
- `src/codex-cli-schema.js`
- `src/codex-cli-prompts/inspect-selection.md`

### codex-cli-runner.js 역할

- `codex exec` 프로세스 실행
- timeout 관리
- stdout/stderr 수집
- JSON 파싱
- 실패 분류

예상 함수:

```js
async function runCodexStructuredTask({
  taskName,
  request,
  contextModel,
  schema,
  timeoutMs,
})
```

### 실패 분류

최소 아래 코드를 분리한다.

- `codex_timeout`
- `codex_non_json_output`
- `codex_schema_validation_failed`
- `codex_process_failed`

## 8. inspect_selection 1단계 연결 위치

현재 `inspect_selection`은 대략 아래 경로를 탄다.

- intent 분류
- read plan
- contextModel
- suggestions-v2
- UI render

1단계에서는 `suggestions-v2`를 완전히 지우지 않는다. 대신 아래처럼 바꾼다.

```text
inspect_selection
  -> read plan
  -> contextModel
  -> Codex CLI structured explain
  -> 성공 시 Codex 결과 사용
  -> 실패 시 suggestions-v2 fallback
```

즉 `suggestions-v2`는 백업으로 남긴다.

## 9. prompt 설계 원칙

Codex CLI에 보내는 지시는 짧고 강하게 고정한다.

핵심 규칙:

- Figma를 직접 수정하려 하지 말 것
- 제공된 contextModel만 근거로 설명할 것
- 확실하지 않은 항목은 추정하지 말 것
- 한국어로 설명할 것
- 최종 출력은 schema에 맞는 JSON만 반환할 것

예시 지시 요지:

```text
당신은 Figma 선택 구조를 설명하는 백엔드 작업자입니다.
직접 캔버스를 수정하지 마세요.
제공된 contextModel만 근거로 설명하세요.
variant, override, component origin이 있으면 우선 설명하세요.
확실하지 않으면 추정하지 말고 부족하다고 적으세요.
최종 출력은 주어진 JSON Schema에 맞는 JSON 하나만 반환하세요.
```

## 10. 왜 `/goal`은 나중인가

`/goal`은 강력하지만, 지금은 먼저 정형 출력이 안정화되는 게 우선이다.

`/goal`을 붙일 적절한 시점:

- 설명이 비면 자동 재시도
- variant/override가 없는 경우 더 작은 read 요청 제안
- design critique가 충분히 구체적이지 않으면 다시 정리

즉 `/goal`은 2단계 검증/복구 계층으로 둔다.

## 11. skill 전략

Codex CLI를 그냥 자유 프롬프트로만 쓰지 말고, xbridge 전용 skill을 만든다.

우선순위:

1. `xbridge-inspect-selection`
2. `xbridge-layout-critique`
3. `xbridge-ds-recommendation`

skill 안에는 다음을 넣는다.

- instructions
- expected schema
- example input
- example output
- 실패 시 규칙

## 12. 구현 단계

### Phase 1

- `codex-cli-runner.js`
- `inspect_selection` 전용 schema
- 버튼 인스턴스 설명 1개 붙이기

완료 기준:

- 버튼 인스턴스 요청이 JSON schema를 지킨 응답으로 반환됨
- UI가 generic 요약 대신 structured 결과를 그대로 표시함

### Phase 2

- frame spacing critique
- DS component recommendation
- fallback 정책 정리

완료 기준:

- 세 작업 모두 Codex 경로와 suggestions-v2 fallback이 동작함

### Phase 3

- `/goal` 기반 재시도
- skill 도입
- structured action preview 확장

## 13. 장점과 단점

### 장점

- 복잡한 설명 작업의 안정성 향상
- structured output으로 UI 파이프라인 단순화
- Context Model v1 활용도 상승
- 반복 가능한 inspect 계열 작업 품질 상승

### 단점

- 응답 속도 느려질 수 있음
- 로컬 프로세스 실행 관리 필요
- Codex CLI 설치/인증 상태 의존
- 비용과 사용량 관리 필요

## 14. 현재 xbridge에 대한 권장 결정

지금은 `모든 AI를 Codex CLI로 옮기는 것`이 아니라,

`inspect_selection`만 Codex CLI proof-of-concept로 붙이는 것

이 맞다.

이렇게 해야:

- 현재 가장 흔들리는 구간을 정확히 겨냥하고
- 기존 텍스트 작업 경로를 깨지 않으며
- Context Model v1의 실효성을 실제로 검증할 수 있다

## 15. 바로 다음 작업

1. `src/codex-cli-runner.js` 추가
2. inspect_selection용 schema 파일 추가
3. `server.js`에서 inspect_selection 성공 경로에 Codex CLI 호출 추가
4. 실패 시 suggestions-v2 fallback
5. 버튼 인스턴스 설명 live 검증
