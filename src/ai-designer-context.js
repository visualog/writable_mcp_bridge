import { parseSelectionMetadataTree } from "./metadata-tree.js";

const DESIGNER_CONTEXT_SUMMARY_VERSION = "1.0";
const DESIGNER_CONTEXT_MODEL_VERSION = "1.0";

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

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function deepClone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function buildContextTarget(normalizedContext = {}, targetType = "current_page") {
  const ids =
    targetType === "current_selection"
      ? normalizedContext.selection.ids
      : targetType === "current_frame" && normalizedContext.frameId
        ? [normalizedContext.frameId]
        : [];
  const names =
    targetType === "current_selection"
      ? normalizedContext.selection.names
      : targetType === "current_frame" && normalizedContext.frameName
        ? [normalizedContext.frameName]
        : [];
  const types =
    targetType === "current_selection"
      ? normalizedContext.selection.types
      : [];
  const primaryTargetId = ids[0] || normalizedContext.frameId || undefined;
  const label =
    normalizedContext.selectionSummary ||
    normalizedContext.frameName ||
    normalizedContext.pageName ||
    normalizedContext.fileName ||
    "current context";

  return {
    type: targetType,
    selectionCount: normalizedContext.selectionCount,
    ids,
    names,
    types,
    primaryTargetId,
    label
  };
}

function buildBaseReadMeta() {
  return {
    commands: [],
    phases: [],
    skipped: [],
    missing: ["focusedNode", "structure", "designSystem"],
    partial: true,
    coverage: {
      fastContext: { status: "available", reason: "Base file/page/selection context is available." },
      focusedNode: { status: "missing", reason: "No focused detail payload has been collected yet." },
      structure: { status: "missing", reason: "No metadata tree or bounded structure summary has been collected yet." },
      designSystem: { status: "missing", reason: "No design-system lookup payload has been collected yet." }
    }
  };
}

function buildBaseDesignSystem(normalizedContext = {}, assetLookup = {}) {
  return {
    shouldLookup: Boolean(assetLookup?.shouldLookup),
    libraryHints: normalizeArray(assetLookup?.hints?.libraries ?? normalizedContext.libraryHints),
    tokenHints: normalizeArray(assetLookup?.hints?.tokens ?? normalizedContext.tokenHints),
    componentHints: normalizeArray(assetLookup?.hints?.components ?? normalizedContext.componentHints),
    componentCandidates: [],
    instanceMatches: [],
    variableDefs: [],
    libraryAssetMatches: []
  };
}

function buildBasePageContext(normalizedContext = {}, targetType = "current_page") {
  return {
    pageId: normalizedContext.pageId || undefined,
    pageName: normalizedContext.pageName || undefined,
    frameId: normalizedContext.frameId || undefined,
    frameName: normalizedContext.frameName || undefined,
    pageStats: normalizedContext.pageStats || undefined,
    summaryMode: targetType === "current_page" ? "bounded_page_summary" : "selection_local"
  };
}

function buildFocusedNodeFromSelectedDetails(selectedNodeDetails) {
  if (!selectedNodeDetails || typeof selectedNodeDetails !== "object" || selectedNodeDetails.error) {
    return null;
  }

  const detail = selectedNodeDetails.detail && typeof selectedNodeDetails.detail === "object"
    ? selectedNodeDetails.detail
    : {};
  const node = detail.node && typeof detail.node === "object" ? detail.node : {};
  const layout = detail.layout && typeof detail.layout === "object" ? detail.layout : {};
  const geometry =
    detail.geometry && typeof detail.geometry === "object"
      ? detail.geometry
      : node.geometry && typeof node.geometry === "object"
        ? node.geometry
        : {};

  return {
    node,
    geometry,
    layout,
    variantProperties:
      detail.variantProperties && typeof detail.variantProperties === "object"
        ? detail.variantProperties
        : {},
    componentProperties:
      detail.componentProperties && typeof detail.componentProperties === "object"
        ? detail.componentProperties
        : {},
    sourceComponent:
      detail.sourceComponent && typeof detail.sourceComponent === "object"
        ? detail.sourceComponent
        : null,
    fallbackUsed: Boolean(selectedNodeDetails.fallbackUsed),
    truncated: Boolean(selectedNodeDetails.truncated)
  };
}

