# Create Node Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first-slice `create_node` command for inserting `FRAME`, `TEXT`, and `RECTANGLE` nodes through the writable bridge.

**Architecture:** Validate and normalize payloads in a shared helper, expose the command in the MCP server, and create the actual Figma nodes inside the plugin runtime before applying optional styling and placement.

**Tech Stack:** Node.js, Figma Plugin API, MCP stdio server, node:test

---

### Task 1: Add failing tests for create-node planning

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/create-node.test.js`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/create-node.js`

**Step 1: Write the failing test**
- Cover supported node types, defaults, and unsupported type rejection.

**Step 2: Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/create-node.test.js`
Expected: FAIL because helper does not exist yet.

**Step 3: Write minimal implementation**
- Add `buildCreateNodePlan` and `listSupportedCreateNodeTypes`.

**Step 4: Run test to verify it passes**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/create-node.test.js`
Expected: PASS

**Step 5: Commit**
- Commit helper + tests

### Task 2: Expose create_node in server and plugin

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Step 1: Add server route and MCP tool definition**
- Add `/api/create-node`
- Add `create_node` tool schema

**Step 2: Implement plugin node creation**
- Create frame/text/rectangle
- Insert into parent
- Apply optional fields

**Step 3: Run syntax checks**
Run:
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
Expected: PASS

**Step 4: Commit**
- Commit server/plugin/docs changes

### Task 3: Live verify create_node

**Files:**
- No new files

**Step 1: Create disposable node in Figma**
- Use a safe test frame and insert one `TEXT` or `RECTANGLE`

**Step 2: Verify result**
- Confirm created payload and screenshot/metadata

**Step 3: Clean up**
- Delete disposable node

**Step 4: Commit / push**
- Push verified implementation
