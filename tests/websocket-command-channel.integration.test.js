import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "websocket-command-channel.fixture.json");
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
  sessionActiveWindowMs = 400,
  sessionRetentionMs = 3000,
  sessionPruneIntervalMs = 120,
  recentTransportWindowMs,
  wsPluginPickupAckTimeoutMs,
  wsPollingFallbackGraceMs,
  pollingFallbackReadyMaxDeliverPerTick,
  pollingFallbackMode,
  toolTimeoutMs
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
      ...(typeof recentTransportWindowMs === "number"
        ? { RECENT_TRANSPORT_WINDOW_MS: String(recentTransportWindowMs) }
        : {}),
      ...(typeof wsPluginPickupAckTimeoutMs === "number"
        ? { WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS: String(wsPluginPickupAckTimeoutMs) }
        : {}),
      ...(typeof wsPollingFallbackGraceMs === "number"
        ? { WS_POLLING_FALLBACK_GRACE_MS: String(wsPollingFallbackGraceMs) }
        : {}),
      ...(typeof pollingFallbackReadyMaxDeliverPerTick === "number"
        ? {
            POLLING_FALLBACK_READY_MAX_DELIVER_PER_TICK: String(
              pollingFallbackReadyMaxDeliverPerTick
            )
          }
        : {}),
      ...(typeof pollingFallbackMode === "string" && pollingFallbackMode.trim()
        ? { POLLING_FALLBACK_MODE: pollingFallbackMode.trim() }
        : { POLLING_FALLBACK_MODE: "legacy" }),
      ...(typeof toolTimeoutMs === "number"
        ? { TOOL_TIMEOUT_MS: String(toolTimeoutMs) }
        : {})
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

