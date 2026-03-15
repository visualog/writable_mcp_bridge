# Writable Bridge Port Fallback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the writable bridge resilient to local port collisions by allowing a small fallback port range shared by the server and plugin.

**Architecture:** Add a fixed list of allowed localhost origins to the Figma manifest, make the plugin probe those origins for a valid health payload, and make the server bind to the first free port in the same range.

**Tech Stack:** Node.js HTTP server, Figma Plugin UI fetch bridge, Figma manifest devAllowedDomains

---

### Task 1: Document the fallback strategy

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-port-fallback-design.md`
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-port-fallback.md`

### Task 2: Add server-side port fallback

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**Steps:**
1. Define allowed ports
2. Try binding in order
3. Preserve `PORT` override behavior
4. Extend `/health` response with a stable bridge identifier

### Task 3: Add plugin-side origin probing

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/ui.html`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/manifest.json`

**Steps:**
1. Add all allowed localhost origins to `devAllowedDomains`
2. Probe health endpoints in order
3. Persist the chosen origin in memory for the current plugin session
4. Show the connected origin in the plugin UI

### Task 4: Update README

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Steps:**
1. Document the fallback port range
2. Note that plugin restart is required after manifest changes

### Task 5: Verify

**Files:**
- Modify: none

**Steps:**
1. Run syntax checks
2. Start bridge with one port occupied
3. Confirm health on fallback port
4. Reopen plugin and confirm it binds to the fallback origin
