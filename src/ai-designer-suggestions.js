const DESIGNER_SUGGESTION_VERSION = "1.0";

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function toId(prefix, value = "") {
  const slug = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || prefix;
  return `${prefix}-${slug}`;
}

function getFocusedDetail(designerContext = {}) {
  return designerContext?.focusedDetail && typeof designerContext.focusedDetail === "object"
    ? designerContext.focusedDetail
    : {};
}

function getExecutionSummary(execution = {}) {
  return execution?.summary && typeof execution.summary === "object" ? execution.summary : {};
}

function buildCoreFinding(intentKind, designerContext = {}, execution = {}) {
  const focusedDetail = getFocusedDetail(designerContext);
  const selectionSummary = normalizeString(designerContext?.fastContext?.selectionSummary);

  if (intentKind === "inspect_selection") {
    return {
      id: toId("finding", "inspect-selection"),
      severity: "low",
      label: "선택된 프레임과 하위 구조를 확인했습니다.",
      detail:
        selectionSummary ||
        normalizeString(designerContext?.headline) ||
        "선택 우선 컨텍스트를 기준으로 읽기 결과를 정리했습니다."
    };
  }

  if (intentKind === "restructure_layout" || intentKind === "adjust_spacing" || intentKind === "improve_hierarchy") {
    if (focusedDetail.status === "available") {
      return {
        id: toId("finding", `${intentKind}-layout`),
        severity: "high",
        label: "선택 구조를 기준으로 레이아웃 정리가 가능합니다.",
        detail: [
          normalizeString(focusedDetail.nodeType) ? `nodeType ${focusedDetail.nodeType}` : "",
          normalizeString(focusedDetail.layoutMode) ? `layout ${focusedDetail.layoutMode}` : "",
          Number.isFinite(focusedDetail.itemSpacing) ? `spacing ${focusedDetail.itemSpacing}` : ""
        ].filter(Boolean).join(" · ")
      };
    }

    return {
      id: toId("finding", `${intentKind}-context`),
      severity: "medium",
      label: "현재 선택 기준으로 레이아웃 개선 방향을 제안할 수 있습니다.",
      detail: selectionSummary || "선택 우선 컨텍스트가 준비되었습니다."
    };
  }

  if (intentKind === "align_to_design_system" || intentKind === "swap_or_recommend_component" || intentKind === "adapt_variant") {
    const assetLookup = designerContext?.assetLookup || {};
    return {
      id: toId("finding", `${intentKind}-assets`),
      severity: "high",
      label: "기존 컴포넌트와 토큰을 기준으로 정렬할 수 있습니다.",
      detail: [
        `components ${assetLookup?.availableHints?.componentCount || 0}`,
        `tokens ${assetLookup?.availableHints?.tokenCount || 0}`,
        `libraries ${assetLookup?.availableHints?.libraryCount || 0}`
      ].join(" · ")
    };
  }

  if (intentKind === "revise_copy" || intentKind === "refine_typography") {
    const summary = getExecutionSummary(execution);
    return {
      id: toId("finding", `${intentKind}-content`),
      severity: "medium",
      label: intentKind === "revise_copy" ? "텍스트와 주석 기준으로 문구 개선이 가능합니다." : "텍스트 계층 기준으로 타이포 정리가 가능합니다.",
      detail: `read ok ${summary.okCount || 0} · skipped ${summary.skippedCount || 0}`
    };
  }

  if (intentKind === "generate_screen" || intentKind === "generate_section") {
    return {
      id: toId("finding", `${intentKind}-generation`),
      severity: "medium",
      label: "현재 페이지와 자산 컨텍스트를 바탕으로 새 구성을 제안할 수 있습니다.",
      detail: normalizeString(designerContext?.headline) || "페이지 수준 컨텍스트가 준비되었습니다."
    };
  }

  if (intentKind === "prepare_implementation_handoff") {
    return {
      id: toId("finding", "implementation-handoff"),
      severity: "high",
      label: "구현 핸드오프용 구조·컴포넌트·주석 컨텍스트를 모을 수 있습니다.",
      detail: normalizeString(designerContext?.headline) || "선택 기준 구현 컨텍스트"
    };
  }

  return {
    id: toId("finding", "analysis"),
    severity: "low",
    label: "현재 선택과 페이지를 기준으로 디자인 분석을 시작할 수 있습니다.",
    detail: normalizeString(designerContext?.headline) || "빠른 컨텍스트가 준비되었습니다."
  };
}

