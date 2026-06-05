import { retrieveDesignerKnowledge } from "./designer-knowledge-rag.js";

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function buildAiDesignerSnapshot(designerAiConfig = {}) {
  return {
    executionBackend: "codex_cli",
    provider: "codex_cli",
    configured: true,
    model: "Codex CLI",
    baseUrl: "",
    valid: true,
    validationIssues: [],
    modelPresets: [
      {
        id: "codex_cli",
        provider: "codex_cli",
        shortLabel: "Codex CLI",
        displayLabel: "Codex CLI",
        levelLabel: "백엔드",
        selected: true
      }
    ],
    providerOptions: [],
    legacyConfig: {
      provider: designerAiConfig.provider,
      model: designerAiConfig.model,
      baseUrl: designerAiConfig.baseUrl,
      configured: designerAiConfig.configured,
      valid: designerAiConfig.valid,
      validationIssues: designerAiConfig.validationIssues
    }
  };
}

export function normalizeCodexCliStatus(value = "") {
  const code = normalizeString(value).toLowerCase();
  if (!code) {
    return "process_failed";
  }
  if (code === "completed" || code === "ok") {
    return "completed";
  }
  if (code === "codex_cli_timeout" || code === "designer_ai_reply_timeout") {
    return "timeout";
  }
  if (code === "codex_cli_invalid_output") {
    return "invalid_output";
  }
  return "process_failed";
}

export function buildDesignerCodexAiPayload({
  status = "completed",
  model = null,
  reply = "",
  failureCode = null
} = {}) {
  return {
    provider: "codex_cli",
    model: model || null,
    status,
    failureCode: failureCode || null,
    response: {
      reply
    }
  };
}

export function buildDesignerPipelineSnapshot({
  request = "",
  intentEnvelope = {},
  execution = {},
  suggestionBundle = {},
  actionMode = "answer"
} = {}) {
  const readCommands = normalizeArray(intentEnvelope?.readPlan?.commands)
    .map((command) => normalizeString(command))
    .filter(Boolean);
  const summary = execution?.summary && typeof execution.summary === "object"
    ? execution.summary
    : {};
  const contextModel = execution?.contextModel && typeof execution.contextModel === "object"
    ? execution.contextModel
    : {};
  const designSystem = contextModel.designSystem && typeof contextModel.designSystem === "object"
    ? contextModel.designSystem
    : {};
  const tokenSnapshot = designSystem.tokenSnapshot && typeof designSystem.tokenSnapshot === "object"
    ? designSystem.tokenSnapshot
    : null;
  const focusedNode = contextModel.focusedNode && typeof contextModel.focusedNode === "object"
    ? contextModel.focusedNode
    : null;
  const structure = contextModel.structure && typeof contextModel.structure === "object"
    ? contextModel.structure
    : null;
  const contextWarnings = normalizeArray(execution?.contextWarnings)
    .map((warning) => normalizeString(warning))
    .filter(Boolean);
  const deterministicReport =
    normalizeString(suggestionBundle?.buddyAuditReport) ||
    normalizeString(suggestionBundle?.primitiveColorReport) ||
    "";
  const intentKind = normalizeString(intentEnvelope?.intents?.[0]?.kind) || "analyze";
  const targetType = normalizeString(intentEnvelope?.contextScope?.targetType);
  const retrieval = retrieveDesignerKnowledge({
    request,
    intentKind,
    targetType,
    readCommands,
    contextHints: [
      normalizeString(intentEnvelope?.intentClassification?.userIntentKind),
      normalizeString(focusedNode?.node?.type || focusedNode?.type),
      normalizeString(structure?.childCount ? "structure" : ""),
      tokenSnapshot ? "token design-system" : "",
      deterministicReport ? "buddy evidence-first report" : ""
    ]
  });

  return {
    request: normalizeString(request),
    actionMode: normalizeString(actionMode) || "answer",
    intent: {
      kind: intentKind,
      userIntentKind: normalizeString(intentEnvelope?.intentClassification?.userIntentKind),
      targetType,
      selectionRequired: Boolean(intentEnvelope?.contextScope?.selectionRequired)
    },
    read: {
      headline: normalizeString(intentEnvelope?.readPlan?.headline),
      commands: readCommands,
      commandCount: readCommands.length,
      okCount: Number(summary.okCount || 0),
      errorCount: Number(summary.errorCount || 0),
      skippedCount: Number(summary.skippedCount || 0),
      warnings: contextWarnings
    },
    context: {
      target: contextModel.target || null,
      focusedNode: focusedNode
        ? {
            name: normalizeString(focusedNode.node?.name || focusedNode.name),
            type: normalizeString(focusedNode.node?.type || focusedNode.type),
            layoutMode: normalizeString(focusedNode.layout?.layoutMode),
            sourceComponentName: normalizeString(
              focusedNode.sourceComponent?.name ||
                focusedNode.sourceComponent?.componentSetName
            ),
            variantPropertyCount:
              focusedNode.variantProperties && typeof focusedNode.variantProperties === "object"
                ? Object.keys(focusedNode.variantProperties).length
                : 0,
            componentPropertyCount:
              focusedNode.componentProperties && typeof focusedNode.componentProperties === "object"
                ? Object.keys(focusedNode.componentProperties).length
                : 0
          }
        : null,
      structure: structure
        ? {
            childCount: Number(structure.childCount || 0),
            textNodeCount: Number(structure.textNodeCount || 0),
            instanceCount: Number(structure.instanceCount || 0),
            autoLayoutFrames: Number(structure.autoLayoutFrames || 0)
          }
        : null,
      designSystem: {
        componentCandidateCount: normalizeArray(designSystem.componentCandidates).length,
        instanceMatchCount: normalizeArray(designSystem.instanceMatches).length,
        variableDefCount: normalizeArray(designSystem.variableDefs).length,
        tokenSnapshot: tokenSnapshot
          ? {
              collectionCount: Number(tokenSnapshot.collectionCount || 0),
              variableCount: Number(tokenSnapshot.variableCount || 0),
              colorScaleGroupCount: normalizeArray(tokenSnapshot.colorScaleGroups).length,
              filePath: normalizeString(tokenSnapshot.filePath)
            }
          : null
      }
    },
    deterministicEvidence: {
      summaryText: normalizeString(suggestionBundle?.summaryText),
      report: deterministicReport,
      findings: normalizeArray(suggestionBundle?.findings)
        .slice(0, 6)
        .map((entry) => ({
          label: normalizeString(entry?.label),
          detail: normalizeString(entry?.detail)
        })),
      recommendations: normalizeArray(suggestionBundle?.recommendations)
        .slice(0, 6)
        .map((entry) => ({
          title: normalizeString(entry?.title),
          reason: normalizeString(entry?.reason),
          actionType: normalizeString(entry?.actionType)
        }))
    },
    retrieval,
    responsePolicy: {
      evidenceFirst: true,
      doNotInventMissingFigmaData: true,
      preserveDeterministicReport: Boolean(deterministicReport),
      separateLimitationsAtEnd: true
    }
  };
}

