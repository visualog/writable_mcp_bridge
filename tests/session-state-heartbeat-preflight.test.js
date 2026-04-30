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
  sessionPruneIntervalMs = 5_000,
  toolTimeoutMs,
  wsPluginPickupAckTimeoutMs,
  wsPluginResumeAckGraceMs,
  wsPollingFallbackGraceMs,
  searchNodesRetryMaxAttempts,
  searchNodesRetryBaseDelayMs,
  searchNodesRetryMaxDelayMs,
  recentFailureWindowMs
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
      ...(typeof toolTimeoutMs === "number"
        ? { TOOL_TIMEOUT_MS: String(toolTimeoutMs) }
        : {}),
      ...(typeof wsPluginPickupAckTimeoutMs === "number"
        ? { WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS: String(wsPluginPickupAckTimeoutMs) }
        : {}),
      ...(typeof wsPluginResumeAckGraceMs === "number"
        ? { WS_PLUGIN_RESUME_ACK_GRACE_MS: String(wsPluginResumeAckGraceMs) }
        : {}),
      ...(typeof wsPollingFallbackGraceMs === "number"
        ? { WS_POLLING_FALLBACK_GRACE_MS: String(wsPollingFallbackGraceMs) }
        : {}),
      ...(typeof searchNodesRetryMaxAttempts === "number"
        ? { SEARCH_NODES_RETRY_MAX_ATTEMPTS: String(searchNodesRetryMaxAttempts) }
        : {}),
      ...(typeof searchNodesRetryBaseDelayMs === "number"
        ? { SEARCH_NODES_RETRY_BASE_DELAY_MS: String(searchNodesRetryBaseDelayMs) }
        : {}),
      ...(typeof searchNodesRetryMaxDelayMs === "number"
        ? { SEARCH_NODES_RETRY_MAX_DELAY_MS: String(searchNodesRetryMaxDelayMs) }
        : {}),
      ...(typeof recentFailureWindowMs === "number"
        ? { RECENT_FAILURE_WINDOW_MS: String(recentFailureWindowMs) }
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

function collectWebSocketMessages(socket) {
  const messages = [];
  const onMessage = (event) => {
    const raw = typeof event?.data === "string" ? event.data : String(event?.data || "");
    try {
      messages.push(JSON.parse(raw));
    } catch (error) {
      messages.push({ raw });
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

async function waitForCondition(predicate, timeoutMs = 1200) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) {
      return true;
    }
    await sleep(25);
  }
  throw new Error("Timed out waiting for condition");
}

function toWsOrigin(origin) {
  return String(origin || "").replace(/^http:/, "ws:");
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
  assert.equal(health.body.commandReadiness.status, "unavailable");
  assert.equal(health.body.commandReadiness.reason, "no_active_plugin");
});

test("preflight health endpoint exposes version and transport capability metadata", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.serverVersion, "0.5.63");
  assert.equal(health.body.packageVersion, "0.5.63");
  assert.deepEqual(health.body.transportCapabilities, {
    healthEvents: true,
    sse: true,
    websocket: true,
    websocketCommandChannel: true,
    httpPollingFallback: true
  });
  assert.deepEqual(health.body.runtimeFeatureFlags, {
    streamingFirst: true,
    healthBroadcast: true,
    eventStreamMirror: true,
    websocketCommandMirror: true,
    pollingFallback: true
  });
  assert.equal(typeof health.body.commandReadiness.summary, "string");
  assert.equal(typeof health.body.commandReadiness.timingLagThresholdMs, "number");
  assert.equal(typeof health.body.commandReadiness.baseTimingLagThresholdMs, "number");
  assert.equal(typeof health.body.commandReadiness.timingLagThresholdSource, "string");
  assert.equal(
    health.body.commandReadiness.timingBottleneckStage === null ||
      typeof health.body.commandReadiness.timingBottleneckStage === "string",
    true
  );
  assert.equal(
    health.body.commandReadiness.timingBottleneckDurationMs === null ||
      Number.isFinite(health.body.commandReadiness.timingBottleneckDurationMs),
    true
  );
  assert.equal(typeof health.body.writeReadiness?.status, "string");
  assert.equal(typeof health.body.writeReadiness?.pendingWriteCount, "number");
});

