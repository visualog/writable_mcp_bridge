const DESIGNER_CONTEXT_SUMMARY_VERSION = "1.0";

const ASSET_LOOKUP_KEYWORDS = [
  "design system",
  "component",
  "components",
  "variant",
  "variants",
  "token",
  "tokens",
  "style",
  "styles",
  "library",
  "libraries",
  "디자인 시스템",
  "컴포넌트",
  "변수",
  "토큰",
  "스타일",
  "라이브러리",
  "variant"
];

const DETAIL_LOOKUP_KEYWORDS = [
  "layout",
  "spacing",
  "hierarchy",
  "copy",
  "typography",
  "padding",
  "margin",
  "align",
  "restructure",
  "layout",
  "레이아웃",
  "간격",
  "여백",
  "위계",
  "카피",
  "타이포",
  "정렬",
  "재구성"
];

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => normalizeString(value)).filter(Boolean))];
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    const normalized = normalizeString(value);
    if (normalized) {
      return normalized;
    }
  }
  return "";
}

function countObjectEntries(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return 0;
  }
  return Object.keys(value).length;
}

function normalizeSelection(context = {}) {
  const selection = normalizeArray(context.selection).map((item, index) => ({
    id: pickFirstNonEmpty(item?.id, `selection_${index}`),
    name: pickFirstNonEmpty(item?.name, `Selection ${index + 1}`),
    type: normalizeString(item?.type) || undefined
  }));

  return {
    items: selection,
    ids: uniqueStrings(selection.map((item) => item.id).concat(normalizeArray(context.selectionIds))),
    names: uniqueStrings(selection.map((item) => item.name).concat(normalizeArray(context.selectionNames))),
    types: uniqueStrings(selection.map((item) => item.type).filter(Boolean))
  };
}

function normalizeDesignerContext(context = {}) {
  const selection = normalizeSelection(context);
  const pageId = pickFirstNonEmpty(context.pageId, context.currentPage?.id);
  const pageName = pickFirstNonEmpty(context.pageName, context.currentPage?.name);
  const frameId = pickFirstNonEmpty(context.frameId, context.currentFrame?.id);
  const frameName = pickFirstNonEmpty(context.frameName, context.currentFrame?.name);

  return {
    fileId: normalizeString(context.fileId) || undefined,
    fileName: normalizeString(context.fileName) || undefined,
    pageId: pageId || undefined,
    pageName: pageName || undefined,
    frameId: frameId || undefined,
    frameName: frameName || undefined,
    selection,
    selectionCount: selection.ids.length,
    selectionSummary:
      normalizeString(context.selectionSummary) ||
      (selection.names.length > 0 ? selection.names.join(", ") : undefined),
    libraryHints: uniqueStrings(normalizeArray(context.libraryHints)),
    tokenHints: uniqueStrings(normalizeArray(context.tokenHints)),
    componentHints: uniqueStrings(normalizeArray(context.componentHints)),
    selectedNodeDetails:
      context.selectedNodeDetails && typeof context.selectedNodeDetails === "object"
        ? context.selectedNodeDetails
        : undefined,
    targetPreference: normalizeString(context.targetPreference) || undefined,
    viewport: context.viewport && typeof context.viewport === "object" ? context.viewport : undefined,
    platform: normalizeString(context.platform) || undefined,
    pageStats: context.pageStats && typeof context.pageStats === "object" ? context.pageStats : undefined
  };
}

function inferTargetType(normalizedContext = {}) {
  if (normalizedContext.targetPreference === "generated_screen") {
    return "generated_screen";
  }
  if (normalizedContext.selectionCount > 0) {
    return "current_selection";
  }
  if (normalizedContext.frameId) {
    return "current_frame";
  }
  return "current_page";
}

function requestIncludesAny(requestText = "", keywords = []) {
  const normalized = normalizeString(requestText).toLowerCase();
  if (!normalized) {
    return false;
  }
  return keywords.some((keyword) => normalized.includes(keyword));
}

function buildFocusedDetailSummary(normalizedContext = {}) {
  const selectedNodeDetails = normalizedContext.selectedNodeDetails;
  if (!selectedNodeDetails || selectedNodeDetails.error) {
    return {
      status: selectedNodeDetails?.error ? "failed" : "pending",
      reason: selectedNodeDetails?.error || "No detail payload has been fetched yet."
    };
  }

  const detail = selectedNodeDetails.detail || {};
  const node = detail.node || {};
  const layout = detail.layout || {};
  const sourceComponent = detail.sourceComponent || {};

  return {
    status: "available",
    reason: "Selected node detail is available for deeper designer reasoning.",
    nodeType: pickFirstNonEmpty(node.type, normalizedContext.selection.types[0]),
    layoutMode: normalizeString(layout.layoutMode) || undefined,
    itemSpacing: Number.isFinite(layout.itemSpacing) ? layout.itemSpacing : undefined,
    sourceComponentName: pickFirstNonEmpty(
      sourceComponent.name,
      sourceComponent.componentSetName,
      sourceComponent.id,
      sourceComponent.componentSetId
    ) || undefined,
    variantPropertyCount: countObjectEntries(detail.variantProperties),
    componentPropertyCount: countObjectEntries(detail.componentProperties),
    fallbackUsed: Boolean(selectedNodeDetails.fallbackUsed),
    truncated: Boolean(selectedNodeDetails.truncated)
  };
}

