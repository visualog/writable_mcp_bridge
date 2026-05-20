# Plugin Reference Comparison for Xbridge

조사일: 2026-05-18

대상:

- xbridge 자체 플러그인: `figma-plugin/`
- 외부 레퍼런스:
  - `benchmark/plugin-references/design-lint/`
  - `benchmark/plugin-references/figma-content-buddy/`
  - `benchmark/plugin-references/component-to-page/`
  - `benchmark/plugin-references/figma-variables-import/`

## 요약

이번 비교에서 확인한 핵심은 단순하다. xbridge는 겉모습은 전통적인 Figma plugin 구조(`code.js` + `ui.html`)에 가깝지만, 실제 역할은 일반 생산성 플러그인보다 훨씬 무겁다. 로컬 브리지, HTTP polling, SSE, WebSocket, command readiness, recovery 상태까지 플러그인 UI가 맡고 있어서, 구조 난이도는 레퍼런스 플러그인들보다 높다.

실측 가능한 차이도 분명하다.

- 일반 레퍼런스는 대부분 `figma.ui.onmessage`와 `parent.postMessage` 중심의 단순 IPC에 머문다.
- xbridge는 같은 IPC 위에 추가로 `localhost:3846` 브리지 연결, command fetch, SSE, WebSocket command/result 경로를 얹고 있다.
- `teamlibrary` 권한을 쓰는 사례는 `figma-variables-import`와 xbridge 정도로 좁혀지며, 이 경우는 보통 variables/library 기능과 직접 연결된다.
- 빌드 산출물을 `dist/`나 `build/`로 내보내는 레퍼런스가 많지만 xbridge는 현재 로컬 개발 친화적인 정적 파일 구조를 유지하고 있다.

결론적으로 xbridge의 다음 단계는 "플러그인처럼 보이는 브리지 시스템"을 계속 키우는 것이 아니라, 플러그인 레이어를 독립적인 제품 단위로 다루는 것이다.

## 비교 범위

이번 문서는 다음만 다룬다.

- `manifest.json`의 구조와 권한
- main/UI 통신 방식
- Figma API 사용 범위
- 런타임 복잡도
- xbridge 개선에 직접 연결되는 시사점

커뮤니티 카탈로그 자체 분석은 [community-resources-plugin-survey.md](/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/community-resources-plugin-survey.md:1)에 따로 정리했다.

## 1. Manifest 비교

| 프로젝트 | main/ui 진입점 | editorType | permissions | networkAccess | 특징 |
| --- | --- | --- | --- | --- | --- |
| xbridge | `code.js` / `ui.html` | `figma` | `teamlibrary` | `allowedDomains: ["none"]`, `devAllowedDomains: ["http://localhost:3846", "ws://localhost:3846"]` | 로컬 브리지 개발 전용 도메인 허용이 명시돼 있음 |
| design-lint | `dist/code.js` / `dist/ui.html` | `figma` | 없음 | `allowedDomains: ["none"]` | 번들 결과물을 manifest에 연결 |
| figma-content-buddy | `dist/core.js` / `dist/ui.html` | `figjam`, `figma` | 없음 | 없음 | Figma와 FigJam 둘 다 지원 |
| component-to-page | `code.js` / `ui.html` | 기본값 | 없음 | 없음 | `menu` 기반 명령형 플러그인 |
| figma-variables-import | `build/controller.js` / `build/ui.html` | `figma` | `teamlibrary` | 없음 | team library/variables 작업에 맞춘 권한 |

관찰:

- `teamlibrary` 권한은 흔하지 않다. 이번 비교군에서는 xbridge와 `figma-variables-import`만 사용한다.
- `networkAccess.devAllowedDomains`를 명시한 것은 비교군 중 xbridge뿐이다.
- `component-to-page`처럼 가장 단순한 예제는 아예 `menu` command를 manifest 차원에서 드러낸다.
- 번들러를 쓰는 플러그인은 `dist/` 또는 `build/`를 entry로 둔다. xbridge는 이 계층이 manifest에서 바로 드러나지 않는다.

## 2. Main/UI 통신 패턴 비교

### 공통 패턴

레퍼런스 전반에서 확인된 공통점:

- main thread는 `figma.showUI(...)`로 UI를 띄운다.
- main thread는 `figma.ui.onmessage = ...`로 UI 요청을 받는다.
- UI는 `parent.postMessage({ pluginMessage: ... }, "*")`로 main thread에 요청을 보낸다.
- UI는 `window.onmessage = ...`로 main thread 응답을 받는다.

즉, Figma plugin의 기본 통신 모델 자체는 여전히 단순하다.

### 프로젝트별 차이

`design-lint`

