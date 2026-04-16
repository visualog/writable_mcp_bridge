import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

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
      const { port } = address;
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

async function startBridgeServer({
  sessionActiveWindowMs = 200,
  sessionRetentionMs = 1200,
  sessionPruneIntervalMs = 100,
  wsPluginPickupAckTimeoutMs,
  pollingFallbackMode
} = {}) {
  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      SESSION_ACTIVE_WINDOW_MS: String(sessionActiveWindowMs),
      SESSION_RETENTION_MS: String(sessionRetentionMs),
      SESSION_PRUNE_INTERVAL_MS: String(sessionPruneIntervalMs),
      ...(typeof wsPluginPickupAckTimeoutMs === "number"
        ? { WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS: String(wsPluginPickupAckTimeoutMs) }
        : {}),
      ...(typeof pollingFallbackMode === "string" && pollingFallbackMode.trim()
        ? { POLLING_FALLBACK_MODE: pollingFallbackMode.trim() }
        : {})
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const listeningPort = await waitForBridgeListening(childProcess);
  return {
    origin: `http://127.0.0.1:${listeningPort}`,
    wsOrigin: `ws://127.0.0.1:${listeningPort}`,
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
    headers: {
      "content-type": "application/json"
    },
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

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    if (typeof WebSocket !== "function") {
      reject(new Error("WebSocket global is not available"));
      return;
    }

    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws), { once: true });
    ws.addEventListener(
      "error",
      (error) => reject(error instanceof Error ? error : new Error("WebSocket error")),
      { once: true }
    );
  });
}

function parseJsonMessage(event) {
  if (!event || typeof event.data !== "string") {
    return null;
  }
  try {
    return JSON.parse(event.data);
  } catch (error) {
    return null;
  }
}

async function collectWsMessages(ws, { timeoutMs = 1200, stopWhen } = {}) {
  const messages = [];
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve(messages);
    }, timeoutMs);
    timer.unref?.();

    const onMessage = (event) => {
      const parsed = parseJsonMessage(event);
      if (!parsed) {
        return;
      }
      messages.push(parsed);
      if (typeof stopWhen === "function" && stopWhen(messages)) {
        cleanup();
        resolve(messages);
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
    };

    ws.addEventListener("message", onMessage);
  });
}

async function waitForWsEvent(ws, predicate, timeoutMs = 1400) {
  const messages = await collectWsMessages(ws, {
    timeoutMs,
    stopWhen: (collected) => collected.some(predicate)
  });
  return messages.find(predicate) || null;
}

test("WebSocket prototype sends hello envelope on connect", async (t) => {
  if (typeof WebSocket !== "function") {
    t.skip("WebSocket global is unavailable in this runtime");
    return;
  }

  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const ws = await connectWebSocket(`${bridge.wsOrigin}/api/ws`);
  t.after(() => {
    ws.close();
  });

  const messages = await collectWsMessages(ws, {
    timeoutMs: 1200,
    stopWhen: (collected) =>
      collected.some((entry) => entry && entry.event === "ws.hello")
  });
  assert.equal(messages.length > 0, true);
  const hello = messages.find((entry) => entry.event === "ws.hello");
  assert.ok(hello);
  assert.equal(typeof hello.sequence, "number");
  assert.equal(typeof hello.at, "string");
  assert.equal(hello.payload.transport, "websocket");
  assert.equal(hello.payload.protocol, "xbridge.ws.v1");
});

test("WebSocket prototype mirrors session and command lifecycle events", async (t) => {
  if (typeof WebSocket !== "function") {
    t.skip("WebSocket global is unavailable in this runtime");
    return;
  }

  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-lifecycle";
  const ws = await connectWebSocket(
    `${bridge.wsOrigin}/api/ws?pluginId=${encodeURIComponent(pluginId)}`
  );
  t.after(() => {
    ws.close();
  });
  const messages = [];
  const onMessage = (event) => {
    const parsed = parseJsonMessage(event);
    if (parsed) {
      messages.push(parsed);
    }
  };
  ws.addEventListener("message", onMessage);
  t.after(() => {
    ws.removeEventListener("message", onMessage);
  });

  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "ws-lifecycle" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingRead = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  const commandId = polled.body.commands[0].commandId;
  await postJson(bridge.origin, "/plugin/results", {
    commandId,
    error: null,
    result: { selection: [{ id: "10:1" }] }
  });
  await pendingRead;

  await sleep(220);

  const emittedTypes = new Set(messages.map((entry) => entry.event));
  assert.equal(emittedTypes.has("session.registered"), true);
  assert.equal(emittedTypes.has("session.heartbeat"), true);
  assert.equal(emittedTypes.has("command.enqueued"), true);
  assert.equal(emittedTypes.has("command.delivered"), true);
  assert.equal(emittedTypes.has("command.completed"), true);
});

