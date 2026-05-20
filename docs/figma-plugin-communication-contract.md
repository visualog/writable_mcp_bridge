# Figma Plugin Communication Contract

조사일: 2026-05-18  
대상 프로젝트: `xbridge`

## 목적

이 문서는 `xbridge`의 Figma 플러그인 레이어에서 오가는 통신을 한 군데에 정리한 문서입니다.

중요:

- 이 문서는 "현재 구현에서 실제 확인된 계약"과
- "앞으로 수렴해야 할 목표 계약"을 함께 다룹니다.

즉, 이미 코드에 존재하는 사실과 아직 리팩터링 목표인 규칙을 구분해서 읽어야 합니다.

지금 `xbridge`는 일반적인 `main <-> ui` 플러그인보다 구조가 훨씬 무겁습니다.

- Figma plugin main
- plugin UI
- localhost bridge server
- HTTP polling
- SSE
- WebSocket
- designer chat / inspect_selection / runtime ops

가 동시에 얽혀 있기 때문에, 코드만 읽어서 구조를 파악하기가 점점 어려워지고 있습니다.

이 문서의 목적은 네 가지입니다.

1. 어떤 레이어가 어떤 책임을 갖는지 고정
2. 현재 구현에서 실제 확인된 메시지와 API를 기록
3. 목표 계약을 현재 구현과 분리해서 명시
4. `inspect_selection` 같은 핵심 경로를 일반 AI 채팅 흐름과 구분

---

## 문서 상태

이 문서에서 사용하는 표시는 아래와 같습니다.

- `현재 구현`: 코드에서 실제 확인된 상태
- `목표 계약`: 앞으로 수렴해야 하는 구조
- `어긋남`: 현재 구현과 목표 계약 사이의 차이

---

## 1. 레이어 정의

### 1.1 Plugin Main

현재 구현:

- Figma canvas 읽기/쓰기 command 실행
- selection 변경을 UI로 전달
- command 실행 결과를 UI로 전달

대표 근거:

- `handleCommand(...)`
- `selection_changed`
- `command_result`

역할:

- Figma canvas 읽기/쓰기
- selection / node / component / instance / variable 접근
- UI에서 보낸 plugin message 처리

하지 말아야 할 것:

- AI 판단
- bridge transport 상태 해석
- 사용자용 결과 문장 생성

### 1.2 Plugin UI

현재 구현:

- 사용자 입력/결과 표시
- bridge server 연결
- HTTP polling, SSE, WebSocket transport 처리
- inspect/designer/runtime ops 화면 상태 관리
- 일부 inspect fallback 요약 생성

역할:

- 사용자 입력
- 진행 상태 표시
- 결과 표시
- AI 설정 패널
- bridge server와의 네트워크 연결

하지 말아야 할 것:

- Figma scene 자체 해석
- 서버가 만든 설명을 다시 다른 의미로 재작성
- 최종 active session 정책의 1차 소유

### 1.3 Bridge Server

현재 구현:

- plugin session 등록/heartbeat/selection 수집
- active session 결정
- `/api/designer/chat`
- `/api/designer/read-context`
- plugin command dispatch 및 fallback 처리

역할:

- active plugin/session 선택
- 요청 라우팅
- read plan 실행
- `Context Model v1` 조립
- AI/agent 호출
- 응답 구조화

하지 말아야 할 것:

- Figma UI 상태 표현 책임까지 직접 가짐
- plugin UI가 이미 알고 있는 시각 상태를 다시 UI처럼 관리

### 1.4 Agent / AI Layer

현재 구현:

- designer chat 응답 생성
- inspect_selection intent 처리
- structured output 또는 suggestion bundle 생성

역할:

- 설명
- 요약
- 추천
- 계획

하지 말아야 할 것:

- Figma API 직접 호출
- plugin session 선택
- canvas write 직접 실행

---

## 2. 통신 축

현재 `xbridge`에는 세 가지 통신 축이 있습니다.

1. `Plugin UI <-> Plugin Main`
2. `Plugin UI <-> Bridge Server`
3. `Bridge Server <-> AI Provider`

이 셋은 역할이 달라야 합니다.

### 2.1 Plugin UI <-> Plugin Main

성격:

- 짧은 로컬 IPC
- Figma 내부 상태 읽기/쓰기 실행 요청

예:

- ready
- current selection 전달
- node detail 요청
- variable detail 요청
- text update 실행

현재 구현에서 실제 확인된 command:

