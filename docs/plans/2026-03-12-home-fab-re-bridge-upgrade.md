# Home FAB Re Bridge Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add rename support to the local Figma writable bridge and apply standardized English code-style layer names to the `home-FAB-re` frame only.

**Architecture:** Extend the local HTTP + stdio bridge with `rename_node` and `bulk_rename_nodes` commands, wire them through the Figma plugin runtime, then generate and apply a deterministic rename mapping for the `home-FAB-re` frame. Keep component property changes out of scope for execution and behind explicit approval.

**Tech Stack:** Node.js, custom MCP stdio server, Figma Plugin API, local HTTP bridge

---

### Task 1: Add rename command support to the Figma plugin

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/figma-plugin/code.js`

**Step 1: Add a helper to rename a single node**

- Implement `renameNode(nodeId, name)` using `figma.getNodeById`
- Return `{ id, oldName, newName, type }`

**Step 2: Add single-command handling**

- Extend `handleCommand` with `rename_node`

**Step 3: Add bulk-command handling**

- Extend `handleCommand` with `bulk_rename_nodes`

**Step 4: Keep behavior strict**

- Throw if node is missing
- Do not silently skip invalid nodes

### Task 2: Add rename routes and tool definitions to the bridge server

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/src/server.js`

**Step 1: Add HTTP endpoints**

- `POST /api/rename-node`
- `POST /api/bulk-rename-nodes`

**Step 2: Add MCP tool definitions**

- `rename_node`
- `bulk_rename_nodes`

**Step 3: Add tool dispatcher handling**

- Route MCP calls to plugin commands

**Step 4: Preserve symmetry**

- Keep payload shapes aligned between HTTP and MCP paths

### Task 3: Verify rename support locally

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/README.md`

**Step 1: Restart local bridge**

Run: `npm start`

**Step 2: Reopen plugin**

- Keep `Writable MCP Bridge` connected

**Step 3: Smoke test one safe node rename**

- Pick one low-risk node in `home-FAB-re`
- Rename and confirm response payload

**Step 4: Document usage**

- Add small README note for rename endpoints

### Task 4: Prepare deterministic rename mapping for home-FAB-re

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/디자인토킹/docs/plans/2026-03-12-home-fab-re-rename-map.md`

**Step 1: Read target frame metadata**

- Identify the exact `home-FAB-re` frame node

**Step 2: Map top-level structure**

- Header
- AI input
- Banner
- Recommendation section
- Recent section
- FAB
- Tab bar

**Step 3: Define rename pairs**

- `old nodeId + old name -> new standardized name`

**Step 4: Exclude ambiguous deep internals**

- Do not rename low-value thumbnail subdivision nodes in the first pass

### Task 5: Apply rename mapping to home-FAB-re

**Files:**
- Modify: Figma document only

**Step 1: Generate bulk rename payload**

- Use the rename map

**Step 2: Apply to target frame only**

- No structural move
- No visibility changes

**Step 3: Re-read metadata**

- Confirm new names exist

**Step 4: Capture screenshot**

- Verify no visual regression

### Task 6: Prepare next upgrade stage without executing it

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/디자인토킹/docs/plans/2026-03-12-home-fab-re-bridge-upgrade-design.md`

**Step 1: Append next-stage notes**

- `auto layout`
- `padding/gap`
- `alignment`
- `component properties require approval`

**Step 2: Stop before implementing component property writes**

- This remains approval-gated
