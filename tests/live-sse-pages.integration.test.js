import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";

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

async function readSseFrames(response, { maxFrames = 3, timeoutMs = 1200 } = {}) {
  if (!response.body) {
    return [];
  }
  const reader = response.body.getReader();
  const frames = [];
  let buffer = "";
  const startedAt = Date.now();

  try {
    while (Date.now() - startedAt < timeoutMs && frames.length < maxFrames) {
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
      while (splitIndex >= 0 && frames.length < maxFrames) {
        const frame = buffer.slice(0, splitIndex).trim();
        buffer = buffer.slice(splitIndex + 2);
        if (frame) {
          frames.push(frame);
        }
        splitIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }

  return frames;
}

test("live validation: health OK, SSE responds, pages OK, metadata OK for live pluginId", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:live-sse-pages";

  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    fileName: "Live Validation File",
    pageId: "10:1",
    pageName: "Overview"
  });
  assert.equal(register.status, 200);
  assert.equal(register.body.ok, true);

  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.body.state, "live");

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.server, "writable-mcp-bridge");
  assert.equal(health.body.activePlugins.includes(pluginId), true);

  const sseAbortController = new AbortController();
  t.after(() => {
    sseAbortController.abort();
  });
  const sseResponse = await fetch(
    `${bridge.origin}/api/events?pluginId=${encodeURIComponent(pluginId)}`,
    {
      headers: { accept: "text/event-stream" },
      signal: sseAbortController.signal
    }
  );
  assert.equal(sseResponse.status, 200);
  const contentType = sseResponse.headers.get("content-type") || "";
  assert.equal(contentType.includes("text/event-stream"), true);
  const frames = await readSseFrames(sseResponse, { maxFrames: 3, timeoutMs: 1500 });
  assert.equal(frames.length > 0, true);
  assert.equal(frames.some((frame) => frame.includes("event:")), true);
  assert.equal(frames.some((frame) => frame.includes("data:")), true);

  const pagesRequest = getJson(
    bridge.origin,
    `/api/pages?pluginId=${encodeURIComponent(pluginId)}`
  );
  const pagesPolled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(pagesPolled.body.commands.length, 1);
  assert.equal(pagesPolled.body.commands[0].type, "list_pages");
  await postJson(bridge.origin, "/plugin/results", {
    commandId: pagesPolled.body.commands[0].commandId,
    error: null,
    result: {
      pages: [
        { id: "10:1", name: "Overview", type: "PAGE", isCurrent: true },
        { id: "10:2", name: "Archive", type: "PAGE", isCurrent: false }
      ]
    }
  });
  const pagesResponse = await pagesRequest;
  assert.equal(pagesResponse.status, 200);
  assert.equal(pagesResponse.body.ok, true);
  assert.equal(Array.isArray(pagesResponse.body.result.pages), true);
  assert.equal(pagesResponse.body.result.pages.length, 2);
  assert.equal(pagesResponse.body.result.pages[0].id, "10:1");

  const metadataRequest = postJson(bridge.origin, "/api/get-metadata", {
    pluginId,
    targetNodeId: "10:1",
    maxDepth: 2,
    maxNodes: 20,
    includeJson: true
  });
  const metadataPolled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(metadataPolled.body.commands.length, 1);
  assert.equal(metadataPolled.body.commands[0].type, "get_metadata");
  assert.equal(metadataPolled.body.commands[0].payload.targetNodeId, "10:1");
  assert.equal(metadataPolled.body.commands[0].payload.includeJson, true);
  await postJson(bridge.origin, "/plugin/results", {
    commandId: metadataPolled.body.commands[0].commandId,
    error: null,
    result: {
      pluginId,
      fileKey: "demo-key",
      fileName: "Live Validation File",
      nodeCount: 1,
      truncated: false,
      xml: "<selection><page id=\"10:1\" name=\"Overview\" /></selection>",
      json: {
        type: "selection",
        pageId: "10:1",
        pageName: "Overview",
        roots: [{ id: "10:1", name: "Overview", type: "PAGE" }],
        nodeCount: 1,
        truncated: false
      }
    }
  });
  const metadataResponse = await metadataRequest;
  assert.equal(metadataResponse.status, 200);
  assert.equal(metadataResponse.body.ok, true);
  assert.equal(typeof metadataResponse.body.result.xml, "string");
  assert.equal(metadataResponse.body.result.json.pageId, "10:1");
  assert.equal(metadataResponse.body.result.json.roots.length, 1);
});
