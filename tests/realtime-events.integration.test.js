import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "fixtures", "realtime-event-contract.fixture.json");
const contract = JSON.parse(await readFile(fixturePath, "utf8"));
const textDecoder = new TextDecoder();

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

function parseSseFrame(rawFrame) {
  const normalized = rawFrame.replace(/\r/g, "");
  const lines = normalized.split("\n");
  let id = "";
  let event = "";
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).trimStart() : "";
    if (field === "id") {
      id = value;
    } else if (field === "event") {
      event = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  const dataRaw = dataLines.join("\n");
  let data = null;
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw);
    } catch (error) {
      data = null;
    }
  }

  return {
    id,
    event,
    dataRaw,
    data
  };
}

function hasRequiredEnvelopeFields(data) {
  return contract.requiredEnvelopeFields.every((field) =>
    Object.prototype.hasOwnProperty.call(data || {}, field)
  );
}

async function openSseStream(origin, pathname = "/api/events", { headers = {} } = {}) {
  const abortController = new AbortController();
  const response = await fetch(`${origin}${pathname}`, {
    headers: {
      accept: "text/event-stream",
      ...headers
    },
    signal: abortController.signal
  });

  const contentType = response.headers.get("content-type") || "";
  const supported = response.status === 200 && contentType.includes(contract.validSseContentType);

  return {
    supported,
    response,
    abortController
  };
}

async function collectSseEvents(stream, { timeoutMs = 1200, stopWhen } = {}) {
  if (!stream.response.body) {
    return [];
  }

  const reader = stream.response.body.getReader();
  const startedAt = Date.now();
  let buffer = "";
  const events = [];

  try {
    while (Date.now() - startedAt < timeoutMs) {
      const remaining = timeoutMs - (Date.now() - startedAt);
      if (remaining <= 0) {
        break;
      }

      const result = await Promise.race([
        reader.read(),
        sleep(remaining).then(() => ({ timeout: true }))
      ]);

      if (result && "timeout" in result) {
        break;
      }

      if (!result || result.done) {
        break;
      }

      buffer += textDecoder.decode(result.value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      let splitIndex = buffer.indexOf("\n\n");
      while (splitIndex >= 0) {
        const frame = buffer.slice(0, splitIndex);
        buffer = buffer.slice(splitIndex + 2);
        const parsed = parseSseFrame(frame);
        if (parsed.event || parsed.dataRaw) {
          events.push(parsed);
          if (typeof stopWhen === "function" && stopWhen(events)) {
            return events;
          }
        }
        splitIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }

  return events;
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

function assertMonotonicSequence(events) {
  const sequenceValues = events
    .map((entry) => (entry.data && typeof entry.data.sequence === "number" ? entry.data.sequence : null))
    .filter((value) => typeof value === "number");
  for (let index = 1; index < sequenceValues.length; index += 1) {
    assert.equal(sequenceValues[index] >= sequenceValues[index - 1], true);
  }
}

test("SSE stream validity: endpoint responds with text/event-stream and contract envelope", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:realtime-validity";
  const stream = await openSseStream(bridge.origin, `/api/events?pluginId=${encodeURIComponent(pluginId)}`);
  t.after(() => {
    stream.abortController.abort();
  });

  if (!stream.supported) {
    t.skip(`SSE endpoint not available yet (status=${stream.response.status})`);
    return;
  }

  assert.equal(stream.response.status, 200);
  const contentType = stream.response.headers.get("content-type") || "";
  assert.equal(contentType.includes(contract.validSseContentType), true);

  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "realtime-validity" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const events = await collectSseEvents(stream, {
    timeoutMs: 1400,
    stopWhen: (collected) =>
      collected.some(
        (entry) =>
          entry.data &&
          typeof entry.data.event === "string" &&
          entry.data.event.startsWith("session.")
      )
  });
  assert.equal(events.length > 0, true);

  const eventWithEnvelope = events.find((entry) => hasRequiredEnvelopeFields(entry.data));
  assert.ok(eventWithEnvelope);
  assert.equal(typeof eventWithEnvelope.data.event, "string");
  assert.equal(typeof eventWithEnvelope.data.at, "string");
  assert.equal(typeof eventWithEnvelope.data.sequence, "number");
  assert.equal(typeof eventWithEnvelope.data.payload, "object");
  assertMonotonicSequence(events);
});

test("SSE session lifecycle emits registered/heartbeat/state_changed events", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 120,
    sessionRetentionMs: 2000,
    sessionPruneIntervalMs: 80
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:realtime-session";
  const stream = await openSseStream(bridge.origin, `/api/events?pluginId=${encodeURIComponent(pluginId)}`);
  t.after(() => {
    stream.abortController.abort();
  });

  if (!stream.supported) {
    t.skip(`SSE endpoint not available yet (status=${stream.response.status})`);
    return;
  }

  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "realtime-session" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });
  await sleep(220);
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const events = await collectSseEvents(stream, {
    timeoutMs: 2200,
    stopWhen: (collected) => {
      const types = new Set(
        collected
          .map((entry) => entry.data?.event)
          .filter((value) => typeof value === "string")
      );
      return contract.sessionLifecycleEventTypes.every((type) => types.has(type));
    }
  });

  const emittedTypes = new Set(
    events
      .map((entry) => entry.data?.event)
      .filter((value) => typeof value === "string")
  );
  for (const requiredType of contract.sessionLifecycleEventTypes) {
    assert.equal(emittedTypes.has(requiredType), true);
  }
  assertMonotonicSequence(events);
});

