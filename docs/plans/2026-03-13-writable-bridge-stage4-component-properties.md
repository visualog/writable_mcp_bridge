# Writable Bridge Stage 4 Component Properties Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add component property inspection and approved component property mutation support to the writable Figma bridge.

**Architecture:** Extend the plugin runtime with one read command and one write command around Figma instance component properties, then expose them through the HTTP bridge and MCP tool registry. Keep Stage 4 narrow by returning normalized property snapshots and allowing only single-property writes.

**Tech Stack:** Node.js HTTP/MCP bridge, Figma Plugin API, plain JavaScript

---

### Task 1: Document Stage 4 design

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage4-component-properties-design.md`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage4-component-properties.md`

**Step 1: Write the design scope and API shape**
- Document read/write commands, approval gate, normalization shape, and exclusions.

**Step 2: Save implementation checklist**
- Capture server routes, MCP tools, plugin handlers, README updates, and live verification plan.

### Task 2: Add plugin-side component property commands

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Step 1: Add normalized serializer for component properties**
- Read `componentProperties` from a node and convert to a stable JSON response.

**Step 2: Add `list_component_properties` command handler**
- Resolve target node and return normalized property metadata.

**Step 3: Add `set_component_property` command handler**
- Resolve instance node, validate property, call `setProperties`, and return refreshed property metadata.

### Task 3: Expose Stage 4 through server routes and MCP tools

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**Step 1: Add HTTP endpoints**
- `/api/list-component-properties`
- `/api/set-component-property`

**Step 2: Add tool definitions**
- `list_component_properties`
- `set_component_property`

**Step 3: Add MCP tool dispatch logic**
- Forward arguments to the plugin commands and return JSON text responses.

### Task 4: Update README

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Step 1: Add Stage 4 tools to available list**
**Step 2: Note approval rule for actual property mutation**

### Task 5: Verify

**Files:**
- Modify: none

**Step 1: Run syntax checks**
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Step 2: Restart bridge and verify `list_component_properties` live**
- Use a known instance node in the Figma file and confirm normalized property payload.

**Step 3: Do not mutate component properties without explicit approval**
- Stop after read verification unless the user explicitly approves a disposable write test.
