import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";

const repoRoot = new URL("..", import.meta.url);

async function readPluginUiHtml() {
  return readFile(path.join(repoRoot.pathname, "figma-plugin", "ui.html"), "utf8");
}

function extractUiFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `missing UI function ${functionName}`);
  const argsOpen = source.indexOf("(", start);
  assert.notEqual(argsOpen, -1, `missing UI function args ${functionName}`);
  let argsDepth = 0;
  let argsClose = -1;
  for (let index = argsOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      argsDepth += 1;
    } else if (char === ")") {
      argsDepth -= 1;
      if (argsDepth === 0) {
        argsClose = index;
        break;
      }
    }
  }
  assert.notEqual(argsClose, -1, `unterminated UI function args ${functionName}`);
  const openBrace = source.indexOf("{", argsClose);
  assert.notEqual(openBrace, -1, `missing UI function body ${functionName}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`unterminated UI function ${functionName}`);
}

function createDesignerAssistantRenderer(source) {
  const functionNames = [
    "escapeHtml",
    "normalizeDesignerString",
    "normalizeDesignerArray",
    "normalizeDesignerAssistantText",
    "formatDesignerInlineMarkdown",
    "normalizeDesignerAssistantSectionKey",
    "isDesignerAssistantSectionHeading",
    "buildDesignerAssistantBlocks",
    "getDesignerAssistantCardAttrs",
    "renderDesignerAssistantBlock",
    "buildDesignerResponseFilterbar",
    "stripDesignerEvidencePrefix",
    "getDesignerAssistantTitle",
    "getDesignerAssistantConclusion",
    "getDesignerAssistantEvidenceItems",
    "getDesignerAssistantIssueItems",
    "getDesignerAssistantPriorityItems",
    "getDesignerAssistantActionItems",
    "getDesignerAssistantKnowledgeItems",
    "getDesignerAssistantLimitations",
    "formatDesignerAssistantReply"
  ];
  const context = vm.createContext({});
  vm.runInContext(functionNames.map((name) => extractUiFunctionSource(source, name)).join("\n"), context);
  return context;
}

test("plugin UI routes inspect selection requests to the dedicated inspect endpoint", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /\/api\/designer\/inspect-selection/);
  assert.match(source, /serverIntentKind/);
});

test("plugin UI reports malformed HTTP 200 bridge responses with a stable code", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /bridge_response_invalid/);
});

test("plugin UI resets the designer conversation on boot and file scope changes", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function resetDesignerConversationSurface/);
  assert.match(source, /resetDesignerConversationSurface\("boot"\)/);
  assert.match(source, /resetDesignerConversationSurface\("scope_changed"\)/);
  assert.match(source, /data-designer-initial-message/);
});

test("plugin UI progress flow assigns step indexes and advances on timers", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /stepIndex: index/);
  assert.match(source, /advanceTimers/);
  assert.match(source, /function scheduleDesignerProgressTick/);
  assert.match(source, /setTimeout\(\(\) => \{/);
  assert.match(source, /scheduleDesignerProgressTick\(\)/);
  assert.match(source, /advanceDesignerProgressFlow\(index/);
  assert.match(source, /autoAdvanceDelays: \[0, 1, 3, 7, 10\]/);
  assert.match(source, /property\|properties\|속성/);
});

test("plugin UI progress copy reflects the bridge to Codex CLI pipeline", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /의도 분류/);
  assert.match(source, /Figma 읽기/);
  assert.match(source, /Context 정리/);
  assert.match(source, /Codex 분석/);
  assert.match(source, /응답\/실행 판단/);
  assert.match(source, /Bridge → Codex CLI → 응답\/실행/);
  assert.match(source, /request, context, evidence, output contract/);
});

test("plugin UI renders assistant answers as progressive structured chat messages", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function appendDesignerAssistantMessage/);
  assert.match(source, /function buildDesignerAssistantBlocks/);
  assert.match(source, /function getDesignerAssistantEvidenceItems/);
  assert.match(source, /function getDesignerAssistantIssueItems/);
  assert.match(source, /function getDesignerAssistantLimitations/);
  assert.match(source, /designer-message assistant/);
  assert.match(source, /designer-assistant-heading/);
  assert.match(source, /designer-assistant-ordered/);
  assert.match(source, /designer-assistant-typing/);
  assert.match(source, /appendDesignerAssistantMessage\(\s*formatDesignerAssistantReply/);
  assert.doesNotMatch(source, /formatDesignerAssistantReply[\s\S]*?return `\\$\\{bundle\\.summaryText/);
});

