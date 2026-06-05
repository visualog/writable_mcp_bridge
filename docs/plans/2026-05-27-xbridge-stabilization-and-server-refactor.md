# Xbridge Stabilization And Server Refactor Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Figma official guide review 기반 안정화 작업의 결과를 기록하고, 다음 단계로 `src/server.js`의 과밀한 책임을 안전하게 분리한다.

**Architecture:** 이번 안정화는 Figma plugin main thread, UI iframe, local bridge server의 책임 경계를 공식 가이드에 맞게 보강했다. 다음 리팩터링은 동작을 바꾸지 않고 `server.js`에서 route, token export orchestration, MCP tool definitions, command dispatch, transport/session 책임을 단계적으로 추출한다.

**Tech Stack:** Node.js ESM, Node built-in test runner, Figma Plugin API, localhost HTTP/SSE/WS bridge, MCP stdio tool definitions.

---

## 1. 이번 작업으로 개선된 내용

### 1.1 Dynamic Page 대응

**개선 내용**
- `figma-plugin/manifest.json`에 `"documentAccess": "dynamic-page"`를 추가했다.
- `figma-plugin/code.js`에 page-scoped access helper를 추가했다.
  - `getSafePageChildCount`
  - `getPageById`
  - `loadPageForDynamicAccess`
  - `prepareDynamicPageAccess`
- 현재 페이지가 아닌 page의 children을 강제로 읽지 않도록 `/api/pages` 응답의 non-current page `childCount`를 `null`로 유지한다.
- page-scoped read 명령에서 `pageId`를 받아 필요한 경우 `figma.loadPageAsync(page)`를 호출한 뒤 node traversal을 수행한다.

**영향**
- 대형 Figma 파일에서 플러그인 시작 시 전체 페이지를 강제로 로드하는 위험을 줄였다.
- agent/bridge가 `/api/pages -> pageId 기반 read` 흐름을 사용할 수 있게 됐다.

**주요 파일**
- `figma-plugin/manifest.json`
- `figma-plugin/code.js`
- `src/read-node-details.js`
- `src/read-annotations.js`
- `src/node-discovery.js`
- `src/search-instances.js`
- `src/scene-snapshot.js`
- `src/export-node.js`
- `src/ai-designer-read-executor.js`
- `src/server.js`

### 1.2 Plugin Main Thread Sandbox 준수 강화

**개선 내용**
- `figma-plugin/code.js` main thread에서 browser/network/runtime API가 직접 쓰이지 않도록 contract test를 추가했다.
- 남아 있던 `setTimeout` 기반 next tick 대기를 `Promise.resolve()`로 교체했다.
- 금지 API 검증 대상:
  - `fetch`
  - `XMLHttpRequest`
  - `WebSocket`
  - `setTimeout`
  - `setInterval`
  - `document`
  - `window`

**영향**
- Figma plugin main sandbox에서 외부 네트워크와 DOM/timer API에 의존하지 않는 구조를 테스트로 고정했다.
- bridge networking은 계속 UI iframe 쪽 책임으로 유지된다.

**주요 파일**
- `figma-plugin/code.js`
- `tests/token-export-contract.test.js`

### 1.3 Network Access Policy 고정

**개선 내용**
- manifest의 network policy를 contract test로 고정했다.
- production `allowedDomains`는 `["none"]`으로 유지한다.
- local bridge access는 `devAllowedDomains`에만 둔다.
  - `http://localhost:3846`
  - `ws://localhost:3846`

**영향**
- Figma official guide 기준의 dev-only localhost access 정책이 회귀하지 않도록 했다.

**주요 파일**
- `figma-plugin/manifest.json`
- `tests/token-export-contract.test.js`

### 1.4 DS Registry와 Variables API 연결 강화

**개선 내용**
- `src/ds-registry.js`의 token 값에 literal fallback과 variable reference를 함께 둔다.
  - `value`
  - `variableName`
  - `variableKey`
- `src/build-layout.js`가 `fillVariableName`/`fillVariableKey`를 layout plan에 보존한다.
- `src/server.js`의 layout execution이 variable name/key를 resolve하고 fill binding을 시도한다.
- 개별 `bind_variable` write 대신 `bulk_bind_variables`로 묶어 write queue 압력을 줄였다.

