import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = new URL("..", import.meta.url);

async function readPluginUiHtml() {
  return readFile(path.join(repoRoot.pathname, "figma-plugin", "ui.html"), "utf8");
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
  assert.match(source, /autoAdvanceDelays: \[0, 1, 3\]/);
  assert.match(source, /property\|properties\|속성/);
});

test("plugin UI does not show asset lookup for inspect selection plans", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /intentKind !== "inspect_selection"/);
  assert.match(source, /!\/\(design system\|디자인 시스템\|token\|토큰\|library\|라이브러리\|기준\)\//);
});

test("plugin UI deduplicates repeated designer completion summaries", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function appendUniqueDesignerMessages/);
  assert.match(source, /normalizeDesignerMessageForCompare\(aiSummary\)/);
  assert.match(source, /normalizeDesignerMessageForCompare\(suggestionSummary\)/);
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
  assert.match(source, /return 150000/);
});

test("server can export the selected node for image-to-screen generation", async () => {
  const source = await readFile(path.join(repoRoot.pathname, "src", "server.js"), "utf8");

  assert.match(source, /function isImageToScreenRequest/);
  assert.match(source, /addSelectedNodeExportToImageWork/);
  assert.match(source, /executePluginCommand\(pluginId, "export_node"/);
  assert.match(source, /EXPORT_NODE_COMMAND_TIMEOUT_MS/);
  assert.match(source, /IMAGE_SCREEN_SELECTED_EXPORT_SCALE/);
  assert.match(source, /contentsOnly: true/);
  assert.match(source, /resolveSelectedImageScreenPlacement/);
  assert.match(source, /x: x \+ width \+ 80/);
  assert.match(source, /selectionIds: body\.selectionIds/);
});

test("plugin UI treats image-to-screen results as Figma generation, not local handoff", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /function isDesignerImageGenerationResult/);
  assert.match(source, /function formatDesignerImageGenerationSummary/);
  assert.match(source, /이미지 기반 화면 생성이 완료되었습니다/);
  assert.match(source, /!imageGenerationResult &&\s*shouldAutoSubmitDesignerHandoff/);
  assert.match(source, /taskKind: "generate_screen"/);
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
  assert.match(source, /manual_border_shadow/);
  assert.match(source, /strokeColor: "#D0D7E2"/);
  assert.match(source, /dropShadow/);
  assert.match(source, /effect\.type === "DROP_SHADOW"/);
  assert.match(source, /requiresExplicitPluginId/);
  assert.match(source, /XBRIDGE_QA_PLUGIN_ID/);
  assert.match(source, /summary\.failTotal > 0/);
  assert.match(source, /process\.exitCode = 1/);
});

test("plugin code supports manual border and drop shadow mutation with readback", async () => {
  const pluginSource = await readFile(path.join(repoRoot.pathname, "figma-plugin", "code.js"), "utf8");

  assert.match(pluginSource, /function buildDropShadowEffect/);
  assert.match(pluginSource, /node\.strokes = \[hexToSolidPaint\(payload\.strokeColor\)\]/);
  assert.match(pluginSource, /node\.effects = \[buildDropShadowEffect\(payload\.dropShadow\)\]/);
  assert.match(pluginSource, /strokes: readPaintsSnapshot\(node, "strokes"\)/);
  assert.match(pluginSource, /effects: readEffectsSnapshot\(node\)/);
});
