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
  sessionActiveWindowMs = 400,
  sessionRetentionMs = 3000,
  sessionPruneIntervalMs = 120,
  wsPluginPickupAckTimeoutMs = 150
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
      WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS: String(wsPluginPickupAckTimeoutMs)
    },
    stdio: ["ignore", "ignore", "pipe"]
  });
  const listeningPort = await waitForBridgeListening(childProcess);
  return {
    origin: `http://127.0.0.1:${listeningPort}`,
    childProcess
  };
}

function runSoakValidation(origin, pluginIdPrefix, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/validate-streaming-first-soak.mjs", ...extraArgs],
      {
        cwd: new URL("..", import.meta.url),
        env: {
          ...process.env,
          BASE_URL: origin,
          SOAK_PLUGIN_ID_PREFIX: pluginIdPrefix
        },
        stdio: ["ignore", "pipe", "pipe"]
      }
    );

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
        reject(new Error(`Soak validation failed (code=${code}): ${stderr || stdout}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(new Error(`Soak validation did not emit JSON summary: ${stderr || stdout}`));
      }
    });
  });
}

test("streaming-first soak validation stays stable across repeated runs", async (t) => {
  if (typeof WebSocket !== "function") {
    t.skip("WebSocket global is unavailable in this runtime");
    return;
  }

  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const summary = await runSoakValidation(bridge.origin, "page:streaming-first-soak-test", [
    "--profile=quick"
  ]);

  assert.equal(summary.ok, true);
  assert.equal(summary.profile, "quick");
  assert.equal(summary.iterations, 2);
  assert.equal(summary.completedIterations, 2);
  assert.equal(summary.concurrencyRequested, 1);
  assert.equal(summary.concurrencyEffective, 1);
  assert.equal(summary.concurrency.maxInFlightObserved, 1);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 0);
  assert.equal(summary.runs.length, 2);
  assert.equal(summary.runs.every((run) => run.ok === true), true);
  assert.equal(summary.runs.every((run) => run.wsOk === true), true);
  assert.equal(summary.runs.every((run) => run.sseOk === true), true);
  assert.equal(summary.runs.every((run) => run.resourceUsage && run.resourceUsage.rssBytes > 0), true);
  assert.equal(summary.resourceUsage.peakRssBytes > 0, true);
  assert.equal(typeof summary.resourceUsage.maxActiveHandleCount, "number");
});

test("streaming-first soak validation can run bounded concurrent batches", async (t) => {
  if (typeof WebSocket !== "function") {
    t.skip("WebSocket global is unavailable in this runtime");
    return;
  }

  const bridge = await startBridgeServer();
  t.after(async () => {
    await stopBridge(bridge.childProcess);
  });

  const summary = await runSoakValidation(bridge.origin, "page:streaming-first-soak-concurrent", [
    "--profile=quick",
    "--concurrency=2"
  ]);

  assert.equal(summary.ok, true);
  assert.equal(summary.iterations, 2);
  assert.equal(summary.concurrencyRequested, 2);
  assert.equal(summary.concurrencyEffective, 2);
  assert.equal(summary.concurrency.maxInFlightObserved, 2);
  assert.equal(summary.passed, 2);
  assert.equal(summary.failed, 0);
});
