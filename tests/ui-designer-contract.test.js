import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = new URL("..", import.meta.url);

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