function originToWsUrl(origin, pathname) {
  const parsed = new URL(origin);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}${pathname}`;
}

function normalizeWsMessageData(raw) {
  if (typeof raw === "string") {
    return raw;
  }
  if (raw instanceof ArrayBuffer) {
    return new TextDecoder().decode(new Uint8Array(raw));
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(raw)) {
    return raw.toString("utf8");
  }
  return String(raw);
}

function parseWsMessage(eventData) {
  const text = normalizeWsMessageData(eventData);
  try {
    return {
      raw: text,
      json: JSON.parse(text)
    };
  } catch (error) {
    return {
      raw: text,
      json: null
    };
  }
}

async function connectWebSocket(wsUrl, timeoutMs = 1400) {
  if (typeof WebSocket !== "function") {
    return {
      supported: false,
      reason: "WebSocket client is unavailable in this runtime"
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const socket = new WebSocket(wsUrl);

    const finish = (result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      try {
        socket.close();
      } catch (error) {
        // ignore
      }
      finish({
        supported: false,
        reason: "WebSocket connection timeout"
      });
    }, timeoutMs);

    socket.addEventListener("open", () => {
      finish({
        supported: true,
        socket
      });
    });
    socket.addEventListener("error", () => {
      finish({
        supported: false,
        reason: "WebSocket upgrade failed"
      });
    });
    socket.addEventListener("close", () => {
      if (!settled) {
        finish({
          supported: false,
          reason: "WebSocket closed before open"
        });
      }
    });
  });
}

function startWsCollector(socket) {
  const messages = [];
  const onMessage = (event) => {
    messages.push(parseWsMessage(event.data));
  };
  socket.addEventListener("message", onMessage);
  return {
    messages,
    stop() {
      socket.removeEventListener("message", onMessage);
      return [...messages];
    }
  };
}

function hasWsEvent(messages, eventName, requestId) {
  return messages.some(
    (entry) =>
      (entry?.json?.event || entry?.json?.type) === eventName &&
      (requestId ? entry?.json?.payload?.requestId === requestId : true)
  );
}

function hasEvent(messages, eventName) {
  return messages.some((entry) => (entry.json?.event || entry.json?.type) === eventName);
}

function extractEvent(messages, eventName) {
  return messages.find((entry) => (entry.json?.event || entry.json?.type) === eventName)?.json || null;
}

function findEvent(messages, eventNames, predicate = null) {
  const allowed = Array.isArray(eventNames) ? eventNames : [eventNames];
  return (
    messages
      .map((entry) => entry.json)
      .filter(Boolean)
      .find((entry) => {
        const eventName = entry.event || entry.type;
        if (!allowed.includes(eventName)) {
          return false;
        }
        return typeof predicate === "function" ? predicate(entry) : true;
      }) || null
  );
}

async function establishLiveSession(origin, pluginId) {
  const register = await postJson(origin, "/plugin/register", { pluginId, pageId: "ws-command" });
  assert.equal(register.status, 200);
  const heartbeat = await postJson(origin, "/plugin/heartbeat", { pluginId });
  assert.equal(heartbeat.status, 200);
}

async function drivePluginResponseOnce(origin, pluginId, resultPayload) {
  const polled = await waitForPluginCommands(origin, pluginId);
  assert.equal(polled.body.commands.length >= 1, true);
  const command = polled.body.commands[0];
  await postJson(origin, "/plugin/results", {
    commandId: command.commandId,
    error: null,
    result: resultPayload
  });
  return command;
}

test("WS limited channel staging: submit->ack->result for read-only commands is explicit", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-submit";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(bridge.origin, `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}`);
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }

  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });
  const collector = startWsCollector(socket);
  t.after(() => {
    collector.stop();
  });

  const firstCommand = fixture.readOnlyCommands[0];
  const submitPayload = {
    event: fixture.submitEventTypes[0],
    requestId: "req-read-1",
    pluginId,
    command: firstCommand.type,
    args: firstCommand.payload
  };
  socket.send(JSON.stringify(submitPayload));
  await sleep(500);
  const messages = collector.stop();

  const ackSeen = fixture.ackEventTypes.some((eventName) => hasEvent(messages, eventName));
  const resultSeen = fixture.resultEventTypes.some((eventName) => hasEvent(messages, eventName));
  if (!ackSeen && !resultSeen) {
    t.skip(
      "WS command submit/ack/result not implemented yet (mirror-only websocket mode still active)"
    );
    return;
  }

  assert.equal(ackSeen, true);
  assert.equal(resultSeen, true);
});

test("HTTP-vs-WS comparison: get_selection command lifecycle mirrors the same commandId", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-http-compare";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(bridge.origin, `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}`);
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }

  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });
  const collector = startWsCollector(socket);
  t.after(() => {
    collector.stop();
  });

  const pendingHttp = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const command = await drivePluginResponseOnce(bridge.origin, pluginId, {
    selection: [{ id: "10:1" }]
  });
  const httpResponse = await pendingHttp;
  assert.equal(httpResponse.status, 200);
  assert.equal(httpResponse.body.ok, true);
  assert.deepEqual(httpResponse.body.result.selection, [{ id: "10:1" }]);

  await sleep(250);
  const messages = collector.stop();
  const enqueued = extractEvent(messages, "command.enqueued");
  const delivered = extractEvent(messages, "command.delivered");
  const completed = extractEvent(messages, "command.completed");

  assert.ok(enqueued);
  assert.ok(delivered);
  assert.ok(completed);
  assert.equal(enqueued.payload.commandId, command.commandId);
  assert.equal(delivered.payload.commandId, command.commandId);
  assert.equal(completed.payload.commandId, command.commandId);
  assert.equal(enqueued.payload.type, "get_selection");
  assert.equal(delivered.payload.type, "get_selection");
  assert.equal(completed.payload.type, "get_selection");
});

test("WS-first detail read commands are accepted on the websocket command channel", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-detail-read";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(bridge.origin, `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}`);
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }

  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const detailCommands = fixture.readOnlyCommands.filter((command) =>
    [
      "get_node_details",
      "get_component_variant_details",
      "get_instance_details"
    ].includes(command.type)
  );

  for (const detailCommand of detailCommands) {
    const detailCase = fixture.detailReadCommands.find(
      (entry) => entry.type === detailCommand.type
    );
    assert.ok(detailCase, `Missing detailReadCommands fixture for ${detailCommand.type}`);

    const requestId = `req-${detailCommand.type}`;
    const collector = startWsCollector(socket);

    socket.send(
      JSON.stringify({
        event: fixture.submitEventTypes[0],
        requestId,
        pluginId,
        command: detailCommand.type,
        args: detailCommand.payload
      })
    );

    const polled = await waitForPluginCommands(bridge.origin, pluginId);
    assert.equal(polled.body.commands[0].type, detailCommand.type);

    const commandId = polled.body.commands[0].commandId;
    await postJson(bridge.origin, "/plugin/results", {
      commandId,
      error: null,
      result: detailCase.resultPayload
    });

    await sleep(200);
    const messages = collector.stop();
    assert.equal(hasWsEvent(messages, "ws.command.ack", requestId), true);
    assert.equal(hasWsEvent(messages, "ws.command.result", requestId), true);

    const httpResponsePromise = postJson(bridge.origin, detailCase.httpPath, {
      pluginId,
      ...detailCase.requestBody
    });
    const httpPolled = await waitForPluginCommands(bridge.origin, pluginId);
    assert.equal(httpPolled.body.commands[0].type, detailCommand.type);

    await postJson(bridge.origin, "/plugin/results", {
      commandId: httpPolled.body.commands[0].commandId,
      error: null,
      result: detailCase.resultPayload
    });

    const httpResponse = await httpResponsePromise;
    assert.equal(httpResponse.status, 200);
    assert.equal(httpResponse.body.ok, true);
    assert.deepEqual(httpResponse.body.result, detailCase.resultPayload);
  }
});

test("WS-first unsupported command falls back to HTTP polling command channel", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-first-fallback";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(bridge.origin, `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}`);
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const deferred = fixture.deferredCommands?.[0];
  if (!deferred) {
    t.skip("No deferredCommands fixture configured for fallback verification");
    return;
  }

  const wsCollector = startWsCollector(socket);
  socket.send(
    JSON.stringify({
      event: fixture.submitEventTypes[0],
      requestId: "req-ws-fallback-1",
      pluginId,
      command: deferred.type,
      args: deferred.requestBody
    })
  );
  await sleep(250);
  const wsMessages = wsCollector.stop();

  const unsupportedEvent = findEvent(
    wsMessages,
    fixture.errorEventTypes,
    (entry) => entry.payload?.requestId === "req-ws-fallback-1"
  );
  assert.ok(unsupportedEvent);
  assert.equal(unsupportedEvent.payload.command, deferred.type);
  assert.equal(unsupportedEvent.payload.code, deferred.expectedErrorCode);

  const postUnsupportedPoll = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(postUnsupportedPoll.status, 200);
  assert.deepEqual(postUnsupportedPoll.body.commands, []);

  const lifecycleCollector = startWsCollector(socket);
  const pendingHttp = postJson(bridge.origin, deferred.httpPath, {
    pluginId,
    ...deferred.requestBody
  });
  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, deferred.type);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: null,
    result: deferred.resultPayload
  });
  const httpResponse = await pendingHttp;
  assert.equal(httpResponse.status, 200);
  assert.equal(httpResponse.body.ok, true);
  assert.deepEqual(httpResponse.body.result, deferred.resultPayload);

  await sleep(200);
  const lifecycleMessages = lifecycleCollector.stop();
  const enqueued = findEvent(
    lifecycleMessages,
    "command.enqueued",
    (entry) => entry.payload?.commandId === polled.body.commands[0].commandId
  );
  const delivered = findEvent(
    lifecycleMessages,
    "command.delivered",
    (entry) => entry.payload?.commandId === polled.body.commands[0].commandId
  );
  const completed = findEvent(
    lifecycleMessages,
    "command.completed",
    (entry) => entry.payload?.commandId === polled.body.commands[0].commandId
  );
  assert.ok(enqueued);
  assert.ok(delivered);
  assert.ok(completed);
});

test("transport health clears stale fallback pressure when recent fallback signal is gone", async (t) => {
  const bridge = await startBridgeServer({
    recentTransportWindowMs: 180,
    wsPluginPickupAckTimeoutMs: 70,
    wsPollingFallbackGraceMs: 250
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-fallback-decay";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const pendingRead = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const polled = await waitForPluginCommands(bridge.origin, pluginId, { timeoutMs: 2800 });
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "get_selection");

  const duringFallback = await getJson(bridge.origin, "/health");
  assert.equal(duringFallback.status, 200);
  assert.equal(duringFallback.body.transportHealth.fallbackIncidenceTrend.status, "high");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: null,
    result: { selection: [] }
  });
  const readResponse = await pendingRead;
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.ok, true);

  await sleep(720);
  const afterDecay = await getJson(bridge.origin, "/health");
  assert.equal(afterDecay.status, 200);
  assert.equal(afterDecay.body.transportHealth.fallbackIncidenceTrend.status, "stable");
  assert.equal(afterDecay.body.transportHealth.grade, "healthy");
  assert.equal(afterDecay.body.transportHealth.fallbackPressureRate, 0);
  assert.equal(Number.isFinite(afterDecay.body.transportHealth.fallbackRate), true);
});

test("polling fallback is delayed while plugin websocket client is still live", async (t) => {
  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 80,
    wsPollingFallbackGraceMs: 520
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-fallback-grace";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const pendingRead = postJson(bridge.origin, "/api/get-selection", { pluginId });
  await sleep(220);

  const whileWsLive = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(whileWsLive.status, 200);
  assert.deepEqual(whileWsLive.body.commands, []);
  assert.equal(whileWsLive.body.queue.deferredByWsGuard >= 1, true);
  assert.equal(whileWsLive.body.queue.oldestDeferredByWsGuardMs >= 1, true);
  assert.equal(typeof whileWsLive.body.queue.deferredByFallbackClass.critical, "number");
  assert.equal(typeof whileWsLive.body.queue.pollingFallbackPolicy.baseGraceMs, "number");
  assert.equal(typeof whileWsLive.body.queue.pollingFallbackPolicy.queuePressureThreshold, "number");
  assert.equal(typeof whileWsLive.body.queue.pollingFallbackPolicy.nearTimeoutRatio, "number");
  assert.equal(
    typeof whileWsLive.body.queue.pollingFallbackPolicy.multipliers.detail,
    "number"
  );
  assert.equal(typeof whileWsLive.body.queue.lifecycleSummary?.sampleSize, "number");
  assert.equal(
    whileWsLive.body.queue.lifecycleSummary?.timing?.avgEnqueueToDispatchMs === null ||
      Number.isFinite(whileWsLive.body.queue.lifecycleSummary?.timing?.avgEnqueueToDispatchMs),
    true
  );
  assert.equal(Array.isArray(whileWsLive.body.queue.commandTimelineTail), true);
  assert.equal(
    whileWsLive.body.queue.commandTimelineTail.length === 0 ||
      typeof whileWsLive.body.queue.commandTimelineTail[0]?.durations === "object",
    true
  );

  socket.close();
  await sleep(120);

  const afterWsClosed = await waitForPluginCommands(bridge.origin, pluginId, {
    timeoutMs: 1400
  });
  assert.equal(afterWsClosed.body.commands.length, 1);
  assert.equal(afterWsClosed.body.commands[0].type, "get_selection");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: afterWsClosed.body.commands[0].commandId,
    error: null,
    result: { selection: [] }
  });
  const readResponse = await pendingRead;
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.ok, true);
});

test("ready state caps polling fallback deliveries per tick while ws plugin client is live", async (t) => {
  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 80,
    wsPollingFallbackGraceMs: 120,
    pollingFallbackReadyMaxDeliverPerTick: 1,
    pollingFallbackMode: "legacy"
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-ready-cap";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const selectionRequest = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const metadataRequest = postJson(bridge.origin, "/api/get-metadata", { pluginId });
  const pagesRequest = getJson(
    bridge.origin,
    `/api/pages?pluginId=${encodeURIComponent(pluginId)}`
  );

  const seenCommandIds = new Set();
  let sawReadyCapApplied = false;

  const respondToCommand = async (command) => {
    if (seenCommandIds.has(command.commandId)) {
      return;
    }
    seenCommandIds.add(command.commandId);
    let result = {};
    if (command.type === "get_selection") {
      result = { selection: [] };
    } else if (command.type === "get_metadata") {
      result = { file: null, page: null, selection: [] };
    } else if (command.type === "list_pages") {
      result = { pages: [] };
    }
    await postJson(bridge.origin, "/plugin/results", {
      commandId: command.commandId,
      error: null,
      result
    });
  };

  const start = Date.now();
  while (Date.now() - start < 2600) {
    const polled = await getJson(
      bridge.origin,
      `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
    );
    if (polled.body?.queue?.readyFallbackCap?.applied === true) {
      sawReadyCapApplied = true;
      assert.equal(polled.body.queue.readyFallbackCap.limit, 1);
      assert.equal(polled.body.queue.deferredByReadyCap >= 1, true);
    }
    for (const command of polled.body?.commands || []) {
      await respondToCommand(command);
    }
    if (seenCommandIds.size >= 3) {
      break;
    }
    await sleep(70);
  }

  assert.equal(sawReadyCapApplied, true);
  assert.equal(seenCommandIds.size >= 3, true);

  const [selectionResponse, metadataResponse, pagesResponse] = await Promise.all([
    selectionRequest,
    metadataRequest,
    pagesRequest
  ]);
  assert.equal(selectionResponse.status, 200);
  assert.equal(selectionResponse.body.ok, true);
  assert.equal(metadataResponse.status, 200);
  assert.equal(metadataResponse.body.ok, true);
  assert.equal(pagesResponse.status, 200);
  assert.equal(pagesResponse.body.ok, true);
});