test("preflight health and runtime ops expose live transport health summary", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const sseAbort = new AbortController();
  const sseResponse = await fetch(`${bridge.origin}/api/events`, {
    signal: sseAbort.signal
  });
  assert.equal(sseResponse.status, 200);

  const wsConnection = await connectWebSocket(`${toWsOrigin(bridge.origin)}/api/ws`);
  if (!wsConnection.supported) {
    t.skip(`WebSocket channel unavailable: ${wsConnection.reason}`);
    sseAbort.abort();
    return;
  }

  const socket = wsConnection.socket;
  const collector = collectWebSocketMessages(socket);
  t.after(() => {
    collector.stop();
    try {
      socket.close();
    } catch (error) {
      // ignore close failures
    }
    sseAbort.abort();
  });

  socket.send(
    JSON.stringify({
      type: "ws.command.request",
      requestId: "req-transport-health",
      command: "ping"
    })
  );

  await waitForCondition(
    () =>
      collector.messages.some((entry) => (entry?.event || entry?.type) === "ws.command.ack") &&
      collector.messages.some((entry) => (entry?.event || entry?.type) === "ws.command.result"),
    1200
  );

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.transportHealth.grade, "standby");
  assert.equal(health.body.transportHealth.activeClients.sse >= 1, true);
  assert.equal(health.body.transportHealth.activeClients.ws >= 1, true);
  assert.equal(health.body.transportHealth.recent.recentWsAckTotal >= 1, true);
  assert.equal(health.body.transportHealth.recent.recentWsResultTotal >= 1, true);
  assert.equal(typeof health.body.transportHealth.fallbackIncidenceTrend?.status, "string");

  const runtime = await getJson(bridge.origin, "/api/runtime-ops?staleLimit=1");
  assert.equal(runtime.status, 200);
  assert.equal(runtime.body.ok, true);
  assert.equal(runtime.body.result.transportHealth.grade, "standby");
  assert.equal(runtime.body.result.observability.transport.activeClients.sse >= 1, true);
  assert.equal(runtime.body.result.observability.transport.activeClients.ws >= 1, true);
  assert.equal(runtime.body.result.observability.transport.recent.recentWsAckTotal >= 1, true);
  assert.equal(runtime.body.result.observability.transport.recent.recentWsResultTotal >= 1, true);
  assert.equal(
    health.body.transportHealth.fallbackIncidenceTrend.status,
    runtime.body.result.transportHealth.fallbackIncidenceTrend?.status
  );
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
  assert.equal(sessions.body.activePluginId, pluginId);
  assert.equal(sessions.body.primarySession?.pluginId, pluginId);
  assert.equal(sessions.body.sessions[0].pluginId, pluginId);
  assert.equal(sessions.body.sessions[0].selectionCount, 2);
  assert.equal(sessions.body.sessions[0].active, true);

  await sleep(450);

  const staleSessions = await getJson(bridge.origin, "/api/sessions?includeStale=true");
  assert.equal(staleSessions.status, 200);
  assert.equal(staleSessions.body.sessions.length, 1);
  assert.equal(staleSessions.body.activePluginId, null);
  assert.equal(staleSessions.body.primarySession, null);
  assert.equal(staleSessions.body.sessions[0].pluginId, pluginId);
  assert.equal(staleSessions.body.sessions[0].active, false);

  const staleHealth = await getJson(bridge.origin, "/health");
  assert.equal(staleHealth.status, 200);
  assert.equal(staleHealth.body.activePlugins.includes(pluginId), false);
  assert.equal(staleHealth.body.activePluginId, null);
  assert.equal(staleHealth.body.activeSession, null);

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
  assert.equal(refreshedSessions.body.activePluginId, pluginId);
  assert.equal(refreshedSessions.body.primarySession?.pluginId, pluginId);
  assert.equal(refreshedSessions.body.sessions[0].pluginId, pluginId);
  assert.equal(refreshedSessions.body.sessions[0].active, true);

  await sleep(1000);
  const prunedSessions = await getJson(bridge.origin, "/api/sessions?includeStale=true");
  assert.equal(prunedSessions.status, 200);
  assert.equal(prunedSessions.body.activePluginId, null);
  assert.equal(prunedSessions.body.primarySession, null);
  assert.deepEqual(prunedSessions.body.sessions, []);
});

test("session APIs identify the primary live session when stale sessions are also tracked", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 250,
    sessionRetentionMs: 2_000,
    sessionPruneIntervalMs: 40
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const stalePluginId = "page:session-old";
  const livePluginId = "page:session-live";

  await postJson(bridge.origin, "/plugin/register", {
    pluginId: stalePluginId,
    fileName: "Archive File",
    pageName: "Archive"
  });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId: stalePluginId });

  await sleep(320);

  await postJson(bridge.origin, "/plugin/register", {
    pluginId: livePluginId,
    fileName: "Live File",
    pageName: "Overview"
  });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId: livePluginId });

  const sessions = await getJson(bridge.origin, "/api/sessions?includeStale=true");
  assert.equal(sessions.status, 200);
  assert.equal(sessions.body.activePluginId, livePluginId);
  assert.equal(sessions.body.primarySession?.pluginId, livePluginId);
  assert.equal(sessions.body.sessions.length, 2);
  assert.equal(sessions.body.sessions[0].pluginId, livePluginId);
  assert.equal(sessions.body.sessions[0].state, "live");
  assert.equal(sessions.body.sessions[1].pluginId, stalePluginId);
  assert.equal(sessions.body.sessions[1].state, "stale");

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.deepEqual(health.body.activePlugins, [livePluginId]);
  assert.equal(health.body.activePluginId, livePluginId);
  assert.equal(health.body.activeSession?.pluginId, livePluginId);

  const runtimeOps = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeOps.status, 200);
  assert.equal(runtimeOps.body.result.activePluginId, livePluginId);
  assert.equal(runtimeOps.body.result.sessions.primarySession?.pluginId, livePluginId);
  assert.equal(runtimeOps.body.result.sessions.summary.live, 1);
  assert.equal(runtimeOps.body.result.sessions.summary.stale, 1);
  assert.equal(runtimeOps.body.result.sessions.staleSessions[0].pluginId, stalePluginId);
});

test("stale default session does not override a newer live session", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 220,
    sessionRetentionMs: 2_000,
    sessionPruneIntervalMs: 40
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  await postJson(bridge.origin, "/plugin/register", { pluginId: "default" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId: "default" });
  await sleep(280);

  const livePluginId = "page:live-after-default";
  await postJson(bridge.origin, "/plugin/register", { pluginId: livePluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId: livePluginId });

  const sessions = await getJson(bridge.origin, "/api/sessions?includeStale=true");
  assert.equal(sessions.status, 200);
  assert.equal(sessions.body.activePluginId, livePluginId);
  assert.equal(sessions.body.primarySession?.pluginId, livePluginId);
  assert.equal(sessions.body.activeSessionResolution?.status, "single");
  assert.equal(sessions.body.activeSessionResolution?.reason, "single_live_session");
  assert.equal(sessions.body.sessions[0].pluginId, livePluginId);
  assert.equal(sessions.body.sessions[1].pluginId, "default");
  assert.equal(sessions.body.sessions[1].state, "stale");

  const pendingDefaultRoute = postJson(bridge.origin, "/api/get-selection", {
    pluginId: "default"
  });
  const polled = await waitForPluginCommands(bridge.origin, livePluginId);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "get_selection");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: null,
    result: {
      selection: [{ id: "10:1", name: "Live Node" }]
    }
  });

  const response = await pendingDefaultRoute;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.result.selection[0].id, "10:1");
});

