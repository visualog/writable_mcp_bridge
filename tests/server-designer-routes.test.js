import test from "node:test";
import assert from "node:assert/strict";

import {
  createDesignerRouteHandler,
  listDesignerRoutePaths
} from "../src/server-designer-routes.js";

test("designer route module lists stable route paths", () => {
  assert.ok(listDesignerRoutePaths().includes("/api/designer/chat"));
  assert.ok(listDesignerRoutePaths().includes("/api/designer/inspect-selection"));
  assert.ok(listDesignerRoutePaths().includes("/api/designer/action-candidates/preview"));
});

test("designer route handler returns model configuration snapshot", async () => {
  const calls = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    buildAiDesignerSnapshot: () => ({
      executionBackend: "codex_cli",
      provider: "openai",
      model: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      valid: true,
      configured: true,
      legacyConfig: false,
      modelPresets: [{ id: "gpt-4.1-mini" }],
      providerOptions: [{ id: "openai" }]
    }),
    getDesignerAiConfig: () => ({ provider: "openai" }),
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload })
  });

  const handled = await handleDesignerRoute(
    { method: "GET" },
    { id: "res" },
    { pathname: "/api/designer/models" }
  );

  assert.equal(handled, true);
  assert.deepEqual(calls[0], {
    res: { id: "res" },
    statusCode: 200,
    payload: {
      ok: true,
      current: {
        executionBackend: "codex_cli",
        provider: "openai",
        model: "gpt-4.1-mini",
        baseUrl: "https://api.openai.com/v1",
        valid: true,
        configured: true,
        legacyConfig: false
      },
      presets: [{ id: "gpt-4.1-mini" }],
      providerOptions: [{ id: "openai" }]
    }
  });
});

test("designer route handler selects model presets", async () => {
  const calls = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    applyDesignerModelPreset: (modelId) => ({
      id: modelId,
      shortLabel: "Mini",
      displayLabel: "GPT Mini",
      levelLabel: "중간"
    }),
    buildAiDesignerSnapshot: () => ({ model: "gpt-4.1-mini" }),
    getDesignerAiConfig: () => ({ provider: "openai" }),
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    readJsonBody: async () => ({ modelId: "gpt-4.1-mini" })
  });

  const handled = await handleDesignerRoute(
    { method: "POST" },
    { id: "res" },
    { pathname: "/api/designer/models/select" }
  );

  assert.equal(handled, true);
  assert.deepEqual(calls[0].payload, {
    ok: true,
    selected: {
      id: "gpt-4.1-mini",
      shortLabel: "Mini",
      displayLabel: "GPT Mini",
      levelLabel: "중간"
    },
    aiDesigner: { model: "gpt-4.1-mini" }
  });
});

test("designer route handler configures and tests local models", async () => {
  const calls = [];
  const validated = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    applyDesignerModelConfig: (config) => ({ saved: true, config }),
    buildAiDesignerSnapshot: () => ({ provider: "ollama", model: "llama3" }),
    getDesignerAiConfig: () => ({ provider: "ollama" }),
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    readJsonBody: async (req) => req.body,
    runDesignerModelConnectionProbe: async (config) => ({
      provider: config.provider,
      model: config.model,
      responseText: "pong",
      usage: { totalTokens: 1 }
    }),
    validateConfiguredLocalDesignerModel: async (provider, model) => validated.push({ provider, model })
  });

  const configureHandled = await handleDesignerRoute(
    {
      method: "POST",
      body: { provider: "ollama", model: "llama3", baseUrl: "http://localhost:11434", apiKey: "" }
    },
    { id: "configure-res" },
    { pathname: "/api/designer/models/configure" }
  );
  const testHandled = await handleDesignerRoute(
    {
      method: "POST",
      body: { provider: "ollama", model: "llama3", baseUrl: "http://localhost:11434", apiKey: "" }
    },
    { id: "test-res" },
    { pathname: "/api/designer/models/test" }
  );

  assert.equal(configureHandled, true);
  assert.equal(testHandled, true);
  assert.deepEqual(validated, [
    { provider: "ollama", model: "llama3" },
    { provider: "ollama", model: "llama3" }
  ]);
  assert.equal(calls[0].statusCode, 200);
  assert.deepEqual(calls[0].payload.aiDesigner, { provider: "ollama", model: "llama3" });
  assert.deepEqual(calls[1].payload, {
    ok: true,
    status: "completed",
    provider: "ollama",
    model: "llama3",
    reply: "pong",
    usage: { totalTokens: 1 }
  });
});

