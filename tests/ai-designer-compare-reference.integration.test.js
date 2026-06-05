import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to reserve a numeric port")));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });
}

function waitForBridgeListening(childProcess, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for bridge to start listening"));
    }, timeoutMs);
    timer.unref?.();

    const onData = (chunk) => {
      const text = chunk.toString("utf8");
      const match = text.match(/listening on http:\/\/127\.0\.0\.1:(\d+)/);
      if (!match) {
        return;
      }
      cleanup();
      resolve(Number(match[1]));
    };

    const onExit = (code, signal) => {
      cleanup();
      reject(new Error(`Bridge exited before listening (code=${String(code)}, signal=${String(signal)})`));
    };

    const cleanup = () => {
      clearTimeout(timer);
      childProcess.stderr?.off("data", onData);
      childProcess.off("exit", onExit);
    };

    childProcess.stderr?.on("data", onData);
    childProcess.once("exit", onExit);
  });
}

async function stopBridge(childProcess) {
  if (!childProcess || childProcess.exitCode !== null) {
    return;
  }
  const didExit = new Promise((resolve) => {
    childProcess.once("exit", () => resolve());
  });
  childProcess.kill("SIGTERM");
  await didExit;
}

async function startBridgeServer(extraEnv = {}) {
  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      OPENAI_API_KEY: "",
      XBRIDGE_AI_API_KEY: "",
      ...extraEnv
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const listeningPort = await waitForBridgeListening(childProcess);
  return {
    origin: `http://127.0.0.1:${listeningPort}`,
    childProcess
  };
}

async function postJson(origin, requestPath, payload) {
  const response = await fetch(`${origin}${requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function getJson(origin, requestPath) {
  const response = await fetch(`${origin}${requestPath}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

async function waitForPluginCommands(origin, pluginId, { min = 1, timeoutMs = 2000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await getJson(
      origin,
      `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
    );
    if ((response.body?.commands?.length || 0) >= min) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for ${min} command(s) for plugin ${pluginId}`);
}

async function completeNextCommand(origin, pluginId, result) {
  const poll = await waitForPluginCommands(origin, pluginId);
  assert.equal(poll.body.commands.length, 1);
  await postJson(origin, "/plugin/results", {
    commandId: poll.body.commands[0].commandId,
    result
  });
  return poll.body.commands[0];
}

function metadataResultFromNode(pluginId, node) {
  return {
    pluginId,
    pageId: "page:test",
    pageName: "Page 55",
    json: {
      roots: [node]
    },
    nodeCount: 1,
    truncated: false
  };
}

test("designer chat compares selected reference and generated screens with text and bbox deltas", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-reference-generated";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:1", name: "Reference screen", type: "FRAME" },
        { id: "gen:1", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  const firstCommand = await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "ref:1",
      name: "Running Challenge screen",
      type: "FRAME",
      geometry: { x: 0, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "ref-title",
          name: "title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 112, y: 48, width: 166, height: 22 }
        },
        {
          id: "ref-status-bar",
          name: "iOS status bar",
          type: "FRAME",
          geometry: { x: 0, y: 0, width: 390, height: 44 },
          children: [
            {
              id: "ref-signal-helper",
              name: "Signal bar 1",
              type: "TEXT",
              characters: "Signal bar 1",
              geometry: { x: 300, y: 12, width: 4, height: 12 }
            },
            {
              id: "ref-battery-helper",
              name: "Battery fill",
              type: "TEXT",
              characters: "Battery fill",
              geometry: { x: 352, y: 12, width: 18, height: 8 }
            },
            {
              id: "ref-chevron-icon",
              name: "coupon chevron",
              type: "TEXT",
              characters: "›",
              geometry: { x: 348, y: 804, width: 8, height: 18 }
            }
          ]
        },
        {
          id: "ref-subtitle",
          name: "subtitle",
          type: "TEXT",
          characters: "Weekend Warriors",
          geometry: { x: 42, y: 80, width: 160, height: 18 }
        },
        {
          id: "ref-hero",
          name: "hero image panel",
          type: "RECTANGLE",
          fillColor: "#ff5b3d",
          geometry: { x: 24, y: 104, width: 342, height: 140 },
          children: [
            {
              id: "ref-left-avatar-label",
              name: "Left avatar image block",
              type: "TEXT",
              characters: "Left avatar image block",
              geometry: { x: 72, y: 132, width: 72, height: 72 }
            },
            {
              id: "ref-hero-shade-label",
              name: "Hero bottom shade",
              type: "TEXT",
              characters: "Hero bottom shade",
              geometry: { x: 24, y: 210, width: 342, height: 34 }
            }
          ]
        },
        {
          id: "ref-source-image",
          name: "Source image reference",
          type: "IMAGE",
          geometry: { x: 0, y: 0, width: 390, height: 844 }
        },
        {
          id: "ref-progress",
          name: "score progress bar",
          type: "RECTANGLE",
          fillColor: "#ffb800",
          geometry: { x: 42, y: 680, width: 286, height: 6 }
        },
        {
          id: "ref-results-card",
          name: "Results card",
          type: "FRAME",
          geometry: { x: 24, y: 260, width: 342, height: 160 },
          children: [
            {
              id: "ref-results-label",
              name: "label",
              type: "TEXT",
              characters: "Results",
              geometry: { x: 42, y: 280, width: 64, height: 18 }
            },
            {
              id: "ref-distance-label",
              name: "metric",
              type: "TEXT",
              characters: "Distance",
              geometry: { x: 42, y: 316, width: 68, height: 18 }
            },
            {
              id: "ref-distance-value",
              name: "value",
              type: "TEXT",
              characters: "24.7km",
              geometry: { x: 152, y: 316, width: 72, height: 18 }
            }
          ]
        },
        {
          id: "ref-reward",
          name: "reward",
          type: "TEXT",
          characters: "Winner gets 50 coins + Champion Badge",
          geometry: { x: 42, y: 804, width: 306, height: 18 }
        }
      ]
  }));
  assert.equal(firstCommand.type, "get_metadata");
  assert.equal(firstCommand.payload.targetNodeId, "ref:1");
  assert.equal(firstCommand.payload.includeJson, true);
  assert.equal(firstCommand.payload.maxDepth >= 4, true);
  assert.equal(firstCommand.payload.maxNodes >= 100, true);

  const secondCommand = await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:1",
      name: "Running Challenge screen",
      type: "FRAME",
      geometry: { x: 480, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "gen-title",
          name: "title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 600, y: 66, width: 166, height: 22 }
        },
        {
          id: "gen-status-bar",
          name: "iOS status bar",
          type: "FRAME",
          geometry: { x: 480, y: 26, width: 390, height: 44 }
        },
        {
          id: "gen-subtitle",
          name: "subtitle",
          type: "TEXT",
          characters: "Weekend Warriors",
          geometry: { x: 522, y: 118, width: 160, height: 18 }
        },
        {
          id: "gen-hero",
          name: "hero image panel",
          type: "RECTANGLE",
          fillColor: "#f2f4f7",
          geometry: { x: 514, y: 112, width: 320, height: 132 }
        },
        {
          id: "gen-source-image",
          name: "Source image reference",
          type: "IMAGE",
          geometry: { x: 480, y: 26, width: 390, height: 844 }
        },
        {
          id: "gen-results-label",
          name: "label",
          type: "TEXT",
          characters: "Results",
          geometry: { x: 522, y: 280, width: 64, height: 18 }
        },
        {
          id: "gen-distance-label",
          name: "metric",
          type: "TEXT",
          characters: "Distance",
          geometry: { x: 522, y: 316, width: 68, height: 18 }
        },
        {
          id: "gen-distance-value",
          name: "value",
          type: "TEXT",
          characters: "24.7 km",
          geometry: { x: 632, y: 316, width: 72, height: 18 }
        },
        {
          id: "gen-extra",
          name: "helper",
          type: "TEXT",
          characters: "Competitor image collage",
          geometry: { x: 520, y: 120, width: 180, height: 18 }
        },
        {
          id: "gen-icon-text",
          name: "flash icon",
          type: "TEXT",
          characters: "↯",
          geometry: { x: 520, y: 140, width: 12, height: 12 }
        }
      ]
  }));
  assert.equal(secondCommand.type, "get_metadata");
  assert.equal(secondCommand.payload.targetNodeId, "gen:1");
  assert.equal(secondCommand.payload.includeJson, true);
  assert.equal(secondCommand.payload.maxDepth >= 4, true);
  assert.equal(secondCommand.payload.maxNodes >= 100, true);

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.intentKind, "compare_reference_and_generated");
  assert.equal(response.body.comparison.referenceNodeId, "ref:1");
  assert.equal(response.body.comparison.generatedNodeId, "gen:1");
  assert.deepEqual(response.body.comparison.missingTexts, [
    "Winner gets 50 coins + Champion Badge"
  ]);
  assert.equal(response.body.comparison.missingTexts.includes("Signal bar 1"), false);
  assert.equal(response.body.comparison.missingTexts.includes("Battery fill"), false);
  assert.equal(response.body.comparison.missingTexts.includes("›"), false);
  assert.equal(response.body.comparison.missingTexts.includes("Left avatar image block"), false);
  assert.equal(response.body.comparison.missingTexts.includes("Hero bottom shade"), false);
  assert.deepEqual(response.body.comparison.extraTexts, ["Competitor image collage"]);
  assert.equal(response.body.comparison.extraTexts.includes("↯"), false);
  assert.equal(response.body.comparison.matchedTexts.includes("Running Challenge"), true);
  assert.equal(response.body.comparison.matchedTexts.includes("24.7km"), true);
  assert.equal(response.body.comparison.missingTexts.includes("24.7km"), false);
  assert.equal(response.body.comparison.extraTexts.includes("24.7 km"), false);
  assert.equal(response.body.comparison.textCoverage, 0.833);
  assert.equal(response.body.comparison.bboxDeltas[0].text, "Running Challenge");
  assert.equal(response.body.comparison.bboxDeltas[0].deltaX, 8);
  assert.equal(response.body.comparison.bboxDeltas[0].deltaY, 18);
  assert.equal(response.body.comparison.materialBboxDeltaCount > 0, true);
  assert.equal(response.body.comparison.visualDeltas.roleCounts.reference.progress, 1);
  assert.equal(response.body.comparison.visualDeltas.roleCounts.generated.progress || 0, 0);
  assert.equal(response.body.comparison.visualDeltas.roleCounts.reference.status_bar, 1);
  assert.equal(response.body.comparison.visualDeltas.missingRoles.includes("progress"), true);
  assert.equal(
    response.body.comparison.visualDeltas.geometryDeltas.some((entry) => entry.role === "status_bar"),
    false
  );
  assert.equal(
    response.body.comparison.visualDeltas.geometryDiagnostics.some((entry) => entry.role === "status_bar"),
    true
  );
  assert.equal(response.body.comparison.visualDeltas.colorDeltas[0].referenceColor, "#ff5b3d");
  assert.equal(response.body.comparison.visualDeltas.colorDeltas[0].generatedColor, "#f2f4f7");
  assert.equal(
    response.body.comparison.visualDeltas.geometryDeltas.some((entry) => entry.generatedNodeId === "gen:1"),
    false
  );
  assert.equal(
    response.body.comparison.visualDeltas.geometryDeltas.some((entry) => entry.generatedNodeId === "gen-source-image"),
    false
  );
  assert.equal(
    response.body.comparison.visualDeltas.missingRoleEntries.some((entry) => entry.name === "Source image reference"),
    false
  );
  const heroGeometryDelta = response.body.comparison.visualDeltas.geometryDeltas.find(
    (entry) => entry.generatedNodeId === "gen-hero"
  );
  assert.equal(heroGeometryDelta.deltaX, 10);
  assert.equal(heroGeometryDelta.deltaWidth, -22);
  assert.equal(response.body.comparison.visualDeltas.spacingDeltas[0].fromText, "Running Challenge");
  assert.equal(response.body.comparison.visualDeltas.spacingDeltas[0].toText, "Weekend Warriors");
  assert.equal(response.body.comparison.visualDeltas.spacingDeltas[0].referenceGapY, 10);
  assert.equal(response.body.comparison.visualDeltas.spacingDeltas[0].generatedGapY, 30);
  assert.equal(response.body.comparison.visualDeltas.groupDeltas.missingGroups[0].name, "Results card");
  assert.deepEqual(response.body.comparison.visualDeltas.groupDeltas.missingGroups[0].textSignature, [
    "Results",
    "Distance",
    "24.7km"
  ]);
  assert.deepEqual(response.body.comparison.visualDeltas.groupDeltas.missingGroups[0].generatedTextNodeIds, [
    "gen-results-label",
    "gen-distance-label",
    "gen-distance-value"
  ]);
});