test("multiple live sessions expose active-session ambiguity and require explicit pluginId", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 800,
    sessionRetentionMs: 4_000,
    sessionPruneIntervalMs: 60
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const firstPluginId = "page:ambiguous-a";
  const secondPluginId = "page:ambiguous-b";

  await postJson(bridge.origin, "/plugin/register", { pluginId: firstPluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId: firstPluginId });
  await sleep(50);
  await postJson(bridge.origin, "/plugin/register", { pluginId: secondPluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId: secondPluginId });

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.activeSessionResolution?.status, "ambiguous");
  assert.equal(health.body.activeSessionResolution?.reason, "multiple_live_sessions");
  assert.equal(health.body.activeSessionResolution?.requiresExplicitPluginId, true);
  assert.deepEqual(
    [...(health.body.activeSessionResolution?.livePluginIds || [])].sort(),
    [firstPluginId, secondPluginId].sort()
  );

  const runtimeOps = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeOps.status, 200);
  assert.equal(runtimeOps.body.result.activeSessionResolution?.status, "ambiguous");
  assert.equal(
    runtimeOps.body.result.sessions.activeSessionResolution?.status,
    "ambiguous"
  );

  const sessions = await getJson(bridge.origin, "/api/sessions?includeStale=true");
  assert.equal(sessions.status, 200);
  assert.equal(sessions.body.activeSessionResolution?.status, "ambiguous");
  assert.equal(sessions.body.primarySession?.pluginId, secondPluginId);

  const ambiguous = await postJson(bridge.origin, "/api/get-selection", {
    pluginId: "default"
  });
  assert.equal(ambiguous.status, 409);
  assert.equal(ambiguous.body.code, "ERR_PLUGIN_SESSION_AMBIGUOUS");
  assert.equal(ambiguous.body.details?.suggestedPluginId, secondPluginId);
  assert.deepEqual(
    [...(ambiguous.body.details?.activePluginIds || [])].sort(),
    [firstPluginId, secondPluginId].sort()
  );
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

test("plugin heartbeat ui metrics are exposed via session and runtime ops snapshots", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 200,
    sessionRetentionMs: 700
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:metrics";
  const uiMetrics = {
    generatedAt: "2026-04-14T00:00:00.000Z",
    polls: 11,
    commandFetches: 5,
    pollDrivenReads: {
      runtime: 2,
      detail: 1
    },
    eventDrivenReads: {
      sessions: 3,
      runtime: 4,
      detail: 2
    },
    transport: {
      bridgeConnected: true,
      eventsConnected: true,
      wsCommandConnected: false
    }
  };

  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    fileName: "Metrics File",
    pageName: "Metrics Page",
    pageId: "metrics:1"
  });
  assert.equal(register.status, 200);

  const heartbeat = await postJson(bridge.origin, "/plugin/heartbeat", {
    pluginId,
    uiMetrics
  });
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.body.ok, true);

  const sessions = await getJson(bridge.origin, "/api/sessions?includeStale=true");
  assert.equal(sessions.status, 200);
  const sessionSnapshot = sessions.body.sessions.find((entry) => entry.pluginId === pluginId);
  assert.ok(sessionSnapshot);
  assert.deepEqual(sessionSnapshot.uiMetrics, uiMetrics);

  const runtimeOps = await getJson(bridge.origin, "/api/runtime-ops?staleLimit=5");
  assert.equal(runtimeOps.status, 200);
  assert.equal(runtimeOps.body.ok, true);
  const runtimeMetrics = runtimeOps.body.result.pluginUiMetrics.find(
    (entry) => entry.pluginId === pluginId
  );
  assert.ok(runtimeMetrics);
  assert.equal(runtimeMetrics.state, "live");
  assert.deepEqual(runtimeMetrics.uiMetrics, uiMetrics);
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

test("adaptive timeout keeps read-heavy metadata/pages/detail commands alive beyond base timeout", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 600
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:adaptive-timeout";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const graceDelayMs = 1000;

  const pendingMetadata = postJson(bridge.origin, "/api/get-metadata", {
    pluginId,
    targetNodeId: "10:1"
  });

  await sleep(graceDelayMs);

  const polledMetadata = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polledMetadata.body.commands.length, 1);
  assert.equal(polledMetadata.body.commands[0].type, "get_metadata");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polledMetadata.body.commands[0].commandId,
    error: null,
    result: {
      name: "Target Node",
      xml: "<selection><frame id=\"10:1\" name=\"Target Node\" /></selection>"
    }
  });

  const metadataResponse = await pendingMetadata;
  assert.equal(metadataResponse.status, 200);
  assert.equal(metadataResponse.body.ok, true);
  assert.equal(metadataResponse.body.result.name, "Target Node");

  const pendingPagesResponse = fetch(
    `${bridge.origin}/api/pages?pluginId=${encodeURIComponent(pluginId)}`
  ).then(async (response) => ({
    status: response.status,
    body: await response.json()
  }));

  await sleep(graceDelayMs);

  const polledPages = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polledPages.body.commands.length, 1);
  assert.equal(polledPages.body.commands[0].type, "list_pages");

  const expectedPages = {
    pages: [{ id: "10:0", name: "Overview" }]
  };
  await postJson(bridge.origin, "/plugin/results", {
    commandId: polledPages.body.commands[0].commandId,
    error: null,
    result: expectedPages
  });

  const pagesResponse = await pendingPagesResponse;
  assert.equal(pagesResponse.status, 200);
  assert.equal(pagesResponse.body.ok, true);
  assert.deepEqual(pagesResponse.body.result, expectedPages);

  const pendingDetails = postJson(bridge.origin, "/api/get-node-details", {
    pluginId,
    targetNodeId: "10:1",
    detailLevel: "layout"
  });

  await sleep(graceDelayMs);

  const polledDetails = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polledDetails.body.commands.length, 1);
  assert.equal(polledDetails.body.commands[0].type, "get_node_details");

  const expectedDetail = {
    pluginId,
    node: {
      id: "10:1",
      name: "Target Node",
      type: "FRAME"
    },
    detailLevel: "layout",
    includeChildren: false
  };
  await postJson(bridge.origin, "/plugin/results", {
    commandId: polledDetails.body.commands[0].commandId,
    error: null,
    result: expectedDetail
  });

  const detailResponse = await pendingDetails;
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.body.ok, true);
  assert.equal(detailResponse.body.result.node.id, "10:1");
});