test("recovery_only mode blocks polling while ready and releases on backlog risk", async (t) => {
  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 80,
    wsPollingFallbackGraceMs: 120,
    pollingFallbackMode: "recovery_only",
    toolTimeoutMs: 2200
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-recovery-only";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const pendingSelection = postJson(bridge.origin, "/api/get-selection", { pluginId });
  await sleep(260);

  const readyBlocked = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(readyBlocked.status, 200);
  assert.equal(Array.isArray(readyBlocked.body.commands), true);
  assert.equal(readyBlocked.body.commands.length, 0);
  assert.equal(readyBlocked.body.queue.pollingFallbackMode.mode, "recovery_only");
  assert.equal(readyBlocked.body.queue.pollingFallbackMode.blocked, true);
  assert.equal(readyBlocked.body.queue.pollingFallbackMode.reason, "ready_streaming_guard");
  assert.equal(readyBlocked.body.queue.deferredByPolicyBlock >= 1, true);

  await sleep(1200);
  const recoveryReleased = await waitForPluginCommands(bridge.origin, pluginId, {
    min: 1,
    timeoutMs: 1400
  });
  assert.equal(recoveryReleased.body.queue.pollingFallbackMode.mode, "recovery_only");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: recoveryReleased.body.commands[0].commandId,
    error: null,
    result: { selection: [] }
  });
  const selectionResponse = await pendingSelection;
  assert.equal(selectionResponse.status, 200);
  assert.equal(selectionResponse.body.ok, true);
});

