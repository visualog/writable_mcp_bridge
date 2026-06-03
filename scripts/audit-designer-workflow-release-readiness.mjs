#!/usr/bin/env node

import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDesignerWorkflowReleaseAudit,
  buildDesignerWorkflowReleaseAuditMarkdown
} from "../src/designer-workflow-release-audit.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) {
      continue;
    }
    const separator = entry.indexOf("=");
    if (separator >= 0) {
      options[entry.slice(2, separator)] = entry.slice(separator + 1);
      continue;
    }
    const key = entry.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = "true";
    }
  }
  return options;
}

async function readJsonFile(filePath) {
  if (!filePath) {
    return null;
  }
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function fetchJson(baseUrl, pathname) {
  const response = await fetch(`${baseUrl.replace(/\/+$/u, "")}${pathname}`);
  return response.json();
}

async function findLatestRunArtifact(fileName) {
  const runsDir = path.join(repoRoot, "docs", "qa", "runs");
  const entries = await readdir(runsDir, { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const candidate = path.join(runsDir, entry.name, fileName);
    const details = await stat(candidate).catch(() => null);
    if (details) {
      candidates.push({ filePath: candidate, mtimeMs: details.mtimeMs });
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0] || null;
}

async function findLatestAssistantUiSnapshot() {
  const runsDir = path.join(repoRoot, "docs", "qa", "runs");
  const entries = await readdir(runsDir, { withFileTypes: true }).catch(() => []);
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("assistant-response-ui-")) {
      continue;
    }
    const candidate = path.join(runsDir, entry.name, "snapshot.json");
    const details = await stat(candidate).catch(() => null);
    if (details) {
      candidates.push({ filePath: candidate, mtimeMs: details.mtimeMs });
    }
  }
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0] || null;
}

function defaultVerification() {
  return {
    npmTest: {
      status: "missing",
      detail: "Run npm test and pass its result through --verification-json."
    },
    assistantUi: {
      status: "missing",
      detail: "Run qa:assistant-ui-snapshot or ui-designer-contract tests and pass evidence through --verification-json."
    },
    ragEvidence: {
      status: "missing",
      detail: "Run RAG01/live Designer Workflow QA and pass evidence through --verification-json."
    }
  };
}

async function loadRuntimeInputs(args) {
  const baseUrl = String(args["base-url"] || process.env.BASE_URL || "http://127.0.0.1:3846");
  const health = args["health-json"]
    ? await readJsonFile(args["health-json"])
    : await fetchJson(baseUrl, "/health");
  const sessions = args["sessions-json"]
    ? await readJsonFile(args["sessions-json"])
    : await fetchJson(baseUrl, "/api/sessions?includeStale=true");
  const discoveredResults = args.results ? null : await findLatestRunArtifact("results.json");
  const resultsPath = args.results || discoveredResults?.filePath || null;
  const readinessPath =
    args.readiness ||
    (!args.results ? (await findLatestRunArtifact("live-readiness.json"))?.filePath || null : null);
  const discoveredReadiness =
    !args.readiness && !args.results && readinessPath
      ? await stat(readinessPath).catch(() => null)
      : null;
  const results = resultsPath ? await readJsonFile(resultsPath) : null;
  const readiness = readinessPath ? await readJsonFile(readinessPath) : null;
  const discoveredAssistantUiSnapshot = args["assistant-ui-snapshot"]
    ? null
    : await findLatestAssistantUiSnapshot();
  const assistantUiSnapshotPath =
    args["assistant-ui-snapshot"] || discoveredAssistantUiSnapshot?.filePath || null;
  const assistantUiSnapshot = assistantUiSnapshotPath
    ? await readJsonFile(assistantUiSnapshotPath)
    : null;
  const explicitAssistantUiSnapshotStat = args["assistant-ui-snapshot"]
    ? await stat(assistantUiSnapshotPath).catch(() => null)
    : null;
  const explicitResultsStat = args.results ? await stat(resultsPath).catch(() => null) : null;
  const explicitReadinessStat = args.readiness ? await stat(readinessPath).catch(() => null) : null;
  const verification = {
    ...defaultVerification(),
    ...(args["verification-json"] ? await readJsonFile(args["verification-json"]) : {})
  };
  return {
    health,
    sessions,
    results,
    readiness,
    assistantUiSnapshot,
    verification,
    artifactSources: {
      resultsPath,
      readinessPath,
      assistantUiSnapshotPath,
      resultsMtimeMs: discoveredResults?.mtimeMs || explicitResultsStat?.mtimeMs || null,
      readinessMtimeMs: discoveredReadiness?.mtimeMs || explicitReadinessStat?.mtimeMs || null,
      assistantUiSnapshotMtimeMs:
        discoveredAssistantUiSnapshot?.mtimeMs || explicitAssistantUiSnapshotStat?.mtimeMs || null
    },
    sources: {
      resultsPath,
      readinessPath
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputJson =
    args["output-json"] ||
    path.join(repoRoot, "docs", "qa", "release-readiness-latest.json");
  const outputMarkdown =
    args["output-md"] ||
    path.join(repoRoot, "docs", "qa", "release-readiness-latest.md");

  const inputs = await loadRuntimeInputs(args);
  const audit = buildDesignerWorkflowReleaseAudit(inputs);
  audit.sources = inputs.artifactSources || inputs.sources;
  const markdown = buildDesignerWorkflowReleaseAuditMarkdown(audit);

  await mkdir(path.dirname(outputJson), { recursive: true });
  await mkdir(path.dirname(outputMarkdown), { recursive: true });
  await writeFile(outputJson, `${JSON.stringify(audit, null, 2)}\n`, "utf8");
  await writeFile(outputMarkdown, markdown, "utf8");

  console.log(
    JSON.stringify(
      {
        ok: audit.ok,
        status: audit.status,
        reason: audit.reason,
        outputJson,
        outputMarkdown,
        sources: audit.sources
      },
      null,
      2
    )
  );
  if (!audit.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
