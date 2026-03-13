# home-fab-re auto layout bridge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add safe auto layout write support to the local Figma bridge for `home-fab-re` rearrangement work.

**Architecture:** Extend the existing `update_node` and `bulk_update_nodes` payloads in both the local MCP server and the Figma plugin runtime. Apply only a constrained subset of frame auto layout properties and fail clearly when a target node does not support them.

**Tech Stack:** Node.js stdio MCP server, local HTTP bridge, Figma Plugin API.

---

### Task 1: Extend plugin-side node updates

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/figma-plugin/code.js`

**Steps:**
1. Add a helper that applies supported auto layout properties onto a node.
2. Restrict writes to nodes exposing the corresponding fields.
3. Reuse the helper from `updateSceneNode`.
4. Keep errors explicit for unsupported nodes or invalid values.

### Task 2: Extend server HTTP and MCP schemas

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/src/server.js`

**Steps:**
1. Add the new auto layout fields to `/api/update-node` and `/api/bulk-update-nodes` payload forwarding.
2. Add the same fields to MCP tool schemas.
3. Update tool-call handlers so MCP forwards them unchanged.

### Task 3: Document new capabilities

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/README.md`

**Steps:**
1. Update the capability description to mention auto layout properties.
2. Keep the supported subset explicit.

### Task 4: Verify locally

**Files:**
- Verify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/src/server.js`
- Verify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/figma-plugin/code.js`

**Steps:**
1. Run `node --check` on both files.
2. Restart the local bridge.
3. Reconnect the Figma plugin.
4. Run one `update-node` request against a target frame in `home-fab-re`.
5. Confirm the layout change in Figma.
