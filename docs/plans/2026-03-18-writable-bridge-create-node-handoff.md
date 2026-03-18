# Writable MCP Bridge Handoff - 2026-03-18

## 목적
이 문서는 다른 에이전트가 `create_node` 고도화 작업을 바로 이어받을 수 있도록 현재 상태, 구현 내용, 검증 결과, 남은 이슈를 정리한 handoff 문서다.

저장소:
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge`
- 원격: [https://github.com/visualog/writable_mcp_bridge](https://github.com/visualog/writable_mcp_bridge)

기준 HEAD:
- `ee3f3d2` `feat: expand naming rule presets`

## 이번 작업의 목표
새 고도화 기능으로 `create_node`를 추가하는 것이 목표였다.

이번 slice 범위:
- 지원 타입: `FRAME`, `TEXT`, `RECTANGLE`
- 입력 필드:
  - `parentId`
  - `index` optional
  - `nodeType`
  - `name` optional
  - `width`, `height`, `x`, `y` optional
  - `characters` optional for text
  - `fillColor`, `cornerRadius`, `opacity` optional
- out of scope:
  - component/instance 생성
  - image fill
  - typography 세부 조정
  - create_node undo

## 이번에 변경된 파일
수정됨:
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

신규:
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/create-node.js`
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/create-node.test.js`
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-18-writable-bridge-create-node-design.md`
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-18-writable-bridge-create-node.md`

이 handoff 문서:
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/docs/plans/2026-03-18-writable-bridge-create-node-handoff.md`

## 구현 상태

### 1. helper 추가 완료
파일:
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/create-node.js`

포함 내용:
- `listSupportedCreateNodeTypes()`
- `buildCreateNodePlan(input)`

현재 지원 타입:
- `FRAME`
- `TEXT`
- `RECTANGLE`

기본값:
- `FRAME`: `160x120`, name `frame`
- `TEXT`: `160x24`, name `text`, characters `New text`
- `RECTANGLE`: `160x120`, name `rectangle`

### 2. server wiring 추가 완료
파일:
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js`

반영 내용:
- `import { buildCreateNodePlan, listSupportedCreateNodeTypes } from "./create-node.js";`
- HTTP route 추가:
  - `POST /api/create-node`
- MCP tool schema 추가:
  - `create_node`
- tool handler 추가:
  - `if (name === "create_node") { ... }`

주의:
- server는 body를 그대로 쓰지 않고 `buildCreateNodePlan(body)`를 거쳐 정규화 후 plugin으로 넘긴다.

### 3. plugin runtime 추가 완료
파일:
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js`

추가된 함수:
- `assertInsertParent(parentId)`
- `insertNodeIntoParent(parent, node, index)`
- `createNode(payload)`

현재 생성 로직:
- `FRAME` -> `figma.createFrame()`
- `RECTANGLE` -> `figma.createRectangle()`
- `TEXT` -> `figma.createText()` -> `loadAllFonts(node)` -> `node.characters = payload.characters`

삽입 로직:
- `index` 있으면 `insertChild`
- 없으면 `appendChild`

생성 후 적용되는 속성:
- `width`
- `height`
- `x`
- `y`
- `fillColor`
- `cornerRadius`
- `opacity`

적용 방식:
- 기존 `updateSceneNode(node.id, payloadSubset)` 재사용

command handler 반영:
- `if (command.type === "create_node") { return { created: await createNode(command.payload) }; }`

### 4. README 반영 완료
파일:
- `/Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/README.md`

반영 내용:
- Available MCP tools에 `create_node` 추가
- Notes에 `FRAME`, `TEXT`, `RECTANGLE` first-slice 생성 지원 명시

## 검증 상태

### 통과한 검증
1. helper test
명령:
```bash
node --test /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/tests/create-node.test.js
```
결과:
- `4/4` pass

2. server syntax
명령:
```bash
node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/src/server.js
```
결과:
- 통과

3. plugin syntax
명령:
```bash
node --check /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge/figma-plugin/code.js
```
결과:
- 통과

4. live bridge connectivity after restart
서버:
- `http://localhost:3846`
상태:
- `{"ok":true,"server":"writable-mcp-bridge","port":3846,"activePlugins":["default"]}` 확인

5. live create_node partial verification
성공한 실제 호출:
```bash
curl -s -X POST http://localhost:3846/api/create-node \
  -H 'Content-Type: application/json' \
  -d '{"pluginId":"default","parentId":"214:563","nodeType":"RECTANGLE","name":"create-node-smoke-rect","width":120,"height":48,"x":80,"y":80,"fillColor":"7553C4","cornerRadius":12,"opacity":0.9}'
```
실제 응답:
```json
{"ok":true,"result":{"created":{"id":"234:1246","name":"create-node-smoke-rect","type":"RECTANGLE","parentId":"214:563","index":4,"width":120,"height":48}}}
```
의미:
- `create_node` route/server/plugin chain 전체는 실제 Figma 세션에서 동작했다.
- `RECTANGLE` 생성은 라이브 검증 완료로 봐도 된다.

