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
  sessionActiveWindowMs = 45_000,
  sessionRetentionMs = 600_000,
  sessionPruneIntervalMs = 5_000
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

async function getJson(origin, path) {
  const response = await fetch(`${origin}${path}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

async function postJson(origin, path, payload) {
  const response = await fetch(`${origin}${path}`, {
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

test("preflight health endpoint reports bridge identity and active plugins", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.server, "writable-mcp-bridge");
  assert.equal(Array.isArray(health.body.activePlugins), true);
  assert.deepEqual(health.body.activePlugins, []);
});

test("session-state and heartbeat lifecycle is reflected by /api/sessions and /health", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 300,
    sessionRetentionMs: 900
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:4814:2634";
  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    fileKey: "demo-file",
    fileName: "Demo File",
    pageId: "4814:2634",
    pageName: "Overview"
  });
  assert.equal(register.status, 200);
  assert.equal(register.body.ok, true);
  assert.equal(register.body.pluginId, pluginId);
  assert.equal(register.body.state, "registered");

  const publishSelection = await postJson(bridge.origin, "/plugin/selection", {
    pluginId,
    selection: [{ id: "10:1" }, { id: "10:2" }]
  });
  assert.equal(publishSelection.status, 200);
  assert.equal(publishSelection.body.ok, true);

  const sessions = await getJson(bridge.origin, "/api/sessions");
  assert.equal(sessions.status, 200);
  assert.equal(sessions.body.ok, true);
  assert.equal(sessions.body.sessions.length, 1);
  assert.equal(sessions.body.sessions[0].pluginId, pluginId);
  assert.equal(sessions.body.sessions[0].selectionCount, 2);
  assert.equal(sessions.body.sessions[0].active, true);

  await sleep(450);

  const staleSessions = await getJson(bridge.origin, "/api/sessions?includeStale=true");
  assert.equal(staleSessions.status, 200);
  assert.equal(staleSessions.body.sessions.length, 1);
  assert.equal(staleSessions.body.sessions[0].pluginId, pluginId);
  assert.equal(staleSessions.body.sessions[0].active, false);

  const staleHealth = await getJson(bridge.origin, "/health");
  assert.equal(staleHealth.status, 200);
  assert.equal(staleHealth.body.activePlugins.includes(pluginId), false);

  const heartbeatCheck = await getJson(
    bridge.origin,
    `/plugin/heartbeat?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(heartbeatCheck.status, 200);
  assert.equal(heartbeatCheck.body.ok, true);
  assert.equal(heartbeatCheck.body.state, "stale");

  const heartbeatPing = await postJson(bridge.origin, "/plugin/heartbeat", {
    pluginId
  });
  assert.equal(heartbeatPing.status, 200);
  assert.equal(heartbeatPing.body.ok, true);
  assert.equal(heartbeatPing.body.state, "live");

  const heartbeat = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.body.ok, true);
  assert.deepEqual(heartbeat.body.commands, []);

  const refreshedSessions = await getJson(bridge.origin, "/api/sessions");
  assert.equal(refreshedSessions.status, 200);
  assert.equal(refreshedSessions.body.sessions.length, 1);
  assert.equal(refreshedSessions.body.sessions[0].pluginId, pluginId);
  assert.equal(refreshedSessions.body.sessions[0].active, true);

  await sleep(1000);
  const prunedSessions = await getJson(bridge.origin, "/api/sessions?includeStale=true");
  assert.equal(prunedSessions.status, 200);
  assert.deepEqual(prunedSessions.body.sessions, []);
});

test("runtime ops endpoint reports session/queue diagnostics and prunes expired sessions", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 120,
    sessionRetentionMs: 360,
    sessionPruneIntervalMs: 40
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:ops:1";
  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    fileName: "Ops File",
    pageName: "Ops Page",
    pageId: "ops:1"
  });
  assert.equal(register.status, 200);
  assert.equal(register.body.ok, true);

  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", {
    pluginId
  });
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.body.ok, true);
  assert.equal(heartbeat.body.state, "live");

  const runtimeBefore = await getJson(
    bridge.origin,
    "/api/runtime-ops?staleLimit=1"
  );
  assert.equal(runtimeBefore.status, 200);
  assert.equal(runtimeBefore.body.ok, true);
  assert.equal(runtimeBefore.body.result.config.pruneIntervalMs, 40);
  assert.equal(runtimeBefore.body.result.sessions.summary.total, 1);
  assert.equal(runtimeBefore.body.result.sessions.summary.live, 1);
  assert.equal(Array.isArray(runtimeBefore.body.result.sessions.staleSessions), true);
  assert.equal(runtimeBefore.body.result.sessions.staleSessions.length, 0);
  assert.equal(runtimeBefore.body.result.queue.pendingTotal, 0);
  assert.equal(runtimeBefore.body.result.observability.sessions.trackedTotal, 1);

  await sleep(520);

  const runtimeAfter = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeAfter.status, 200);
  assert.equal(runtimeAfter.body.ok, true);
  assert.equal(runtimeAfter.body.result.sessions.summary.total, 0);
  assert.equal(runtimeAfter.body.result.observability.sessions.trackedTotal, 0);
  assert.equal(runtimeAfter.body.result.observability.sessions.prunedTotal >= 1, true);
});

