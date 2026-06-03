function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function buildDesignerWorkflowReadinessReport(input = {}) {
  const health = input.health || {};
  const body = health.body || {};
  const activeSessionResolution = body.activeSessionResolution || {};
  const livePluginIds = normalizeArray(activeSessionResolution.livePluginIds).filter(
    (item) => typeof item === "string" && item.trim()
  );
  const reason =
    normalizeString(activeSessionResolution.reason) ||
    normalizeString(body.commandReadiness?.reason) ||
    "unknown";
  const commandReadiness = normalizeString(body.commandReadiness?.status) || "unknown";
  const writeReadiness = normalizeString(body.writeReadiness?.status) || "unknown";
  const transport = normalizeString(body.transportHealth?.grade) || "unknown";
  const explicitPluginId = normalizeString(input.explicitPluginId);
  const requiresExplicitPluginId = Boolean(activeSessionResolution.requiresExplicitPluginId);
  const ok =
    body.ok === true &&
    commandReadiness === "ready" &&
    writeReadiness === "ready" &&
    Boolean(explicitPluginId || activeSessionResolution.primaryPluginId || body.activePluginId);

  const nextActions = [];
  if (requiresExplicitPluginId && !explicitPluginId) {
    nextActions.push(
      `여러 live session 중 하나를 골라 XBRIDGE_QA_PLUGIN_ID를 지정하세요: ${livePluginIds.join(", ")}`
    );
  }
  if (reason === "no_live_session" || body.activePluginCount === 0 || livePluginIds.length === 0) {
    nextActions.push("Figma에서 Xbridge 플러그인 패널을 열고 heartbeat가 active가 될 때까지 기다리세요.");
  }
  if (commandReadiness !== "ready" || writeReadiness !== "ready") {
    nextActions.push("/health에서 commandReadiness와 writeReadiness가 ready인지 다시 확인하세요.");
  }
  if (nextActions.length === 0) {
    nextActions.push("live workflow runner를 실행할 준비가 됐습니다.");
  }

  const summary = ok
    ? "Designer Workflow live runner를 실행할 준비가 됐습니다."
    : requiresExplicitPluginId && !explicitPluginId
      ? "여러 Figma plugin session이 있어 pluginId를 명시해야 live workflow runner를 실행할 수 있습니다."
      : "활성 Figma plugin session이 없어 live workflow runner를 실행할 수 없습니다.";

  return {
    ok,
    reason,
    summary,
    serverVersion: body.serverVersion || null,
    transport,
    commandReadiness,
    writeReadiness,
    activeSessionResolution,
    livePluginIds,
    requiresExplicitPluginId,
    explicitPluginId: explicitPluginId || null,
    healthStatus: health.status || null,
    healthDurationMs: health.durationMs || null,
    nextActions
  };
}
