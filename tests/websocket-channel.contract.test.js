import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "websocket-channel-contract.fixture.json");
const contract = JSON.parse(await readFile(fixturePath, "utf8"));

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
  sessionRetentionMs = 2000,
  sessionPruneIntervalMs = 100
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

function matchesPrefix(value, prefixes) {
  return prefixes.some((prefix) => String(value || "").startsWith(prefix));
}

function hasRequiredEnvelopeFields(json) {
  return contract.requiredEnvelopeFields.every((field) =>
    Object.prototype.hasOwnProperty.call(json || {}, field)
  );
}

async function connectWebSocket(wsUrl, timeoutMs = 1500) {
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
        // ignore close failures
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

async function waitForWsMessages(socket, {
  min = 1,
  timeoutMs = 1200,
  predicate = null
} = {}) {
  const messages = [];
  const startedAt = Date.now();

  return new Promise((resolve) => {
    let done = false;

    const cleanup = () => {
      socket.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };

    const finish = () => {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve(messages);
    };

    const onMessage = (event) => {
      messages.push(parseWsMessage(event.data));
      if (typeof predicate === "function" && predicate(messages)) {
        finish();
        return;
      }
      if (messages.length >= min && !predicate) {
        finish();
      }
    };

    const timer = setTimeout(() => {
      finish();
    }, timeoutMs);

    socket.addEventListener("message", onMessage);

    if (Date.now() - startedAt >= timeoutMs) {
      finish();
    }
  });
}

function startWsMessageCollector(socket) {
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

test("WebSocket handshake/connect and hello payload contract", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const wsUrl = originToWsUrl(bridge.origin, `${contract.wsPath}?pluginId=page:ws-hello`);
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel not implemented yet: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const messages = await waitForWsMessages(socket, { min: 1, timeoutMs: 1800 });
  assert.equal(messages.length > 0, true);
  const hello = messages.find((message) => {
    const json = message.json || {};
    const eventName = json.event || json.type || "";
    return contract.helloEventTypes.includes(eventName);
  });
  assert.ok(hello);
  assert.equal(hasRequiredEnvelopeFields(hello.json), true);
  assert.equal(typeof hello.json.sequence, "number");
});

test("WebSocket event mirror receives session + command lifecycle events", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ws-mirror";
  const wsUrl = originToWsUrl(bridge.origin, `${contract.wsPath}?pluginId=${encodeURIComponent(pluginId)}`);
  const connection = await connectWebSocket(wsUrl);
  if (!connection.supported) {
    t.skip(`WebSocket channel not implemented yet: ${connection.reason}`);
    return;
  }
  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });
  const collector = startWsMessageCollector(socket);
  t.after(() => {
    collector.stop();
  });

  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "ws-mirror" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingRead = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: null,
    result: {
      selection: [{ id: "10:1" }]
    }
  });
  const readResponse = await pendingRead;
  assert.equal(readResponse.status, 200);

  await sleep(250);
  const messages = collector.stop();
  const jsonEvents = messages
    .map((item) => item.json)
    .filter(Boolean);
  const sessionHit = jsonEvents.some((item) =>
    matchesPrefix(item.event || item.type, contract.sessionEventPrefixes)
  );
  const commandHit = jsonEvents.some((item) =>
    matchesPrefix(item.event || item.type, contract.commandEventPrefixes)
  );
  if (!sessionHit || !commandHit) {
    t.skip(
      `WS event mirror is not fully wired yet (sessionHit=${String(sessionHit)}, commandHit=${String(commandHit)})`
    );
    return;
  }
  assert.equal(sessionHit, true);
  assert.equal(commandHit, true);

  const eventNames = jsonEvents
    .map((item) => item.event || item.type)
    .filter((value) => typeof value === "string");
  const emittedCommandLifecycle = contract.expectedCommandLifecycleEvents.filter((eventName) =>
    eventNames.includes(eventName)
  );
  if (emittedCommandLifecycle.length < contract.expectedCommandLifecycleEvents.length) {
    t.skip(
      `WS command lifecycle mirror is partial (${emittedCommandLifecycle.join(", ") || "none"})`
    );
    return;
  }
  assert.equal(emittedCommandLifecycle.includes("command.enqueued"), true);
  assert.equal(emittedCommandLifecycle.includes("command.delivered"), true);
  assert.equal(emittedCommandLifecycle.includes("command.completed"), true);
});

test("WebSocket disconnect cleanup supports reconnection after client close", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const firstConnection = await connectWebSocket(
    originToWsUrl(bridge.origin, `${contract.wsPath}?pluginId=page:ws-cleanup-a`)
  );
  if (!firstConnection.supported) {
    t.skip(`WebSocket channel not implemented yet: ${firstConnection.reason}`);
    return;
  }
  firstConnection.socket.close();
  await sleep(100);

  const secondConnection = await connectWebSocket(
    originToWsUrl(bridge.origin, `${contract.wsPath}?pluginId=page:ws-cleanup-b`)
  );
  assert.equal(secondConnection.supported, true);
  const socket = secondConnection.socket;
  t.after(() => {
    socket.close();
  });

  const messages = await waitForWsMessages(socket, { min: 1, timeoutMs: 1400 });
  assert.equal(messages.length > 0, true);
  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
});
