# Figma Community Resources Plugin Survey for Xbridge

조사일: 2026-05-18

대상:

- 로컬 클론: `community-resources/`
- 핵심 파일:
  - `community-resources/README.md`
  - `community-resources/plugins/README.md`
  - `community-resources/CONTRIBUTING.md`

## 요약

`community-resources`는 Figma 플러그인 개발용 "문서/링크 카탈로그"에 가깝다. 이 저장소 자체에 xbridge가 바로 재사용할 수 있는 플러그인 런타임 코드, manifest 예제, UI 통신 구현이 대량으로 들어 있는 구조는 아니다. 대신 다음 두 가지 용도로는 유효하다.

1. 어떤 종류의 오픈소스 플러그인이 많이 공개되어 있는지 파악
2. 어떤 툴체인, UI 라이브러리, IPC 헬퍼, 배포 도구가 커뮤니티 기준의 기본 레퍼런스인지 파악

xbridge 관점에서 가장 유의미한 결론은 다음이다.

- 실제 구현 참고의 1차 소스는 이 저장소 자체가 아니라 `plugins/README.md`가 가리키는 외부 저장소들이다.
- 플러그인 개발용 생태계는 이미 `starter template`, `design system`, `IPC helper`, `CI/CD` 축으로 정리되어 있다.
- xbridge는 현재 자체 브리지와 플러그인 런타임을 직접 관리하고 있으므로, 앞으로는 "plugin architecture standardization"과 "plugin developer UX"를 더 의식하는 편이 좋다.

## 실측 결과

### 저장소 성격

- 루트 README는 이 저장소를 "open source plugins, widgets, agent skills, and developer resources" 모음으로 설명한다.
- 플러그인 전용 내용은 `community-resources/plugins/README.md`에 모여 있다.
- `plugins/README.md`는 공식 예제로 `figma/plugin-samples`를 가장 먼저 가리킨다.
- README는 명시적으로 이 저장소가 Figma Community 자체가 아니라고 말하며, listed resource 사용 전 자체 보안 검토를 권한다.

즉, 이 저장소는 "정리된 디렉터리"이지 "공식 플러그인 SDK 문서 저장소"는 아니다.

### 플러그인 관련 항목 수

`community-resources/plugins/README.md`를 기준으로 단순 집계하면:

- `SOURCE CODE` 링크 항목: 73개
- `PLUGIN` 링크가 함께 있는 항목: 57개
- `NO LICENSE` 표기 항목: 22개
- `MIT` 표기 항목: 46회
- `APACHE LICENSE 2.0` 표기 항목: 2회
- `CC0` 표기 항목: 2회

의미:

- 링크는 많지만 라이선스가 불명확한 항목도 적지 않다.
- xbridge에 외부 코드를 가져오거나 참고 구현을 복사할 때는 라이선스 검토가 필수다.
- "오픈소스 플러그인 사례가 많다"는 신호는 충분하지만, 바로 의존해도 안전하다는 뜻은 아니다.

### 카테고리 구조

플러그인 README는 다음 구조를 가진다.

- Resources
  - Starter Templates: 7개
  - Design System Components: 4개
  - Helper Functions: 2개
  - CI/CD Release Tools: 2개
- Plugins
  - Accessibility: 3개
  - Color: 7개
  - Design Linters: 1개
  - Design Systems: 4개
  - Developer Tools: 4개
  - Export: 5개
  - Icons: 4개
  - Maps: 3개
  - Organization: 4개
  - Responsive: 1개
  - Text: 4개
  - Utilities: 17개
  - Misc: 1개

의미:

- 커뮤니티 플러그인 분포는 `Utilities`, `Color`, `Export`, `Design Systems` 쪽이 상대적으로 두텁다.
- xbridge가 다루는 문제 중 "선택 구조 읽기", "디자인 시스템", "텍스트/구성 변경", "정리/배치"는 이미 커뮤니티 수요가 큰 영역과 겹친다.
- 반대로 "AI-first bridge + local transport + safe apply pipeline" 같은 구조는 이 카탈로그만으로는 잘 드러나지 않는다. xbridge는 이 점에서 일반 플러그인보다 시스템 성격이 더 강하다.