test("designer chat reports generated layout sanity issues for overlapping and offscreen nodes", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-layout-sanity";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 화면과 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:sanity", name: "Reference", type: "FRAME" },
        { id: "gen:sanity", name: "Generated", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "ref:sanity",
    name: "Reference",
    type: "FRAME",
    geometry: { x: 0, y: 0, width: 390, height: 844 },
    children: [
      { id: "ref-title", type: "TEXT", characters: "Running Challenge", geometry: { x: 24, y: 96, width: 166, height: 22 } },
      { id: "ref-subtitle", type: "TEXT", characters: "Weekend Warriors", geometry: { x: 24, y: 132, width: 160, height: 18 } },
      { id: "ref-footer", type: "TEXT", characters: "Winner gets 50 coins", geometry: { x: 24, y: 800, width: 180, height: 18 } }
    ]
  }));
  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "gen:sanity",
    name: "Generated",
    type: "FRAME",
    geometry: { x: 500, y: 0, width: 390, height: 844 },
    children: [
      { id: "gen-title", type: "TEXT", characters: "Running Challenge", geometry: { x: 524, y: 96, width: 166, height: 22 } },
      { id: "gen-subtitle", type: "TEXT", characters: "Weekend Warriors", geometry: { x: 526, y: 102, width: 160, height: 18 } },
      { id: "gen-footer", type: "TEXT", characters: "Winner gets 50 coins", geometry: { x: 524, y: 880, width: 180, height: 18 } }
    ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.comparison.visualDeltas.layoutSanity.reference.issueCount, 0);
  assert.equal(response.body.comparison.visualDeltas.layoutSanity.generated.textOverlapCount, 1);
  assert.equal(response.body.comparison.visualDeltas.layoutSanity.generated.offscreenCount, 1);
  assert.equal(response.body.comparison.visualDeltas.layoutSanity.generated.issueCount, 2);
  assert.equal(response.body.comparison.visualDeltas.layoutSanity.excessGeneratedIssueCount, 2);
  assert.equal(
    response.body.comparison.recommendations.some((item) => item.includes("offscreen")),
    true
  );
});

test("designer chat separates generic layer-count drift from actionable missing roles", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-role-count-drift";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 화면과 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:roles", name: "Reference", type: "FRAME" },
        { id: "gen:roles", name: "Generated", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "ref:roles",
    name: "Reference",
    type: "FRAME",
    geometry: { x: 0, y: 0, width: 390, height: 844 },
    children: [
      { id: "ref-title", type: "TEXT", characters: "Running Challenge", geometry: { x: 24, y: 48, width: 160, height: 22 } },
      { id: "ref-label", type: "TEXT", characters: "Results", geometry: { x: 24, y: 120, width: 80, height: 18 } },
      { id: "ref-bar-1", name: "progress segment", type: "RECTANGLE", geometry: { x: 24, y: 180, width: 120, height: 4 } }
    ]
  }));
  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "gen:roles",
    name: "Generated",
    type: "FRAME",
    geometry: { x: 500, y: 0, width: 390, height: 844 },
    children: [
      { id: "gen-title", type: "TEXT", characters: "Running Challenge", geometry: { x: 524, y: 48, width: 160, height: 22 } },
      { id: "gen-bar-1", name: "progress segment 1", type: "RECTANGLE", geometry: { x: 524, y: 180, width: 60, height: 4 } },
      { id: "gen-bar-2", name: "progress segment 2", type: "RECTANGLE", geometry: { x: 584, y: 180, width: 60, height: 4 } }
    ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.comparison.missingTexts, ["Results"]);
  assert.equal(response.body.comparison.visualDeltas.missingRoles.includes("text"), false);
  assert.equal(response.body.comparison.visualDeltas.extraRoles.includes("progress"), false);
  assert.equal(
    response.body.comparison.visualDeltas.roleCountDeltas.some(
      (entry) => entry.role === "progress" && entry.delta === 1 && entry.actionable === false
    ),
    true
  );
});