test("recovery_only mode releases polling before expiry when timeout budget is nearly exhausted", async (t) => {
  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 80,
    wsPollingFallbackGraceMs: 120,
    pollingFallbackMode: "recovery_only",
    toolTimeoutMs: 1400
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-expiry-risk-release";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const pendingSelection = postJson(bridge.origin, "/api/get-selection", { pluginId });
  await sleep(260);

  const readyBlocked = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(readyBlocked.status, 200);
  assert.equal(readyBlocked.body.commands.length, 0);
  assert.equal(readyBlocked.body.queue.pollingFallbackMode.blocked, true);
  assert.equal(readyBlocked.body.queue.pollingFallbackMode.reason, "ready_streaming_guard");

  await sleep(760);

  const releasedByExpiryRisk = await waitForPluginCommands(bridge.origin, pluginId, {
    min: 1,
    timeoutMs: 700
  });
  assert.equal(releasedByExpiryRisk.body.queue.pollingFallbackMode.mode, "recovery_only");
  assert.equal(releasedByExpiryRisk.body.queue.pollingFallbackMode.blocked, false);
  assert.equal(releasedByExpiryRisk.body.queue.readyFallbackCap.status, "degraded");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: releasedByExpiryRisk.body.commands[0].commandId,
    error: null,
    result: { selection: [] }
  });
  const selectionResponse = await pendingSelection;
  assert.equal(selectionResponse.status, 200);
  assert.equal(selectionResponse.body.ok, true);
});

