import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "websocket-stage2-inspection.fixture.json");
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

function parseWsMessage(eventData) {
  if (typeof eventData !== "string") {
    return null;
  }
  try {
    return JSON.parse(eventData);
  } catch (error) {
    return null;
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
    timer.unref?.();

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
    const parsed = parseWsMessage(event.data);
    if (parsed) {
      messages.push(parsed);
    }
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

async function waitForEvent(messages, eventName, predicate = null, timeoutMs = 1200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const found = findEvent(messages, eventName, predicate);
    if (found) {
      return found;
    }
    await sleep(20);
  }
  return null;
}

function findEvent(messages, eventName, predicate = null) {
  return (
    messages.find((entry) => {
      if ((entry?.event || entry?.type) !== eventName) {
        return false;
      }
      return typeof predicate === "function" ? predicate(entry) : true;
    }) || null
  );
}

function extractComparableResult(httpBody, commandName) {
  const result = httpBody?.result;
  if (!result || typeof result !== "object") {
    return result;
  }

  if (commandName === "get_component_variant_details") {
    return {
      targetNode: result.targetNode || null,
      componentSet: result.componentSet || null,
      variantCount: result.variantCount || 0,
      variants: Array.isArray(result.variants) ? result.variants : []
    };
  }

  if (commandName === "get_instance_details") {
    return {
      instance: result.instance || null,
      sourceComponent: result.sourceComponent || null,
      sourceComponentSet: result.sourceComponentSet || null,
      componentPropertyDefinitions: Array.isArray(result.componentPropertyDefinitions)
        ? result.componentPropertyDefinitions
        : [],
      variantProperties: result.variantProperties || null,
      componentProperties: result.componentProperties || null,
      resolvedChildCount: result.resolvedChildCount || 0
    };
  }

  return result;
}

test("WS Stage 2 inspection hello advertises expanded read commands", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const connection = await connectWebSocket(
    originToWsUrl(bridge.origin, `/api/ws?pluginId=${encodeURIComponent(fixture.pluginId)}`)
  );
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }

  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const collector = startWsCollector(socket);
  await sleep(220);
  const messages = collector.stop();
  const hello = findEvent(messages, "ws.hello");
  assert.ok(hello);
  const readCommands = Array.isArray(hello.payload?.readCommands)
    ? hello.payload.readCommands
    : [];
  assert.equal(readCommands.includes("get_component_variant_details"), true);
  assert.equal(readCommands.includes("get_instance_details"), true);
});

test("WS Stage 2 inspection commands match HTTP for supported detail reads", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = fixture.pluginId;
  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    pageId: "ws-stage2"
  });
  assert.equal(register.status, 200);
  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });
  assert.equal(heartbeat.status, 200);

  const connection = await connectWebSocket(
    originToWsUrl(bridge.origin, `/api/ws?pluginId=${encodeURIComponent(pluginId)}`)
  );
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }

  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const supportedCases = fixture.cases.filter((item) => item.wsSupport !== "deferred");
  for (const testCase of supportedCases) {
    const collector = startWsCollector(socket);
    const requestId = `req-${testCase.name}`;
    const wsCommandType = testCase.expectedCommandType;
    socket.send(
      JSON.stringify({
        event: "ws.command.request",
        requestId,
        pluginId,
        command: wsCommandType,
        args: testCase.requestBody
      })
    );

    const wsPolled = await waitForPluginCommands(bridge.origin, pluginId);
    assert.equal(wsPolled.body.commands[0].type, testCase.expectedCommandType);
    await postJson(bridge.origin, "/plugin/results", {
      commandId: wsPolled.body.commands[0].commandId,
      error: null,
      result: testCase.pluginResult
    });

    const ack = await waitForEvent(
      collector.messages,
      "ws.command.ack",
      (entry) => entry.payload?.requestId === requestId
    );
    const result = await waitForEvent(
      collector.messages,
      "ws.command.result",
      (entry) => entry.payload?.requestId === requestId
    );

    assert.ok(ack);
    assert.ok(result);
    assert.equal(ack.payload.command, wsCommandType);
    assert.equal(result.payload.command, wsCommandType);

    const pendingHttp = postJson(bridge.origin, testCase.httpPath, {
      pluginId,
      ...testCase.requestBody
    });

    const httpPolled = await waitForPluginCommands(bridge.origin, pluginId);
    assert.equal(httpPolled.body.commands[0].type, testCase.expectedCommandType);
    await postJson(bridge.origin, "/plugin/results", {
      commandId: httpPolled.body.commands[0].commandId,
      error: null,
      result: testCase.pluginResult
    });
    const httpResponse = await pendingHttp;
    assert.equal(httpResponse.status, 200);
    assert.equal(httpResponse.body.ok, true);

    const messages = collector.stop();
    const enqueued = findEvent(
      messages,
      "command.enqueued",
      (entry) => entry.payload?.commandId === wsPolled.body.commands[0].commandId
    );
    const delivered = findEvent(
      messages,
      "command.delivered",
      (entry) => entry.payload?.commandId === wsPolled.body.commands[0].commandId
    );
    const completed = findEvent(
      messages,
      "command.completed",
      (entry) => entry.payload?.commandId === wsPolled.body.commands[0].commandId
    );
    assert.ok(enqueued);
    assert.ok(delivered);
    assert.ok(completed);

    assert.deepEqual(
      extractComparableResult({ result: result.payload.result }, wsCommandType),
      extractComparableResult(httpResponse.body, wsCommandType)
    );
  }
});

test("WS Stage 2 inspection keeps deferred commands explicitly unsupported", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = fixture.pluginId;
  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    pageId: "ws-stage2"
  });
  assert.equal(register.status, 200);
  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });
  assert.equal(heartbeat.status, 200);

  const connection = await connectWebSocket(
    originToWsUrl(bridge.origin, `/api/ws?pluginId=${encodeURIComponent(pluginId)}`)
  );
  if (!connection.supported) {
    t.skip(`WebSocket channel unavailable: ${connection.reason}`);
    return;
  }

  const socket = connection.socket;
  t.after(() => {
    socket.close();
  });

  const deferredCase = fixture.cases.find((item) => item.wsSupport === "deferred");
  assert.ok(deferredCase);

  const collector = startWsCollector(socket);
  socket.send(
    JSON.stringify({
      event: "ws.command.request",
      requestId: "req-deferred",
      pluginId,
      command: deferredCase.expectedCommandType,
      args: deferredCase.requestBody
    })
  );

  await sleep(220);
  const messages = collector.stop();
  const errorEvent = findEvent(
    messages,
    "ws.command.error",
    (entry) => entry.payload?.requestId === "req-deferred"
  );

  assert.ok(errorEvent);
  assert.equal(errorEvent.payload.command, deferredCase.expectedCommandType);
  assert.equal(errorEvent.payload.code, "ERR_WS_UNSUPPORTED_COMMAND");
});
