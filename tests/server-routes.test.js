import test from "node:test";
import assert from "node:assert/strict";

import {
  createRouteTable,
  createStableRouteHandlers,
  handleRouteTableRequest
} from "../src/server-routes.js";

test("createRouteTable exposes health and pages routes", () => {
  const table = createRouteTable({});

  assert.ok(table.some((route) => route.method === "GET" && route.path === "/health"));
  assert.ok(table.some((route) => route.method === "GET" && route.path === "/api/pages"));
});

test("createRouteTable exposes low-risk GET routes", () => {
  const table = createRouteTable({});

  assert.ok(table.some((route) => route.method === "GET" && route.path === "/api/compose-metrics"));
  assert.ok(table.some((route) => route.method === "GET" && route.path === "/api/figma/me"));
  assert.ok(table.some((route) => route.method === "GET" && route.path === "/api/figma/file-comments"));
});

test("handleRouteTableRequest dispatches matching stable routes", async () => {
  const calls = [];
  const table = createRouteTable({
    handleHealth: async (req, res, url) => {
      calls.push({ req, res, pathname: url.pathname });
      return "handled";
    }
  });

  const result = await handleRouteTableRequest(
    table,
    { method: "GET", id: "req" },
    { id: "res" },
    { pathname: "/health" }
  );

  assert.equal(result, true);
  assert.deepEqual(calls, [
    {
      req: { method: "GET", id: "req" },
      res: { id: "res" },
      pathname: "/health"
    }
  ]);
});

test("handleRouteTableRequest ignores unmatched routes", async () => {
  const table = createRouteTable({
    handleHealth: async () => {
      throw new Error("should not run");
    }
  });

  const result = await handleRouteTableRequest(
    table,
    { method: "POST" },
    {},
    { pathname: "/health" }
  );

  assert.equal(result, false);
});

test("createStableRouteHandlers builds health responses", async () => {
  const calls = [];
  const handlers = createStableRouteHandlers({
    activeHttpPort: 3846,
    BRIDGE_PACKAGE_NAME: "bridge-package",
    BRIDGE_VERSION: "1.2.3",
    buildAiDesignerSnapshot: () => ({ provider: "codex_cli" }),
    getDesignerAiConfig: () => ({ provider: "codex_cli" }),
    getHealthEventSnapshot: () => ({
      activePlugins: ["plugin-1"],
      activePluginId: "plugin-1",
      activeSession: { pluginId: "plugin-1" },
      activeSessionResolution: { status: "ok" },
      commandReadiness: { state: "ready" },
      writeReadiness: { state: "ready" }
    }),
    getOrCreateRequestSnapshotCacheEntry: (key, factory) => factory(),
    getQueueDiagnostics: () => ({ queued: 0 }),
    getRecentFailureSummary: () => ({
      currentReadHealth: "healthy",
      recentFailedTotal: 0,
      lastFailureAt: null,
      lastFailureCommand: null
    }),
    getRuntimeFeatureFlagsSnapshot: () => ({ ws: true }),
    getRuntimeObservabilitySnapshot: () => ({ status: "observed" }),
    getTransportCapabilitiesSnapshot: () => ({ http: true }),
    getTransportHealthSnapshot: () => ({ status: "healthy" }),
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload })
  });

  await handlers.handleHealth({ method: "GET" }, { id: "res" }, { pathname: "/health" });

  assert.equal(calls[0].statusCode, 200);
  assert.deepEqual(calls[0].payload, {
    ok: true,
    server: "writable-mcp-bridge",
    serverVersion: "1.2.3",
    packageName: "bridge-package",
    packageVersion: "1.2.3",
    transportCapabilities: { http: true },
    runtimeFeatureFlags: { ws: true },
    aiDesigner: { provider: "codex_cli" },
    transportHealth: { status: "healthy" },
    commandReadiness: { state: "ready" },
    writeReadiness: { state: "ready" },
    port: 3846,
    activePlugins: ["plugin-1"],
    activePluginId: "plugin-1",
    activeSession: { pluginId: "plugin-1" },
    activeSessionResolution: { status: "ok" },
    currentReadHealth: "healthy",
    recentFailedTotal: 0,
    lastFailureAt: null,
    lastFailureCommand: null,
    observability: { status: "observed" }
  });
});

