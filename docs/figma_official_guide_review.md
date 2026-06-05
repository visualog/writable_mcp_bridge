# Xbridge Figma 공식 가이드 대조 검토 리포트

본 문서는 Figma 공식 플러그인 개발 가이드(developers.figma.com)의 최신 기준과 Xbridge 프로젝트의 실제 구현 사항(`figma-plugin/manifest.json`, `figma-plugin/code.js` 등)을 대조하여 검토한 결과입니다.

---

## 📌 요약 및 핵심 발견사항

Xbridge는 Figma 플러그인의 샌드박스 실행 모델(Main Thread vs UI Iframe)을 모범적으로 준수하여 설계되어 있습니다. 하지만 **Figma의 최신 성능 정책 및 신규 API 스펙 대비 누락된 설정과 아키텍처적 개선 기회**가 발견되었습니다.

| 심각도 | 항목 | 공식 가이드 기준 | Xbridge 현황 및 영향 | 조치 권고사항 |
| :--- | :--- | :--- | :--- | :--- |
| 🔴 **필수** | `documentAccess` 설정 누락 (비동기 페이지 로딩 미지원) | 신규 플러그인의 경우 `"documentAccess": "dynamic-page"` 설정 필수. | `manifest.json`에 선언되지 않아 플러그인 시작 시 전체 파일의 모든 페이지가 강제 로드됨. 대용량 파일에서 성능 저하 유발. | `manifest.json`에 `dynamic-page`를 추가하고 `code.js` 내에 `figma.loadPageAsync()` 연동 구현. |
| 🔴 **확인** | 샌드박스 메인 스레드 네트워크 통신 제약 준수 | 메인 샌드박스 스레드에서는 `fetch`, `WebSocket` 등 브라우저 API 호출 불가. | `code.js` 내부에서 직접적인 네트워크 호출이 없음을 확인. UI 스레드(`ui.html`/`ui.js`)를 통해 로컬 브리지와 정상 통신 중. | (현재 아키텍처 유지) UI 스레드 기반 메시징 통신 구조 유지. |
| 🟡 **권장** | DS Registry와 Figma Variables API의 통합 미흡 | Figma Variables API (`setBoundVariable`, `setBoundVariableForPaint`)를 통한 토큰 바인딩 권장. | `code.js`에 바인딩 헬퍼는 존재하지만, `ds-registry.js` 내부 토큰이 하드코딩 hex 값으로 고정되어 Variable API의 장점을 100% 활용하지 못함. | `ds-registry.js` 스키마를 Variable Key 참조 구조로 개선하고 레이아웃 빌더(`build-layout.js`)와 연동 강화. |
| ℹ️ **참고** | 개발 전용 네트워크 권한 설정 및 API 버전 | `devAllowedDomains` 내 localhost 허용 시 `reasoning` 생략 가능. | `devAllowedDomains`에 로컬 브리지 주소만 등록되어 있어 규칙에 부합함. 단, 프로덕션 배포 시 `allowedDomains` 및 `reasoning` 보완 필요. | 향후 배포 및 릴리즈 단계에서 프로덕션 브리지 도메인에 대한 reasoning 정책 수립. |

---

## 🔍 상세 검토 및 분석

### 1. `documentAccess: "dynamic-page"` 누락 (🔴 필수 해결)
Figma 공식 문서에 따르면, 2024년 이후에 출시 또는 업데이트되는 모든 플러그인은 성능 최적화를 위해 **동적 페이지 로딩(`dynamic-page`)** 구조를 도입해야 합니다.

*   **공식 가이드:** 
    > *"This field is required for all new plugins. The value must be dynamic-page."*
    > 플러그인이 실행될 때 Figma 파일의 첫 페이지나 활성화된 페이지만 먼저 불러오고, 다른 페이지의 노드에 접근하려면 `figma.loadPageAsync(page)`를 명시적으로 호출해 메모리에 로드해야 합니다.
