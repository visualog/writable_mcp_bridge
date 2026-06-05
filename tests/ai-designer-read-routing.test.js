import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignerReadRoute } from "../src/ai-designer-read-routing.js";
import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";

test("buildDesignerReadRoute keeps critique selection-first and adds focused detail", () => {
  const route = buildDesignerReadRoute({
    intentKind: "critique",
    designerContext: {
      target: { type: "current_selection", selectionCount: 1 },
      fastContext: { selectionTypes: ["FRAME"] },
      assetLookup: { shouldLookup: false, availableHints: {} }
    },
    contextScope: { targetType: "current_selection" }
  });

  assert.equal(route.primaryPhase, "fast_context");
  assert.deepEqual(
    route.phases.map((phase) => phase.phase),
    ["fast_context", "focused_detail"]
  );
  assert.ok(route.commands.includes("get_node_details"));
  assert.ok(!route.commands.includes("search_design_system"));
});

test("buildDesignerReadRoute adds asset lookup for design-system alignment", () => {
  const route = buildDesignerReadRoute({
    intentKind: "align_to_design_system",
    designerContext: {
      target: { type: "current_selection", selectionCount: 1 },
      fastContext: { selectionTypes: ["INSTANCE"] },
      assetLookup: {
        shouldLookup: true,
        availableHints: { libraryCount: 1, tokenCount: 1, componentCount: 1 }
      }
    },
    contextScope: { targetType: "current_selection" }
  });

  assert.deepEqual(
    route.phases.map((phase) => phase.phase),
    ["fast_context", "focused_detail", "asset_lookup"]
  );
  assert.ok(route.commands.includes("get_instance_details"));
  assert.ok(route.commands.includes("search_design_system"));
  assert.ok(route.commands.includes("get_variable_defs"));
  assert.ok(route.commands.includes("search_instances"));
});

test("buildDesignerReadRoute sends variable JSON exports to the token snapshot command", () => {
  const route = buildDesignerReadRoute({
    intentKind: "export_design_tokens",
    designerContext: {
      target: { type: "current_page", selectionCount: 0 },
      fastContext: { selectionTypes: [] },
      assetLookup: { shouldLookup: false, availableHints: {} }
    },
    contextScope: { targetType: "current_page" }
  });

  assert.equal(route.primaryPhase, "token_export");
  assert.deepEqual(route.commands, ["export_design_tokens"]);
  assert.deepEqual(
    route.phases.map((phase) => phase.commands).flat(),
    ["export_design_tokens"]
  );
  assert.equal(route.doNotFullScanByDefault, false);
});

test("createDesignerIntentEnvelope includes read routing plan", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "선택한 버튼을 디자인 시스템 기준으로 정리해줘",
    figmaContext: {
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "CTA Button", type: "INSTANCE" }],
      componentHints: ["Button / Primary"],
      tokenHints: ["color.brand.primary"]
    },
    mode: "suggest_then_apply"
  });

  assert.equal(envelope.readPlan.primaryPhase, "fast_context");
  assert.ok(envelope.readPlan.phases.some((phase) => phase.phase === "asset_lookup"));
  assert.ok(envelope.readPlan.commands.includes("search_design_system"));
});

test("color primitive section analysis escalates to token-aware reads", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "선택한 프리미티브에 대해 분석하고 개선해야 할 부분 정리해줘",
    figmaContext: {
      fileName: "FDS v2.0 -테스트용",
      pageId: "2825:3142",
      pageName: "┗ Color",
      selection: [{ id: "2825:6377", name: "primitives", type: "SECTION" }]
    },
    mode: "suggest"
  });

  assert.equal(envelope.readPlan.intentKind, "align_to_design_system");
  assert.ok(envelope.designerContext.assetLookup.shouldLookup);
  assert.ok(envelope.designerContext.assetLookup.primitiveTokenContext);
  assert.ok(envelope.readPlan.phases.some((phase) => phase.phase === "asset_lookup"));
  assert.ok(!envelope.readPlan.commands.includes("search_design_system"));
  assert.ok(!envelope.readPlan.commands.includes("search_file_components"));
  assert.ok(!envelope.readPlan.commands.includes("get_variable_defs"));
  assert.ok(envelope.readPlan.commands.includes("export_design_tokens"));
});

test("inspect selection requests do not escalate to design-system search from component hints", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "선택한 인스턴스 속성 정리해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageId: "33276:16484",
      pageName: "Page 55",
      selection: [{ id: "33333:341", name: "Button", type: "INSTANCE" }],
      componentHints: ["Button / Default"],
      tokenHints: ["Color/Primary"]
    },
    mode: "suggest_then_apply"
  });

  assert.equal(envelope.readPlan.intentKind, "inspect_selection");
  assert.ok(envelope.readPlan.commands.includes("get_instance_details"));
  assert.ok(envelope.readPlan.commands.includes("get_node_details"));
  assert.ok(!envelope.readPlan.commands.includes("search_design_system"));
  assert.ok(!envelope.readPlan.phases.some((phase) => phase.phase === "asset_lookup"));
});