function buildRecommendations(intentKind, designerContext = {}, execution = {}) {
  const focusedDetail = getFocusedDetail(designerContext);
  const recommendations = [];

  if (intentKind === "inspect_selection") {
    return recommendations;
  }

  if (intentKind === "restructure_layout" || intentKind === "improve_hierarchy") {
    recommendations.push({
      id: toId("rec", "group-and-prioritize"),
      title: "핵심 정보 블록을 우선순위 기준으로 다시 묶기",
      reason: focusedDetail.layoutMode
        ? `${focusedDetail.layoutMode} 흐름을 유지하면서 정보 위계를 더 선명하게 만들 수 있습니다.`
        : "현재 선택 기준으로 정보 위계를 더 선명하게 만들 수 있습니다.",
      actionType: "layout_restructure"
    });
  }

  if (intentKind === "adjust_spacing" || intentKind === "restructure_layout") {
    recommendations.push({
      id: toId("rec", "normalize-spacing"),
      title: "간격 리듬을 한 단계 정리하기",
      reason: Number.isFinite(focusedDetail.itemSpacing)
        ? `현재 spacing ${focusedDetail.itemSpacing}을 기준으로 내/외부 간격 규칙을 통일할 수 있습니다.`
        : "선택 구조를 기준으로 내/외부 간격 규칙을 통일할 수 있습니다.",
      actionType: "spacing_tidy"
    });
  }

  if (intentKind === "align_to_design_system" || intentKind === "swap_or_recommend_component" || intentKind === "adapt_variant") {
    recommendations.push({
      id: toId("rec", "prefer-reusable-assets"),
      title: "로컬/라이브러리 자산을 우선 재사용하기",
      reason: "직접 새로 그리기보다 기존 컴포넌트와 토큰을 우선 적용하는 편이 일관성과 구현 효율에 유리합니다.",
      actionType: "design_system_alignment"
    });
  }

  if (intentKind === "revise_copy") {
    recommendations.push({
      id: toId("rec", "revise-copy"),
      title: "헤드라인과 보조 문구를 역할 기준으로 나누기",
      reason: "텍스트 노드와 주석을 같이 보면 메시지 계층을 더 명확하게 정리할 수 있습니다.",
      actionType: "copy_refine"
    });
  }

  if (intentKind === "refine_typography") {
    recommendations.push({
      id: toId("rec", "type-scale"),
      title: "텍스트 계층을 크기·두께 기준으로 재정렬하기",
      reason: "텍스트 노드 읽기 결과를 기반으로 역할별 타입 스케일을 더 일관되게 만들 수 있습니다.",
      actionType: "typography_refine"
    });
  }

  if (intentKind === "generate_screen" || intentKind === "generate_section") {
    recommendations.push({
      id: toId("rec", "compose-from-assets"),
      title: "빈 화면 생성보다 기존 섹션 패턴 조합을 우선 검토하기",
      reason: "현재 페이지와 자산 조회를 같이 쓰면 더 빠르게 설계 방향을 잡을 수 있습니다.",
      actionType: "generate_from_system"
    });
  }

  if (intentKind === "prepare_implementation_handoff") {
    recommendations.push({
      id: toId("rec", "implementation-brief"),
      title: "구현 단위와 변경 범위를 먼저 요약하기",
      reason: "현재 읽기 결과를 기반으로 컴포넌트 경계, 토큰 사용, 주석 메모를 함께 정리하면 구현 핸드오프 품질이 올라갑니다.",
      actionType: "implementation_brief"
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: toId("rec", "analyze-first"),
      title: "현재 컨텍스트를 바탕으로 디자인 방향을 먼저 정리하기",
      reason: "추가 실행 전에 현재 페이지/선택 기준 문제 정의를 선행하는 편이 안전합니다.",
      actionType: "analysis_only"
    });
  }

  return recommendations;
}

function buildApplyActions(intentKind, designerContext = {}, recommendations = []) {
  if (intentKind === "inspect_selection") {
    return [];
  }
  const selectionIds = normalizeArray(designerContext?.target?.ids);
  const baseStatus = selectionIds.length > 0 ? "review_required" : "needs_selection";

  return recommendations.slice(0, 3).map((recommendation) => ({
    id: toId("apply", recommendation.actionType),
    label: recommendation.title,
    actionType: recommendation.actionType,
    status: baseStatus,
    targetNodeId: selectionIds[0] || null
  }));
}

function buildRisks(execution = {}, intentEnvelope = {}) {
  const risks = [];
  const summary = getExecutionSummary(execution);

  if ((summary.errorCount || 0) > 0) {
    risks.push(`일부 읽기 명령이 실패했습니다 (${summary.errorCount}건).`);
  }
  if ((summary.skippedCount || 0) > 0) {
    risks.push(`일부 읽기 명령은 현재 컨텍스트상 생략되었습니다 (${summary.skippedCount}건).`);
  }
  if (normalizeString(intentEnvelope?.contextScope?.targetType) === "current_page") {
    risks.push("페이지 전체 대상 요청은 범위가 넓어 제안 전에 타깃 확인이 필요할 수 있습니다.");
  }

  return risks;
}

function buildSummaryText(bundle = {}) {
  if (bundle.intentKind === "inspect_selection") {
    return normalizeString(normalizeArray(bundle.findings)[0]?.label) || "선택 구조 확인을 완료했습니다.";
  }
  const firstFinding = normalizeArray(bundle.findings)[0];
  const firstRecommendation = normalizeArray(bundle.recommendations)[0];
  const parts = [
    normalizeString(firstFinding?.label),
    normalizeString(firstRecommendation?.title)
  ].filter(Boolean);
  return parts.join(" / ") || "디자인 제안 초안을 만들었습니다.";
}

export function buildDesignerSuggestionBundle({
  intentEnvelope = {},
  execution = {}
} = {}) {
  const intentKind = normalizeString(intentEnvelope?.intents?.[0]?.kind) || "analyze";
  const designerContext = intentEnvelope?.designerContext || {};
  const findings = [buildCoreFinding(intentKind, designerContext, execution)];
  const recommendations = buildRecommendations(intentKind, designerContext, execution);
  const applyActions = buildApplyActions(intentKind, designerContext, recommendations);
  const risks = buildRisks(execution, intentEnvelope);

  const bundle = {
    version: DESIGNER_SUGGESTION_VERSION,
    intentKind,
    headline: normalizeString(designerContext?.headline) || normalizeString(intentEnvelope?.summary) || "디자인 제안",
    analysis: {
      target: normalizeString(designerContext?.target?.label),
      phaseSummary: getExecutionSummary(execution),
      readHeadline: normalizeString(intentEnvelope?.readPlan?.headline)
    },
    findings,
    recommendations,
    applyActions,
    risks
  };

  return {
    ...bundle,
    summaryText: buildSummaryText(bundle)
  };
}

export { DESIGNER_SUGGESTION_VERSION };