export function buildDesignerCodexFallbackMeta(error) {
  return {
    aiBackend: "codex_cli",
    codexStatus: normalizeCodexCliStatus(error?.code),
    fallbackUsed: true,
    fallbackReason: normalizeString(error?.code) || "codex_cli_process_failed"
  };
}

export function resolveDesignerCodexInspectTimeoutMs(env = process.env) {
  const configured = Number(env.XBRIDGE_CODEX_CLI_INSPECT_TIMEOUT_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.max(1000, Math.floor(configured));
  }
  return 45000;
}

export function buildCodexAugmentedSuggestionBundle(baseBundle = {}, codexResult = {}) {
  const summary = normalizeString(codexResult?.reply || codexResult?.summary || "");
  const findings = Array.isArray(codexResult?.findings)
    ? codexResult.findings.map((item) => normalizeString(item)).filter(Boolean)
    : [];
  const recommendations = Array.isArray(codexResult?.recommendations)
    ? codexResult.recommendations.map((item) => normalizeString(item)).filter(Boolean)
    : [];
  const baseFindings = Array.isArray(baseBundle.findings) ? baseBundle.findings : [];
  const baseRecommendations = Array.isArray(baseBundle.recommendations)
    ? baseBundle.recommendations
    : [];
  const preserveBaseSummary =
    normalizeString(baseBundle.buddyAuditReport) ||
    normalizeString(baseBundle.primitiveColorReport);

  return {
    ...baseBundle,
    summaryText: preserveBaseSummary || summary || baseBundle.summaryText,
    findings: [
      ...findings.map((detail, index) => ({
        id: `finding-codex-${index + 1}`,
        severity: "low",
        label: index === 0 && summary ? summary : "Codex 읽기 결과",
        detail
      })),
      ...baseFindings
    ],
    recommendations: [
      ...recommendations.map((title, index) => ({
        id: `rec-codex-${index + 1}`,
        title,
        reason: "Codex가 현재 읽기 결과를 바탕으로 제안했습니다.",
        actionType: "analysis_only"
      })),
      ...baseRecommendations
    ],
    codex: {
      source: "codex_cli",
      status: "completed",
      reply: summary || null,
      findings,
      recommendations
    }
  };
}

export function attachDesignerKnowledgeReferences(baseBundle = {}, pipelineSnapshot = {}) {
  const references = normalizeArray(pipelineSnapshot?.retrieval?.results)
    .map((entry) => ({
      id: normalizeString(entry?.id),
      title: normalizeString(entry?.title),
      sourcePath: normalizeString(entry?.sourcePath),
      sourceKind: normalizeString(entry?.sourceKind) || "static_summary",
      guidance: normalizeString(entry?.guidance)
    }))
    .filter((entry) => entry.id && entry.title && entry.sourcePath)
    .slice(0, 4);
  if (!references.length) {
    return baseBundle;
  }
  return {
    ...baseBundle,
    knowledgeReferences: references
  };
}
