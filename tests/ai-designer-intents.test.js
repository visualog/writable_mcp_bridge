import test from "node:test";
import assert from "node:assert/strict";

import {
  createDesignerIntentEnvelope,
  inferDesignerUserIntentKind,
  inferIntentKindFromPrompt,
  normalizeContextScope
} from "../src/ai-designer-intents.js";

test("inferIntentKindFromPrompt detects layout-oriented requests", () => {
  assert.equal(inferIntentKindFromPrompt("선택한 레이아웃을 재구성해줘"), "restructure_layout");
});

test("inferIntentKindFromPrompt prioritizes image-based screen construction over implementation handoff", () => {
  assert.equal(
    inferIntentKindFromPrompt("첨부 이미지를 분석해서 화면으로 구현해줘"),
    "generate_screen"
  );
  assert.equal(
    inferIntentKindFromPrompt("스크린샷을 참고해서 모바일 화면을 구성해줘"),
    "generate_screen"
  );
  assert.equal(
    inferIntentKindFromPrompt("이거 그대로 만들어줘\n\n[첨부 참고]\n- [첨부 이미지] screen.png"),
    "generate_screen"
  );
});

test("createDesignerIntentEnvelope keeps image implementation requests in Figma apply flow", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "첨부 이미지를 분석해서 화면으로 구현해줘",
    figmaContext: {
      pageId: "12:34",
      pageName: "Page 55"
    }
  });

  assert.equal(envelope.mode, "suggest_then_apply");
  assert.equal(envelope.intentClassification.userIntentKind, "image_to_screen");
  assert.equal(envelope.intentClassification.internalIntentKind, "generate_screen");
  assert.equal(envelope.intents[0].kind, "generate_screen");
  assert.equal(envelope.intents[0].userIntentKind, "image_to_screen");
  assert.equal(envelope.executionPolicy.canHandoffToLocalAgent, false);
  assert.equal(envelope.executionPolicy.allowDirectApply, true);
});

test("inferDesignerUserIntentKind exposes goal-level image workflow intents", () => {
  assert.equal(
    inferDesignerUserIntentKind("선택한 이미지를 분석해서 화면으로 구현해줘"),
    "image_to_screen"
  );
  assert.equal(
    inferDesignerUserIntentKind("이미지 분석만 하고 구현은 하지마"),
    "image_analysis_only"
  );
  assert.equal(
    inferDesignerUserIntentKind("선택한 이미지를 분석하고 품질 진단만 해줘"),
    "image_analysis_only"
  );
  assert.equal(
    inferDesignerUserIntentKind("참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘"),
    "compare_reference_and_generated"
  );
  assert.equal(
    inferDesignerUserIntentKind("기존 생성 화면 품질을 개선해줘"),
    "improve_generated_screen"
  );
  assert.equal(
    inferDesignerUserIntentKind("이미지 분석 화면 구성 실패 원인을 분석해줘"),
    "debug_bridge_failure"
  );
  assert.equal(
    inferDesignerUserIntentKind("선택한 텍스트 문구를 바꿔줘"),
    "revise_copy"
  );
  assert.equal(
    inferDesignerUserIntentKind("디자인 시스템 기준으로 정리해줘"),
    "apply_design_system"
  );
});

test("createDesignerIntentEnvelope routes reference/generated comparison as inspection, not screen generation", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "참조 이미지와 생성한 화면을 비교해서 차이를 정리해줘",
    figmaContext: {
      pageId: "33276:16484",
      pageName: "Page 55",
      selection: [
        { id: "ref:1", name: "Reference screen", type: "FRAME" },
        { id: "gen:1", name: "Generated screen", type: "FRAME" }
      ]
    }
  });

  assert.equal(envelope.intentClassification.userIntentKind, "compare_reference_and_generated");
  assert.equal(envelope.intentClassification.internalIntentKind, "inspect_selection");
  assert.equal(envelope.intents[0].kind, "inspect_selection");
  assert.equal(envelope.readPlan.intentKind, "inspect_selection");
  assert.equal(
    envelope.readPlan.commands.includes("snapshot_selection"),
    false,
    "compare routes should avoid generation-only snapshot reads"
  );
});

test("createDesignerIntentEnvelope detects selected screenshots for short implementation phrasing", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "이거 그대로 구현해줘",
    figmaContext: {
      pageId: "33276:16484",
      pageName: "Page 55",
      selection: [{ id: "55:10", name: "npay_asset_08_reconstruction", type: "RECTANGLE" }]
    }
  });

  assert.equal(envelope.mode, "suggest_then_apply");
  assert.equal(envelope.contextScope.hasImageSelection, true);
  assert.equal(envelope.intents[0].kind, "generate_screen");
  assert.equal(envelope.readPlan.intentKind, "generate_screen");
  assert.equal(envelope.executionPolicy.canHandoffToLocalAgent, false);
});

test("inferIntentKindFromPrompt detects inspect requests", () => {
  assert.equal(inferIntentKindFromPrompt("선택한 프레임 확인해줘"), "inspect_selection");
  assert.equal(inferIntentKindFromPrompt("선택한 프레임에 대한 정보를 알려줘"), "inspect_selection");
  assert.equal(inferIntentKindFromPrompt("선택한 인스턴스 속성 정리해줘"), "inspect_selection");
});

test("inferIntentKindFromPrompt detects file variable JSON export requests", () => {
  assert.equal(
    inferIntentKindFromPrompt("이 파일의 변수를 json으로 내보내줘"),
    "export_design_tokens"
  );
  assert.equal(
    inferIntentKindFromPrompt("전체 local variables를 resolved value 포함 JSON으로 export해줘"),
    "export_design_tokens"
  );
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