test("adaptive timeout keeps bind-variable writes alive beyond base timeout", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 900
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:adaptive-write-timeout";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingWrite = postJson(bridge.origin, "/api/bind-variable", {
    pluginId,
    nodeId: "10:1",
    property: "width",
    variableId: "VariableID:1:2"
  });

  await sleep(950);

  const polledWrite = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polledWrite.body.commands.length, 1);
  assert.equal(polledWrite.body.commands[0].type, "bind_variable");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polledWrite.body.commands[0].commandId,
    error: null,
    result: {
      bound: {
        node: { id: "10:1", name: "Box", type: "FRAME" },
        property: "width",
        action: "bound",
        variable: { id: "VariableID:1:2", name: "Width / Md" },
        previousVariableId: null
      }
    }
  });

  const writeResponse = await pendingWrite;
  assert.equal(writeResponse.status, 200);
  assert.equal(writeResponse.body.ok, true);
  assert.equal(writeResponse.body.result.bound.action, "bound");
});

test("concurrent bind-variable requests coalesce into a single bulk write command", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:coalesced-bind-write";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const firstPendingWrite = postJson(bridge.origin, "/api/bind-variable", {
    pluginId,
    nodeId: "10:1",
    property: "width",
    variableId: "VariableID:1:2"
  });
  const secondPendingWrite = postJson(bridge.origin, "/api/bind-variable", {
    pluginId,
    nodeId: "10:2",
    property: "height",
    variableId: "VariableID:1:3"
  });

  const polledWrite = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polledWrite.body.commands.length, 1);
  assert.equal(polledWrite.body.commands[0].type, "bulk_bind_variables");
  assert.equal(polledWrite.body.commands[0].payload.bindings.length, 2);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polledWrite.body.commands[0].commandId,
    error: null,
    result: {
      bound: [
        {
          node: { id: "10:1", name: "Card Width", type: "FRAME" },
          property: "width",
          action: "bound",
          variable: { id: "VariableID:1:2", name: "Width / Md" },
          previousVariableId: null
        },
        {
          node: { id: "10:2", name: "Card Height", type: "FRAME" },
          property: "height",
          action: "bound",
          variable: { id: "VariableID:1:3", name: "Height / Lg" },
          previousVariableId: null
        }
      ],
      summary: {
        total: 2
      }
    }
  });

  const firstWriteResponse = await firstPendingWrite;
  const secondWriteResponse = await secondPendingWrite;
  assert.equal(firstWriteResponse.status, 200);
  assert.equal(secondWriteResponse.status, 200);
  assert.equal(firstWriteResponse.body.result.bound.node.id, "10:1");
  assert.equal(secondWriteResponse.body.result.bound.node.id, "10:2");
  assert.equal(firstWriteResponse.body.result.coalesced.type, "bulk_bind_variables");
  assert.equal(secondWriteResponse.body.result.coalesced.total, 2);

  const runtime = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtime.status, 200);
  assert.equal(runtime.body.result.queue.writeCoalescing.batchTotal, 1);
  assert.equal(runtime.body.result.queue.writeCoalescing.requestTotal, 2);
  assert.equal(runtime.body.result.queue.writeCoalescing.savedCommandTotal, 1);
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

test("health and runtime ops distinguish recent failures from historical totals", async (t) => {
  const bridge = await startBridgeServer({
    recentFailureWindowMs: 120
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:failure-observability";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingApi = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: "Synthetic failure for observability",
    result: null
  });
  const failedResponse = await pendingApi;
  assert.equal(failedResponse.status, 400);
  assert.equal(failedResponse.body.ok, false);

  const healthAfterFailure = await getJson(bridge.origin, "/health");
  assert.equal(healthAfterFailure.status, 200);
  assert.equal(healthAfterFailure.body.currentReadHealth, "degraded");
  assert.equal(healthAfterFailure.body.commandReadiness.status, "degraded");
  assert.equal(healthAfterFailure.body.commandReadiness.reason, "recent_command_failures");
  assert.equal(healthAfterFailure.body.recentFailedTotal, 1);
  assert.equal(healthAfterFailure.body.lastFailureCommand?.type, "get_selection");
  assert.equal(healthAfterFailure.body.lastFailureCommand?.lifecycle?.status, "failed");
  assert.equal(healthAfterFailure.body.lastFailureCommand?.lifecycle?.failureCode, "ERR_COMMAND_FAILED");
  assert.equal(
    healthAfterFailure.body.observability?.queue?.historicalFailedTotal >= 1,
    true
  );

  const runtimeAfterFailure = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeAfterFailure.status, 200);
  assert.equal(runtimeAfterFailure.body.result.currentReadHealth, "degraded");
  assert.equal(runtimeAfterFailure.body.result.commandReadiness.status, "degraded");
  assert.equal(runtimeAfterFailure.body.result.failures.recentFailedTotal, 1);
  assert.equal(Array.isArray(runtimeAfterFailure.body.result.queue.lifecycleTail), true);
  assert.equal(runtimeAfterFailure.body.result.queue.lifecycleTail[0]?.status, "failed");
  assert.equal(runtimeAfterFailure.body.result.queue.lifecycleTail[0]?.type, "get_selection");
  assert.equal(Array.isArray(runtimeAfterFailure.body.result.queue.commandTimelineTail), true);
  assert.equal(
    runtimeAfterFailure.body.result.commandReadiness.timingBottleneckCommandType === null ||
      typeof runtimeAfterFailure.body.result.commandReadiness.timingBottleneckCommandType ===
        "string",
    true
  );
  assert.equal(
    typeof runtimeAfterFailure.body.result.commandReadiness.timingLagThresholdSource,
    "string"
  );
  assert.equal(
    runtimeAfterFailure.body.result.queue.lifecycleSummary?.statusCounts?.failed >= 1,
    true
  );
  assert.equal(
    typeof runtimeAfterFailure.body.result.queue.lifecycleSummary?.timing?.avgEnqueueToCompleteMs,
    "number"
  );
  assert.equal(
    runtimeAfterFailure.body.result.failures.historicalFailedTotal >= 1,
    true
  );
  assert.equal(
    runtimeAfterFailure.body.result.failures.lastFailureCommand?.type,
    "get_selection"
  );

  await sleep(180);

  const runtimeAfterWindow = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeAfterWindow.status, 200);
  assert.equal(runtimeAfterWindow.body.result.failures.recentFailedTotal, 0);
  assert.equal(runtimeAfterWindow.body.result.currentReadHealth, "healthy");
  assert.equal(runtimeAfterWindow.body.result.commandReadiness.status, "ready");
  assert.equal(
    runtimeAfterWindow.body.result.failures.historicalFailedTotal >= 1,
    true
  );
});

