import test from "node:test";
import assert from "node:assert/strict";

import {
  createDesignerIntentEnvelope,
  inferIntentKindFromPrompt,
  normalizeContextScope
} from "../src/ai-designer-intents.js";

test("inferIntentKindFromPrompt detects layout-oriented requests", () => {
  assert.equal(inferIntentKindFromPrompt("선택한 레이아웃을 재구성해줘"), "restructure_layout");
});

test("normalizeContextScope reflects selection-driven context", () => {
  const scope = normalizeContextScope({
    pageId: "12:34",
    selection: [{ id: "100:1", name: "Hero" }]
  });

  assert.equal(scope.targetType, "current_selection");
  assert.equal(scope.selectionMode, "single");
  assert.deepEqual(scope.targetIds, ["100:1"]);
});

test("createDesignerIntentEnvelope creates a reviewable envelope", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "선택한 화면을 카드형 대시보드로 재구성해줘",
    figmaContext: {
      pageId: "12:34",
      pageName: "Dashboard",
      selection: [{ id: "100:1", name: "Summary Frame" }]
    },
    mode: "suggest_then_apply"
  });

  assert.equal(envelope.version, "1.0");
  assert.equal(envelope.mode, "suggest_then_apply");
  assert.equal(envelope.intents.length, 1);
  assert.equal(envelope.intents[0].target.name, "Summary Frame");
  assert.equal(envelope.executionPolicy.allowDirectApply, true);
});
