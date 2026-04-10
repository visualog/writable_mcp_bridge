#!/usr/bin/env node

function getArg(name, fallback = undefined) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) {
    return fallback;
  }
  return process.argv[idx + 1] ?? fallback;
}

function normalizeBase(url) {
  return String(url || "http://127.0.0.1:3846").replace(/\/+$/, "");
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText} (${url})`);
  }
  return response.json();
}

function buildSmokeReferenceAnalysis() {
  return {
    width: 1440,
    height: 960,
    backgroundColor: "#F7F8FA",
    sections: [
      { type: "navigation", name: "sidebar", headerTitle: "Workspace" },
      { type: "header", name: "topbar", headerTitle: "Adrian Bert - CRM Dashboard" },
      {
        type: "table",
        name: "project-list",
        density: "compact",
        tableColumns: [
          { key: "task", label: "Task", width: 260, align: "min" },
          { key: "description", label: "Description", width: 260, align: "min" },
          { key: "assignee", label: "Assignee", width: 140, align: "min" },
          { key: "due_date", label: "Due Date", width: 150, align: "min" },
          { key: "priority", label: "Priority", width: 120, align: "min" },
          { key: "progress", label: "Progress", width: 140, align: "max" }
        ],
        tableRowPattern: ["media-row", "text", "avatar-stack", "text", "status-chip", "progress-bar"]
      },
      {
        type: "actions",
        name: "footer-actions",
        actionGroups: [
          {
            key: "primary",
            label: "Primary",
            actions: [{ label: "Create" }, { label: "Share" }]
          }
        ]
      }
    ]
  };
}

async function main() {
  const baseUrl = normalizeBase(getArg("base", process.env.XBRIDGE_BASE_URL));
  const pluginId = getArg("pluginId", process.env.XBRIDGE_PLUGIN_ID || "default");
  const parentId = getArg("parentId", process.env.XBRIDGE_PARENT_ID);
  const validationMode = getArg("validationMode", "strict");

  if (!parentId) {
    throw new Error("parentId is required. Pass --parentId <node-id> or set XBRIDGE_PARENT_ID.");
  }

  const composeName = `smoke-dashboard-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const payload = {
    pluginId,
    parentId,
    name: composeName,
    validationMode,
    referenceAnalysis: buildSmokeReferenceAnalysis()
  };

  const validation = await postJson(`${baseUrl}/api/validate-external-compose-input`, payload);
  if (!validation?.canCompose) {
    console.error("[smoke] validation failed");
    console.error(JSON.stringify(validation, null, 2));
    process.exitCode = 2;
    return;
  }

  if (validationMode === "strict" && Array.isArray(validation?.warnings) && validation.warnings.length > 0) {
    console.error("[smoke] strict mode blocked by warnings");
    console.error(JSON.stringify(validation.warnings, null, 2));
    process.exitCode = 3;
    return;
  }

  const compose = await postJson(`${baseUrl}/api/compose-screen-from-intents`, payload);
  const summary = {
    name: compose?.plan?.name,
    rootId: compose?.root?.id || null,
    validationReport: compose?.plan?.validationReport || null,
    compositionCount: Array.isArray(compose?.plan?.composition) ? compose.plan.composition.length : 0
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
