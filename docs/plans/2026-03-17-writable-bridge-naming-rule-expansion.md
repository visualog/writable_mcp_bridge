# Naming Rule Expansion 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** `apply_naming_rule`에 재사용 가능한 스캐폴딩 지향 preset과 AI 채팅 전용 naming preset을 확장한다.

**구현 방향:** 먼저 순수 naming-rule helper를 업데이트해 두 새 rule set을 결정적 테스트로 검증하고, 이후 동일한 rule-set 지원을 플러그인 런타임 naming planner에 반영한 뒤 서버 스키마를 통해 새 preset을 노출한다.

**기술 스택:** Node.js ESM, built-in `node:test`, Figma plugin runtime, local HTTP bridge, stdio MCP.

---

### 작업 1: failing tests for new rule sets 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`

**1단계:** Write failing tests**
- `content-screen-basic` should map `header`, `body`, `footer`
- `ai-chat-screen` should map chat screen blocks into `screen/*` names

**2단계:** Run tests to verify they fail**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
Expected: FAIL because the new rule sets are unsupported.

### 작업 2: Implement helper support

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/naming-rules.js`

**1단계:** Add new supported rule sets**
- `content-screen-basic`
- `ai-chat-screen`

**2단계:** Implement deterministic mapping logic**
- generic scaffold first
- AI-specific overrides second

**3단계:** Re-run tests**
Expected: PASS

### 작업 3: Mirror plugin runtime support

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**1단계:** Extend runtime supported rule sets**
**2단계:** Mirror the new mapping behavior in runtime planner**

### 작업 4: Update server schema and docs

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**1단계:** Add new enum values to MCP/HTTP schema**
**2단계:** Document the new rule sets**

### 작업 5: 검증 and commit

**1단계:** Run checks**
Run:
- `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/apply-naming-rule.test.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**2단계:** Preview verification**
- use `previewOnly=true` against `/Users/im_018/Documents/GitHub/Project/변수` file test frame `223:568`

**3단계:** 커밋하고 푸시한다**
```bash
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge add README.md docs/plans figma-plugin/code.js src/naming-rules.js src/server.js tests/apply-naming-rule.test.js
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge commit -m "feat: expand naming rule presets"
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge push origin main
```
