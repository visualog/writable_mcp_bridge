# Mobile Screen Naming Rule Implementation Plan

**Goal:** Add a reusable `mobile-detail-screen` preset to `apply_naming_rule` so iOS-like detail screens can be renamed into a stable, short-name hierarchy.

**Architecture:** Extend the runtime naming-rule planner first, then mirror the new preset in server enums and documentation. Keep the logic preview-first and pattern-mapped, with no structural mutations.

**Tech Stack:** Node.js ESM, Figma plugin runtime, local HTTP bridge, stdio MCP.

---

### Task 1: Add new supported preset

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/2026_important/writable_mcp_bridge/figma-plugin/code.js`
- Modify: `/Users/im_018/Documents/GitHub/2026_important/writable_mcp_bridge/src/server.js`

**Steps:**
- add `mobile-detail-screen` to supported naming presets
- expose it through MCP and HTTP schema enums

### Task 2: Implement runtime pattern matching

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/2026_important/writable_mcp_bridge/figma-plugin/code.js`

**Steps:**
- detect portrait screen roots
- identify header and content sections
- detect status bar and nav rows
- detect media block and title/date group
- emit deterministic rename proposals using local role names only, not repeated full paths

### Task 3: Add preview verification workflow

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/2026_important/writable_mcp_bridge/README.md`

**Steps:**
- document when to use `mobile-detail-screen`
- show `previewOnly=true` usage first
- include one example outcome tree with short local names

### Task 4: Optional tests

**Files:**
- Modify or add test coverage if the repo introduces naming-rule unit tests for the current runtime planner

**Steps:**
- validate header/content/media/title grouping behavior
- validate duplicate-name skipping
- validate unmatched decorative nodes stay unchanged

### Task 5: Verification

**Checks:**
- `node --check /Users/im_018/Documents/GitHub/2026_important/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/2026_important/writable_mcp_bridge/figma-plugin/code.js`
- run `apply_naming_rule` in preview mode against a connected mobile-detail frame

## Recommended rollout
1. implement preset in preview mode only during manual verification
2. validate against the current ticket-detail screen
3. broaden to adjacent mobile layouts only after stable results
