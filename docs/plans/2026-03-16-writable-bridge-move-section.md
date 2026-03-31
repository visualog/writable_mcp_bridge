# Writable Bridge Move Section 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** 이미 검증된 저수준 move와 reorder primitive를 사용해 컨테이너 섹션을 이동하는 명시적 의미 기반 helper를 추가한다.

**구현 방향:** `move_section`은 좁은 범위로 유지한다. 플러그인은 컨테이너 형태의 대상을 검증한 뒤 기존 move/reorder 로직으로 작업을 넘기고, 서버는 전용 HTTP 및 MCP 인터페이스를 통해 이 helper를 노출한다.

**기술 스택:** Node.js HTTP/MCP 브리지, Figma Plugin API, 일반 JavaScript

---

### 작업 1: 범위 문서화

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-move-section-design.md`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-move-section.md`

### 작업 2: 플러그인 쪽 move_section helper 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**단계:**
1. 컨테이너 검증 helper를 추가한다.
2. `moveNode`/`reorderChild`를 사용하는 `moveSection`을 추가한다.
3. `handleCommand`에 `move_section`을 노출한다.

### 작업 3: 서버와 MCP에 move_section 노출

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**단계:**
1. Add `/api/move-section`
2. Add `move_section` tool definition
3. MCP 도구 디스패치를 추가한다

### 작업 4: README 업데이트

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**단계:**
1. 사용 가능한 도구 목록에 `move_section`을 추가한다
2. 컨테이너 이동을 감싼 의미 기반 helper로 설명한다

### 작업 5: 검증

**파일:**
- 수정: none

**단계:**
1. 문법 검사를 실행한다
2. 안정적인 소모성 컨테이너 스택이 선택될 때까지 라이브 검증을 미룬다
