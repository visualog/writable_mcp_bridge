import test from "node:test";
import assert from "node:assert/strict";

import { buildComposeToolDefinitions } from "../src/constants/server-tool-definitions-compose.js";
import { buildCoreToolDefinitions } from "../src/constants/server-tool-definitions-core.js";
import { buildDiscoveryToolDefinitions } from "../src/constants/server-tool-definitions-discovery.js";
import { buildMutationToolDefinitions } from "../src/constants/server-tool-definitions-mutation.js";
import { buildNodeToolDefinitions } from "../src/constants/server-tool-definitions-node.js";
import { buildOperationToolDefinitions } from "../src/constants/server-tool-definitions-operations.js";
import { buildReadToolDefinitions } from "../src/constants/server-tool-definitions-read.js";
import { buildToolDefinitions } from "../src/server-tool-definitions.js";

test("buildCoreToolDefinitions preserves the leading core tool definitions", () => {
  const coreTools = buildCoreToolDefinitions();
  const allTools = buildToolDefinitions();

  assert.deepEqual(
    coreTools.map((tool) => tool.name),
    [
      "get_active_plugins",
      "get_selection",
      "list_pages",
      "get_figma_account_profile",
      "list_team_projects",
      "list_project_files",
      "get_file_summary"
    ]
  );
  assert.deepEqual(allTools.slice(0, coreTools.length), coreTools);
});

test("buildReadToolDefinitions preserves the read and detail tool definitions after core tools", () => {
  const coreTools = buildCoreToolDefinitions();
  const readTools = buildReadToolDefinitions();
  const allTools = buildToolDefinitions();

  assert.deepEqual(
    readTools.map((tool) => tool.name),
    [
      "get_metadata",
      "get_annotations",
      "get_node_details",
      "get_component_variant_details",
      "get_instance_details",
      "get_variable_defs",
      "export_design_tokens",
      "list_text_nodes",
      "search_nodes",
      "snapshot_selection",
      "export_node"
    ]
  );
  assert.deepEqual(allTools.slice(coreTools.length, coreTools.length + readTools.length), readTools);
});

test("buildDiscoveryToolDefinitions preserves discovery and annotation tool definitions after read tools", () => {
  const coreTools = buildCoreToolDefinitions();
  const readTools = buildReadToolDefinitions();
  const discoveryTools = buildDiscoveryToolDefinitions();
  const allTools = buildToolDefinitions();
  const startIndex = coreTools.length + readTools.length;

  assert.deepEqual(
    discoveryTools.map((tool) => tool.name),
    [
      "analyze_reference_selection",
      "add_annotation",
      "bulk_add_annotations",
      "search_design_system",
      "search_instances",
      "search_library_assets",
      "recreate_snapshot",
      "search_file_components",
      "list_component_properties"
    ]
  );
  assert.deepEqual(allTools.slice(startIndex, startIndex + discoveryTools.length), discoveryTools);
});

test("buildMutationToolDefinitions preserves text, style, variable, and component mutation tool definitions after discovery tools", () => {
  const coreTools = buildCoreToolDefinitions();
  const readTools = buildReadToolDefinitions();
  const discoveryTools = buildDiscoveryToolDefinitions();
  const mutationTools = buildMutationToolDefinitions();
  const allTools = buildToolDefinitions();
  const startIndex = coreTools.length + readTools.length + discoveryTools.length;

  assert.deepEqual(
    mutationTools.map((tool) => tool.name),
    [
      "update_text",
      "set_component_property",
      "set_component_properties",
      "add_component_property",
      "edit_component_property",
      "set_variant_properties",
      "bind_variable",
      "bulk_bind_variables",
      "apply_style",
      "create_component",
      "create_component_set"
    ]
  );
  assert.deepEqual(allTools.slice(startIndex, startIndex + mutationTools.length), mutationTools);
});

test("buildNodeToolDefinitions preserves node, import, and update tool definitions after mutation tools", () => {
  const coreTools = buildCoreToolDefinitions();
  const readTools = buildReadToolDefinitions();
  const discoveryTools = buildDiscoveryToolDefinitions();
  const mutationTools = buildMutationToolDefinitions();
  const nodeTools = buildNodeToolDefinitions();
  const allTools = buildToolDefinitions();
  const startIndex = coreTools.length + readTools.length + discoveryTools.length + mutationTools.length;

  assert.deepEqual(
    nodeTools.map((tool) => tool.name),
    [
      "preview_changes",
      "rename_node",
      "bulk_rename_nodes",
      "bulk_update_texts",
      "update_node",
      "bulk_update_nodes",
      "bulk_create_nodes",
      "create_node",
      "import_library_component",
      "find_or_import_component",
      "reuse_or_create_component"
    ]
  );
  assert.deepEqual(allTools.slice(startIndex, startIndex + nodeTools.length), nodeTools);
});

test("buildComposeToolDefinitions preserves compose and layout tool definitions after node tools", () => {
  const coreTools = buildCoreToolDefinitions();
  const readTools = buildReadToolDefinitions();
  const discoveryTools = buildDiscoveryToolDefinitions();
  const mutationTools = buildMutationToolDefinitions();
  const nodeTools = buildNodeToolDefinitions();
  const composeTools = buildComposeToolDefinitions();
  const allTools = buildToolDefinitions();
  const startIndex =
    coreTools.length + readTools.length + discoveryTools.length + mutationTools.length + nodeTools.length;

  assert.deepEqual(
    composeTools.map((tool) => tool.name),
    [
      "build_screen_from_design_system",
      "validate_external_compose_input",
      "get_compose_metrics",
      "compose_screen_from_intents",
      "analyze_selection_to_compose",
      "build_finance_summary_mock",
      "build_layout"
    ]
  );
  assert.deepEqual(allTools.slice(startIndex, startIndex + composeTools.length), composeTools);
});

test("buildOperationToolDefinitions preserves final node operation tool definitions after compose tools", () => {
  const coreTools = buildCoreToolDefinitions();
  const readTools = buildReadToolDefinitions();
  const discoveryTools = buildDiscoveryToolDefinitions();
  const mutationTools = buildMutationToolDefinitions();
  const nodeTools = buildNodeToolDefinitions();
  const composeTools = buildComposeToolDefinitions();
  const operationTools = buildOperationToolDefinitions();
  const allTools = buildToolDefinitions();
  const startIndex =
    coreTools.length +
    readTools.length +
    discoveryTools.length +
    mutationTools.length +
    nodeTools.length +
    composeTools.length;

  assert.deepEqual(
    operationTools.map((tool) => tool.name),
    [
      "create_instance",
      "duplicate_node",
      "move_node",
      "move_section",
      "normalize_spacing",
      "promote_section",
      "apply_naming_rule",
      "delete_node",
      "reorder_child",
      "boolean_subtract",
      "undo_last_batch"
    ]
  );
  assert.deepEqual(allTools.slice(startIndex, startIndex + operationTools.length), operationTools);
});

test("buildToolDefinitions exposes dynamic-page pageId on read tools", () => {
  const tools = buildToolDefinitions();
  const byName = new Map(tools.map((tool) => [tool.name, tool]));

  for (const name of [
    "get_metadata",
    "get_annotations",
    "get_node_details",
    "get_component_variant_details",
    "get_instance_details",
    "get_variable_defs",
    "list_text_nodes",
    "search_nodes",
    "snapshot_selection",
    "export_node"
  ]) {
    assert.equal(byName.get(name).inputSchema.properties.pageId.type, "string");
  }
});