## 남은 이슈

### 1. disposable rectangle cleanup 미완료
생성된 테스트 노드:
- `234:1246`
- name: `create-node-smoke-rect`
- parent: `214:563` (`Playground`)

삭제를 시도했지만, 로컬 승인 흐름 때문에 실제 cleanup 호출이 끝까지 통과하지 않았다.
즉 현재 Figma 문서 안에 이 disposable rectangle이 남아 있을 수 있다.

권장 cleanup 명령:
```bash
curl -s -X POST http://localhost:3846/api/delete-node \
  -H 'Content-Type: application/json' \
  -d '{"pluginId":"default","nodeId":"234:1246"}'
```

### 2. TEXT live verification 미완료
원래 계획:
- `RECTANGLE` 생성
- `TEXT` 생성
- 둘 다 삭제

실제 상태:
- `RECTANGLE` 생성까지는 성공
- `TEXT` 생성은 승인 흐름 중단으로 검증을 마치지 못했다

따라서 아직 남은 확인:
- `TEXT` 생성 라이브 검증
- 생성 텍스트의 `characters` 반영 확인
- cleanup 포함 최종 원복 확인

## 현재 git 상태
작업 트리에는 아직 commit되지 않은 변경이 남아 있다.

예상 상태:
```bash
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge status --short
```

현재 확인된 항목:
- `M README.md`
- `M figma-plugin/code.js`
- `M src/server.js`
- `?? src/create-node.js`
- `?? tests/create-node.test.js`
- `?? docs/plans/2026-03-18-writable-bridge-create-node-design.md`
- `?? docs/plans/2026-03-18-writable-bridge-create-node.md`
- `?? docs/plans/2026-03-18-writable-bridge-create-node-handoff.md`

## 다른 에이전트가 바로 할 일

### Step 1. disposable rectangle 삭제
먼저 `234:1246` 삭제 시도:
```bash
curl -s -X POST http://localhost:3846/api/delete-node \
  -H 'Content-Type: application/json' \
  -d '{"pluginId":"default","nodeId":"234:1246"}'
```

### Step 2. TEXT create_node 라이브 검증
브리지와 플러그인 연결 상태 확인 후, 같은 parent에 텍스트 생성:
```bash
curl -s -X POST http://localhost:3846/api/create-node \
  -H 'Content-Type: application/json' \
  -d '{"pluginId":"default","parentId":"214:563","nodeType":"TEXT","name":"create-node-smoke-text","x":80,"y":144,"characters":"Create node smoke test"}'
```

확인 포인트:
- 응답 `created.type === "TEXT"`
- `characters` 값 반영

### Step 3. TEXT 삭제
```bash
curl -s -X POST http://localhost:3846/api/delete-node \
  -H 'Content-Type: application/json' \
  -d '{"pluginId":"default","nodeId":"<TEXT_NODE_ID>"}'
```

### Step 4. 필요시 README 문구 미세 조정
현재 README는 first-slice 지원을 설명하는 정도까지만 반영되어 있다. 필요하면 example call을 추가해도 된다.

### Step 5. commit + push
권장 커밋 메시지:
- `feat: add create node bridge command`

권장 절차:
```bash
git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge add \
  README.md \
  figma-plugin/code.js \
  src/server.js \
  src/create-node.js \
  tests/create-node.test.js \
  docs/plans/2026-03-18-writable-bridge-create-node-design.md \
  docs/plans/2026-03-18-writable-bridge-create-node.md \
  docs/plans/2026-03-18-writable-bridge-create-node-handoff.md

git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge commit -m "feat: add create node bridge command"

git -C /Users/im_018/Documents/GitHub/Project/writable_mcp_bridge push origin main
```

## 참고
이미 완료되어 있는 브리지 기능들:
- `delete_node`
- `reorder_child`
- `layoutGrow`
- `layoutAlign`
- `cornerRadius`
- `opacity`
- `list_component_properties`
- `set_component_property` 구현됨, 실제 mutation은 승인 후만
- `preview_changes`
- `undo_last_batch`
- `move_section`
- `normalize_spacing`
- `apply_naming_rule`
- `promote_section`

현재 브리지 포트:
- fallback 지원
- 최근 정상 동작 포트: `3846`

플러그인 창에서 보여야 하는 정상 상태:
- `Bridge connected to http://localhost:3846.`

## 요약
- `create_node`는 서버/플러그인/README/test까지 구현 완료
- helper test + syntax check 통과
- live verify는 `RECTANGLE`까지 성공
- cleanup와 `TEXT` live verify만 남음
- git commit/push는 아직 하지 않음