test("designer improve plans text bbox repairs for generated layout sanity overlaps", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:improve-layout-sanity";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 화면 기준으로 기존 생성 화면 품질을 개선해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:layout-repair", name: "Reference", type: "FRAME" },
        { id: "gen:layout-repair", name: "Generated", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "ref:layout-repair",
    name: "Reference",
    type: "FRAME",
    geometry: { x: 0, y: 0, width: 390, height: 844 },
    children: [
      { id: "ref-title", type: "TEXT", characters: "Running Challenge", geometry: { x: 24, y: 96, width: 166, height: 22 } },
      { id: "ref-subtitle", type: "TEXT", characters: "Weekend Warriors", geometry: { x: 24, y: 132, width: 160, height: 18 } }
    ]
  }));
  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "gen:layout-repair",
    name: "Generated",
    type: "FRAME",
    geometry: { x: 500, y: 0, width: 390, height: 844 },
    children: [
      { id: "gen-title", type: "TEXT", characters: "Running Challenge", geometry: { x: 524, y: 96, width: 166, height: 22 } },
      { id: "gen-subtitle", type: "TEXT", characters: "Weekend Warriors", geometry: { x: 526, y: 102, width: 160, height: 18 } }
    ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.repairPlan.updateNodeBboxes.length, 1);
  assert.equal(response.body.repairPlan.updateNodeBboxes[0].nodeId, "gen-subtitle");
  assert.equal(response.body.repairPlan.updateNodeBboxes[0].reason, "layout_sanity_text_overlap");
  assert.equal(response.body.repairPlan.updateNodeBboxes[0].y, 132);
  assert.deepEqual(
    response.body.repairPlan.visualRepairs.layoutSanityUpdates.map((entry) => entry.generatedNodeId),
    ["gen-subtitle"]
  );
  assert.deepEqual(
    response.body.actionCandidates.map((candidate) => candidate.command),
    ["generated_screen_repair", "bulk_update_nodes"]
  );
});

test("designer chat proposes partial regroup repair for table groups with enough generated text coverage", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:partial-regroup";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 화면 기준으로 기존 생성 화면 품질을 개선해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:partial", name: "Reference screen", type: "FRAME" },
        { id: "gen:partial", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  const postApplyReferenceResult = metadataResultFromNode(pluginId, {
    id: "ref:partial",
    name: "Reference screen",
    type: "FRAME",
    geometry: { x: 0, y: 0, width: 390, height: 844 },
    children: [
      {
        id: "ref-results-table",
        name: "Results table",
        type: "FRAME",
        geometry: { x: 24, y: 260, width: 342, height: 160 },
        children: [
          {
            id: "ref-results-label",
            type: "TEXT",
            characters: "Results",
            geometry: { x: 42, y: 280, width: 64, height: 18 }
          },
          {
            id: "ref-me-label",
            type: "TEXT",
            characters: "Me",
            geometry: { x: 152, y: 280, width: 40, height: 18 }
          },
          {
            id: "ref-distance-label",
            type: "TEXT",
            characters: "Distance",
            geometry: { x: 42, y: 316, width: 68, height: 18 }
          },
          {
            id: "ref-distance-value",
            type: "TEXT",
            characters: "24.7km",
            geometry: { x: 152, y: 316, width: 72, height: 18 }
          },
          {
            id: "ref-pace-label",
            type: "TEXT",
            characters: "Avg Pace",
            geometry: { x: 42, y: 352, width: 72, height: 18 }
          }
        ]
      }
    ]
  });

  const referenceCommand = await completeNextCommand(bridge.origin, pluginId, postApplyReferenceResult);
  assert.equal(referenceCommand.type, "get_metadata");
  assert.equal(referenceCommand.payload.targetNodeId, "ref:partial");

  const generatedCommand = await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "gen:partial",
    name: "Generated screen",
    type: "FRAME",
    geometry: { x: 480, y: 0, width: 390, height: 844 },
    children: [
      {
        id: "gen-results-label",
        type: "TEXT",
        characters: "Results",
        geometry: { x: 522, y: 280, width: 64, height: 18 }
      },
      {
        id: "gen-me-label",
        type: "TEXT",
        characters: "Me",
        geometry: { x: 632, y: 280, width: 40, height: 18 }
      }
    ]
  }));
  assert.equal(generatedCommand.type, "get_metadata");
  assert.equal(generatedCommand.payload.targetNodeId, "gen:partial");

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.comparison.visualDeltas.groupDeltas.missingGroups[0].generatedTextCoverage, 0.4);
  assert.deepEqual(response.body.comparison.visualDeltas.groupDeltas.missingGroups[0].generatedTextNodeIds, [
    "gen-results-label",
    "gen-me-label"
  ]);
  assert.equal(response.body.repairPlan.regroupNodes.length, 1);
  assert.equal(response.body.repairPlan.regroupNodes[0].name, "Results table");
  assert.equal(response.body.repairPlan.regroupNodes[0].partial, true);
  assert.equal(response.body.repairPlan.updateNodeBboxes.length, 0);
  assert.deepEqual(response.body.repairPlan.regroupNodes[0].nodeIds, [
    "gen-results-label",
    "gen-me-label"
  ]);
  assert.deepEqual(
    response.body.actionCandidates.map((candidate) => candidate.command),
    ["generated_screen_repair", "bulk_create_nodes"]
  );

  const repairCandidate =
    response.body.designerActionPreviewBundle.previews[0].bridgeCommandCandidates[0];
  const repairPreview = await postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    candidate: repairCandidate
  });
  assert.equal(repairPreview.status, 200);
  assert.equal(repairPreview.body.ok, true);
  assert.equal(repairPreview.body.preview.repairPlan.regroupNodes[0].partial, true);

  const repairConfirmRequest = postJson(bridge.origin, "/api/designer/action-candidates/confirm", {
    pluginId,
    candidate: repairCandidate,
    preview: repairPreview.body.preview,
    previousComparison: response.body.comparison,
    verifyAfterApply: {
      referenceNodeId: "ref:partial",
      generatedNodeId: "gen:partial"
    }
  });
  const createPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(createPoll.body.commands[0].type, "bulk_create_nodes");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: createPoll.body.commands[0].commandId,
    result: {
      created: {
        created: [
          { id: "created-distance" },
          { id: "created-distance-value" },
          { id: "created-pace" },
          { id: "created-results-table-frame" }
        ]
      }
    }
  });
  for (const expectedNodeId of [
    "gen-results-label",
    "gen-me-label",
    "created-distance",
    "created-distance-value",
    "created-pace"
  ]) {
    const movePoll = await waitForPluginCommands(bridge.origin, pluginId);
    assert.equal(movePoll.body.commands[0].type, "move_node");
    assert.equal(movePoll.body.commands[0].payload.nodeId, expectedNodeId);
    assert.equal(movePoll.body.commands[0].payload.parentId, "created-results-table-frame");
    await postJson(bridge.origin, "/plugin/results", {
      commandId: movePoll.body.commands[0].commandId,
      result: { moved: { id: expectedNodeId, parentId: "created-results-table-frame" } }
    });
  }

  const postApplyGeneratedResult = metadataResultFromNode(pluginId, {
    id: "gen:partial",
    name: "Generated screen",
    type: "FRAME",
    geometry: { x: 480, y: 0, width: 390, height: 844 },
    children: [
      {
        id: "created-results-table-frame",
        name: "Results table",
        type: "FRAME",
        geometry: { x: 504, y: 260, width: 342, height: 160 },
        children: [
          { id: "gen-results-label", type: "TEXT", characters: "Results", geometry: { x: 522, y: 280, width: 64, height: 18 } },
          { id: "gen-me-label", type: "TEXT", characters: "Me", geometry: { x: 632, y: 280, width: 40, height: 18 } },
          { id: "created-distance", type: "TEXT", characters: "Distance", geometry: { x: 522, y: 316, width: 68, height: 18 } },
          { id: "created-distance-value", type: "TEXT", characters: "24.7km", geometry: { x: 632, y: 316, width: 72, height: 18 } },
          { id: "created-pace", type: "TEXT", characters: "Avg Pace", geometry: { x: 522, y: 352, width: 72, height: 18 } }
        ]
      }
    ]
  });
  const postApplyResultsByTarget = new Map([
    ["ref:partial", postApplyReferenceResult],
    ["gen:partial", postApplyGeneratedResult]
  ]);
  let completedPostApplyReads = 0;
  while (completedPostApplyReads < 2) {
    const poll = await waitForPluginCommands(bridge.origin, pluginId, { timeoutMs: 5000 });
    const command = poll.body.commands[0];
    if (command.type === "get_metadata" && postApplyResultsByTarget.has(command.payload?.targetNodeId)) {
      await postJson(bridge.origin, "/plugin/results", {
        commandId: command.commandId,
        result: postApplyResultsByTarget.get(command.payload.targetNodeId)
      });
      completedPostApplyReads += 1;
      continue;
    }
    await postJson(bridge.origin, "/plugin/results", {
      commandId: command.commandId,
      result: { ok: true }
    });
  }

  const repairConfirm = await repairConfirmRequest;
  assert.equal(repairConfirm.status, 200);
  assert.equal(repairConfirm.body.ok, true);
  assert.equal(repairConfirm.body.qualityVerification.metrics.missingGroupDelta, -1);
  assert.equal(repairConfirm.body.qualityVerification.metrics.partialGroupMatchDelta, 0);
  assert.equal(repairConfirm.body.qualityVerification.metrics.layoutIssueDelta, 0);
  assert.equal(repairConfirm.body.qualityVerification.improved, true);
});