test("healthy live session ignores lingering stale-session recovery debt", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 200,
    sessionRetentionMs: 2_000,
    sessionPruneIntervalMs: 40
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  await postJson(bridge.origin, "/plugin/register", { pluginId: "default" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId: "default" });
  await sleep(260);

  const staleFailure = await postJson(bridge.origin, "/api/get-selection", {
    pluginId: "default"
  });
  assert.equal(staleFailure.status, 409);
  assert.equal(staleFailure.body.code, "ERR_PLUGIN_SESSION_STALE");

  const livePluginId = "page:healthy-live";
  await postJson(bridge.origin, "/plugin/register", { pluginId: livePluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId: livePluginId });

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.activePluginId, livePluginId);
  assert.equal(health.body.commandReadiness.status, "ready");
  assert.equal(health.body.commandReadiness.pendingRecoveryTotal, 0);
  assert.equal(health.body.commandReadiness.ignoredRecoveryTotal >= 1, true);

  const runtimeOps = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeOps.status, 200);
  assert.equal(runtimeOps.body.result.activePluginId, livePluginId);
  assert.equal(runtimeOps.body.result.commandReadiness.status, "ready");
  assert.equal(runtimeOps.body.result.commandReadiness.pendingRecoveryTotal, 0);
  assert.equal(runtimeOps.body.result.commandReadiness.ignoredRecoveryTotal >= 1, true);
  assert.equal(runtimeOps.body.result.sessions.pendingRecovery[0]?.pluginId, "default");
});

test("transport health returns standby when no live plugin session remains", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 200,
    sessionRetentionMs: 2_000,
    sessionPruneIntervalMs: 40,
    toolTimeoutMs: 1_400
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:transport-standby-without-live-session";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingApi = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "get_selection");

  await sleep(260);

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.activePlugins.length, 0);
  assert.equal(health.body.transportHealth.grade, "standby");
  assert.equal(health.body.commandReadiness.reason, "no_active_plugin");
  assert.equal(health.body.transportHealth.recent.recentFallbackTotal >= 1, true);

  const runtime = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtime.status, 200);
  assert.equal(runtime.body.result.activePlugins.length, 0);
  assert.equal(runtime.body.result.transportHealth.grade, "standby");

  const expiredResponse = await pendingApi;
  assert.equal(expiredResponse.status === 400 || expiredResponse.status === 504, true);
});

test("transport health does not mark polling-only live sessions unhealthy", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 2_000,
    sessionRetentionMs: 4_000,
    sessionPruneIntervalMs: 40,
    toolTimeoutMs: 1_400
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const sseAbort = new AbortController();
  const sseResponse = await fetch(`${bridge.origin}/api/events`, {
    signal: sseAbort.signal
  });
  assert.equal(sseResponse.status, 200);
  t.after(() => {
    sseAbort.abort();
  });

  const pluginId = "page:transport-polling-only-live";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingApi = postJson(bridge.origin, "/api/get-selection", { pluginId });
  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "get_selection");

  const healthDuringPolling = await getJson(bridge.origin, "/health");
  assert.equal(healthDuringPolling.status, 200);
  assert.equal(healthDuringPolling.body.activePlugins.includes(pluginId), true);
  assert.equal(healthDuringPolling.body.transportHealth.activeClients.sse >= 1, true);
  assert.equal(healthDuringPolling.body.transportHealth.activeClients.ws, 0);
  assert.notEqual(healthDuringPolling.body.transportHealth.grade, "unhealthy");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: null,
    result: { selection: [] }
  });
  const response = await pendingApi;
  assert.equal(response.status, 200);
});

test("command readiness degrades before expiry when queue backlog ages too long", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 2400
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:readiness-backlog";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingApi = postJson(bridge.origin, "/api/get-selection", { pluginId });

  await sleep(1550);

  const healthDuringBacklog = await getJson(bridge.origin, "/health");
  assert.equal(healthDuringBacklog.status, 200);
  assert.equal(healthDuringBacklog.body.commandReadiness.status, "degraded");
  assert.equal(healthDuringBacklog.body.commandReadiness.reason, "queue_backlog_risk");
  assert.equal(healthDuringBacklog.body.commandReadiness.oldestUndeliveredMs >= 1500, true);

  const runtimeDuringBacklog = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeDuringBacklog.status, 200);
  assert.equal(runtimeDuringBacklog.body.result.commandReadiness.status, "degraded");
  assert.equal(runtimeDuringBacklog.body.result.commandReadiness.reason, "queue_backlog_risk");
  assert.equal(runtimeDuringBacklog.body.result.queue.pendingTotal, 1);

  const expiredResponse = await pendingApi;
  assert.equal(expiredResponse.status === 400 || expiredResponse.status === 504, true);
  assert.equal(expiredResponse.body.ok, false);
  assert.equal(
    expiredResponse.body.code === "ERR_COMMAND_EXPIRED" ||
      String(expiredResponse.body.error || "").includes("Timed out waiting for plugin response"),
    true
  );

  const runtimeAfterExpiry = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeAfterExpiry.status, 200);
  const lifecycleExpiredSummary = runtimeAfterExpiry.body.result.queue.lifecycleSummary?.expired;
  assert.equal(typeof lifecycleExpiredSummary?.total, "number");
  if ((lifecycleExpiredSummary?.total || 0) > 0) {
    assert.equal(lifecycleExpiredSummary?.last?.type, "get_selection");
    assert.equal(lifecycleExpiredSummary?.last?.failureCode, "ERR_COMMAND_EXPIRED");
  }
});

