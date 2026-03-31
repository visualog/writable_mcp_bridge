# promote_section 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** 부모 컨테이너 안에서 특정 섹션을 더 중요한 위치로 올리는 작업을 preview하거나 적용할 수 있는 의미 기반 명령을 추가한다.

**구현 방향:** 단순한 노드 메타데이터로부터 promote 작업과 선택적 spacing normalization 계획을 계산하는 순수 planning helper를 만들고, Node 테스트로 검증한 뒤 기존 `moveSection`, `normalizeSpacing` primitive를 중심으로 플러그인/서버 실행 경로를 연결한다.

**기술 스택:** Node.js ESM, built-in `node:test`, Figma plugin runtime, local HTTP bridge, stdio MCP.

---

### 작업 1: failing tests for promote plan generation 추가

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/package.json`

**1단계:** Write failing tests**
- preview plan for same-parent promotion to index 0
- noop when already primary
- spacing plan only when destination supports auto layout
- destination parent override

**2단계:** Run test to verify it fails**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`
Expected: FAIL because helper module does not exist yet.

### 작업 2: Implement pure section-plan helper

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/section-commands.js`
- Test: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`

**1단계:** Implement minimal helper API**
- `buildPromoteSectionPlan(tree, options)`

**2단계:** Re-run targeted tests**
Run: `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`
Expected: PASS

### 작업 3: Wire plugin runtime command

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**1단계:** Add command implementation**
- resolve source section node and destination parent
- build plan
- if previewOnly, return plan only
- if apply, call `moveSection`
- if requested and allowed, run `normalizeSpacing`

### 작업 4: Wire server + MCP tool

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**1단계:** Add HTTP endpoint**
- `/api/promote-section`

**2단계:** Add MCP tool schema**
- `promote_section`

### 작업 5: 검증 and commit

**1단계:** Run checks**
Run:
- `node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/promote-section.test.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**2단계:** Live verification**
- previewOnly first on a disposable container section
- apply only if preview is correct

**3단계:** 커밋하고 푸시한다**
```bash
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge add README.md docs/plans figma-plugin/code.js package.json src tests
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge commit -m "feat: add promote section command"
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge push origin main
```
