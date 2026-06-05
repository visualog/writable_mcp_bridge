import {
  auditPrimitiveColorTokens,
  buildBuddyStylePrimitiveColorReport
} from "./primitive-color-audit.js";
import { composeBuddyStyleAuditReport } from "./buddy-report-composer.js";

const DESIGNER_SUGGESTION_VERSION = "1.0";

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeKoreanUiText(value) {
  const text = normalizeString(value);
  if (!text) {
    return "";
  }

  return text
    .replace(/來由/gu, "유래")
    .replace(/由來/gu, "유래")
    .replace(/出處/gu, "출처")
    .replace(/確認/gu, "확인")
    .replace(/整理/gu, "정리")
    .replace(/適用/gu, "적용")
    .replace(/構造/gu, "구조")
    .replace(/어느 텍스트에서 유래한지/gu, "어느 텍스트에서 왔는지")
    .replace(/텍스트에서 유래한지/gu, "어느 텍스트에서 왔는지")
    .replace(/텍스트에서 출처한지/gu, "어느 텍스트에서 왔는지")
    .replace(/어느 어느 텍스트에서 왔는지/gu, "어느 텍스트에서 왔는지")
    .replace(/([가-힣])한지 확인해 주세요\./gu, "$1는지 확인해 주세요.")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function countObjectEntries(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }
  return Object.keys(value).length;
}

