import { buildDesignerContextModel, buildDesignerContextSummary } from "./ai-designer-context.js";
import { buildDesignerReadRoute } from "./ai-designer-read-routing.js";

const DESIGNER_INTENT_CONTRACT_VERSION = "1.0";

const DEFAULT_MODE = "suggest_then_apply";
const DEFAULT_SELECTION_MODE = "optional";
const DEFAULT_TARGET_TYPE = "current_page";

const ALLOWED_MODES = new Set([
  "suggest",
  "apply",
  "handoff",
  "suggest_then_apply"
]);

const ALLOWED_INTENT_KINDS = new Set([
  "analyze",
  "inspect_selection",
  "critique",
  "restructure_layout",
  "improve_hierarchy",
  "adjust_spacing",
  "refine_typography",
  "revise_copy",
  "swap_or_recommend_component",
  "generate_section",
  "generate_screen",
  "adapt_variant",
  "align_to_design_system",
  "export_design_tokens",
  "prepare_implementation_handoff"
]);

const USER_FACING_INTENT_KINDS = new Set([
  "image_to_screen",
  "image_analysis_only",
  "improve_generated_screen",
  "compare_reference_and_generated",
  "inspect_selection",
  "revise_copy",
  "apply_design_system",
  "debug_bridge_failure"
]);

const USER_INTENT_TO_INTERNAL_INTENT = {
  image_to_screen: "generate_screen",
  image_analysis_only: "inspect_selection",
  improve_generated_screen: "generate_screen",
  compare_reference_and_generated: "inspect_selection",
  inspect_selection: "inspect_selection",
  revise_copy: "revise_copy",
  apply_design_system: "align_to_design_system",
  debug_bridge_failure: "inspect_selection"
};

const MODE_KEYWORDS = {
  apply: ["apply", "바꿔", "수정", "실행", "반영"],
  handoff: ["handoff", "implement", "implementation", "구현", "엔지니어링"],
  suggest: ["suggest", "recommend", "review", "critique", "분석", "제안", "리뷰"]
};

