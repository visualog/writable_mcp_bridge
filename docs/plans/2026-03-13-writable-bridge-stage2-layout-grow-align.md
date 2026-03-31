# writable bridge stage2 layout grow/align 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** writable Figma 브리지에 `layoutGrow`와 `layoutAlign` 쓰기 지원을 추가한다.

**구현 방향:** 플러그인 런타임과 MCP/HTTP 브리지 양쪽의 공용 노드 업데이트 경로를 확장해, 이 자식 레벨 auto layout 속성이 동일한 `update_node`, `bulk_update_nodes` 명령을 통해 흐르도록 한다. 노드 타입 검증은 명시적으로 유지하고 기존 업데이트 파이프라인을 재사용한다.

**기술 스택:** Node.js stdio MCP 서버, 로컬 HTTP 브리지, Figma Plugin API.

---

### 작업 1: 플러그인 노드 업데이트 확장

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**단계:**
1. Add `layoutGrow` and `layoutAlign` to the editable auto layout field set.
2. Reuse the existing property application flow.
3. Keep unsupported-node errors explicit.

### 작업 2: 서버 페이로드 전달 확장

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**단계:**
1. Add `layoutGrow` and `layoutAlign` to `/api/update-node`.
2. 같은 필드를 `/api/bulk-update-nodes`에도 추가한다.
3. Extend MCP input schemas for `update_node` and `bulk_update_nodes`.
4. Forward the new fields inside `handleToolCall`.

### 작업 3: 문서 업데이트

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**단계:**
1. Mention `layoutGrow` and `layoutAlign` in the supported auto layout field list.

### 작업 4: 검증

**파일:**
- 검증: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- 검증: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**단계:**
1. 두 파일 모두에 대해 `node --check`를 실행한다.
2. `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge`에서 브리지를 재시작한다.
3. Figma 플러그인을 다시 연다.
4. Run one live test that changes child layout behavior inside an auto layout parent.
