# writable bridge stage3 style controls 구현 계획

> **Claude용:** 필수 서브스킬 `superpowers:executing-plans`를 사용해 이 계획을 작업 단위로 구현한다.

**목표:** writable Figma 브리지에 `cornerRadius`와 `opacity` 쓰기 지원을 추가한다.

**구현 방향:** 플러그인 런타임과 MCP/HTTP 브리지의 공용 노드 업데이트 경로를 확장해, 이 스타일 속성이 기존 `update_node`, `bulk_update_nodes` 명령을 통해 흐르도록 한다. 속성 지원 여부 확인은 노드 타입별로 명시적으로 유지하고, strokes나 effects 영역까지 범위를 넓히지 않는다.

**기술 스택:** Node.js stdio MCP 서버, 로컬 HTTP 브리지, Figma Plugin API.

---

### 작업 1: 플러그인 노드 업데이트 확장

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**단계:**
1. 공용 노드 업데이트 함수에서 `cornerRadius`와 `opacity`를 받도록 한다.
2. 노드가 해당 속성을 지원할 때만 각 필드를 적용한다.
3. 가능한 경우 응답 페이로드에 갱신된 값을 포함해 반환한다.

### 작업 2: 서버 페이로드 전달 확장

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

**단계:**
1. `/api/update-node`에 `cornerRadius`와 `opacity`를 추가한다.
2. 같은 필드를 `/api/bulk-update-nodes`에도 추가한다.
3. `update_node`와 `bulk_update_nodes`용 MCP 스키마를 확장한다.
4. `handleToolCall` 내부에서 해당 필드를 그대로 전달한다.

### 작업 3: 문서 업데이트

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

**단계:**
1. 지원되는 편집 기능 설명에 `cornerRadius`와 `opacity`를 명시한다.

### 작업 4: 검증

**파일:**
- 검증: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`
- 검증: `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

**단계:**
1. 두 파일 모두에 대해 `node --check`를 실행한다.
2. `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge`에서 브리지를 재시작한다.
3. Figma 플러그인을 다시 연다.
4. 소모성 카드 하나를 복제한다.
5. `cornerRadius`와 `opacity`를 적용한다.
6. 성공 여부를 확인한다.
7. 복제한 노드를 삭제하고 테스트 프레임을 원래 상태로 되돌린다.