**영향**
- 디자인 시스템 helper가 단순 hex fill을 적용하는 수준에서, 가능한 경우 Figma variable binding으로 이어질 수 있게 됐다.
- variable이 없거나 resolve에 실패해도 literal fallback을 유지해 작업이 hard fail로 끝나지 않는다.

**주요 파일**
- `src/ds-registry.js`
- `src/build-layout.js`
- `src/server.js`
- `tests/ds-registry.test.js`
- `tests/build-layout.test.js`
- `tests/token-export-contract.test.js`

### 1.5 Design Token Export 안정화

**개선 내용**
- token export를 단일 대형 JSON 응답이 아니라 chunk read + artifact write 구조로 바꿨다.
- plugin main command를 분리했다.
  - `get_variable_collections_summary`
  - `export_design_tokens_chunk`
- server는 `/api/export-design-tokens`에서 chunk를 순차 실행하고 artifact path/count summary를 반환한다.
- soft budget, chunk timeout, chunk max limit을 둔다.
- chunk 실패 시 partial artifact와 warning/error metadata를 남긴다.
- local variables/styles read는 async API를 우선 사용한다.

**영향**
- 큰 design system 파일에서 token export가 bridge queue를 오래 독점하거나 응답 payload를 과도하게 키우는 위험을 줄였다.
- 실패해도 부분 결과를 남겨 buddy 수준의 "긴 작업 fallback"에 가까워졌다.

**주요 파일**
- `figma-plugin/code.js`
- `src/server.js`
- `src/command-queue-policy.js`
- `src/ai-designer-intents.js`
- `src/ai-designer-read-routing.js`
- `src/ai-designer-read-executor.js`
- `tests/token-export-contract.test.js`
- `tests/ai-designer-intents.test.js`
- `tests/ai-designer-read-routing.test.js`
- `tests/ai-designer-read-executor.test.js`

### 1.6 검증 상태

**마지막 검증 결과**
- `node --check figma-plugin/code.js`: pass
- `node --check src/server.js`: pass
- targeted tests: `95/95` pass
- `npm test`: `461` tests, `449` pass, `12` skipped, `0` failed
- `curl -s http://127.0.0.1:3846/health`: pass
- `node scripts/agent-preflight.mjs`: pass outside sandbox
- `GET /api/pages?pluginId=page%3A2631%3A43`: pass, non-current pages returned with `childCount: null`

---

## 2. `src/server.js`에 남은 문제

이번 작업은 공식 가이드 대응과 buddy 수준 안정화가 중심이었다. `src/server.js` 구조 문제는 완전히 해결하지 않았다.

### 2.1 현재 문제

- `src/server.js`가 여전히 아래 책임을 한 파일에 갖고 있다.
  - HTTP route handling
  - SSE/WS transport
  - plugin session lifecycle
  - command queue and fallback policy wiring
  - MCP tool definitions
  - MCP tool handler dispatch
  - AI Designer route orchestration
  - token export orchestration
  - build layout execution orchestration
- 이번 안정화에서 token export와 bulk variable binding orchestration이 추가되어 파일 크기는 더 커졌다.
- source contract tests가 `server.js` 내부 문자열/함수 구조에 일부 의존한다. 리팩터링 시 테스트를 behavior-level로 옮기지 않으면 테스트가 구현 구조를 과하게 고정할 수 있다.
- route discovery를 `server.js`에서 직접 추측하는 습관을 줄이기 위해 문서는 보강했지만, 코드 구조 자체는 아직 entrypoint monolith에 가깝다.

### 2.2 이미 완화된 부분

- read/write plan 책임 일부는 기존 모듈로 이동 또는 강화됐다.
  - `read-node-details.js`
  - `read-annotations.js`
  - `node-discovery.js`
  - `search-instances.js`
  - `scene-snapshot.js`
  - `export-node.js`
  - `build-layout.js`
  - `ds-registry.js`
  - `ai-designer-read-routing.js`
  - `ai-designer-read-executor.js`
- `docs/src-directory-map.md`에 `server.js`를 열기 전에 먼저 확인할 모듈과 다음 분리 우선순위를 문서화했다.

---

## 3. `server.js` 정리 원칙

1. 동작 변경 없는 extraction부터 한다.
2. route/API contract는 변경하지 않는다.
3. 각 extraction마다 테스트를 먼저 추가하거나 기존 integration test를 좁혀 실행한다.
4. `server.js`는 최종적으로 composition root와 process entrypoint 역할만 남기는 방향으로 간다.
5. queue/session/transport처럼 상태가 얽힌 영역은 가장 마지막에 분리한다.
6. Figma plugin command payload shape은 기존 command module test로 고정하고, server는 wiring만 담당하게 한다.