test("designer chat creates group-scoped duplicate text for repeated labels during regroup repair", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:duplicate-label-regroup";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 화면 기준으로 기존 생성 화면 품질을 개선해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:duplicate", name: "Reference screen", type: "FRAME" },
        { id: "gen:duplicate", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "ref:duplicate",
    name: "Reference screen",
    type: "FRAME",
    geometry: { x: 0, y: 0, width: 390, height: 844 },
    children: [
      {
        id: "ref-progress-card",
        name: "Progress summary card",
        type: "FRAME",
        geometry: { x: 24, y: 440, width: 342, height: 128 },
        children: [
          { id: "ref-progress-title", type: "TEXT", characters: "Results", geometry: { x: 42, y: 452, width: 64, height: 18 } },
          { id: "ref-progress-distance", type: "TEXT", characters: "1 km", geometry: { x: 42, y: 484, width: 56, height: 18 } },
          { id: "ref-progress-points", type: "TEXT", characters: "113 pts", geometry: { x: 318, y: 484, width: 64, height: 18 } },
          { id: "ref-progress-distance-2", type: "TEXT", characters: "1 km", geometry: { x: 42, y: 532, width: 56, height: 18 } }
        ]
      }
    ]
  }));

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "gen:duplicate",
    name: "Generated screen",
    type: "FRAME",
    geometry: { x: 480, y: 0, width: 390, height: 844 },
    children: [
      { id: "gen-progress-title", type: "TEXT", characters: "Results", geometry: { x: 522, y: 452, width: 64, height: 18 } },
      { id: "gen-progress-distance", type: "TEXT", characters: "1 km", geometry: { x: 522, y: 484, width: 56, height: 18 } },
      { id: "gen-progress-points", type: "TEXT", characters: "113 pts", geometry: { x: 798, y: 484, width: 64, height: 18 } }
    ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.comparison.missingTexts, []);
  assert.equal(response.body.comparison.visualDeltas.groupDeltas.missingGroups[0].generatedTextCoverage, 0.75);
  assert.equal(response.body.comparison.visualDeltas.groupDeltas.missingGroups[0].missingTextEntries[0].text, "1 km");
  assert.equal(response.body.repairPlan.regroupNodes.length, 1);
  assert.equal(response.body.repairPlan.regroupNodes[0].name, "Progress summary card");
  assert.equal(response.body.repairPlan.createTextNodes.length, 1);
  assert.equal(response.body.repairPlan.createTextNodes[0].characters, "1 km");
  assert.equal(response.body.repairPlan.createTextNodes[0].regroupTargetIndex, 0);

  const repairCandidate =
    response.body.designerActionPreviewBundle.previews[0].bridgeCommandCandidates[0];
  const repairPreview = await postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    candidate: repairCandidate
  });
  assert.equal(repairPreview.status, 200);
  assert.equal(repairPreview.body.ok, true);
  assert.equal(repairPreview.body.preview.repairPlan.createTextNodes[0].regroupTargetIndex, 0);

  const repairConfirmRequest = postJson(bridge.origin, "/api/designer/action-candidates/confirm", {
    pluginId,
    candidate: repairCandidate,
    preview: repairPreview.body.preview
  });
  const createPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(createPoll.body.commands[0].type, "bulk_create_nodes");
  assert.equal(createPoll.body.commands[0].payload.nodes.length, 3);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: createPoll.body.commands[0].commandId,
    result: {
      created: {
        created: [
          { id: "created-duplicate-distance" },
          { id: "created-progress-visual" },
          { id: "created-progress-card-frame" }
        ]
      }
    }
  });
  for (const expectedNodeId of [
    "gen-progress-title",
    "gen-progress-distance",
    "gen-progress-points",
    "created-duplicate-distance"
  ]) {
    const movePoll = await waitForPluginCommands(bridge.origin, pluginId);
    assert.equal(movePoll.body.commands[0].type, "move_node");
    assert.equal(movePoll.body.commands[0].payload.nodeId, expectedNodeId);
    assert.equal(movePoll.body.commands[0].payload.parentId, "created-progress-card-frame");
    await postJson(bridge.origin, "/plugin/results", {
      commandId: movePoll.body.commands[0].commandId,
      result: { moved: { id: expectedNodeId, parentId: "created-progress-card-frame" } }
    });
  }

  const repairConfirm = await repairConfirmRequest;
  assert.equal(repairConfirm.status, 200);
  assert.equal(repairConfirm.body.ok, true);
  assert.equal(repairConfirm.body.appliedUpdateCount, 7);
});

test("designer chat duplicates shared text instead of assigning one node to multiple regroup repairs", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:shared-label-regroup";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 화면 기준으로 기존 생성 화면 품질을 개선해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:shared-label", name: "Reference screen", type: "FRAME" },
        { id: "gen:shared-label", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "ref:shared-label",
    name: "Reference screen",
    type: "FRAME",
    geometry: { x: 0, y: 0, width: 390, height: 844 },
    children: [
      {
        id: "ref-results-table-shared",
        name: "Results table",
        type: "FRAME",
        geometry: { x: 24, y: 260, width: 342, height: 104 },
        children: [
          { id: "ref-table-results", type: "TEXT", characters: "Results", geometry: { x: 42, y: 280, width: 64, height: 18 } },
          { id: "ref-table-me", type: "TEXT", characters: "Me", geometry: { x: 152, y: 280, width: 40, height: 18 } }
        ]
      },
      {
        id: "ref-progress-shared",
        name: "Progress summary card",
        type: "FRAME",
        geometry: { x: 24, y: 440, width: 342, height: 128 },
        children: [
          { id: "ref-progress-results", type: "TEXT", characters: "Results", geometry: { x: 42, y: 452, width: 64, height: 18 } },
          { id: "ref-progress-distance", type: "TEXT", characters: "1 km", geometry: { x: 42, y: 484, width: 56, height: 18 } },
          { id: "ref-progress-points", type: "TEXT", characters: "113 pts", geometry: { x: 318, y: 484, width: 64, height: 18 } },
          { id: "ref-progress-percent", type: "TEXT", characters: "0.92%", geometry: { x: 152, y: 532, width: 56, height: 18 } }
        ]
      }
    ]
  }));

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "gen:shared-label",
    name: "Generated screen",
    type: "FRAME",
    geometry: { x: 480, y: 0, width: 390, height: 844 },
    children: [
      { id: "gen-shared-results", type: "TEXT", characters: "Results", geometry: { x: 522, y: 280, width: 64, height: 18 } },
      { id: "gen-shared-me", type: "TEXT", characters: "Me", geometry: { x: 632, y: 280, width: 40, height: 18 } },
      { id: "gen-shared-distance", type: "TEXT", characters: "1 km", geometry: { x: 522, y: 484, width: 56, height: 18 } },
      { id: "gen-shared-points", type: "TEXT", characters: "113 pts", geometry: { x: 798, y: 484, width: 64, height: 18 } },
      { id: "gen-shared-percent", type: "TEXT", characters: "0.92%", geometry: { x: 632, y: 532, width: 56, height: 18 } }
    ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.repairPlan.regroupNodes.length, 2);
  assert.deepEqual(response.body.repairPlan.regroupNodes[0].nodeIds, [
    "gen-shared-results",
    "gen-shared-me"
  ]);
  assert.equal(response.body.repairPlan.regroupNodes[1].nodeIds.includes("gen-shared-results"), false);
  assert.equal(response.body.repairPlan.createTextNodes.length, 1);
  assert.equal(response.body.repairPlan.createTextNodes[0].characters, "Results");
  assert.equal(response.body.repairPlan.createTextNodes[0].regroupTargetIndex, 1);
});

