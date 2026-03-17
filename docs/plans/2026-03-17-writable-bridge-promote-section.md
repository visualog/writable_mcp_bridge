# promote_section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a semantic command that can preview or apply the promotion of a container section to a more primary position in a parent container.

**Architecture:** Build a pure planning helper that computes the promote operation and optional spacing normalization plan from simple node metadata, cover it with Node tests, then wire plugin/server execution around existing `moveSection` and `normalizeSpacing` primitives.

**Tech Stack:** Node.js ESM, built-in `node:test`, Figma plugin runtime, local HTTP bridge, stdio MCP.

---

### Task 1: Add failing tests for promote plan generation

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/package.json`

**Step 1: Write failing tests**
- preview plan for same-parent promotion to index 0
- noop when already primary
- spacing plan only when destination supports auto layout
- destination parent override

**Step 2: Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`
Expected: FAIL because helper module does not exist yet.

### Task 2: Implement pure section-plan helper

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/section-commands.js`
- Test: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`

**Step 1: Implement minimal helper API**
- `buildPromoteSectionPlan(tree, options)`

**Step 2: Re-run targeted tests**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`
Expected: PASS

### Task 3: Wire plugin runtime command

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Step 1: Add command implementation**
- resolve source section node and destination parent
- build plan
- if previewOnly, return plan only
- if apply, call `moveSection`
- if requested and allowed, run `normalizeSpacing`

### Task 4: Wire server + MCP tool

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Step 1: Add HTTP endpoint**
- `/api/promote-section`

**Step 2: Add MCP tool schema**
- `promote_section`

### Task 5: Verify and commit

**Step 1: Run checks**
Run:
- `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Step 2: Live verification**
- previewOnly first on a disposable container section
- apply only if preview is correct

**Step 3: Commit and push**
```bash
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge add README.md docs/plans figma-plugin/code.js package.json src tests
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge commit -m "feat: add promote section command"
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge push origin main
```
