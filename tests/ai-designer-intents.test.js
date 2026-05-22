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

test("inferIntentKindFromPrompt detects inspect requests", () => {
  assert.equal(inferIntentKindFromPrompt("선택한 프레임 확인해줘"), "inspect_selection");
  assert.equal(inferIntentKindFromPrompt("선택한 프레임에 대한 정보를 알려줘"), "inspect_selection");
  assert.equal(inferIntentKindFromPrompt("선택한 인스턴스 속성 정리해줘"), "inspect_selection");
});

test("inferIntentKindFromPrompt prioritizes text rewrite over inspect wording", () => {
  assert.equal(
    inferIntentKindFromPrompt("선택한 텍스트 내용을 커피동호회에 맞게 변경해줘"),
    "revise_copy"
  );
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

test("createDesignerIntentEnvelope respects an explicit AI intent override", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "선택한 카드 제목을 현재 사회 이슈 제목으로 바꿔줘",
    intentKindOverride: "revise_copy",
    figmaContext: {
      pageId: "12:34",
      pageName: "History",
      selection: [{ id: "100:1", name: "Issue Card" }]
    }
  });

  assert.equal(envelope.intents[0].kind, "revise_copy");
  assert.equal(envelope.readPlan.intentKind, "revise_copy");
});

test("createDesignerIntentEnvelope includes a minimal context model", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "선택한 버튼을 디자인 시스템 기준으로 정리해줘",
    figmaContext: {
      fileId: "file-1",
      fileName: "Marketing Site",
      pageId: "12:34",
      pageName: "History",
      selection: [{ id: "100:1", name: "Primary Button", type: "INSTANCE" }],
      viewport: { width: 1280, height: 720 },
      platform: "figma"
    }
  });

  assert.equal(envelope.contextModel.meta.version, "1.0");
  assert.equal(envelope.contextModel.target.primaryTargetId, "100:1");
  assert.equal(envelope.contextModel.selection.items[0].name, "Primary Button");
  assert.equal(envelope.contextModel.readMeta.coverage.fastContext.status, "available");
});
