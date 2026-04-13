import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "detail-api-regression.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

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
      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function waitForBridgeListening(childProcess, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for writable bridge to start listening"));
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
      reject(
        new Error(
          `Bridge exited before listening (code=${String(code)}, signal=${String(signal)})`
        )
      );
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

async function startBridgeServer() {
  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      SESSION_ACTIVE_WINDOW_MS: "30000",
      SESSION_RETENTION_MS: "30000",
      SESSION_PRUNE_INTERVAL_MS: "1000"
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const listeningPort = await waitForBridgeListening(childProcess);
  return {
    origin: `http://127.0.0.1:${listeningPort}`,
    childProcess
  };
}

async function getJson(origin, pathname) {
  const response = await fetch(`${origin}${pathname}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

async function postJson(origin, pathname, payload) {
  const response = await fetch(`${origin}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPluginCommands(origin, pluginId, { min = 1, timeoutMs = 1200 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const polled = await getJson(
      origin,
      `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
    );
    if ((polled.body?.commands?.length || 0) >= min) {
      return polled;
    }
    await sleep(25);
  }

  throw new Error(`Timed out waiting for ${min} command(s) for plugin ${pluginId}`);
}

async function bootLiveSession(bridge, pluginId) {
  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    pageId: "regression-page"
  });
  assert.equal(register.status, 200);
  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });
  assert.equal(heartbeat.status, 200);
}

test("detail APIs map nodeId alias to targetNodeId command payloads", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  await bootLiveSession(bridge, fixture.pluginId);

  const nodeApi = postJson(bridge.origin, "/api/get-node-details", {
    pluginId: fixture.pluginId,
    nodeId: fixture.nodeIds.node,
    detailLevel: "layout"
  });
  const nodePoll = await waitForPluginCommands(bridge.origin, fixture.pluginId);
  assert.equal(nodePoll.body.commands[0].type, "get_node_details");
  assert.equal(nodePoll.body.commands[0].payload.targetNodeId, fixture.nodeIds.node);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: nodePoll.body.commands[0].commandId,
    error: null,
    result: {
      node: { id: fixture.nodeIds.node, type: "FRAME" }
    }
  });
  const nodeResponse = await nodeApi;
  assert.equal(nodeResponse.status, 200);
  assert.equal(nodeResponse.body.ok, true);
  assert.equal(nodeResponse.body.result.node.id, fixture.nodeIds.node);

  const variantApi = postJson(bridge.origin, "/api/get-component-variant-details", {
    pluginId: fixture.pluginId,
    nodeId: fixture.nodeIds.componentSet
  });
  const variantPoll = await waitForPluginCommands(bridge.origin, fixture.pluginId);
  assert.equal(variantPoll.body.commands[0].type, "get_component_variant_details");
  assert.equal(
    variantPoll.body.commands[0].payload.targetNodeId,
    fixture.nodeIds.componentSet
  );
  await postJson(bridge.origin, "/plugin/results", {
    commandId: variantPoll.body.commands[0].commandId,
    error: null,
    result: {
      componentSet: {
        id: fixture.nodeIds.componentSet,
        componentPropertyDefinitions: fixture.componentSetDefinitions
      },
      variantCount: 0,
      variants: []
    }
  });
  const variantResponse = await variantApi;
  assert.equal(variantResponse.status, 200);
  assert.equal(variantResponse.body.ok, true);
  assert.equal(
    variantResponse.body.result.componentSet.id,
    fixture.nodeIds.componentSet
  );

  const instanceApi = postJson(bridge.origin, "/api/get-instance-details", {
    pluginId: fixture.pluginId,
    nodeId: fixture.nodeIds.instance,
    includeResolvedChildren: true
  });
  const instancePoll = await waitForPluginCommands(bridge.origin, fixture.pluginId);
  assert.equal(instancePoll.body.commands[0].type, "get_instance_details");
  assert.equal(instancePoll.body.commands[0].payload.targetNodeId, fixture.nodeIds.instance);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: instancePoll.body.commands[0].commandId,
    error: null,
    result: {
      instance: { id: fixture.nodeIds.instance, type: "INSTANCE" },
      componentPropertyDefinitions: fixture.componentSetDefinitions
    }
  });
  const instanceResponse = await instanceApi;
  assert.equal(instanceResponse.status, 200);
  assert.equal(instanceResponse.body.ok, true);
  assert.equal(instanceResponse.body.result.instance.id, fixture.nodeIds.instance);
});

test("metadata_fallback response shape is stable for detail APIs", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  await bootLiveSession(bridge, fixture.pluginId);

  async function exerciseFallback(pathname, commandType, requestBody) {
    const pending = postJson(bridge.origin, pathname, {
      pluginId: fixture.pluginId,
      ...requestBody
    });

    const primaryPoll = await waitForPluginCommands(bridge.origin, fixture.pluginId);
    assert.equal(primaryPoll.body.commands[0].type, commandType);
    await postJson(bridge.origin, "/plugin/results", {
      commandId: primaryPoll.body.commands[0].commandId,
      error: {
        code: "ERR_UNSUPPORTED_NODE_TYPE",
        message: `${commandType} unsupported target`
      },
      result: null
    });

    const fallbackPoll = await waitForPluginCommands(bridge.origin, fixture.pluginId);
    assert.equal(fallbackPoll.body.commands[0].type, "get_metadata");
    assert.equal(fallbackPoll.body.commands[0].payload.includeJson, true);
    await postJson(bridge.origin, "/plugin/results", {
      commandId: fallbackPoll.body.commands[0].commandId,
      error: null,
      result: fixture.metadataResult
    });

    return pending;
  }

  const nodeResponse = await exerciseFallback("/api/get-node-details", "get_node_details", {
    targetNodeId: fixture.nodeIds.node
  });
  assert.equal(nodeResponse.status, 200);
  assert.equal(nodeResponse.body.ok, true);
  assert.equal(nodeResponse.body.result.source, "metadata_fallback");
  assert.equal(nodeResponse.body.result.fallback.used, true);
  assert.equal(nodeResponse.body.result.fallback.fromCommand, "get_metadata");
  assert.equal(nodeResponse.body.result.fallback.reason.code, "ERR_UNSUPPORTED_NODE_TYPE");
  assert.equal(nodeResponse.body.result.node.id, fixture.metadataResult.json.roots[0].id);

  const variantResponse = await exerciseFallback(
    "/api/get-component-variant-details",
    "get_component_variant_details",
    { targetNodeId: fixture.nodeIds.componentSet }
  );
  assert.equal(variantResponse.status, 200);
  assert.equal(variantResponse.body.ok, true);
  assert.equal(variantResponse.body.result.source, "metadata_fallback");
  assert.equal(variantResponse.body.result.targetNode.id, fixture.metadataResult.json.roots[0].id);
  assert.equal(variantResponse.body.result.componentSet, null);
  assert.equal(variantResponse.body.result.variantCount, 0);
  assert.deepEqual(variantResponse.body.result.variants, []);

  const instanceResponse = await exerciseFallback(
    "/api/get-instance-details",
    "get_instance_details",
    { targetNodeId: fixture.nodeIds.instance }
  );
  assert.equal(instanceResponse.status, 200);
  assert.equal(instanceResponse.body.ok, true);
  assert.equal(instanceResponse.body.result.source, "metadata_fallback");
  assert.equal(instanceResponse.body.result.instance.id, fixture.metadataResult.json.roots[0].id);
  assert.equal(instanceResponse.body.result.sourceComponent, null);
  assert.equal(instanceResponse.body.result.sourceComponentSet, null);
  assert.deepEqual(instanceResponse.body.result.componentPropertyDefinitions, []);
});

test("componentPropertyDefinitions contract prefers COMPONENT_SET-level definitions", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  await bootLiveSession(bridge, fixture.pluginId);

  const pending = postJson(bridge.origin, "/api/get-component-variant-details", {
    pluginId: fixture.pluginId,
    targetNodeId: fixture.nodeIds.componentSet,
    detailLevel: "full",
    includeChildren: true
  });
  const polled = await waitForPluginCommands(bridge.origin, fixture.pluginId);
  assert.equal(polled.body.commands[0].type, "get_component_variant_details");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: null,
    result: {
      targetNode: { id: fixture.nodeIds.componentSet, type: "COMPONENT_SET" },
      componentSet: {
        id: fixture.nodeIds.componentSet,
        type: "COMPONENT_SET",
        componentPropertyDefinitions: fixture.componentSetDefinitions
      },
      variantCount: 1,
      variants: [
        {
          id: "20:201",
          type: "COMPONENT",
          componentPropertyDefinitions: fixture.variantComponentDefinitions
        }
      ]
    }
  });

  const response = await pending;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(
    response.body.result.componentSet.componentPropertyDefinitions,
    fixture.componentSetDefinitions
  );
  assert.deepEqual(
    response.body.result.variants[0].componentPropertyDefinitions,
    fixture.variantComponentDefinitions
  );
  assert.notDeepEqual(
    response.body.result.componentSet.componentPropertyDefinitions,
    response.body.result.variants[0].componentPropertyDefinitions
  );
});