---

## 4. 리팩터링 실행 플랜

### Task 1: Token Export Orchestration 분리

**Files:**
- Create: `src/server-token-export.js`
- Modify: `src/server.js`
- Test: `tests/token-export-contract.test.js`
- Optional Test: `tests/server-token-export.test.js`

**Step 1: Write the failing test**

Create `tests/server-token-export.test.js` with a narrow unit test for exported helpers.

```js
import test from "node:test";
import assert from "node:assert/strict";

import { createTokenExportArtifactName } from "../src/server-token-export.js";

test("createTokenExportArtifactName creates stable json artifact names", () => {
  const name = createTokenExportArtifactName({
    pluginId: "page:2631:43",
    startedAt: Date.parse("2026-05-27T00:00:00.000Z")
  });

  assert.match(name, /^xbridge-design-tokens-page-2631-43-2026-05-27T00-00-00-000Z\.json$/);
});
```

**Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/server-token-export.test.js
```

Expected: FAIL because `src/server-token-export.js` does not exist.

**Step 3: Extract minimal module**

Move token export constants and pure artifact naming/path helpers first. Do not move route handling yet.

Export from `src/server-token-export.js`:

```js
export function createTokenExportArtifactName({ pluginId, startedAt }) {
  const safePluginId = String(pluginId || "unknown")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
  const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, "-");
  return `xbridge-design-tokens-${safePluginId}-${stamp}.json`;
}
```

**Step 4: Run tests**

Run:

```bash
node --test tests/server-token-export.test.js tests/token-export-contract.test.js
node --check src/server.js
```

Expected: all pass.

**Step 5: Move `exportDesignTokensArtifact`**

After pure helpers pass, move `exportDesignTokensArtifact` into `src/server-token-export.js` by dependency injection:

```js
export async function exportDesignTokensArtifact(args, deps) {
  const {
    pluginId,
    executePluginCommand,
    broadcastRuntimeEvent,
    broadcastDesignerTaskProgress,
    writeFile,
    mkdir,
    exportDir,
    now = Date.now
  } = deps;
  // move existing body with minimal edits
}
```

**Step 6: Update `server.js` wiring**

Import the helper and pass dependencies from `server.js`. Keep route response shape unchanged.

**Step 7: Run verification**

Run:

```bash
node --test tests/token-export-contract.test.js tests/ai-designer-read-routing.test.js tests/ai-designer-read-executor.test.js
node --check src/server.js
npm test
```

Expected: all pass.

### Task 2: MCP Tool Definitions 분리

**Files:**
- Create: `src/server-tool-definitions.js`
- Modify: `src/server.js`
- Test: `tests/server-tool-definitions.test.js`
- Existing Test: `tests/version-consistency.test.js`

**Step 1: Write failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";

import { buildToolDefinitions } from "../src/server-tool-definitions.js";

test("buildToolDefinitions exposes dynamic-page pageId on read tools", () => {
  const tools = buildToolDefinitions();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  for (const name of [
    "get_metadata",
    "get_annotations",
    "get_node_details",
    "get_component_variant_details",
    "get_instance_details",
    "get_variable_defs",
    "list_text_nodes",
    "search_nodes",
    "snapshot_selection",
    "export_node"
  ]) {
    assert.equal(byName.get(name).inputSchema.properties.pageId.type, "string");
  }
});
```

**Step 2: Run test to verify it fails**

```bash
node --test tests/server-tool-definitions.test.js
```

Expected: FAIL because module is missing.

**Step 3: Extract definitions**

Move the MCP tool definition array and any pure schema helper into `src/server-tool-definitions.js`.

**Step 4: Keep behavior unchanged**

`src/server.js` should import:

```js
import { buildToolDefinitions } from "./server-tool-definitions.js";
```

Then use `const toolDefinitions = buildToolDefinitions();`.

**Step 5: Run verification**

```bash
node --test tests/server-tool-definitions.test.js tests/version-consistency.test.js tests/token-export-contract.test.js
node --check src/server.js
npm test
```

Expected: all pass.

### Task 3: Command Dispatch 분리

**Files:**
- Create: `src/server-command-dispatch.js`
- Modify: `src/server.js`
- Test: `tests/server-command-dispatch.test.js`