## xbridge에 유의미한 플러그인 개발 신호

### 1. 템플릿/툴체인 표준화 수요가 분명하다

Starter Templates에 반복해서 등장하는 축:

- `create-figma-plugin`
- `figplug`
- `plugma`
- React/Svelte 기반 템플릿

의미:

- Figma 플러그인 개발은 이미 "번들링/manifest/UI 구성"의 표준화 수요가 크다.
- xbridge는 현재 커스텀 Node 서버 + 직접 작성한 plugin runtime 중심인데, 개발자 경험 측면에서는 이런 툴체인 표준화 이점을 충분히 흡수하지 못하고 있을 수 있다.

xbridge 시사점:

- 플러그인 쪽을 장기적으로 더 유지보수 가능하게 하려면, 최소한 빌드/manifest/version sync는 별도 규칙이나 자동화로 표준화하는 편이 좋다.
- UI 확장이 계속 커질 경우, 플러그인 쪽만 별도의 더 명시적인 빌드 파이프라인으로 분리하는 선택지가 있다.

### 2. UI 컴포넌트와 디자인 시스템 계층이 중요하다

Resources에는 다음과 같은 UI 계층용 항목이 따로 있다.

- `Figma Kit`
- `Figma Plugin DS`
- `React Figma Plugin DS`
- `Figma Plugin DS Svelte`

의미:

- 커뮤니티는 플러그인 UI를 "그냥 HTML"로 두지 않고, 별도 디자인 시스템/컴포넌트 계층으로 다루는 경향이 있다.
- xbridge도 플러그인 UI가 점점 상태 표시, transport health, AI designer, recovery control까지 맡고 있으므로 UI 일관성 관리가 중요하다.

xbridge 시사점:

- 플러그인 UI 토큰/컴포넌트 기준을 문서화하거나 분리된 UI 계층을 갖추는 것이 좋다.
- `ui.html`/`ui.js`가 계속 커지면, 브리지 상태 패널과 AI 디자이너 패널 같은 단위로 구조화해야 한다.

### 3. main/UI 간 통신 문제는 별도 도구 수요가 있을 만큼 중요하다

Helper Functions에 `figma-await-ipc`가 별도로 실려 있고, 설명도 "`postMessage()`의 await-able replacement"다.

의미:

- Figma 플러그인에서 main thread와 UI 간 메시지 통신 복잡도는 실제 문제로 인식되고 있다.
- xbridge는 플러그인과 로컬 브리지 간 통신, 플러그인 UI와 plugin code 간 상태 전달, SSE/WS fallback까지 겹쳐 있어 일반 플러그인보다 통신 복잡도가 더 높다.

xbridge 시사점:

- 플러그인 내부 메시지 계약을 더 명시적으로 타입화/문서화할 필요가 있다.
- `ui -> plugin runtime -> local bridge`를 관통하는 이벤트 모델을 문서의 1급 개념으로 두는 편이 맞다.

### 4. 배포 자동화는 커뮤니티에서도 별도 카테고리다

CI/CD Release Tools에 다음이 별도 항목으로 있다.

- `figcd`
- `figma-plugin-deploy`

의미:

- 플러그인 배포와 릴리즈는 수동 작업으로 두기엔 불편하고 반복적인 영역이다.
- xbridge도 버전 정합성, manifest, UI 버전, server version 맞춤이 중요하므로 배포 자동화 이슈가 실제 존재한다.

xbridge 시사점:

- 버전 동기화 테스트는 이미 있지만, publish-ready asset 생성과 배포 검증 파이프라인은 더 체계화할 여지가 있다.

## xbridge와 직접 맞닿는 플러그인 유형

카탈로그를 보면 xbridge와 가장 가까운 플러그인 부류는 아래다.

- Design Systems
  - `Design Tokens`
  - `Styler`
  - `Themer`
  - `Tokens Studio for Figma`