test("command readiness degrades when undelivered queue nears its timeout budget", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 1400
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:readiness-expiry-risk";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingApi = postJson(bridge.origin, "/api/get-selection", { pluginId });

  await sleep(2100);

  const healthDuringRisk = await getJson(bridge.origin, "/health");
  assert.equal(healthDuringRisk.status, 200);
  assert.equal(healthDuringRisk.body.commandReadiness.status, "degraded");
  assert.equal(healthDuringRisk.body.commandReadiness.reason, "queue_expiry_risk");
  assert.equal(healthDuringRisk.body.commandReadiness.maxUndeliveredTimeoutRatio >= 0.7, true);
  assert.equal(
    healthDuringRisk.body.commandReadiness.minUndeliveredTimeRemainingMs < 500,
    true
  );

  const runtimeDuringRisk = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeDuringRisk.status, 200);
  assert.equal(runtimeDuringRisk.body.result.commandReadiness.status, "degraded");
  assert.equal(runtimeDuringRisk.body.result.commandReadiness.reason, "queue_expiry_risk");
  assert.equal(runtimeDuringRisk.body.result.queue.pendingTotal, 1);
  assert.equal(runtimeDuringRisk.body.result.queue.nearTimeoutRatio, 0.65);

  const expiredResponse = await pendingApi;
  assert.equal(expiredResponse.status === 400 || expiredResponse.status === 504, true);
  assert.equal(expiredResponse.body.ok, false);
  assert.equal(
    expiredResponse.body.code === "ERR_COMMAND_EXPIRED" ||
      String(expiredResponse.body.error || "").includes("Timed out waiting for plugin response"),
    true
  );
});

test("command readiness stays ready while websocket ack grace is actively protecting the queue", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 1500,
    wsPluginPickupAckTimeoutMs: 700,
    wsPluginResumeAckGraceMs: 700,
    wsPollingFallbackGraceMs: 180
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:readiness-ws-ack-grace";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const wsConnection = await connectWebSocket(
    `${toWsOrigin(bridge.origin)}/api/ws?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`
  );
  if (!wsConnection.supported) {
    t.skip(`WebSocket channel unavailable: ${wsConnection.reason}`);
    return;
  }
  const socket = wsConnection.socket;
  t.after(() => {
    socket.close();
  });
  const collector = collectWebSocketMessages(socket);

  const firstPending = postJson(bridge.origin, "/api/get-selection", { pluginId });
  await waitForCondition(
    () =>
      collector.messages.some(
        (message) =>
          (message?.event || message?.type) === "plugin.command" &&
          message?.payload?.command?.pluginId === pluginId
      ),
    1400
  );
  const firstCommandEnvelope = collector.messages.find(
    (message) =>
      (message?.event || message?.type) === "plugin.command" &&
      message?.payload?.command?.pluginId === pluginId
  );
  const firstCommandId = firstCommandEnvelope?.payload?.command?.commandId;
  assert.equal(typeof firstCommandId, "string");

  await sleep(380);
  socket.send(
    JSON.stringify({
      type: "ws.plugin.command.ack",
      pluginId,
      commandId: firstCommandId
    })
  );
  await waitForCondition(
    () =>
      collector.messages.some(
        (message) =>
          (message?.event || message?.type) === "ws.plugin.command.ack" &&
          message?.payload?.commandId === firstCommandId
      ),
    1400
  );
  socket.send(
    JSON.stringify({
      type: "ws.plugin.command.result",
      pluginId,
      commandId: firstCommandId,
      result: { selection: [] },
      error: null
    })
  );

  const firstResponse = await firstPending;
  assert.equal(firstResponse.status, 200);
  assert.equal(firstResponse.body.ok, true);

  const seenMessages = collector.messages.length;
  const secondPending = postJson(bridge.origin, "/api/get-selection", { pluginId });
  await waitForCondition(
    () =>
      collector.messages
        .slice(seenMessages)
        .some(
          (message) =>
            (message?.event || message?.type) === "plugin.command" &&
            message?.payload?.command?.pluginId === pluginId
        ),
    1400
  );

  const healthDuringGrace = await getJson(bridge.origin, "/health");
  assert.equal(healthDuringGrace.status, 200);
  assert.equal(healthDuringGrace.body.commandReadiness.status, "ready");
  assert.equal(healthDuringGrace.body.commandReadiness.reason, "ready_ws_ack_grace");
  assert.equal(healthDuringGrace.body.commandReadiness.awaitingWsAckTotal, 1);
  assert.equal(healthDuringGrace.body.commandReadiness.onlyGuardedUndeliveredPending, true);
  assert.equal(healthDuringGrace.body.commandReadiness.withinGuardedWsWindow, true);

  const runtimeDuringGrace = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeDuringGrace.status, 200);
  assert.equal(runtimeDuringGrace.body.result.commandReadiness.status, "ready");
  assert.equal(runtimeDuringGrace.body.result.commandReadiness.reason, "ready_ws_ack_grace");

  const secondCommandEnvelope = collector.messages
    .slice(seenMessages)
    .find(
      (message) =>
        (message?.event || message?.type) === "plugin.command" &&
        message?.payload?.command?.pluginId === pluginId
    );
  const secondCommandId = secondCommandEnvelope?.payload?.command?.commandId;
  assert.equal(typeof secondCommandId, "string");

  socket.send(
    JSON.stringify({
      type: "ws.plugin.command.result",
      pluginId,
      commandId: secondCommandId,
      result: { selection: [] },
      error: null
    })
  );

  const secondResponse = await secondPending;
  assert.equal(secondResponse.status, 200);
  assert.equal(secondResponse.body.ok, true);
});

test("write readiness reports pending write backlog and expiry risk separately from read readiness", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 1400
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:write-readiness";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingApi = postJson(bridge.origin, "/api/bind-variable", {
    pluginId,
    nodeId: "10:1",
    property: "width",
    variableId: "VariableID:1:2"
  });

  await sleep(1950);

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.writeReadiness.status, "degraded");
  assert.equal(health.body.writeReadiness.reason, "write_queue_expiry_risk");
  assert.equal(health.body.writeReadiness.pendingWriteCount, 1);
  assert.equal(health.body.writeReadiness.oldestPendingWriteMs >= 1800, true);
  assert.equal(
    health.body.writeReadiness.maxUndeliveredWriteTimeoutRatio >=
      health.body.writeReadiness.nearTimeoutRatio,
    true
  );

  const runtime = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtime.status, 200);
  assert.equal(runtime.body.result.writeReadiness.status, "degraded");
  assert.equal(runtime.body.result.queue.writes.pendingTotal, 1);
  assert.equal(runtime.body.result.queue.writes.byType.bind_variable, 1);

  const expiredResponse = await pendingApi;
  assert.equal(expiredResponse.status === 400 || expiredResponse.status === 504, true);

  const runtimeAfterExpiry = await getJson(bridge.origin, "/api/runtime-ops");
  assert.equal(runtimeAfterExpiry.status, 200);
  assert.equal(
    runtimeAfterExpiry.body.result.writeReadiness.reason === "recent_write_expired" ||
      runtimeAfterExpiry.body.result.writeReadiness.reason === "write_queue_expiry_risk",
    true
  );
});

