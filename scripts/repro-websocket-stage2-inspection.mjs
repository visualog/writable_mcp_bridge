#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "..", "tests", "fixtures", "websocket-stage2-inspection.fixture.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:3846").replace(/\/+$/, "");
const wsPath = process.env.WS_PATH || "/api/ws";
const timeoutMs = Number(process.env.WS_TIMEOUT_MS || 6000);
const pluginId = process.env.PLUGIN_ID || fixture.pluginId;

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

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function startWsCollector(socket) {
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

async function waitForMessage(messagesRef, predicate, ms = timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < ms) {
    const hit = messagesRef.find(predicate);
    if (hit) {
      return hit;
    }
    await wait(20);
  }
  return null;
}

async function main() {
  const summary = {
    baseUrl,
    pluginId,
    wsPath,
    healthOk: false,
    connected: false,
    supported: [],
    deferred: [],
    failures: [],
    notes: []
  };

  if (typeof WebSocket !== "function") {
    summary.failures.push("WebSocket client unavailable in current runtime.");
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
  summary.healthOk = Boolean(health?.ok);
  if (!summary.healthOk) {
    summary.failures.push("Health endpoint is not OK.");
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  await postJson("/plugin/register", { pluginId, pageId: "ws-stage2-live" }).catch(() => {});
  await postJson("/plugin/heartbeat", { pluginId }).catch(() => {});

  const wsUrl = toWsUrl(baseUrl, `${wsPath}?pluginId=${encodeURIComponent(pluginId)}`);
  const socket = new WebSocket(wsUrl);

  await new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    timer.unref?.();
    socket.addEventListener("open", () => {
      summary.connected = true;
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("error", () => {
      summary.failures.push("WebSocket upgrade failed.");
      clearTimeout(timer);
      resolve();
    });
    socket.addEventListener("close", () => {
      if (!summary.connected) {
        summary.failures.push("WebSocket closed before open.");
      }
      clearTimeout(timer);
      resolve();
    });
  });

  if (!summary.connected) {
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
    return;
  }

  const collector = startWsCollector(socket);

  for (const entry of fixture.cases) {
    const requestId = `live-${entry.name}-${Date.now()}`;
    const record = {
      name: entry.name,
      command: entry.expectedCommandType,
      httpOk: false,
      wsAck: false,
      wsResult: false,
      wsUnsupported: false,
      equalResult: false
    };

    const httpPromise = postJson(entry.httpPath, {
      pluginId,
      ...entry.requestBody
    });

    socket.send(
      JSON.stringify({
        type: "ws.command.request",
        requestId,
        pluginId,
        command: entry.expectedCommandType,
        args: entry.requestBody
      })
    );

    const httpResponse = await httpPromise.catch((error) => ({
      status: 599,
      body: { ok: false, error: String(error) }
    }));
    record.httpOk = httpResponse.status === 200 && httpResponse.body?.ok === true;

    const ack = await waitForMessage(
      collector.messages,
      (msg) => msg?.event === "ws.command.ack" && msg?.payload?.requestId === requestId
    );
    const wsResult = await waitForMessage(
      collector.messages,
      (msg) => msg?.event === "ws.command.result" && msg?.payload?.requestId === requestId
    );
    const wsError = await waitForMessage(
      collector.messages,
      (msg) => msg?.event === "ws.command.error" && msg?.payload?.requestId === requestId
    );

    record.wsAck = Boolean(ack);
    record.wsResult = Boolean(wsResult);
    record.wsUnsupported = wsError?.payload?.code === "ERR_WS_UNSUPPORTED_COMMAND";

    if (wsResult && record.httpOk) {
      record.equalResult = deepEqual(wsResult.payload?.result, httpResponse.body?.result);
    }

    if (entry.wsSupport === "deferred") {
      summary.deferred.push({
        ...record,
        deferredReason: entry.wsDeferredReason || "explicitly deferred"
      });
      continue;
    }

    summary.supported.push(record);
    if (!record.httpOk || !record.wsAck || !record.wsResult || !record.equalResult) {
      summary.failures.push(
        `${entry.name}: expected HTTP ok + WS ack/result + equalResult (got httpOk=${record.httpOk}, wsAck=${record.wsAck}, wsResult=${record.wsResult}, equalResult=${record.equalResult})`
      );
    }
  }

  collector.stop();
  socket.close();

  if (summary.deferred.length > 0) {
    summary.notes.push(
      "Deferred cases are expected to report wsUnsupported=true until WS command support lands."
    );
  }

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.failures.length > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