- Organization
  - `Project Scaffold`
  - `Super Tidy`
  - `Figma Format`
- Text / Utilities
  - `Content Buddy`
  - `Batch Styler`
  - `Component to page`
  - `Edit in place`
  - `Reattach Instance`
  - `Variables Import`

이 분류가 의미하는 바:

- xbridge는 단순 "레이어 조작 플러그인"보다 넓지만, 사용자의 실제 기대는 대체로 위 범주와 비슷하다.
- 즉 사용자는 xbridge를 "AI가 붙은 general bridge"가 아니라, 디자인 시스템/정리/텍스트/컴포넌트 작업을 빠르게 처리하는 실용 플러그인으로 체감할 가능성이 높다.

## 이 저장소가 주지 않는 것

이번 클론에서 확인된 한계:

- 로컬에 바로 분석 가능한 플러그인 샘플 코드가 대량 포함되어 있지 않다.
- manifest 패턴, `figma.showUI`, `figma.ui.postMessage`, parameters API 같은 저수준 구현은 이 저장소 본문만으로는 충분히 안 나온다.
- 대부분의 실제 구현 근거는 외부 GitHub 저장소 링크로 빠져 있다.

즉, xbridge 개선을 위해 이 저장소만 보면 부족하다. 다음 순서가 합리적이다.

1. 이 카탈로그로 레퍼런스 후보를 고른다.
2. 후보 중 라이선스가 명확한 저장소를 선별한다.
3. 그 저장소들의 실제 `manifest`, UI 구조, 통신 패턴, 배포 구성을 읽는다.

## xbridge 개선에 바로 연결되는 제안

### 우선순위 1: 플러그인 레이어 구조화

xbridge는 플러그인 프로젝트인데, 현재는 브리지 서버와 AI 계층의 존재감이 커서 "plugin developer ergonomics" 관점이 상대적으로 약해질 수 있다.

권장:

- `figma-plugin/` 레이어의 책임을 별도 문서로 분리
- manifest/version/domain policy를 한 문서에서 관리
- UI 상태/복구/통신 계약을 별도 계약 문서로 승격

### 우선순위 2: 플러그인 UI 체계화

커뮤니티는 plugin UI용 DS/컴포넌트 계층을 별도 자원으로 다룬다.

권장:

- xbridge 플러그인 UI의 공통 컴포넌트 규칙 정의
- transport 상태, recovery 상태, AI 상태를 일관된 패턴으로 렌더
- UI 패널 증가를 감당할 수 있게 구조화

### 우선순위 3: 통신 계층 명시화

커뮤니티 helper가 따로 존재할 정도로 IPC는 중요하다.

권장:

- `ui <-> plugin runtime` 메시지 계약 정리
- `plugin runtime <-> local bridge` 이벤트/명령 계약 정리
- timeout, fallback, reconnect를 상태 머신처럼 문서화

### 우선순위 4: 배포와 버전 정합성 자동화 강화

카탈로그에 배포 도구가 따로 있는 만큼, xbridge도 이 부분을 강화할 가치가 있다.

권장:

- 버전 일치 테스트 범위 확대
- plugin asset/package/release 절차 스크립트화
- README와 manifest와 실제 도메인/포트 정책의 drift 방지

## 조사 결론

`community-resources`는 xbridge가 직접 코드를 가져다 쓰는 저장소가 아니라, "어떤 플러그인 레퍼런스를 다음으로 파야 하는지" 알려주는 큐레이션 저장소다.

xbridge에 가장 유용했던 신호는 세 가지다.

1. 플러그인 개발 생태계는 이미 템플릿/컴포넌트/IPC/배포 축으로 분화돼 있다.
2. xbridge는 그중에서도 통신 복잡도와 시스템 복잡도가 높은 편이므로, 플러그인 레이어를 더 명시적으로 제품화해야 한다.
3. 다음 단계는 이 카탈로그의 외부 링크 중 라이선스가 명확하고 xbridge와 가까운 플러그인들을 골라 실제 코드 레벨 비교 분석으로 넘어가는 것이다.
