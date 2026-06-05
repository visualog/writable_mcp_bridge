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

test("buildDesignerSuggestionBundle returns Buddy-style primitive color QA when token evidence exists", () => {
  const bundle = buildDesignerSuggestionBundle({
    intentEnvelope: {
      intents: [{ kind: "align_to_design_system" }],
      designerContext: {
        assetLookup: { primitiveTokenContext: true },
        target: { label: "primitives" }
      },
      contextModel: {
        designSystem: {
          shouldLookup: true,
          tokenSnapshot: {
            collectionCount: 7,
            variableCount: 548,
            styleCount: 45,
            collections: [
              { name: "0.1. primitives", variableCount: 222, modeCount: 1 }
            ],
            tokenBucketCounts: { colors: 198 },
            colorScaleGroups: [
              { group: "light/Red", steps: [20, 30, 50, 60, 80], alpha: true },
              { group: "dark/Black alpha", steps: [10, 20, 30, 40, 50, 60, 70, 80, 90] }
            ],
            sampleVariables: [
              { name: "light/Blue/60", resolvedType: "COLOR", modes: { default: "#3182F6" } },
              { name: "light/LightBlue/60", resolvedType: "COLOR", modes: { default: "#3E80F4" } },
              { name: "dark/Black alpha/10", resolvedType: "COLOR", modes: { default: "#FFFFFF/0.1" } }
            ]
          }
        }
      }
    },
    execution: { summary: {} }
  });

  assert.equal(bundle.summaryText.includes("프리미티브 컬러 팔레트 분석 결과"), true);
  assert.equal(bundle.summaryText.includes("0.1. primitives"), true);
  assert.equal(bundle.summaryText.includes("222개"), true);
  assert.equal(bundle.summaryText.includes("light/Red"), true);
  assert.equal(bundle.summaryText.includes("Black alpha"), true);
  assert.equal(bundle.summaryText.includes("Blue vs LightBlue"), true);
  assert.equal(bundle.summaryText.includes("데이터가 없어 판단"), false);
  assert.equal(bundle.recommendations.some((item) => item.title.includes("컬러 스케일")), true);
});

test("buildDesignerSuggestionBundle returns Buddy-style component QA for component improvement requests", () => {
  const bundle = buildDesignerSuggestionBundle({
    intentEnvelope: {
      intents: [{ kind: "swap_or_recommend_component" }],
      designerContext: {
        target: { label: "Chip component" }
      },
      contextModel: {
        focusedNode: {
          node: { name: "Chip component", type: "COMPONENT" },
          layout: { layoutMode: "HORIZONTAL", itemSpacing: 8 },
          variantProperties: {},
          componentProperties: {}
        },
        designSystem: {
          componentCandidates: [],
          instanceMatches: []
        }
      }
    },
    execution: {
      summary: { commandCount: 4, okCount: 3, errorCount: 1 },
      contextWarnings: ["search_design_system: timeout"]
    }
  });

  assert.equal(bundle.summaryText.includes("컴포넌트 개선 분석 결과"), true);
  assert.equal(bundle.summaryText.includes("근거"), true);
  assert.equal(bundle.summaryText.includes("read command 3/4 성공"), true);
  assert.equal(bundle.summaryText.includes("개선이 필요한 부분"), true);
  assert.equal(bundle.summaryText.includes("판단 제한"), true);
});

test("buildDesignerSuggestionBundle returns Buddy-style frame UX QA for hierarchy reviews", () => {
  const bundle = buildDesignerSuggestionBundle({
    intentEnvelope: {
      intents: [{ kind: "improve_hierarchy" }],
      designerContext: {
        target: { label: "primitives" }
      },
      contextModel: {
        focusedNode: {
          node: { name: "primitives", type: "SECTION" },
          layout: {},
          variantProperties: {},
          componentProperties: {}
        },
        structure: {
          childCount: 24,
          textNodeCount: 12,
          autoLayoutFrames: 0
        }
      }
    },
    execution: {
      summary: { commandCount: 3, okCount: 3, errorCount: 0 },
      contextWarnings: ["designSystem_missing"]
    }
  });

  assert.equal(bundle.summaryText.includes("UX/UI 리뷰 결과"), true);
  assert.equal(bundle.summaryText.includes("대상 primitives (SECTION)"), true);
  assert.equal(bundle.summaryText.includes("리뷰 대상 프레임 확정"), true);
  assert.equal(bundle.summaryText.includes("데이터가 없어"), false);
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