*   **현재 Xbridge 구현:** 
    [`manifest.json`](file:///Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/figma-plugin/manifest.json)에 `documentAccess` 속성이 정의되어 있지 않습니다.
*   **문제점:** 
    사용자가 수십~수백 개의 페이지가 포함된 대형 디자인 시스템 파일에서 Xbridge를 실행할 때, Figma가 전체 페이지를 강제로 읽어들이는 팝업(`"Loading n pages for plugin..."`)이 노출되며 초기 구동 속도가 대폭 느려집니다.
*   **개선안:**
    1. [`manifest.json`](file:///Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/figma-plugin/manifest.json)에 `"documentAccess": "dynamic-page"` 추가.
    2. 플러그인이 여러 페이지를 조회/수정할 때(예: `code.js` 내부에서 다른 페이지의 컴포넌트나 스타일을 가져오는 상황) `await figma.loadPageAsync(targetPage)`가 선행되도록 로직 보완.

### 2. 메인 스레드 샌드박스 제약 준수 (✅ 우수)
Figma 플러그인은 Figma API를 직접 조작하는 메인 스레드(JS Sandbox)와 화면 및 외부 통신을 담당하는 UI 스레드(Iframe)가 격리되어 실행됩니다.

*   **공식 가이드:** 
    > 메인 스레드 샌드박스 내부에서는 `fetch`, `XMLHttpRequest`, `WebSocket`, `setTimeout`, `DOM` API를 사용할 수 없습니다. 모든 외부 네트워크 요청은 UI iframe 내에서 수행되어야 합니다.
*   **현재 Xbridge 구현:** 
    [`figma-plugin/code.js`](file:///Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/figma-plugin/code.js)를 분석한 결과, 네트워크 요청을 시도하는 브라우저 API가 존재하지 않으며, `figma.ui.onmessage` 핸들러(라인 5439)를 통해 UI 스레드로부터 전달받은 명령어(`execute_command` 등)를 Figma API로 순수하게 수행만 하고 있습니다.
*   **평가:** 
    Figma의 플러그인 샌드박스 통신 모델을 매우 정확하게 준수하고 있으며, 메인 스레드와 브리지 서버 간의 직접 통신을 시도하는 등의 구조적 오류는 발견되지 않았습니다.

### 3. Variables & Styles API 활용 방안 (🟡 권장)
Xbridge는 컴포넌트를 설계하고 구성하는 "DS-Aware Canvas" 로드맵을 지향하고 있습니다.

*   **공식 가이드:** 
    Figma는 노드의 다양한 속성에 디자인 토큰을 연결할 수 있는 Variables API (`setBoundVariable`, `setBoundVariableForPaint`) 및 Local Styles API를 제공합니다.
*   **현재 Xbridge 구현:** 
    [`figma-plugin/code.js`](file:///Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/figma-plugin/code.js)의 `bindVariable` 함수(라인 1976)와 [`src/bind-variable.js`](file:///Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/src/bind-variable.js)를 통해 공식 Variables API를 호출할 수 있는 기반 코드는 마련되어 있습니다.
    그러나 `ds-registry.js`에 등록된 색상 및 스타일 토큰들이 hex 하드코딩 값(예: `fill: "#F5F6FA"`)으로 구성되어 있어, 실제로 이 토큰들을 Variable로 캔버스에 바인딩하지 못하고 단순 literal 값으로 채우고 있습니다.
*   **개선안:** 
    디자인 시스템 연동 고도화 단계에서 `ds-registry.js` 내 토큰 정의를 HSL/HEX 리터럴 대신, 실제 Figma Variable을 가리키는 Variable Key(예: `Variable.key`)나 변수 이름으로 매핑하고, 레이아웃을 구성하는 시점에 `bindVariable`을 통해 Figma Variable Binding을 공식적으로 적용해야 합니다.

### 4. 네트워크 접근 권한 및 배포 대비 (`networkAccess`) (ℹ️ 참고)
*   **공식 가이드:** 
    `manifest.json`에서 `allowedDomains`에 `localhost`를 추가하면 승인 심사 시 거절 사유가 되거나 상세한 `reasoning`을 요구합니다. 개발 시에는 `devAllowedDomains`에 등록하는 방식을 권장합니다.
*   **현재 Xbridge 구현:** 
    `allowedDomains`는 `["none"]`으로 되어 있으며, 개발 서버(`localhost:3846`)는 `devAllowedDomains`에 정의되어 있습니다.
*   **평가:** 
    공식 개발 가이드에 부합하게 작성되어 있으며, 별도의 reasoning 설정 없이 로컬 브리지와 문제없이 개발/테스트를 수행할 수 있는 올바른 형태입니다. 향후 실서비스 배포 시에는 로컬 서버가 아닌 실제 브리지 도메인으로 전환하면서 `allowedDomains` 및 적절한 `reasoning` 작성이 수반되어야 합니다.

---

## 🛠️ 권장 개선 Action Item

1.  **`manifest.json` 개선**
    *   `"documentAccess": "dynamic-page"` 명시적으로 선언하기.
2.  **`code.js` 내 Dynamic Page 로딩 로직 검증**
    *   특정 페이지에서 다른 페이지의 인스턴스를 가져오거나, 라이브러리를 탐색하는 API를 호출할 때 `figma.loadPageAsync`가 정상적으로 트리거되는지 코드베이스 확인.
3.  **DS Registry와 Variable API 결합 설계**
    *   `ds-registry.js` 내 리터럴 값들을 Figma Variable Binding이 가능한 구조로 발전시키는 설계 계획을 마일스톤에 반영.
