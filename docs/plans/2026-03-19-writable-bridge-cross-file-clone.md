# Cross-File Clone 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** 한 Figma 파일에서 선택한 소스 하위 트리를 스냅샷으로 저장하고, 이를 다른 연결된 파일 안에 다시 만드는 1차 cross-file clone 워크플로를 추가한다.

**구현 방향:** 기존 브리지 서버가 조율하는 소스 측 serialization helper와 대상 측 replay helper를 도입한다. 첫 단계에서는 전체 Figma scene graph 구현 없이도 구조와 핵심 스타일을 복제할 수 있도록 데이터 계약을 의도적으로 작게 유지한다.

**기술 스택:** Node.js, Figma Plugin API, MCP stdio server, node:test

---

### 작업 1: Define the snapshot contract

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/scene-snapshot.test.js`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/scene-snapshot.js`

**1단계:** Write the failing test**
- Cover supported node normalization for `FRAME`, `GROUP`, `RECTANGLE`, `TEXT`, and `INSTANCE`
- Cover depth and child-count clamping
- Cover unsupported node fallback or rejection behavior

**2단계:** Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/scene-snapshot.test.js`
Expected: FAIL because helper does not exist yet

**3단계:** Write minimal implementation**
- Add `buildSnapshotPlan`
- Add pure helpers that normalize snapshot nodes and traversal limits

**4단계:** Run test to verify it passes**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/scene-snapshot.test.js`
Expected: PASS

**5단계:** Commit**
- Commit helper + tests

### 작업 2: Expose source snapshot commands

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**1단계:** Add failing test coverage if needed for request planning**
- Add a small unit test for route/plan validation if the shared helper needs it

**2단계:** Add server route and MCP tool definition**
- Add `snapshot_selection`
- Accept explicit `pluginId`, optional `maxDepth`, and optional `maxNodes`

**3단계:** Implement plugin-side source serialization**
- Read the current selection root
- Serialize supported fields recursively
- Return one compact snapshot payload

**4단계:** 문법 검사 실행
Run:
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
Expected: PASS

**5단계:** Commit**
- Commit source snapshot support

### 작업 3: Implement target replay planning

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/replay-snapshot.test.js`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/replay-snapshot.js`

**1단계:** Write the failing test**
- Cover replay node planning for `FRAME`, `RECTANGLE`, and `TEXT`
- Cover placeholder conversion for `INSTANCE`
- Cover relative position preservation

**2단계:** Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/replay-snapshot.test.js`
Expected: FAIL because helper does not exist yet

**3단계:** Write minimal implementation**
- Add pure helpers that transform snapshot nodes into replay operations
- Keep operations compatible with existing create/update helpers

**4단계:** Run test to verify it passes**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/replay-snapshot.test.js`
Expected: PASS

**5단계:** Commit**
- Commit replay planning helper + tests

### 작업 4: Expose target replay commands

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**1단계:** Add server route and MCP tool definition**
- Add `recreate_snapshot`
- Require `pluginId`, `targetParentId`, and `snapshot`

**2단계:** Implement plugin-side replay**
- Create the new subtree under the target parent
- Reuse existing geometry/style helpers when possible
- Return created node ids and a skipped/placeholder summary

**3단계:** 문법 검사 실행
Run:
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
Expected: PASS

**4단계:** Commit**
- Commit replay support

### 작업 5: Live verify on the Apple reference flow

**파일:**
- No new files

**1단계:** Connect two plugin sessions**
- Open the Apple Community file with one plugin session
- Open the writable target file with another plugin session

**2단계:** Snapshot a small source subtree**
- Select one source block such as a header or section block
- Call `snapshot_selection`

**3단계:** Replay into the target frame**
- Target parent: `4:3`
- Call `recreate_snapshot`

**4단계:** Verify output and cleanup**
- Confirm the recreated structure exists under `4:3`
- Remove disposable verification nodes if needed

**5단계:** Commit / push**
- Push the verified implementation
