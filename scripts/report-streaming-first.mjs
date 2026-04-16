#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const validatorPath = path.join(__dirname, "validate-streaming-first.mjs");
const soakValidatorPath = path.join(__dirname, "validate-streaming-first-soak.mjs");

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) {
      continue;
    }
    const separator = entry.indexOf("=");
    if (separator === -1) {
      const key = entry.slice(2);
      const next = argv[index + 1];
      if (next && !next.startsWith("--")) {
        options[key] = next;
        index += 1;
      } else {
        options[key] = "true";
      }
      continue;
    }
    options[entry.slice(2, separator)] = entry.slice(separator + 1);
  }
  return options;
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

function fetchJson(baseUrl, pathname) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn("curl", ["-sS", "-w", "\\n%{http_code}", `${baseUrl}${pathname}`], {
      cwd: repoRoot,
      env: process.env,
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
      reject(error);
    });

    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${pathname} curl exited with code ${String(code)}`));
        return;
      }

      const lastNewlineIndex = stdout.lastIndexOf("\n");
      const rawBody = lastNewlineIndex >= 0 ? stdout.slice(0, lastNewlineIndex) : stdout;
      const statusRaw = lastNewlineIndex >= 0 ? stdout.slice(lastNewlineIndex + 1).trim() : "";
      const status = Number(statusRaw);
      let body = null;
      try {
        body = rawBody ? JSON.parse(rawBody) : null;
      } catch (error) {
        reject(new Error(`${pathname} returned non-JSON payload (HTTP ${statusRaw || "?"})`));
        return;
      }

      resolve({
        path: pathname,
        status,
        ok: status >= 200 && status < 300,
        durationMs: Date.now() - startedAt,
        body
      });
    });
  });
}

function runNodeScript(scriptPath, extraArgs = [], env = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(process.execPath, [scriptPath, ...extraArgs], {
      cwd: repoRoot,
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

    child.once("error", (error) => {
      resolve({
        ok: false,
        error: error.message,
        durationMs: Date.now() - startedAt,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        summary: null
      });
    });

    child.once("exit", (code, signal) => {
      const trimmed = stdout.trim();
      let summary = null;
      if (trimmed) {
        try {
          summary = JSON.parse(trimmed);
        } catch (error) {
          summary = null;
        }
      }

      resolve({
        ok: code === 0 && (!trimmed || summary !== null),
        exitCode: code,
        signal,
        durationMs: Date.now() - startedAt,
        stdout: trimmed,
        stderr: stderr.trim(),
        summary,
        error:
          code === 0
            ? summary !== null || !trimmed
              ? null
              : "Script completed without JSON summary."
            : `Script exited with code ${String(code)}.`
      });
    });
  });
}

function buildFallbackRiskSummary(transportHealth) {
  const trend = transportHealth?.fallbackIncidenceTrend || null;
  const status = typeof trend?.status === "string" ? trend.status : null;
  if (!status) {
    return null;
  }
  if (status === "high") {
    return {
      status,
      level: "high",
      summary: "polling fallback 압력이 높습니다.",
      nextAction: "WS 연결/세션 상태와 queue backlog를 즉시 점검하세요."
    };
  }
  if (status === "watch") {
    return {
      status,
      level: "watch",
      summary: "fallback 비중이 올라 추세 관찰이 필요합니다.",
      nextAction: "runtime-ops의 fallback trend와 command readiness를 함께 확인하세요."
    };
  }
  return {
    status,
    level: "stable",
    summary: "fallback 비중이 안정 범위입니다.",
    nextAction: "현재 추세를 유지하며 주기적으로 health/runtime-ops를 확인하세요."
  };
}

function buildCommandReadinessRiskSummary(commandReadiness) {
  const status = typeof commandReadiness?.status === "string" ? commandReadiness.status : null;
  if (!status) {
    return null;
  }
  const reason = typeof commandReadiness?.reason === "string" ? commandReadiness.reason : "unknown";
  if (status === "unavailable") {
    return {
      status,
      level: "high",
      reason,
      summary: "명령 처리 경로가 준비되지 않았습니다.",
      nextAction: "활성 plugin session과 연결 상태를 먼저 복구하세요."
    };
  }
  if (status === "degraded") {
    return {
      status,
      level: "watch",
      reason,
      summary: "명령 응답 품질이 저하될 수 있습니다.",
      nextAction: "recovery/pending queue/최근 만료 신호를 우선 점검하세요."
    };
  }
  return {
    status,
    level: "stable",
    reason,
    summary: "명령 처리 준비 상태가 양호합니다.",
    nextAction: "현재 상태를 유지하면서 최근 실패/만료 신호만 모니터링하세요."
  };
}

function buildFallbackPolicyTuningSummary({ queue, transportHealth, commandReadiness }) {
  const policy = queue?.pollingFallbackPolicy || null;
  if (!policy || typeof policy !== "object") {
    return {
      mode: "unknown",
      summary: "fallback policy 튜닝 상태를 아직 수집하지 못했습니다.",
      nextAction: "runtime-ops queue.pollingFallbackPolicy 노출 여부를 확인하세요.",
      wsGuardMode: "unknown"
    };
  }

  const multipliers = policy.multipliers || {};
  const criticalMultiplier = Number(multipliers.critical);
  const standardMultiplier = Number(multipliers.standard);
  const detailMultiplier = Number(multipliers.detail);
  const hasAdaptiveShape =
    Number.isFinite(criticalMultiplier) &&
    Number.isFinite(standardMultiplier) &&
    Number.isFinite(detailMultiplier) &&
    (criticalMultiplier !== standardMultiplier || standardMultiplier !== detailMultiplier);
  const modeRaw = String(policy.mode || "").toLowerCase();
  const autoTuningFlag = policy.autoTuning === true;
  const mode =
    modeRaw === "auto" || autoTuningFlag || hasAdaptiveShape
      ? "auto"
      : modeRaw === "fixed" || modeRaw === "manual"
        ? "fixed"
        : "fixed";

  const deferredByWsGuard = Number(queue?.deferredByWsGuard || 0);
  const wsActive = Number(transportHealth?.activeClients?.ws || 0);
  const readinessStatus = String(commandReadiness?.status || "unknown");
  const wsGuardMode =
    deferredByWsGuard > 0
      ? "active"
      : wsActive > 0 && readinessStatus === "ready"
        ? "standby"
        : wsActive === 0 || readinessStatus === "unavailable"
          ? "bypass"
          : "passive";
  const policySummary = Number.isFinite(Number(policy.baseGraceMs))
    ? `base ${String(policy.baseGraceMs)}ms · x${String(multipliers.critical ?? "-")}/x${String(
        multipliers.standard ?? "-"
      )}/x${String(multipliers.detail ?? "-")}`
    : "base/multiplier 미표시";

  return {
    mode,
    wsGuardMode,
    policySummary,
    summary:
      mode === "auto"
        ? "fallback policy가 자동 튜닝 모드입니다."
        : "fallback policy가 고정 튜닝 모드입니다.",
    nextAction:
      mode === "auto"
        ? "ws-guard mode와 deferred 카운터가 급증하는지 함께 모니터링하세요."
        : "고정 모드이므로 fallback trend 상승 시 multiplier 재조정이 필요할 수 있습니다."
  };
}

function buildOperationalStateSummary({
  transportHealth,
  commandReadiness,
  fallbackRisk,
  activePluginTotal = 0
}) {
  const transportGrade = typeof transportHealth?.grade === "string" ? transportHealth.grade : null;
  const activeClientTotal = Number(transportHealth?.activeClients?.total || 0);
  const readinessStatus =
    typeof commandReadiness?.status === "string" ? commandReadiness.status : "unknown";
  const fallbackStatus = typeof fallbackRisk?.status === "string" ? fallbackRisk.status : "unknown";
  const connected = activeClientTotal > 0 || activePluginTotal > 0 || transportGrade === "healthy";
  const commandReady = readinessStatus === "ready";
  const degraded =
    readinessStatus === "degraded" ||
    readinessStatus === "unavailable" ||
    transportGrade === "degraded" ||
    transportGrade === "unhealthy" ||
    fallbackStatus === "high";
  const fallbackPhase =
    fallbackStatus === "high" && (readinessStatus === "unavailable" || transportGrade === "unhealthy")
      ? "outage"
      : fallbackStatus === "watch" || (fallbackStatus === "high" && commandReady)
        ? "recovery"
        : fallbackStatus === "stable"
          ? "normal"
          : "unknown";

  return {
    connected: connected ? "connected" : "disconnected",
    command: commandReady ? "command-ready" : "command-not-ready",
    health: degraded ? "degraded" : "healthy",
    fallbackPhase,
    summary: `${connected ? "connected" : "disconnected"} · ${
      commandReady ? "command-ready" : "command-not-ready"
    } · ${degraded ? "degraded" : "healthy"} · fallback ${fallbackPhase}`,
    nextAction:
      fallbackPhase === "outage"
        ? "즉시 WS/session/queue 상태를 점검하고 polling fallback 장애 여부를 확인하세요."
        : fallbackPhase === "recovery"
          ? "복구 중 상태입니다. fallback 추세와 command readiness가 stable로 돌아오는지 확인하세요."
          : "정상 상태입니다. 추세 변화만 모니터링하세요."
  };
}

function buildSummary(report) {
  const health = report.snapshots.health?.body || null;
  const runtimeOps = report.snapshots.runtimeOps?.body?.result || null;
  const sessions = Array.isArray(report.snapshots.sessions?.body?.sessions)
    ? report.snapshots.sessions.body.sessions
    : [];
  const pluginUiMetrics = Array.isArray(runtimeOps?.pluginUiMetrics) ? runtimeOps.pluginUiMetrics : [];
  const transportHealth = runtimeOps?.transportHealth || health?.transportHealth || null;
  const commandReadiness = runtimeOps?.commandReadiness || health?.commandReadiness || null;
  const queue = runtimeOps?.queue || null;
  const fallbackRisk = buildFallbackRiskSummary(transportHealth);
  const commandReadinessRisk = buildCommandReadinessRiskSummary(commandReadiness);
  const fallbackPolicyTuning = buildFallbackPolicyTuningSummary({
    queue,
    transportHealth,
    commandReadiness
  });
  const activePluginTotal = Array.isArray(health?.activePlugins) ? health.activePlugins.length : 0;
  const operationalState = buildOperationalStateSummary({
    transportHealth,
    commandReadiness,
    fallbackRisk,
    activePluginTotal
  });

  return {
    server: health?.server || null,
    serverVersion: health?.serverVersion || null,
    transportGrade: transportHealth?.grade || null,
    transportSummary:
      transportHealth?.summary || null,
    activePlugins: activePluginTotal,
    sessionsTracked: sessions.length,
    pluginUiMetricsTracked: pluginUiMetrics.length,
    queuePendingTotal: runtimeOps?.queue?.pendingTotal ?? null,
    currentReadHealth: runtimeOps?.currentReadHealth || health?.currentReadHealth || null,
    fallbackIncidenceTrend: transportHealth?.fallbackIncidenceTrend || null,
    commandReadinessStatus: commandReadiness?.status || null,
    fallbackRisk,
    commandReadinessRisk,
    fallbackPolicyTuning,
    operationalState
  };
}

async function maybeWriteOutput(targetPath, payload) {
  if (!targetPath) {
    return;
  }
  const absolutePath = path.isAbsolute(targetPath)
    ? targetPath
    : path.join(repoRoot, targetPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

const args = parseArgs(process.argv.slice(2));
const baseUrl = String(args["base-url"] || process.env.BASE_URL || "http://127.0.0.1:3846").replace(
  /\/+$/,
  ""
);
const outputPath = args.output || process.env.OUTPUT_PATH || null;
const shouldValidate = parseBoolean(args.validate, false);
const shouldSoak = parseBoolean(args.soak, false);
const profile = String(args.profile || process.env.SOAK_PROFILE || "standard").trim() || "standard";

const report = {
  ok: true,
  collectedAt: new Date().toISOString(),
  baseUrl,
  snapshots: {},
  summary: null,
  validation: null,
  soak: null
};

try {
  report.snapshots.health = await fetchJson(baseUrl, "/health");
  report.snapshots.runtimeOps = await fetchJson(baseUrl, "/api/runtime-ops?staleLimit=5");
  report.snapshots.sessions = await fetchJson(baseUrl, "/api/sessions?includeStale=true");
  report.ok =
    report.snapshots.health.ok &&
    report.snapshots.runtimeOps.ok &&
    report.snapshots.sessions.ok;
  report.summary = buildSummary(report);

  if (shouldValidate) {
    report.validation = await runNodeScript(validatorPath, [], {
      BASE_URL: baseUrl
    });
    if (!report.validation.ok) {
      report.ok = false;
    }
  }

  if (shouldSoak) {
    report.soak = await runNodeScript(soakValidatorPath, [`--profile=${profile}`], {
      BASE_URL: baseUrl
    });
    if (!report.soak.ok) {
      report.ok = false;
    }
  }
} catch (error) {
  report.ok = false;
  report.error = error instanceof Error ? error.message : String(error);
}

await maybeWriteOutput(outputPath, report);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) {
  process.exitCode = 1;
}
