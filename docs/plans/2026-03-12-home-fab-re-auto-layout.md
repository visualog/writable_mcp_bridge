# home-fab-re auto layout bridge 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** `home-fab-re` 재배치 작업을 위해 로컬 Figma 브리지에 안전한 auto layout 쓰기 지원을 추가한다.

**구현 방향:** 로컬 MCP 서버와 Figma 플러그인 런타임 양쪽의 기존 `update_node`, `bulk_update_nodes` 페이로드를 확장한다. 프레임 auto layout 속성 중 제한된 하위 집합만 적용하고, 대상 노드가 이를 지원하지 않으면 명확하게 실패하도록 처리한다.

**기술 스택:** Node.js stdio MCP 서버, 로컬 HTTP 브리지, Figma Plugin API.

---

### 작업 1: 플러그인 쪽 노드 업데이트 확장

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/디자인토킹/figma-plugin/code.js`

**단계:**
1. Add a helper that applies supported auto layout properties onto a node.
2. Restrict writes to nodes exposing the corresponding fields.
3. Reuse the helper from `updateSceneNode`.
4. Keep errors explicit for unsupported nodes or invalid values.

### 작업 2: 서버 HTTP 및 MCP 스키마 확장

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/디자인토킹/src/server.js`

**단계:**
1. Add the new auto layout fields to `/api/update-node` and `/api/bulk-update-nodes` payload forwarding.
2. Add the same fields to MCP tool schemas.
3. Update tool-call handlers so MCP forwards them unchanged.

### 작업 3: 새 기능 문서화

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/디자인토킹/README.md`

**단계:**
1. Update the capability description to mention auto layout properties.
2. Keep the supported subset explicit.

### 작업 4: 검증 locally

**파일:**
- 검증: `/Users/im_018/Documents/GitHub/Project/디자인토킹/src/server.js`
- 검증: `/Users/im_018/Documents/GitHub/Project/디자인토킹/figma-plugin/code.js`

**단계:**
1. 두 파일 모두에 대해 `node --check`를 실행한다.
2. 로컬 브리지를 재시작한다.
3. Figma 플러그인을 다시 연결한다.
4. Run one `update-node` request against a target frame in `home-fab-re`.
5. Figma에서 레이아웃 변경을 확인한다.