**Step 1: Write failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";

import { resolveCommandTimeoutMs } from "../src/server-command-dispatch.js";

test("resolveCommandTimeoutMs gives token export chunks a large timeout", () => {
  assert.equal(
    resolveCommandTimeoutMs("export_design_tokens_chunk", { defaultTimeoutMs: 30000 }),
    120000
  );
});
```

**Step 2: Run test to verify it fails**

```bash
node --test tests/server-command-dispatch.test.js
```

Expected: FAIL because module is missing.

**Step 3: Extract pure timeout/command metadata first**

Move command timeout selection and command category checks out of `server.js`. Avoid moving queue state yet.

**Step 4: Extract MCP handler command switch**

Move the large `name === ...` command dispatch into a function:

```js
export async function dispatchMcpToolCall(name, args, deps) {
  // existing switch/if chain
}
```

Pass dependencies explicitly:

```js
{
  executePluginCommand,
  resolveActivePluginId,
  buildLayoutPlan,
  buildExportNodePlan,
  ...
}
```

**Step 5: Run verification**

```bash
node --test tests/server-command-dispatch.test.js tests/bind-variable.test.js tests/session-state-heartbeat-preflight.test.js
node --check src/server.js
npm test
```

Expected: all pass.

### Task 4: AI Designer HTTP Routes 분리

**Files:**
- Create: `src/server-designer-routes.js`
- Modify: `src/server.js`
- Test: existing `tests/ai-designer-chat-api.integration.test.js`
- Test: existing `tests/ui-designer-contract.test.js`

**Step 1: Add a route registration contract**

Create a small route table module test:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { listDesignerRoutePaths } from "../src/server-designer-routes.js";

test("designer route module lists stable route paths", () => {
  assert.ok(listDesignerRoutePaths().includes("/api/designer/chat"));
  assert.ok(listDesignerRoutePaths().includes("/api/designer/inspect-selection"));
  assert.ok(listDesignerRoutePaths().includes("/api/designer/action-candidates/preview"));
});
```

**Step 2: Run test to verify it fails**

```bash
node --test tests/server-designer-routes.test.js
```

Expected: FAIL because module is missing.

**Step 3: Extract route predicates only**

First move only route path constants and predicates. Keep handlers in `server.js`.

**Step 4: Extract handlers by dependency injection**

Move designer handlers one group at a time:

1. read-only inspect routes
2. action candidate preview/confirm routes
3. chat route
4. model/provider config routes

Each handler should accept a `deps` object instead of importing server globals.

**Step 5: Run verification after each group**

```bash
node --test tests/ui-designer-contract.test.js tests/ai-designer-chat-api.integration.test.js
node --check src/server.js
```

Expected: all pass after each group.

### Task 5: Generic HTTP Route Table 분리

**Files:**
- Create: `src/server-routes.js`
- Modify: `src/server.js`
- Test: `tests/server-routes.test.js`
- Existing Integration Tests: `tests/session-state-heartbeat-preflight.test.js`, `tests/live-sse-pages.integration.test.js`

**Step 1: Write failing route table test**

```js
import test from "node:test";
import assert from "node:assert/strict";

import { createRouteTable } from "../src/server-routes.js";

test("createRouteTable exposes health and pages routes", () => {
  const table = createRouteTable({});
  assert.ok(table.some((route) => route.method === "GET" && route.path === "/health"));
  assert.ok(table.some((route) => route.method === "GET" && route.path === "/api/pages"));
});
```

**Step 2: Run test to verify it fails**

```bash
node --test tests/server-routes.test.js
```

Expected: FAIL because module is missing.

**Step 3: Extract route registration without changing handlers**

Represent routes as:

```js
{
  method: "GET",
  path: "/health",
  handler: handleHealth
}
```

`server.js` can still own the actual handlers in this step.

**Step 4: Move stable handlers**

Move low-risk handlers first:

1. `/health`
2. `/api/sessions`
3. `/api/runtime-ops`
4. `/api/pages`

Do not move SSE/WS upgrade logic in this task.

**Step 5: Run verification**

```bash
node --test tests/session-state-heartbeat-preflight.test.js tests/live-sse-pages.integration.test.js
node --check src/server.js
npm test
```

Expected: all pass.

### Task 6: Transport/Session 분리 준비

