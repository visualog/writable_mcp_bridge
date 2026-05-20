import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCodexInspectSuggestionBundle,
  runCodexDesignerSuggestion,
  runCodexTextRewritePreview,
  runCodexVariantUpdatePreview,
  shouldUseCodexCliForInspect,
  shouldUseCodexCliForWrite
} from "../src/codex-cli-runner.js";

test("buildCodexInspectSuggestionBundle promotes Codex inspect output into structured bundle fields", () => {
  const bundle = buildCodexInspectSuggestionBundle(
    {
      intentKind: "inspect_selection",
      summaryText: "기존 요약",
      findings: [{ id: "base-finding", label: "기존 finding", detail: "기존 detail" }],
      recommendations: [{ id: "base-rec", title: "기존 추천", actionType: "analysis_only" }],
      risks: [{ id: "risk-1", label: "evidence gap" }]
    },
    {
      intent: "inspect_selection",
      summary: "선택한 인스턴스의 variant와 override를 확인했습니다.",
      details: ["원본 컴포넌트는 Button / Primary 입니다.", "현재 variant 값은 Size=Large 입니다."],
      followUp: "현재 variant와 override 차이를 먼저 기록하기"
    }
  );

  assert.equal(bundle.summaryText, "선택한 인스턴스의 variant와 override를 확인했습니다.");
  assert.equal(bundle.findings[0].label, "선택한 인스턴스의 variant와 override를 확인했습니다.");
  assert.equal(bundle.findings[0].detail.includes("원본 컴포넌트는 Button / Primary 입니다."), true);
  assert.equal(bundle.findings[1].id, "base-finding");
  assert.equal(bundle.recommendations[0].title, "현재 variant와 override 차이를 먼저 기록하기");
  assert.equal(bundle.recommendations[1].id, "base-rec");
  assert.deepEqual(bundle.codex.inspect.details, [
    "원본 컴포넌트는 Button / Primary 입니다.",
    "현재 variant 값은 Size=Large 입니다."
  ]);
  assert.equal(bundle.codex.inspect.followUp, "현재 variant와 override 차이를 먼저 기록하기");
});

test("buildCodexInspectSuggestionBundle preserves base recommendations when follow-up is absent", () => {
  const bundle = buildCodexInspectSuggestionBundle(
    {
      intentKind: "inspect_selection",
      recommendations: [{ id: "base-rec", title: "기존 추천", actionType: "analysis_only" }]
    },
    {
      summary: "선택 구조 설명을 정리했습니다.",
      details: ["override는 감지되지 않았습니다."],
      followUp: ""
    }
  );

  assert.equal(bundle.recommendations.length, 1);
  assert.equal(bundle.recommendations[0].id, "base-rec");
  assert.equal(bundle.codex.inspect.followUp, null);
});

test("shouldUseCodexCliForInspect respects explicit env flag", async () => {
  await assert.doesNotReject(async () => {
    const enabled = await shouldUseCodexCliForInspect({
      XBRIDGE_CODEX_CLI_ENABLED: "true"
    });
    assert.equal(enabled, true);
  });
});

test("shouldUseCodexCliForWrite respects explicit env flag", async () => {
  await assert.doesNotReject(async () => {
    const enabled = await shouldUseCodexCliForWrite({
      XBRIDGE_CODEX_CLI_WRITE_ENABLED: "true"
    });
    assert.equal(enabled, true);
  });
});

test("runCodexTextRewritePreview validates structured write_plan output", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-text-rewrite.mjs", import.meta.url);
  const result = await runCodexTextRewritePreview(
    {
      message: "선택한 텍스트를 더 짧게 바꿔줘",
      figmaContext: { fileName: "Demo", pageName: "Landing" },
      textNodes: [
        { id: "20:1", name: "title", characters: "Original title" },
        { id: "20:2", name: "body", characters: "Original body" }
      ]
    },
    {
      bin: script,
      entrypoint: entrypoint.pathname,
      env: {
        XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
      }
    }
  );

  assert.equal(result.provider, "codex_cli");
  assert.equal(result.model, "gpt-test");
  assert.equal(result.reply, "선택 텍스트 초안을 만들었습니다.");
  assert.deepEqual(result.updates, [
    { id: "20:1", text: "짧은 제목" },
    { id: "20:2", text: "짧은 본문" }
  ]);
});

test("runCodexVariantUpdatePreview validates structured variant write_plan output", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-variant-update.mjs", import.meta.url);
  const result = await runCodexVariantUpdatePreview(
    {
      message: "현재 variant를 더 compact하게 바꿔줘",
      figmaContext: { fileName: "Demo", pageName: "Components" },
      variantDetail: {
        targetNode: {
          id: "30:1",
          name: "Button/Size=Large,State=Default",
          variantProperties: { Size: "Large", State: "Default" }
        },
        componentSet: {
          id: "30:0",
          name: "Button"
        }
      }
    },
    {
      bin: script,
      entrypoint: entrypoint.pathname,
      env: {
        XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
      }
    }
  );

  assert.equal(result.provider, "codex_cli");
  assert.equal(result.model, "gpt-test");
  assert.equal(result.reply, "현재 variant를 compact 목적에 맞게 조정했습니다.");
  assert.equal(result.componentNodeId, "30:1");
  assert.deepEqual(result.variantProperties, {
    Size: "Medium",
    State: "Default"
  });
});

test("runCodexDesignerSuggestion validates structured read-summary output", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-designer-suggestion.mjs", import.meta.url);
  const result = await runCodexDesignerSuggestion(
    {
      request: "선택한 버튼을 디자인 시스템 기준으로 리뷰해줘",
      intentKind: "align_to_design_system",
      contextModel: {
        meta: { fileName: "Demo", pageName: "Components" },
        target: { type: "current_selection", label: "Button" }
      },
      suggestionBundle: {
        summaryText: "기본 읽기 결과",
        findings: [{ label: "기존 finding", detail: "기존 detail" }],
        recommendations: [{ title: "기존 추천" }]
      }
    },
    {
      bin: script,
      entrypoint: entrypoint.pathname,
      env: {
        XBRIDGE_CODEX_CLI_MODEL: "gpt-test"
      }
    }
  );

  assert.equal(result.provider, "codex_cli");
  assert.equal(result.model, "gpt-test");
  assert.equal(result.reply, "현재 선택을 기준으로 구조와 시스템 정합성을 요약했습니다.");
  assert.deepEqual(result.findings, [
    "선택 대상은 인스턴스이며 source component 연결이 유지되고 있습니다.",
    "토큰/라이브러리 기준 비교는 추가 조회가 필요합니다."
  ]);
  assert.deepEqual(result.recommendations, [
    "기준 variant와 현재 override 차이를 먼저 기록하세요.",
    "토큰 정의를 읽어 spacing과 typography를 대조하세요."
  ]);
});