function toId(prefix, value = "") {
  const slug =
    normalizeString(value)
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

function getContextModel(intentEnvelope = {}, execution = {}) {
  const fromExecution = execution?.contextModel;
  if (fromExecution && typeof fromExecution === "object") {
    return fromExecution;
  }
  const fromEnvelope = intentEnvelope?.contextModel;
  return fromEnvelope && typeof fromEnvelope === "object" ? fromEnvelope : {};
}

function getFocusedNodeSummary(intentEnvelope = {}, execution = {}) {
  const contextModel = getContextModel(intentEnvelope, execution);
  const focusedNode =
    contextModel?.focusedNode && typeof contextModel.focusedNode === "object"
      ? contextModel.focusedNode
      : null;
  if (!focusedNode) {
    return null;
  }

  const node = focusedNode.node && typeof focusedNode.node === "object" ? focusedNode.node : {};
  const layout = focusedNode.layout && typeof focusedNode.layout === "object" ? focusedNode.layout : {};
  const sourceComponent =
    focusedNode.sourceComponent && typeof focusedNode.sourceComponent === "object"
      ? focusedNode.sourceComponent
      : null;
  const variantProperties =
    focusedNode.variantProperties && typeof focusedNode.variantProperties === "object"
      ? focusedNode.variantProperties
      : {};
  const componentProperties =
    focusedNode.componentProperties && typeof focusedNode.componentProperties === "object"
      ? focusedNode.componentProperties
      : {};

  return {
    nodeType: normalizeString(node.type),
    nodeName: normalizeString(node.name),
    layoutMode: normalizeString(layout.layoutMode),
    itemSpacing: Number.isFinite(layout.itemSpacing) ? layout.itemSpacing : undefined,
    sourceComponentName:
      normalizeString(sourceComponent?.name) ||
      normalizeString(sourceComponent?.componentSetName) ||
      normalizeString(sourceComponent?.id),
    variantProperties,
    componentProperties,
    variantPropertyCount: countObjectEntries(variantProperties),
    componentPropertyCount: countObjectEntries(componentProperties)
  };
}

function getStructureSummary(intentEnvelope = {}, execution = {}) {
  const contextModel = getContextModel(intentEnvelope, execution);
  const structure =
    contextModel?.structure && typeof contextModel.structure === "object"
      ? contextModel.structure
      : null;
  if (!structure) {
    return null;
  }

  return {
    depth: Number.isFinite(structure.depth) ? structure.depth : 0,
    childCount: Number.isFinite(structure.childCount) ? structure.childCount : 0,
    textNodeCount: Number.isFinite(structure.textNodeCount) ? structure.textNodeCount : 0,
    instanceCount: Number.isFinite(structure.instanceCount) ? structure.instanceCount : 0,
    componentSetCount: Number.isFinite(structure.componentSetCount) ? structure.componentSetCount : 0,
    autoLayoutFrames: Number.isFinite(structure.autoLayoutFrames) ? structure.autoLayoutFrames : 0
  };
}

function getDesignSystemSummary(intentEnvelope = {}, execution = {}) {
  const contextModel = getContextModel(intentEnvelope, execution);
  const designSystem =
    contextModel?.designSystem && typeof contextModel.designSystem === "object"
      ? contextModel.designSystem
      : null;
  if (!designSystem) {
    return null;
  }

  return {
    shouldLookup: Boolean(designSystem.shouldLookup),
    componentCandidates: normalizeArray(designSystem.componentCandidates),
    instanceMatches: normalizeArray(designSystem.instanceMatches),
    variableDefs: normalizeArray(designSystem.variableDefs),
    tokenSnapshot:
      designSystem.tokenSnapshot && typeof designSystem.tokenSnapshot === "object"
        ? designSystem.tokenSnapshot
        : null,
    libraryAssetMatches: normalizeArray(designSystem.libraryAssetMatches),
    componentHints: normalizeArray(designSystem.componentHints),
    tokenHints: normalizeArray(designSystem.tokenHints),
    libraryHints: normalizeArray(designSystem.libraryHints)
  };
}

function getExecutionSummary(execution = {}) {
  return execution?.summary && typeof execution.summary === "object" ? execution.summary : {};
}

function hasPrimitiveTokenAuditContext(intentEnvelope = {}, execution = {}) {
  const designSystem = getDesignSystemSummary(intentEnvelope, execution);
  return Boolean(
    intentEnvelope?.designerContext?.assetLookup?.primitiveTokenContext === true &&
      designSystem?.tokenSnapshot?.variableCount
  );
}

function buildComponentAuditReport(intentEnvelope = {}, execution = {}) {
  const focusedNode = getFocusedNodeSummary(intentEnvelope, execution);
  const designSystem = getDesignSystemSummary(intentEnvelope, execution);
  const summary = getExecutionSummary(execution);
  const warnings = normalizeArray(execution?.contextWarnings);
  const targetLabel = normalizeString(intentEnvelope?.designerContext?.target?.label) || focusedNode?.nodeName || "선택 컴포넌트";
  const issues = [];

  if (!focusedNode?.sourceComponentName && !focusedNode?.variantPropertyCount && !focusedNode?.componentPropertyCount) {
    issues.push({
      severity: "medium",
      subject: "component property evidence",
      detail: "variant, source component, override 근거가 충분히 확인되지 않았습니다."
    });
  }
  if (warnings.length) {
    issues.push({
      severity: "medium",
      subject: "design-system lookup",
      detail: `일부 디자인시스템 조회가 실패했습니다 (${warnings.length}건).`
    });
  }
  if ((summary.errorCount || 0) > 0) {
    issues.push({
      severity: "high",
      subject: "read coverage",
      detail: `읽기 명령 ${summary.errorCount}건이 실패해 컴포넌트 개선 판단 범위가 줄었습니다.`
    });
  }

  const priorities = issues.slice(0, 4).map((issue) => ({
    severity: issue.severity,
    title: issue.subject === "read coverage" ? "실패한 읽기 재시도" : "컴포넌트 근거 보강",
    subject: issue.subject
  }));

  return composeBuddyStyleAuditReport({
    title: "컴포넌트 개선 분석 결과",
    completionClaim: `${targetLabel}의 구조, 속성, 디자인시스템 조회 결과를 기준으로 QA를 진행했습니다.`,
    evidence: [
      focusedNode?.nodeName ? `대상 ${focusedNode.nodeName} (${focusedNode.nodeType || "type unknown"})` : `대상 ${targetLabel}`,
      focusedNode?.sourceComponentName ? `원본 컴포넌트 ${focusedNode.sourceComponentName}` : "",
      focusedNode?.variantPropertyCount ? `variant ${focusedNode.variantPropertyCount}개` : "",
      focusedNode?.componentPropertyCount ? `component property ${focusedNode.componentPropertyCount}개` : "",
      designSystem?.componentCandidates?.length ? `컴포넌트 후보 ${designSystem.componentCandidates.length}개` : "",
      designSystem?.instanceMatches?.length ? `유사 인스턴스 ${designSystem.instanceMatches.length}개` : "",
      `read command ${summary.okCount || 0}/${summary.commandCount || 0} 성공`
    ].filter(Boolean),
    strengths: [
      "선택 대상을 컴포넌트/디자인시스템 관점으로 읽는 경로가 실행되었습니다.",
      focusedNode?.layoutMode ? `auto layout ${focusedNode.layoutMode} 정보를 개선 판단에 사용할 수 있습니다.` : ""
    ].filter(Boolean),
    issues,
    priorities,
    recommendations: [
      "variant, override, source component 근거를 먼저 확정한 뒤 개선 범위를 나누세요.",
      "검색 실패가 있으면 디자인시스템 후보 조회를 재시도하고, 없으면 현재 컴포넌트 자체의 property 정리를 우선하세요.",
      "교체보다 먼저 현재 컴포넌트의 상태, 크기, semantic 역할을 문서화하세요."
    ],
    limits: warnings
  });
}

function buildFrameUxAuditReport(intentEnvelope = {}, execution = {}) {
  const focusedNode = getFocusedNodeSummary(intentEnvelope, execution);
  const structure = getStructureSummary(intentEnvelope, execution);
  const summary = getExecutionSummary(execution);
  const warnings = normalizeArray(execution?.contextWarnings);
  const targetLabel = normalizeString(intentEnvelope?.designerContext?.target?.label) || focusedNode?.nodeName || "선택 프레임";
  const issues = [];

  if (focusedNode?.nodeType === "SECTION") {
    issues.push({
      severity: "medium",
      subject: "review target scope",
      detail: "대상이 실제 앱 화면 FRAME이 아니라 SECTION이라 UX/UI 판단은 구조 리뷰 중심으로 제한됩니다."
    });
  }
  if (!focusedNode?.layoutMode && !structure?.autoLayoutFrames) {
    issues.push({
      severity: "medium",
      subject: "layout evidence",
      detail: "auto layout 근거가 부족해 spacing rhythm 판단이 제한됩니다."
    });
  }
  if (warnings.length) {
    issues.push({
      severity: "low",
      subject: "context coverage",
      detail: `일부 보조 컨텍스트가 부족합니다 (${warnings.length}건).`
    });
  }

  const priorities = issues.slice(0, 4).map((issue) => ({
    severity: issue.severity,
    title:
      issue.subject === "review target scope"
        ? "리뷰 대상 프레임 확정"
        : issue.subject === "layout evidence"
          ? "레이아웃 근거 보강"
          : "보조 컨텍스트 보강",
    subject: issue.subject
  }));

  return composeBuddyStyleAuditReport({
    title: "UX/UI 리뷰 결과",
    completionClaim: `${targetLabel}의 구조, 텍스트 밀도, 레이아웃 근거를 기준으로 리뷰했습니다.`,
    evidence: [
      focusedNode?.nodeName ? `대상 ${focusedNode.nodeName} (${focusedNode.nodeType || "type unknown"})` : `대상 ${targetLabel}`,
      focusedNode?.layoutMode ? `layout mode ${focusedNode.layoutMode}` : "",
      Number.isFinite(focusedNode?.itemSpacing) ? `item spacing ${focusedNode.itemSpacing}` : "",
      structure ? `child ${structure.childCount}, text ${structure.textNodeCount}, auto layout ${structure.autoLayoutFrames}` : "",
      `read command ${summary.okCount || 0}/${summary.commandCount || 0} 성공`
    ].filter(Boolean),
    strengths: [
      "선택 구조를 기준으로 정보 블록과 레이아웃 범위를 분리해 볼 수 있습니다.",
      structure?.textNodeCount ? `텍스트 노드 ${structure.textNodeCount}개를 기준으로 정보 밀도를 검토할 수 있습니다.` : ""
    ].filter(Boolean),
    issues,
    priorities,
    recommendations: [
      "실제 화면 FRAME을 대상으로 다시 읽으면 hierarchy, spacing, touch target을 더 정확히 검수할 수 있습니다.",
      "SECTION 단위에서는 먼저 색상군/정보 그룹의 구획과 제목 체계를 정리하세요.",
      "반복 블록은 동일 spacing과 label hierarchy를 기준으로 정렬하세요."
    ],
    limits: warnings
  });
}

function buildBuddyAuditReport(intentKind, intentEnvelope = {}, execution = {}) {
  if (hasPrimitiveTokenAuditContext(intentEnvelope, execution)) {
    return buildBuddyStylePrimitiveColorReport(getDesignSystemSummary(intentEnvelope, execution).tokenSnapshot);
  }
  if (
    intentKind === "swap_or_recommend_component" ||
    intentKind === "adapt_variant" ||
    intentKind === "align_to_design_system"
  ) {
    return buildComponentAuditReport(intentEnvelope, execution);
  }
  if (intentKind === "improve_hierarchy" || intentKind === "restructure_layout" || intentKind === "adjust_spacing") {
    return buildFrameUxAuditReport(intentEnvelope, execution);
  }
  return "";
}

function buildCoreFinding(intentKind, designerContext = {}, execution = {}, intentEnvelope = {}) {
  const focusedDetail = getFocusedDetail(designerContext);
  const focusedNode = getFocusedNodeSummary(intentEnvelope, execution);
  const structure = getStructureSummary(intentEnvelope, execution);
  const designSystem = getDesignSystemSummary(intentEnvelope, execution);
  const selectionSummary = normalizeString(designerContext?.fastContext?.selectionSummary);

  if (intentKind === "inspect_selection") {
    if (
      focusedNode &&
      (focusedNode.sourceComponentName ||
        focusedNode.variantPropertyCount > 0 ||
        focusedNode.componentPropertyCount > 0)
    ) {
      const detail = [
        focusedNode.sourceComponentName ? `원본 컴포넌트 ${focusedNode.sourceComponentName}` : "",
        focusedNode.variantPropertyCount > 0 ? `variant ${focusedNode.variantPropertyCount}개` : "",
        focusedNode.componentPropertyCount > 0 ? `override ${focusedNode.componentPropertyCount}개` : ""
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        id: toId("finding", "inspect-selection-instance"),
        severity: "low",
        label: "선택한 인스턴스의 variant와 override를 확인했습니다.",
        detail: detail || selectionSummary || "현재 선택을 기준으로 인스턴스 구성을 읽었습니다."
      };
    }

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
    if (focusedNode?.layoutMode) {
      const detail = [
        focusedNode.layoutMode ? `auto layout ${focusedNode.layoutMode}` : "",
        Number.isFinite(focusedNode.itemSpacing) ? `spacing ${focusedNode.itemSpacing}` : "",
        structure?.textNodeCount ? `text ${structure.textNodeCount}개` : "",
        structure?.childCount ? `child ${structure.childCount}개` : ""
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        id: toId("finding", `${intentKind}-layout-context-model`),
        severity: "high",
        label: "선택 프레임의 auto layout과 spacing을 기준으로 정리할 수 있습니다.",
        detail: detail || selectionSummary || "선택 프레임의 레이아웃 정보를 읽었습니다."
      };
    }

    if (focusedDetail.status === "available") {
      return {
        id: toId("finding", `${intentKind}-layout`),
        severity: "high",
        label: "선택 구조를 기준으로 레이아웃 정리가 가능합니다.",
        detail: [
          normalizeString(focusedDetail.nodeType) ? `nodeType ${focusedDetail.nodeType}` : "",
          normalizeString(focusedDetail.layoutMode) ? `layout ${focusedDetail.layoutMode}` : "",
          Number.isFinite(focusedDetail.itemSpacing) ? `spacing ${focusedDetail.itemSpacing}` : ""
        ]
          .filter(Boolean)
          .join(" · ")
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
    if (designSystem) {
      const detail = [
        designSystem.componentCandidates.length ? `추천 컴포넌트 ${designSystem.componentCandidates.length}개` : "",
        designSystem.variableDefs.length ? `variable ${designSystem.variableDefs.length}개` : "",
        designSystem.tokenSnapshot?.variableCount ? `token snapshot ${designSystem.tokenSnapshot.variableCount}개` : "",
        designSystem.instanceMatches.length ? `유사 인스턴스 ${designSystem.instanceMatches.length}개` : ""
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        id: toId("finding", `${intentKind}-ds-context-model`),
        severity: "high",
        label: "현재 선택에 맞는 design system 컴포넌트를 추천할 수 있습니다.",
        detail:
          detail || "컴포넌트 후보, 변수, 유사 인스턴스 정보를 함께 읽어 추천 근거를 만들었습니다."
      };
    }

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
      label:
        intentKind === "revise_copy"
          ? "텍스트와 주석 기준으로 문구 개선이 가능합니다."
          : "텍스트 계층 기준으로 타이포 정리가 가능합니다.",
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

function buildRecommendations(intentKind, designerContext = {}, execution = {}, intentEnvelope = {}) {
  const focusedDetail = getFocusedDetail(designerContext);
  const focusedNode = getFocusedNodeSummary(intentEnvelope, execution);
  const structure = getStructureSummary(intentEnvelope, execution);
  const designSystem = getDesignSystemSummary(intentEnvelope, execution);
  const recommendations = [];

  if (hasPrimitiveTokenAuditContext(intentEnvelope, execution)) {
    const audit = auditPrimitiveColorTokens(designSystem.tokenSnapshot);
    return audit.priorities.slice(0, 4).map((item) => ({
      id: toId("rec", `primitive-color-${item.subject}-${item.title}`),
      title: item.title,
      reason: item.reason,
      actionType: "design_system_alignment"
    }));
  }

  if (intentKind === "inspect_selection") {
    if (
      focusedNode &&
      (focusedNode.sourceComponentName ||
        focusedNode.variantPropertyCount > 0 ||
        focusedNode.componentPropertyCount > 0)
    ) {
      recommendations.push({
        id: toId("rec", "document-instance-overrides"),
        title: "현재 variant와 override 차이를 먼저 기록하기",
        reason: focusedNode.sourceComponentName
          ? `${focusedNode.sourceComponentName} 기준으로 어떤 속성이 인스턴스에서 달라졌는지 빠르게 설명할 수 있습니다.`
          : "인스턴스 속성과 variant 값을 정리하면 후속 수정 범위를 더 정확히 잡을 수 있습니다.",
        actionType: "analysis_only"
      });
    }
    return recommendations;
  }

  if (intentKind === "restructure_layout" || intentKind === "improve_hierarchy") {
    recommendations.push({
      id: toId("rec", "group-and-prioritize"),
      title: "핵심 정보 블록을 우선순위 기준으로 다시 묶기",
      reason: focusedNode?.layoutMode
        ? `${focusedNode.layoutMode} 흐름을 유지하면서 정보 위계를 더 선명하게 만들 수 있습니다.`
        : focusedDetail.layoutMode
          ? `${focusedDetail.layoutMode} 흐름을 유지하면서 정보 위계를 더 선명하게 만들 수 있습니다.`
          : "현재 선택 기준으로 정보 위계를 더 선명하게 만들 수 있습니다.",
      actionType: "layout_restructure"
    });
  }

  if (intentKind === "adjust_spacing" || intentKind === "restructure_layout") {
    recommendations.push({
      id: toId("rec", "normalize-spacing"),
      title: "간격 리듬을 한 단계 정리하기",
      reason: Number.isFinite(focusedNode?.itemSpacing)
        ? `현재 spacing ${focusedNode.itemSpacing}을 기준으로 내/외부 간격 규칙을 통일할 수 있습니다.`
        : Number.isFinite(focusedDetail.itemSpacing)
          ? `현재 spacing ${focusedDetail.itemSpacing}을 기준으로 내/외부 간격 규칙을 통일할 수 있습니다.`
          : structure?.autoLayoutFrames
            ? `auto layout ${structure.autoLayoutFrames}개를 기준으로 간격 규칙을 통일할 수 있습니다.`
            : "선택 구조를 기준으로 내/외부 간격 규칙을 통일할 수 있습니다.",
      actionType: "spacing_tidy"
    });
  }

  if (intentKind === "align_to_design_system" || intentKind === "swap_or_recommend_component" || intentKind === "adapt_variant") {
    if (intentKind === "adapt_variant") {
      recommendations.push({
        id: toId("rec", "adjust-local-variant"),
        title: "현재 local variant 값을 목적에 맞게 바꾸기",
        reason: focusedNode?.variantPropertyCount > 0
          ? `현재 variant ${focusedNode.variantPropertyCount}개를 기준으로 local component set 안에서 값을 조정할 수 있습니다.`
          : "현재 선택이 local component set 안의 variant라면 값을 조정할 수 있습니다.",
        actionType: "variant_update"
      });
    }
    recommendations.push({
      id: toId("rec", "prefer-reusable-assets"),
      title: "현재 선택에 맞는 컴포넌트 후보부터 좁히기",
      reason: designSystem?.componentCandidates?.length
        ? `추천 가능한 컴포넌트 후보 ${designSystem.componentCandidates.length}개를 먼저 비교하면 직접 새로 그리는 작업을 줄일 수 있습니다.`
        : "직접 새로 그리기보다 기존 컴포넌트와 토큰을 우선 적용하는 편이 일관성과 구현 효율에 유리합니다.",
      actionType: "design_system_alignment"
    });
    if (designSystem?.variableDefs?.length) {
      recommendations.push({
        id: toId("rec", "reuse-variables"),
        title: "색상과 간격은 변수부터 맞추기",
        reason: `현재 선택과 연결될 수 있는 변수 ${designSystem.variableDefs.length}개가 보여서, 컴포넌트 교체 전에 토큰 정렬부터 진행할 수 있습니다.`,
        actionType: "design_system_alignment"
      });
    }
    if (designSystem?.tokenSnapshot?.variableCount) {
      recommendations.push({
        id: toId("rec", "audit-token-inventory"),
        title: "프리미티브 컬러는 전체 변수 스냅샷 기준으로 검수하기",
        reason: `현재 파일에서 변수 ${designSystem.tokenSnapshot.variableCount}개, 컬렉션 ${designSystem.tokenSnapshot.collectionCount || 0}개를 확인했으므로 누락, 중복, semantic/theme 연결 상태를 실제 토큰 근거로 점검할 수 있습니다.`,
        actionType: "design_system_alignment"
      });
    }
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
  if (normalizeString(bundle.primitiveColorReport)) {
    return sanitizeKoreanUiText(bundle.primitiveColorReport);
  }
  if (normalizeString(bundle.buddyAuditReport)) {
    return sanitizeKoreanUiText(bundle.buddyAuditReport);
  }
  if (bundle.intentKind === "inspect_selection") {
    return sanitizeKoreanUiText(normalizeString(normalizeArray(bundle.findings)[0]?.label)) || "선택 구조 확인을 완료했습니다.";
  }
  const firstFinding = normalizeArray(bundle.findings)[0];
  const firstRecommendation = normalizeArray(bundle.recommendations)[0];
  const parts = [
    sanitizeKoreanUiText(normalizeString(firstFinding?.label)),
    sanitizeKoreanUiText(normalizeString(firstRecommendation?.title))
  ].filter(Boolean);
  return parts.join(" / ") || "디자인 제안 초안을 만들었습니다.";
}

export function buildDesignerSuggestionBundle({ intentEnvelope = {}, execution = {} } = {}) {
  const intentKind = normalizeString(intentEnvelope?.intents?.[0]?.kind) || "analyze";
  const designerContext = intentEnvelope?.designerContext || {};
  const findings = [buildCoreFinding(intentKind, designerContext, execution, intentEnvelope)];
  const recommendations = buildRecommendations(intentKind, designerContext, execution, intentEnvelope);
  const applyActions = buildApplyActions(intentKind, designerContext, recommendations);
  const risks = buildRisks(execution, intentEnvelope);
  const buddyAuditReport = buildBuddyAuditReport(intentKind, intentEnvelope, execution);
  const primitiveColorReport = hasPrimitiveTokenAuditContext(intentEnvelope, execution)
    ? buddyAuditReport
    : "";

  const bundle = {
    version: DESIGNER_SUGGESTION_VERSION,
    intentKind,
    headline:
      sanitizeKoreanUiText(
        normalizeString(designerContext?.headline) ||
          normalizeString(intentEnvelope?.summary) ||
          "디자인 제안"
      ),
    analysis: {
      target: sanitizeKoreanUiText(normalizeString(designerContext?.target?.label)),
      phaseSummary: getExecutionSummary(execution),
      readHeadline: sanitizeKoreanUiText(normalizeString(intentEnvelope?.readPlan?.headline))
    },
    findings: findings.map((finding) => ({
      ...finding,
      label: sanitizeKoreanUiText(finding?.label),
      detail: sanitizeKoreanUiText(finding?.detail)
    })),
    recommendations: recommendations.map((recommendation) => ({
      ...recommendation,
      title: sanitizeKoreanUiText(recommendation?.title),
      reason: sanitizeKoreanUiText(recommendation?.reason)
    })),
    applyActions,
    risks: risks.map((risk) => sanitizeKoreanUiText(risk)),
    buddyAuditReport: sanitizeKoreanUiText(buddyAuditReport),
    primitiveColorReport: sanitizeKoreanUiText(primitiveColorReport)
  };

  return {
    ...bundle,
    summaryText: buildSummaryText(bundle)
  };
}

export function augmentDesignerSuggestionBundleWithAiPlan(
  designerSuggestionBundle = {},
  aiResponse = {},
  intentEnvelope = {}
) {
  const baseBundle =
    designerSuggestionBundle && typeof designerSuggestionBundle === "object"
      ? designerSuggestionBundle
      : {};
  const actionPlan = normalizeArray(aiResponse?.actionPlan);
  if (actionPlan.length === 0) {
    return baseBundle;
  }

  const baseRecommendations = normalizeArray(baseBundle.recommendations);
  const baseApplyActions = normalizeArray(baseBundle.applyActions);
  const targetNodeId = normalizeArray(intentEnvelope?.contextScope?.targetIds)[0] || null;

  const appendedRecommendations = actionPlan
    .map((step, index) => {
      const title = sanitizeKoreanUiText(normalizeString(step?.title));
      const detail = sanitizeKoreanUiText(normalizeString(step?.detail));
      if (!title) {
        return null;
      }
      return {
        id: toId("rec-ai", `${title}-${index + 1}`),
        title,
        reason: detail || "AI가 다음 단계 작업으로 제안했습니다.",
        actionType: "analysis_only"
      };
    })
    .filter(Boolean);

  const appendedApplyActions = actionPlan
    .map((step, index) => {
      const title = sanitizeKoreanUiText(normalizeString(step?.title));
      if (!title) {
        return null;
      }
      return {
        id: toId("apply-ai", `${title}-${index + 1}`),
        label: title,
        actionType:
          normalizeString(step?.requiresConfirmation) === "false" ? "analysis_only" : "analysis_only",
        status: "review_required",
        targetNodeId
      };
    })
    .filter(Boolean);

  const augmentedBundle = {
    ...baseBundle,
    recommendations: [...baseRecommendations, ...appendedRecommendations],
    applyActions: [...baseApplyActions, ...appendedApplyActions]
  };

  return {
    ...augmentedBundle,
    summaryText: buildSummaryText(augmentedBundle)
  };
}

export { DESIGNER_SUGGESTION_VERSION };
