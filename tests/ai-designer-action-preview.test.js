import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignerActionPreviewBundle } from "../src/ai-designer-action-preview.js";
import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";
import { executeDesignerReadPlan } from "../src/ai-designer-read-executor.js";
import { buildDesignerSuggestionBundle } from "../src/ai-designer-suggestions.js";

async function buildBundle(request, figmaContext, runCommand) {
  const intentEnvelope = createDesignerIntentEnvelope({
    request,
    figmaContext
  });
  const execution = await executeDesignerReadPlan({
    intentEnvelope,
    runCommand: runCommand || (async (command) => ({ command, ok: true }))
  });
  const designerSuggestionBundle = buildDesignerSuggestionBundle({
    intentEnvelope,
    execution
  });
  return buildDesignerActionPreviewBundle({
    intentEnvelope,
    execution,
    designerSuggestionBundle
  });
}

test("buildDesignerActionPreviewBundle gates structural actions behind confirmation", async () => {
  const bundle = await buildBundle("선택한 카드의 정보 위계를 정리해줘", {
    pageName: "Dashboard",
    selection: [{ id: "1:2", name: "Revenue Card", type: "FRAME" }]
  });

  assert.equal(bundle.summary.actionCount > 0, true);
  assert.equal(bundle.summary.readyTotal > 0, true);
  assert.equal(bundle.previews[0].readiness, "needs_confirmation");
  assert.equal(bundle.previews[0].applyMode, "figma_apply");
  assert.equal(bundle.previews[0].requiredConfirmation, "multi_node");
  assert.equal(bundle.previews[0].blockers.length, 0);
});

test("buildDesignerActionPreviewBundle blocks apply when focused detail is missing", async () => {
  const bundle = await buildBundle(
    "선택한 카드의 정보 위계를 정리해줘",
    {
      pageName: "Dashboard",
      selection: [{ id: "1:2", name: "Revenue Card", type: "FRAME" }]
    },
    async (command) => {
      if (command === "get_node_details") {
        throw new Error("detail failed");
      }
      return { command, ok: true };
    }
  );

  const firstPreview = bundle.previews[0];

  assert.equal(firstPreview.readiness, "blocked");
  assert.equal(firstPreview.applyMode, "suggest_only");
  assert.equal(firstPreview.canApplyNow, false);
  assert.ok(firstPreview.blockers.some((blocker) => blocker.code === "read_errors_present"));
});

test("buildDesignerActionPreviewBundle requires asset lookup for design-system actions", async () => {
  const bundle = await buildBundle("선택한 버튼을 디자인 시스템 기준으로 정리해줘", {
    pageName: "Landing",
    selection: [{ id: "10:2", name: "CTA Button", type: "INSTANCE" }],
    componentHints: ["Button / Primary"],
    tokenHints: ["color.brand.primary"]
  });

  const designSystemPreview = bundle.previews.find((preview) => preview.actionType === "design_system_alignment");

  assert.ok(designSystemPreview);
  assert.equal(designSystemPreview.readiness, "needs_confirmation");
  assert.equal(designSystemPreview.requiredConfirmation, "asset_change");
  assert.ok(designSystemPreview.preview.evidence.some((item) => item.includes("asset lookup confirmed")));
});