export function buildDesignerContextModel(figmaContext = {}, options = {}) {
  const normalizedContext = normalizeDesignerContext(figmaContext);
  const targetType = normalizeString(options.targetType) || inferTargetType(normalizedContext);
  const assetLookup = buildAssetLookupSummary(normalizedContext, normalizeString(options.requestText));
  const focusedNode = buildFocusedNodeFromSelectedDetails(normalizedContext.selectedNodeDetails);
  const readMeta = buildBaseReadMeta();

  if (focusedNode) {
    readMeta.coverage.focusedNode = {
      status: "available",
      reason: "Focused detail was supplied in the initial Figma context."
    };
    readMeta.missing = readMeta.missing.filter((item) => item !== "focusedNode");
  }

  return {
    meta: {
      version: DESIGNER_CONTEXT_MODEL_VERSION,
      fileId: normalizedContext.fileId || undefined,
      fileName: normalizedContext.fileName || undefined,
      pageId: normalizedContext.pageId || undefined,
      pageName: normalizedContext.pageName || undefined,
      platform: normalizedContext.platform || undefined,
      viewport: normalizedContext.viewport || undefined,
      capturedAt: toIsoString(options.capturedAt)
    },
    target: buildContextTarget(normalizedContext, targetType),
    selection: {
      items: normalizedContext.selection.items
    },
    focusedNode,
    structure: null,
    designSystem: buildBaseDesignSystem(normalizedContext, assetLookup),
    pageContext: buildBasePageContext(normalizedContext, targetType),
    readMeta
  };
}

function collectCommandEntries(execution = {}) {
  return normalizeArray(execution.phases).flatMap((phase) =>
    normalizeArray(phase.commandResults).map((entry) => ({
      phase: phase.phase,
      ...entry
    }))
  );
}

function findCommandEntries(execution = {}, command) {
  return collectCommandEntries(execution).filter((entry) => normalizeString(entry.command) === command);
}

function findFirstOkResult(execution = {}, command) {
  const entry = findCommandEntries(execution, command).find((item) => item.status === "ok");
  return entry?.result && typeof entry.result === "object" ? entry.result : null;
}

function mergeObjects(...values) {
  return Object.assign({}, ...values.filter((value) => value && typeof value === "object"));
}

function countMetadataTree(root) {
  const base = {
    depth: 0,
    childCount: 0,
    childTypes: [],
    textNodeCount: 0,
    instanceCount: 0,
    componentSetCount: 0,
    autoLayoutFrames: 0
  };

  if (!root || typeof root !== "object") {
    return base;
  }

  base.childCount = normalizeArray(root.children).length;
  base.childTypes = uniqueStrings(normalizeArray(root.children).map((node) => node?.type));

  function walk(node, depth) {
    if (!node || typeof node !== "object") {
      return;
    }

    base.depth = Math.max(base.depth, depth);
    const type = normalizeString(node.type).toUpperCase();
    if (type === "TEXT") {
      base.textNodeCount += 1;
    }
    if (type === "INSTANCE") {
      base.instanceCount += 1;
    }
    if (type === "COMPONENT_SET") {
      base.componentSetCount += 1;
    }
    if ((type === "FRAME" || type === "INSTANCE") && countObjectEntries(node.layout || {}) > 0) {
      base.autoLayoutFrames += 1;
    }

    for (const child of normalizeArray(node.children)) {
      walk(child, depth + 1);
    }
  }

  walk(root, 0);
  return base;
}

function buildStructureSummary({ metadataResult, focusedNode } = {}) {
  const metadataTree =
    metadataResult?.metadataTree && typeof metadataResult.metadataTree === "object"
      ? metadataResult.metadataTree
      : normalizeString(metadataResult?.xml)
        ? parseSelectionMetadataTree(metadataResult.xml)
        : null;
  const counts = countMetadataTree(metadataTree);
  const layoutMode = normalizeString(focusedNode?.layout?.layoutMode).toUpperCase();

  return {
    metadataTree,
    depth: counts.depth,
    childCount:
      counts.childCount ||
      (Number.isFinite(focusedNode?.node?.childCount) ? focusedNode.node.childCount : 0),
    childTypes: counts.childTypes,
    textNodeCount: counts.textNodeCount,
    instanceCount: counts.instanceCount,
    componentSetCount: counts.componentSetCount,
    autoLayoutFrames:
      counts.autoLayoutFrames || (layoutMode && layoutMode !== "NONE" ? 1 : 0)
  };
}

function normalizeVariableDefs(result = {}) {
  if (Array.isArray(result.variables)) {
    return result.variables;
  }
  if (result.variables && typeof result.variables === "object") {
    return Object.entries(result.variables).map(([name, value]) => ({ name, value }));
  }
  return [];
}