test("bulk bind variables endpoint enqueues a single batched mutation command", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:bulk-bind";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/bulk-bind-variables", {
    pluginId,
    bindings: [
      {
        nodeId: "10:1",
        property: "width",
        variableId: "VariableID:1:2"
      },
      {
        nodeId: "10:2",
        property: "fills.color",
        variableKey: "VariableKey:abc"
      }
    ]
  });

  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "bulk_bind_variables");
  assert.equal(polled.body.commands[0].payload.bindings.length, 2);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    result: {
      bound: [
        { node: { id: "10:1" }, property: "width", action: "bound" },
        { node: { id: "10:2" }, property: "fills.color", action: "bound" }
      ],
      summary: {
        total: 2
      }
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.result.summary.total, 2);
});

test("designer chat fast-path rewrites selected text via list_text_nodes and bulk_update_texts", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-text";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트 내용을 커피동호회에 맞게 변경해줘",
    figmaContext: {
      fileName: "FASOO CLUB",
      pageId: "1:1",
      pageName: "Home",
      selection: [{ id: "10:1", name: "Feed Card", type: "FRAME" }]
    }
  });

  const listTexts = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(listTexts.body.commands.length, 1);
  assert.equal(listTexts.body.commands[0].type, "list_text_nodes");
  assert.equal(listTexts.body.commands[0].payload.targetNodeId, "10:1");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: listTexts.body.commands[0].commandId,
    result: {
      root: { id: "10:1", name: "Feed Card", type: "FRAME" },
      textNodes: [
        { id: "20:1", name: "title", characters: "원래 제목" },
        { id: "20:2", name: "body", characters: "원래 본문" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");
  assert.equal(Array.isArray(bulkUpdate.body.commands[0].payload.updates), true);
  assert.equal(bulkUpdate.body.commands[0].payload.updates.length, 2);
  assert.deepEqual(
    bulkUpdate.body.commands[0].payload.updates.map((item) => item.nodeId),
    ["20:1", "20:2"]
  );

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: [
        { id: "20:1", name: "title", characters: "커피동호회 5월 정기모임 안내" },
        { id: "20:2", name: "body", characters: "이번 주 카페 투어 번개 참석 가능하신 분 모집합니다." }
      ]
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite");
  assert.equal(response.body.fastPath?.topicLabel, "커피동호회");
  assert.equal(response.body.execution?.ok, true);
  assert.equal(response.body.execution?.summary?.commandCount, 2);
  assert.equal(response.body.ai?.status, "completed");
});

test("designer chat fast-path skips text-node read when the selection already contains text nodes", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-direct-text";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트를 커피동호회 내용에 맞게 변경해줘",
    figmaContext: {
      fileName: "FASOO CLUB",
      pageId: "1:1",
      pageName: "Home",
      selection: [
        { id: "20:1", name: "title", type: "TEXT" },
        { id: "20:2", name: "body", type: "TEXT" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");
  assert.equal(Array.isArray(bulkUpdate.body.commands[0].payload.updates), true);
  assert.equal(bulkUpdate.body.commands[0].payload.updates.length, 2);
  assert.deepEqual(
    bulkUpdate.body.commands[0].payload.updates.map((item) => item.nodeId),
    ["20:1", "20:2"]
  );

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: [
        { id: "20:1", name: "title", characters: "커피동호회 5월 정기모임 안내" },
        { id: "20:2", name: "body", characters: "이번 주 카페 투어 번개 참석 가능하신 분 모집합니다." }
      ]
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite");
  assert.equal(response.body.fastPath?.topicLabel, "커피동호회");
  assert.equal(response.body.execution?.ok, true);
  assert.equal(response.body.execution?.summary?.commandCount, 1);
  assert.equal(response.body.ai?.status, "completed");
});

test("designer chat fast-path also matches spaced club labels like 농구 동호회", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:designer-fast-spaced-club";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    request: "선택한 텍스트 내용을 농구 동호회 내용에 맞게 변경해줘",
    figmaContext: {
      fileName: "FASOO CLUB",
      pageId: "1:1",
      pageName: "Home",
      selection: [
        { id: "20:1", name: "title", type: "TEXT" },
        { id: "20:2", name: "body", type: "TEXT" }
      ]
    }
  });

  const bulkUpdate = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(bulkUpdate.body.commands.length, 1);
  assert.equal(bulkUpdate.body.commands[0].type, "bulk_update_texts");
  assert.equal(Array.isArray(bulkUpdate.body.commands[0].payload.updates), true);
  assert.equal(bulkUpdate.body.commands[0].payload.updates.length, 2);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: bulkUpdate.body.commands[0].commandId,
    result: {
      updated: [
        { id: "20:1", name: "title", characters: "농구 동호회 5월 정기모임 안내" },
        { id: "20:2", name: "body", characters: "이번 주 농구 모임 참석 가능하신 분 모집합니다." }
      ]
    }
  });

  const response = await request;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.fastPath?.type, "selection_text_rewrite");
  assert.equal(response.body.fastPath?.topicLabel, "농구 동호회");
  assert.equal(response.body.execution?.summary?.commandCount, 1);
  assert.equal(response.body.ai?.status, "completed");
});