function buildAssetLookupSummary(normalizedContext = {}, requestText = "") {
  const reasonMatchesRequest = requestIncludesAny(requestText, ASSET_LOOKUP_KEYWORDS);
  const hintCount =
    normalizedContext.libraryHints.length +
    normalizedContext.tokenHints.length +
    normalizedContext.componentHints.length;
  const shouldLookup = reasonMatchesRequest || hintCount > 0;

  const reasons = [];
  if (reasonMatchesRequest) {
    reasons.push("The request mentions components, tokens, styles, or design-system alignment.");
  }
  if (normalizedContext.tokenHints.length > 0) {
    reasons.push("Token hints are already present in the current context.");
  }
  if (normalizedContext.componentHints.length > 0) {
    reasons.push("Component hints are already present in the current context.");
  }
  if (normalizedContext.libraryHints.length > 0) {
    reasons.push("Library hints are already present in the current context.");
  }

  return {
    shouldLookup,
    reasons,
    availableHints: {
      libraryCount: normalizedContext.libraryHints.length,
      tokenCount: normalizedContext.tokenHints.length,
      componentCount: normalizedContext.componentHints.length
    },
    hints: {
      libraries: normalizedContext.libraryHints,
      tokens: normalizedContext.tokenHints,
      components: normalizedContext.componentHints
    }
  };
}

function buildReadStrategy(normalizedContext = {}, requestText = "", targetType = "current_page") {
  const needsFocusedDetail =
    normalizedContext.selectionCount > 0 || requestIncludesAny(requestText, DETAIL_LOOKUP_KEYWORDS);
  const assetLookup = buildAssetLookupSummary(normalizedContext, requestText);

  const followUps = [];
  if (needsFocusedDetail) {
    followUps.push("focused_detail");
  }
  if (assetLookup.shouldLookup) {
    followUps.push("asset_lookup");
  }

  let primaryMode = "fast_context";
  let scope = "selection_first";
  let reason = "Use a lightweight summary first so every design-AI turn stays responsive.";

  if (targetType === "generated_screen") {
    scope = "page_generation";
    reason = "The request is creating a new screen, so the current page context is enough for the first read.";
  } else if (targetType === "current_frame") {
    scope = "frame_first";
    reason = "Use the active frame as the initial target before expanding to deeper detail.";
  } else if (targetType === "current_page") {
    scope = "page_first";
    reason = "No explicit selection exists, so the read should stay at page summary depth before escalating.";
  }

  const deferredReads = ["full_page_scan", "multi_page_inventory"];
  if (assetLookup.shouldLookup) {
    deferredReads.push("cross_library_import");
  }

  return {
    primaryMode,
    scope,
    reason,
    followUps,
    deferredReads,
    largeFileSafe: true,
    doNotFullScanByDefault: true
  };
}

function buildHeadline(normalizedContext = {}, targetType = "current_page", focusedDetail = {}) {
  if (targetType === "current_selection" && normalizedContext.selectionCount > 0) {
    const lead = normalizedContext.selectionCount === 1
      ? `${normalizedContext.selection.names[0]} 선택됨`
      : `${normalizedContext.selectionCount}개 노드 선택됨`;
    if (focusedDetail.status === "available" && focusedDetail.nodeType) {
      return `${lead} · ${focusedDetail.nodeType} 기준 요약`;
    }
    return `${lead} · 선택 우선 요약`;
  }

  if (targetType === "current_frame" && normalizedContext.frameName) {
    return `${normalizedContext.frameName} 프레임 기준 요약`;
  }

  if (targetType === "generated_screen") {
    return `${pickFirstNonEmpty(normalizedContext.pageName, normalizedContext.fileName, "현재 파일")} 기준 새 화면 설계`;
  }

  return `${pickFirstNonEmpty(normalizedContext.pageName, normalizedContext.fileName, "현재 페이지")} 페이지 요약`;
}

function buildTarget(normalizedContext = {}, targetType = "current_page") {
  const label =
    normalizedContext.selectionSummary ||
    normalizedContext.frameName ||
    normalizedContext.pageName ||
    normalizedContext.fileName ||
    "current context";

  return {
    type: targetType,
    label,
    ids:
      targetType === "current_selection"
        ? normalizedContext.selection.ids
        : targetType === "current_frame" && normalizedContext.frameId
          ? [normalizedContext.frameId]
          : [],
    selectionCount: normalizedContext.selectionCount
  };
}

export function buildDesignerContextSummary(figmaContext = {}, requestInput = {}) {
  const normalizedContext = normalizeDesignerContext(figmaContext);
  const requestText =
    typeof requestInput === "string"
      ? requestInput
      : pickFirstNonEmpty(
          requestInput.request,
          requestInput.prompt,
          requestInput.message,
          requestInput.userInput,
          requestInput.input
        );
  const targetType = inferTargetType(normalizedContext);
  const focusedDetail = buildFocusedDetailSummary(normalizedContext);
  const assetLookup = buildAssetLookupSummary(normalizedContext, requestText);
  const readStrategy = buildReadStrategy(normalizedContext, requestText, targetType);

  return {
    version: DESIGNER_CONTEXT_SUMMARY_VERSION,
    headline: buildHeadline(normalizedContext, targetType, focusedDetail),
    target: buildTarget(normalizedContext, targetType),
    fastContext: {
      fileName: normalizedContext.fileName || undefined,
      pageName: normalizedContext.pageName || undefined,
      selectionSummary:
        normalizedContext.selectionSummary ||
        (normalizedContext.selectionCount > 0 ? `${normalizedContext.selectionCount} selected` : "No selection"),
      selectionTypes: normalizedContext.selection.types,
      frameName: normalizedContext.frameName || undefined,
      platform: normalizedContext.platform || undefined
    },
    focusedDetail,
    assetLookup,
    readStrategy
  };
}

export { DESIGNER_CONTEXT_SUMMARY_VERSION };
