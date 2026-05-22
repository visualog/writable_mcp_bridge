import test from "node:test";
import assert from "node:assert/strict";

import {
  IMAGE_LAYOUT_SCHEMA,
  buildCodexInspectSuggestionBundle,
  coerceImageLayoutTree,
  runCodexDesignerSuggestion,
  runCodexImageLayoutPlan,
  runCodexTextRewritePreview,
  runCodexVariantUpdatePreview,
  shouldUseCodexCliForInspect,
  shouldUseCodexCliForWrite
} from "../src/codex-cli-runner.js";

function collectObjectSchemas(schema, seen = new Set()) {
  if (!schema || typeof schema !== "object" || seen.has(schema)) {
    return [];
  }
  seen.add(schema);
  const result = schema.type === "object" ? [schema] : [];
  for (const value of Object.values(schema)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        result.push(...collectObjectSchemas(item, seen));
      }
    } else if (value && typeof value === "object") {
      result.push(...collectObjectSchemas(value, seen));
    }
  }
  return result;
}

test("image layout schema is strict for Codex structured output", () => {
  const objectSchemas = collectObjectSchemas(IMAGE_LAYOUT_SCHEMA);

  assert.equal(objectSchemas.length > 0, true);
  for (const objectSchema of objectSchemas) {
    assert.equal(objectSchema.additionalProperties, false);
    assert.deepEqual(
      objectSchema.required.sort(),
      Object.keys(objectSchema.properties || {}).sort()
    );
  }
  assert.deepEqual(IMAGE_LAYOUT_SCHEMA.required, [
    "canvasSpecJson",
    "layoutMapJson",
    "roleMapJson",
    "summary",
    "textStyleMapJson",
    "treeJson"
  ]);
  assert.equal(IMAGE_LAYOUT_SCHEMA.properties.canvasSpecJson.type, "string");
  assert.equal(IMAGE_LAYOUT_SCHEMA.properties.layoutMapJson.type, "string");
  assert.equal(IMAGE_LAYOUT_SCHEMA.properties.roleMapJson.type, "string");
  assert.equal(IMAGE_LAYOUT_SCHEMA.properties.textStyleMapJson.type, "string");
  assert.equal(IMAGE_LAYOUT_SCHEMA.properties.treeJson.type, "string");
});

test("coerceImageLayoutTree converts descriptive image plans into build_layout children", () => {
  const tree = coerceImageLayoutTree({
    helper: "screen",
    name: "Running Challenge Mobile",
    sections: [
      {
        title: "Running Challenge",
        subtitle: "Weekend Warriors",
        items: [
          { label: "Distance", value: "24.7 km" },
          { label: "Results", rows: ["Mon 312 pts", "Sam 318 pts"] }
        ]
      }
    ]
  });

  assert.equal(tree.helper, "screen");
  assert.equal(tree.width, 390);
  assert.equal(tree.height, 844);
  assert.equal(tree.layout, "none");
  assert.deepEqual(tree.padding, { x: 16, y: 0 });
  assert.equal(tree.children[0].widthMode, "fill");
  assert.equal(tree.children[0].children[2].widthMode, "fill");
  assert.equal(tree.children[0].children[0].characters, "Running Challenge");
  assert.equal(tree.children[0].children[1].characters, "Weekend Warriors");
  assert.equal(tree.children[0].children[2].children[0].characters, "Distance");
  assert.equal(tree.children[0].children[2].children[1].characters, "24.7 km");
  assert.equal(tree.children[0].children[3].children[1].characters, "Mon 312 pts");
  assert.equal(tree.children[0].children[3].children[2].characters, "Sam 318 pts");
});

