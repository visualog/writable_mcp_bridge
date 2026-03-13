# Writable Bridge Stage 5 Preview Changes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a non-mutating preview API for node changes so bridge-driven edits can be reviewed before apply.

**Architecture:** Reuse the existing update payload shape, but route it through a pure preview serializer in the plugin that calculates before/after snapshots without touching the document. Expose the preview through HTTP and MCP with both single-update and batch support.

**Tech Stack:** Node.js HTTP/MCP bridge, Figma Plugin API, plain JavaScript

---

### Task 1: Document Stage 5

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage5-preview-design.md`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage5-preview.md`

### Task 2: Add plugin preview serializer

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
1. Add helpers to serialize current node state for supported update fields.
2. Add a pure projection helper that computes after-state from an update payload.
3. Add `preview_changes` command handler for single and batch inputs.

### Task 3: Expose preview through server and MCP

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**Steps:**
1. Add `/api/preview-changes` endpoint.
2. Add `preview_changes` tool definition.
3. Add MCP tool dispatch logic.

### Task 4: Update README

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Steps:**
1. Add `preview_changes` to tool list.
2. Explain that it is non-mutating and intended to be used before risky edits.

### Task 5: Verify

**Files:**
- Modify: none

**Steps:**
1. Run syntax checks.
2. Restart bridge.
3. Call `preview_changes` on a known node.
4. Confirm screenshot does not change.
