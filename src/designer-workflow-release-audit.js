export function buildReleaseRequiredCaseIds() {
  return [
    "RAG01",
    "DS01",
    ...Array.from({ length: 31 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`),
    "N01-N06"
  ];
}

function hasReadbackEvidence(entry) {
  const evidence = entry?.readbackEvidence;
  return Boolean(
    evidence &&
      typeof evidence === "object" &&
      !Array.isArray(evidence) &&
      Object.keys(evidence).length > 0
  );
}

function normalizeVerificationGate(input, fallbackLabel) {
  const status = input?.status === "pass" ? "pass" : input?.status || "missing";
  return {
    status,
    detail: input?.detail || `${fallbackLabel} evidence is missing.`
  };
}

const REQUIRED_ASSISTANT_UI_CHECKS = [
  "requiredSectionsPresent",
  "knowledgeCardRendered",
  "issueCardRendered",
  "actionCardRendered",
  "knowledgeFilterRendered",
  "referenceTextNotSplitIntoFakeSections"
];

function evaluateAssistantResponseUx({ verification = {}, assistantUiSnapshot = null } = {}) {
  const snapshotChecks = assistantUiSnapshot?.checks;
  if (!snapshotChecks || typeof snapshotChecks !== "object" || Array.isArray(snapshotChecks)) {
    return {
      status: "missing",
      detail: "Run npm run qa:assistant-ui-snapshot and pass the generated snapshot.json into release readiness."
    };
  }
  const failedChecks = REQUIRED_ASSISTANT_UI_CHECKS.filter((key) => snapshotChecks[key] !== true);
  if (failedChecks.length > 0) {
    return {
      status: "fail",
      detail: `Assistant response UI snapshot checks failed: ${failedChecks.join(", ")}`,
      failedChecks
    };
  }
  const verificationDetail = verification.assistantUi?.detail;
  return {
    status: "pass",
    detail: verificationDetail
      ? `${verificationDetail}; snapshot checks passed: ${REQUIRED_ASSISTANT_UI_CHECKS.join(", ")}`
      : `Assistant response UI snapshot checks passed: ${REQUIRED_ASSISTANT_UI_CHECKS.join(", ")}`,
    generatedAt: assistantUiSnapshot.generatedAt || null,
    checks: snapshotChecks
  };
}

function findCaseById(results, id) {
  return (Array.isArray(results?.cases) ? results.cases : []).find((entry) => entry?.id === id) || null;
}

function evaluateRagEvidence({ results, verification = {} } = {}) {
  const ragCase = findCaseById(results, "RAG01");
  const references = Array.isArray(ragCase?.readbackEvidence?.knowledgeReferences)
    ? ragCase.readbackEvidence.knowledgeReferences
    : [];
  const documentChunkReferences = references.filter((entry) => entry?.sourceKind === "document_chunk");

  if (!ragCase) {
    return {
      status: "missing",
      detail: "RAG01 live QA case is missing from Designer Workflow results."
    };
  }
  if (ragCase.status !== "pass") {
    return {
      status: "fail",
      detail: `RAG01 did not pass. status=${ragCase.status || "-"}`
    };
  }
  if (documentChunkReferences.length < 1) {
    return {
      status: "missing",
      detail: "RAG01 readback evidence must include knowledgeReferences with sourceKind=document_chunk.",
      knowledgeReferenceCount: references.length
    };
  }

  const verificationDetail =
    verification.ragEvidence?.status === "pass" ? verification.ragEvidence.detail : null;
  return {
    status: "pass",
    detail: verificationDetail
      ? `${verificationDetail}; RAG01 document_chunk references=${documentChunkReferences.length}`
      : `RAG01 document_chunk references=${documentChunkReferences.length}`,
    knowledgeReferenceCount: references.length,
    documentChunkReferenceCount: documentChunkReferences.length,
    sourcePaths: documentChunkReferences.map((entry) => entry.sourcePath).filter(Boolean)
  };
}

function parseTimestampMs(value) {
  if (!value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveResultsTimestampMs(results, artifactSources) {
  return (
    parseTimestampMs(results?.summary?.runStamp) ||
    (Number.isFinite(artifactSources?.resultsMtimeMs) ? artifactSources.resultsMtimeMs : null)
  );
}

function deriveReadinessTimestampMs(readiness, artifactSources) {
  return (
    parseTimestampMs(readiness?.runStamp) ||
    (Number.isFinite(artifactSources?.readinessMtimeMs) ? artifactSources.readinessMtimeMs : null)
  );
}

function collectLivePluginIds({ health, sessions }) {
  const fromHealth = health?.activeSessionResolution?.livePluginIds;
  const liveIds = new Set(Array.isArray(fromHealth) ? fromHealth : []);
  for (const entry of Array.isArray(sessions?.sessions) ? sessions.sessions : []) {
    if (entry?.pluginId) {
      liveIds.add(entry.pluginId);
    }
  }
  return [...liveIds];
}

function evaluateArtifactFreshness({ health, sessions, results, readiness, artifactSources = {} }) {
  const resultsTimestampMs = deriveResultsTimestampMs(results, artifactSources);
  const readinessTimestampMs = deriveReadinessTimestampMs(readiness, artifactSources);
  const resultsPath = artifactSources.resultsPath || null;
  const readinessPath = artifactSources.readinessPath || null;
  const resultsPluginId = results?.summary?.pluginId || null;
  const livePluginIds = collectLivePluginIds({ health, sessions });

  if (
    results &&
    readiness?.reason === "no_live_session" &&
    resultsTimestampMs &&
    readinessTimestampMs &&
    readinessTimestampMs > resultsTimestampMs
  ) {
    return {
      status: "blocked",
      reason: "newer_readiness_blocks_results",
      detail: `A newer live-readiness artifact reports no_live_session, so the older Designer Workflow results cannot be treated as current release evidence. results=${resultsPath || "-"}, readiness=${readinessPath || "-"}`,
      resultsPath,
      readinessPath,
      resultsTimestampMs,
      readinessTimestampMs
    };
  }

  if (results && resultsPluginId && livePluginIds.length > 0 && !livePluginIds.includes(resultsPluginId)) {
    return {
      status: "blocked",
      reason: "results_plugin_not_live",
      detail: `Designer Workflow results were captured from pluginId=${resultsPluginId}, but the current live plugin ids are ${livePluginIds.join(", ")}. Re-run live QA against the intended Figma file/plugin session.`,
      resultsPath,
      readinessPath,
      resultsTimestampMs,
      readinessTimestampMs,
      resultsPluginId,
      livePluginIds
    };
  }

  if (!results) {
    return {
      status: "fail",
      reason: "missing_results",
      detail: "Designer Workflow results.json evidence is missing.",
      resultsPath,
      readinessPath,
      resultsTimestampMs,
      readinessTimestampMs,
      resultsPluginId,
      livePluginIds
    };
  }

  return {
    status: "pass",
    reason: "artifact_evidence_current_enough",
    detail: `results=${resultsPath || "provided"}, readiness=${readinessPath || "-"}`,
    resultsPath,
    readinessPath,
    resultsTimestampMs,
    readinessTimestampMs,
    resultsPluginId,
    livePluginIds
  };
}

function evaluateBridgeHealth(health) {
  if (!health || health.ok !== true) {
    return {
      status: "fail",
      detail: "Bridge health endpoint did not return ok=true."
    };
  }
  return {
    status: "pass",
    detail: `server=${health.serverVersion || "-"}, transport=${health.transportHealth?.grade || "-"}, command=${health.commandReadiness?.status || "-"}, write=${health.writeReadiness?.status || "-"}`
  };
}

function evaluateLiveSession({ health, sessions, readiness }) {
  const resolution = health?.activeSessionResolution || readiness?.activeSessionResolution || {};
  const livePluginIds = Array.isArray(resolution.livePluginIds) ? resolution.livePluginIds : [];
  const sessionCount = Array.isArray(sessions?.sessions) ? sessions.sessions.length : 0;
  const hasCurrentLiveSession = livePluginIds.length > 0 || sessionCount > 0;
  if (!hasCurrentLiveSession && (readiness?.reason === "no_live_session" || resolution.reason === "no_live_session")) {
    return {
      status: "blocked",
      reason: "no_live_session",
      detail: "활성 Figma plugin session이 없어 live canvas mutation/readback 검증을 실행할 수 없습니다.",
      livePluginIds,
      sessionCount
    };
  }
  if (resolution.requiresExplicitPluginId === true || resolution.reason === "multiple_live_sessions") {
    return {
      status: "blocked",
      reason: "multiple_live_sessions",
      detail: "여러 live Figma session이 있어 XBRIDGE_QA_PLUGIN_ID를 명시해야 합니다.",
      livePluginIds,
      sessionCount
    };
  }
  if (livePluginIds.length < 1 && sessionCount < 1) {
    return {
      status: "blocked",
      reason: "no_live_session",
      detail: "활성 Figma plugin session이 없습니다.",
      livePluginIds,
      sessionCount
    };
  }
  return {
    status: "pass",
    reason: resolution.reason || "live_session_available",
    detail: `livePluginIds=${livePluginIds.join(", ") || "-"}, sessions=${sessionCount}`,
    livePluginIds,
    sessionCount
  };
}

function evaluateDesignerWorkflowRelease(results) {
  const cases = Array.isArray(results?.cases) ? results.cases : [];
  const requiredIds = buildReleaseRequiredCaseIds();
  const missingRequiredCases = [];
  const nonPassingRequiredCases = [];
  const missingEvidenceCases = [];
  const failedCases = [];

  for (const entry of cases) {
    if (entry?.status === "fail") {
      failedCases.push(entry.id || "unknown");
    }
  }

  for (const id of requiredIds) {
    const entry = cases.find((candidate) => candidate?.id === id) || null;
    if (!entry) {
      missingRequiredCases.push(id);
      continue;
    }
    if (entry.status !== "pass") {
      nonPassingRequiredCases.push(id);
      continue;
    }
    if (!hasReadbackEvidence(entry)) {
      missingEvidenceCases.push(id);
    }
  }

  const status =
    missingRequiredCases.length ||
    nonPassingRequiredCases.length ||
    missingEvidenceCases.length ||
    failedCases.length
      ? "fail"
      : "pass";

  return {
    status,
    detail:
      status === "pass"
        ? `All ${requiredIds.length} release-required Designer Workflow cases have pass status and readback evidence.`
        : "Release-required Designer Workflow evidence is incomplete.",
    requiredIds,
    totalCases: cases.length,
    missingRequiredCases,
    nonPassingRequiredCases,
    missingEvidenceCases,
    failedCases
  };
}

function buildArtifactBlockedDesignerWorkflowGate(artifactFreshness) {
  return {
    status: "blocked",
    reason: artifactFreshness?.reason || "artifact_freshness_blocked",
    detail: `Designer Workflow results are not current release evidence because artifact freshness is blocked: ${artifactFreshness?.detail || "artifact freshness is blocked."}`,
    requiredIds: buildReleaseRequiredCaseIds(),
    totalCases: 0,
    missingRequiredCases: [],
    nonPassingRequiredCases: [],
    missingEvidenceCases: [],
    failedCases: [],
    findingsUnavailableReason: "Designer Workflow evidence is not current"
  };
}

function buildArtifactBlockedRagGate(artifactFreshness) {
  return {
    status: "blocked",
    reason: artifactFreshness?.reason || "artifact_freshness_blocked",
    detail: `RAG01 evidence is not current release evidence because artifact freshness is blocked: ${artifactFreshness?.detail || "artifact freshness is blocked."}`
  };
}

function deriveAuditStatus(gates) {
  if (Object.values(gates).some((gate) => gate.status === "blocked")) {
    return "blocked";
  }
  if (Object.values(gates).some((gate) => gate.status !== "pass")) {
    return "fail";
  }
  return "pass";
}

function deriveReason(status, gates) {
  if (status === "pass") {
    return "release_ready";
  }
  if (gates.artifactFreshness?.status === "blocked") {
    return gates.artifactFreshness.reason || "artifact_freshness_blocked";
  }
  const blockedGate = Object.values(gates).find((gate) => gate.status === "blocked");
  if (blockedGate) {
    return blockedGate.reason || "blocked";
  }
  const failedGateName = Object.entries(gates).find(([, gate]) => gate.status !== "pass")?.[0];
  return failedGateName || "release_gate_failed";
}

export function buildDesignerWorkflowReleaseAudit({
  health = null,
  sessions = null,
  results = null,
  readiness = null,
  artifactSources = {},
  assistantUiSnapshot = null,
  verification = {}
} = {}) {
  const bridgeHealth = evaluateBridgeHealth(health);
  const artifactFreshness = evaluateArtifactFreshness({ health, sessions, results, readiness, artifactSources });
  const liveFigmaSession = evaluateLiveSession({ health, sessions, readiness });
  const artifactBlocked = artifactFreshness.status === "blocked";
  const gates = {
    bridgeHealth,
    artifactFreshness,
    liveFigmaSession,
    designerWorkflowRelease: artifactBlocked
      ? buildArtifactBlockedDesignerWorkflowGate(artifactFreshness)
      : evaluateDesignerWorkflowRelease(results),
    assistantResponseUx: evaluateAssistantResponseUx({ verification, assistantUiSnapshot }),
    ragEvidence: artifactBlocked ? buildArtifactBlockedRagGate(artifactFreshness) : evaluateRagEvidence({ results, verification }),
    regressionTests: normalizeVerificationGate(verification.npmTest, "npm test")
  };
  const status = deriveAuditStatus(gates);
  const reason = deriveReason(status, gates);
  return {
    ok: status === "pass",
    status,
    reason,
    summary:
      status === "pass"
        ? "Release readiness 조건을 모두 충족했습니다."
        : gates.artifactFreshness.status === "blocked"
          ? gates.artifactFreshness.detail
          : gates.liveFigmaSession.status === "blocked"
          ? gates.liveFigmaSession.detail
          : "Release readiness gate 중 실패한 항목이 있습니다.",
    gates
  };
}

function formatList(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return "-";
  }
  return value.join(", ");
}

function formatPassedGates(gates) {
  const passed = Object.entries(gates || {})
    .filter(([, gate]) => gate?.status === "pass")
    .map(([name]) => name);
  return passed.length ? passed.join(", ") : "-";
}

function appendNextLiveValidationSteps(lines, audit) {
  if (audit?.status === "pass") {
    return;
  }
  lines.push(
    "",
    "## Already Proven",
    "",
    `- Passed gates: ${formatPassedGates(audit.gates)}`,
    "",
    "## Next Live Validation Steps",
    "",
    "1. Figma에서 검증할 파일을 열고 Xbridge plugin 패널을 다시 활성화합니다.",
    "2. 브리지 상태를 확인합니다: `curl -s http://127.0.0.1:3846/health`",
    "3. live pluginId가 여러 개면 하나를 고릅니다: `XBRIDGE_QA_PLUGIN_ID=<pluginId>`",
    "4. 같은 pluginId로 live QA를 재실행합니다: `XBRIDGE_QA_PLUGIN_ID=<pluginId> node scripts/run-figma-designer-workflow-live-qa.mjs`",
    "5. UI/RAG/release gate를 다시 갱신합니다: `npm run qa:assistant-ui-snapshot` 후 `npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json`"
  );
}

function formatTimestampMs(value) {
  return Number.isFinite(value) ? new Date(value).toISOString() : "-";
}

function appendEvidenceSources(lines, audit) {
  const sources = audit?.sources;
  if (!sources || typeof sources !== "object") {
    return;
  }
  const rows = [
    ["designerWorkflowResults", sources.resultsPath, sources.resultsMtimeMs],
    ["liveReadiness", sources.readinessPath, sources.readinessMtimeMs],
    ["assistantUiSnapshot", sources.assistantUiSnapshotPath, sources.assistantUiSnapshotMtimeMs]
  ].filter(([, sourcePath]) => sourcePath);
  if (rows.length === 0) {
    return;
  }
  lines.push(
    "",
    "## Evidence Sources",
    "",
    "| Source | Path | Timestamp |",
    "| --- | --- | --- |"
  );
  for (const [label, sourcePath, mtimeMs] of rows) {
    lines.push(`| ${label} | ${String(sourcePath).replace(/\|/g, "\\|")} | ${formatTimestampMs(mtimeMs)} |`);
  }
}

export function buildDesignerWorkflowReleaseAuditMarkdown(audit) {
  const lines = [
    `# Xbridge Designer Workflow Release Readiness`,
    "",
    `Release readiness: ${String(audit.status || "unknown").toUpperCase()}`,
    "",
    `- reason: ${audit.reason || "-"}`,
    `- summary: ${audit.summary || "-"}`,
    "",
    "## Gates",
    "",
    "| Gate | Status | Detail |",
    "| --- | --- | --- |"
  ];

  for (const [name, gate] of Object.entries(audit.gates || {})) {
    lines.push(`| ${name} | ${gate.status || "-"} | ${String(gate.detail || "-").replace(/\|/g, "\\|")} |`);
  }

  const workflowGate = audit.gates?.designerWorkflowRelease;
  if (workflowGate) {
    lines.push("", "## Required Case Findings", "");
    if (workflowGate.findingsUnavailableReason) {
      lines.push(
        `- Required Case Findings are unavailable because ${workflowGate.findingsUnavailableReason}.`
      );
    } else {
      lines.push(
        `- missingRequiredCases: ${formatList(workflowGate.missingRequiredCases)}`,
        `- nonPassingRequiredCases: ${formatList(workflowGate.nonPassingRequiredCases)}`,
        `- missingEvidenceCases: ${formatList(workflowGate.missingEvidenceCases)}`,
        `- failedCases: ${formatList(workflowGate.failedCases)}`
      );
    }
    lines.push("", "## Required Case Set", "", workflowGate.requiredIds.join(", "));
  }

  appendEvidenceSources(lines, audit);
  appendNextLiveValidationSteps(lines, audit);

  lines.push("");
  return lines.join("\n");
}