test("coerceImageLayoutTree preserves coordinate-based screenshot plans", () => {
  const tree = coerceImageLayoutTree({
    helper: "screen",
    width: 390,
    height: 844,
    children: [
      {
        type: "circle",
        name: "runner-avatar",
        x: 104,
        y: 182,
        width: 48,
        fill: "#2E2F36"
      },
      {
        helper: "text",
        name: "title",
        text: "Running Challenge",
        x: 136,
        y: 48,
        fontSize: 13,
        color: "#111111"
      }
    ]
  });

  assert.equal(tree.layout, "none");
  assert.equal(tree.children[0].helper, "card");
  assert.equal(tree.children[0].x, 104);
  assert.equal(tree.children[0].y, 182);
  assert.equal(tree.children[0].widthMode, "fixed");
  assert.equal(tree.children[0].radius, 24);
  assert.equal(tree.children[1].helper, "text");
  assert.equal(tree.children[1].characters, "Running Challenge");
  assert.equal(tree.children[1].x, 136);
  assert.equal(tree.children[1].fill, "#111111");
});

test("coerceImageLayoutTree constrains freeform children inside the screen", () => {
  const tree = coerceImageLayoutTree({
    helper: "screen",
    width: 390,
    height: 844,
    children: [
      {
        helper: "row",
        x: 302,
        y: 18,
        width: 358,
        height: 12,
        children: ["●", "●", "▰"]
      },
      {
        helper: "card",
        x: -20,
        y: 820,
        width: 440,
        height: 80
      }
    ]
  });

  assert.equal(tree.children[0].x, 302);
  assert.equal(tree.children[0].width, 88);
  assert.equal(tree.children[0].widthMode, "fixed");
  assert.equal(tree.children[1].x, 0);
  assert.equal(tree.children[1].y, 820);
  assert.equal(tree.children[1].width, 390);
  assert.equal(tree.children[1].height, 24);
});

test("coerceImageLayoutTree keeps hero artwork as clipped freeform frames", () => {
  const tree = coerceImageLayoutTree({
    helper: "screen",
    children: [
      {
        helper: "card",
        name: "hero artwork",
        x: 24,
        y: 132,
        width: 342,
        height: 176,
        children: [
          { helper: "card", name: "avatar", x: 88, y: 48, width: 56, height: 56 },
          { helper: "text", characters: "✦", x: 260, y: 42 }
        ]
      }
    ]
  });

  const hero = tree.children[0];
  assert.equal(hero.layout, "none");
  assert.equal(hero.clipsContent, true);
  assert.equal(hero.padding, 0);
  assert.equal(hero.gap, 0);
  assert.equal(hero.children[0].x, 88);
});

test("coerceImageLayoutTree maps semantic UI roles and SF Symbols", () => {
  const tree = coerceImageLayoutTree({
    helper: "screen",
    children: [
      { type: "chip", label: "Weekend Warriors", x: 24, y: 88 },
      { type: "progress", value: 70, x: 24, y: 520, width: 300 },
      { type: "icon", sfSymbol: "chevron.right", x: 340, y: 780 },
      { type: "list-row", title: "Sam", trailing: "312 pts", x: 24, y: 560 }
    ]
  });

  assert.equal(tree.children[0].helper, "status-chip");
  assert.equal(tree.children[0].label, "Weekend Warriors");
  assert.equal(tree.children[1].helper, "progress-bar");
  assert.equal(tree.children[2].helper, "text");
  assert.equal(tree.children[2].characters, "›");
  assert.equal(tree.children[2].fontFamily, "SF Pro");
  assert.equal(tree.children[2].fontStyle, "Regular");
  assert.equal(tree.children[3].helper, "list-item");
});

test("coerceImageLayoutTree preserves actual SF Symbols glyph text", () => {
  const tree = coerceImageLayoutTree({
    helper: "screen",
    children: [
      {
        type: "icon",
        sfSymbol: "flame.fill",
        sfSymbolCharacter: "􀙬",
        x: 24,
        y: 92,
        fontSize: 14
      }
    ]
  });

  assert.equal(tree.children[0].helper, "text");
  assert.equal(tree.children[0].characters, "􀙬");
  assert.equal(tree.children[0].fontFamily, "SF Pro");
  assert.equal(tree.children[0].fontStyle, "Regular");
});

test("coerceImageLayoutTree does not invent Status placeholder labels", () => {
  const tree = coerceImageLayoutTree({
    helper: "screen",
    children: [
      { type: "status-bar", x: 24, y: 16, children: [{ type: "icon", sfSymbol: "wifi" }] },
      { helper: "status-chip", x: 24, y: 88 }
    ]
  });

  assert.equal(tree.children[0].helper, "row");
  assert.equal(tree.children[0].children[0].helper, "text");
  assert.equal(tree.children[1].helper, "row");
  assert.equal(
    JSON.stringify(tree).includes("Status"),
    false
  );
});