test("createStableRouteHandlers lists pages with explicit plugin id", async () => {
  const calls = [];
  const commandCalls = [];
  const listeners = [];
  const req = {
    method: "GET",
    once: (event, handler) => listeners.push(["req", event, handler]),
    off: (event, handler) => listeners.push(["req-off", event, handler])
  };
  const res = {
    once: (event, handler) => listeners.push(["res", event, handler]),
    off: (event, handler) => listeners.push(["res-off", event, handler])
  };
  const handlers = createStableRouteHandlers({
    canWriteResponse: () => true,
    executePluginCommand: async (...args) => {
      commandCalls.push(args);
      return { pages: [{ id: "0:1" }] };
    },
    jsonResponse: (response, statusCode, payload) => calls.push({ response, statusCode, payload })
  });

  await handlers.handlePages(
    req,
    res,
    { pathname: "/api/pages", searchParams: new URLSearchParams("pluginId=page:1") }
  );

  assert.deepEqual(commandCalls, [["page:1", "list_pages"]]);
  assert.deepEqual(calls[0], {
    response: res,
    statusCode: 200,
    payload: { ok: true, result: { pages: [{ id: "0:1" }] } }
  });
  assert.equal(listeners.filter(([target]) => target.endsWith("-off")).length, 3);
});

test("createStableRouteHandlers returns compose metrics", async () => {
  const calls = [];
  const handlers = createStableRouteHandlers({
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    performGetComposeMetrics: () => ({ screensBuilt: 2 })
  });

  await handlers.handleComposeMetrics(
    { method: "GET" },
    { id: "res" },
    { pathname: "/api/compose-metrics", searchParams: new URLSearchParams() }
  );

  assert.deepEqual(calls[0], {
    res: { id: "res" },
    statusCode: 200,
    payload: { ok: true, result: { screensBuilt: 2 } }
  });
});

test("createStableRouteHandlers reads Figma account routes", async () => {
  const calls = [];
  const apiOptions = { token: "test-token" };
  const invocations = [];
  const handlers = createStableRouteHandlers({
    buildFileCommentsPlan: (input) => ({ ...input, planned: true }),
    FIGMA_ACCOUNT_API_OPTIONS: apiOptions,
    getCurrentUser: async (...args) => {
      invocations.push(["me", args]);
      return { id: "user-1" };
    },
    getFileSummary: async (...args) => {
      invocations.push(["file-summary", args]);
      return { name: "File" };
    },
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    listFileComments: async (...args) => {
      invocations.push(["comments", args]);
      return { comments: [] };
    },
    listProjectFiles: async (...args) => {
      invocations.push(["project-files", args]);
      return { files: [] };
    },
    listTeamProjects: async (...args) => {
      invocations.push(["team-projects", args]);
      return { projects: [] };
    },
    pluginSessions: new Map([["page:1", { fileKey: "file-from-session" }]])
  });

  await handlers.handleFigmaMe(
    { method: "GET" },
    { id: "me-res" },
    { pathname: "/api/figma/me", searchParams: new URLSearchParams() }
  );
  await handlers.handleFigmaTeamProjects(
    { method: "GET" },
    { id: "team-res" },
    { pathname: "/api/figma/team-projects", searchParams: new URLSearchParams("teamId=t1&query=mobile&maxResults=5") }
  );
  await handlers.handleFigmaProjectFiles(
    { method: "GET" },
    { id: "project-res" },
    { pathname: "/api/figma/project-files", searchParams: new URLSearchParams("projectId=p1&branchData=true") }
  );
  await handlers.handleFigmaFileSummary(
    { method: "GET" },
    { id: "summary-res" },
    { pathname: "/api/figma/file-summary", searchParams: new URLSearchParams("fileKey=f1") }
  );
  await handlers.handleFigmaFileComments(
    { method: "GET" },
    { id: "comments-res" },
    { pathname: "/api/figma/file-comments", searchParams: new URLSearchParams("pluginId=page:1&includeResolved=false") }
  );

  assert.deepEqual(invocations, [
    ["me", [apiOptions]],
    [
      "team-projects",
      [
        { teamId: "t1", query: "mobile", maxResults: 5 },
        apiOptions
      ]
    ],
    [
      "project-files",
      [
        { projectId: "p1", query: null, maxResults: undefined, branchData: true },
        apiOptions
      ]
    ],
    ["file-summary", [{ fileKey: "f1" }, apiOptions]],
    [
      "comments",
      [
        {
          fileKey: "file-from-session",
          maxResults: undefined,
          includeResolved: false,
          targetNodeId: null,
          planned: true
        },
        apiOptions
      ]
    ]
  ]);
  assert.deepEqual(calls.map((entry) => entry.payload), [
    { ok: true, result: { id: "user-1" } },
    { ok: true, result: { projects: [] } },
    { ok: true, result: { files: [] } },
    { ok: true, result: { name: "File" } },
    { ok: true, result: { comments: [] } }
  ]);
});
