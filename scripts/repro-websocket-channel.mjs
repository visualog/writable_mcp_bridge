#!/usr/bin/env node

const baseUrl = String(process.env.BASE_URL || "http://127.0.0.1:3846").replace(/\/+$/, "");
const pluginId = process.env.PLUGIN_ID || "page:ws-repro";
const wsPath = process.env.WS_PATH || "/api/ws";
const timeoutMs = Number(process.env.WS_TIMEOUT_MS || 4000);

function toWsUrl(httpBase, pathWithQuery = "") {
  const parsed = new URL(httpBase);
  const protocol = parsed.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${parsed.host}${pathWithQuery}`;
}

function parseMessage(raw) {
  try {
    return JSON.parse(String(raw));
  } catch (error) {
    return { raw: String(raw) };
  }
}

async function main() {
  if (typeof WebSocket !== "function") {
    console.log(JSON.stringify({ ok: false, reason: "WebSocket client unavailable in runtime" }, null, 2));
    process.exitCode = 0;
    return;
  }

  const wsUrl = toWsUrl(baseUrl, `${wsPath}?pluginId=${encodeURIComponent(pluginId)}`);
  const summary = {
    baseUrl,
    wsUrl,
    pluginId,
    connected: false,
    messageCount: 0,
    helloSeen: false,
    sessionEventSeen: false,
    commandEventSeen: false,
    commandLifecycleSeen: {
      enqueued: false,
      delivered: false,
      completed: false
    },
    reason: null
  };

  const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
  summary.healthOk = Boolean(health?.ok);

  const socket = new WebSocket(wsUrl);
  const startedAt = Date.now();

  await new Promise((resolve) => {
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      try {
        socket.close();
      } catch (error) {
        // ignore
      }
      resolve();
    };

    const timer = setTimeout(() => {
      if (!summary.connected && !summary.reason) {
        summary.reason = "timeout_or_not_implemented";
      }
      finish();
    }, timeoutMs);
    timer.unref?.();

    socket.addEventListener("open", async () => {
      summary.connected = true;
      await fetch(`${baseUrl}/plugin/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pluginId, pageId: "ws-repro" })
      });
      await fetch(`${baseUrl}/plugin/heartbeat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pluginId })
      });
      await fetch(`${baseUrl}/api/get-selection`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pluginId })
      }).catch(() => {});

      const poll = await fetch(
        `${baseUrl}/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
      )
        .then((response) => response.json())
        .catch(() => null);
      const command = Array.isArray(poll?.commands) ? poll.commands[0] : null;
      if (command && command.commandId) {
        await fetch(`${baseUrl}/plugin/results`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            commandId: command.commandId,
            result: { selection: [{ id: "10:1" }] },
            error: null
          })
        }).catch(() => {});
      }
    });

    socket.addEventListener("message", (event) => {
      summary.messageCount += 1;
      const payload = parseMessage(event.data);
      const eventName = payload.event || payload.type || "";
      if (["hello", "ws.hello", "channel.hello"].includes(eventName)) {
        summary.helloSeen = true;
      }
      if (String(eventName).startsWith("session.")) {
        summary.sessionEventSeen = true;
      }
      if (String(eventName).startsWith("command.")) {
        summary.commandEventSeen = true;
      }
      if (eventName === "command.enqueued") {
        summary.commandLifecycleSeen.enqueued = true;
      }
      if (eventName === "command.delivered") {
        summary.commandLifecycleSeen.delivered = true;
      }
      if (eventName === "command.completed") {
        summary.commandLifecycleSeen.completed = true;
      }
      if (
        summary.helloSeen &&
        summary.sessionEventSeen &&
        summary.commandEventSeen &&
        summary.commandLifecycleSeen.enqueued &&
        summary.commandLifecycleSeen.delivered &&
        summary.commandLifecycleSeen.completed
      ) {
        finish();
      }
    });

    socket.addEventListener("error", () => {
      summary.reason = "ws_upgrade_failed_or_unavailable";
      finish();
    });

    socket.addEventListener("close", () => {
      if (!summary.reason && !summary.connected) {
        summary.reason = "closed_before_open";
      }
      finish();
    });
  });

  summary.elapsedMs = Date.now() - startedAt;
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
