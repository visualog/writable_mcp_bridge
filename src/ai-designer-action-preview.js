const DESIGNER_ACTION_PREVIEW_VERSION = "1.0";

const STRUCTURAL_ACTIONS = new Set([
  "layout_restructure",
  "spacing_tidy",
  "typography_refine",
  "copy_refine",
  "generate_from_system"
]);

const ASSET_AWARE_ACTIONS = new Set([
  "design_system_alignment",
  "generate_from_system"
]);

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function hasSuccessfulPhase(execution = {}, phaseName) {
  return normalizeArray(execution?.phases).some((phase) => {
    if (phase?.phase !== phaseName) {
      return false;
    }
    return normalizeArray(phase.commandResults).some((result) => result.status === "ok");
  });
}

function getTargetSummary(action = {}, intentEnvelope = {}) {
  const targetNodeId = normalizeString(action.targetNodeId);
  const designerTarget = normalizeObject(intentEnvelope?.designerContext?.target);
  const contextTargetIds = normalizeArray(intentEnvelope?.contextScope?.targetIds);
  const label = normalizeString(designerTarget.label);

  if (targetNodeId) {
    return label ? `${label} (${targetNodeId})` : targetNodeId;
  }
  if (contextTargetIds.length > 0) {
    return label ? `${label} (${contextTargetIds[0]})` : contextTargetIds[0];
  }
  return label || "선택된 대상 없음";
}

function getScopeLabel(action = {}, intentEnvelope = {}) {
  const actionType = normalizeString(action.actionType);
  const targetType = normalizeString(intentEnvelope?.contextScope?.targetType);

  if (actionType === "analysis_only") {
    return "제안/분석만 수행";
  }
  if (actionType === "implementation_brief") {
    return "로컬 구현 핸드오프 준비";
  }
  if (targetType === "current_page") {
    return "현재 페이지 또는 사용자가 고른 범위";
  }
  return "선택한 노드와 가까운 하위 구조";
}

function getIntendedEdits(action = {}) {
  const actionType = normalizeString(action.actionType);
  const label = normalizeString(action.label) || "추천 액션";

  if (actionType === "spacing_tidy") {
    return ["간격 리듬 점검", "padding/gap 정리 후보 생성", "적용 전 변경 범위 확인"];
  }
  if (actionType === "layout_restructure") {
    return ["정보 블록 재그룹화", "우선순위가 높은 영역 재배치", "선택 구조 유지 여부 확인"];
  }
  if (actionType === "design_system_alignment") {
    return ["기존 컴포넌트/토큰 후보 확인", "대체 가능한 자산 비교", "직접 생성보다 재사용 우선"];
  }
  if (actionType === "copy_refine") {
    return ["헤드라인/본문 역할 분리", "중복 문구 정리", "톤과 목적 기준 문안 후보 생성"];
  }
  if (actionType === "typography_refine") {
    return ["텍스트 역할 분류", "크기/두께 계층 제안", "토큰 또는 스타일 적용 후보 확인"];
  }
  if (actionType === "generate_from_system") {
    return ["기존 섹션/컴포넌트 패턴 탐색", "새 구성 초안 생성", "직접 적용 전 범위 확인"];
  }
  if (actionType === "implementation_brief") {
    return ["구현 단위 요약", "변경 파일/컴포넌트 후보 정리", "로컬 handoff payload 준비"];
  }

  return [label, "추가 확인 후 적용 여부 결정"];
}

function getExpectedOutcome(action = {}) {
  const actionType = normalizeString(action.actionType);

  if (actionType === "analysis_only") {
    return "Figma 파일을 변경하지 않고 판단 근거와 다음 읽기만 정리합니다.";
  }
  if (actionType === "implementation_brief") {
    return "디자인 변경은 하지 않고 로컬 구현자가 이해할 수 있는 작업 범위를 만듭니다.";
  }
  if (ASSET_AWARE_ACTIONS.has(actionType)) {
    return "기존 자산을 우선 검토해 새로 그리는 범위를 줄이고 일관성을 높입니다.";
  }
  return "선택한 범위를 기준으로 적용 가능한 디자인 변경안을 미리 확인합니다.";
}

function getRequiredConfirmation(action = {}, blockerCodes = []) {
  const actionType = normalizeString(action.actionType);
  if (blockerCodes.length > 0 || actionType === "analysis_only") {
    return "none";
  }
  if (actionType === "design_system_alignment" || actionType === "generate_from_system") {
    return "asset_change";
  }
  if (actionType === "layout_restructure") {
    return "multi_node";
  }
  return "single_target";
}

