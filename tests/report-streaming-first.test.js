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

function runStreamingReport(origin) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/report-streaming-first.mjs"], {
      cwd: new URL("..", import.meta.url),
      env: {
        ...process.env,
        BASE_URL: origin
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
      try {
        resolve({
          code,
          stderr,
          body: JSON.parse(stdout)
        });
      } catch (error) {
        reject(new Error(`Invalid report JSON: ${stdout || stderr}`));
      }
    });
  });
}

test("streaming-first report captures health, runtime ops, sessions, and summary", async (t) => {
  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const result = await runStreamingReport(bridge.origin);
  assert.equal(result.code, 0);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.snapshots.health.ok, true);
  assert.equal(result.body.snapshots.runtimeOps.ok, true);
  assert.equal(result.body.snapshots.sessions.ok, true);
  assert.equal(result.body.snapshots.health.body.server, "writable-mcp-bridge");
  assert.ok(result.body.snapshots.health.body.transportCapabilities);
  assert.ok(result.body.snapshots.health.body.runtimeFeatureFlags);
  assert.ok(result.body.snapshots.health.body.transportHealth);
  assert.equal(result.body.snapshots.runtimeOps.body.ok, true);
  assert.ok(Array.isArray(result.body.snapshots.sessions.body.sessions));
  assert.equal(result.body.summary.server, "writable-mcp-bridge");
  assert.equal(result.body.summary.serverVersion, "0.5.62");
  assert.equal(typeof result.body.summary.activePlugins, "number");
  assert.equal(typeof result.body.summary.sessionsTracked, "number");
  assert.ok(result.body.summary.fallbackIncidenceTrend);
  assert.equal(typeof result.body.summary.fallbackIncidenceTrend.deltaRate, "number");
  assert.equal(typeof result.body.summary.fallbackIncidenceTrend.status, "string");
  assert.equal(
    result.body.summary.fallbackIncidenceTrend.status,
    result.body.snapshots.runtimeOps.body.result.transportHealth.fallbackIncidenceTrend.status
  );
  assert.ok(result.body.summary.fallbackRisk);
  assert.equal(typeof result.body.summary.fallbackRisk.level, "string");
  assert.ok(["stable", "watch", "high"].includes(result.body.summary.fallbackRisk.status));
  assert.equal(typeof result.body.summary.commandReadinessStatus, "string");
  assert.ok(result.body.summary.commandReadinessRisk);
  assert.equal(typeof result.body.summary.commandReadinessRisk.level, "string");
  assert.ok(["stable", "watch", "high"].includes(result.body.summary.commandReadinessRisk.level));
  assert.ok(result.body.summary.fallbackPolicyTuning);
  assert.equal(typeof result.body.summary.fallbackPolicyTuning.mode, "string");
  assert.equal(typeof result.body.summary.fallbackPolicyTuning.wsGuardMode, "string");
  assert.equal(typeof result.body.summary.fallbackPolicyTuning.summary, "string");
  assert.ok(result.body.summary.operationalState);
  assert.equal(typeof result.body.summary.operationalState.connected, "string");
  assert.equal(typeof result.body.summary.operationalState.command, "string");
  assert.equal(typeof result.body.summary.operationalState.health, "string");
  assert.ok(
    ["normal", "recovery", "outage", "unknown"].includes(
      result.body.summary.operationalState.fallbackPhase
    )
  );
});
