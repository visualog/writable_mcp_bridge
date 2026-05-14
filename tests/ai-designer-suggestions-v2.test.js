import test from "node:test";
import assert from "node:assert/strict";

import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";
import { executeDesignerReadPlan } from "../src/ai-designer-read-executor.js";
import {
  augmentDesignerSuggestionBundleWithAiPlan,
  buildDesignerSuggestionBundle
} from "../src/ai-designer-suggestions-v2.js";

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
  assert.equal(bundle.findings[0].label.includes("design system 컴포넌트"), true);
});

test("buildDesignerSuggestionBundle explains instance variants and overrides from context model", () => {
  const bundle = buildDesignerSuggestionBundle({
    intentEnvelope: {
      intents: [{ kind: "inspect_selection" }],
      designerContext: {
        fastContext: { selectionSummary: "Primary Button" }
      },
      contextModel: {
        focusedNode: {
          node: { id: "100:1", name: "Primary Button", type: "INSTANCE" },
          sourceComponent: { id: "comp-1", name: "Button / Primary" },
          variantProperties: { Size: "Large", Tone: "Primary" },
          componentProperties: { Label: { type: "TEXT", value: "Continue" } }
        }
      }
    },
    execution: { summary: {} }
  });

  assert.equal(bundle.findings[0].label.includes("variant와 override"), true);
  assert.equal(bundle.findings[0].detail.includes("원본 컴포넌트 Button / Primary"), true);
  assert.equal(bundle.recommendations.length, 1);
  assert.equal(bundle.recommendations[0].title.includes("variant와 override"), true);
});

test("buildDesignerSuggestionBundle critiques auto layout and spacing from context model", () => {
  const bundle = buildDesignerSuggestionBundle({
    intentEnvelope: {
      intents: [{ kind: "adjust_spacing" }],
      designerContext: {
        fastContext: { selectionSummary: "Card Frame" }
      },
      contextModel: {
        focusedNode: {
          node: { id: "100:1", name: "Card Frame", type: "FRAME" },
          layout: { layoutMode: "VERTICAL", itemSpacing: 16 }
        },
        structure: {
          childCount: 4,
          textNodeCount: 2,
          autoLayoutFrames: 1
        }
      }
    },
    execution: { summary: {} }
  });

  assert.equal(bundle.findings[0].label.includes("auto layout과 spacing"), true);
  assert.equal(bundle.findings[0].detail.includes("auto layout VERTICAL"), true);
  assert.equal(bundle.recommendations[0].reason.includes("spacing 16"), true);
});

test("buildDesignerSuggestionBundle recommends design-system components from context model", () => {
  const bundle = buildDesignerSuggestionBundle({
    intentEnvelope: {
      intents: [{ kind: "swap_or_recommend_component" }],
      contextModel: {
        designSystem: {
          shouldLookup: true,
          componentCandidates: [
            { id: "cmp-1", name: "Card / Primary" },
            { id: "cmp-2", name: "Card / Compact" }
          ],
          variableDefs: [{ name: "color.surface.card", value: "#fff" }],
          instanceMatches: [{ id: "inst-1", name: "Revenue Card" }]
        }
      }
    },
    execution: { summary: {} }
  });

  assert.equal(bundle.findings[0].label.includes("design system 컴포넌트"), true);
  assert.equal(bundle.findings[0].detail.includes("추천 컴포넌트 2개"), true);
  assert.equal(bundle.recommendations.some((item) => item.title.includes("컴포넌트 후보")), true);
  assert.equal(bundle.recommendations.some((item) => item.title.includes("변수부터")), true);
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

test("buildDesignerSuggestionBundle keeps inspect requests focused on read results", async () => {
  const { intentEnvelope, execution } = await buildFixture(
    "선택한 프레임 확인해줘",
    {
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "Hero Frame", type: "FRAME" }]
    }
  );

  const bundle = buildDesignerSuggestionBundle({ intentEnvelope, execution });

  assert.equal(bundle.intentKind, "inspect_selection");
  assert.equal(bundle.recommendations.length, 0);
  assert.equal(bundle.applyActions.length, 0);
  assert.equal(bundle.summaryText.includes("확인"), true);
});

test("buildDesignerSuggestionBundle sanitizes Hanja in user-facing summary and findings", () => {
  const bundle = buildDesignerSuggestionBundle({
    intentEnvelope: {
      intents: [{ kind: "inspect_selection" }],
      designerContext: {
        headline: "一般 게시물 來由",
        target: { label: "確認 대상" }
      }
    },
    execution: {
      summary: {}
    }
  });

  assert.equal(bundle.summaryText.includes("來由"), false);
  assert.equal(bundle.findings[0].label.includes("確認"), false);
});

test("augmentDesignerSuggestionBundleWithAiPlan appends AI action plan into recommendations and apply actions", async () => {
  const { intentEnvelope, execution } = await buildFixture(
    "선택한 카드의 정보 위계를 정리해줘",
    {
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "Hero Frame", type: "FRAME" }]
    }
  );

  const baseBundle = buildDesignerSuggestionBundle({ intentEnvelope, execution });
  const augmented = augmentDesignerSuggestionBundleWithAiPlan(
    baseBundle,
    {
      actionPlan: [
        {
          title: "제목과 본문 블록을 분리해서 보기",
          detail: "카드 상단의 핵심 메시지와 보조 설명을 나눠 보면 위계 판단이 쉬워집니다.",
          requiresConfirmation: true
        }
      ]
    },
    intentEnvelope
  );

  assert.equal(augmented.recommendations.some((item) => item.title.includes("제목과 본문 블록")), true);
  assert.equal(augmented.applyActions.some((item) => item.label.includes("제목과 본문 블록")), true);
});
