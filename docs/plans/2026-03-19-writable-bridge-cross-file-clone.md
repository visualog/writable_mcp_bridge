# Cross-File Clone Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first-slice cross-file clone workflow that snapshots a selected source subtree in one Figma file and recreates it inside another connected file.

**Architecture:** Introduce a source-side serialization helper plus a target-side replay helper, both coordinated by the existing bridge server. Keep the data contract intentionally small so the first slice can clone structure and core styling without requiring a full Figma scene graph implementation.

**Tech Stack:** Node.js, Figma Plugin API, MCP stdio server, node:test

---

### Task 1: Define the snapshot contract

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/scene-snapshot.test.js`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/scene-snapshot.js`

**Step 1: Write the failing test**
- Cover supported node normalization for `FRAME`, `GROUP`, `RECTANGLE`, `TEXT`, and `INSTANCE`
- Cover depth and child-count clamping
- Cover unsupported node fallback or rejection behavior

**Step 2: Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/scene-snapshot.test.js`
Expected: FAIL because helper does not exist yet

**Step 3: Write minimal implementation**
- Add `buildSnapshotPlan`
- Add pure helpers that normalize snapshot nodes and traversal limits

**Step 4: Run test to verify it passes**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/scene-snapshot.test.js`
Expected: PASS

**Step 5: Commit**
- Commit helper + tests

### Task 2: Expose source snapshot commands

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Step 1: Add failing test coverage if needed for request planning**
- Add a small unit test for route/plan validation if the shared helper needs it

**Step 2: Add server route and MCP tool definition**
- Add `snapshot_selection`
- Accept explicit `pluginId`, optional `maxDepth`, and optional `maxNodes`

**Step 3: Implement plugin-side source serialization**
- Read the current selection root
- Serialize supported fields recursively
- Return one compact snapshot payload

**Step 4: Run syntax checks**
Run:
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
Expected: PASS

**Step 5: Commit**
- Commit source snapshot support

### Task 3: Implement target replay planning

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/replay-snapshot.test.js`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/replay-snapshot.js`

**Step 1: Write the failing test**
- Cover replay node planning for `FRAME`, `RECTANGLE`, and `TEXT`
- Cover placeholder conversion for `INSTANCE`
- Cover relative position preservation

**Step 2: Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/replay-snapshot.test.js`
Expected: FAIL because helper does not exist yet

**Step 3: Write minimal implementation**
- Add pure helpers that transform snapshot nodes into replay operations
- Keep operations compatible with existing create/update helpers

**Step 4: Run test to verify it passes**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/replay-snapshot.test.js`
Expected: PASS

**Step 5: Commit**
- Commit replay planning helper + tests

### Task 4: Expose target replay commands

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Step 1: Add server route and MCP tool definition**
- Add `recreate_snapshot`
- Require `pluginId`, `targetParentId`, and `snapshot`

**Step 2: Implement plugin-side replay**
- Create the new subtree under the target parent
- Reuse existing geometry/style helpers when possible
- Return created node ids and a skipped/placeholder summary

**Step 3: Run syntax checks**
Run:
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
Expected: PASS

**Step 4: Commit**
- Commit replay support

### Task 5: Live verify on the Apple reference flow

**Files:**
- No new files

**Step 1: Connect two plugin sessions**
- Open the Apple Community file with one plugin session
- Open the writable target file with another plugin session

**Step 2: Snapshot a small source subtree**
- Select one source block such as a header or section block
- Call `snapshot_selection`

**Step 3: Replay into the target frame**
- Target parent: `4:3`
- Call `recreate_snapshot`

**Step 4: Verify output and cleanup**
- Confirm the recreated structure exists under `4:3`
- Remove disposable verification nodes if needed

**Step 5: Commit / push**
- Push the verified implementation
