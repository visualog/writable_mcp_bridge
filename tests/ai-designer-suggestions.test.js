import test from "node:test";
import assert from "node:assert/strict";

import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";
import { executeDesignerReadPlan } from "../src/ai-designer-read-executor.js";
import { buildDesignerSuggestionBundle } from "../src/ai-designer-suggestions.js";

async function buildFixture(intentRequest, figmaContext, failCommand = null) {
  const intentEnvelope = createDesignerIntentEnvelope({
    request: intentRequest,
    figmaContext
  });
  const execution = await executeDesignerReadPlan({
    intentEnvelope,
    runCommand: async (command) => {
      if (command === failCommand) {
        throw new Error(`${command} failed`);
      }
      return { command, ok: true };
    }
  });

  return { intentEnvelope, execution };
}

test("buildDesignerSuggestionBundle creates design-system guidance with apply candidates", async () => {
  const { intentEnvelope, execution } = await buildFixture(
    "선택한 버튼을 디자인 시스템 기준으로 정리해줘",
    {
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "CTA Button", type: "INSTANCE" }],
      componentHints: ["Button / Primary"],
      tokenHints: ["color.brand.primary"]
    }
  );

  const bundle = buildDesignerSuggestionBundle({ intentEnvelope, execution });

  assert.equal(bundle.intentKind, "align_to_design_system");
  assert.equal(bundle.recommendations.length > 0, true);
  assert.equal(bundle.applyActions.length > 0, true);
  assert.equal(bundle.findings[0].label.includes("기존 컴포넌트"), true);
});

test("buildDesignerSuggestionBundle records evidence-gap risks when execution has issues", async () => {
  const { intentEnvelope, execution } = await buildFixture(
    "선택한 텍스트 카피를 다듬어줘",
    {
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "Hero Copy", type: "TEXT" }]
    },
    "get_node_details"
  );

  const bundle = buildDesignerSuggestionBundle({ intentEnvelope, execution });

  assert.equal(bundle.intentKind, "revise_copy");
  assert.equal(bundle.risks.length > 0, true);
  assert.equal(bundle.summaryText.length > 0, true);
});
