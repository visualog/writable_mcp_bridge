import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("..", import.meta.url);

test("plugin manifest opts into dynamic-page document access", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("figma-plugin/manifest.json", repoRoot), "utf8")
  );

  assert.equal(manifest.documentAccess, "dynamic-page");
});

test("plugin manifest keeps bridge network access development-only", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("figma-plugin/manifest.json", repoRoot), "utf8")
  );

  assert.deepEqual(manifest.networkAccess.allowedDomains, ["none"]);
  assert.deepEqual(manifest.networkAccess.devAllowedDomains, [
    "http://localhost:3846",
    "ws://localhost:3846"
  ]);
});

test("plugin main thread avoids browser networking and timer APIs", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");

  assert.doesNotMatch(source, /\bfetch\s*\(/);
  assert.doesNotMatch(source, /\bXMLHttpRequest\b/);
  assert.doesNotMatch(source, /\bWebSocket\b/);
  assert.doesNotMatch(source, /\bsetTimeout\s*\(/);
  assert.doesNotMatch(source, /\bsetInterval\s*\(/);
  assert.doesNotMatch(source, /\bdocument\./);
  assert.doesNotMatch(source, /\bwindow\./);
});

test("token export plugin contract exposes summary and chunk read commands", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");

  assert.match(source, /get_variable_collections_summary/);
  assert.match(source, /export_design_tokens_chunk/);
  assert.match(source, /async function exportDesignTokensChunk/);
});

test("local variable export prefers async variables APIs before sync fallbacks", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");
  const variablesFunction = source.match(/async function getAllLocalVariables\(\) \{[\s\S]*?\n\}/)?.[0] || "";
  const collectionsFunction =
    source.match(/async function getAllLocalVariableCollections\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.ok(variablesFunction.indexOf("getLocalVariablesAsync") < variablesFunction.indexOf("getLocalVariables("));
  assert.ok(
    collectionsFunction.indexOf("getLocalVariableCollectionsAsync") <
      collectionsFunction.indexOf("getLocalVariableCollections(")
  );
});

test("local style export prefers async style APIs before sync fallbacks", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");
  const stylesFunction = source.match(/async function getAllLocalStyles\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.ok(stylesFunction.includes("getLocalPaintStylesAsync"));
  assert.ok(stylesFunction.includes("getLocalTextStylesAsync"));
  assert.ok(stylesFunction.includes("getLocalEffectStylesAsync"));
  assert.ok(stylesFunction.includes("getLocalGridStylesAsync"));
  assert.ok(stylesFunction.indexOf("getLocalPaintStylesAsync") < stylesFunction.indexOf("getLocalPaintStyles("));
});

test("design-system style search uses async local style reads under dynamic-page", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");
  const styleSearchFunction =
    source.match(/async function getLocalStyleMatches\([\s\S]*?\n\}/)?.[0] || "";

  assert.ok(styleSearchFunction.includes("await getAllLocalStyles()"));
  assert.match(source, /matches\.push\.apply\(matches, await getLocalStyleMatches/);
});

test("design-system search loads dynamic pages before local component traversal", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");
  const searchDesignSystemFunction =
    source.match(/async function searchDesignSystem\(payload = \{\}\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(source, /async function ensureAllPagesLoadedForLocalSearch/);
  assert.match(source, /await figma\.loadAllPagesAsync\(\)/);
  assert.match(searchDesignSystemFunction, /await ensureAllPagesLoadedForLocalSearch\(\)/);
});

test("page listing avoids reading unloaded page children in dynamic-page mode", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");
  const serializePageFunction = source.match(/function serializePage\([\s\S]*?\n\}/)?.[0] || "";

  assert.match(source, /function getSafePageChildCount/);
  assert.match(serializePageFunction, /const isCurrent/);
  assert.match(serializePageFunction, /childCount: getSafePageChildCount\(page, isCurrent\)/);
  assert.doesNotMatch(serializePageFunction, /Array\.isArray\(page\.children\)/);
});

test("page-scoped read commands load target pages before node traversal", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");
  const listTextNodesHandler =
    source.match(/if \(command\.type === "list_text_nodes"\) \{[\s\S]*?\n  if \(command\.type === "search_nodes"\)/)?.[0] || "";
  const searchNodesHandler =
    source.match(/if \(command\.type === "search_nodes"\) \{[\s\S]*?\n  if \(command\.type === "list_component_properties"\)/)?.[0] || "";

  assert.match(source, /async function loadPageForDynamicAccess/);
  assert.match(source, /await figma\.loadPageAsync\(page\)/);
  assert.match(source, /async function prepareDynamicPageAccess/);
  assert.match(source, /async function resolveTargetRoots/);
  assert.match(source, /const node = await getNodeByIdAny\(targetNodeId\)/);
  assert.match(source, /async function getMetadata/);
  assert.match(source, /payload\.pageId/);
  assert.match(source, /return \[page\]/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return await getMetadata/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return await getAnnotations/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return await getNodeDetails/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return await getComponentVariantDetails/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return await getInstanceDetails/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return await getVariableDefs/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return await searchInstances/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return await snapshotSelection/);
  assert.match(source, /await prepareDynamicPageAccess\(command\.payload \|\| \{\}\);\s*return exportNode/);
  assert.match(listTextNodesHandler, /const pageRoot = await prepareDynamicPageAccess\(command\.payload \|\| \{\}\)/);
  assert.match(listTextNodesHandler, /scope === "current-page"[\s\S]*pageRoot \|\| figma\.currentPage/);
  assert.match(searchNodesHandler, /const pageRoot = await prepareDynamicPageAccess\(command\.payload \|\| \{\}\)/);
  assert.match(searchNodesHandler, /scope === "current-page"[\s\S]*pageRoot \|\| figma\.currentPage/);
});

test("plugin node id lookups go through async helper under dynamic-page", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");
  const directLookups = [...source.matchAll(/figma\.getNodeById\(/g)].map((match) => match.index);
  const helperFunction =
    source.match(/async function getNodeByIdAny\(nodeId\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.equal(directLookups.length, 1);
  assert.match(helperFunction, /figma\.getNodeByIdAsync/);
  assert.match(helperFunction, /return figma\.getNodeById\(nodeId\)/);
});

test("server forwards pageId for dynamic-page read commands", async () => {
  const source = await readFile(new URL("src/server.js", repoRoot), "utf8");
  const toolDefinitionsSource = await readFile(
    new URL("src/server-tool-definitions.js", repoRoot),
    "utf8"
  );
  const readCommandFunction =
    source.match(/async function runDesignerReadCommand\([\s\S]*?\n\}/)?.[0] || "";

  assert.match(readCommandFunction, /pageId: args\.pageId/);
  assert.match(readCommandFunction, /get_metadata[\s\S]*pageId: args\.pageId/);
  assert.match(readCommandFunction, /get_variable_defs[\s\S]*pageId: args\.pageId/);
  assert.match(readCommandFunction, /search_instances[\s\S]*pageId: args\.pageId/);
  assert.match(toolDefinitionsSource, /name: "get_metadata"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "get_annotations"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "get_node_details"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "get_component_variant_details"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "get_instance_details"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "get_variable_defs"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "list_text_nodes"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "search_nodes"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "snapshot_selection"[\s\S]*pageId: \{ type: "string" \}/);
  assert.match(toolDefinitionsSource, /name: "export_node"[\s\S]*pageId: \{ type: "string" \}/);
});

test("layout variable binding uses a bulk write to reduce queue pressure", async () => {
  const source = await readFile(new URL("src/server.js", repoRoot), "utf8");
  const performBuildLayoutFunction =
    source.match(/async function performBuildLayout\([\s\S]*?\n\}/)?.[0] || "";

  assert.match(performBuildLayoutFunction, /pendingVariableBindings/);
  assert.match(performBuildLayoutFunction, /executePluginCommand\(\s*pluginId,\s*"bulk_bind_variables"/);
  assert.doesNotMatch(performBuildLayoutFunction, /executePluginCommand\(pluginId,\s*"bind_variable"/);
});

test("server token export writes artifacts instead of returning full variable JSON", async () => {
  const serverSource = await readFile(new URL("src/server.js", repoRoot), "utf8");
  const tokenExportSource = await readFile(new URL("src/server-token-export.js", repoRoot), "utf8");
  const source = `${serverSource}\n${tokenExportSource}`;

  assert.match(source, /XBRIDGE_TOKEN_EXPORT_DIR/);
  assert.match(source, /get_variable_collections_summary/);
  assert.match(source, /export_design_tokens_chunk/);
  assert.match(source, /designer\.task\.progress/);
  assert.match(source, /filePath/);
});

test("server token export summarizes color scale groups for Buddy-style audits", async () => {
  const source = await readFile(new URL("src/server-token-export.js", repoRoot), "utf8");

  assert.match(source, /function summarizeColorScaleGroups/);
  assert.match(source, /colorScaleGroups: resultColorScaleGroups/);
});

test("server token export uses buddy-safe chunk budgets for large Figma files", async () => {
  const serverSource = await readFile(new URL("src/server.js", repoRoot), "utf8");
  const tokenExportSource = await readFile(new URL("src/server-token-export.js", repoRoot), "utf8");
  const source = `${serverSource}\n${tokenExportSource}`;

  assert.match(source, /EXPORT_DESIGN_TOKENS_CHUNK_TIMEOUT_MS[\s\S]*\|\| 120000/);
  assert.match(source, /EXPORT_DESIGN_TOKENS_CHUNK_MAX_LIMIT/);
  assert.match(source, /EXPORT_DESIGN_TOKENS_CHUNK_LIMIT[\s\S]*\|\| 20/);
  assert.match(source, /Math\.min\(\s*deps\.chunkMaxLimit/);
  assert.match(source, /limit:\s*body\.limit\s*\?\?\s*body\.chunkLimit/);
  assert.match(source, /const includeAliases = args\.includeAliases === true/);
});

test("chunked token export preserves local style summaries when styles are requested", async () => {
  const pluginSource = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");
  const tokenExportSource = await readFile(new URL("src/server-token-export.js", repoRoot), "utf8");

  assert.match(pluginSource, /const styles = \(await getAllLocalStyles\(\)\)\.map\(serializeLocalStyle\)/);
  assert.match(pluginSource, /styles,/);
  assert.match(pluginSource, /styleCount:\s*styles\.length/);
  assert.doesNotMatch(tokenExportSource, /styles:\s*includeStyles\s*\?\s*\[\]\s*:\s*undefined/);
  assert.match(tokenExportSource, /styles:\s*includeStyles\s*\?\s*\(Array\.isArray\(summary\?\.styles\)/);
});

test("chunked token export only reads the requested variable slice by default", async () => {
  const source = await readFile(new URL("figma-plugin/code.js", repoRoot), "utf8");

  assert.match(source, /async function getVariablesForCollectionSlice/);
  assert.match(source, /collection\.variableIds\.slice\(cursor, cursor \+ limit\)/);
  assert.match(source, /const variables = await getVariablesForCollectionSlice\(collection, cursor, limit\)/);
  assert.match(source, /const aliasVariables = payload\.includeAliases === true \? await getAllLocalVariables\(\) : variables/);
  assert.doesNotMatch(source, /const allCollectionVariables = await getVariablesForCollection\(collection\)/);
});

test("server token export writes a partial artifact when a chunk read fails", async () => {
  const source = await readFile(new URL("src/server-token-export.js", repoRoot), "utf8");
  const exportFunction =
    source.match(/async function exportDesignTokensArtifact\([\s\S]*?\n\}/)?.[0] || "";

  assert.match(source, /let chunkFailure = null/);
  assert.match(source, /catch \(error\) \{\s*chunkFailure = error/);
  assert.match(source, /Export stopped after a chunk read failed/);
  assert.match(exportFunction, /partial,/);
  assert.match(source, /chunkFailure: chunkFailure/);
  assert.match(source, /errorCode: chunkFailure\?\./);
});