test("plugin UI applies Chester-style response display primitives", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /designer-response-filterbar/);
  assert.match(source, /\["evidence", "근거"\]/);
  assert.match(source, /function normalizeDesignerAssistantSectionKey/);
  assert.match(source, /data-designer-assistant-section/);
  assert.match(source, /designer-assistant-card-evidence/);
  assert.match(source, /designer-assistant-card-issue/);
  assert.match(source, /designer-assistant-card-action/);
  assert.match(source, /designer-assistant-card-limitation/);
  assert.match(source, /designer-assistant-card-knowledge/);
  assert.match(source, /function applyDesignerResponseFilter/);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /function prefersDesignerReducedMotion/);
});

test("plugin UI renders RAG knowledge references as a separate assistant section", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function getDesignerAssistantKnowledgeItems/);
  assert.match(source, /knowledgeReferences/);
  assert.match(source, /참조한 기준/);
  assert.match(source, /\["knowledge", "참조"\]/);
});

test("plugin UI renderer turns assistant bundle evidence into chat cards and RAG reference cards", async () => {
  const source = await readPluginUiHtml();
  const renderer = createDesignerAssistantRenderer(source);
  const result = {
    ai: {
      response: {
        reply: "프리미티브 컬러 팔레트 분석 결과입니다. limitations: styleCount가 0이어서 스타일 사용 현황은 판단하지 않았습니다."
      }
    }
  };
  const bundle = {
    summaryText: "프리미티브 컬러 팔레트 분석 결과",
    findings: [
      { detail: "컬렉션 7개, 변수 548개, 프리미티브 변수 222개를 확인했습니다." },
      { detail: "[높음] dark/Black alpha 명칭이 실제 역할과 다를 수 있습니다." }
    ],
    recommendations: [
      {
        actionType: "design_system_alignment",
        title: "dark/Black alpha 역할 확인",
        reason: "white alpha 역할이면 명칭을 조정해야 합니다."
      },
      { actionType: "next_step", title: "semantic/theme 연결을 확인하세요." }
    ],
    knowledgeReferences: [
      {
        title: "Designer Workflow QA",
        sourceKind: "document_chunk",
        sourcePath: "docs/qa/figma-designer-workflow-test-plan-20260601.ko.md",
        guidance: "답변은 근거, 개선 필요, 우선순위, 다음 액션, readback evidence를 분리해 표시합니다."
      }
    ]
  };

  const reply = renderer.formatDesignerAssistantReply(result, bundle);
  const blocks = renderer.buildDesignerAssistantBlocks(reply);
  const filterbar = renderer.buildDesignerResponseFilterbar(blocks);
  const rendered = blocks.map((block) => renderer.renderDesignerAssistantBlock(block)).join("\n");

  assert.match(reply, /근거/);
  assert.match(reply, /개선이 필요한 부분/);
  assert.match(reply, /요약 우선순위/);
  assert.match(reply, /다음 액션/);
  assert.match(reply, /참조한 기준/);
  assert.match(reply, /판단 제한/);
  assert.ok(blocks.some((block) => block.sectionKey === "knowledge"));
  assert.ok(blocks.some((block) => block.sectionKey === "limitation"));
  assert.match(filterbar, /data-designer-response-filter="knowledge"/);
  assert.match(filterbar, />참조<\/button>/);
  assert.match(rendered, /designer-assistant-card-evidence/);
  assert.match(rendered, /designer-assistant-card-issue/);
  assert.match(rendered, /designer-assistant-ordered/);
  assert.match(rendered, /designer-assistant-card-knowledge/);
  assert.match(rendered, /Designer Workflow QA/);
  assert.match(rendered, /document_chunk · docs\/qa\/figma-designer-workflow-test-plan-20260601\.ko\.md/);
  assert.match(rendered, /designer-assistant-card-limitation/);
  assert.doesNotMatch(rendered, /프리미티브 컬러 팔레트 분석 결과입니다\. limitations:/);
});