- `figma.showUI(__html__, { width: 360, height: 580 })`
- `figma.on("documentchange", ...)`로 문서 이벤트를 UI에 중계
- `figma.ui.postMessage(...)` 호출이 많고 상태 push 성격이 강함
- `figma.clientStorage`와 `figma.notify`를 넓게 사용

`figma-content-buddy`

- selection 상태에 따라 `showUI` 크기를 다르게 사용
- `figma.ui.postMessage(initMessage)`로 초깃값을 강하게 밀어 넣는 구조
- UI가 `parent.postMessage`로 다양한 텍스트 변환/선호도 저장/selection preview 요청을 보냄

`component-to-page`

- `figma.command` 분기와 `menu` 기반 실행이 중심
- `ui.html` 안에 JS가 직접 들어 있는 전통적인 구조
- 요청/응답 구조가 짧고 단일 작업 지향적임

`figma-variables-import`

- 기본 IPC는 같지만, `@travisspomer/promising-artist`를 써서 await 가능한 호출 형태로 감싼다
- 일반적인 `postMessage` 패턴을 유지하면서도 호출 계약을 더 명시적으로 관리하려는 시도가 보인다

`xbridge`

- 기본 Figma IPC는 유지하지만, 여기에 로컬 브리지 transport가 추가된다
- UI에서 확인되는 경로:
  - `parent.postMessage({ pluginMessage: { type: "ready" } }, "*")`
  - `window.onmessage = async (event) => { ... }`
  - `new EventSource(streamUrl)`
  - `new WebSocket(wsUrl)`
  - polling 기반 `/plugin/commands?pluginId=...` fetch
- 즉 xbridge는 "plugin main <-> plugin UI" 통신과 "plugin UI <-> local bridge" 통신을 동시에 품고 있다

결론:

- 비교군 대부분은 IPC가 제품 기능을 위한 보조 수단이다.
- xbridge는 IPC와 transport 자체가 제품 핵심이다.
- 그래서 xbridge는 일반 플러그인보다 통신 계약 문서화와 상태 모델링이 훨씬 중요하다.

## 3. Figma API 사용 범위 비교

### xbridge

xbridge 플러그인은 읽기와 쓰기 API 범위가 넓다.

- 읽기:
  - selection/page/node/component/instance metadata
  - annotations
  - variables/collections/design-system search
- 쓰기:
  - text update
  - node rename/update/create/duplicate/move
  - component property/variant 수정
  - variable binding
  - style apply
  - snapshot recreation
- 변수 계열:
  - `figma.variables.getVariableByIdAsync`
  - `figma.variables.importVariableByKeyAsync`
  - `figma.variables.getLocalVariablesAsync`
  - `figma.variables.setBoundVariableForPaint`

즉 xbridge는 단일 목적 플러그인이 아니라 "원격 조작 가능한 authoring surface"에 가깝다.

### design-lint

- 문서 변경 감지: `figma.on("documentchange", ...)`
- 사용자 피드백: `figma.notify(...)`
- 로컬 상태 저장: `figma.clientStorage`
- 텍스트 수정 전 `figma.loadFontAsync(...)`
- variable 사용 조사: `figma.variables.getVariableById(...)`

의미:

- 문서 감시와 lint 결과 push가 중요하다.
- xbridge처럼 범용 authoring API를 노출하지는 않는다.

### figma-content-buddy

- `figma.clientStorage`로 토큰/설정 저장
- `figma.loadFontAsync(...)` 후 텍스트 교체
- `figma.notify(...)`로 사용자 피드백
- 선택 기반 content replacement 흐름

의미:

- 텍스트 생성/교체 플러그인답게 selection + font loading + storage가 핵심이다.

### component-to-page

- `figma.command` 기반 명령 실행
- 선택 노드와 컴포넌트 이동/생성 위주의 직접 document mutation
- 작업 완료 후 `figma.closePlugin(...)`

의미:

- 좁은 문제를 빠르게 푸는 command plugin 전형이다.

### figma-variables-import

- `figma.teamLibrary.getAvailableLibraryVariableCollectionsAsync()`
- `figma.teamLibrary.getVariablesInLibraryCollectionAsync(...)`
- `figma.variables.getLocalVariableCollections()`
- `figma.variables.getLocalVariables()`
- `figma.variables.createVariableCollection(...)`
- `figma.variables.createVariable(...)`
- `figma.variables.importVariableByKeyAsync(...)`
- `figma.variables.createVariableAlias(...)`

의미:

- team library + variables 도메인에서는 xbridge와 가장 직접적으로 겹친다.
- 이 영역은 별도 권한과 도메인 로직이 필요하다는 점을 보여준다.

## 4. 런타임 복잡도 비교

