#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const validatorPath = path.join(__dirname, "validate-streaming-first.mjs");

function parseArgs(argv) {
  const options = {};
  for (const entry of argv) {
    if (!entry.startsWith("--")) {
      continue;
    }
    const separator = entry.indexOf("=");
    if (separator < 0) {
      options[entry.slice(2)] = "true";
      continue;
    }
    options[entry.slice(2, separator)] = entry.slice(separator + 1);
  }
  return options;
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined) {
    return fallback;
  }
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeRun({ iteration, pluginId, durationMs, child }) {
  const summary = child.summary || {};
  const failures = Array.isArray(summary.failures) ? summary.failures : [];
  return {
    iteration,
    pluginId,
    durationMs,
    ok: child.ok,
    exitCode: child.exitCode ?? null,
    healthOk: Boolean(summary.health?.ok),
    runtimeOpsOk: Boolean(summary.runtimeOps?.ok),
    parityOk: Boolean(summary.parity?.ok),
    sseOk: Boolean(summary.sse?.ok),
    wsOk: Boolean(summary.ws?.ok),
    failureCount: failures.length,
    failures: failures.slice(0, 8),
    error: child.error || null
  };
}

async function runValidationOnce({
  baseUrl,
  pluginId,
  registerFileName,
  registerPageId,
  registerPageName,
  sseTimeoutMs,
  wsTimeoutMs,
  fallbackWaitMs,
  selectionWaitMs
}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [validatorPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        BASE_URL: baseUrl,
        PLUGIN_ID: pluginId,
        AUTO_REGISTER: "true",
        REGISTER_FILE_NAME: registerFileName,
        REGISTER_PAGE_ID: registerPageId,
        REGISTER_PAGE_NAME: registerPageName,
        SSE_TIMEOUT_MS: String(sseTimeoutMs),
        WS_TIMEOUT_MS: String(wsTimeoutMs),
        POLLING_FALLBACK_WAIT_MS: String(fallbackWaitMs),
        SELECTION_WAIT_MS: String(selectionWaitMs)
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
    child.once("error", (error) => {
      resolve({
        ok: false,
        error: error.message,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
    child.once("exit", (code, signal) => {
      const raw = stdout.trim();
      let parsed = null;
      if (raw) {
        try {
          parsed = JSON.parse(raw);
        } catch (error) {
          parsed = null;
        }
      }
      const ok = code === 0 && parsed?.ok === true;
      resolve({
        ok,
        exitCode: code,
        signal,
        summary: parsed,
        stdout: raw,
        stderr: stderr.trim(),
        error: parsed ? null : code === 0 ? "Validation script did not emit JSON summary." : `Validation script exited with code ${code}.`
      });
    });
  });
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = String(args["base-url"] || process.env.BASE_URL || "http://127.0.0.1:3846").replace(/\/+$/, "");
const pluginIdPrefix = String(
  args["plugin-id-prefix"] || process.env.SOAK_PLUGIN_ID_PREFIX || "page:streaming-first-soak"
);
const iterations = Math.max(
  1,
  parseNumber(args.iterations || process.env.SOAK_ITERATIONS, 6)
);
const delayMs = Math.max(0, parseNumber(args["delay-ms"] || process.env.SOAK_DELAY_MS, 2500));
const jitterMs = Math.max(0, parseNumber(args["jitter-ms"] || process.env.SOAK_JITTER_MS, 0));
const failFast = parseBoolean(args["fail-fast"] || process.env.SOAK_FAIL_FAST, false);
const registerFileName = String(
  args["register-file-name"] || process.env.REGISTER_FILE_NAME || "Streaming First Soak"
);
const registerPageId = String(
  args["register-page-id"] || process.env.REGISTER_PAGE_ID || "streaming-first-soak"
);
const registerPageName = String(
  args["register-page-name"] || process.env.REGISTER_PAGE_NAME || "Soak"
);
const sseTimeoutMs = Math.max(500, parseNumber(args["sse-timeout-ms"] || process.env.SSE_TIMEOUT_MS, 1800));
const wsTimeoutMs = Math.max(500, parseNumber(args["ws-timeout-ms"] || process.env.WS_TIMEOUT_MS, 3000));
const fallbackWaitMs = Math.max(
  0,
  parseNumber(args["fallback-wait-ms"] || process.env.POLLING_FALLBACK_WAIT_MS, 500)
);
const selectionWaitMs = Math.max(
  500,
  parseNumber(args["selection-wait-ms"] || process.env.SELECTION_WAIT_MS, 3000)
);

async function run() {
  const startedAt = Date.now();
  const summary = {
    ok: false,
    baseUrl,
    pluginIdPrefix,
    iterations,
    delayMs,
    jitterMs,
    failFast,
    runs: [],
    passed: 0,
    failed: 0,
    minDurationMs: null,
    maxDurationMs: null,
    avgDurationMs: null,
    durationMs: 0,
    firstFailure: null,
    failures: []
  };

  for (let index = 0; index < iterations; index += 1) {
    const iteration = index + 1;
    const pluginId = `${pluginIdPrefix}-${String(iteration).padStart(2, "0")}`;
    const runStartedAt = Date.now();
    const child = await runValidationOnce({
      baseUrl,
      pluginId,
      registerFileName,
      registerPageId,
      registerPageName,
      sseTimeoutMs,
      wsTimeoutMs,
      fallbackWaitMs,
      selectionWaitMs
    });
    const durationMs = Date.now() - runStartedAt;
    const record = summarizeRun({ iteration, pluginId, durationMs, child });
    summary.runs.push(record);
    summary.durationMs = Date.now() - startedAt;
    summary.passed += record.ok ? 1 : 0;
    summary.failed += record.ok ? 0 : 1;
    summary.minDurationMs =
      summary.minDurationMs === null ? durationMs : Math.min(summary.minDurationMs, durationMs);
    summary.maxDurationMs =
      summary.maxDurationMs === null ? durationMs : Math.max(summary.maxDurationMs, durationMs);
    if (!record.ok) {
      summary.failures.push({
        iteration,
        pluginId,
        error: record.error,
        failureCount: record.failureCount
      });
      if (!summary.firstFailure) {
        summary.firstFailure = record;
      }
    }

    console.error(
      `[soak] ${iteration}/${iterations} ${record.ok ? "ok" : "fail"} ${pluginId} ${durationMs}ms`
    );

    if (!record.ok && failFast) {
      break;
    }

    if (iteration < iterations) {
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
      if (delayMs + jitter > 0) {
        await sleep(delayMs + jitter);
      }
    }
  }

  summary.avgDurationMs =
    summary.runs.length > 0
      ? Math.round(summary.runs.reduce((total, run) => total + run.durationMs, 0) / summary.runs.length)
      : 0;
  summary.ok = summary.runs.length === iterations && summary.failed === 0;

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