test("command preflight returns explicit ERR_* for offline/registered/stale sessions", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 200,
    sessionRetentionMs: 700
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const offline = await postJson(bridge.origin, "/api/get-selection", {
    pluginId: "page:offline"
  });
  assert.equal(offline.status, 404);
  assert.equal(offline.body.ok, false);
  assert.equal(offline.body.code, "ERR_PLUGIN_SESSION_OFFLINE");
  assert.equal(offline.body.details?.pluginId, "page:offline");
  assert.equal(offline.body.details?.state, "offline");
  assert.equal(offline.body.details?.staleMs, null);

  const pluginId = "page:registered";
  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    pageId: "registered"
  });
  assert.equal(register.status, 200);
  assert.equal(register.body.state, "registered");

  const registered = await postJson(bridge.origin, "/api/get-selection", {
    pluginId
  });
  assert.equal(registered.status, 409);
  assert.equal(registered.body.ok, false);
  assert.equal(registered.body.code, "ERR_PLUGIN_SESSION_REGISTERED");
  assert.equal(registered.body.details?.pluginId, pluginId);
  assert.equal(registered.body.details?.state, "registered");
  assert.equal(typeof registered.body.details?.staleMs, "number");
  assert.equal(registered.body.details.staleMs >= 0, true);

  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.body.state, "live");

  await sleep(260);
  const stale = await postJson(bridge.origin, "/api/get-selection", {
    pluginId
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.ok, false);
  assert.equal(stale.body.code, "ERR_PLUGIN_SESSION_STALE");
  assert.equal(stale.body.details?.pluginId, pluginId);
  assert.equal(stale.body.details?.state, "stale");
  assert.equal(typeof stale.body.details?.staleMs, "number");
  assert.equal(stale.body.details.staleMs >= 200, true);
});

test("command polling accepts dynamic poll hints and refreshes session heartbeat", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 120,
    sessionRetentionMs: 700
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:poll-hints";
  const register = await postJson(bridge.origin, "/plugin/register", { pluginId });
  assert.equal(register.status, 200);
  assert.equal(register.body.ok, true);

  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.body.state, "live");

  await sleep(140);

  const pollWithHints = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}&pollState=recovering&pollIntervalMs=250&queuePolicy=drain`
  );
  assert.equal(pollWithHints.status, 200);
  assert.equal(pollWithHints.body.ok, true);
  assert.deepEqual(pollWithHints.body.commands, []);

  const stateAfterPoll = await getJson(
    bridge.origin,
    `/plugin/heartbeat?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(stateAfterPoll.status, 200);
  assert.equal(stateAfterPoll.body.ok, true);
  assert.equal(stateAfterPoll.body.state, "live");
});

test("queue delivers commands once and preserves recovery/observability result fields", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 800,
    sessionRetentionMs: 4000
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:queue-policy";
  const register = await postJson(bridge.origin, "/plugin/register", { pluginId });
  assert.equal(register.status, 200);
  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.body.state, "live");

  const firstApi = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const secondApi = postJson(bridge.origin, "/api/get-selection", { pluginId });
  await sleep(25);

  const firstPoll = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}&pollState=active&queuePolicy=fifo`
  );
  assert.equal(firstPoll.status, 200);
  assert.equal(firstPoll.body.ok, true);
  assert.equal(firstPoll.body.commands.length, 1);
  assert.equal(firstPoll.body.commands[0].type, "get_selection");
  assert.equal(typeof firstPoll.body.commands[0].deliveredAt, "number");

  const secondPoll = await getJson(
    bridge.origin,
    `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
  );
  assert.equal(secondPoll.status, 200);
  assert.equal(secondPoll.body.ok, true);
  assert.deepEqual(secondPoll.body.commands, []);

  const firstResultPayload = {
    selection: [{ id: "10:1" }],
    queuePolicyOutcome: "delivered_once",
    recoverySuccess: true,
    preflightOk: true,
    latencyBucket: "lt_250ms"
  };

  const firstResultAck = await postJson(bridge.origin, "/plugin/results", {
    commandId: firstPoll.body.commands[0].commandId,
    result: firstResultPayload,
    error: null
  });
  assert.equal(firstResultAck.status, 200);
  assert.equal(firstResultAck.body.ok, true);

  const firstResponse = await firstApi;
  const secondResponse = await secondApi;
  assert.equal(firstResponse.status, 200);
  assert.equal(firstResponse.body.ok, true);
  assert.equal(firstResponse.body.result.queuePolicyOutcome, "delivered_once");
  assert.equal(firstResponse.body.result.recoverySuccess, true);
  assert.equal(firstResponse.body.result.preflightOk, true);
  assert.equal(firstResponse.body.result.latencyBucket, "lt_250ms");
  assert.deepEqual(firstResponse.body.result.selection, [{ id: "10:1" }]);
  assert.equal(secondResponse.status, 200);
  assert.equal(secondResponse.body.ok, true);
  assert.equal(secondResponse.body.result.queuePolicyOutcome, "delivered_once");
  assert.equal(secondResponse.body.result.recoverySuccess, true);
  assert.equal(secondResponse.body.result.preflightOk, true);
  assert.equal(secondResponse.body.result.latencyBucket, "lt_250ms");
  assert.deepEqual(secondResponse.body.result.selection, [{ id: "10:1" }]);
});

test("invalid JSON body on plugin registration returns HTTP 400", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const response = await fetch(`${bridge.origin}/plugin/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid-json"
  });
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, "Invalid JSON body");
});
