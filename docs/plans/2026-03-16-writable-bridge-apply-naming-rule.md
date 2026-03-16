# apply_naming_rule Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe semantic naming-rule command that can preview or apply deterministic rename mappings for known screen subtrees.

**Architecture:** Introduce a pure naming-rule helper for rule evaluation and rename-plan generation, cover it with node-level tests using Node's built-in test runner, then wire a new plugin command and server tool around that helper. Preview returns rename plans only; apply routes the plan through the existing bulk rename path.

**Tech Stack:** Node.js ESM, built-in `node:test`, Figma plugin runtime, local HTTP bridge, stdio MCP.

---

### Task 1: Add failing tests for pure naming-rule helpers

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/package.json`

**Step 1: Write failing tests**
- Add tests for:
  - unsupported rule set rejection
  - `app-screen` preview mapping for a fake subtree
  - duplicate target-name skip behavior
  - unmatched node preservation

**Step 2: Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
Expected: FAIL because the helper module does not exist yet.

**Step 3: Commit**
Commit after red state is confirmed.

### Task 2: Implement pure naming-rule helper

**Files:**
- Create: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/naming-rules.js`
- Test: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`

**Step 1: Implement minimal helper API**
- `listSupportedNamingRuleSets()`
- `buildNamingRulePlan(tree, options)`

**Step 2: Re-run targeted tests**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
Expected: PASS

**Step 3: Refactor lightly**
- Keep heuristics readable and rule-set scoped

### Task 3: Wire plugin runtime command

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Step 1: Add command implementation**
- Build a simplified subtree snapshot from the Figma node tree
- Use helper logic or mirrored logic to generate updates
- If `previewOnly=true`, return plan only
- If `previewOnly=false`, call existing rename logic and let current undo path apply

**Step 2: Add minimal safety checks**
- missing root
- unsupported rule set
- duplicate planned names

### Task 4: Wire server + MCP tool

**Files:**
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- Modify: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**Step 1: Add HTTP endpoint**
- `/api/apply-naming-rule`

**Step 2: Add MCP tool schema**
- `apply_naming_rule`

**Step 3: Add handler path**
- pass through args to plugin

### Task 5: Verify and commit

**Files:**
- Modify as needed from prior tasks

**Step 1: Run checks**
Run:
- `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**Step 2: Optional live verification**
- Use `previewOnly=true` first against a disposable subtree
- Only apply if preview output is correct

**Step 3: Commit**
```bash
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge add README.md docs/plans figma-plugin/code.js package.json src tests
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge commit -m "feat: add apply naming rule command"
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge push origin main
```