**Files:**
- Create: `src/server-transport-state.js`
- Modify: `src/server.js`
- Existing Files: `src/runtime-session-state.js`, `src/command-queue-policy.js`
- Test: `tests/ws-events.integration.test.js`, `tests/websocket-command-channel.integration.test.js`, `tests/session-state-heartbeat-preflight.test.js`

**Step 1: Do not move socket code first**

Start with pure state snapshot builders and status calculators only. Avoid moving raw socket lifecycle until route and command dispatch are already smaller.

**Step 2: Add state snapshot tests**

Add focused tests for exported snapshot helpers if they are not already covered by `session-state-heartbeat-preflight.test.js`.

**Step 3: Extract health/readiness builders**

Move pure builders into `server-transport-state.js`:

- active session resolution summary
- transport health summary projection
- queue/readiness response projection

**Step 4: Run verification**

```bash
node --test tests/session-state-heartbeat-preflight.test.js tests/ws-events.integration.test.js tests/websocket-command-channel.integration.test.js
node --check src/server.js
npm test
```

Expected: all pass.

---

## 5. 리팩터링 후 기대 구조

Target layout:

```text
src/
  server.js
  server-routes.js
  server-designer-routes.js
  server-token-export.js
  server-tool-definitions.js
  server-command-dispatch.js
  server-transport-state.js
  command-queue-policy.js
  runtime-session-state.js
  ai-designer-*.js
  read/write command modules
```

Target responsibilities:

| File | Responsibility |
| --- | --- |
| `server.js` | process entrypoint, dependency composition, HTTP server bootstrap |
| `server-routes.js` | generic HTTP route table and stable route handlers |
| `server-designer-routes.js` | AI Designer HTTP routes |
| `server-token-export.js` | token export chunk orchestration and artifact writing |
| `server-tool-definitions.js` | MCP tool schemas |
| `server-command-dispatch.js` | MCP tool call to plugin command dispatch |
| `server-transport-state.js` | health/readiness/session projection helpers |

---

## 6. 남은 리스크

- `server.js` extraction 중 circular dependency가 생길 수 있다. 해결 기준은 "server.js가 dependencies를 주입하고 하위 모듈은 server.js를 import하지 않는다"이다.
- integration test가 많은 서버 프로세스를 띄운다. 리팩터링 중에는 targeted test와 full `npm test`를 모두 돌려야 한다.
- `tests/token-export-contract.test.js` 일부는 source regex 기반이다. extraction 후에는 behavior-level unit tests로 점진적으로 대체해야 한다.
- active plugin live checks는 로컬 Figma plugin 연결 상태에 의존한다. CI/pass 판단은 unit/integration tests에 두고 live preflight는 confidence gate로 본다.
- token export artifact path는 local filesystem을 쓴다. extraction 시 path/write dependency를 주입하지 않으면 테스트가 느리거나 brittle해질 수 있다.

---

## 7. 완료 기준

`server.js` 정리 작업은 아래가 모두 만족될 때 완료로 본다.

- `src/server.js`가 process bootstrap, dependency composition, listener setup 중심으로 축소된다.
- token export orchestration이 `src/server-token-export.js`로 분리된다.
- MCP tool definitions가 `src/server-tool-definitions.js`로 분리된다.
- MCP command dispatch가 `src/server-command-dispatch.js`로 분리된다.
- AI Designer routes가 `src/server-designer-routes.js`로 분리된다.
- generic route table 또는 stable handlers가 `src/server-routes.js`로 분리된다.
- health/readiness projection helper가 `src/server-transport-state.js` 또는 기존 session/queue modules로 분리된다.
- public route paths, MCP tool names, plugin command payload shape는 변경되지 않는다.
- 아래 검증이 통과한다.

```bash
node --check src/server.js
node --check figma-plugin/code.js
node --test tests/token-export-contract.test.js
node --test tests/session-state-heartbeat-preflight.test.js
node --test tests/websocket-command-channel.integration.test.js tests/ws-events.integration.test.js
npm test
curl -s http://127.0.0.1:3846/health
node scripts/agent-preflight.mjs
```

---

## 8. 권장 작업 순서 요약

1. `server-token-export.js`
2. `server-tool-definitions.js`
3. `server-command-dispatch.js`
4. `server-designer-routes.js`
5. `server-routes.js`
6. `server-transport-state.js`

이 순서는 상태ful transport/session 코드를 마지막까지 건드리지 않아 회귀 위험을 낮춘다.
