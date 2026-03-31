# apply_naming_rule 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** 알려진 화면 하위 트리에 대해 결정적 rename mapping을 preview하거나 적용할 수 있는 안전한 의미 기반 naming-rule 명령을 추가한다.

**구현 방향:** 규칙 평가와 rename plan 생성을 담당하는 순수 naming-rule helper를 도입하고, Node 내장 테스트 러너로 노드 수준 테스트를 추가한 뒤, 해당 helper를 중심으로 새 플러그인 명령과 서버 도구를 연결한다. Preview는 rename plan만 반환하고, apply는 기존 bulk rename 경로를 통해 그 계획을 적용한다.

**기술 스택:** Node.js ESM, built-in `node:test`, Figma plugin runtime, local HTTP bridge, stdio MCP.

---

### 작업 1: failing tests for pure naming-rule helpers 추가

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/package.json`

**1단계:** Write failing tests**
- Add tests for:
  - unsupported rule set rejection
  - `app-screen` preview mapping for a fake subtree
  - duplicate target-name skip behavior
  - unmatched node preservation

**2단계:** Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
Expected: FAIL because the helper module does not exist yet.

**3단계:** Commit**
Commit after red state is confirmed.

### 작업 2: Implement pure naming-rule helper

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/naming-rules.js`
- Test: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`

**1단계:** Implement minimal helper API**
- `listSupportedNamingRuleSets()`
- `buildNamingRulePlan(tree, options)`

**2단계:** Re-run targeted tests**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
Expected: PASS

**3단계:** Refactor lightly**
- Keep heuristics readable and rule-set scoped

### 작업 3: Wire plugin runtime command

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**1단계:** Add command implementation**
- Build a simplified subtree snapshot from the Figma node tree
- Use helper logic or mirrored logic to generate updates
- If `previewOnly=true`, return plan only
- If `previewOnly=false`, call existing rename logic and let current undo path apply

**2단계:** Add minimal safety checks**
- missing root
- unsupported rule set
- duplicate planned names

### 작업 4: Wire server + MCP tool

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**1단계:** Add HTTP endpoint**
- `/api/apply-naming-rule`

**2단계:** Add MCP tool schema**
- `apply_naming_rule`

**3단계:** Add handler path**
- pass through args to plugin

### 작업 5: 검증 and commit

**파일:**
- Modify as needed from prior tasks

**1단계:** Run checks**
Run:
- `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**2단계:** Optional live verification**
- Use `previewOnly=true` first against a disposable subtree
- Only apply if preview output is correct

**3단계:** Commit**
```bash
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge add README.md docs/plans figma-plugin/code.js package.json src tests
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge commit -m "feat: add apply naming rule command"
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge push origin main
```
