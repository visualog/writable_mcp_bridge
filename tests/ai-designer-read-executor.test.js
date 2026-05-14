import test from "node:test";
import assert from "node:assert/strict";

import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";
import { executeDesignerReadPlan } from "../src/ai-designer-read-executor.js";

test("executeDesignerReadPlan runs phases in order and skips unavailable file-key commands", async () => {
  const envelope = createDesignerIntentEnvelope({
    request: "선택한 버튼을 디자인 시스템 기준으로 정리해줘",
    figmaContext: {
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "CTA Button", type: "INSTANCE" }],
      componentHints: ["Button / Primary"],
      tokenHints: ["color.brand.primary"]
    }
  });

  const calls = [];
  const result = await executeDesignerReadPlan({
    intentEnvelope: envelope,
    runCommand: async (command, args) => {
      calls.push({ command, args });
      return { command, ok: true };
    }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(
    result.phases.map((phase) => phase.phase),
    ["fast_context", "focused_detail", "asset_lookup"]
  );
  assert.deepEqual(calls.map((call) => call.command), [
    "get_selection",
    "get_metadata",
    "get_instance_details",
    "get_node_details",
    "search_design_system",
    "search_instances",
    "get_variable_defs"
  ]);
  const skipped = result.phases
    .flatMap((phase) => phase.commandResults)
    .filter((entry) => entry.status === "skipped");
  assert.equal(skipped.length >= 1, true);
  assert.equal(skipped.some((entry) => entry.command === "search_file_components"), true);
});

test("executeDesignerReadPlan captures command failures without aborting later commands", async () => {
  const envelope = createDesignerIntentEnvelope({
    request: "선택한 텍스트 카피를 다듬어줘",
    figmaContext: {
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "Hero Copy", type: "TEXT" }]
    }
  });

  const result = await executeDesignerReadPlan({
    intentEnvelope: envelope,
    runCommand: async (command) => {
      if (command === "get_node_details") {
        throw new Error("detail failed");
      }
      return { command, ok: true };
    }
  });

  const focusedDetail = result.phases.find((phase) => phase.phase === "focused_detail");
  assert.ok(focusedDetail);
  assert.equal(focusedDetail.ok, false);
  assert.equal(
    focusedDetail.commandResults.some((entry) => entry.command === "list_text_nodes" && entry.status === "ok"),
    true
  );
  assert.equal(
    focusedDetail.commandResults.some((entry) => entry.command === "get_node_details" && entry.status === "error"),
    true
  );
});

test("executeDesignerReadPlan uses shallow-first limits for heavy reads", async () => {
  const envelope = createDesignerIntentEnvelope({
    request: "선택한 카드 구조를 빠르게 파악해줘",
    figmaContext: {
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "Revenue Card", type: "INSTANCE" }],
      componentHints: ["Card / Revenue"],
      tokenHints: ["color.surface.card"]
    }
  });

  const calls = [];
  await executeDesignerReadPlan({
    intentEnvelope: envelope,
    runCommand: async (command, args) => {
      calls.push({ command, args });
      return { command, ok: true };
    }
  });

  const metadataCall = calls.find((entry) => entry.command === "get_metadata");
  const detailCall = calls.find((entry) => entry.command === "get_node_details");
  const instanceCall = calls.find((entry) => entry.command === "get_instance_details");
  const variableCall = calls.find((entry) => entry.command === "get_variable_defs");

  assert.equal(metadataCall.args.maxDepth, 1);
  assert.equal(metadataCall.args.maxNodes, 36);
  assert.equal(detailCall.args.maxDepth, 2);
  assert.equal(detailCall.args.maxNodes, 48);
  assert.equal(instanceCall.args.maxDepth, 2);
  assert.equal(instanceCall.args.maxNodes, 56);
  assert.equal(variableCall.args.maxDepth, 2);
  assert.equal(variableCall.args.maxNodes, 72);
});

test("executeDesignerReadPlan returns an aggregated context model", async () => {
  const envelope = createDesignerIntentEnvelope({
    request: "선택한 버튼을 디자인 시스템 기준으로 정리해줘",
    figmaContext: {
      fileId: "file-1",
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "CTA Button", type: "INSTANCE" }],
      componentHints: ["Button / Primary"],
      tokenHints: ["color.brand.primary"]
    }
  });

  const result = await executeDesignerReadPlan({
    intentEnvelope: envelope,
    runCommand: async (command) => {
      if (command === "get_selection") {
        return { nodes: [{ id: "100:1", name: "CTA Button", type: "INSTANCE" }] };
      }
      if (command === "get_metadata") {
        return {
          xml: '<selection id="100:1" name="CTA Button" type="INSTANCE"><frame id="200:1" name="Button Row" type="FRAME"><text id="300:1" name="Label" type="TEXT" /></frame></selection>'
        };
      }
      if (command === "get_instance_details") {
        return {
          targetNodeId: "100:1",
          detail: {
            node: { id: "100:1", name: "CTA Button", type: "INSTANCE", childCount: 1 },
            layout: { layoutMode: "HORIZONTAL", itemSpacing: 12 },
            sourceComponent: { id: "comp-1", name: "Button / Primary" },
            componentProperties: { Size: { type: "VARIANT", value: "Large" } }
          }
        };
      }
      if (command === "get_component_variant_details") {
        return {
          targetNodeId: "100:1",
          detail: { variantProperties: { Size: "Large", Tone: "Primary" } }
        };
      }
      if (command === "get_node_details") {
        return {
          targetNodeId: "100:1",
          detail: {
            node: { id: "100:1", name: "CTA Button", type: "INSTANCE", childCount: 1 },
            layout: { layoutMode: "HORIZONTAL", itemSpacing: 12 },
            geometry: { width: 120, height: 44 }
          }
        };
      }
      if (command === "get_variable_defs") {
        return { variables: [{ name: "color.brand.primary", value: "#3366FF" }] };
      }
      if (command === "search_design_system") {
        return { matches: [{ name: "Button / Primary", type: "COMPONENT" }] };
      }
      if (command === "search_instances") {
        return { matches: [{ id: "500:1", name: "CTA Button", type: "INSTANCE" }] };
      }
      return { ok: true };
    }
  });

  assert.equal(result.contextModel.meta.version, "1.0");
  assert.equal(result.contextModel.target.primaryTargetId, "100:1");
  assert.equal(result.contextModel.focusedNode.layout.layoutMode, "HORIZONTAL");
  assert.equal(result.contextModel.structure.textNodeCount, 1);
  assert.equal(result.contextModel.designSystem.variableDefs.length, 1);
  assert.equal(result.contextCoverage.focusedNode.status, "available");
  assert.equal(result.contextCoverage.designSystem.status, "available");
  assert.deepEqual(result.contextWarnings, []);
});