test("designer route handler discovers local providers", async () => {
  const calls = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    discoverLocalDesignerProviders: async () => ({
      providers: [{ id: "ollama" }],
      available: true
    }),
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload })
  });

  const handled = await handleDesignerRoute(
    { method: "GET" },
    { id: "res" },
    { pathname: "/api/designer/providers/discover-local" }
  );

  assert.equal(handled, true);
  assert.deepEqual(calls[0].payload, {
    ok: true,
    providers: [{ id: "ollama" }],
    available: true
  });
});

test("designer route handler delegates inspect-selection requests", async () => {
  const calls = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    readJsonBody: async () => ({ pluginId: "page:1" }),
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    executeDesignerInspectSelectionRequest: async (body) => ({
      ok: true,
      inspectedPluginId: body.pluginId
    })
  });

  const handled = await handleDesignerRoute(
    { method: "POST" },
    { id: "res" },
    { pathname: "/api/designer/inspect-selection" }
  );

  assert.equal(handled, true);
  assert.deepEqual(calls, [
    {
      res: { id: "res" },
      statusCode: 200,
      payload: {
        ok: true,
        inspectedPluginId: "page:1"
      }
    }
  ]);
});

test("designer route handler builds read-context responses", async () => {
  const calls = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    buildDesignerActionPreviewBundle: ({ designerSuggestionBundle }) => ({
      previewFor: designerSuggestionBundle.summaryText
    }),
    buildDesignerSuggestionBundle: () => ({ summaryText: "요약" }),
    createDesignerIntentEnvelope: () => ({ intents: [{ kind: "inspect_selection" }] }),
    executeDesignerReadPlan: async () => ({ phases: [], contextModel: {} }),
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    readJsonBody: async () => ({
      pluginId: "page:1",
      query: "선택 분석",
      figmaContext: { fileKey: "file-1" }
    }),
    resolveActivePluginId: (pluginId) => `resolved:${pluginId}`,
    runDesignerReadCommand: async () => ({ ok: true })
  });

  const handled = await handleDesignerRoute(
    { method: "POST" },
    { id: "res" },
    { pathname: "/api/designer/read-context" }
  );

  assert.equal(handled, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].statusCode, 200);
  assert.equal(calls[0].payload.ok, true);
  assert.deepEqual(calls[0].payload.designerActionPreviewBundle, {
    previewFor: "요약"
  });
  assert.deepEqual(calls[0].payload.designerSuggestionBundle.actionPreviewBundle, {
    previewFor: "요약"
  });
});

test("designer route handler runs action candidate commands", async () => {
  const calls = [];
  const commandCalls = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    readJsonBody: async () => ({
      pluginId: "page:1",
      candidate: { command: "get_selection" },
      query: "선택 확인",
      fileKey: "file-1",
      fileKeys: ["file-1"]
    }),
    runDesignerActionCandidateCommand: async (...args) => {
      commandCalls.push(args);
      return { selectionCount: 1 };
    }
  });

  const handled = await handleDesignerRoute(
    { method: "POST" },
    { id: "res" },
    { pathname: "/api/designer/action-candidates/run" }
  );

  assert.equal(handled, true);
  assert.deepEqual(commandCalls, [
    [
      "page:1",
      { command: "get_selection" },
      {
        query: "선택 확인",
        fileKey: "file-1",
        fileKeys: ["file-1"]
      }
    ]
  ]);
  assert.deepEqual(calls[0], {
    res: { id: "res" },
    statusCode: 200,
    payload: {
      ok: true,
      command: "get_selection",
      result: { selectionCount: 1 }
    }
  });
});