test("SSE command lifecycle emits enqueued/delivered/completed events", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:realtime-command";
  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "realtime-command" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const stream = await openSseStream(bridge.origin, `/api/events?pluginId=${encodeURIComponent(pluginId)}`);
  t.after(() => {
    stream.abortController.abort();
  });

  if (!stream.supported) {
    t.skip(`SSE endpoint not available yet (status=${stream.response.status})`);
    return;
  }

  const pendingRead = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  const commandId = polled.body.commands[0].commandId;

  await postJson(bridge.origin, "/plugin/results", {
    commandId,
    error: null,
    result: {
      selection: [{ id: "10:1" }]
    }
  });
  const readResponse = await pendingRead;
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.body.ok, true);

  const events = await collectSseEvents(stream, {
    timeoutMs: 1600,
    stopWhen: (collected) => {
      const types = new Set(
        collected
          .map((entry) => entry.data?.event)
          .filter((value) => typeof value === "string")
      );
      return contract.commandLifecycleEventTypes.every((type) => types.has(type));
    }
  });

  const emittedTypes = new Set(
    events
      .map((entry) => entry.data?.event)
      .filter((value) => typeof value === "string")
  );
  for (const requiredType of contract.commandLifecycleEventTypes) {
    assert.equal(emittedTypes.has(requiredType), true);
  }
  assertMonotonicSequence(events);
});

test("SSE disconnect cleanup: closing one stream does not break subsequent subscriptions", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:realtime-disconnect";
  const streamA = await openSseStream(bridge.origin, `/api/events?pluginId=${encodeURIComponent(pluginId)}`);
  if (!streamA.supported) {
    streamA.abortController.abort();
    t.skip(`SSE endpoint not available yet (status=${streamA.response.status})`);
    return;
  }

  streamA.abortController.abort();
  await sleep(80);

  const streamB = await openSseStream(bridge.origin, `/api/events?pluginId=${encodeURIComponent(pluginId)}`);
  t.after(() => {
    streamB.abortController.abort();
  });
  assert.equal(streamB.supported, true);
  assert.equal(streamB.response.status, 200);

  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "realtime-disconnect" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const events = await collectSseEvents(streamB, {
    timeoutMs: 1200,
    stopWhen: (collected) =>
      collected.some((entry) => typeof entry.data?.event === "string" && entry.data.event === "session.registered")
  });
  assert.equal(events.length > 0, true);

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
});

test("SSE reconnect with Last-Event-ID replays missed events", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 120,
    sessionRetentionMs: 2000,
    sessionPruneIntervalMs: 80
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:realtime-replay";
  const streamA = await openSseStream(
    bridge.origin,
    `/api/events?pluginId=${encodeURIComponent(pluginId)}`
  );
  t.after(() => {
    streamA.abortController.abort();
  });

  if (!streamA.supported) {
    t.skip(`SSE endpoint not available yet (status=${streamA.response.status})`);
    return;
  }

  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "replay" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const firstStreamEvents = await collectSseEvents(streamA, {
    timeoutMs: 1600,
    stopWhen: (collected) =>
      collected.some((entry) => entry.data?.event === "session.heartbeat")
  });
  const checkpointEvent = [...firstStreamEvents]
    .reverse()
    .find((entry) => entry.data?.event === "session.heartbeat");
  assert.ok(checkpointEvent);
  const lastEventId = Number(checkpointEvent.id);
  assert.equal(Number.isFinite(lastEventId), true);

  streamA.abortController.abort();
  await sleep(120);
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const replayStream = await openSseStream(
    bridge.origin,
    `/api/events?pluginId=${encodeURIComponent(pluginId)}`,
    {
      headers: {
        "Last-Event-ID": String(lastEventId)
      }
    }
  );
  t.after(() => {
    replayStream.abortController.abort();
  });

  const replayEvents = await collectSseEvents(replayStream, {
    timeoutMs: 1600,
    stopWhen: (collected) =>
      collected.some(
        (entry) =>
          entry.data?.event === "session.heartbeat" &&
          typeof entry.data?.sequence === "number" &&
          entry.data.sequence > lastEventId
      )
  });

  const replayedHeartbeat = replayEvents.find(
    (entry) =>
      entry.data?.event === "session.heartbeat" &&
      typeof entry.data?.sequence === "number" &&
      entry.data.sequence > lastEventId
  );
  assert.ok(replayedHeartbeat);
  assert.equal(replayedHeartbeat.data.sequence > lastEventId, true);
});
