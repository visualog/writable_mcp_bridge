# Writable Bridge Stage 6 Undo Last Batch 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** writable Figma 브리지에서 마지막으로 지원되는 mutation batch에 대해 메모리 기반 undo 지원을 추가한다.

**구현 방향:** 지원되는 각 mutation 직전에 플러그인 런타임 내부에 역방향 연산을 기록한다. 메모리에는 하나의 batch만 저장하고, `undo_last_batch`가 호출되면 이를 역순으로 재생한다.

**기술 스택:** Node.js HTTP/MCP 브리지, Figma Plugin API, 일반 JavaScript

---

### 작업 1: Stage 6 범위 문서화

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage6-undo-design.md`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-13-writable-bridge-stage6-undo.md`

### 작업 2: 플러그인 쪽 undo 이력 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**단계:**
1. Add single-batch in-memory undo storage.
2. Add helpers to capture inverse text, rename, and node update steps.
3. Record inverse batches before supported mutations.
4. Add `undo_last_batch` command handler.

### 작업 3: 서버와 MCP에 undo 노출

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**단계:**
1. Add `/api/undo-last-batch`
2. Add `undo_last_batch` tool definition
3. MCP 도구 디스패치를 추가한다

### 작업 4: README 업데이트

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**단계:**
1. Add `undo_last_batch` to tool list
2. Clarify the supported undo scope and the single-session limitation

### 작업 5: 검증

**파일:**
- 수정: none

**단계:**
1. 문법 검사를 실행한다
2. Defer live verification until the bridge server can bind to `127.0.0.1:3845` again
