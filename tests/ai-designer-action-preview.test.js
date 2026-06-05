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
  assert.deepEqual(
    designSystemPreview.bridgeCommandCandidates.map((candidate) => candidate.command),
    ["search_design_system", "search_file_components"]
  );
});

test("buildDesignerActionPreviewBundle exposes command candidates for copy-refine actions", async () => {
  const bundle = await buildBundle("선택한 텍스트 카피를 다듬어줘", {
    pageName: "Landing",
    selection: [{ id: "10:2", name: "Hero Copy", type: "TEXT" }]
  });

  const copyPreview = bundle.previews.find((preview) => preview.actionType === "copy_refine");

  assert.ok(copyPreview);
  assert.deepEqual(
    copyPreview.bridgeCommandCandidates.map((candidate) => candidate.command),
    ["list_text_nodes", "bulk_update_texts"]
  );
  assert.equal(copyPreview.bridgeCommandCandidates.every((candidate) => candidate.targetNodeId === "10:2"), true);
});

test("buildDesignerActionPreviewBundle exposes generated screen repair mutation candidates", () => {
  const bundle = buildDesignerActionPreviewBundle({
    intentEnvelope: createDesignerIntentEnvelope({
      request: "참조 화면 기준으로 기존 생성 화면 품질을 개선해줘",
      figmaContext: {
        pageName: "Page 55",
        selection: [
          { id: "ref:1", name: "Reference", type: "FRAME" },
          { id: "gen:1", name: "Generated", type: "FRAME" }
        ]
      }
    }),
    execution: {
      ok: true,
      summary: { errorCount: 0 },
      phases: [
        {
          phase: "focused_detail",
          commandResults: [{ status: "ok", command: "get_node_details" }]
        }
      ]
    },
    designerSuggestionBundle: {
      intentKind: "improve_generated_screen",
      applyActions: [
        {
          id: "repair",
          actionType: "generated_screen_repair",
          label: "참조 비교 결과로 생성 화면 보정",
          targetNodeId: "gen:1",
          repairPlan: {
            createTextNodes: [{ text: "Winner gets 50 coins", x: 24, y: 800, width: 240, height: 20 }],
            createVisualNodes: [{ nodeType: "RECTANGLE", name: "missing-visual-score bar", x: 24, y: 640, width: 240, height: 8 }],
            regroupNodes: [
              {
                name: "Results card",
                frame: { nodeType: "FRAME", name: "Results card", x: 16, y: 360, width: 300, height: 120 }
              }
            ],
            updateNodeBboxes: [{ nodeId: "gen-title", x: 112, y: 48, width: 166, height: 22 }],
            deleteNodeIds: ["gen-helper"]
          }
        }
      ]
    }
  });

  assert.equal(bundle.summary.readyTotal, 1);
  assert.equal(bundle.previews[0].actionType, "generated_screen_repair");
  assert.equal(bundle.previews[0].readiness, "needs_confirmation");
  assert.equal(bundle.previews[0].requiredConfirmation, "multi_node");
  assert.deepEqual(
    bundle.previews[0].bridgeCommandCandidates.map((candidate) => candidate.command),
    ["generated_screen_repair", "bulk_create_nodes", "bulk_update_nodes", "delete_node"]
  );
  assert.equal(bundle.previews[0].bridgeCommandCandidates[0].argsHint.repairPlan.createTextNodes.length, 1);
  assert.equal(bundle.previews[0].bridgeCommandCandidates[1].argsHint.nodes.length, 3);
  assert.deepEqual(
    bundle.previews[0].bridgeCommandCandidates[1].argsHint.nodes.map((node) => node.name || node.text),
    ["Winner gets 50 coins", "missing-visual-score bar", "Results card"]
  );
  assert.equal(bundle.previews[0].bridgeCommandCandidates[2].argsHint.updates[0].nodeId, "gen-title");
  assert.deepEqual(bundle.previews[0].bridgeCommandCandidates[3].argsHint.nodeIds, ["gen-helper"]);
});
