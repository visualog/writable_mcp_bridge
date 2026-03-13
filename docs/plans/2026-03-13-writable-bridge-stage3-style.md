# writable bridge stage3 style controls Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `cornerRadius` and `opacity` write support to the writable Figma bridge.

**Architecture:** Extend the shared node update path in the plugin runtime and the MCP/HTTP bridge so these style properties flow through the existing `update_node` and `bulk_update_nodes` commands. Keep property support checks explicit per node type and avoid widening into strokes or effects.

**Tech Stack:** Node.js stdio MCP server, local HTTP bridge, Figma Plugin API.

---

### Task 1: Extend plugin node updates

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
1. Accept `cornerRadius` and `opacity` in the shared node update function.
2. Apply each field only when the node exposes it.
3. Return the updated values in the response payload where possible.

### Task 2: Extend server payload forwarding

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**Steps:**
1. Add `cornerRadius` and `opacity` to `/api/update-node`.
2. Add them to `/api/bulk-update-nodes`.
3. Extend the MCP schemas for `update_node` and `bulk_update_nodes`.
4. Forward the fields inside `handleToolCall`.

### Task 3: Update docs

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Steps:**
1. Mention `cornerRadius` and `opacity` in the supported editing capabilities.

### Task 4: Verify

**Files:**
- Verify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- Verify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
1. Run `node --check` on both files.
2. Restart the bridge from `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge`.
3. Reopen the Figma plugin.
4. Duplicate a disposable card.
5. Apply `cornerRadius` and `opacity`.
6. Confirm success.
7. Delete the duplicate and restore the test frame to normal.
