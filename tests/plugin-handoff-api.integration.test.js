import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";
import { createPluginLocalHandoffPayload } from "../src/plugin-handoff-contract.js";

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
      PORT: String(reservedPort)
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const listeningPort = await waitForBridgeListening(childProcess);
  return {
    origin: `http://127.0.0.1:${listeningPort}`,
    childProcess
  };
}

function runNodeScript(scriptPath, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        ...env
      },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `exit ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Invalid JSON output: ${stdout || stderr}`));
      }
    });
  });
}

function createFixturePayload() {
  const intentEnvelope = createDesignerIntentEnvelope({
    request: "선택한 화면을 구현 가능한 카드형 대시보드로 재구성해줘.",
    figmaContext: {
      fileName: "Growth Dashboard",
      pageId: "page:1",
      pageName: "Overview",
      selection: [
        {
          id: "12:34",
          name: "Revenue Card"
        }
      ]
    }
  });

  return createPluginLocalHandoffPayload({
    pluginContext: {
      pluginSessionId: "page:1",
      figmaFileKey: "file_123",
      figmaFileName: "Growth Dashboard",
      pageId: "page:1",
      pageName: "Overview"
    },
    figmaContext: {
      pageName: "Overview",
      selection: [
        {
          id: "12:34",
          name: "Revenue Card"
        }
      ]
    },
    intentEnvelope
  });
}

test("handoff API accepts valid payloads and lists recent handoffs", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const payload = createFixturePayload();
  const postResponse = await fetch(`${bridge.origin}/api/handoffs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  assert.equal(postResponse.status, 202);
  const postBody = await postResponse.json();
  assert.equal(postBody.ok, true);
  assert.equal(postBody.handoff.handoffId, payload.handoffId);
  assert.equal(postBody.handoff.status, "queued");

  const listResponse = await fetch(`${bridge.origin}/api/handoffs`);
  assert.equal(listResponse.status, 200);
  const listBody = await listResponse.json();
  assert.equal(listBody.ok, true);
  assert.equal(listBody.total >= 1, true);
  assert.equal(Array.isArray(listBody.items), true);
  assert.equal(listBody.items[0].handoffId, payload.handoffId);
  assert.equal(listBody.items[0].intent.summary, payload.intent.summary);
});

test("handoff API rejects invalid payloads", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const response = await fetch(`${bridge.origin}/api/handoffs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      version: "0.1"
    })
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.error, "Invalid handoff payload");
  assert.equal(Array.isArray(body.details), true);
  assert.equal(body.details.length > 0, true);
});

test("handoff API supports next, claim, and complete lifecycle", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const payload = createFixturePayload();
  const createResponse = await fetch(`${bridge.origin}/api/handoffs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  assert.equal(createResponse.status, 202);

  const nextResponse = await fetch(`${bridge.origin}/api/handoffs/next`);
  assert.equal(nextResponse.status, 200);
  const nextBody = await nextResponse.json();
  assert.equal(nextBody.ok, true);
  assert.equal(nextBody.handoff.handoffId, payload.handoffId);
  assert.equal(nextBody.handoff.status, "queued");

  const claimResponse = await fetch(`${bridge.origin}/api/handoffs/claim`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      handoffId: payload.handoffId,
      workerId: "codex-local-agent",
      workerLabel: "Codex Local Agent"
    })
  });
  assert.equal(claimResponse.status, 200);
  const claimBody = await claimResponse.json();
  assert.equal(claimBody.ok, true);
  assert.equal(claimBody.handoff.status, "claimed");
  assert.equal(claimBody.handoff.claimedBy.workerId, "codex-local-agent");

  const completeResponse = await fetch(`${bridge.origin}/api/handoffs/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      handoffId: payload.handoffId,
      workerId: "codex-local-agent",
      summary: "Implemented as reusable dashboard card",
      result: {
        changedFiles: ["src/components/DashboardCard.tsx"],
        tests: ["npm test -- DashboardCard"]
      }
    })
  });
  assert.equal(completeResponse.status, 200);
  const completeBody = await completeResponse.json();
  assert.equal(completeBody.ok, true);
  assert.equal(completeBody.handoff.status, "completed");
  assert.equal(
    completeBody.handoff.completion.summary,
    "Implemented as reusable dashboard card"
  );
  assert.deepEqual(completeBody.handoff.completion.result.changedFiles, [
    "src/components/DashboardCard.tsx"
  ]);
  assert.deepEqual(completeBody.handoff.completion.result.tests, [
    "npm test -- DashboardCard"
  ]);
});

