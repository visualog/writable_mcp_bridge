import test from "node:test";
import assert from "node:assert/strict";

import { buildDesignerContextSummary } from "../src/ai-designer-context.js";
import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";

test("buildDesignerContextSummary uses selection-first strategy and detail follow-up", () => {
  const summary = buildDesignerContextSummary(
    {
      fileName: "Growth Dashboard",
      pageName: "Overview",
      selection: [{ id: "100:1", name: "Hero KPI", type: "FRAME" }],
      selectedNodeDetails: {
        targetNodeId: "100:1",
        detail: {
          node: { id: "100:1", name: "Hero KPI", type: "FRAME" },
          layout: { layoutMode: "VERTICAL", itemSpacing: 24 },
          variantProperties: {},
          componentProperties: {}
        }
      }
    },
    {
      request: "선택한 카드 레이아웃을 재구성해줘"
    }
  );

  assert.equal(summary.target.type, "current_selection");
  assert.equal(summary.readStrategy.scope, "selection_first");
  assert.deepEqual(summary.readStrategy.followUps, ["focused_detail"]);
  assert.equal(summary.focusedDetail.status, "available");
  assert.equal(summary.focusedDetail.layoutMode, "VERTICAL");
});

test("buildDesignerContextSummary adds asset lookup when request mentions design system", () => {
  const summary = buildDesignerContextSummary(
    {
      fileName: "Marketing Site",
      pageName: "Landing",
      componentHints: ["Button / Primary"],
      tokenHints: ["color.brand.primary"]
    },
    {
      request: "이 화면을 디자인 시스템과 컴포넌트 기준으로 정리해줘"
    }
  );

  assert.equal(summary.assetLookup.shouldLookup, true);
  assert.equal(summary.readStrategy.scope, "page_first");
  assert.ok(summary.readStrategy.followUps.includes("asset_lookup"));
  assert.equal(summary.assetLookup.availableHints.componentCount, 1);
  assert.equal(summary.assetLookup.availableHints.tokenCount, 1);
});

test("createDesignerIntentEnvelope includes summarized designer context", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "선택한 화면을 카드형 대시보드로 재구성해줘",
    figmaContext: {
      fileName: "Growth Dashboard",
      pageId: "12:34",
      pageName: "Overview",
      selection: [{ id: "100:1", name: "Summary Frame", type: "FRAME" }]
    },
    mode: "suggest_then_apply"
  });

  assert.equal(envelope.designerContext.target.type, "current_selection");
  assert.equal(envelope.designerContext.fastContext.pageName, "Overview");
  assert.equal(envelope.designerContext.readStrategy.primaryMode, "fast_context");
  assert.ok(envelope.designerContext.headline.includes("선택"));
});