- `get_selection`
- `get_metadata`
- `get_node_details`
- `get_instance_details`
- `get_component_variant_details`
- `get_variable_defs`
- `search_design_system`
- `bulk_update_texts`
- `update_node`
- `set_variant_properties`

현재 구현에서 실제 확인된 main -> ui 메시지:

- `selection_changed`
- `command_result`

### 2.2 Plugin UI <-> Bridge Server

성격:

- 세션 등록
- 헬스체크
- command transport
- designer chat 요청

예:

- `plugin/register`
- `plugin/selection`
- `plugin/heartbeat`
- `/api/designer/chat`
- `/api/designer/read-context`
- SSE / WS 기반 command/result 경로

현재 구현에서 실제 확인된 경로:

- `POST /plugin/register`
- `POST /plugin/selection`
- `GET /plugin/heartbeat`
- `POST /plugin/heartbeat`
- `GET /plugin/commands?pluginId=...`
- `POST /api/designer/chat`
- `POST /api/designer/read-context`
- SSE stream 구독
- WebSocket command/result push

### 2.3 Bridge Server <-> AI Provider

성격:

- 모델 호출
- structured output
- suggestion / inspect / critique 생성

예:

- Ollama `http://127.0.0.1:11434/v1`
- Codex CLI backend
- OpenAI / NVIDIA / LM Studio / Custom

---

## 3. 핵심 상태 객체

### 3.1 Plugin Session

필수 속성:

- `pluginId`
- `sessionId`
- `fileId`
- `pageId`
- `selectionCount`
- `lastSeenAt`
- `transportCapabilities`
- `readiness`

설명:

`pluginId`는 UI가 들고 있을 수 있지만, 최종적으로 어떤 세션을 실제 요청 대상으로 쓸지는 서버가 결정합니다.

### 3.2 Active Session Resolution

목적:

- `default` 세션과 실제 live page 세션이 동시에 있을 때
- selection이 있는 세션을 우선 사용

원칙:

- 선택이 있는 live 세션 우선
- 선택이 없으면 최근 live 세션
- 그래도 없으면 fallback 세션

UI는 참고 정보만 가질 수 있고, **최종 결정 권한은 서버**가 갖습니다.

현재 구현:

- 이 원칙은 문서 방향과 대체로 맞다.
- 실제로 UI는 `pluginId`, `selectionIds`, `intentKind` 성격의 힌트를 보낼 수 있지만, 최종 active session 선택은 서버 쪽 로직에 걸려 있다.

### 3.3 Context Model v1

목적:

- Figma 읽기 결과를 모델이 쓰기 좋은 구조화 문맥으로 정리

주요 섹션:

- `meta`
- `target`
- `selection`
- `focusedNode`
- `structure`
- `designSystem`
- `pageContext`
- `readMeta`

중요한 원칙:

- raw payload 전체를 모델에 그대로 넘기지 않음
- selection-first
- bounded detail
- optional design system lookup

---

## 4. 요청 종류

현재 플러그인 레이어에서 중요하게 분리해야 하는 요청 종류는 아래 네 가지입니다.

### 4.1 General Designer Chat

예:

- 텍스트 재작성
- 제목 생성
- 번역

특징:

- 일반 AI 응답 경로
- 필요 시 write action으로 이어질 수 있음

### 4.2 inspect_selection

예:

- 선택한 버튼 인스턴스의 variant와 override 설명
- 선택 프레임 spacing critique
- 선택한 컴포넌트의 구조 설명

특징:

- AI 일반 채팅과 분리된 전용 경로
- 우선순위는 `읽기 -> context -> 설명`
- 가능하면 불필요한 preflight를 줄여 빠르게 반환

중요:

이 경로는 일반 AI 채팅 결과 생성기와 섞이면 안 됩니다.

현재 구현:

- `/api/designer/chat` 내부에서 intent 분류를 통해 `inspect_selection` 경로로 들어간다.
- inspect 성공 메시지는 server/Codex가 만든 `designerSuggestionBundle`을 우선 사용한다.
- Codex inspect가 활성화되면 server 응답의 `designerSuggestionBundle.codex`에 상태가 함께 내려온다.

어긋남:

- 목표 계약은 inspect 결과를 UI가 generic 요약으로 다시 만들지 않는 것이다.
- 이 부분은 2026-05-18 기준 1차 정리됐다. UI의 local inspect 요약 fallback은 제거됐고, 실패 시 원인 중심 메시지로 떨어진다.

### 4.3 Runtime Ops / Diagnostics