복잡도 순으로 보면 대략 이렇게 정리된다.

1. `component-to-page`
2. `figma-content-buddy`
3. `design-lint`
4. `figma-variables-import`
5. `xbridge`

이유:

- `component-to-page`는 menu command + 짧은 UI 흐름이 핵심이다.
- `figma-content-buddy`는 selection/text AI workflow가 있지만 transport 문제는 거의 없다.
- `design-lint`는 이벤트 감시, 저장, 설정, 검사 결과 push까지 품는다.
- `figma-variables-import`는 variables/team library라는 별도 도메인 복잡성이 있다.
- xbridge는 Figma API 도메인 복잡성 위에 로컬 bridge transport 복잡성까지 추가된다.

즉 xbridge는 레퍼런스 대비 "기능이 조금 더 많은 plugin"이 아니라, 별도 시스템 구조를 품은 plugin이다.

## 5. xbridge에 대한 개선 제안

### 1. 플러그인 통신 계약을 1급 문서로 승격

현재 xbridge에서 가장 특이한 부분은 기능보다 transport다.

필요한 것:

- `ui <-> plugin code` 메시지 타입 목록
- `ui <-> localhost bridge` 이벤트/명령 목록
- command lifecycle
  - queued
  - delivered
  - ack
  - completed
  - failed
  - expired

레퍼런스 플러그인들은 이 계층이 얕아서 코드만 읽어도 되지만, xbridge는 그렇지 않다.

### 2. `figma-plugin/` 자체를 모듈화

현재 xbridge 플러그인 레이어는 역할이 많다.

- bridge health 표시
- plugin readiness 표시
- HTTP polling fallback
- SSE transport
- WebSocket transport
- runtime ops/debug UI
- command result 처리

이 정도면 `ui.js`를 단일 파일로 유지하는 비용이 크다. 최소한 다음 단위 분리가 필요하다.

- transport client
- command dispatcher
- runtime ops state collector
- UI render layer
- plugin message adapter

### 3. 브리지 정책을 manifest 문서와 함께 관리

xbridge는 `devAllowedDomains`와 `BRIDGE_URL = "http://localhost:3846"`가 제품 구조에 직접 박혀 있다.

이건 일반 플러그인과 달리 문서와 테스트가 함께 따라와야 하는 정책이다.

권장:

- 허용 도메인/포트 정책 문서화
- manifest와 README와 실제 코드 상수의 drift 검증
- 개발용/배포용 정책 분리 여부 검토

### 4. variables/team library 기능은 별도 책임으로 분리 검토

`figma-variables-import` 사례를 보면 variables 도메인만으로도 독립적인 설계가 가능하다.

xbridge에서도 variables/design-system 기능은 다음 둘 중 하나가 낫다.

- 별도 모듈로 강하게 분리
- 별도 command group과 문서 집합으로 격리

그렇지 않으면 authoring, bridge transport, variables 도메인 복잡성이 한 군데에서 엉킨다.

### 5. plugin packaging 전략을 다시 결정

비교군 다수는 번들 산출물을 manifest에 연결한다.

xbridge는 현재 구조상 로컬 개발엔 편할 수 있지만, 규모를 고려하면 둘 중 하나를 택해야 한다.

- 계속 정적 구조를 유지하되 파일 책임을 강하게 나눈다
- 아니면 plugin 레이어만 별도 빌드 파이프라인으로 승격한다

지금처럼 복잡도는 높고 packaging은 단순한 중간 상태가 가장 오래 버티기 어렵다.

## 6. xbridge 완성 관점의 우선순위

플러그인 중심으로만 보면 우선순위는 아래가 맞다.

1. 통신 계약 문서화
2. `figma-plugin/` 모듈 분리
3. manifest/domain/port 정책 정합성 자동화
4. variables/design-system command 영역 분리
5. 필요 시 plugin build 체계 재정비

## 결론

xbridge는 일반 Figma 플러그인 레퍼런스를 그대로 따라가면 안 된다. 구조가 이미 더 크고, transport가 제품 핵심이기 때문이다. 대신 이번 비교에서 얻을 수 있는 가장 실용적인 교훈은 분명하다.

- 단순 플러그인들이 공통으로 지키는 IPC 경계는 xbridge도 더 명시적으로 가져가야 한다.
- variables/team library 같은 고복잡도 영역은 별도 책임으로 다뤄야 한다.
- 로컬 브리지 정책은 구현 디테일이 아니라 제품 규약으로 취급해야 한다.

즉 xbridge의 완성도는 Figma API를 더 많이 붙이는 데서 오르지 않는다. 플러그인 레이어를 독립된 시스템으로 정리할 때 올라간다.
