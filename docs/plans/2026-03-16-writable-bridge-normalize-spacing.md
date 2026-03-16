# Writable Bridge Normalize Spacing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a semantic spacing normalizer for explicit auto layout containers and their optional descendant container subtree.

**Architecture:** Traverse a target container (and optionally matching descendants), convert the semantic request into concrete `update_node` payloads, apply them with existing low-level update logic, and record the inverse batch for `undo_last_batch`.

**Tech Stack:** Node.js HTTP/MCP bridge, Figma Plugin API, plain JavaScript

---

### Task 1: Document scope

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-normalize-spacing-design.md`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-normalize-spacing.md`

### Task 2: Add plugin-side normalize_spacing helper

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
1. Add auto layout container discovery helpers.
2. Build concrete `update_node` payloads from semantic spacing inputs.
3. Capture inverse previews for undo.
4. Expose `normalize_spacing` in `handleCommand`.

### Task 3: Expose normalize_spacing through server and MCP

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**Steps:**
1. Add `/api/normalize-spacing`
2. Add `normalize_spacing` tool definition
3. Add MCP tool dispatch

### Task 4: Update README

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Steps:**
1. Add `normalize_spacing` to the tool list
2. Note the explicit target and optional recursive behavior

### Task 5: Verify

**Files:**
- Modify: none

**Steps:**
1. Run syntax checks
2. Commit and push
3. Defer live verification until a disposable auto layout subtree is selected
