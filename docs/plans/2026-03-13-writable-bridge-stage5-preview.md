# Writable Bridge Stage 5 Preview Changes 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** 브리지 기반 편집을 적용 전에 검토할 수 있도록, 노드 변경에 대한 비변경성 preview API를 추가한다.

**구현 방향:** 기존 업데이트 페이로드 형태를 재사용하되, 문서를 변경하지 않고 before/after 스냅샷을 계산하는 플러그인 내부의 순수 preview serializer를 거치도록 한다. preview 기능은 HTTP와 MCP를 통해 단일 업데이트와 배치 업데이트 모두 지원하도록 노출한다.

**기술 스택:** Node.js HTTP/MCP 브리지, Figma Plugin API, 일반 JavaScript

---

### 작업 1: Stage 5 문서화

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage5-preview-design.md`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage5-preview.md`

### 작업 2: 플러그인 preview serializer 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**단계:**
1. 지원되는 업데이트 필드에 대한 현재 노드 상태를 직렬화하는 helper를 추가한다.
2. 업데이트 페이로드로부터 after-state를 계산하는 순수 projection helper를 추가한다.
3. 단일 입력과 배치 입력을 모두 처리하는 `preview_changes` 명령 핸들러를 추가한다.

### 작업 3: 서버와 MCP에 preview 노출

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**단계:**
1. Add `/api/preview-changes` endpoint.
2. Add `preview_changes` tool definition.
3. MCP 도구 디스패치를 추가한다 logic.

### 작업 4: README 업데이트

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**단계:**
1. 도구 목록에 `preview_changes`를 추가한다.
2. 이 기능이 문서를 변경하지 않으며 위험한 편집 전에 사용하도록 의도되었음을 설명한다.

### 작업 5: 검증

**파일:**
- 수정: none

**단계:**
1. Run syntax checks.
2. 브리지를 재시작한다
3. 알려진 노드에 `preview_changes`를 호출한다
4. 스크린샷이 변경되지 않는지 확인한다