const KIND_KEYWORDS = [
  {
    kind: "export_design_tokens",
    keywords: ["export variables", "export tokens", "variables json", "tokens json"]
  },
  { kind: "prepare_implementation_handoff", keywords: ["handoff", "구현", "engineering", "개발"] },
  { kind: "generate_screen", keywords: ["screen", "page", "화면", "페이지"] },
  { kind: "generate_section", keywords: ["section", "섹션", "hero", "pricing", "footer"] },
  { kind: "align_to_design_system", keywords: ["design system", "component", "token", "디자인 시스템"] },
  { kind: "swap_or_recommend_component", keywords: ["component", "variant", "컴포넌트", "버튼"] },
  { kind: "refine_typography", keywords: ["type", "typography", "font", "text", "타이포", "폰트"] },
  { kind: "revise_copy", keywords: ["copy", "message", "headline", "카피", "문구"] },
  { kind: "adjust_spacing", keywords: ["spacing", "gap", "padding", "margin", "간격", "여백"] },
  { kind: "improve_hierarchy", keywords: ["hierarchy", "scan", "clarity", "emphasis", "위계", "강조"] },
  { kind: "restructure_layout", keywords: ["layout", "restructure", "reorganize", "grid", "카드", "구성"] },
  {
    kind: "inspect_selection",
    keywords: [
      "inspect",
      "check",
      "read",
      "info",
      "detail",
      "details",
      "확인",
      "읽기",
      "읽어",
      "살펴",
      "체크",
      "정보",
      "상세",
      "내용",
      "구조"
    ]
  },
  { kind: "critique", keywords: ["critique", "review", "audit", "평가", "문제"] },
  { kind: "analyze", keywords: ["analyze", "understand", "read", "분석", "파악"] }
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

function slugify(value, fallback = "request") {
  const normalized = normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function createId(prefix, seed = "") {
  const base = seed ? slugify(seed, prefix) : prefix;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${base}-${suffix}`;
}

function toIsoString(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
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

function looksLikeImageScreenConstructionRequest(normalized = "") {
  const mentionsImageSource = /(이미지|image|첨부|스크린샷|screenshot|캡처|capture|시안)/.test(normalized);
  const mentionsScreenSurface = /(화면|screen|페이지|page|프레임|frame|ui|레이아웃|layout)/.test(normalized);
  const imageConstructionAction = /(그대로|만들|생성|그려|구현|구성|재현|복원|따라|비슷하게)/.test(normalized);
  return (
    mentionsImageSource &&
    (
      (mentionsScreenSurface && /(확인|보고|참고|분석|기반|그대로|만들|생성|그려|구현|구성|재현|복원)/.test(normalized)) ||
      imageConstructionAction
    )
  );
}

function looksLikeImageConstructionAction(normalized = "") {
  return /(그대로|만들|생성|그려|구현|구성|재현|복원|따라|비슷하게)/.test(normalized);
}

function isImageLikeSelectionItem(item = {}) {
  const type = normalizeString(item?.type || item?.nodeType || item?.kind).toLowerCase();
  const name = normalizeString(item?.name || item?.title).toLowerCase();
  return (
    /\b(image|bitmap|screenshot|snapshot|capture)\b|이미지|스크린샷|캡처|시안/u.test(type) ||
    /\b(image|bitmap|screenshot|snapshot|capture|png|jpe?g|webp)\b|(^|[\s_.-])(asset|reference|reconstruction|mockup)($|[\s_.-])|이미지|스크린샷|캡처|시안/u.test(name)
  );
}

function looksLikePrimitiveTokenAnalysisRequest(normalized = "", contextScope = {}) {
  const mentionsPrimitiveToken =
    /(primitive|primitives|foundation|color|colors|semantic|theme|프리미티브|파운데이션|색상|컬러|시맨틱|세만틱|테마)/u.test(normalized);
  const asksAnalysisOrImprovement =
    /(분석|개선|정리|검수|확인|리뷰|review|audit|analy[sz]e|improve|align|정렬)/u.test(normalized);
  return mentionsPrimitiveToken && asksAnalysisOrImprovement && contextScope.targetType === "current_selection";
}

function inferModeFromRequest(requestText) {
  const normalized = normalizeString(requestText).toLowerCase();
  if (!normalized) {
    return DEFAULT_MODE;
  }

  if (looksLikeImageScreenConstructionRequest(normalized)) {
    return DEFAULT_MODE;
  }

  if (MODE_KEYWORDS.handoff.some((keyword) => normalized.includes(keyword))) {
    return "handoff";
  }

  const hasApply = MODE_KEYWORDS.apply.some((keyword) => normalized.includes(keyword));
  const hasSuggest = MODE_KEYWORDS.suggest.some((keyword) => normalized.includes(keyword));

  if (hasApply && hasSuggest) {
    return "suggest_then_apply";
  }
  if (hasApply) {
    return "apply";
  }
  if (hasSuggest) {
    return "suggest";
  }

  return DEFAULT_MODE;
}

function inferIntentKind(requestText, contextScope) {
  const normalized = normalizeString(requestText).toLowerCase();
  const looksLikeFileTokenExport =
    /(variable|variables|token|tokens|변수|토큰)/.test(normalized) &&
    /(json|export|dump|snapshot|내보내|추출|파일로|저장)/.test(normalized);
  const looksLikeImageScreenConstruction =
    looksLikeImageScreenConstructionRequest(normalized) ||
    (contextScope.hasImageSelection === true && looksLikeImageConstructionAction(normalized));
  const looksLikeSelectionTextRewrite =
    /(선택한|선택된)/.test(normalized) &&
    /(텍스트|문구|카피|copy|내용)/.test(normalized) &&
    /(변경|바꿔|바꿔줘|수정|고쳐)/.test(normalized);
  const looksLikeSelectionInstanceInspection =
    /(선택한|선택된)/.test(normalized) &&
    /(instance|인스턴스|component|컴포넌트|button|버튼|variant|override|property|properties|속성)/.test(normalized) &&
    /(설명|읽어|읽기|확인|check|inspect|detail|details|info|정보|정리|요약)/.test(normalized) &&
    !/(design system|디자인 시스템|token|토큰|library|라이브러리|기준)/.test(normalized);

  if (looksLikeFileTokenExport) {
    return "export_design_tokens";
  }

  if (looksLikePrimitiveTokenAnalysisRequest(normalized, contextScope)) {
    return "align_to_design_system";
  }

  if (looksLikeImageScreenConstruction) {
    return "generate_screen";
  }

  if (looksLikeSelectionTextRewrite) {
    return "revise_copy";
  }

  if (looksLikeSelectionInstanceInspection) {
    return "inspect_selection";
  }

  for (const entry of KIND_KEYWORDS) {
    if (entry.keywords.some((keyword) => normalized.includes(keyword))) {
      return entry.kind;
    }
  }

  if (contextScope.targetType === "generated_screen") {
    return "generate_screen";
  }

  if (contextScope.targetType === "current_selection") {
    return "improve_hierarchy";
  }

  return "analyze";
}

function mapInternalIntentToUserIntent(intentKind = "", requestText = "") {
  const normalized = normalizeString(requestText).toLowerCase();
  if (intentKind === "generate_screen" && looksLikeImageScreenConstructionRequest(normalized)) {
    return "image_to_screen";
  }
  if (intentKind === "inspect_selection") {
    return "inspect_selection";
  }
  if (intentKind === "revise_copy") {
    return "revise_copy";
  }
  if (intentKind === "align_to_design_system") {
    return "apply_design_system";
  }
  return "";
}

export function mapDesignerUserIntentKindToInternal(userIntentKind = "") {
  const normalized = normalizeString(userIntentKind);
  return USER_INTENT_TO_INTERNAL_INTENT[normalized] || "";
}

export function inferDesignerUserIntentKind(requestText = "", contextScope = {}) {
  const normalized = normalizeString(requestText).toLowerCase();
  if (!normalized) {
    return "";
  }
  const hasImageTerms = /(이미지|image|첨부|스크린샷|screenshot|캡처|capture|시안|reference|참조)/u.test(normalized);
  const hasGeneratedTerms = /(생성|구현|재구성|복원|reconstruction|generated|기존 생성|이전 구현)/u.test(normalized);
  const asksAnalysisOnly =
    hasImageTerms &&
    /(분석만|확인만|읽기만|진단만|품질 진단만|구현은 하지|생성은 하지|만들지 말|do not build|analysis only)/u.test(normalized);
  const asksComparison =
    /(비교|차이|대조|compare|diff)/u.test(normalized) &&
    /(참조|reference|원본|생성|구현|generated|이전)/u.test(normalized);
  const asksDebug =
    /(실패|에러|오류|원인|안되|안 돼|timeout|타임아웃|failed|failure|debug|디버그)/u.test(normalized) &&
    /(브릿지|bridge|xbridge|이미지 분석|화면 구성|생성|구현|plugin|플러그인)/u.test(normalized);
  const asksGeneratedImprovement =
    /(개선|수정|보완|품질|퀄리티|나아지|regression|다시|고쳐)/u.test(normalized) &&
    /(생성|구현|기존|이전|generated|reconstruction|화면)/u.test(normalized);
  const asksDesignSystem =
    /(design system|디자인 시스템|token|토큰|component|컴포넌트|라이브러리|library)/u.test(normalized) &&
    /(적용|맞춰|정리|align|apply|기준)/u.test(normalized);
  const asksTextRewrite =
    /(텍스트|문구|카피|copy|내용)/u.test(normalized) &&
    /(변경|바꿔|수정|고쳐|rewrite|revise)/u.test(normalized);

  if (asksDebug) {
    return "debug_bridge_failure";
  }
  if (asksComparison) {
    return "compare_reference_and_generated";
  }
  if (asksAnalysisOnly) {
    return "image_analysis_only";
  }
  if (asksGeneratedImprovement) {
    return "improve_generated_screen";
  }
  if (looksLikeImageScreenConstructionRequest(normalized) || (contextScope.hasImageSelection === true && looksLikeImageConstructionAction(normalized))) {
    return "image_to_screen";
  }
  if (asksTextRewrite) {
    return "revise_copy";
  }
  if (looksLikePrimitiveTokenAnalysisRequest(normalized, contextScope)) {
    return "apply_design_system";
  }
  if (asksDesignSystem) {
    return "apply_design_system";
  }
  const internalIntent = inferIntentKind(requestText, {
    targetType: contextScope.targetType || DEFAULT_TARGET_TYPE,
    targetIds: Array.isArray(contextScope.targetIds) ? contextScope.targetIds : [],
    selectionRequired: contextScope.selectionRequired === true,
    hasImageSelection: contextScope.hasImageSelection === true
  });
  return mapInternalIntentToUserIntent(internalIntent, requestText);
}

function inferConfidence(mode, contextScope, requestText) {
  const normalized = normalizeString(requestText);
  if (!normalized) {
    return "low";
  }
  if (contextScope.selectionRequired && contextScope.targetIds.length === 0) {
    return "low";
  }
  if (mode === "apply" || mode === "handoff") {
    return "medium";
  }
  return "high";
}

function inferApplyReadiness(mode, contextScope, questions) {
  if (questions.some((question) => question.blocking)) {
    return "needs_missing_context";
  }
  if (mode === "suggest" || mode === "handoff") {
    return "analysis_only";
  }
  if (contextScope.selectionRequired && contextScope.targetIds.length === 0) {
    return "needs_missing_context";
  }
  if (mode === "suggest_then_apply") {
    return "needs_confirmation";
  }
  return "ready";
}

export function normalizeDesignerRequestInput(input = {}) {
  const requestText = pickFirstNonEmpty(input.request, input.prompt, input.message, input.userInput);
  const conversationId = normalizeString(input.conversationId);
  const requestedAt = toIsoString(input.requestedAt);
  const mode = ALLOWED_MODES.has(input.mode) ? input.mode : inferModeFromRequest(requestText);

  return {
    requestId: normalizeString(input.requestId) || createId("designer-request", requestText || requestedAt),
    conversationId: conversationId || undefined,
    requestedAt,
    mode,
    requestText,
    userGoal: normalizeString(input.userGoal) || requestText,
    source: normalizeString(input.source) || "plugin-chat",
    tags: uniqueStrings(normalizeArray(input.tags))
  };
}

export function normalizeDesignerFigmaContext(context = {}) {
  const selection = normalizeArray(context.selection);
  const selectionIds = uniqueStrings(
    selection.map((item) => item?.id).concat(normalizeArray(context.selectionIds))
  );
  const selectionNames = uniqueStrings(
    selection.map((item) => item?.name).concat(normalizeArray(context.selectionNames))
  );

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
    selectionIds,
    selectionNames,
    hasImageSelection: selection.some((item) => isImageLikeSelectionItem(item)),
    selectionCount: selectionIds.length,
    selectionSummary:
      normalizeString(context.selectionSummary) ||
      (selectionNames.length > 0 ? selectionNames.join(", ") : undefined),
    targetPreference: normalizeString(context.targetPreference) || undefined,
    platform: normalizeString(context.platform) || undefined,
    viewport: context.viewport && typeof context.viewport === "object" ? context.viewport : undefined
  };
}

export function deriveDesignerContextScope(normalizedContext = {}, normalizedRequest = {}) {
  const targetIds = normalizedContext.selectionIds || [];
  const explicitPreference = normalizedContext.targetPreference;

  let targetType = DEFAULT_TARGET_TYPE;
  let selectionRequired = false;
  let selectionMode = DEFAULT_SELECTION_MODE;

  if (explicitPreference === "generated_screen") {
    targetType = "generated_screen";
    selectionMode = "none";
  } else if (targetIds.length > 1) {
    targetType = "current_selection";
    selectionRequired = true;
    selectionMode = "multi";
  } else if (targetIds.length === 1) {
    targetType = "current_selection";
    selectionRequired = true;
    selectionMode = "single";
  } else if (normalizedContext.frameId) {
    targetType = "current_frame";
  }

  if (normalizedRequest.mode === "apply" && targetType === "current_page" && targetIds.length === 0) {
    selectionRequired = true;
  }

  return {
    targetType,
    targetIds,
    pageId: normalizedContext.pageId || undefined,
    hasImageSelection: normalizedContext.hasImageSelection === true,
    selectionRequired,
    selectionMode
  };
}

export function normalizeContextScope(figmaContext = {}) {
  const normalizedContext = normalizeDesignerFigmaContext(figmaContext);
  return deriveDesignerContextScope(normalizedContext, { mode: DEFAULT_MODE });
}

export function inferIntentKindFromPrompt(requestText = "") {
  return inferIntentKind(requestText, {
    targetType: DEFAULT_TARGET_TYPE,
    targetIds: [],
    selectionRequired: false
  });
}

export function buildDesignerRequestSummary(normalizedRequest = {}, normalizedContext = {}, contextScope = {}) {
  if (normalizedRequest.requestText) {
    const base = normalizedRequest.requestText.replace(/[.?!]+$/, "");
    const targetLabel =
      normalizedContext.selectionSummary ||
      normalizedContext.frameName ||
      normalizedContext.pageName ||
      "current context";
    return `${base} for ${targetLabel}.`;
  }

  const scopeLabel =
    contextScope.targetType === "generated_screen"
      ? "Generate a new screen"
      : contextScope.targetType === "current_selection"
        ? "Refine the current selection"
        : contextScope.targetType === "current_frame"
          ? "Refine the current frame"
          : "Review the current page";

  return `${scopeLabel} with a designer-level plan.`;
}

function buildAssumptions(normalizedRequest = {}, normalizedContext = {}, contextScope = {}) {
  const assumptions = [];

  if (contextScope.targetType === "current_selection" && normalizedContext.selectionCount > 0) {
    assumptions.push(`The current selection is the intended design target (${normalizedContext.selectionCount} selected).`);
  }

  if (normalizedRequest.mode === "suggest_then_apply") {
    assumptions.push("The user likely wants a proposal before any direct Figma changes are applied.");
  }

  if (normalizedContext.fileName) {
    assumptions.push(`The active file context is ${normalizedContext.fileName}.`);
  }

  return assumptions;
}

function buildQuestions(normalizedRequest = {}, normalizedContext = {}, contextScope = {}) {
  const questions = [];

  if (contextScope.selectionRequired && contextScope.targetIds.length === 0) {
    questions.push({
      id: "question-select-target",
      prompt: "Which frame or section should this request apply to?",
      reason: "The request needs a concrete design target before it can safely apply changes.",
      blocking: true
    });
  }

  if (!normalizedRequest.requestText) {
    questions.push({
      id: "question-missing-request",
      prompt: "What design goal should the AI designer focus on?",
      reason: "No user request text was provided.",
      blocking: true
    });
  }

  if (normalizedRequest.mode === "apply" && !normalizedContext.selectionSummary && contextScope.targetType === "current_page") {
    questions.push({
      id: "question-page-scope-confirm",
      prompt: "Should this apply to the full page, or do you want to target a smaller section?",
      reason: "Applying directly to a whole page is broad and may need confirmation.",
      blocking: false
    });
  }

  return questions;
}

function buildRisks(normalizedRequest = {}, normalizedContext = {}, contextScope = {}) {
  const risks = [];

  if (contextScope.targetIds.length > 1) {
    risks.push("Multiple selected layers may require separate intents or confirmation before applying changes.");
  }

  if (normalizedRequest.mode === "apply") {
    risks.push("Direct apply mode may need a preview if the request changes layout structure or copy.");
  }

  if (!normalizedContext.selectionSummary && contextScope.targetType !== "generated_screen") {
    risks.push("Minimal target context may reduce intent accuracy.");
  }

  return risks;
}

function buildExecutionPolicy(normalizedRequest = {}, contextScope = {}, questions = [], intentKind = "analyze") {
  const allowDirectApply = normalizedRequest.mode === "apply" || normalizedRequest.mode === "suggest_then_apply";
  return {
    previewRequired:
      normalizedRequest.mode !== "apply" ||
      questions.some((question) => question.blocking) ||
      intentKind === "restructure_layout" ||
      intentKind === "generate_section" ||
      intentKind === "generate_screen",
    allowDirectApply,
    allowBatchApply: contextScope.targetIds.length > 1,
    requiresSelectionSnapshot: contextScope.selectionRequired,
    requiresDesignSystemLookup: [
      "align_to_design_system",
      "swap_or_recommend_component",
      "adapt_variant"
    ].includes(intentKind),
    requiresCopyRewriteApproval: intentKind === "revise_copy",
    canHandoffToLocalAgent: normalizedRequest.mode === "handoff" || intentKind === "prepare_implementation_handoff"
  };
}

export function buildDesignerIntentTarget(normalizedContext = {}, contextScope = {}) {
  const type =
    contextScope.targetType === "current_selection"
      ? "selection"
      : contextScope.targetType === "current_frame"
        ? "frame"
        : contextScope.targetType === "generated_screen"
          ? "page"
          : "page";

  return {
    type,
    ids: contextScope.targetIds || [],
    name:
      normalizedContext.selectionSummary ||
      normalizedContext.frameName ||
      normalizedContext.pageName ||
      normalizedContext.fileName ||
      undefined,
    scopeNote:
      contextScope.targetType === "generated_screen"
        ? "Generate a new design artifact in the active file context."
        : undefined
  };
}

export function buildDesignerIntentSkeleton({
  normalizedRequest = {},
  normalizedContext = {},
  contextScope = {},
  intentKind,
  userIntentKind = "",
  questions = []
} = {}) {
  const kind = ALLOWED_INTENT_KINDS.has(intentKind)
    ? intentKind
    : inferIntentKind(normalizedRequest.requestText, contextScope);
  const target = buildDesignerIntentTarget(normalizedContext, contextScope);
  const summary = buildDesignerRequestSummary(normalizedRequest, normalizedContext, contextScope);

  return {
    id: createId("intent", `${kind}-${target.name || normalizedRequest.requestId}`),
    kind,
    userIntentKind: USER_FACING_INTENT_KINDS.has(userIntentKind) ? userIntentKind : undefined,
    objective: normalizedRequest.userGoal || summary,
    target,
    changeSet: {
      layoutChanges: [],
      hierarchyChanges: [],
      componentChanges: [],
      copyChanges: [],
      styleChanges: [],
      contentChanges: []
    },
    constraints: {
      preserveContent: true,
      preserveStructure: kind !== "restructure_layout" && kind !== "generate_screen",
      preserveDesignSystem: true,
      preserveBrandTone: true,
      accessibilityTargets: [],
      implementationConstraints: [],
      custom: []
    },
    outputExpectation:
      kind === "generate_screen"
        ? "new_screen"
        : kind === "generate_section"
          ? "new_section"
          : kind === "prepare_implementation_handoff"
            ? "implementation_handoff_brief"
            : kind === "analyze" || kind === "critique"
              ? "analysis"
              : "recommended_changes",
    rationale:
      normalizedRequest.requestText
        ? `Interpret the request at a design level before mapping it to concrete Figma operations: ${normalizedRequest.requestText}`
        : "Interpret the available context at a design level before proposing changes.",
    confidence: inferConfidence(normalizedRequest.mode, contextScope, normalizedRequest.requestText),
    applyReadiness: inferApplyReadiness(normalizedRequest.mode, contextScope, questions)
  };
}

export function createDesignerIntentEnvelope(input = {}, figmaContext = {}) {
  const requestInput =
    input && typeof input === "object" && input.figmaContext && Object.keys(figmaContext || {}).length === 0
      ? {
          ...input,
          request:
            pickFirstNonEmpty(input.request, input.prompt, input.message, input.userInput, input.input)
        }
      : input;
  const resolvedFigmaContext =
    input && typeof input === "object" && input.figmaContext && Object.keys(figmaContext || {}).length === 0
      ? input.figmaContext
      : figmaContext;

  let normalizedRequest = normalizeDesignerRequestInput(requestInput);
  const normalizedContext = normalizeDesignerFigmaContext(resolvedFigmaContext);
  const explicitModeRequested =
    requestInput && typeof requestInput === "object" && ALLOWED_MODES.has(requestInput.mode);
  if (
    !explicitModeRequested &&
    normalizedRequest.mode === "handoff" &&
    normalizedContext.hasImageSelection === true &&
    looksLikeImageConstructionAction(normalizedRequest.requestText.toLowerCase())
  ) {
    normalizedRequest = {
      ...normalizedRequest,
      mode: DEFAULT_MODE
    };
  }
  const designerContext = buildDesignerContextSummary(resolvedFigmaContext, normalizedRequest);
  const contextScope = deriveDesignerContextScope(normalizedContext, normalizedRequest);
  const contextModel = buildDesignerContextModel(resolvedFigmaContext, {
    targetType: contextScope.targetType,
    capturedAt: normalizedRequest.requestedAt,
    requestText: normalizedRequest.requestText
  });
  const questions = buildQuestions(normalizedRequest, normalizedContext, contextScope);
  const requestedIntentKind = normalizeString(
    requestInput?.intentKindOverride || requestInput?.intentKind
  );
  const requestedUserIntentKind = USER_FACING_INTENT_KINDS.has(requestedIntentKind)
    ? requestedIntentKind
    : "";
  const inferredUserIntentKind = inferDesignerUserIntentKind(normalizedRequest.requestText, contextScope);
  const userIntentKind = requestedUserIntentKind || inferredUserIntentKind;
  const requestedInternalIntentKind =
    mapDesignerUserIntentKindToInternal(requestedIntentKind) || requestedIntentKind;
  const userIntentInternalKind = mapDesignerUserIntentKindToInternal(userIntentKind);
  const primaryIntentKind =
    requestedInternalIntentKind && ALLOWED_INTENT_KINDS.has(requestedInternalIntentKind)
      ? requestedInternalIntentKind
      : userIntentInternalKind && ALLOWED_INTENT_KINDS.has(userIntentInternalKind)
        ? userIntentInternalKind
      : inferIntentKind(normalizedRequest.requestText, contextScope);
  const summary = buildDesignerRequestSummary(normalizedRequest, normalizedContext, contextScope);
  const assumptions = buildAssumptions(normalizedRequest, normalizedContext, contextScope);
  const risks = buildRisks(normalizedRequest, normalizedContext, contextScope);
  const readPlan = buildDesignerReadRoute({
    intentKind: primaryIntentKind,
    designerContext,
    contextScope
  });
  const intents = [
    buildDesignerIntentSkeleton({
      normalizedRequest,
      normalizedContext,
      contextScope,
      intentKind: primaryIntentKind,
      userIntentKind,
      questions
    })
  ];

  return {
    version: DESIGNER_INTENT_CONTRACT_VERSION,
    requestId: normalizedRequest.requestId,
    conversationId: normalizedRequest.conversationId,
    mode: normalizedRequest.mode,
    summary,
    userGoal: normalizedRequest.userGoal || summary,
    designerContext,
    intentClassification: {
      userIntentKind: USER_FACING_INTENT_KINDS.has(userIntentKind) ? userIntentKind : null,
      internalIntentKind: primaryIntentKind
    },
    contextModel,
    readPlan,
    contextScope,
    intents,
    assumptions,
    questions,
    risks,
    explanation:
      normalizedRequest.mode === "handoff"
        ? "Prepare a designer-readable interpretation of the request so it can be handed off cleanly for local implementation."
        : "Interpret the request as a designer-level plan first, then decide whether it is ready for review or apply flow.",
    executionPolicy: buildExecutionPolicy(normalizedRequest, contextScope, questions, primaryIntentKind)
  };
}

export {
  DESIGNER_INTENT_CONTRACT_VERSION,
  ALLOWED_INTENT_KINDS,
  USER_FACING_INTENT_KINDS,
  ALLOWED_MODES,
  DEFAULT_MODE
};