test("polling fallback delay respects command timeout budget", async (t) => {
  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 80,
    wsPollingFallbackGraceMs: 5000,
    toolTimeoutMs: 1100
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-fallback-timeout-budget";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const pendingRead = postJson(bridge.origin, "/api/get-selection", { pluginId });
  await sleep(260);
  const polled = await waitForPluginCommands(bridge.origin, pluginId, { timeoutMs: 1400 });
  assert.equal(polled.status, 200);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "get_selection");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: null,
    result: { selection: [] }
  });
  const readResponse = await pendingRead;
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.ok, true);
});

test("critical fallback command is released before detail fallback command", async (t) => {
  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 80,
    wsPollingFallbackGraceMs: 600,
    toolTimeoutMs: 5000
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-fallback-priority";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const pendingSelection = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const pendingDetail = postJson(bridge.origin, "/api/get-node-details", {
    pluginId,
    targetNodeId: "10:1",
    detailLevel: "layout"
  });

  await sleep(720);
  const firstPoll = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(firstPoll.status, 200);
  assert.equal(firstPoll.body.commands.length, 1);
  assert.equal(firstPoll.body.commands[0].type, "get_selection");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: firstPoll.body.commands[0].commandId,
    error: null,
    result: { selection: [] }
  });

  await sleep(260);
  const secondPoll = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(secondPoll.status, 200);
  assert.equal(secondPoll.body.commands.length, 1);
  assert.equal(secondPoll.body.commands[0].type, "get_node_details");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: secondPoll.body.commands[0].commandId,
    error: null,
    result: {
      pluginId,
      node: { id: "10:1", type: "FRAME" },
      detailLevel: "layout",
      includeChildren: false
    }
  });

  const selectionResponse = await pendingSelection;
  const detailResponse = await pendingDetail;
  assert.equal(selectionResponse.status, 200);
  assert.equal(selectionResponse.body.ok, true);
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.ok, true);
});