test("WebSocket disconnect cleanup keeps bridge healthy for new subscribers", async (t) => {
  if (typeof WebSocket !== "function") {
    t.skip("WebSocket global is unavailable in this runtime");
    return;
  }

  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const wsA = await connectWebSocket(`${bridge.wsOrigin}/api/ws`);
  wsA.close();
  await sleep(80);

  const wsB = await connectWebSocket(`${bridge.wsOrigin}/api/ws`);
  t.after(() => {
    wsB.close();
  });

  const messages = await collectWsMessages(wsB, {
    timeoutMs: 1200,
    stopWhen: (collected) =>
      collected.some((entry) => entry && entry.event === "ws.hello")
  });
  assert.equal(messages.some((entry) => entry.event === "ws.hello"), true);

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
});

test("plugin-scoped websocket picks up enqueued command first and resolves via ws ack/result", async (t) => {
  if (typeof WebSocket !== "function") {
    t.skip("WebSocket global is unavailable in this runtime");
    return;
  }

  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 500
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-plugin-pickup";
  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "ws-plugin-pickup" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const ws = await connectWebSocket(
    `${bridge.wsOrigin}/api/ws?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  t.after(() => {
    ws.close();
  });

  const pendingRead = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const pickupEvent = await waitForWsEvent(
    ws,
    (entry) => entry.event === "plugin.command" && entry.payload?.command?.type === "get_selection",
    1800
  );
  assert.ok(pickupEvent);
  const commandId = pickupEvent.payload.command.commandId;
  assert.equal(typeof commandId, "string");

  const polledBeforeAck = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(polledBeforeAck.status, 200);
  assert.deepEqual(polledBeforeAck.body.commands, []);

  ws.send(
    JSON.stringify({
      type: "ws.plugin.command.ack",
      commandId,
      pluginId
    })
  );
  ws.send(
    JSON.stringify({
      type: "ws.plugin.command.result",
      commandId,
      pluginId,
      result: {
        selection: [{ id: "10:1" }]
      }
    })
  );

  const readResponse = await pendingRead;
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.ok, true);
  assert.deepEqual(readResponse.body.result.selection, [{ id: "10:1" }]);
});

test("plugin websocket command pickup falls back to /plugin/commands when ws ack times out", async (t) => {
  if (typeof WebSocket !== "function") {
    t.skip("WebSocket global is unavailable in this runtime");
    return;
  }

  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 120,
    pollingFallbackMode: "legacy"
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-plugin-fallback";
  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "ws-plugin-fallback" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const ws = await connectWebSocket(
    `${bridge.wsOrigin}/api/ws?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  t.after(() => {
    ws.close();
  });

  const pendingRead = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const pickupEvent = await waitForWsEvent(
    ws,
    (entry) => entry.event === "plugin.command" && entry.payload?.command?.type === "get_selection",
    1800
  );
  assert.ok(pickupEvent);
  const commandId = pickupEvent.payload.command.commandId;

  await sleep(180);

  const polledAfterTimeout = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(polledAfterTimeout.status, 200);
  assert.equal(polledAfterTimeout.body.commands.length, 1);
  assert.equal(polledAfterTimeout.body.commands[0].commandId, commandId);

  await postJson(bridge.origin, "/plugin/results", {
    commandId,
    result: {
      selection: [{ id: "10:9" }]
    },
    error: null
  });

  const readResponse = await pendingRead;
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.ok, true);
  assert.deepEqual(readResponse.body.result.selection, [{ id: "10:9" }]);
});
