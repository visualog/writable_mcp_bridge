# Writable Bridge Stage 4 Component Properties 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** writable Figma 브리지에 컴포넌트 프로퍼티 조회와 승인 기반 컴포넌트 프로퍼티 변경 지원을 추가한다.

**구현 방향:** Figma 인스턴스 컴포넌트 프로퍼티를 다루는 읽기 명령 하나와 쓰기 명령 하나를 플러그인 런타임에 추가한 뒤, 이를 HTTP 브리지와 MCP 도구 레지스트리에 노출한다. Stage 4는 정규화된 프로퍼티 스냅샷을 반환하고 단일 프로퍼티 쓰기만 허용하는 좁은 범위로 유지한다.

**기술 스택:** Node.js HTTP/MCP 브리지, Figma Plugin API, 일반 JavaScript

---

### 작업 1: Stage 4 design 문서화

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage4-component-properties-design.md`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage4-component-properties.md`

**1단계:** 설계 범위와 API 형태 작성
- read/write commands, approval gate, normalization shape, and exclusions. 문서화

**2단계:** 구현 체크리스트 정리
- 서버 라우트, MCP 도구, 플러그인 핸들러, README 업데이트, 라이브 검증 계획을 정리한다.

### 작업 2: 플러그인 쪽 component property commands 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**1단계:** 컴포넌트 프로퍼티용 정규화 serializer 추가
- Read `componentProperties` from a node and convert to a stable JSON response.

**2단계:** `list_component_properties` 명령 핸들러 추가
- 대상 노드를 해석하고 정규화된 프로퍼티 메타데이터를 반환한다.

**3단계:** `set_component_property` 명령 핸들러 추가
- 인스턴스 노드를 해석하고 프로퍼티를 검증한 뒤 `setProperties`를 호출하고, 갱신된 프로퍼티 메타데이터를 반환한다.

### 작업 3: Stage 4를 서버 라우트와 MCP 도구로 노출

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**1단계:** HTTP 엔드포인트 추가
- `/api/list-component-properties`
- `/api/set-component-property`

**2단계:** 도구 정의 추가
- `list_component_properties`
- `set_component_property`

**3단계:** MCP 도구 디스패치를 추가한다 logic**
- 인자를 플러그인 명령으로 전달하고 JSON 텍스트 응답을 반환한다.

### 작업 4: README 업데이트

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**1단계:** 사용 가능한 도구 목록에 Stage 4 도구 추가
**2단계:** 실제 프로퍼티 변경에 대한 승인 규칙 명시

### 작업 5: 검증

**파일:**
- 수정: none

**1단계:** 문법 검사 실행
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**2단계:** 브리지를 재시작하고 `list_component_properties` 라이브 검증
- Figma 파일의 알려진 인스턴스 노드를 사용해 정규화된 프로퍼티 페이로드를 확인한다.

**3단계:** 명시적 승인 없이 컴포넌트 프로퍼티 변경 금지
- 사용자가 소모성 쓰기 테스트를 명시적으로 승인하지 않으면 읽기 검증 후 중단한다.