test("designer route handler previews action candidate commands", async () => {
  const calls = [];
  const previewCalls = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    getDesignerAiConfig: () => ({ provider: "codex_cli" }),
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    previewDesignerActionCandidateCommand: async (...args) => {
      previewCalls.push(args);
      return {
        provider: "codex_cli",
        model: "codex",
        preview: { updates: [{ nodeId: "1:2" }] }
      };
    },
    readJsonBody: async () => ({
      pluginId: "page:1",
      candidate: { command: "bulk_update_texts" },
      message: "문구 변경",
      actionLabel: "적용",
      figmaContext: { selectionIds: ["1:2"] }
    })
  });

  const handled = await handleDesignerRoute(
    { method: "POST" },
    { id: "res" },
    { pathname: "/api/designer/action-candidates/preview" }
  );

  assert.equal(handled, true);
  assert.deepEqual(previewCalls[0], [
    "page:1",
    { command: "bulk_update_texts" },
    {
      message: "문구 변경",
      actionLabel: "적용",
      figmaContext: { selectionIds: ["1:2"] },
      aiConfig: { provider: "codex_cli" }
    }
  ]);
  assert.deepEqual(calls[0].payload, {
    ok: true,
    command: "bulk_update_texts",
    provider: "codex_cli",
    model: "codex",
    preview: { updates: [{ nodeId: "1:2" }] }
  });
});

test("designer route handler confirms action candidate commands with post-apply verification", async () => {
  const calls = [];
  const compareCalls = [];
  const handleDesignerRoute = createDesignerRouteHandler({
    buildPostApplyComparisonQualityVerification: (previous, comparison) => ({
      previousStatus: previous.status,
      currentStatus: comparison.status
    }),
    confirmDesignerActionCandidateCommand: async () => ({
      appliedUpdateCount: 2,
      result: { ok: true }
    }),
    executeDesignerCompareReferenceAndGeneratedRequest: async (...args) => {
      compareCalls.push(args);
      return { comparison: { status: "improved" } };
    },
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    readJsonBody: async () => ({
      pluginId: "page:1",
      candidate: { command: "bulk_update_texts" },
      preview: { updates: [] },
      previousComparison: { status: "before" },
      verifyAfterApply: {
        referenceNodeId: "1:ref",
        generatedNodeId: "1:generated"
      }
    })
  });

  const handled = await handleDesignerRoute(
    { method: "POST" },
    { id: "res" },
    { pathname: "/api/designer/action-candidates/confirm" }
  );

  assert.equal(handled, true);
  assert.deepEqual(compareCalls[0], [
    {
      pluginId: "page:1",
      body: {
        selectionIds: ["1:ref", "1:generated"]
      },
      message: "confirmed generated screen repair verification",
      figmaContext: {},
      intentEnvelope: null
    }
  ]);
  assert.deepEqual(calls[0].payload, {
    ok: true,
    command: "bulk_update_texts",
    appliedUpdateCount: 2,
    result: { ok: true },
    postApplyComparison: { status: "improved" },
    qualityVerification: {
      previousStatus: "before",
      currentStatus: "improved"
    }
  });
});

test("designer route handler delegates debug bridge chat requests", async () => {
  const calls = [];
  const debugCalls = [];
  const intentEnvelope = {
    intentClassification: {
      userIntentKind: "debug_bridge_failure"
    },
    intents: [{ kind: "debug_bridge_failure" }]
  };
  const handleDesignerRoute = createDesignerRouteHandler({
    createDesignerIntentEnvelope: (body, figmaContext) => ({
      ...intentEnvelope,
      bodyRequest: body.request,
      figmaContext
    }),
    executeDesignerDebugBridgeFailureRequest: async (...args) => {
      debugCalls.push(args);
      return { ok: true, diagnosis: "debugged" };
    },
    jsonResponse: (res, statusCode, payload) => calls.push({ res, statusCode, payload }),
    readJsonBody: async () => ({
      pluginId: "page:1",
      message: "왜 실패했는지 봐줘",
      figmaContext: { selectionIds: ["1:2"] }
    }),
    resolveActivePluginId: (pluginId) => `resolved:${pluginId}`
  });

  const handled = await handleDesignerRoute(
    { method: "POST" },
    { id: "res" },
    { pathname: "/api/designer/chat" }
  );

  assert.equal(handled, true);
  assert.deepEqual(debugCalls[0], [
    {
      pluginId: "resolved:page:1",
      message: "왜 실패했는지 봐줘",
      figmaContext: { selectionIds: ["1:2"] },
      intentEnvelope: {
        ...intentEnvelope,
        bodyRequest: "왜 실패했는지 봐줘",
        figmaContext: { selectionIds: ["1:2"] }
      }
    }
  ]);
  assert.deepEqual(calls[0], {
    res: { id: "res" },
    statusCode: 200,
    payload: { ok: true, diagnosis: "debugged" }
  });
});
