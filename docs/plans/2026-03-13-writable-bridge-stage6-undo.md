# Writable Bridge Stage 6 Undo Last Batch Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add in-memory undo support for the last supported mutation batch in the writable Figma bridge.

**Architecture:** Record inverse operations inside the plugin runtime immediately before each supported mutation. Store only one batch in memory and replay it in reverse order when `undo_last_batch` is called.

**Tech Stack:** Node.js HTTP/MCP bridge, Figma Plugin API, plain JavaScript

---

### Task 1: Document Stage 6 scope

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage6-undo-design.md`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage6-undo.md`

### Task 2: Add plugin-side undo history

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
1. Add single-batch in-memory undo storage.
2. Add helpers to capture inverse text, rename, and node update steps.
3. Record inverse batches before supported mutations.
4. Add `undo_last_batch` command handler.

### Task 3: Expose undo through server and MCP

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**Steps:**
1. Add `/api/undo-last-batch`
2. Add `undo_last_batch` tool definition
3. Add MCP tool dispatch

### Task 4: Update README

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Steps:**
1. Add `undo_last_batch` to tool list
2. Clarify the supported undo scope and the single-session limitation

### Task 5: Verify

**Files:**
- Modify: none

**Steps:**
1. Run syntax checks
2. Defer live verification until the bridge server can bind to `127.0.0.1:3845` again