test("designer chat matches group signatures by visual order instead of child creation order", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:group-visual-order";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:group-order", name: "Reference screen", type: "FRAME" },
        { id: "gen:group-order", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "ref:group-order",
    name: "Reference screen",
    type: "FRAME",
    geometry: { x: 0, y: 0, width: 390, height: 844 },
    children: [
      {
        id: "ref-progress-order",
        name: "Progress summary card",
        type: "FRAME",
        geometry: { x: 24, y: 440, width: 342, height: 128 },
        children: [
          { id: "ref-progress-results-order", type: "TEXT", characters: "Results", geometry: { x: 42, y: 452, width: 64, height: 18 } },
          { id: "ref-progress-distance-order", type: "TEXT", characters: "1 km", geometry: { x: 42, y: 484, width: 56, height: 18 } },
          { id: "ref-progress-points-order", type: "TEXT", characters: "113 pts", geometry: { x: 318, y: 484, width: 64, height: 18 } }
        ]
      }
    ]
  }));

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
    id: "gen:group-order",
    name: "Generated screen",
    type: "FRAME",
    geometry: { x: 480, y: 0, width: 390, height: 844 },
    children: [
      {
        id: "gen-progress-order",
        name: "Progress summary card",
        type: "FRAME",
        geometry: { x: 504, y: 440, width: 342, height: 128 },
        children: [
          { id: "gen-progress-distance-order", type: "TEXT", characters: "1 km", geometry: { x: 522, y: 484, width: 56, height: 18 } },
          { id: "gen-progress-points-order", type: "TEXT", characters: "113 pts", geometry: { x: 798, y: 484, width: 64, height: 18 } },
          { id: "gen-progress-results-order", type: "TEXT", characters: "Results", geometry: { x: 522, y: 452, width: 64, height: 18 } }
        ]
      }
    ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.comparison.visualDeltas.groupDeltas.missingGroups, []);
});

test("designer chat does not treat shallow reference/generated readback as a successful comparison", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-shallow-readback";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:shallow", name: "Reference screen", type: "FRAME" },
        { id: "gen:shallow", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  const shallowReferenceCommand = await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "ref:shallow",
      name: "Reference screen",
      type: "FRAME",
      geometry: { x: 0, y: 0, width: 392, height: 844 },
      children: []
  }));
  assert.equal(shallowReferenceCommand.type, "get_metadata");
  assert.equal(shallowReferenceCommand.payload.includeJson, true);

  const shallowGeneratedCommand = await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:shallow",
      name: "Generated screen",
      type: "FRAME",
      geometry: { x: 480, y: 0, width: 392, height: 844 },
      children: []
  }));
  assert.equal(shallowGeneratedCommand.type, "get_metadata");
  assert.equal(shallowGeneratedCommand.payload.includeJson, true);

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.comparison.readQuality.sufficient, false);
  assert.equal(response.body.comparison.textCoverage, 0);
  assert.equal(response.body.comparison.summary.includes("충분히 읽지 못했습니다"), true);
  assert.equal(response.body.designerSuggestionBundle.findings[0].severity, "medium");
  assert.equal(response.body.comparison.recommendations.some((item) => item.includes("상세")), true);
});

test("designer chat normalizes bbox deltas from child geometry when root geometry is absent", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-rootless-geometry";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:rootless", name: "Reference screen", type: "FRAME" },
        { id: "gen:rootless", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "ref:rootless",
      name: "Reference screen",
      type: "FRAME",
      children: [
        {
          id: "ref-rootless-bg",
          type: "RECTANGLE",
          name: "screen background",
          geometry: { x: 1188, y: 2380, width: 390, height: 844 }
        },
        {
          id: "ref-rootless-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 1200, y: 2400, width: 166, height: 22 }
        }
      ]
  }));

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:rootless",
      name: "Generated screen",
      type: "FRAME",
      children: [
        {
          id: "gen-rootless-bg",
          type: "RECTANGLE",
          name: "screen background",
          geometry: { x: 2388, y: 2380, width: 390, height: 844 }
        },
        {
          id: "gen-rootless-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 2408, y: 2418, width: 166, height: 22 }
        }
      ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.comparison.bboxDeltas[0].deltaX, 8);
  assert.equal(response.body.comparison.bboxDeltas[0].deltaY, 18);
});

test("designer chat falls back to child-origin bbox normalization when root geometry is inconsistent", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-inconsistent-root-geometry";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:inconsistent", name: "Reference screen", type: "FRAME" },
        { id: "gen:inconsistent", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "ref:inconsistent",
      name: "Reference screen",
      type: "FRAME",
      geometry: { x: 1000, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "ref-inconsistent-bg",
          type: "RECTANGLE",
          name: "screen background",
          geometry: { x: 3000, y: 2400, width: 390, height: 844 }
        },
        {
          id: "ref-inconsistent-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 3012, y: 2420, width: 166, height: 22 }
        }
      ]
  }));

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:inconsistent",
      name: "Generated screen",
      type: "FRAME",
      geometry: { x: 2000, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "gen-inconsistent-bg",
          type: "RECTANGLE",
          name: "screen background",
          geometry: { x: 5000, y: 2400, width: 390, height: 844 }
        },
        {
          id: "gen-inconsistent-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 5020, y: 2438, width: 166, height: 22 }
        }
      ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.comparison.bboxDeltas[0].deltaX, 8);
  assert.equal(response.body.comparison.bboxDeltas[0].deltaY, 18);
});

test("designer chat ignores clipped source image reference layers when deriving comparable root origin", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-source-reference-origin";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:source-origin", name: "Reference screen", type: "FRAME" },
        { id: "gen:source-origin", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "ref:source-origin",
      name: "Reference screen",
      type: "FRAME",
      geometry: { x: -2529, y: 3938, width: 392, height: 844 },
      children: [
        {
          id: "ref-background-source-origin",
          name: "screen background",
          type: "RECTANGLE",
          geometry: { x: 0, y: 0, width: 392, height: 844 }
        },
        {
          id: "ref-title-source-origin",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 16, y: 48, width: 166, height: 22 }
        }
      ]
  }));

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:source-origin",
      name: "Generated screen",
      type: "FRAME",
      geometry: { x: -3403, y: 3938, width: 392, height: 844 },
      children: [
        {
          id: "gen-background-source-origin",
          name: "screen background",
          type: "RECTANGLE",
          geometry: { x: 0, y: 0, width: 392, height: 844 }
        },
        {
          id: "gen-source-reference-offset",
          name: "Source image reference",
          type: "FRAME",
          geometry: { x: 0, y: -26, width: 392, height: 844 }
        },
        {
          id: "gen-local-negative-container",
          name: "Schedule list",
          type: "FRAME",
          geometry: { x: 24, y: 240, width: 344, height: 160 },
          children: [
            {
              id: "gen-local-negative-child",
              name: "row-content",
              type: "FRAME",
              geometry: { x: 56, y: -26, width: 104, height: 96 }
            }
          ]
        },
        {
          id: "gen-title-source-origin",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 16, y: 48, width: 166, height: 22 }
        }
      ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.comparison.bboxDeltas[0].deltaX, 0);
  assert.equal(response.body.comparison.bboxDeltas[0].deltaY, 0);
  assert.equal(response.body.comparison.materialBboxDeltaCount, 0);
  assert.match(response.body.comparison.summary, /주요 텍스트 구조가 일치/u);
  assert.match(
    response.body.designerSuggestionBundle.findings[0].detail,
    /material bbox delta 0개/u
  );
});

test("designer chat reads comparison targets with bounded metadata before detail fallback", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-detail-timeout-fallback";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:timeout", name: "Reference screen", type: "FRAME" },
        { id: "gen:timeout", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  const firstMetadataCommand = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(firstMetadataCommand.body.commands[0].type, "get_metadata");
  assert.equal(firstMetadataCommand.body.commands[0].payload.includeJson, true);
  assert.equal(firstMetadataCommand.body.commands[0].payload.maxDepth >= 4, true);
  assert.equal(firstMetadataCommand.body.commands[0].payload.maxNodes >= 100, true);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: firstMetadataCommand.body.commands[0].commandId,
    error: {
      code: "ERR_METADATA_TIMEOUT",
      message: "Timed out waiting for plugin response: get_metadata"
    },
    result: null
  });

  const fallbackCommand = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(fallbackCommand.body.commands[0].type, "get_node_details");
  assert.equal(fallbackCommand.body.commands[0].payload.includeChildren, true);
  assert.equal(fallbackCommand.body.commands[0].payload.detailLevel, "layout");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: fallbackCommand.body.commands[0].commandId,
    result: {
      node: {
        id: "ref:timeout",
        name: "Reference screen",
        type: "FRAME",
        geometry: { x: 0, y: 0, width: 392, height: 844 },
        children: [
          {
            id: "ref-title-timeout",
            name: "Title",
            type: "TEXT",
            characters: "Running Challenge",
            geometry: { x: 96, y: 48, width: 180, height: 22 }
          }
        ]
      }
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:timeout",
      name: "Generated screen",
      type: "FRAME",
      geometry: { x: 480, y: 0, width: 392, height: 844 },
      children: [
        {
          id: "gen-title-timeout",
          name: "Title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 576, y: 52, width: 180, height: 22 }
        }
      ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.comparison.referenceTextCount, 1);
  assert.equal(response.body.comparison.matchedTexts.includes("Running Challenge"), true);
  assert.equal(response.body.comparison.textCoverage, 1);
});

