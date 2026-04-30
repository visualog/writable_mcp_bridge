function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createHandoffId() {
  return `handoff_${Date.now().toString(36)}`;
}

function buildSource(pluginContext = {}) {
  return {
    pluginSessionId: normalizeString(pluginContext.pluginSessionId) || "plugin_session_pending",
    figmaFileKey: normalizeString(pluginContext.figmaFileKey) || "unknown_file",
    figmaFileName: normalizeString(pluginContext.figmaFileName) || "Unknown Figma File",
    pageId: normalizeString(pluginContext.pageId) || "unknown_page",
    pageName: normalizeString(pluginContext.pageName) || "Unknown Page"
  };
}

function buildTargets(figmaContext = {}) {
  const selection = normalizeArray(figmaContext.selection);
  return selection.map((node, index) => ({
    nodeId: normalizeString(node?.id) || `unknown_${index}`,
    nodeName: normalizeString(node?.name) || `Selection ${index + 1}`,
    role: index === 0 ? "primary" : "supporting"
  }));
}

function buildSelectionSummary(figmaContext = {}) {
  const selection = normalizeArray(figmaContext.selection);
  if (selection.length === 0) {
    return normalizeString(figmaContext.pageName)
      ? `${normalizeString(figmaContext.pageName)} 페이지 전체 컨텍스트`
      : "페이지 단위 구현 컨텍스트";
  }
  if (selection.length === 1) {
    return `${normalizeString(selection[0]?.name) || "선택 노드"} 구현 컨텍스트`;
  }
  return `${selection.length}개 선택 노드 구현 컨텍스트`;
}

export function validatePluginLocalHandoffPayload(payload = {}) {
  const errors = [];

  if (!normalizeString(payload.version)) {
    errors.push("version is required");
  }
  if (!normalizeString(payload.handoffId)) {
    errors.push("handoffId is required");
  }
  if (!normalizeString(payload.requestedAt)) {
    errors.push("requestedAt is required");
  }
  if (!payload.source || typeof payload.source !== "object") {
    errors.push("source is required");
  }
  if (!payload.intent || typeof payload.intent !== "object") {
    errors.push("intent is required");
  }
  if (!payload.figmaContext || typeof payload.figmaContext !== "object") {
    errors.push("figmaContext is required");
  }

  return {
    ok: errors.length === 0,
    errors
  };
}

export function createPluginLocalHandoffPayload({
  pluginContext = {},
  figmaContext = {},
  intentEnvelope = {}
} = {}) {
  const primaryIntent = normalizeArray(intentEnvelope.intents)[0] || {};
  const targets = buildTargets(figmaContext);

  return {
    version: "0.1",
    handoffId: createHandoffId(),
    requestedAt: new Date().toISOString(),
    source: buildSource(pluginContext),
    intent: {
      mode:
        primaryIntent.kind === "prepare_implementation_handoff"
          ? "implement_selection"
          : "update_existing_code",
      summary:
        normalizeString(intentEnvelope.summary) ||
        normalizeString(primaryIntent.objective) ||
        "Implement Figma-driven request",
      userRequest:
        normalizeString(intentEnvelope.userGoal) ||
        normalizeString(primaryIntent.changeSet?.requestedChange) ||
        "No user request supplied",
      targets,
      deliverables: ["responsive UI implementation"],
      constraints: normalizeArray(primaryIntent.constraints)
    },
    figmaContext: {
      selection: {
        nodeIds: targets.map((target) => target.nodeId),
        primaryNodeId: targets[0]?.nodeId || null
      },
      selectionSummary: buildSelectionSummary(figmaContext),
      designSystem: {
        libraryHints: normalizeArray(figmaContext.libraryHints),
        tokenHints: normalizeArray(figmaContext.tokenHints),
        componentHints: normalizeArray(figmaContext.componentHints)
      },
      snapshot: {
        included: false
      }
    }
  };
}