test("run-next-handoff can claim and complete queued work in one step", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const payload = createFixturePayload();
  const createResponse = await fetch(`${bridge.origin}/api/handoffs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  assert.equal(createResponse.status, 202);

  const result = await runNodeScript("scripts/run-next-handoff.mjs", [
    "--complete",
    "--summary",
    "Auto-completed by local runner",
    "--file",
    "src/components/Hero.tsx",
    "--test",
    "npm test -- Hero"
  ], {
    BASE_URL: bridge.origin,
    WORKER_ID: "runner-agent",
    WORKER_LABEL: "Runner Agent"
  });

  assert.equal(result.ok, true);
  assert.equal(result.claimed, true);
  assert.equal(result.completed, true);
  assert.equal(result.handoff.status, "completed");
  assert.equal(result.handoff.completion.workerId, "runner-agent");
  assert.deepEqual(result.handoff.completion.result.changedFiles, ["src/components/Hero.tsx"]);
  assert.deepEqual(result.handoff.completion.result.tests, ["npm test -- Hero"]);
});

test("run-next-handoff can execute a local command before completion", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const payload = createFixturePayload();
  const createResponse = await fetch(`${bridge.origin}/api/handoffs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  assert.equal(createResponse.status, 202);

  const result = await runNodeScript(
    "scripts/run-next-handoff.mjs",
    [
      "--complete",
      "--summary",
      "Executed local command before completion",
      "--exec",
      `${process.execPath} -e "process.stdout.write('runner-ok')"`
    ],
    {
      BASE_URL: bridge.origin,
      WORKER_ID: "exec-agent",
      WORKER_LABEL: "Exec Agent"
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.claimed, true);
  assert.equal(result.completed, true);
  assert.equal(result.execution.command.includes(process.execPath), true);
  assert.equal(result.execution.success, true);
  assert.equal(result.execution.stdout, "runner-ok");
  assert.equal(result.handoff.completion.result.execution.success, true);
  assert.equal(result.handoff.completion.result.execution.stdout, "runner-ok");
});

test("run-next-handoff can auto-resolve an execution command from env", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const payload = createFixturePayload();
  const createResponse = await fetch(`${bridge.origin}/api/handoffs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  assert.equal(createResponse.status, 202);

  const result = await runNodeScript(
    "scripts/run-next-handoff.mjs",
    [
      "--auto",
      "--complete",
      "--summary",
      "Auto pipeline command executed"
    ],
    {
      BASE_URL: bridge.origin,
      WORKER_ID: "auto-agent",
      WORKER_LABEL: "Auto Agent",
      XBRIDGE_HANDOFF_CMD_IMPLEMENT_SELECTION: `${process.execPath} -e "process.stdout.write('auto-ok')"`
    }
  );

  assert.equal(result.ok, true);
  assert.equal(result.claimed, true);
  assert.equal(result.completed, true);
  assert.equal(result.executionPlan.source, "env:XBRIDGE_HANDOFF_CMD_IMPLEMENT_SELECTION");
  assert.equal(result.execution.success, true);
  assert.equal(result.execution.stdout, "auto-ok");
  assert.equal(result.handoff.completion.result.executionPlan.source, "env:XBRIDGE_HANDOFF_CMD_IMPLEMENT_SELECTION");
});