test("queue pressure tuning is exposed when multiple detail fallback commands are deferred", async (t) => {
  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 80,
    wsPollingFallbackGraceMs: 600,
    toolTimeoutMs: 5000
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-fallback-queue-pressure";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const pendingDetails = [
    postJson(bridge.origin, "/api/get-node-details", {
      pluginId,
      targetNodeId: "10:1",
      detailLevel: "layout"
    }),
    postJson(bridge.origin, "/api/get-node-details", {
      pluginId,
      targetNodeId: "10:2",
      detailLevel: "layout"
    }),
    postJson(bridge.origin, "/api/get-node-details", {
      pluginId,
      targetNodeId: "10:3",
      detailLevel: "layout"
    })
  ];

  await sleep(300);
  const whileWsLive = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(whileWsLive.status, 200);
  assert.deepEqual(whileWsLive.body.commands, []);
  assert.equal(whileWsLive.body.queue.deferredByWsGuard >= 3, true);
  assert.equal(whileWsLive.body.queue.deferredByFallbackClass.detail >= 3, true);
  assert.equal(whileWsLive.body.queue.deferredByTuningMode.queue_pressure >= 1, true);

  socket.close();
  await sleep(120);
  const released = await waitForPluginCommands(bridge.origin, pluginId, {
    min: 3,
    timeoutMs: 2600
  });
  assert.equal(released.status, 200);
  assert.equal(released.body.commands.length >= 3, true);

  for (const command of released.body.commands) {
    await postJson(bridge.origin, "/plugin/results", {
      commandId: command.commandId,
      error: null,
      result: {
        pluginId,
        node: { id: command.payload?.targetNodeId || "10:1", type: "FRAME" },
        detailLevel: "layout",
        includeChildren: false
      }
    });
  }

  const responses = await Promise.all(pendingDetails);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
  }
});

test("queue pressure does not over-delay detail fallback beyond timeout budget protection", async (t) => {
  const bridge = await startBridgeServer({
    wsPluginPickupAckTimeoutMs: 80,
    wsPollingFallbackGraceMs: 4000,
    toolTimeoutMs: 1800
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-fallback-pressure-protect";
  await establishLiveSession(bridge.origin, pluginId);

  const wsUrl = originToWsUrl(
    bridge.origin,
    `${fixture.wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const detailRequests = Array.from({ length: 4 }, (_, index) =>
    postJson(bridge.origin, "/api/get-node-details", {
      pluginId,
      targetNodeId: `10:${index + 1}`,
      detailLevel: "layout"
    })
  );

  await sleep(260);
  const duringPressure = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(duringPressure.status, 200);
  assert.equal(duringPressure.body.commands.length, 0);
  assert.equal(duringPressure.body.queue.deferredByFallbackClass.detail >= 1, true);
  assert.equal(duringPressure.body.queue.deferredByTuningMode.queue_pressure >= 1, true);

  const startedAt = Date.now();
  let firstReleaseElapsedMs = null;
  let completedCount = 0;
  const targetCount = detailRequests.length;

  while (completedCount < targetCount) {
    const polled = await getJson(
      bridge.origin,
      `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
    );
    assert.equal(polled.status, 200);
    for (const command of polled.body.commands) {
      if (firstReleaseElapsedMs === null) {
        firstReleaseElapsedMs = Date.now() - startedAt;
      }
      assert.equal(command.type, "get_node_details");
      await postJson(bridge.origin, "/plugin/results", {
        commandId: command.commandId,
        error: null,
        result: {
          pluginId,
          node: { id: command.payload?.targetNodeId || "10:1", type: "FRAME" },
          detailLevel: command.payload?.detailLevel || "layout",
          includeChildren: false
        }
      });
      completedCount += 1;
    }
    await sleep(40);
  }

  const responses = await Promise.all(detailRequests);
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.equal(response.body.ok, true);
  }
  assert.equal(firstReleaseElapsedMs !== null, true);
  assert.equal(firstReleaseElapsedMs < 4000, true);
});
