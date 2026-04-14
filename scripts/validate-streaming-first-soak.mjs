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

const PROFILE_PRESETS = {
  quick: {
    iterations: 2,
    delayMs: 0,
    jitterMs: 0,
    failFast: true,
    sseTimeoutMs: 1500,
    wsTimeoutMs: 2500,
    fallbackWaitMs: 300,
    selectionWaitMs: 2000
  },
  standard: {
    iterations: 20,
    delayMs: 2500,
    jitterMs: 250,
    failFast: false,
    sseTimeoutMs: 1800,
    wsTimeoutMs: 3000,
    fallbackWaitMs: 500,
    selectionWaitMs: 3000
  },
  long: {
    iterations: 50,
    delayMs: 3000,
    jitterMs: 750,
    failFast: false,
    sseTimeoutMs: 2000,
    wsTimeoutMs: 3500,
    fallbackWaitMs: 500,
    selectionWaitMs: 3500
  }
};

function resolveConfiguredValue({ arg, env, profileValue, fallback, parser }) {
  if (arg !== undefined) {
    return parser(arg, fallback);
  }
  if (env !== undefined) {
    return parser(env, fallback);
  }
  if (profileValue !== undefined) {
    return profileValue;
  }
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickNumericMax(current, candidate) {
  if (candidate === null || candidate === undefined || Number.isNaN(candidate)) {
    return current;
  }
  return current === null ? candidate : Math.max(current, candidate);
}

function summarizeResourceUsage(runs) {
  const summary = {
    peakRssBytes: null,
    peakHeapUsedBytes: null,
    peakHeapTotalBytes: null,
    peakExternalBytes: null,
    peakArrayBuffersBytes: null,
    maxActiveHandleCount: null,
    maxActiveRequestCount: null,
    peakCpuUserMicros: null,
    peakCpuSystemMicros: null
  };

  for (const run of runs) {
    const resourceUsage = run.resourceUsage;
    if (!resourceUsage) {
      continue;
    }
    summary.peakRssBytes = pickNumericMax(summary.peakRssBytes, resourceUsage.rssBytes);
    summary.peakHeapUsedBytes = pickNumericMax(summary.peakHeapUsedBytes, resourceUsage.heapUsedBytes);
    summary.peakHeapTotalBytes = pickNumericMax(summary.peakHeapTotalBytes, resourceUsage.heapTotalBytes);
    summary.peakExternalBytes = pickNumericMax(summary.peakExternalBytes, resourceUsage.externalBytes);
    summary.peakArrayBuffersBytes = pickNumericMax(
      summary.peakArrayBuffersBytes,
      resourceUsage.arrayBuffersBytes
    );
    summary.maxActiveHandleCount = pickNumericMax(
      summary.maxActiveHandleCount,
      resourceUsage.activeHandleCount
    );
    summary.maxActiveRequestCount = pickNumericMax(
      summary.maxActiveRequestCount,
      resourceUsage.activeRequestCount
    );
    summary.peakCpuUserMicros = pickNumericMax(summary.peakCpuUserMicros, resourceUsage.cpuUserMicros);
    summary.peakCpuSystemMicros = pickNumericMax(
      summary.peakCpuSystemMicros,
      resourceUsage.cpuSystemMicros
    );
  }

  return summary;
}

function summarizeRun({ iteration, pluginId, durationMs, child }) {
  const summary = child.summary || {};
  const failures = Array.isArray(summary.failures) ? summary.failures : [];
  return {
    iteration,
    pluginId,
    durationMs,
    startedAt: summary.startedAt ?? null,
    finishedAt: summary.finishedAt ?? null,
    ok: child.ok,
    exitCode: child.exitCode ?? null,
    healthOk: Boolean(summary.health?.ok),
    runtimeOpsOk: Boolean(summary.runtimeOps?.ok),
    parityOk: Boolean(summary.parity?.ok),
    sseOk: Boolean(summary.sse?.ok),
    wsOk: Boolean(summary.ws?.ok),
    failureCount: failures.length,
    failures: failures.slice(0, 8),
    error: child.error || null,
    resourceUsage: summary.resourceUsage || null
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
const profileNameRaw = String(args.profile || process.env.SOAK_PROFILE || "").trim().toLowerCase();
if (profileNameRaw && !Object.prototype.hasOwnProperty.call(PROFILE_PRESETS, profileNameRaw)) {
  console.error(
    `Unknown soak profile "${profileNameRaw}". Expected one of: ${Object.keys(PROFILE_PRESETS).join(", ")}.`
  );
  process.exitCode = 1;
  process.exit(1);
}
const profileName = profileNameRaw || null;
const profilePreset = profileName ? PROFILE_PRESETS[profileName] : {};
const baseUrl = String(args["base-url"] || process.env.BASE_URL || "http://127.0.0.1:3846").replace(/\/+$/, "");
const pluginIdPrefix = String(
  args["plugin-id-prefix"] || process.env.SOAK_PLUGIN_ID_PREFIX || "page:streaming-first-soak"
);
const iterations = Math.max(
  1,
  resolveConfiguredValue({
    arg: args.iterations,
    env: process.env.SOAK_ITERATIONS,
    profileValue: profilePreset.iterations,
    fallback: 6,
    parser: parseNumber
  })
);
const concurrency = Math.max(1, parseNumber(args.concurrency || process.env.SOAK_CONCURRENCY, 1));
const delayMs = Math.max(
  0,
  resolveConfiguredValue({
    arg: args["delay-ms"],
    env: process.env.SOAK_DELAY_MS,
    profileValue: profilePreset.delayMs,
    fallback: 2500,
    parser: parseNumber
  })
);
const jitterMs = Math.max(
  0,
  resolveConfiguredValue({
    arg: args["jitter-ms"],
    env: process.env.SOAK_JITTER_MS,
    profileValue: profilePreset.jitterMs,
    fallback: 0,
    parser: parseNumber
  })
);
const failFast = resolveConfiguredValue({
  arg: args["fail-fast"],
  env: process.env.SOAK_FAIL_FAST,
  profileValue: profilePreset.failFast,
  fallback: false,
  parser: parseBoolean
});
const registerFileName = String(
  args["register-file-name"] || process.env.REGISTER_FILE_NAME || "Streaming First Soak"
);
const registerPageId = String(
  args["register-page-id"] || process.env.REGISTER_PAGE_ID || "streaming-first-soak"
);
const registerPageName = String(
  args["register-page-name"] || process.env.REGISTER_PAGE_NAME || "Soak"
);
const sseTimeoutMs = Math.max(
  500,
  resolveConfiguredValue({
    arg: args["sse-timeout-ms"],
    env: process.env.SSE_TIMEOUT_MS,
    profileValue: profilePreset.sseTimeoutMs,
    fallback: 1800,
    parser: parseNumber
  })
);
const wsTimeoutMs = Math.max(
  500,
  resolveConfiguredValue({
    arg: args["ws-timeout-ms"],
    env: process.env.WS_TIMEOUT_MS,
    profileValue: profilePreset.wsTimeoutMs,
    fallback: 3000,
    parser: parseNumber
  })
);
const fallbackWaitMs = Math.max(
  0,
  resolveConfiguredValue({
    arg: args["fallback-wait-ms"],
    env: process.env.POLLING_FALLBACK_WAIT_MS,
    profileValue: profilePreset.fallbackWaitMs,
    fallback: 500,
    parser: parseNumber
  })
);
const selectionWaitMs = Math.max(
  500,
  resolveConfiguredValue({
    arg: args["selection-wait-ms"],
    env: process.env.SELECTION_WAIT_MS,
    profileValue: profilePreset.selectionWaitMs,
    fallback: 3000,
    parser: parseNumber
  })
);

async function run() {
  const startedAt = Date.now();
  const summary = {
    ok: false,
    profile: profileName,
    baseUrl,
    pluginIdPrefix,
    iterations,
    completedIterations: 0,
    concurrencyRequested: concurrency,
    concurrencyEffective: Math.min(concurrency, iterations),
    delayMs,
    jitterMs,
    failFast,
    config: {
      registerFileName,
      registerPageId,
      registerPageName,
      sseTimeoutMs,
      wsTimeoutMs,
      fallbackWaitMs,
      selectionWaitMs
    },
    runs: [],
    passed: 0,
    failed: 0,
    minDurationMs: null,
    maxDurationMs: null,
    avgDurationMs: null,
    durationMs: 0,
    totalDelayMs: 0,
    firstFailure: null,
    failures: [],
    concurrency: {
      maxInFlightObserved: 0
    },
    resourceUsage: null
  };

  for (let batchStart = 0; batchStart < iterations; batchStart += summary.concurrencyEffective) {
    const batchEnd = Math.min(iterations, batchStart + summary.concurrencyEffective);
    const batchPromises = [];
    let inFlight = 0;

    for (let index = batchStart; index < batchEnd; index += 1) {
      const iteration = index + 1;
      const pluginId = `${pluginIdPrefix}-${String(iteration).padStart(2, "0")}`;
      const runStartedAt = Date.now();
      inFlight += 1;
      summary.concurrency.maxInFlightObserved = Math.max(
        summary.concurrency.maxInFlightObserved,
        inFlight
      );
      batchPromises.push(
        runValidationOnce({
          baseUrl,
          pluginId,
          registerFileName,
          registerPageId,
          registerPageName,
          sseTimeoutMs,
          wsTimeoutMs,
          fallbackWaitMs,
          selectionWaitMs
        }).then((child) => {
          const durationMs = Date.now() - runStartedAt;
          const record = summarizeRun({ iteration, pluginId, durationMs, child });
          return { iteration, pluginId, durationMs, record };
        }).finally(() => {
          inFlight -= 1;
        })
      );
    }

    const batchResults = await Promise.all(batchPromises);
    for (const result of batchResults) {
      const { iteration, pluginId, durationMs, record } = result;
      summary.runs[iteration - 1] = record;
      summary.durationMs = Date.now() - startedAt;
      summary.completedIterations = summary.runs.filter(Boolean).length;
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
        `[soak] ${iteration}/${iterations} ${record.ok ? "ok" : "fail"} ${pluginId} ${durationMs}ms elapsed=${summary.durationMs}ms inFlight<=${summary.concurrency.maxInFlightObserved}`
      );
    }

    if (summary.failures.length > 0 && failFast) {
      break;
    }

    if (batchEnd < iterations) {
      const jitter = jitterMs > 0 ? Math.floor(Math.random() * (jitterMs + 1)) : 0;
      const waitMs = delayMs + jitter;
      if (waitMs > 0) {
        summary.totalDelayMs += waitMs;
        await sleep(waitMs);
      }
    }
  }

  summary.runs = summary.runs.filter(Boolean);
  summary.avgDurationMs =
    summary.runs.length > 0
      ? Math.round(summary.runs.reduce((total, run) => total + run.durationMs, 0) / summary.runs.length)
      : 0;
  summary.ok = summary.runs.length === iterations && summary.failed === 0;
  summary.resourceUsage = summarizeResourceUsage(summary.runs);

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = summary.ok ? 0 : 1;
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
