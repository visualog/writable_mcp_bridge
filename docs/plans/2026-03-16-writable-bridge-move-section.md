# Writable Bridge Move Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an explicit semantic helper for moving container sections using the already validated low-level move and reorder primitives.

**Architecture:** Keep `move_section` narrow. The plugin validates a container-like target and forwards the operation to existing move/reorder logic, while the server exposes the helper through dedicated HTTP and MCP surfaces.

**Tech Stack:** Node.js HTTP/MCP bridge, Figma Plugin API, plain JavaScript

---

### Task 1: Document scope

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-move-section-design.md`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-move-section.md`

### Task 2: Add plugin-side move_section helper

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
1. Add container validation helper.
2. Add `moveSection` that uses `moveNode`/`reorderChild`.
3. Expose `move_section` in `handleCommand`.

### Task 3: Expose move_section through server and MCP

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**Steps:**
1. Add `/api/move-section`
2. Add `move_section` tool definition
3. Add MCP tool dispatch

### Task 4: Update README

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Steps:**
1. Add `move_section` to the available tool list
2. Describe it as a semantic helper over container moves

### Task 5: Verify

**Files:**
- Modify: none

**Steps:**
1. Run syntax checks
2. Defer live verification until a stable disposable container stack is selected
