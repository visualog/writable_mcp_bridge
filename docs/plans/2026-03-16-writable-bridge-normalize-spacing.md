# Writable Bridge Normalize Spacing 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** 명시적으로 지정한 auto layout 컨테이너와 선택적 하위 컨테이너 트리에 대해 의미 기반 spacing normalizer를 추가한다.

**구현 방향:** 대상 컨테이너(그리고 선택적으로 조건에 맞는 하위 노드)를 순회해 의미 기반 요청을 구체적인 `update_node` 페이로드로 변환하고, 기존 저수준 업데이트 로직으로 적용한 뒤 `undo_last_batch`용 역방향 배치를 기록한다.

**기술 스택:** Node.js HTTP/MCP 브리지, Figma Plugin API, 일반 JavaScript

---

### 작업 1: 범위 문서화

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-normalize-spacing-design.md`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-normalize-spacing.md`

### 작업 2: 플러그인 쪽 normalize_spacing helper 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**단계:**
1. auto layout 컨테이너 탐색 helper를 추가한다.
2. 의미 기반 spacing 입력으로부터 구체적인 `update_node` 페이로드를 만든다.
3. undo를 위한 역방향 preview를 수집한다.
4. `handleCommand`에 `normalize_spacing`을 노출한다.

### 작업 3: 서버와 MCP에 normalize_spacing 노출

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**단계:**
1. `/api/normalize-spacing`를 추가한다
2. `normalize_spacing` 도구 정의를 추가한다
3. MCP 도구 디스패치를 추가한다

### 작업 4: README 업데이트

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**단계:**
1. 도구 목록에 `normalize_spacing`을 추가한다
2. 명시적 대상 지정과 선택적 재귀 동작을 문서에 명시한다

### 작업 5: 검증

**파일:**
- 수정: none

**단계:**
1. 문법 검사를 실행한다
2. 커밋하고 푸시한다
3. 소모 가능한 auto layout 하위 트리가 선택될 때까지 라이브 검증을 미룬다
