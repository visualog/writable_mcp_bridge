#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const realtimeContract = JSON.parse(
  await readFile(
    path.join(__dirname, "..", "tests", "fixtures", "realtime-event-contract.fixture.json"),
    "utf8"
  )
);
const wsContract = JSON.parse(
  await readFile(
    path.join(__dirname, "..", "tests", "fixtures", "websocket-command-channel.fixture.json"),
    "utf8"
  )
);

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:3846").replace(/\/+$/, "");
let pluginId = String(process.env.PLUGIN_ID || "").trim();
const autoRegister = process.env.AUTO_REGISTER !== "false";
const registerFileName = String(process.env.REGISTER_FILE_NAME || "Streaming First Validation");
const registerPageId = String(process.env.REGISTER_PAGE_ID || "streaming-first");
const registerPageName = String(process.env.REGISTER_PAGE_NAME || "Validation");
const sseTimeoutMs = Number(process.env.SSE_TIMEOUT_MS || 1500);
const wsTimeoutMs = Number(process.env.WS_TIMEOUT_MS || 1800);
const selectionWaitMs = Number(process.env.SELECTION_WAIT_MS || 2200);
const fallbackWaitMs = Number(process.env.POLLING_FALLBACK_WAIT_MS || 1500);
const wsPath = String(process.env.WS_PATH || "/api/ws");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toWsUrl(httpBase, pathWithQuery = "") {
  const parsed = new URL(httpBase);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}${pathWithQuery}`;
}

function parseJson(raw) {
  try {
    return JSON.parse(String(raw));
  } catch (error) {
    return null;
  }
}

function parseSseFrame(rawFrame) {
  const normalized = String(rawFrame).replace(/\r/g, "");
  const lines = normalized.split("\n");
  let event = "";
  let id = "";
  const dataLines = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).trimStart() : "";
    if (field === "event") {
      event = value;
    } else if (field === "id") {
      id = value;
    } else if (field === "data") {
      dataLines.push(value);
    }
  }

  const dataRaw = dataLines.join("\n");
  return {
    id,
    event,
    dataRaw,
    data: dataRaw ? parseJson(dataRaw) : null
  };
}

async function getJson(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

async function postJson(pathname, payload) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function waitFor(predicate, source, timeoutMs = 1200) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const found = source.find(predicate);
    if (found) {
      return found;
    }
    await sleep(20);
  }
  return null;
}

async function readSseFrames(response, timeoutMs = 1200, maxFrames = 4) {
  if (!response.body) {
    return [];
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
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

      buffer += decoder.decode(result.value, { stream: true });
      buffer = buffer.replace(/\r\n/g, "\n");

      let splitIndex = buffer.indexOf("\n\n");
      while (splitIndex >= 0 && frames.length < maxFrames) {
        const frameText = buffer.slice(0, splitIndex).trim();
        buffer = buffer.slice(splitIndex + 2);
        if (frameText) {
          frames.push(parseSseFrame(frameText));
        }
        splitIndex = buffer.indexOf("\n\n");
      }
    }
  } finally {
    reader.releaseLock();
  }

  return frames;
}

function collectWsMessages(socket) {
  const messages = [];
  const onMessage = (event) => {
    const parsed = parseJson(event.data);
    if (parsed) {
      messages.push(parsed);
    }
  };
  socket.addEventListener("message", onMessage);
  return {
    messages,
    stop() {
      socket.removeEventListener("message", onMessage);
    }
  };
}

function connectWebSocket(url, timeoutMs = 1800) {
  return new Promise((resolve) => {
    if (typeof WebSocket !== "function") {
      resolve({ supported: false, reason: "WebSocket client unavailable" });
      return;
    }

    const socket = new WebSocket(url);
    let settled = false;

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
      finish({ supported: false, reason: "WebSocket connection timeout" });
    }, timeoutMs);
    timer.unref?.();

    socket.addEventListener("open", () => finish({ supported: true, socket }));
    socket.addEventListener("error", () => finish({ supported: false, reason: "WebSocket error" }));
    socket.addEventListener("close", () => {
      if (!settled) {
        finish({ supported: false, reason: "WebSocket closed before open" });
      }
    });
  });
}

async function waitForPluginSelectionCommand(messages, timeoutMs, excludeCommandIds = []) {
  const excluded = new Set(excludeCommandIds.filter(Boolean));
  return waitFor(
    (entry) =>
      (entry.event || entry.type) === "plugin.command" &&
      entry.payload?.command?.type === "get_selection" &&
      !excluded.has(entry.payload?.command?.commandId),
    messages,
    timeoutMs
  );
}

async function waitForPluginCommands(pluginIdValue, timeoutMs = 1200) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const polled = await getJson(
      `/plugin/commands?pluginId=${encodeURIComponent(pluginIdValue)}`
    );
    if ((polled.body?.commands?.length || 0) > 0) {
      return polled;
    }
    await sleep(25);
  }
  return {
    status: 200,
    body: {
      ok: true,
      commands: []
    }
  };
}

function sendWs(socket, payload) {
  socket.send(JSON.stringify(payload));
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function createSummary() {
  return {
    baseUrl,
    pluginId: null,
    health: {
      ok: false,
      activePlugins: [],
      currentReadHealth: null,
      recentFailedTotal: null,
      historicalFailedTotal: null
    },
    runtimeOps: {
      ok: false,
      currentReadHealth: null,
      recentFailedTotal: null,
      historicalFailedTotal: null,
      liveSessionCount: null
    },
    parity: {
      ok: false,
      currentReadHealthMatch: false,
      recentFailedTotalMatch: false,
      historicalFailedTotalMatch: false,
      activeSessionCountMatch: false
    },
    sse: {
      ok: false,
      connected: false,
      healthChangedSeen: false,
      firstEvents: []
    },
    ws: {
      ok: false,
      directAckSeen: false,
      directResultSeen: false,
      directResultOk: false,
      pickupAckSeen: false,
      pickupResultSeen: false,
      pickupHttpOk: false,
      fallbackPollSeen: false,
      fallbackHttpOk: false,
      commandLifecycleSeen: {
        enqueued: false,
        delivered: false,
        completed: false
      },
      helloSeen: false,
      readCommands: []
    },
    skipped: [],
    failures: []
  };
}

async function run() {
  const summary = createSummary();

  if (typeof WebSocket !== "function") {
    summary.failures.push("WebSocket client is unavailable in this runtime.");
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  const initialHealth = await getJson("/health");
  const initialRuntime = await getJson("/api/runtime-ops?staleLimit=5");
  const sessions = await getJson("/api/sessions");

  summary.health.ok = initialHealth.status === 200 && initialHealth.body?.ok === true;
  summary.health.activePlugins = Array.isArray(initialHealth.body?.activePlugins)
    ? initialHealth.body.activePlugins
    : [];
  summary.health.currentReadHealth = initialHealth.body?.currentReadHealth ?? null;
  summary.health.recentFailedTotal = initialHealth.body?.recentFailedTotal ?? null;
  summary.health.historicalFailedTotal =
    initialHealth.body?.observability?.queue?.historicalFailedTotal ?? null;

  summary.runtimeOps.ok = initialRuntime.status === 200 && initialRuntime.body?.ok === true;
  summary.runtimeOps.currentReadHealth = initialRuntime.body?.result?.currentReadHealth ?? null;
  summary.runtimeOps.recentFailedTotal =
    initialRuntime.body?.result?.failures?.recentFailedTotal ?? null;
  summary.runtimeOps.historicalFailedTotal =
    initialRuntime.body?.result?.failures?.historicalFailedTotal ?? null;
  summary.runtimeOps.liveSessionCount =
    initialRuntime.body?.result?.sessions?.summary?.live ?? null;

  summary.parity.currentReadHealthMatch =
    summary.health.currentReadHealth === summary.runtimeOps.currentReadHealth;
  summary.parity.recentFailedTotalMatch =
    summary.health.recentFailedTotal === summary.runtimeOps.recentFailedTotal;
  summary.parity.historicalFailedTotalMatch =
    summary.health.historicalFailedTotal === summary.runtimeOps.historicalFailedTotal;
  summary.parity.activeSessionCountMatch =
    summary.health.activePlugins.length === summary.runtimeOps.liveSessionCount;
  summary.parity.ok =
    summary.parity.currentReadHealthMatch &&
    summary.parity.recentFailedTotalMatch &&
    summary.parity.historicalFailedTotalMatch &&
    summary.parity.activeSessionCountMatch;

  if (!pluginId) {
    pluginId =
      summary.health.activePlugins[0] ||
      sessions.body?.sessions?.find((session) => session?.active)?.pluginId ||
      `page:${registerPageId}`;
  }
  summary.pluginId = pluginId;

  if (autoRegister) {
    const register = await postJson("/plugin/register", {
      pluginId,
      fileName: registerFileName,
      pageId: registerPageId,
      pageName: registerPageName
    });
    if (!(register.status === 200 && register.body?.ok === true)) {
      summary.failures.push(`Plugin register failed for ${pluginId}.`);
    }

    const heartbeat = await postJson("/plugin/heartbeat", { pluginId });
    if (!(heartbeat.status === 200 && heartbeat.body?.ok === true)) {
      summary.failures.push(`Plugin heartbeat failed for ${pluginId}.`);
    }

    const clearSelection = await postJson("/plugin/selection", {
      pluginId,
      selection: []
    });
    if (!(clearSelection.status === 200 && clearSelection.body?.ok === true)) {
      summary.failures.push(`Plugin selection reset failed for ${pluginId}.`);
    }
  }

  const postRegisterHealth = await getJson("/health");
  const postRegisterRuntime = await getJson("/api/runtime-ops?staleLimit=5");
  const postRegisterSessions = await getJson("/api/sessions");

  summary.health.ok =
    summary.health.ok && postRegisterHealth.status === 200 && postRegisterHealth.body?.ok === true;
  summary.health.activePlugins = Array.isArray(postRegisterHealth.body?.activePlugins)
    ? postRegisterHealth.body.activePlugins
    : summary.health.activePlugins;
  summary.health.currentReadHealth = postRegisterHealth.body?.currentReadHealth ?? summary.health.currentReadHealth;
  summary.health.recentFailedTotal =
    postRegisterHealth.body?.recentFailedTotal ?? summary.health.recentFailedTotal;
  summary.health.historicalFailedTotal =
    postRegisterHealth.body?.observability?.queue?.historicalFailedTotal ??
    summary.health.historicalFailedTotal;

  summary.runtimeOps.ok =
    summary.runtimeOps.ok &&
    postRegisterRuntime.status === 200 &&
    postRegisterRuntime.body?.ok === true;
  summary.runtimeOps.currentReadHealth =
    postRegisterRuntime.body?.result?.currentReadHealth ?? summary.runtimeOps.currentReadHealth;
  summary.runtimeOps.recentFailedTotal =
    postRegisterRuntime.body?.result?.failures?.recentFailedTotal ?? summary.runtimeOps.recentFailedTotal;
  summary.runtimeOps.historicalFailedTotal =
    postRegisterRuntime.body?.result?.failures?.historicalFailedTotal ??
    summary.runtimeOps.historicalFailedTotal;
  summary.runtimeOps.liveSessionCount =
    postRegisterRuntime.body?.result?.sessions?.summary?.live ?? summary.runtimeOps.liveSessionCount;

  summary.parity.currentReadHealthMatch =
    summary.health.currentReadHealth === summary.runtimeOps.currentReadHealth;
  summary.parity.recentFailedTotalMatch =
    summary.health.recentFailedTotal === summary.runtimeOps.recentFailedTotal;
  summary.parity.historicalFailedTotalMatch =
    summary.health.historicalFailedTotal === summary.runtimeOps.historicalFailedTotal;
  summary.parity.activeSessionCountMatch =
    summary.health.activePlugins.length === summary.runtimeOps.liveSessionCount;
  summary.parity.ok =
    summary.parity.currentReadHealthMatch &&
    summary.parity.recentFailedTotalMatch &&
    summary.parity.historicalFailedTotalMatch &&
    summary.parity.activeSessionCountMatch;

  const liveSession = postRegisterSessions.body?.sessions?.find(
    (session) => session?.pluginId === pluginId
  );
  if (!liveSession || liveSession.active !== true) {
    summary.failures.push(`Expected active session for ${pluginId}.`);
  }

  const sseAbort = new AbortController();
  const sseResponse = await fetch(`${baseUrl}/api/events?pluginId=${encodeURIComponent(pluginId)}`, {
    headers: { accept: "text/event-stream" },
    signal: sseAbort.signal
  }).catch(() => null);
  if (!sseResponse) {
    summary.failures.push("SSE endpoint did not respond.");
  } else {
    summary.sse.connected =
      sseResponse.status === 200 &&
      String(sseResponse.headers.get("content-type") || "").includes(
        realtimeContract.validSseContentType
      );
    if (summary.sse.connected) {
      const frames = await readSseFrames(sseResponse, sseTimeoutMs, 4).catch(() => []);
      summary.sse.firstEvents = frames.map((frame) => frame.event).filter(Boolean);
      summary.sse.healthChangedSeen = frames.some((frame) => frame.event === "health.changed");
      summary.sse.ok = summary.sse.healthChangedSeen;
    }
    sseAbort.abort();
  }
  if (!summary.sse.ok) {
    summary.failures.push("SSE stream did not emit health.changed.");
  }

  const observer = await connectWebSocket(toWsUrl(baseUrl, `${wsPath}?clientType=observer`), wsTimeoutMs);
  if (!observer.supported) {
    summary.failures.push(`Observer WebSocket unavailable: ${observer.reason}`);
  } else {
    const observerSocket = observer.socket;
    const observerCollector = collectWsMessages(observerSocket);
    const hello = await waitFor(
      (entry) => (entry.event || entry.type) === "ws.hello",
      observerCollector.messages,
      wsTimeoutMs
    );
    if (!hello) {
      summary.failures.push("Observer WebSocket hello was not received.");
    }
    const pingRequestId = "validate-streaming-first-ping";
    sendWs(observerSocket, {
      type: "ws.command.request",
      requestId: pingRequestId,
      command: "ping",
      args: {}
    });
    const pingAck = await waitFor(
      (entry) =>
        (entry.event || entry.type) === "ws.command.ack" &&
        entry.payload?.requestId === pingRequestId,
      observerCollector.messages,
      wsTimeoutMs
    );
    const pingResult = await waitFor(
      (entry) =>
        (entry.event || entry.type) === "ws.command.result" &&
        entry.payload?.requestId === pingRequestId,
      observerCollector.messages,
      wsTimeoutMs
    );
    summary.ws.directAckSeen = Boolean(pingAck);
    summary.ws.directResultSeen = Boolean(pingResult);
    summary.ws.directResultOk = pingResult?.payload?.result?.ok === true;
    summary.ws.helloSeen = Boolean(hello);
    summary.ws.readCommands = Array.isArray(hello?.payload?.readCommands) ? hello.payload.readCommands : [];
    observerCollector.stop();
    observerSocket.close();
  }

  const plugin = await connectWebSocket(
    toWsUrl(baseUrl, `${wsPath}?pluginId=${encodeURIComponent(pluginId)}&clientType=plugin`),
    wsTimeoutMs
  );
  if (!plugin.supported) {
    summary.failures.push(`Plugin WebSocket unavailable: ${plugin.reason}`);
  } else {
    const pluginSocket = plugin.socket;
    const pluginCollector = collectWsMessages(pluginSocket);
    const hello = await waitFor(
      (entry) => (entry.event || entry.type) === "ws.hello",
      pluginCollector.messages,
      wsTimeoutMs
    );
    if (!hello) {
      summary.failures.push("Plugin WebSocket hello was not received.");
    } else {
      summary.ws.helloSeen = true;
      summary.ws.readCommands = Array.isArray(hello.payload?.readCommands)
        ? hello.payload.readCommands
        : [];
      for (const commandName of ["get_selection", "get_metadata"]) {
        if (!summary.ws.readCommands.includes(commandName)) {
          summary.failures.push(`WS hello did not advertise ${commandName}.`);
        }
      }
    }

    const handledCommandIds = [];

    await postJson("/plugin/heartbeat", { pluginId });
    const pickupRequest = postJson("/api/get-selection", { pluginId });
    const pickupCommand = await waitForPluginSelectionCommand(
      pluginCollector.messages,
      selectionWaitMs,
      handledCommandIds
    );
    if (pickupCommand?.payload?.command?.commandId) {
      const commandId = pickupCommand.payload.command.commandId;
      handledCommandIds.push(commandId);
      sendWs(pluginSocket, {
        type: "ws.plugin.command.ack",
        commandId,
        pluginId
      });
      const pickupAck = await waitFor(
        (entry) =>
          (entry.event || entry.type) === "ws.plugin.command.ack" &&
          entry.payload?.commandId === commandId,
        pluginCollector.messages,
        wsTimeoutMs
      );
      sendWs(pluginSocket, {
        type: "ws.plugin.command.result",
        commandId,
        pluginId,
        result: {
          selection: []
        }
      });
      const pickupResultAck = await waitFor(
        (entry) =>
          (entry.event || entry.type) === "ws.plugin.command.result.ack" &&
          entry.payload?.commandId === commandId,
        pluginCollector.messages,
        wsTimeoutMs
      );

      const pickupHttp = await pickupRequest;
      const deliveredEvent = await waitFor(
        (entry) =>
          (entry.event || entry.type) === "command.delivered" &&
          entry.payload?.commandId === commandId,
        pluginCollector.messages,
        wsTimeoutMs
      );
      const completedEvent = await waitFor(
        (entry) =>
          (entry.event || entry.type) === "command.completed" &&
          entry.payload?.commandId === commandId,
        pluginCollector.messages,
        wsTimeoutMs
      );
      summary.ws.pickupAckSeen = Boolean(pickupAck);
      summary.ws.pickupResultSeen = Boolean(pickupResultAck);
      summary.ws.commandLifecycleSeen.enqueued = true;
      summary.ws.commandLifecycleSeen.delivered = Boolean(deliveredEvent);
      summary.ws.commandLifecycleSeen.completed = Boolean(completedEvent);
      summary.ws.pickupHttpOk = pickupHttp.status === 200 && pickupHttp.body?.ok === true;
    }

    await postJson("/plugin/heartbeat", { pluginId });
    const fallbackRequest = postJson("/api/get-selection", { pluginId });
    const fallbackPickup = await waitForPluginSelectionCommand(
      pluginCollector.messages,
      selectionWaitMs,
      handledCommandIds
    );
    if (fallbackPickup?.payload?.command?.commandId) {
      const commandId = fallbackPickup.payload.command.commandId;
      handledCommandIds.push(commandId);
      await sleep(fallbackWaitMs);
      const fallbackPolled = await waitForPluginCommands(
        pluginId,
        Math.max(1200, fallbackWaitMs + 400)
      );
      const fallbackCommand = fallbackPolled.body?.commands?.find(
        (command) => command.commandId === commandId
      );
      summary.ws.fallbackPollSeen =
        fallbackPolled.status === 200 && Boolean(fallbackCommand);
      if (fallbackCommand) {
        await postJson("/plugin/results", {
          commandId,
          result: {
            selection: []
          },
          error: null
        });
      }
      const fallbackHttp = await fallbackRequest;
      summary.ws.fallbackHttpOk =
        summary.ws.fallbackPollSeen &&
        fallbackHttp.status === 200 &&
        fallbackHttp.body?.ok === true;
    }

    if (!summary.ws.commandLifecycleSeen.enqueued) {
      summary.ws.commandLifecycleSeen.enqueued = pluginCollector.messages.some(
        (entry) => (entry.event || entry.type) === "command.enqueued"
      );
    }
    if (!summary.ws.commandLifecycleSeen.delivered) {
      summary.ws.commandLifecycleSeen.delivered = pluginCollector.messages.some(
        (entry) => (entry.event || entry.type) === "command.delivered"
      );
    }
    if (!summary.ws.commandLifecycleSeen.completed) {
      summary.ws.commandLifecycleSeen.completed = pluginCollector.messages.some(
        (entry) => (entry.event || entry.type) === "command.completed"
      );
    }

    summary.ws.ok =
      summary.ws.helloSeen &&
      summary.ws.directAckSeen &&
      summary.ws.directResultSeen &&
      summary.ws.directResultOk &&
      summary.ws.pickupAckSeen &&
      summary.ws.pickupResultSeen &&
      summary.ws.pickupHttpOk &&
      summary.ws.fallbackPollSeen &&
      summary.ws.fallbackHttpOk &&
      summary.ws.commandLifecycleSeen.enqueued &&
      summary.ws.commandLifecycleSeen.delivered &&
      summary.ws.commandLifecycleSeen.completed;
    pluginCollector.stop();
    pluginSocket.close();
  }

  if (!summary.ws.ok) {
    if (!summary.ws.pickupAckSeen) {
      summary.failures.push("Plugin pickup did not ACK over WebSocket.");
    }
    if (!summary.ws.pickupResultSeen) {
      summary.failures.push("Plugin pickup did not send result ACK over WebSocket.");
    }
    if (!summary.ws.pickupHttpOk) {
      summary.failures.push("Streaming-first pickup HTTP request did not resolve successfully.");
    }
    if (!summary.ws.fallbackPollSeen) {
      summary.failures.push("Fallback pickup did not appear in /plugin/commands.");
    }
    if (!summary.ws.fallbackHttpOk) {
      summary.failures.push("Fallback HTTP request did not resolve successfully.");
    }
    if (!summary.ws.commandLifecycleSeen.enqueued) {
      summary.failures.push("command.enqueued was not observed on the plugin WebSocket.");
    }
    if (!summary.ws.commandLifecycleSeen.delivered) {
      summary.failures.push("command.delivered was not observed on the plugin WebSocket.");
    }
    if (!summary.ws.commandLifecycleSeen.completed) {
      summary.failures.push("command.completed was not observed on the plugin WebSocket.");
    }
    summary.failures.push("WebSocket streaming-first validation did not fully pass.");
  }

  summary.ok =
    summary.health.ok &&
    summary.runtimeOps.ok &&
    summary.parity.ok &&
    summary.sse.ok &&
    summary.ws.ok &&
    summary.failures.length === 0;

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