예:

- bridge health
- transport 상태
- active session 표시

특징:

- 사용자 작업 자체보다 운영 상태 확인용
- designer chat와 시각적으로도 분리하는 것이 좋음

### 4.4 Write Actions

예:

- bulk update texts
- rename node
- set variant
- bind variable

특징:

- 설명/추천과 분리된 실행 경로
- 실행 전후 검증 필요

---

## 5. Plugin UI <-> Plugin Main 계약

### 5.1 기본 원칙

현재 구현:

- `postMessage` 기반 통신은 존재한다.
- 하지만 promise/RPC 스타일 래퍼로 완전히 수렴된 상태는 아니다.
- stale response 무시를 위한 일관된 `requestId` 계약도 문서 수준만큼 고정돼 있지 않다.

목표 계약:

- UI는 `postMessage`를 직접 흩뿌리지 않고, 가능하면 promise/RPC 스타일 래퍼를 사용
- 모든 요청에는 `requestId`를 붙여 stale response를 무시 가능하게
- main은 Figma API 실행만 담당
- UI는 결과 렌더링만 담당

### 5.2 메시지 종류 초안

#### UI -> Main

현재 구현에서 실제 확인된 command:

- `ready`
- `get_selection`
- `get_metadata`
- `get_node_details`
- `get_instance_details`
- `get_component_variant_details`
- `get_variable_defs`
- `search_design_system`
- `bulk_update_texts`
- `update_node`
- `set_variant_properties`

#### Main -> UI

현재 구현에서 실제 확인된 메시지:

- `selection_changed`
- `command_result`

목표 계약 후보:

- `read_result`
- `write_result`
- `runtime_notice`
- `error`

어긋남:

- 위 네 개는 현재 코드에서 일관된 계약 메시지로 확인되지 않았다.
- 따라서 현재 문서에서는 "실제 계약"이 아니라 "향후 분리 후보"로 보는 편이 정확하다.

### 5.3 규칙

목표 계약:

- main은 자연어 설명을 만들지 않음
- UI는 Figma raw node를 해석하려 하지 않음
- 구조 설명은 server/agent 층에서만 생성

어긋남:

- inspect 경로는 1차 정리됐지만, 다른 흐름까지 같은 수준으로 정리된 것은 아니다.

---

## 6. Plugin UI <-> Bridge Server 계약

### 6.1 세션 관련

현재 구현에서 실제 확인된 경로:

- `plugin/register`
  - 플러그인 세션 등록
- `plugin/selection`
  - 현재 선택 정보 전달
- `plugin/heartbeat`
  - 살아 있음 알림

### 6.2 designer 요청 관련

현재 구현에서 실제 확인된 경로:

- `/api/designer/chat`
  - 일반 designer 요청
- `/api/designer/read-context`
  - 읽기 전용 컨텍스트 요청

### 6.3 transport 관련

현재 구현에서 실제 확인된 경로:

- polling
  - `/plugin/commands?pluginId=...`
- SSE
  - stream 상태 구독
- WebSocket
  - command/result push

### 6.4 규칙

목표 계약:

- UI는 가능하면 `pluginId`, `selectionIds`, `intentKindOverride`를 보낼 수 있음
- 그러나 **active plugin 최종 결정은 서버**
- UI는 서버 응답을 그대로 우선 표시
- UI가 서버 응답을 다시 generic 요약으로 덮어쓰지 않음

어긋남:

- inspect 경로는 1차 정리됐지만, 다른 결과 렌더 흐름까지 모두 같은 규칙으로 통일된 것은 아니다.

---

## 7. inspect_selection 계약

이건 현재 가장 중요한 전용 규칙입니다.

### 7.1 목표

선택된 노드, 인스턴스, 프레임의 구조를 설명하는 요청은 일반 채팅 경로와 분리한다.

### 7.2 기대 흐름

목표 계약:

1. UI가 요청 보냄
2. 서버가 `inspect_selection`으로 intent 분류
3. 서버가 active plugin/session 결정
4. read plan 실행
5. `Context Model v1` 조립
6. `suggestions-v2` 또는 Codex CLI inspect 출력 생성
7. UI는 그 결과를 그대로 표시

현재 구현:

- 1~6은 대체로 존재한다.
- 7은 1차 정리됐다. UI는 inspect 성공 시 server/Codex 결과를 우선 표시한다.

### 7.3 금지 규칙

목표 계약:

