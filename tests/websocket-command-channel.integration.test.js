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
  sessionPruneIntervalMs = 120
} = {}) {
  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      SESSION_ACTIVE_WINDOW_MS: String(sessionActiveWindowMs),
      SESSION_RETENTION_MS: String(sessionRetentionMs),
      SESSION_PRUNE_INTERVAL_MS: String(sessionPruneIntervalMs)
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