test("annotation read endpoint returns normalized node-scoped response shape", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 800,
    sessionRetentionMs: 4000
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:annotations-read";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const readRequest = postJson(bridge.origin, "/api/get-annotations", {
    pluginId,
    targetNodeId: "10:1"
  });

  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "get_annotations");
  assert.equal(polled.body.commands[0].payload.targetNodeId, "10:1");
  assert.equal(polled.body.commands[0].payload.includeInferredComments, true);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    result: {
      source: "explicit",
      node: {
        id: "10:1",
        name: "Card",
        type: "FRAME"
      },
      annotations: [
        {
          label: "Use semantic spacing",
          properties: [{ type: "padding" }]
        }
      ]
    },
    error: null
  });

  const response = await readRequest;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.result.source, "explicit");
  assert.equal(response.body.result.targetNodeId, "10:1");
  assert.equal(response.body.result.node.id, "10:1");
  assert.equal(response.body.result.count.annotations, 1);
  assert.equal(response.body.result.count.comments, 1);
  assert.equal(response.body.result.annotations[0].source, "explicit");
  assert.equal(response.body.result.comments[0].source, "inferred");
  assert.equal(response.body.result.comments[0].text, "Use semantic spacing");

  const readNoComments = postJson(bridge.origin, "/api/get-annotations", {
    pluginId,
    targetNodeId: "10:1",
    includeInferredComments: false
  });
  const polledNoComments = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polledNoComments.body.commands.length, 1);
  assert.equal(polledNoComments.body.commands[0].payload.includeInferredComments, false);

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polledNoComments.body.commands[0].commandId,
    result: {
      source: "explicit",
      node: {
        id: "10:1",
        name: "Card",
        type: "FRAME"
      },
      annotations: [{ labelMarkdown: "**Spacing**" }]
    },
    error: null
  });

  const noCommentsResponse = await readNoComments;
  assert.equal(noCommentsResponse.status, 200);
  assert.equal(noCommentsResponse.body.ok, true);
  assert.equal(noCommentsResponse.body.result.count.annotations, 1);
  assert.equal(noCommentsResponse.body.result.count.comments, 0);
  assert.deepEqual(noCommentsResponse.body.result.comments, []);
});

test("search-nodes preserves explicit session preflight ERR_* codes", async (t) => {
  const bridge = await startBridgeServer({
    sessionActiveWindowMs: 200,
    sessionRetentionMs: 700
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:search-stale";
  const register = await postJson(bridge.origin, "/plugin/register", {
    pluginId,
    pageId: "search-stale"
  });
  assert.equal(register.status, 200);

  const offline = await postJson(bridge.origin, "/api/search-nodes", {
    pluginId: "page:search-offline",
    query: "hero"
  });
  assert.equal(offline.status, 404);
  assert.equal(offline.body.ok, false);
  assert.equal(offline.body.code, "ERR_PLUGIN_SESSION_OFFLINE");

  const stale = await postJson(bridge.origin, "/api/search-nodes", {
    pluginId,
    query: "hero"
  });
  assert.equal(stale.status, 409);
  assert.equal(stale.body.ok, false);
  assert.equal(stale.body.code, "ERR_PLUGIN_SESSION_REGISTERED");
});

test("search-nodes maps missing selection to ERR_SELECTION_REQUIRED", async (t) => {
  const bridge = await startBridgeServer({
    searchNodesRetryMaxAttempts: 1
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:search-selection-required";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingApi = postJson(bridge.origin, "/api/search-nodes", {
    pluginId,
    query: "hero"
  });

  const polled = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(polled.body.commands.length, 1);
  assert.equal(polled.body.commands[0].type, "search_nodes");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: polled.body.commands[0].commandId,
    error: "No selection available",
    result: null
  });

  const response = await pendingApi;
  assert.equal(response.status, 409);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "ERR_SELECTION_REQUIRED");
});

test("search-nodes timeout maps to ERR_SEARCH_NODES_TIMEOUT with HTTP 504", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 80,
    searchNodesRetryMaxAttempts: 1
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:search-timeout";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const response = await postJson(bridge.origin, "/api/search-nodes", {
    pluginId,
    query: "hero"
  });
  assert.equal(response.status, 504);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "ERR_SEARCH_NODES_TIMEOUT");
});

test("search-nodes retries transient delivery failures with bounded backoff", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 300,
    searchNodesRetryMaxAttempts: 2,
    searchNodesRetryBaseDelayMs: 20,
    searchNodesRetryMaxDelayMs: 40
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:search-retry";
  await postJson(bridge.origin, "/plugin/register", { pluginId });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const pendingApi = postJson(bridge.origin, "/api/search-nodes", {
    pluginId,
    query: "hero"
  });

  const firstPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(firstPoll.body.commands.length, 1);
  const firstCommandId = firstPoll.body.commands[0].commandId;

  await postJson(bridge.origin, "/plugin/results", {
    commandId: firstCommandId,
    error: {
      code: "ERR_COMMAND_EXPIRED",
      message: "Command expired: search_nodes",
      statusCode: 504,
      details: { type: "search_nodes" }
    },
    result: null
  });

  const secondPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(secondPoll.body.commands.length, 1);
  assert.notEqual(secondPoll.body.commands[0].commandId, firstCommandId);

  const expectedResult = {
    matches: [{ id: "hero", name: "Today Hero", type: "FRAME", depth: 2 }],
    truncated: false,
    root: { id: "10:1", name: "App", type: "FRAME" }
  };
  await postJson(bridge.origin, "/plugin/results", {
    commandId: secondPoll.body.commands[0].commandId,
    error: null,
    result: expectedResult
  });

  const response = await pendingApi;
  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.deepEqual(response.body.result, expectedResult);
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

test("/api/pages client disconnect does not crash bridge while command is pending", async (t) => {
  const bridge = await startBridgeServer({
    toolTimeoutMs: 350
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const pluginId = "page:pages-disconnect";
  await postJson(bridge.origin, "/plugin/register", { pluginId, pageId: "pages-disconnect" });
  await postJson(bridge.origin, "/plugin/heartbeat", { pluginId });

  const abortController = new AbortController();
  const pendingPages = fetch(
    `${bridge.origin}/api/pages?pluginId=${encodeURIComponent(pluginId)}`,
    { signal: abortController.signal }
  ).catch((error) => error);

  await sleep(40);
  abortController.abort();
  await pendingPages;

  await sleep(420);

  const health = await getJson(bridge.origin, "/health");
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
});