- UI가 다시 `buildInspectSelectionReport` 같은 generic 요약으로 덮어쓰지 않음
- inspect 결과에 일반 AI 채팅용 완료 카드/후속 칩을 자동으로 붙이지 않음
- `AI 응답을 받지 못했습니다` 같은 일반 채팅용 실패 문구를 그대로 재사용하지 않음

현재 구현과의 차이:

- 첫 번째 항목의 대표적인 local inspect fallback은 제거됐다.

### 7.4 버튼 인스턴스 예시

정상 기대 결과:

- 선택한 인스턴스의 variant와 override를 확인했습니다.
- 원본 컴포넌트는 Button 입니다.
- 현재 variant 값은 `style=fill`, `type=default`, `state=default`, `size=lg+ic` 입니다.
- 현재 override는 라벨/아이콘 등 몇 개가 변경되어 있습니다.

---

## 8. 실패와 복구 규칙

### 8.1 UI 표기 원칙

목표 계약:

실패 문구는 원인별로 나뉘어야 합니다.

- 선택 없음
- session 없음
- bridge 연결 실패
- read timeout
- AI timeout
- structured output parse 실패

`HTTP 200`, `AI 응답을 받지 못했습니다` 같은 의미 불명 문구는 금지합니다.

현재 구현:

- transport/AI/inspect 실패를 더 세분화하려는 흔적은 있으나, 이 문서 수준으로 완전히 정규화된 상태는 아니다.

### 8.2 retry 원칙

목표 계약:

- inspect_selection은 동일 요청을 일반 AI 경로로 다시 보내지 않음
- read 실패는 read retry
- AI 실패는 AI fallback
- session mismatch는 session re-resolution

### 8.3 stop/abort 원칙

목표 계약:

- 사용자가 명시적으로 중지 버튼을 누른 경우만 stop으로 취급
- 브라우저 abort, stale fetch, transport 흔들림을 `요청을 중지했어요`로 표기하지 않음

---

## 9. 모듈 분리 권장안

목표 계약:

`figma-plugin/` 레이어는 최소 아래 단위로 쪼개는 것이 좋습니다.

- `transport-client`
- `session-resolution`
- `command-lifecycle`
- `plugin-message-adapter`
- `designer-chat-runtime`
- `runtime-ops-store`
- `ai-settings-panel`
- `ui-render-layer`

현재처럼 `ui.js` 하나에 transport, 상태, 채팅, 패널, 세션, abort, 결과 렌더가 함께 들어가면 drift가 반복될 가능성이 큽니다.

---

## 10. 지금 바로 해야 하는 것

우선순위:

1. `inspect_selection` 전용 경로를 코드상으로 더 분리
2. UI가 서버 응답을 다시 generic 요약으로 덮어쓰는 경로 제거
3. session resolution 책임을 서버에 집중
4. plugin UI 통신 계층을 promise/RPC 스타일로 정리
5. variables/design-system command 그룹 분리

---

## 11. 현재 구현과 목표 계약의 핵심 차이

### 이미 맞는 부분

- server가 active session 결정권을 가진다는 방향
- plugin main이 실제 Figma API command 실행을 맡는 구조
- bridge server가 designer/read-context 진입점을 가지는 구조
- `inspect_selection`을 일반 chat과 구분하려는 intent 흐름
- inspect 성공 시 server/Codex 결과를 우선 표시하는 방향

### 아직 어긋나는 부분

- `Main -> UI` 메시지가 `selection_changed`, `command_result` 외에 명시적 타입 체계로 정리되지 않음
- promise/RPC 스타일 `ui <-> main` 래퍼가 계약 수준으로 고정되지 않음
- 실패 문구와 retry 정책이 아직 코드 전체에서 완전히 정규화되지 않음

### 이 문서를 읽는 방법

- 현재 코드 이해가 목적이면 `현재 구현` 표기를 우선 본다.
- 리팩터링 목표를 잡는 용도라면 `목표 계약`과 `어긋남`을 본다.

---

## 결론

`xbridge`는 일반적인 Figma 플러그인보다 구조가 훨씬 크고, transport 자체가 제품 일부입니다.

그래서 완성도를 높이려면 새 기능을 계속 붙이기보다, 먼저 아래를 해야 합니다.

- 통신 계약 명시
- 세션 정책 정리
- inspect_selection 독립
- plugin 레이어 모듈화

한 줄로 요약하면:

**xbridge의 다음 성장은 AI 모델 교체보다, 플러그인 통신 구조를 독립된 시스템으로 정리하는 데서 나옵니다.**
