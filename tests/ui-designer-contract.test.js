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