test("plugin UI renders read execution as an analysis ledger card", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function buildDesignerReadLedgerViewModel/);
  assert.match(source, /function appendDesignerReadLedgerCard/);
  assert.match(source, /designer-read-ledger-card/);
  assert.match(source, /읽은 대상/);
  assert.match(source, /명령/);
  assert.match(source, /성공/);
  assert.match(source, /스킵/);
  assert.match(source, /실패/);
  assert.match(source, /appendDesignerReadLedgerCard\(latestDesignerReadExecution, latestDesignerIntentEnvelope, result\)/);
});

test("plugin UI exposes status and failure cards with accessible live regions", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /id="designer-messages" class="designer-messages" role="log" aria-live="polite"/);
  assert.match(source, /role="status"/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /designer-status-card/);
  assert.match(source, /designer-status-step-reading/);
  assert.match(source, /designer-status-step-analyzing/);
  assert.match(source, /designer-status-step-validating/);
  assert.match(source, /designer-status-step-complete/);
  assert.match(source, /designer-failure-card/);
  assert.match(source, /function appendDesignerFailureCard/);
});

test("plugin UI does not show asset lookup for inspect selection plans", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /intentKind !== "inspect_selection"/);
  assert.match(source, /!\/\(design system\|디자인 시스템\|token\|토큰\|library\|라이브러리\|기준\)\//);
});

test("plugin UI deduplicates repeated designer completion summaries", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function appendUniqueDesignerMessages/);
  assert.match(source, /seen\.has\(key\)/);
  assert.match(source, /role === "assistant"/);
  assert.match(source, /function formatDesignerAssistantReply/);
});

test("plugin UI corrects ambiguous inspect target wording from the live selection", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function buildDesignerInspectTargetCorrection/);
  assert.match(source, /function getDesignerNodeTypeLabel/);
  assert.match(source, /현재 선택은/);
  assert.match(source, /요청 표현과 실제 선택 대상이 달라서/);
  assert.match(source, /appendDesignerMessage\("system", targetCorrection\)/);
});

test("plugin UI sends image attachment payloads for screen generation", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /dataUrl/);
  assert.match(source, /readDesignerFileAsDataUrl/);
  assert.match(source, /buildDesignerRequestAttachments/);
  assert.match(source, /attachments: buildDesignerRequestAttachments\(\)/);
  assert.match(source, /return 300000/);
});