function normalizeMatches(result = {}) {
  return Array.isArray(result.matches) ? result.matches : [];
}

function buildFocusedNodeFromExecution(execution = {}) {
  const detailPayload = findFirstOkResult(execution, "get_node_details") || {};
  const instancePayload = findFirstOkResult(execution, "get_instance_details") || {};
  const componentVariantPayload = findFirstOkResult(execution, "get_component_variant_details") || {};

  const detail = detailPayload.detail && typeof detailPayload.detail === "object" ? detailPayload.detail : {};
  const instanceDetail =
    instancePayload.detail && typeof instancePayload.detail === "object" ? instancePayload.detail : {};
  const componentVariantDetail =
    componentVariantPayload.detail && typeof componentVariantPayload.detail === "object"
      ? componentVariantPayload.detail
      : {};

  const node = mergeObjects(instanceDetail.node, componentVariantDetail.node, detail.node);
  const layout = mergeObjects(instanceDetail.layout, componentVariantDetail.layout, detail.layout);
  const geometry = mergeObjects(detail.geometry, instanceDetail.geometry, componentVariantDetail.geometry, node.geometry);
  const variantProperties = mergeObjects(
    detail.variantProperties,
    instanceDetail.variantProperties,
    componentVariantDetail.variantProperties
  );
  const componentProperties = mergeObjects(
    detail.componentProperties,
    instanceDetail.componentProperties,
    componentVariantDetail.componentProperties
  );
  const sourceComponent =
    detail.sourceComponent || instanceDetail.sourceComponent || componentVariantDetail.sourceComponent || null;

  if (!countObjectEntries(node) && !countObjectEntries(layout) && !sourceComponent) {
    return null;
  }

  return {
    node,
    geometry,
    layout,
    variantProperties,
    componentProperties,
    sourceComponent,
    fallbackUsed: Boolean(detailPayload?.fallbackUsed || instancePayload?.fallbackUsed || componentVariantPayload?.fallbackUsed),
    truncated: Boolean(detailPayload?.truncated || instancePayload?.truncated || componentVariantPayload?.truncated)
  };
}

function deriveSectionStatus(entries = [], hasValue, reasons = {}) {
  if (hasValue) {
    return { status: "available", reason: reasons.available || "Section data is available." };
  }
  if (entries.some((entry) => entry.status === "error")) {
    return { status: "partial", reason: reasons.partial || "Some reads failed while collecting this section." };
  }
  if (entries.length > 0 && entries.every((entry) => entry.status === "skipped")) {
    return { status: "skipped", reason: reasons.skipped || "This section was intentionally skipped." };
  }
  return { status: "missing", reason: reasons.missing || "No reads populated this section." };
}