test("designer chat returns debug diagnosis when reference comparison exceeds request budget", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_DESIGNER_COMPARE_REQUEST_TIMEOUT_MS: "50"
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:compare-request-timeout";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:slow", name: "Reference screen", type: "FRAME" },
        { id: "gen:slow", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  const firstCommand = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(firstCommand.body.commands[0].type, "get_metadata");

  const response = await request;
  assert.equal(response.status, 504);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "debug_bridge_failure");
  assert.equal(response.body.details.imageLayoutQuality.userIntentKind, "compare_reference_and_generated");
  assert.equal(response.body.details.imageLayoutQuality.failureSource, "designer_chat_workflow_timeout");
  assert.equal(response.body.details.imageLayoutQuality.stage, "reference_generated_comparison");
  assert.equal(response.body.details.imageLayoutQuality.timeoutMs, 50);

  const pendingAfterTimeout = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(pendingAfterTimeout.body.commands.length, 0);
});

test("designer chat returns debug diagnosis when generated-screen improvement exceeds request budget", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_DESIGNER_IMPROVE_REQUEST_TIMEOUT_MS: "50"
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:improve-request-timeout";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 화면 기준으로 기존 생성 화면 품질을 개선해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:improve-slow", name: "Reference screen", type: "FRAME" },
        { id: "gen:improve-slow", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  const firstCommand = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(firstCommand.body.commands[0].type, "get_metadata");

  const response = await request;
  assert.equal(response.status, 504);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "debug_bridge_failure");
  assert.equal(response.body.details.imageLayoutQuality.userIntentKind, "improve_generated_screen");
  assert.equal(response.body.details.imageLayoutQuality.failureSource, "designer_chat_workflow_timeout");
  assert.equal(response.body.details.imageLayoutQuality.stage, "generated_screen_improvement");
  assert.equal(response.body.details.imageLayoutQuality.timeoutMs, 50);

  const pendingAfterTimeout = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(pendingAfterTimeout.body.commands.length, 0);
});