test("server can export the selected node for image-to-screen generation", async () => {
  const source = await readFile(path.join(repoRoot.pathname, "src", "server.js"), "utf8");
  const commandDispatchSource = await readFile(
    path.join(repoRoot.pathname, "src", "server-command-dispatch.js"),
    "utf8"
  );

  assert.match(source, /function isImageToScreenRequest/);
  assert.match(source, /function isImageLikeFigmaSelection/);
  assert.match(source, /asset\|reference\|reconstruction\|mockup/);
  assert.match(source, /getSelectionIdsFromFigmaContext/);
  assert.match(source, /addSelectedNodeExportToImageWork/);
  assert.match(source, /selected_image_export_failed/);
  assert.match(source, /image_attachment_missing/);
  assert.match(source, /finding-image-layout-quality-retry/);
  assert.match(source, /qualityRetry: codexPlan\.qualityRetry \|\| null|const qualityRetry = codexPlan\.qualityRetry \|\| null/);
  assert.match(source, /missingRoleLabels/);
  assert.match(source, /coordinateCoverageTooLow/);
  assert.match(source, /nodeCoverageTooLow/);
  assert.match(source, /textCoverageTooLow/);
  assert.match(source, /semanticQuality: codexPlan\.semanticQuality \|\| null/);
  assert.match(source, /semanticQuality\.coordinateNodeCount/);
  assert.match(commandDispatchSource, /executePluginCommand\(pluginId, "export_node"/);
  assert.match(source, /EXPORT_NODE_COMMAND_TIMEOUT_MS/);
  assert.match(source, /IMAGE_SCREEN_SELECTED_EXPORT_SCALE/);
  assert.match(source, /process\.env\.IMAGE_SCREEN_SELECTED_EXPORT_SCALE \|\| 1/);
  assert.match(source, /IMAGE_SCREEN_SELECTED_FRAME_EXPORT_SCALE/);
  assert.match(source, /process\.env\.IMAGE_SCREEN_SELECTED_FRAME_EXPORT_SCALE \|\| 0\.25/);
  assert.match(source, /resolveSelectedNodeImageExportPlan/);
  assert.match(source, /contentsOnly: !isFrameLikeSelection/);
  assert.match(source, /useAbsoluteBounds: false/);
  assert.match(source, /analysisScope: isFrameLikeSelection \? "clipped_frame_viewport" : "selected_node_contents"/);
  assert.match(source, /frameViewportClipped: isFrameLikeSelection/);
  assert.match(source, /resolveSelectedImageScreenPlacement/);
  assert.match(source, /x: x \+ width \+ 80/);
  assert.match(source, /getSelectionIdsFromFigmaContext\(figmaContext\)/);
});

test("plugin UI treats image-to-screen results as Figma generation, not local handoff", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function isDesignerImageGenerationResult/);
  assert.match(source, /function formatDesignerImageGenerationSummary/);
  assert.match(source, /이미지 분석 기반 화면 구성이 완료되었습니다/);
  assert.match(source, /구조 품질 재시도/);
  assert.match(source, /formatDesignerImageQualitySummary/);
  assert.match(source, /이미지 기반 화면 구성 인식/);
  assert.match(source, /역할\/좌표\/텍스트 커버리지 확인/);
  assert.match(source, /생성 가능 여부 확인/);
  assert.match(source, /품질을 통과하면 Figma 캔버스에 생성할 수 있어요/);
  assert.doesNotMatch(source, /log: "화면 레이어 생성"/);
  assert.match(source, /hasDesignerSelectedImageContext/);
  assert.match(source, /\(hasImageAttachment \|\| hasSelectedImage\) && imageConstructionAction/);
  assert.match(source, /선택한 이미지나 스크린샷을 화면 분석용 PNG로 내보내지 못했습니다/);
  assert.match(source, /이미지 파일을 첨부하거나 Figma에서 이미지\/스크린샷 노드를 선택/);
  assert.match(source, /좌표 반영/);
  assert.match(source, /좌표 노드/);
  assert.match(source, /imageLayoutQualitySummary/);
  assert.match(source, /labelsToFix/);
  assert.match(source, /실패 원인/);
  assert.match(source, /재시도 프롬프트/);
  assert.match(source, /텍스트 폭을 원본 bbox 기준으로 넓히기/);
  assert.match(source, /x\/y\/width\/height/);
  assert.match(source, /topOriginStackingTooHigh/);
  assert.match(source, /y=0에 겹치지 않도록/);
  assert.match(source, /bboxAlignmentTooLow/);
  assert.match(source, /bbox 위치와 같은 문구/);
  assert.match(source, /누락된 문구/);
  assert.match(source, /!imageGenerationResult &&\s*shouldAutoSubmitDesignerHandoff/);
  assert.match(source, /taskKind: "generate_screen"/);
});

test("plugin UI keeps designer requests scoped to the current plugin session", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function resolveDesignerRequestPluginId/);
  assert.match(source, /currentPluginId !== "default"/);
  assert.match(source, /return currentPluginId;/);
  assert.match(source, /세션이 여러 개여도 현재 Xbridge 패널의 pluginId를 우선/);
});

test("plugin UI explains image layout quality failures as structured assistant guidance", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /formatDesignerImageLayoutFailureAssistantReply/);
  assert.match(source, /겹침 원인/);
  assert.match(source, /겹치는 텍스트/);
  assert.match(source, /appendDesignerAssistantMessage\(formatDesignerImageLayoutFailureAssistantReply\(error\)/);
  assert.match(source, /이미지 생성 품질 검증에서 중단되었습니다/);
});

test("plugin code normalizes generated font aliases before loading fonts", async () => {
  const source = await readFile(path.join(repoRoot.pathname, "figma-plugin", "code.js"), "utf8");

  assert.match(source, /function normalizeFontStyleName/);
  assert.match(source, /semibold: "Semi Bold"/);
  assert.match(source, /function getFontLoadCandidates/);
  assert.match(source, /family: "Inter", style: "Regular"/);
  assert.match(source, /node\.fontName = loadedFontName/);
});