export function buildDesignerContextModelFromExecution({
  intentEnvelope = {},
  execution = {}
} = {}) {
  const baseContextModel =
    intentEnvelope?.contextModel && typeof intentEnvelope.contextModel === "object"
      ? deepClone(intentEnvelope.contextModel)
      : buildDesignerContextModel({}, { capturedAt: execution?.executedAt });

  const normalizedContext = normalizeDesignerContext({
    fileId: baseContextModel?.meta?.fileId,
    fileName: baseContextModel?.meta?.fileName,
    pageId: baseContextModel?.meta?.pageId,
    pageName: baseContextModel?.meta?.pageName,
    selection: baseContextModel?.selection?.items,
    selectionSummary: baseContextModel?.target?.label,
    viewport: baseContextModel?.meta?.viewport,
    platform: baseContextModel?.meta?.platform,
    pageStats: baseContextModel?.pageContext?.pageStats,
    libraryHints: baseContextModel?.designSystem?.libraryHints,
    tokenHints: baseContextModel?.designSystem?.tokenHints,
    componentHints: baseContextModel?.designSystem?.componentHints
  });

  const focusedNode = buildFocusedNodeFromExecution(execution) || baseContextModel.focusedNode || null;
  const metadataResult = findFirstOkResult(execution, "get_metadata");
  const structure = metadataResult || focusedNode
    ? buildStructureSummary({ metadataResult, focusedNode })
    : null;

  const assetLookup = intentEnvelope?.designerContext?.assetLookup || {};
  const designSystem = {
    shouldLookup: Boolean(assetLookup?.shouldLookup),
    libraryHints: normalizeArray(assetLookup?.hints?.libraries ?? baseContextModel?.designSystem?.libraryHints),
    tokenHints: normalizeArray(assetLookup?.hints?.tokens ?? baseContextModel?.designSystem?.tokenHints),
    componentHints: normalizeArray(assetLookup?.hints?.components ?? baseContextModel?.designSystem?.componentHints),
    componentCandidates: [
      ...normalizeMatches(findFirstOkResult(execution, "search_design_system") || {}),
      ...normalizeMatches(findFirstOkResult(execution, "search_file_components") || {})
    ],
    instanceMatches: normalizeMatches(findFirstOkResult(execution, "search_instances") || {}),
    variableDefs: normalizeVariableDefs(findFirstOkResult(execution, "get_variable_defs") || {}),
    libraryAssetMatches: normalizeMatches(findFirstOkResult(execution, "search_library_assets") || {})
  };

  const allEntries = collectCommandEntries(execution);
  const focusedEntries = allEntries.filter((entry) =>
    ["get_node_details", "get_instance_details", "get_component_variant_details"].includes(entry.command)
  );
  const structureEntries = allEntries.filter((entry) => ["get_metadata", "snapshot_selection"].includes(entry.command));
  const designSystemEntries = allEntries.filter((entry) =>
    ["get_variable_defs", "search_design_system", "search_file_components", "search_library_assets", "search_instances"].includes(entry.command)
  );

  const coverage = {
    fastContext: { status: "available", reason: "Fast context is available from the envelope and initial reads." },
    focusedNode: deriveSectionStatus(focusedEntries, Boolean(focusedNode), {
      available: "Focused node detail was collected from bounded node/detail reads.",
      partial: "Some focused-detail reads failed, but partial node detail is available.",
      skipped: "Focused detail reads were skipped for this request.",
      missing: "No focused-detail reads populated the primary target."
    }),
    structure: deriveSectionStatus(structureEntries, Boolean(structure), {
      available: "A bounded structure summary is available from metadata reads.",
      partial: "Structure reads were only partially available.",
      skipped: "Structure reads were skipped for this request.",
      missing: "No bounded structure summary is available yet."
    }),
    designSystem: deriveSectionStatus(
      designSystemEntries,
      Boolean(
        designSystem.variableDefs.length ||
          designSystem.componentCandidates.length ||
          designSystem.instanceMatches.length ||
          designSystem.libraryAssetMatches.length
      ),
      {
        available: "Design-system lookup data is available.",
        partial: "Some design-system reads failed, but partial lookup data is available.",
        skipped: "Design-system lookup was skipped for this request.",
        missing: "No design-system lookup data was collected."
      }
    )
  };

  const skipped = allEntries
    .filter((entry) => entry.status === "skipped")
    .map((entry) => ({ command: entry.command, reason: entry.reason, phase: entry.phase }));
  const missing = Object.entries(coverage)
    .filter(([, value]) => value.status === "missing")
    .map(([key]) => key);
  const contextWarnings = [
    ...allEntries
      .filter((entry) => entry.status === "error")
      .map((entry) => `${entry.command}: ${entry.error || "unknown error"}`),
    ...missing.map((key) => `${key}_missing`)
  ];

  const readMeta = {
    commands: uniqueStrings(allEntries.map((entry) => entry.command)),
    phases: uniqueStrings(normalizeArray(execution.phases).map((phase) => phase.phase)),
    skipped,
    missing,
    partial: Object.values(coverage).some((entry) => ["missing", "partial"].includes(entry.status)),
    coverage
  };

  const contextModel = {
    meta: {
      ...baseContextModel.meta,
      version: DESIGNER_CONTEXT_MODEL_VERSION,
      capturedAt: execution?.executedAt || baseContextModel?.meta?.capturedAt || toIsoString()
    },
    target: {
      ...buildContextTarget(normalizedContext, intentEnvelope?.contextScope?.targetType || baseContextModel?.target?.type),
      label: baseContextModel?.target?.label || buildContextTarget(normalizedContext, intentEnvelope?.contextScope?.targetType).label
    },
    selection: {
      items: normalizeArray(baseContextModel?.selection?.items)
    },
    focusedNode,
    structure,
    designSystem,
    pageContext: {
      ...buildBasePageContext(normalizedContext, intentEnvelope?.contextScope?.targetType || baseContextModel?.target?.type),
      pageStats: baseContextModel?.pageContext?.pageStats || normalizedContext.pageStats || undefined
    },
    readMeta
  };

  return {
    contextModel,
    contextCoverage: coverage,
    contextWarnings
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

export {
  DESIGNER_CONTEXT_MODEL_VERSION,
  DESIGNER_CONTEXT_SUMMARY_VERSION,
  buildAssetLookupSummary,
  buildReadStrategy,
  normalizeDesignerContext
};