function buildBlockers(action = {}, intentEnvelope = {}, execution = {}) {
  const actionType = normalizeString(action.actionType);
  const blockers = [];
  const targetNodeId = normalizeString(action.targetNodeId);
  const summary = normalizeObject(execution?.summary);

  if (!targetNodeId && actionType !== "analysis_only" && actionType !== "implementation_brief") {
    blockers.push({
      code: "needs_selection",
      label: "적용할 선택 대상이 필요합니다."
    });
  }

  if (STRUCTURAL_ACTIONS.has(actionType) && !hasSuccessfulPhase(execution, "focused_detail")) {
    blockers.push({
      code: "missing_focused_detail",
      label: "구조 변경 전 선택 영역 세부 읽기가 필요합니다."
    });
  }

  if (ASSET_AWARE_ACTIONS.has(actionType) && !hasSuccessfulPhase(execution, "asset_lookup")) {
    blockers.push({
      code: "missing_asset_lookup",
      label: "디자인 시스템/자산 확인이 더 필요합니다."
    });
  }

  if ((summary.errorCount || 0) > 0) {
    blockers.push({
      code: "read_errors_present",
      label: `읽기 오류 ${summary.errorCount}건이 있어 바로 적용하지 않습니다.`
    });
  }

  if (normalizeString(intentEnvelope?.contextScope?.targetType) === "current_page" && actionType !== "analysis_only") {
    blockers.push({
      code: "target_too_broad",
      label: "페이지 전체 범위는 먼저 적용 대상을 좁혀야 합니다."
    });
  }

  return blockers;
}

function resolveApplyMode(action = {}, blockers = []) {
  const actionType = normalizeString(action.actionType);

  if (actionType === "analysis_only") {
    return "suggest_only";
  }
  if (actionType === "implementation_brief") {
    return blockers.length > 0 ? "suggest_only" : "implementation_handoff";
  }
  return blockers.length > 0 ? "suggest_only" : "figma_apply";
}

function resolveReadiness(action = {}, blockers = []) {
  const actionType = normalizeString(action.actionType);
  if (actionType === "analysis_only") {
    return "suggest_only";
  }
  if (blockers.length > 0) {
    return "blocked";
  }
  if (actionType === "implementation_brief") {
    return "handoff_ready";
  }
  return "needs_confirmation";
}

function buildEvidence(action = {}, execution = {}) {
  const actionType = normalizeString(action.actionType);
  const phases = normalizeArray(execution?.phases);
  const evidence = [];

  if (phases.length > 0) {
    evidence.push(`read phases ${phases.map((phase) => phase.phase).join(" -> ")}`);
  }
  if (STRUCTURAL_ACTIONS.has(actionType)) {
    evidence.push(hasSuccessfulPhase(execution, "focused_detail") ? "focused detail confirmed" : "focused detail missing");
  }
  if (ASSET_AWARE_ACTIONS.has(actionType)) {
    evidence.push(hasSuccessfulPhase(execution, "asset_lookup") ? "asset lookup confirmed" : "asset lookup missing");
  }

  return evidence;
}

export function buildDesignerActionPreviewBundle({
  intentEnvelope = {},
  execution = {},
  designerSuggestionBundle = {}
} = {}) {
  const actions = normalizeArray(designerSuggestionBundle?.applyActions);
  const previews = actions.map((action, index) => {
    const blockers = buildBlockers(action, intentEnvelope, execution);
    const blockerCodes = blockers.map((blocker) => blocker.code);
    const readiness = resolveReadiness(action, blockers);
    const applyMode = resolveApplyMode(action, blockers);

    return {
      id: normalizeString(action.id) || `action-preview-${index + 1}`,
      actionId: normalizeString(action.id) || null,
      actionType: normalizeString(action.actionType) || "analysis_only",
      label: normalizeString(action.label) || "추천 액션",
      targetNodeId: normalizeString(action.targetNodeId) || null,
      readiness,
      applyMode,
      canApplyNow: applyMode === "figma_apply" && readiness === "needs_confirmation",
      requiredConfirmation: getRequiredConfirmation(action, blockerCodes),
      blockers,
      preview: {
        title: normalizeString(action.label) || "추천 액션",
        target: getTargetSummary(action, intentEnvelope),
        scope: getScopeLabel(action, intentEnvelope),
        intendedEdits: getIntendedEdits(action),
        expectedOutcome: getExpectedOutcome(action),
        evidence: buildEvidence(action, execution)
      }
    };
  });

  const readyTotal = previews.filter((preview) => preview.canApplyNow).length;
  const blockedTotal = previews.filter((preview) => preview.readiness === "blocked").length;

  return {
    version: DESIGNER_ACTION_PREVIEW_VERSION,
    generatedAt: new Date().toISOString(),
    intentKind: normalizeString(designerSuggestionBundle?.intentKind) || normalizeString(intentEnvelope?.intents?.[0]?.kind) || "analyze",
    summary: {
      actionCount: previews.length,
      readyTotal,
      blockedTotal,
      suggestOnlyTotal: previews.filter((preview) => preview.applyMode === "suggest_only").length,
      handoffReadyTotal: previews.filter((preview) => preview.applyMode === "implementation_handoff").length
    },
    previews
  };
}

export { DESIGNER_ACTION_PREVIEW_VERSION };