test("plugin code can create image fill nodes for screenshot reference layers", async () => {
  const source = await readFile(path.join(repoRoot.pathname, "figma-plugin", "code.js"), "utf8");

  assert.match(source, /function decodeBase64ToBytes/);
  assert.match(source, /figma\.createImage/);
  assert.match(source, /function applyImageFill/);
  assert.match(source, /imageDataBase64/);
  assert.match(source, /imageHash/);
});

test("plugin and server expose a file-level design token snapshot endpoint", async () => {
  const pluginSource = await readFile(path.join(repoRoot.pathname, "figma-plugin", "code.js"), "utf8");
  const serverSource = await readFile(path.join(repoRoot.pathname, "src", "server.js"), "utf8");
  const queuePolicySource = await readFile(path.join(repoRoot.pathname, "src", "command-queue-policy.js"), "utf8");

  assert.match(pluginSource, /async function exportDesignTokens/);
  assert.match(pluginSource, /getLocalVariablesAsync/);
  assert.match(pluginSource, /resolvedValuesByMode/);
  assert.match(pluginSource, /aliasesByMode/);
  assert.match(pluginSource, /tokens: buildNormalizedTokens/);
  assert.match(serverSource, /\/api\/export-design-tokens/);
  assert.match(serverSource, /"export_design_tokens"/);
  assert.match(queuePolicySource, /"export_design_tokens"/);
});

test("plugin UI carries generated screen context into follow-up requests", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /latestDesignerImageGenerationContext/);
  assert.match(source, /function rememberDesignerImageGenerationContext/);
  assert.match(source, /function isDesignerGeneratedScreenFollowUpPrompt/);
  assert.match(source, /context\.generatedScreen/);
  assert.match(source, /targetPreference = "generated_screen"/);
});

test("server routes generated screen follow-ups through a bounded Codex-first path", async () => {
  const source = await readFile(path.join(repoRoot.pathname, "src", "server.js"), "utf8");

  assert.match(source, /function isGeneratedScreenFollowUpRequest/);
  assert.match(source, /function executeDesignerGeneratedScreenFollowUpRequest/);
  assert.match(source, /buildGeneratedScreenFollowUpReadPlan/);
  assert.match(source, /deep_generated_screen_scan/);
  assert.match(source, /XBRIDGE_CODEX_CLI_FOLLOWUP_TIMEOUT_MS/);
});

test("live Designer Workflow runner asserts RAG knowledge references from designer chat", async () => {
  const source = await readFile(
    path.join(repoRoot.pathname, "scripts", "run-figma-designer-workflow-live-qa.mjs"),
    "utf8"
  );

  assert.match(source, /RAG01/);
  assert.match(source, /DS01/);
  assert.match(source, /search_nodes live component page/);
  assert.match(source, /findDesignSystemComponentPage/);
  assert.match(source, /COMPONENT_SET/);
  assert.match(source, /search_file_components release fixture/);
  assert.match(source, /XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET/);
  assert.match(source, /XBRIDGE_QA_DS_FILE_KEY/);
  assert.match(source, /skipTotal/);
  assert.match(source, /summaryPath/);
  assert.match(source, /summarize-designer-workflow-qa\.mjs/);
  assert.match(source, /--require-release-gates/);
  assert.match(source, /buildDesignerWorkflowReadinessReport/);
  assert.match(source, /live-readiness\.json/);
  assert.match(source, /readinessPath/);
  assert.match(source, /\/api\/designer\/chat/);
  assert.match(source, /knowledgeReferences/);
  assert.match(source, /document_chunk/);
  assert.match(source, /selectSemanticColorVariableCandidate/);
  assert.match(source, /export_design_tokens \+ bind_variable fills\.color/);
  assert.match(source, /\/api\/export-design-tokens/);
  assert.match(source, /property: "fills\.color"/);
  assert.match(source, /boundToCandidate/);
  assert.match(source, /frame wrapping fallback mutation/);
  assert.match(source, /move_node \+ delete_node unwrap fallback/);
  assert.match(source, /create_component_set \+ set_variant_properties/);
  assert.match(source, /updatedVariant\.variantProperties\?\.Size === "Large"/);
  assert.match(source, /add_component_property \+ set_component_properties/);
  assert.match(source, /updatedProperty\?\.value === "Updated label"/);
  assert.match(source, /manual_border_shadow/);
  assert.match(source, /strokeColor: "#D0D7E2"/);
  assert.match(source, /dropShadow/);
  assert.match(source, /effect\.type === "DROP_SHADOW"/);
  assert.match(source, /locked fixture mutation blocked/);
  assert.match(source, /hidden fixture mutation blocked/);
  assert.match(source, /mask fixture mutation blocked/);
  assert.match(source, /visible: false/);
  assert.match(source, /locked: true/);
  assert.match(source, /isMask: true/);
  assert.match(source, /blockedMutation/);
  assert.match(source, /node\.visible === false/);
  assert.match(source, /node\.locked === true/);
  assert.match(source, /node\.isMask === true/);
  assert.match(source, /image card resize preserving fills/);
  assert.match(source, /FIXTURE_IMAGE_PNG_BASE64/);
  assert.match(source, /imageHash === afterFillA\.imageHash/);
  assert.match(source, /imageHash === afterFillB\.imageHash/);
  assert.match(source, /scaleMode === "FILL"/);
  assert.match(source, /requiresExplicitPluginId/);
  assert.match(source, /XBRIDGE_QA_PLUGIN_ID/);
  assert.match(source, /summary\.failTotal > 0/);
  assert.match(source, /process\.exitCode = 1/);
});

