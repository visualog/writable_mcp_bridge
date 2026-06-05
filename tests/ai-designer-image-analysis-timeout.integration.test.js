import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";

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
      reject(new Error("Timed out waiting for bridge to start listening"));
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

async function startBridgeServer(extraEnv = {}) {
  const reservedPort = await reservePort();
  const childProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(reservedPort),
      OPENAI_API_KEY: "",
      XBRIDGE_AI_API_KEY: "",
      ...extraEnv
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const listeningPort = await waitForBridgeListening(childProcess);
  return {
    origin: `http://127.0.0.1:${listeningPort}`,
    childProcess
  };
}

async function createSlowMockCodexCliScript(delayMs) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "xbridge-codex-timeout-mock-"));
  const scriptPath = path.join(tempDir, "mock-codex-cli.mjs");
  const source = `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
await new Promise((resolve) => setTimeout(resolve, ${JSON.stringify(delayMs)}));
const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
if (outputIndex === -1 || !args[outputIndex + 1]) {
  console.error("missing output path");
  process.exit(1);
}
writeFileSync(args[outputIndex + 1], JSON.stringify({
  summary: "늦은 분석 결과입니다.",
  canvasSpecJson: JSON.stringify({ surfaceType: "mobile-app", width: 390, height: 844 }),
  layoutMapJson: JSON.stringify([]),
  roleMapJson: JSON.stringify([]),
  textStyleMapJson: JSON.stringify([]),
  treeJson: JSON.stringify({ helper: "screen", width: 390, height: 844, children: [] })
}), "utf8");
process.exit(0);
`;
  await writeFile(scriptPath, source, "utf8");
  await chmod(scriptPath, 0o755);
  return {
    scriptPath,
    async cleanup() {
      await rm(tempDir, { recursive: true, force: true });
    }
  };
}

async function postJson(origin, requestPath, payload) {
  const response = await fetch(`${origin}${requestPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

async function getJson(origin, requestPath) {
  const response = await fetch(`${origin}${requestPath}`);
  return {
    status: response.status,
    body: await response.json()
  };
}

async function waitForPluginCommands(origin, pluginId, { min = 1, timeoutMs = 2000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const response = await getJson(
      origin,
      `/plugin/commands?pluginId=${encodeURIComponent(pluginId)}`
    );
    if ((response.body?.commands?.length || 0) >= min) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error(`Timed out waiting for ${min} command(s) for plugin ${pluginId}`);
}

test("image analysis only classifies Codex timeout as debug bridge failure", async (t) => {
  const mockCodex = await createSlowMockCodexCliScript(1250);
  const bridge = await startBridgeServer({
    XBRIDGE_CODEX_CLI_BIN: process.execPath,
    XBRIDGE_CODEX_CLI_ENTRYPOINT: mockCodex.scriptPath,
    XBRIDGE_CODEX_CLI_IMAGE_TIMEOUT_MS: "1000"
  });
  t.after(async () => {
    await stopBridge(bridge.childProcess);
    await mockCodex.cleanup();
  });

  const pluginId = "page:image-analysis-only-timeout";
  await postJson(bridge.origin, "/plugin/register", { pluginId });

  const request = postJson(bridge.origin, "/api/designer/chat", {
    pluginId,
    message: "선택한 이미지를 분석만 하고 화면 구현은 하지마",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "33392:3971998", name: "Frame 2", type: "FRAME" }]
    }
  });

  const exportPoll = await waitForPluginCommands(bridge.origin, pluginId);
  assert.equal(exportPoll.body.commands.length, 1);
  assert.equal(exportPoll.body.commands[0].type, "export_node");

  await postJson(bridge.origin, "/plugin/results", {
    commandId: exportPoll.body.commands[0].commandId,
    result: {
      node: { id: "33392:3971998", name: "Frame 2" },
      mimeType: "image/png",
      dataBase64: "QUFBQQ==",
      sizeBytes: 4
    }
  });

  const response = await request;
  assert.equal(response.status, 504);
  assert.equal(response.body.ok, false);
  assert.equal(response.body.code, "debug_bridge_failure");
  assert.equal(response.body.codexStatus, "timeout");
  assert.equal(response.body.details.imageLayoutQuality.userIntentKind, "image_analysis_only");
  assert.equal(response.body.details.imageLayoutQuality.failureIntentKind, "debug_bridge_failure");
  assert.equal(response.body.details.imageLayoutQuality.failureSource, "codex_cli_timeout");
  assert.equal(response.body.details.imageLayoutQuality.stage, "image_analysis_codex");
});
