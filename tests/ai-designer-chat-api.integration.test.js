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
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
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
      reject(new Error(`Bridge exited before listening (code=${String(code)}, signal=${String(signal)})`));
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
      OPENAI_API_KEY: "",
      XBRIDGE_AI_API_KEY: ""
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const listeningPort = await waitForBridgeListening(childProcess);
  return {
    origin: `http://127.0.0.1:${listeningPort}`,
    childProcess
  };
}

test("designer chat API returns read context and unconfigured AI fallback", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const healthResponse = await fetch(`${bridge.origin}/health`);
  const health = await healthResponse.json();
  assert.equal(health.serverVersion, "0.5.62");
  assert.equal(health.aiDesigner.provider, "openai");
  assert.equal(health.aiDesigner.configured, false);

  const chatResponse = await fetch(`${bridge.origin}/api/designer/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      pluginId: "default",
      message: "선택한 카드의 정보 위계를 정리해줘",
      figmaContext: {
        pageName: "Dashboard",
        selection: [{ id: "1:2", name: "Revenue Card" }]
      }
    })
  });
  const chat = await chatResponse.json();

  assert.equal(chatResponse.status, 200);
  assert.equal(chat.ok, true);
  assert.equal(chat.intentEnvelope.intents[0].kind, "improve_hierarchy");
  assert.equal(chat.ai.status, "unconfigured");
  assert.equal(chat.ai.response.safety.canApply, false);
  assert.equal(Array.isArray(chat.designerSuggestionBundle.recommendations), true);
  assert.equal(Array.isArray(chat.designerActionPreviewBundle.previews), true);
  assert.equal(chat.designerSuggestionBundle.actionPreviewBundle.summary.actionCount > 0, true);
});
