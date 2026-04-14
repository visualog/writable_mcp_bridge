#!/usr/bin/env node

const DEFAULT_BASE_URL = "http://127.0.0.1:3846";
const baseUrl = String(process.env.BASE_URL || process.argv[2] || DEFAULT_BASE_URL).replace(/\/+$/, "");

async function fetchJson(pathname, { timeoutMs = 2500 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${pathname}`, {
      signal: controller.signal,
      headers: {
        accept: "application/json"
      }
    });
    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (error) {
      body = { raw: text };
    }
    return {
      ok: response.ok,
      status: response.status,
      body
    };
  } finally {
    clearTimeout(timer);
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildRecommendations({ health, runtime }) {
  const recommendations = [];
  const activePlugins = asArray(health?.activePlugins);
  const transportHealth = health?.transportHealth || runtime?.transportHealth || null;

  if (!health?.ok) {
    recommendations.push("Start the bridge with npm run start:keychain.");
    return recommendations;
  }

  if (!health.transportCapabilities || !health.transportHealth) {
    recommendations.push("Restart the local server from the latest xbridge checkout.");
  }

  if (activePlugins.length === 0) {
    recommendations.push("Reload or re-register the Xbridge plugin in the target Figma file.");
  } else {
    recommendations.push(`Use /api/pages?pluginId=${encodeURIComponent(activePlugins[0])} before node reads.`);
  }

  if (transportHealth?.grade === "healthy") {
    recommendations.push("Use WS-first read/detail commands and keep HTTP fallback available.");
  } else if (transportHealth?.grade) {
    recommendations.push(`Transport is ${transportHealth.grade}; prefer HTTP fallback for fragile reads.`);
  } else {
    recommendations.push("Check /api/runtime-ops for transport diagnostics.");
  }

  recommendations.push("Check docs/agent-recipes before inspecting src/server.js.");
  return recommendations;
}

async function main() {
  let healthResponse = null;
  let runtimeResponse = null;
  const failures = [];

  try {
    healthResponse = await fetchJson("/health");
  } catch (error) {
    failures.push({
      step: "health",
      message: error instanceof Error ? error.message : String(error)
    });
  }

  if (healthResponse?.ok) {
    try {
      runtimeResponse = await fetchJson("/api/runtime-ops?staleLimit=3");
    } catch (error) {
      failures.push({
        step: "runtime-ops",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  const health = healthResponse?.body || null;
  const runtime = runtimeResponse?.body?.result || null;
  const activePlugins = asArray(health?.activePlugins);
  const transportHealth = health?.transportHealth || runtime?.transportHealth || null;
  const ok = Boolean(
    healthResponse?.ok &&
      health?.ok === true &&
      health?.server === "writable-mcp-bridge" &&
      health?.serverVersion &&
      health?.transportCapabilities &&
      health?.transportHealth
  );

  const summary = {
    ok,
    baseUrl,
    server: health?.server || null,
    serverVersion: health?.serverVersion || null,
    packageVersion: health?.packageVersion || null,
    activePlugins,
    transportHealth: transportHealth
      ? {
          grade: transportHealth.grade || null,
          summary: transportHealth.summary || null,
          activeClients: transportHealth.activeClients || null,
          fallbackRate: transportHealth.fallbackRate ?? null,
          recent: transportHealth.recent || null
        }
      : null,
    runtimeOpsOk: Boolean(runtimeResponse?.ok && runtimeResponse?.body?.ok),
    failures,
    recommendedNext: buildRecommendations({ health, runtime })
  };

  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  console.log(
    JSON.stringify(
      {
        ok: false,
        baseUrl,
        failures: [
          {
            step: "fatal",
            message: error instanceof Error ? error.message : String(error)
          }
        ],
        recommendedNext: ["Start the bridge with npm run start:keychain."]
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