test("coerceImageLayoutTree removes placeholder text unless role map observed it", () => {
  const tree = coerceImageLayoutTree(
    {
      helper: "screen",
      children: [
        { helper: "text", characters: "Status", x: 12, y: 12 },
        { helper: "text", characters: "Running Challenge", x: 80, y: 48 },
        { helper: "status-chip", label: "Button", x: 24, y: 88 }
      ]
    },
    [{ id: "title", role: "header-nav", label: "Running Challenge" }]
  );

  assert.equal(JSON.stringify(tree).includes("Status"), false);
  assert.equal(JSON.stringify(tree).includes("Button"), false);
  assert.equal(JSON.stringify(tree).includes("Running Challenge"), true);
});

test("coerceImageLayoutTree applies generic mobile canvas, grid, square, and type rules", () => {
  const tree = coerceImageLayoutTree(
    {
      helper: "screen",
      name: "Captured app screen",
      children: [
        {
          helper: "card",
          name: "avatar image",
          x: 23,
          y: 101,
          width: 45,
          height: 38
        },
        {
          helper: "divider",
          name: "hairline",
          x: 16,
          y: 150,
          width: 341,
          height: 1
        },
        {
          helper: "text",
          name: "nav-title",
          characters: "Settings",
          role: "nav-title",
          x: 121,
          y: 47
        }
      ]
    },
    {
      canvasSpec: {
        surfaceType: "mobile-app",
        width: 393,
        height: 852,
        margin: { x: 24 },
        columns: 4,
        gutter: 16
      },
      textStyleMap: [
        {
          id: "nav",
          targetName: "nav-title",
          role: "nav-title",
          fontSize: 13,
          fontStyle: "Semi Bold",
          lineHeight: 18
        }
      ]
    }
  );

  assert.equal(tree.width, 392);
  assert.equal(tree.height, 852);
  assert.deepEqual(tree.canvasGrid, {
    gridUnit: 4,
    margin: { x: 24, y: 0 },
    columns: 4,
    gutter: 16
  });
  assert.equal(tree.children[0].x, 24);
  assert.equal(tree.children[0].y, 100);
  assert.equal(tree.children[0].width, 44);
  assert.equal(tree.children[0].height, 44);
  assert.equal(tree.children[0].radius, 22);
  assert.equal(tree.children[1].width, 340);
  assert.equal(tree.children[1].height, 1);
  assert.equal(tree.children[2].fontSize, 12);
  assert.equal(tree.children[2].fontStyle, "Semi Bold");
  assert.equal(tree.children[2].lineHeight, 20);
});

test("coerceImageLayoutTree applies generic desktop web canvas grid defaults", () => {
  const tree = coerceImageLayoutTree(
    {
      helper: "screen",
      name: "Web dashboard",
      children: []
    },
    {
      canvasSpec: {
        surfaceType: "web-desktop"
      }
    }
  );

  assert.equal(tree.width, 1440);
  assert.equal(tree.height, 1024);
  assert.deepEqual(tree.canvasGrid, {
    gridUnit: 4,
    margin: { x: 80, y: 0 },
    columns: 12,
    gutter: 24
  });
});

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

test("runCodexImageLayoutPlan passes image attachments and validates layout output", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout.mjs", import.meta.url);
  const result = await runCodexImageLayoutPlan(
    {
      request: "이미지를 확인하고 화면을 만들어줘",
      figmaContext: { fileName: "Demo", pageName: "Screens" },
      imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
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
  assert.equal(result.summary, "이미지 구조를 기반으로 모바일 화면 레이아웃을 만들었습니다.");
  assert.equal(result.roleMap[0].role, "header-nav");
  assert.equal(result.roleMap[0].label, "Running Challenge");
  assert.equal(result.tree.helper, "screen");
  assert.equal(result.tree.children[0].characters, "Running Challenge");
});
