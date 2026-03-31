# Create Node 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** writable bridge를 통해 `FRAME`, `TEXT`, `RECTANGLE` 노드를 삽입할 수 있는 1차 `create_node` 명령을 추가한다.

**구현 방향:** 공용 helper에서 페이로드를 검증하고 정규화한 뒤 MCP 서버에 명령을 노출하고, 선택적 스타일링과 배치를 적용하기 전에 플러그인 런타임 내부에서 실제 Figma 노드를 생성한다.

**기술 스택:** Node.js, Figma Plugin API, MCP stdio server, node:test

---

### 작업 1: failing tests for create-node planning 추가

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/create-node.test.js`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/create-node.js`

**1단계:** Write the failing test**
- Cover supported node types, defaults, and unsupported type rejection.

**2단계:** Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/create-node.test.js`
Expected: FAIL because helper does not exist yet.

**3단계:** Write minimal implementation**
- Add `buildCreateNodePlan` and `listSupportedCreateNodeTypes`.

**4단계:** Run test to verify it passes**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/create-node.test.js`
Expected: PASS

**5단계:** Commit**
- Commit helper + tests

### 작업 2: Expose create_node in server and plugin

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**1단계:** Add server route and MCP tool definition**
- Add `/api/create-node`
- Add `create_node` tool schema

**2단계:** Implement plugin node creation**
- Create frame/text/rectangle
- Insert into parent
- Apply optional fields

**3단계:** 문법 검사 실행
Run:
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
Expected: PASS

**4단계:** Commit**
- Commit server/plugin/docs changes

### 작업 3: Live verify create_node

**파일:**
- No new files

**1단계:** Create disposable node in Figma**
- Use a safe test frame and insert one `TEXT` or `RECTANGLE`

**2단계:** Verify result**
- Confirm created payload and screenshot/metadata

**3단계:** Clean up**
- Delete disposable node

**4단계:** Commit / push**
- Push verified implementation
