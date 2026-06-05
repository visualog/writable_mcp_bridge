import test from "node:test";
import assert from "node:assert/strict";

import { buildToolDefinitions } from "../src/server-tool-definitions.js";

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
