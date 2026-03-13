# writable bridge stage2 layout grow/align Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `layoutGrow` and `layoutAlign` write support to the writable Figma bridge.

**Architecture:** Extend the shared node update path in both the plugin runtime and the MCP/HTTP bridge so these child-level auto layout properties flow through the same `update_node` and `bulk_update_nodes` commands. Keep node-type validation explicit and reuse the existing update pipeline.

**Tech Stack:** Node.js stdio MCP server, local HTTP bridge, Figma Plugin API.

---

### Task 1: Extend plugin node updates

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
1. Add `layoutGrow` and `layoutAlign` to the editable auto layout field set.
2. Reuse the existing property application flow.
3. Keep unsupported-node errors explicit.

### Task 2: Extend server payload forwarding

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**Steps:**
1. Add `layoutGrow` and `layoutAlign` to `/api/update-node`.
2. Add them to `/api/bulk-update-nodes`.
3. Extend MCP input schemas for `update_node` and `bulk_update_nodes`.
4. Forward the new fields inside `handleToolCall`.

### Task 3: Update docs

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Steps:**
1. Mention `layoutGrow` and `layoutAlign` in the supported auto layout field list.

### Task 4: Verify

**Files:**
- Verify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- Verify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
1. Run `node --check` on both files.
2. Restart the bridge from `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge`.
3. Reopen the Figma plugin.
4. Run one live test that changes child layout behavior inside an auto layout parent.