test("update-node supports manual border and drop shadow mutation with readback", async () => {
  const pluginSource = await readFile(path.join(repoRoot.pathname, "figma-plugin", "code.js"), "utf8");
  const serverSource = await readFile(path.join(repoRoot.pathname, "src", "server.js"), "utf8");

  assert.match(serverSource, /strokeColor: body\.strokeColor/);
  assert.match(serverSource, /strokeWeight: body\.strokeWeight/);
  assert.match(serverSource, /dropShadow: body\.dropShadow/);
  assert.match(serverSource, /locked: body\.locked/);
  assert.match(serverSource, /allowLocked: body\.allowLocked/);
  assert.match(serverSource, /allowHidden: body\.allowHidden/);
  assert.match(serverSource, /isMask: body\.isMask/);
  assert.match(serverSource, /allowMask: body\.allowMask/);
  assert.match(pluginSource, /function buildDropShadowEffect/);
  assert.match(pluginSource, /Node is locked and cannot be modified without allowLocked=true/);
  assert.match(pluginSource, /Node is hidden and cannot be modified without allowHidden=true/);
  assert.match(pluginSource, /Node is a mask and cannot be modified without allowMask=true/);
  assert.match(pluginSource, /locked: "locked" in node \? node\.locked : undefined/);
  assert.match(pluginSource, /isMask: "isMask" in node \? node\.isMask : undefined/);
  assert.match(pluginSource, /node\.strokes = \[hexToSolidPaint\(payload\.strokeColor\)\]/);
  assert.match(pluginSource, /node\.effects = \[buildDropShadowEffect\(payload\.dropShadow\)\]/);
  assert.match(pluginSource, /fills: readPaintsSnapshot\(node, "fills"\)/);
  assert.match(pluginSource, /boundVariables: readBoundVariablesSnapshot\(node\)/);
  assert.match(pluginSource, /function readBoundVariablesSnapshot/);
  assert.match(pluginSource, /imageHash: paint\.type === "IMAGE" \? paint\.imageHash : undefined/);
  assert.match(pluginSource, /scaleMode: paint\.type === "IMAGE" \? paint\.scaleMode : undefined/);
  assert.match(pluginSource, /strokes: readPaintsSnapshot\(node, "strokes"\)/);
  assert.match(pluginSource, /effects: readEffectsSnapshot\(node\)/);
});

test("image layout prompt gives account-management screens explicit structure guidance", async () => {
  const source = await readFile(path.join(repoRoot.pathname, "src", "codex-cli-runner.js"), "utf8");

  assert.match(source, /account_title_group/);
  assert.match(source, /info_table/);
  assert.match(source, /info_label/);
  assert.match(source, /info_value/);
  assert.match(source, /계좌구분/);
  assert.match(source, /적용금리/);
  assert.match(source, /개설일/);
});
