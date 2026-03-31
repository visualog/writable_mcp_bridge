# Writable Bridge Port Fallback 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** 서버와 플러그인이 공유하는 작은 fallback 포트 범위를 허용해, 로컬 포트 충돌에도 writable bridge가 견고하게 동작하도록 만든다.

**구현 방향:** Figma manifest에 허용된 localhost origin의 고정 목록을 추가하고, 플러그인이 해당 origin에서 유효한 health payload를 탐색하도록 만들며, 서버는 같은 범위 안에서 비어 있는 첫 번째 포트에 바인딩되도록 한다.

**기술 스택:** Node.js HTTP server, Figma Plugin UI fetch bridge, Figma manifest devAllowedDomains

---

### 작업 1: the fallback strategy 문서화

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-port-fallback-design.md`
- 생성: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-16-writable-bridge-port-fallback.md`

### 작업 2: server-side port fallback 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**단계:**
1. Define allowed ports
2. Try binding in order
3. Preserve `PORT` override behavior
4. Extend `/health` response with a stable bridge identifier

### 작업 3: 플러그인 쪽 origin probing 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/ui.html`
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/manifest.json`

**단계:**
1. Add all allowed localhost origins to `devAllowedDomains`
2. Probe health endpoints in order
3. Persist the chosen origin in memory for the current plugin session
4. Show the connected origin in the plugin UI

### 작업 4: README 업데이트

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**단계:**
1. Document the fallback port range
2. Note that plugin restart is required after manifest changes

### 작업 5: 검증

**파일:**
- 수정: none

**단계:**
1. 문법 검사를 실행한다
2. Start bridge with one port occupied
3. Confirm health on fallback port
4. Reopen plugin and confirm it binds to the fallback origin