test("designer chat turns reference/generated comparison into generated screen improvement plan", async (t) => {
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:improve-reference-generated";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "참조 화면 기준으로 기존 생성 화면 품질을 개선해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [
        { id: "ref:2", name: "Reference screen", type: "FRAME" },
        { id: "gen:2", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "ref:2",
      name: "Reference screen",
      type: "FRAME",
      geometry: { x: 0, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "ref-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 112, y: 48, width: 166, height: 22 }
        },
        {
          id: "ref-status-bar",
          name: "iOS status bar",
          type: "FRAME",
          geometry: { x: 0, y: 0, width: 390, height: 44 },
          children: [
            {
              id: "ref-signal-helper",
              name: "Signal bar 1",
              type: "TEXT",
              characters: "Signal bar 1",
              geometry: { x: 300, y: 12, width: 4, height: 12 }
            },
            {
              id: "ref-battery-helper",
              name: "Battery fill",
              type: "TEXT",
              characters: "Battery fill",
              geometry: { x: 352, y: 12, width: 18, height: 8 }
            },
            {
              id: "ref-chevron-icon",
              name: "coupon chevron",
              type: "TEXT",
              characters: "›",
              geometry: { x: 348, y: 804, width: 8, height: 18 }
            }
          ]
        },
        {
          id: "ref-subtitle",
          type: "TEXT",
          characters: "Weekend Warriors",
          geometry: { x: 42, y: 80, width: 160, height: 18 }
        },
        {
          id: "ref-hero",
          name: "hero image panel",
          type: "RECTANGLE",
          fillColor: "#ff5b3d",
          geometry: { x: 24, y: 104, width: 342, height: 140 },
          children: [
            {
              id: "ref-left-avatar-label",
              name: "Left avatar image block",
              type: "TEXT",
              characters: "Left avatar image block",
              geometry: { x: 72, y: 132, width: 72, height: 72 }
            },
            {
              id: "ref-hero-shade-label",
              name: "Hero bottom shade",
              type: "TEXT",
              characters: "Hero bottom shade",
              geometry: { x: 24, y: 210, width: 342, height: 34 }
            }
          ]
        },
        {
          id: "ref-progress",
          name: "score progress bar",
          type: "RECTANGLE",
          fillColor: "#ffb800",
          geometry: { x: 42, y: 680, width: 286, height: 6 }
        },
        {
          id: "ref-results-card",
          name: "Results card",
          type: "FRAME",
          geometry: { x: 24, y: 260, width: 342, height: 160 },
          children: [
            {
              id: "ref-results-label",
              type: "TEXT",
              characters: "Results",
              geometry: { x: 42, y: 280, width: 64, height: 18 }
            },
            {
              id: "ref-distance-label",
              type: "TEXT",
              characters: "Distance",
              geometry: { x: 42, y: 316, width: 68, height: 18 }
            },
            {
              id: "ref-distance-value",
              type: "TEXT",
              characters: "24.7km",
              geometry: { x: 152, y: 316, width: 72, height: 18 }
            }
          ]
        },
        {
          id: "ref-reward",
          type: "TEXT",
          characters: "Winner gets 50 coins + Champion Badge",
          geometry: { x: 42, y: 804, width: 306, height: 18 }
        }
      ]
  }));

  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:2",
      name: "Generated screen",
      type: "FRAME",
      geometry: { x: 480, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "gen-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 600, y: 66, width: 166, height: 22 }
        },
        {
          id: "gen-status-bar",
          name: "iOS status bar",
          type: "FRAME",
          geometry: { x: 480, y: 26, width: 390, height: 44 }
        },
        {
          id: "gen-subtitle",
          type: "TEXT",
          characters: "Weekend Warriors",
          geometry: { x: 522, y: 118, width: 160, height: 18 }
        },
        {
          id: "gen-hero",
          name: "hero image panel",
          type: "RECTANGLE",
          fillColor: "#f2f4f7",
          geometry: { x: 514, y: 112, width: 320, height: 132 }
        },
        {
          id: "gen-results-label",
          type: "TEXT",
          characters: "Results",
          geometry: { x: 522, y: 280, width: 64, height: 18 }
        },
        {
          id: "gen-distance-label",
          type: "TEXT",
          characters: "Distance",
          geometry: { x: 522, y: 316, width: 68, height: 18 }
        },
        {
          id: "gen-distance-value",
          type: "TEXT",
          characters: "24.7 km",
          geometry: { x: 632, y: 316, width: 72, height: 18 }
        },
        {
          id: "gen-extra",
          type: "TEXT",
          characters: "Competitor image collage",
          geometry: { x: 520, y: 120, width: 180, height: 18 }
        },
        {
          id: "gen-icon-text",
          name: "flash icon",
          type: "TEXT",
          characters: "↯",
          geometry: { x: 520, y: 140, width: 12, height: 12 }
        }
      ]
  }));

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.intentKind, "improve_generated_screen");
  assert.equal(response.body.improvementPlan.source, "reference_generated_comparison");
  assert.equal(response.body.improvementPlan.actions.some((action) => action.type === "create_missing_text"), true);
  assert.equal(response.body.improvementPlan.actions.some((action) => action.type === "remove_hallucinated_text"), true);
  assert.equal(response.body.improvementPlan.actions.some((action) => action.type === "realign_text_bbox"), true);
  assert.deepEqual(response.body.comparison.missingTexts, [
    "Winner gets 50 coins + Champion Badge"
  ]);
  assert.equal(response.body.comparison.matchedTexts.includes("24.7km"), true);
  assert.equal(response.body.comparison.missingTexts.includes("24.7km"), false);
  assert.equal(response.body.comparison.extraTexts.includes("24.7 km"), false);
  assert.equal(response.body.repairPlan.createTextNodes.some((node) => node.characters === "Signal bar 1"), false);
  assert.equal(response.body.repairPlan.createTextNodes.some((node) => node.characters === "Battery fill"), false);
  assert.equal(response.body.repairPlan.createTextNodes.some((node) => node.characters === "›"), false);
  assert.equal(response.body.repairPlan.createTextNodes.some((node) => node.characters === "Left avatar image block"), false);
  assert.equal(response.body.repairPlan.createTextNodes.some((node) => node.characters === "Hero bottom shade"), false);
  assert.deepEqual(response.body.comparison.extraTexts, ["Competitor image collage"]);
  assert.equal(response.body.comparison.extraTexts.includes("↯"), false);
  assert.equal(response.body.designerSuggestionBundle.intentKind, "improve_generated_screen");
  assert.equal(
    response.body.repairPlan.visualRepairs.missingRoles.some((entry) => entry.role === "progress"),
    true
  );
  assert.equal(response.body.repairPlan.createVisualNodes[0].nodeType, "RECTANGLE");
  assert.equal(response.body.repairPlan.createVisualNodes[0].name, "missing-visual-score progress bar");
  assert.equal(response.body.repairPlan.createVisualNodes[0].fillColor, "#ffb800");
  assert.equal(response.body.repairPlan.visualRepairs.colorUpdates[0].referenceColor, "#ff5b3d");
  assert.equal(response.body.repairPlan.visualRepairs.colorUpdates[0].generatedColor, "#f2f4f7");
  const heroGeometryUpdate = response.body.repairPlan.visualRepairs.geometryUpdates.find(
    (entry) => entry.generatedNodeId === "gen-hero"
  );
  assert.equal(heroGeometryUpdate.target.width, 342);
  assert.equal(
    response.body.comparison.visualDeltas.geometryDeltas.some((entry) => entry.generatedNodeId === "gen-status-bar"),
    false
  );
  assert.equal(
    response.body.comparison.visualDeltas.geometryDiagnostics.some((entry) => entry.generatedNodeId === "gen-status-bar"),
    true
  );
  assert.equal(
    response.body.repairPlan.visualRepairs.geometryUpdates.some((entry) => entry.generatedNodeId === "gen-status-bar"),
    false
  );
  assert.equal(response.body.repairPlan.visualRepairs.spacingUpdates[0].generatedNodeId, "gen-subtitle");
  assert.equal(response.body.repairPlan.visualRepairs.spacingUpdates[0].targetY, 80);
  assert.equal(response.body.repairPlan.regroupNodes.length, 1);
  assert.equal(response.body.repairPlan.regroupNodes[0].name, "Results card");
  assert.deepEqual(response.body.repairPlan.regroupNodes[0].nodeIds, [
    "gen-results-label",
    "gen-distance-label",
    "gen-distance-value"
  ]);
  assert.equal(response.body.designerSuggestionBundle.applyActions.length, 1);
  assert.equal(response.body.designerSuggestionBundle.applyActions[0].actionType, "generated_screen_repair");
  assert.equal(response.body.designerActionPreviewBundle.summary.actionCount, 1);
  assert.equal(response.body.designerActionPreviewBundle.previews[0].readiness, "needs_confirmation");
  assert.deepEqual(
    response.body.designerActionPreviewBundle.previews[0].bridgeCommandCandidates.map(
      (candidate) => candidate.command
    ),
    ["generated_screen_repair", "bulk_create_nodes", "bulk_update_nodes", "delete_node"]
  );
  assert.deepEqual(
    response.body.actionCandidates.map((candidate) => candidate.command),
    ["generated_screen_repair", "bulk_create_nodes", "bulk_update_nodes", "delete_node"]
  );
  assert.equal(response.body.actionCandidates[0].actionType, "generated_screen_repair");
  assert.equal(response.body.actionCandidates[0].canApplyNow, true);

  const [repairCandidate, createCandidate, updateCandidate, deleteCandidate] =
    response.body.designerActionPreviewBundle.previews[0].bridgeCommandCandidates;

  const repairPreview = await postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    candidate: repairCandidate
  });
  assert.equal(repairPreview.status, 200);
  assert.equal(repairPreview.body.ok, true);
  assert.equal(repairPreview.body.preview.commandCount, 4);
  assert.equal(repairPreview.body.preview.repairPlan.createTextNodes[0].characters, "Winner gets 50 coins + Champion Badge");
  assert.equal(repairPreview.body.preview.repairPlan.createVisualNodes[0].nodeType, "RECTANGLE");
  assert.equal(repairPreview.body.preview.repairPlan.createVisualNodes[0].fillColor, "#ffb800");
  assert.equal(repairPreview.body.preview.repairPlan.regroupNodes[0].nodeIds.length, 3);
  assert.equal(
    repairPreview.body.preview.repairPlan.visualRepairs.missingRoles.some((entry) => entry.role === "progress"),
    true
  );
  assert.equal(repairPreview.body.preview.repairPlan.visualRepairs.colorUpdates[0].generatedNodeId, "gen-hero");
  assert.equal(
    repairPreview.body.preview.repairPlan.visualRepairs.geometryUpdates.find(
      (entry) => entry.generatedNodeId === "gen-hero"
    ).target.x,
    24
  );
  assert.equal(
    repairPreview.body.preview.repairPlan.visualRepairs.geometryUpdates.some(
      (entry) => entry.generatedNodeId === "gen-status-bar"
    ),
    false
  );
  assert.equal(repairPreview.body.preview.repairPlan.visualRepairs.spacingUpdates[0].targetY, 80);

  const repairConfirmRequest = postJson(bridge.origin, "/api/designer/action-candidates/confirm", {
    pluginId,
    candidate: repairCandidate,
    preview: repairPreview.body.preview,
    previousComparison: response.body.comparison,
    verifyAfterApply: {
      referenceNodeId: "ref:2",
      generatedNodeId: "gen:2"
    }
  });
  const repairCreatePoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(repairCreatePoll.body.commands[0].type, "bulk_create_nodes");
  assert.equal(repairCreatePoll.body.commands[0].payload.nodes.length, 3);
  assert.equal(repairCreatePoll.body.commands[0].payload.nodes[0].nodeType, "TEXT");
  assert.equal(repairCreatePoll.body.commands[0].payload.nodes[1].nodeType, "RECTANGLE");
  assert.equal(repairCreatePoll.body.commands[0].payload.nodes[1].fillColor, "#ffb800");
  assert.equal(repairCreatePoll.body.commands[0].payload.nodes[2].nodeType, "FRAME");
  assert.equal(repairCreatePoll.body.commands[0].payload.nodes[2].name, "Results card");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: repairCreatePoll.body.commands[0].commandId,
    result: {
      created: [
        { id: "repair-created-reward" },
        { id: "repair-created-progress" },
        { id: "repair-created-results-card" }
      ]
    }
  });
  for (const expectedNodeId of ["gen-results-label", "gen-distance-label", "gen-distance-value"]) {
    const movePoll = await waitForPluginCommands(bridge.origin, pluginId);
    assert.equal(movePoll.body.commands[0].type, "move_node");
    assert.equal(movePoll.body.commands[0].payload.nodeId, expectedNodeId);
    assert.equal(movePoll.body.commands[0].payload.parentId, "repair-created-results-card");
    await postJson(bridge.origin, "/plugin/results", {
      commandId: movePoll.body.commands[0].commandId,
      result: { moved: { id: expectedNodeId, parentId: "repair-created-results-card" } }
    });
  }
  const repairUpdatePoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(repairUpdatePoll.body.commands[0].type, "bulk_update_nodes");
  assert.equal(repairUpdatePoll.body.commands[0].payload.updates.length >= 3, true);
  assert.equal(
    repairUpdatePoll.body.commands[0].payload.updates.some(
      (entry) => entry.nodeId === "gen-subtitle" && entry.y === 80
    ),
    true
  );
  assert.equal(
    repairUpdatePoll.body.commands[0].payload.updates.some(
      (entry) =>
        entry.nodeId === "gen-hero" &&
        entry.fillColor === "#ff5b3d" &&
        entry.x === 24 &&
        entry.y === 104 &&
        entry.width === 342 &&
        entry.height === 140
    ),
    true
  );
  assert.equal(
    repairUpdatePoll.body.commands[0].payload.updates.some((entry) => entry.nodeId === "gen-status-bar"),
    false
  );
  await postJson(bridge.origin, "/plugin/results", {
    commandId: repairUpdatePoll.body.commands[0].commandId,
    result: { updated: [{ id: "gen-title" }, { id: "gen-subtitle" }, { id: "gen-hero" }] }
  });
  const repairDeletePoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(repairDeletePoll.body.commands[0].type, "delete_node");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: repairDeletePoll.body.commands[0].commandId,
    result: { deleted: { id: "gen-extra" } }
  });
  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "ref:2",
      name: "Reference screen",
      type: "FRAME",
      geometry: { x: 0, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "ref-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 112, y: 48, width: 166, height: 22 }
        },
        {
          id: "ref-reward",
          type: "TEXT",
          characters: "Winner gets 50 coins + Champion Badge",
          geometry: { x: 42, y: 804, width: 306, height: 18 }
        },
        {
          id: "ref-progress",
          name: "score progress bar",
          type: "RECTANGLE",
          fillColor: "#ffb800",
          geometry: { x: 42, y: 680, width: 286, height: 6 }
        },
        {
          id: "ref-results-card",
          name: "Results card",
          type: "FRAME",
          geometry: { x: 24, y: 260, width: 342, height: 160 },
          children: [
            {
              id: "ref-results-label",
              type: "TEXT",
              characters: "Results",
              geometry: { x: 42, y: 280, width: 64, height: 18 }
            },
            {
              id: "ref-distance-label",
              type: "TEXT",
              characters: "Distance",
              geometry: { x: 42, y: 316, width: 68, height: 18 }
            },
            {
              id: "ref-distance-value",
              type: "TEXT",
              characters: "24.7 km",
              geometry: { x: 152, y: 316, width: 72, height: 18 }
            }
          ]
        }
      ]
  }));
  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:2",
      name: "Generated screen",
      type: "FRAME",
      geometry: { x: 480, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "gen-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 592, y: 48, width: 166, height: 22 }
        },
        {
          id: "gen-subtitle",
          type: "TEXT",
          characters: "Weekend Warriors",
          geometry: { x: 522, y: 80, width: 160, height: 18 }
        },
        {
          id: "repair-created-reward",
          type: "TEXT",
          characters: "Winner gets 50 coins + Champion Badge",
          geometry: { x: 522, y: 804, width: 306, height: 18 }
        },
        {
          id: "repair-created-progress",
          name: "score progress bar",
          type: "RECTANGLE",
          fillColor: "#ffb800",
          geometry: { x: 522, y: 680, width: 286, height: 6 }
        },
        {
          id: "repair-created-results-card",
          name: "Results card",
          type: "FRAME",
          geometry: { x: 504, y: 260, width: 342, height: 160 },
          children: [
            {
              id: "gen-results-label",
              type: "TEXT",
              characters: "Results",
              geometry: { x: 522, y: 280, width: 64, height: 18 }
            },
            {
              id: "gen-distance-label",
              type: "TEXT",
              characters: "Distance",
              geometry: { x: 522, y: 316, width: 68, height: 18 }
            },
            {
              id: "gen-distance-value",
              type: "TEXT",
              characters: "24.7 km",
              geometry: { x: 632, y: 316, width: 72, height: 18 }
            }
          ]
        }
      ]
  }));
  const repairConfirm = await repairConfirmRequest;
  assert.equal(repairConfirm.status, 200);
  assert.equal(repairConfirm.body.ok, true);
  assert.equal(repairConfirm.body.appliedUpdateCount, 11);
  assert.equal(repairConfirm.body.qualityVerification.improved, true);
  assert.equal(repairConfirm.body.qualityVerification.metrics.missingVisualEntryDelta <= -1, true);
  assert.equal(repairConfirm.body.qualityVerification.metrics.missingVisualRoleDelta <= -1, true);
  assert.equal(repairConfirm.body.qualityVerification.metrics.missingGroupDelta, -1);
  assert.equal(repairConfirm.body.qualityVerification.metrics.layoutIssueDelta <= 0, true);

  const createPreview = await postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    candidate: createCandidate
  });
  assert.equal(createPreview.status, 200);
  assert.equal(createPreview.body.ok, true);
  assert.equal(createPreview.body.preview.nodeCount, 3);
  assert.equal(createPreview.body.preview.nodes[0].nodeType, "TEXT");
  assert.equal(createPreview.body.preview.nodes[0].characters, "Winner gets 50 coins + Champion Badge");
  assert.equal(createPreview.body.preview.nodes[1].nodeType, "RECTANGLE");
  assert.equal(createPreview.body.preview.nodes[1].name, "missing-visual-score progress bar");
  assert.equal(createPreview.body.preview.nodes[2].nodeType, "FRAME");
  assert.equal(createPreview.body.preview.nodes[2].name, "Results card");

  const createConfirmRequest = postJson(bridge.origin, "/api/designer/action-candidates/confirm", {
    pluginId,
    candidate: createCandidate,
    preview: createPreview.body.preview
  });
  const createPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(createPoll.body.commands[0].type, "bulk_create_nodes");
  assert.equal(createPoll.body.commands[0].payload.nodes[0].parentId, "gen:2");
  assert.equal(createPoll.body.commands[0].payload.nodes[0].nodeType, "TEXT");
  assert.equal(createPoll.body.commands[0].payload.nodes[0].characters, "Winner gets 50 coins + Champion Badge");
  assert.equal(createPoll.body.commands[0].payload.nodes[1].nodeType, "RECTANGLE");
  assert.equal(createPoll.body.commands[0].payload.nodes[2].nodeType, "FRAME");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: createPoll.body.commands[0].commandId,
    result: {
      created: [
        { id: "created-reward" },
        { id: "created-score-progress" },
        { id: "created-results-card" }
      ]
    }
  });
  const createConfirm = await createConfirmRequest;
  assert.equal(createConfirm.status, 200);
  assert.equal(createConfirm.body.ok, true);
  assert.equal(createConfirm.body.appliedUpdateCount, 3);

  const updatePreview = await postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    candidate: updateCandidate
  });
  assert.equal(updatePreview.status, 200);
  assert.equal(updatePreview.body.preview.updateCount >= 2, true);

  const updateConfirmRequest = postJson(bridge.origin, "/api/designer/action-candidates/confirm", {
    pluginId,
    candidate: updateCandidate,
    preview: updatePreview.body.preview
  });
  const updatePoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(updatePoll.body.commands[0].type, "bulk_update_nodes");
  assert.equal(
    updatePoll.body.commands[0].payload.updates.some(
      (entry) =>
        entry.nodeId === "gen-title" &&
        entry.x === 112 &&
        entry.y === 48 &&
        entry.width === 166 &&
        entry.height === 22
    ),
    true
  );
  await postJson(bridge.origin, "/plugin/results", {
    commandId: updatePoll.body.commands[0].commandId,
    result: { updated: [{ id: "gen-title" }, { id: "gen-subtitle" }] }
  });
  const updateConfirm = await updateConfirmRequest;
  assert.equal(updateConfirm.status, 200);
  assert.equal(updateConfirm.body.ok, true);
  assert.equal(updateConfirm.body.appliedUpdateCount >= 2, true);

  const deletePreview = await postJson(bridge.origin, "/api/designer/action-candidates/preview", {
    pluginId,
    candidate: deleteCandidate
  });
  assert.equal(deletePreview.status, 200);
  assert.deepEqual(deletePreview.body.preview.nodeIds, ["gen-extra"]);

  const deleteConfirmRequest = postJson(bridge.origin, "/api/designer/action-candidates/confirm", {
    pluginId,
    candidate: deleteCandidate,
    preview: deletePreview.body.preview,
    previousComparison: response.body.comparison,
    verifyAfterApply: {
      referenceNodeId: "ref:2",
      generatedNodeId: "gen:2"
    }
  });
  const deletePoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(deletePoll.body.commands[0].type, "delete_node");
  assert.equal(deletePoll.body.commands[0].payload.nodeId, "gen-extra");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: deletePoll.body.commands[0].commandId,
    result: { deleted: { id: "gen-extra" } }
  });
  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "ref:2",
      name: "Reference screen",
      type: "FRAME",
      geometry: { x: 0, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "ref-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 112, y: 48, width: 166, height: 22 }
        },
        {
          id: "ref-reward",
          type: "TEXT",
          characters: "Winner gets 50 coins + Champion Badge",
          geometry: { x: 42, y: 804, width: 306, height: 18 }
        }
      ]
  }));
  await completeNextCommand(bridge.origin, pluginId, metadataResultFromNode(pluginId, {
      id: "gen:2",
      name: "Generated screen",
      type: "FRAME",
      geometry: { x: 480, y: 0, width: 390, height: 844 },
      children: [
        {
          id: "gen-title",
          type: "TEXT",
          characters: "Running Challenge",
          geometry: { x: 592, y: 48, width: 166, height: 22 }
        },
        {
          id: "created-reward",
          type: "TEXT",
          characters: "Winner gets 50 coins + Champion Badge",
          geometry: { x: 522, y: 804, width: 306, height: 18 }
        }
      ]
  }));
  const deleteConfirm = await deleteConfirmRequest;
  assert.equal(deleteConfirm.status, 200);
  assert.equal(deleteConfirm.body.ok, true);
  assert.equal(deleteConfirm.body.appliedUpdateCount, 1);
  assert.equal(deleteConfirm.body.postApplyComparison.textCoverage, 1);
  assert.deepEqual(deleteConfirm.body.postApplyComparison.missingTexts, []);
  assert.deepEqual(deleteConfirm.body.postApplyComparison.extraTexts, []);
  assert.equal(deleteConfirm.body.qualityVerification.improved, true);
  assert.equal(deleteConfirm.body.qualityVerification.metrics.textCoverageDelta > 0, true);
  assert.equal(deleteConfirm.body.qualityVerification.metrics.missingTextDelta, -1);
  assert.equal(deleteConfirm.body.qualityVerification.metrics.extraTextDelta, -1);
  assert.equal(deleteConfirm.body.qualityVerification.metrics.bboxDeltaCountDelta, -2);
});
