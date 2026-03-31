# Home FAB Re Bridge Upgrade 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** 로컬 Figma writable bridge에 이름 변경 지원을 추가하고, `home-FAB-re` 프레임에 한해 표준화된 영문 코드 스타일 레이어 이름을 적용한다.

**구현 방향:** 로컬 HTTP + stdio 브리지에 `rename_node`, `bulk_rename_nodes` 명령을 확장하고, 이를 Figma 플러그인 런타임에 연결한 뒤 `home-FAB-re` 프레임에 대한 결정적 rename mapping을 생성해 적용한다. 컴포넌트 프로퍼티 변경은 실행 범위에서 제외하고 명시적 승인 뒤에만 허용한다.

**기술 스택:** Node.js, custom MCP stdio server, Figma Plugin API, local HTTP bridge

---

### 작업 1: rename command support to the Figma plugin 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/디자인토킹/figma-plugin/code.js`

**1단계:** Add a helper to rename a single node**

- Implement `renameNode(nodeId, name)` using `figma.getNodeById`
- Return `{ id, oldName, newName, type }`

**2단계:** Add single-command handling**

- Extend `handleCommand` with `rename_node`

**3단계:** Add bulk-command handling**

- Extend `handleCommand` with `bulk_rename_nodes`

**4단계:** Keep behavior strict**

- Throw if node is missing
- Do not silently skip invalid nodes

### 작업 2: rename routes and tool definitions to the bridge server 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/디자인토킹/src/server.js`

**1단계:** HTTP 엔드포인트 추가

- `POST /api/rename-node`
- `POST /api/bulk-rename-nodes`

**2단계:** Add MCP tool definitions**

- `rename_node`
- `bulk_rename_nodes`

**3단계:** Add tool dispatcher handling**

- Route MCP calls to plugin commands

**4단계:** Preserve symmetry**

- Keep payload shapes aligned between HTTP and MCP paths

### 작업 3: Verify rename support locally

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/디자인토킹/README.md`

**1단계:** Restart local bridge**

Run: `npm start`

**2단계:** Reopen plugin**

- Keep `Writable MCP Bridge` connected

**3단계:** Smoke test one safe node rename**

- Pick one low-risk node in `home-FAB-re`
- Rename and confirm response payload

**4단계:** Document usage**

- Add small README note for rename endpoints

### 작업 4: Prepare deterministic rename mapping for home-FAB-re

**파일:**
- 생성: `/Users/im_018/Documents/GitHub/Project/디자인토킹/docs/plans/2026-03-12-home-fab-re-rename-map.md`

**1단계:** Read target frame metadata**

- Identify the exact `home-FAB-re` frame node

**2단계:** Map top-level structure**

- Header
- AI input
- Banner
- Recommendation section
- Recent section
- FAB
- Tab bar

**3단계:** Define rename pairs**

- `old nodeId + old name -> new standardized name`

**4단계:** Exclude ambiguous deep internals**

- Do not rename low-value thumbnail subdivision nodes in the first pass

### 작업 5: Apply rename mapping to home-FAB-re

**파일:**
- 수정: Figma document only

**1단계:** Generate bulk rename payload**

- Use the rename map

**2단계:** Apply to target frame only**

- No structural move
- No visibility changes

**3단계:** Re-read metadata**

- Confirm new names exist

**4단계:** Capture screenshot**

- Verify no visual regression

### 작업 6: Prepare next upgrade stage without executing it

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/디자인토킹/docs/plans/2026-03-12-home-fab-re-bridge-upgrade-design.md`

**1단계:** Append next-stage notes**

- `auto layout`
- `padding/gap`
- `alignment`
- `component properties require approval`

**2단계:** Stop before implementing component property writes**

- This remains approval-gated
