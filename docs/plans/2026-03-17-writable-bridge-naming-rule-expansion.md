# Naming Rule Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend `apply_naming_rule` with reusable scaffolding-oriented and AI-chat-specific naming presets.

**Architecture:** Update the pure naming-rule helper first, covering both new rule sets with deterministic tests. Then mirror the same rule-set support in the plugin runtime naming planner and expose the new presets through the server schema.

**Tech Stack:** Node.js ESM, built-in `node:test`, Figma plugin runtime, local HTTP bridge, stdio MCP.

---

### Task 1: Add failing tests for new rule sets

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`

**Step 1: Write failing tests**
- `content-screen-basic` should map `header`, `body`, `footer`
- `ai-chat-screen` should map chat screen blocks into `screen/*` names

**Step 2: Run tests to verify they fail**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
Expected: FAIL because the new rule sets are unsupported.

### Task 2: Implement helper support

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/naming-rules.js`

**Step 1: Add new supported rule sets**
- `content-screen-basic`
- `ai-chat-screen`

**Step 2: Implement deterministic mapping logic**
- generic scaffold first
- AI-specific overrides second

**Step 3: Re-run tests**
Expected: PASS

### Task 3: Mirror plugin runtime support

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Step 1: Extend runtime supported rule sets**
**Step 2: Mirror the new mapping behavior in runtime planner**

### Task 4: Update server schema and docs

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Step 1: Add new enum values to MCP/HTTP schema**
**Step 2: Document the new rule sets**

### Task 5: Verify and commit

**Step 1: Run checks**
Run:
- `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Step 2: Preview verification**
- use `previewOnly=true` against `/Users/im_018/Documents/GitHub/Project/변수` file test frame `223:568`

**Step 3: Commit and push**
```bash
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge add README.md docs/plans figma-plugin/code.js src/naming-rules.js src/server.js tests/apply-naming-rule.test.js
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge commit -m "feat: expand naming rule presets"
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge push origin main
```
