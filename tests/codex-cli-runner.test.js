import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";

import {
  DEFAULT_IMAGE_LAYOUT_TIMEOUT_MS,
  IMAGE_LAYOUT_SCHEMA,
  buildCodexInspectSuggestionBundle,
  coerceImageLayoutTree,
  runCodexDesignerSuggestion,
  runCodexImageLayoutPlan,
  runCodexTextRewritePreview,
  runCodexVariantUpdatePreview,
  validateGeneratedImageBuildQuality,
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

test("image layout planner default timeout allows slower visual analysis", () => {
  assert.equal(DEFAULT_IMAGE_LAYOUT_TIMEOUT_MS, 240000);
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

test("coerceImageLayoutTree applies role implementation hints for outlined rows and toggles", () => {
  const tree = coerceImageLayoutTree(
    {
      helper: "screen",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "status-chip", name: "Coupon", label: "이벤트 쿠폰 적금 알아보기", x: 24, y: 280, width: 132, height: 24, fill: "#F3F4F7" },
        { helper: "status-chip", name: "Toggle", label: "ON", x: 320, y: 356, width: 32, height: 20 },
        { helper: "status-chip", name: "Disconnect", label: "내 자산 연결 해제", x: 24, y: 524, width: 132, height: 24, fill: "#F3F4F7" }
      ]
    },
    {
      canvasSpec: { surfaceType: "mobile-app", width: 390, height: 844, gridUnit: 4 },
      roleMap: [
        {
          role: "coupon_row",
          label: "이벤트 쿠폰 적금 알아보기",
          styleIntent: "outlined",
          bbox: { x: 24, y: 280, width: 342, height: 48 },
          visualStyle: { fill: "#FFFFFF", stroke: "#E5E5E5", radius: 8 },
          implementation: { helper: "row", layout: "row", children: ["icon", "text", "chevron"] }
        },
        {
          role: "toggle_on",
          label: "ON",
          styleIntent: "interactive_control",
          bbox: { x: 320, y: 356, width: 46, height: 26 },
          visualStyle: { fill: "#15C064", radius: 13 },
          implementation: { helper: "toggle", layout: "none", children: ["track", "knob", "text"] }
        },
        {
          role: "outlined_button",
          label: "내 자산 연결 해제",
          styleIntent: "outlined",
          bbox: { x: 24, y: 524, width: 342, height: 44 },
          visualStyle: { fill: "#FFFFFF", stroke: "#E5E5E5", radius: 6 },
          implementation: { helper: "button", layout: "none", children: ["text"] }
        }
      ]
    }
  );

  const coupon = tree.children.find((child) => child.role === "coupon_row");
  assert.equal(coupon.helper, "row");
  assert.equal(coupon.width, 344);
  assert.equal(coupon.height, 48);
  assert.equal(coupon.fill, "#FFFFFF");
  assert.equal(coupon.stroke, "#E5E5E5");
  assert.equal(coupon.children.some((child) => child.role === "leading-icon"), true);
  assert.equal(coupon.children.some((child) => child.role === "trailing-chevron"), true);

  const toggle = tree.children.find((child) => child.role === "toggle_on");
  assert.equal(toggle.helper, "card");
  assert.equal(toggle.width, 48);
  assert.equal(toggle.height, 28);
  assert.equal(toggle.fill, "#15C064");
  assert.equal(toggle.children.some((child) => child.role === "toggle-knob"), true);

  const button = tree.children.find((child) => child.role === "outlined_button");
  assert.equal(button.helper, "status-chip");
  assert.equal(button.width, 344);
  assert.equal(button.height, 44);
  assert.equal(button.fill, "#FFFFFF");
  assert.equal(button.stroke, "#E5E5E5");
});

test("coerceImageLayoutTree expands narrow text and component nodes from roleMap bbox", () => {
  const tree = coerceImageLayoutTree(
    {
      helper: "screen",
      width: 392,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", characters: "Newsletter Victory", x: 96, y: 48, width: 28, height: 24 },
        { helper: "row", role: "message-row", label: "Write your message...", x: 16, y: 720, width: 80, height: 20 }
      ]
    },
    {
      roleMap: [
        {
          role: "header-title",
          label: "Newsletter Victory",
          bbox: { x: 96, y: 48, width: 190, height: 24 }
        },
        {
          role: "message-row",
          label: "Write your message...",
          bbox: { x: 16, y: 720, width: 358, height: 44 }
        }
      ]
    }
  );

  const title = tree.children.find((child) => child.characters === "Newsletter Victory");
  const message = tree.children.find((child) => child.role === "message-row");

  assert.equal(title.x, 96);
  assert.equal(title.y, 48);
  assert.equal(title.width, 190);
  assert.equal(title.height, 24);
  assert.equal(message.x, 16);
  assert.equal(message.y, 720);
  assert.equal(message.width, 358);
  assert.equal(message.height, 44);
});

test("coerceImageLayoutTree does not apply role hints to blank earlier nodes", () => {
  const tree = coerceImageLayoutTree(
    {
      helper: "screen",
      name: "Running Challenge screen",
      width: 392,
      height: 844,
      children: [
        {
          helper: "row",
          name: "iOS status bar",
          x: 0,
          y: 0,
          width: 392,
          height: 44,
          children: []
        },
        {
          helper: "row",
          name: "Winner reward coupon",
          x: 24,
          y: 584,
          width: 344,
          height: 36,
          children: [
            {
              helper: "text",
              name: "Coupon text",
              characters: "Winner gets 50 tickets + Champion Badge",
              x: 36,
              y: 12,
              width: 260,
              height: 16
            }
          ]
        }
      ]
    },
    {
      roleMap: [
        {
          role: "coupon_row",
          label: "Winner reward coupon",
          textLabels: ["Winner gets 50 tickets + Champion Badge"],
          bbox: { x: 24, y: 584, width: 344, height: 36 },
          visualStyle: { fill: "#FFFFFF", stroke: "#F2D88C", radius: 18 },
          implementation: { helper: "row", layout: "fixed" }
        }
      ]
    }
  );

  const statusBar = tree.children.find((child) => child.name === "iOS status bar");
  const coupon = tree.children.find((child) => child.name === "Winner reward coupon");

  assert.equal(statusBar.role, undefined);
  assert.equal(statusBar.y, 0);
  assert.deepEqual(statusBar.children, []);
  assert.equal(coupon.role, "coupon_row");
  assert.equal(coupon.y, 584);
  assert.equal(coupon.children.some((child) => child.role === "leading-icon"), true);
  assert.equal(coupon.children.some((child) => child.role === "trailing-chevron"), true);
});

test("coerceImageLayoutTree does not turn visual shape names into visible text", () => {
  const tree = coerceImageLayoutTree({
    helper: "screen",
    name: "Running Challenge screen",
    children: [
      {
        helper: "card",
        name: "Signal bar 1",
        x: 320,
        y: 16,
        width: 4,
        height: 8,
        fill: "#111111"
      },
      {
        helper: "card",
        name: "Hero bottom shade",
        x: 24,
        y: 260,
        width: 344,
        height: 48,
        fill: "#F75D24"
      }
    ]
  });

  const signal = tree.children.find((child) => child.name === "Signal bar 1");
  const shade = tree.children.find((child) => child.name === "Hero bottom shade");

  assert.deepEqual(signal.children, []);
  assert.deepEqual(shade.children, []);
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

test("runCodexDesignerSuggestion passes pipeline payload and preservation policy", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-designer-suggestion-pipeline.mjs", import.meta.url);
  const result = await runCodexDesignerSuggestion(
    {
      request: "선택한 화면을 리뷰해줘",
      intentKind: "improve_hierarchy",
      contextModel: {
        meta: { fileName: "Demo", pageName: "Screens" },
        target: { type: "current_selection", label: "Dashboard" }
      },
      suggestionBundle: {
        summaryText: "UX/UI 리뷰 결과",
        buddyAuditReport: "UX/UI 리뷰 결과\n근거",
        findings: [],
        recommendations: []
      },
      pipeline: {
        read: { commands: ["get_selection", "get_metadata"], warnings: [] },
        retrieval: {
          strategy: "local_document_chunk_bm25_light",
          results: [
            {
              id: "response-display-ux",
              guidance: "Render assistant output as structured chat blocks."
            }
          ]
        },
        responsePolicy: {
          evidenceFirst: true,
          preserveDeterministicReport: true,
          separateLimitationsAtEnd: true
        }
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

  assert.equal(result.reply, "pipeline 근거를 유지한 요약입니다.");
  assert.deepEqual(result.findings, ["pipeline.read.commands와 deterministic report를 확인했습니다."]);
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
  assert.equal(result.semanticQuality.roleCount, 4);
  assert.equal(result.semanticQuality.generatedNodeCount >= result.semanticQuality.roleCount, true);
  assert.equal(result.semanticQuality.visibleRoleLabelCount, 4);
  assert.equal(result.semanticQuality.coveredRoleLabelCount, 4);
  assert.equal(result.semanticQuality.bboxRoleLabelCount, 4);
  assert.equal(result.semanticQuality.bboxAlignedRoleLabelCount, 4);
});

test("runCodexImageLayoutPlan preserves role implementation metadata from image analysis", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-role-implementation-hints.mjs", import.meta.url);

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

  const couponRole = result.roleMap.find((entry) => entry.role === "coupon_row");
  assert.equal(couponRole.styleIntent, "outlined");
  assert.deepEqual(couponRole.visualStyle, {
    fill: "#FFFFFF",
    stroke: "#E5E5E5",
    radius: 8,
    textAlign: "left"
  });
  assert.deepEqual(couponRole.implementation, {
    helper: "row",
    layout: "row",
    children: ["icon", "text", "chevron"]
  });
  const couponNode = result.tree.children.find((child) => child.role === "coupon_row");
  assert.equal(couponNode.helper, "row");
  assert.equal(couponNode.children.some((child) => child.role === "leading-icon"), true);
  assert.equal(couponNode.children.some((child) => child.role === "trailing-chevron"), true);
});

test("runCodexImageLayoutPlan instructs clipped frame viewport analysis for frame exports", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-clipped-viewport-prompt.mjs", import.meta.url);
  const result = await runCodexImageLayoutPlan(
    {
      request: "선택한 프레임 이미지를 분석해서 화면으로 구현해줘",
      figmaContext: {
        fileName: "Agent_skill_test",
        pageName: "Page 55",
        selection: [{ id: "33392:3971998", name: "Frame 2", type: "FRAME" }]
      },
      imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname],
      imageSummaries: [
        {
          name: "Frame 2",
          mimeType: "image/png",
          size: "19614",
          selectedNodeId: "33392:3971998",
          selectedNodeType: "FRAME",
          analysisScope: "clipped_frame_viewport",
          frameViewportClipped: true,
          exportScale: 0.25,
          contentsOnly: false,
          useAbsoluteBounds: false
        }
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

  assert.equal(result.summary, "클리핑된 프레임 viewport 기준으로 화면을 구성했습니다.");
  assert.equal(result.semanticQuality.coveredRoleLabelCount, 4);
});

test("runCodexImageLayoutPlan excludes visual-only analysis labels from text coverage", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-running-challenge-semantic-labels.mjs", import.meta.url);
  const result = await runCodexImageLayoutPlan(
    {
      request: "Running Challenge 화면을 구현해줘",
      figmaContext: {
        fileName: "Agent_skill_test",
        pageName: "Page 55",
        selection: [{ id: "33392:3971998", name: "Frame 2", type: "FRAME" }]
      },
      imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname],
      imageSummaries: [{ name: "Frame 2", mimeType: "image/png", analysisScope: "clipped_frame_viewport" }]
    },
    {
      bin: script,
      entrypoint: entrypoint.pathname,
      env: {
        XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
      }
    }
  );

  assert.equal(result.semanticQuality.roleCount, 7);
  assert.equal(result.semanticQuality.visualOnlyRoleCount, 2);
  assert.equal(result.semanticQuality.visualOnlyRoleLabels.includes("Competitor image collage"), true);
  assert.equal(
    result.semanticQuality.visualOnlyRoleLabels.includes("Results table: Athletes, Time, Score, Aikos, Amp, Avg"),
    true
  );
  assert.equal(result.semanticQuality.missingRoleLabels.includes("Competitor image collage"), false);
  assert.equal(
    result.semanticQuality.missingRoleLabels.includes("Results table: Athletes, Time, Score, Aikos, Amp, Avg"),
    false
  );
  assert.equal(result.semanticQuality.missingRoleLabels.includes("9:41, cellular, Wi-Fi, battery"), false);
  assert.equal(result.semanticQuality.coveredRoleLabelCount >= result.semanticQuality.requiredCoveredRoleLabelCount, true);
});

test("runCodexImageLayoutPlan accepts minor visual sanity noise in Running Challenge layouts", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-running-challenge-minor-sanity.mjs", import.meta.url);

  const result = await runCodexImageLayoutPlan(
    {
      request: "이미지를 확인하고 화면을 만들어줘",
      figmaContext: { fileName: "Demo", pageName: "Screens" },
      imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
    },
    {
      bin: script,
      entrypoint: entrypoint.pathname,
      imageQualityRetry: false,
      env: {
        XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
      }
    }
  );

  assert.equal(result.semanticQuality.roleCount, 7);
  assert.equal(result.semanticQuality.coveredRoleLabelCount, result.semanticQuality.visibleRoleLabelCount);
  assert.equal(result.semanticQuality.visualOnlyRoleLabels.includes("orange rounded card with overlapping circular participant photos and small sparkle decorations"), true);
  assert.equal(result.semanticQuality.textOverlapCount, 1);
  assert.equal(result.semanticQuality.severeTextOverlapCount, 0);
  assert.equal(result.semanticQuality.unknownShortTextCount, 0);
  assert.equal(result.semanticQuality.textWrapRiskTooHigh, false);
  assert.equal(result.semanticQuality.visualSanityTooLow, false);
  assert.equal(result.semanticQuality.outlinedStyleMismatchTooHigh, false);
  assert.equal(result.semanticQuality.outlinedStyleMismatchLabels.includes("View you 85 miles + Champion Badge"), false);
});

test("runCodexImageLayoutPlan treats avatar photo names as visual-only unless explicitly visible", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-avatar-name-visual-only.mjs", import.meta.url);

  const result = await runCodexImageLayoutPlan(
    {
      request: "이미지를 확인하고 화면을 만들어줘",
      figmaContext: { fileName: "Demo", pageName: "Screens" },
      imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
    },
    {
      bin: script,
      entrypoint: entrypoint.pathname,
      imageQualityRetry: false,
      env: {
        XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
      }
    }
  );

  assert.equal(result.semanticQuality.visualOnlyRoleLabels.includes("Amanda Rodriguez"), true);
  assert.equal(result.semanticQuality.visibleRoleLabelCount, 4);
  assert.equal(result.semanticQuality.wrapRiskRoleLabels.includes("Amanda Rodriguez"), false);
  assert.equal(result.semanticQuality.textWrapRiskTooHigh, false);
});

test("validateGeneratedImageBuildQuality rejects post-build icon fallback and helper labels", () => {
  const quality = validateGeneratedImageBuildQuality({
    roleMap: [
      { role: "status-bar", textLabels: ["9:41"], bbox: { x: 24, y: 12, width: 48, height: 16 } },
      { role: "header-title", label: "Running Challenge", bbox: { x: 120, y: 48, width: 140, height: 24 } },
      { role: "result-row", textLabels: ["Sam", "312 pts"], bbox: { x: 24, y: 520, width: 340, height: 36 } }
    ],
    semanticQuality: {
      visibleRoleLabelCount: 4,
      coveredRoleLabelCount: 4
    },
    buildResult: {
      plan: {
        root: {
          helper: "screen",
          width: 402,
          height: 870,
          children: [
            { helper: "text", characters: "9:41", x: 24, y: 12, width: 42, height: 16 },
            { helper: "text", characters: "cellularbars", x: 292, y: 12, width: 46, height: 12 },
            { helper: "text", characters: "Running Challenge", x: 120, y: 48, width: 140, height: 24 },
            { helper: "text", characters: "Sam", x: 48, y: 522, width: 80, height: 18 },
            { helper: "text", characters: "312 pts", x: 290, y: 522, width: 54, height: 18 },
            { helper: "text", characters: "0%", x: 180, y: 562, width: 24, height: 12 }
          ]
        }
      }
    }
  });

  assert.equal(quality.ok, false);
  assert.equal(quality.postBuildQualityTooLow, true);
  assert.equal(quality.iconFallbackTextCount, 1);
  assert.equal(quality.unobservedProgressLabelCount, 1);
  assert.equal(quality.unobservedVisibleTexts.includes("cellularbars"), true);
  assert.equal(quality.unobservedVisibleTexts.includes("0%"), true);
});

test("validateGeneratedImageBuildQuality rejects post-build text placed away from reference bbox", () => {
  const quality = validateGeneratedImageBuildQuality({
    roleMap: [
      { role: "header-title", label: "Running Challenge", bbox: { x: 120, y: 48, width: 140, height: 24 } },
      { role: "challenge-chip", label: "Weekend Warriors", bbox: { x: 24, y: 88, width: 148, height: 28 } },
      { role: "result-row", textLabels: ["Sam", "312 pts"], bbox: { x: 24, y: 520, width: 340, height: 36 } }
    ],
    semanticQuality: {
      visibleRoleLabelCount: 4,
      coveredRoleLabelCount: 4,
      requiredCoveredRoleLabelCount: 4,
      requiredBboxAlignedRoleLabelCount: 3
    },
    buildResult: {
      plan: {
        root: {
          helper: "screen",
          width: 402,
          height: 870,
          children: [
            { helper: "text", characters: "Running Challenge", x: 122, y: 48, width: 140, height: 24 },
            { helper: "text", characters: "Weekend Warriors", x: 24, y: 18, width: 148, height: 28 },
            { helper: "text", characters: "Sam", x: 24, y: 120, width: 80, height: 18 },
            { helper: "text", characters: "312 pts", x: 300, y: 120, width: 54, height: 18 }
          ]
        }
      }
    }
  });

  assert.equal(quality.ok, false);
  assert.equal(quality.postBuildQualityTooLow, true);
  assert.equal(quality.postBuildBboxAlignmentTooLow, true);
  assert.equal(quality.bboxRoleLabelCount, 3);
  assert.equal(quality.bboxAlignedRoleLabelCount, 1);
  assert.deepEqual(quality.bboxMisalignedRoleLabels, ["Weekend Warriors", "Sam", "312 pts"]);
});

test("validateGeneratedImageBuildQuality rejects missing non-text visual roles after build", () => {
  const quality = validateGeneratedImageBuildQuality({
    roleMap: [
      { role: "header-title", label: "Running Challenge", bbox: { x: 120, y: 48, width: 140, height: 24 } },
      { role: "result-row", textLabels: ["Sam", "312 pts"], bbox: { x: 24, y: 520, width: 340, height: 36 } },
      {
        role: "progress-bar",
        visualLabel: "orange score progress bar",
        visibleText: false,
        bbox: { x: 24, y: 610, width: 340, height: 8 }
      }
    ],
    semanticQuality: {
      visibleRoleLabelCount: 3,
      coveredRoleLabelCount: 3,
      requiredCoveredRoleLabelCount: 3
    },
    buildResult: {
      plan: {
        root: {
          helper: "screen",
          width: 402,
          height: 870,
          children: [
            { helper: "text", characters: "Running Challenge", x: 120, y: 48, width: 140, height: 24 },
            { helper: "text", characters: "Sam", x: 48, y: 522, width: 80, height: 18 },
            { helper: "text", characters: "312 pts", x: 290, y: 522, width: 54, height: 18 }
          ]
        }
      }
    }
  });

  assert.equal(quality.ok, false);
  assert.equal(quality.postBuildQualityTooLow, true);
  assert.equal(quality.postBuildVisualRoleCoverageTooLow, true);
  assert.equal(quality.requiredVisualRoleCount, 1);
  assert.equal(quality.visualRoleCoveredCount, 0);
  assert.deepEqual(quality.missingVisualRoleLabels, ["orange score progress bar"]);
});

test("validateGeneratedImageBuildQuality rejects post-build text coverage regression from semantic analysis", () => {
  const quality = validateGeneratedImageBuildQuality({
    roleMap: [
      { role: "header-title", textLabels: ["November Victory", "Berlin • 21 Oct"], bbox: { x: 96, y: 44, width: 200, height: 52 } },
      { role: "leaderboard", textLabels: ["1. Lara", "52 pts", "2. Sam", "46 pts", "3. You", "38 pts"], bbox: { x: 16, y: 456, width: 358, height: 156 } }
    ],
    semanticQuality: {
      visibleRoleLabelCount: 8,
      coveredRoleLabelCount: 8,
      requiredCoveredRoleLabelCount: 5
    },
    buildResult: {
      plan: {
        root: {
          helper: "screen",
          width: 392,
          height: 844,
          children: [
            { helper: "text", characters: "2. Sam", x: 16, y: 512, width: 88, height: 16 },
            { helper: "text", characters: "46 pts", x: 308, y: 512, width: 52, height: 16 }
          ]
        }
      }
    }
  });

  assert.equal(quality.ok, false);
  assert.equal(quality.postBuildQualityTooLow, true);
  assert.equal(quality.postBuildTextCoverageTooLow, true);
  assert.equal(quality.requiredCoveredRoleLabelCount, 8);
  assert.equal(quality.coveredRoleLabelCount, 2);
  assert.deepEqual(quality.missingRoleLabels, [
    "November Victory",
    "Berlin • 21 Oct",
    "1. Lara",
    "52 pts",
    "3. You",
    "38 pts"
  ]);
});

test("validateGeneratedImageBuildQuality passes clean post-build text coverage", () => {
  const quality = validateGeneratedImageBuildQuality({
    roleMap: [
      { role: "status-bar", textLabels: ["9:41"], bbox: { x: 24, y: 12, width: 48, height: 16 } },
      { role: "header-title", label: "Running Challenge", bbox: { x: 120, y: 48, width: 140, height: 24 } },
      { role: "result-row", textLabels: ["Sam", "312 pts"], bbox: { x: 24, y: 520, width: 340, height: 36 } }
    ],
    semanticQuality: {
      visibleRoleLabelCount: 4,
      coveredRoleLabelCount: 4
    },
    buildResult: {
      plan: {
        root: {
          helper: "screen",
          width: 402,
          height: 870,
          children: [
            { helper: "text", characters: "9:41", x: 24, y: 12, width: 42, height: 16 },
            { helper: "text", characters: "Running Challenge", x: 120, y: 48, width: 140, height: 24 },
            { helper: "text", characters: "Sam", x: 48, y: 522, width: 80, height: 18 },
            { helper: "text", characters: "312 pts", x: 290, y: 522, width: 54, height: 18 }
          ]
        }
      }
    }
  });

  assert.equal(quality.ok, true);
  assert.equal(quality.postBuildQualityTooLow, false);
  assert.equal(quality.coveredRoleLabelCount, 4);
});

test("runCodexImageLayoutPlan retries understructured image layouts with quality feedback", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "xbridge-image-layout-retry-test-"));
  try {
    const script = process.execPath;
    const entrypoint = new URL("./fixtures/mock-codex-image-layout-recovers-on-retry.mjs", import.meta.url);
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
          XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test",
          XBRIDGE_IMAGE_LAYOUT_RETRY_MARKER: path.join(tempDir, "retry-marker")
        }
      }
    );

    assert.equal(result.summary, "품질 피드백을 반영해 UI 요소를 편집 가능한 레이어로 분해했습니다.");
    assert.equal(result.qualityRetry?.attempted, true);
    assert.equal(result.qualityRetry?.attempts, 2);
    assert.equal(result.qualityRetry?.recovered, true);
    assert.equal(result.qualityRetry?.firstFailureDetails?.roleCount, 7);
    assert.equal(result.semanticQuality.roleCount, 7);
    assert.equal(result.semanticQuality.coveredRoleLabelCount, 7);
    assert.equal(result.tree.children.some((child) => child.characters === "생활통장"), true);
    assert.equal(result.tree.children.some((child) => child.label === "간편결제"), true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runCodexImageLayoutPlan retry prompt names wrap and component bbox failure labels", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "xbridge-image-layout-specific-feedback-test-"));
  try {
    const script = process.execPath;
    const entrypoint = new URL("./fixtures/mock-codex-image-layout-recovers-on-specific-feedback.mjs", import.meta.url);
    const result = await runCodexImageLayoutPlan(
      {
        request: "러닝 챌린지 이미지를 화면으로 구현해줘",
        figmaContext: { fileName: "Demo", pageName: "Screens" },
        imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
      },
      {
        bin: script,
        entrypoint: entrypoint.pathname,
        env: {
          XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test",
          XBRIDGE_IMAGE_LAYOUT_RETRY_MARKER: path.join(tempDir, "retry-marker")
        }
      }
    );

    assert.equal(result.summary, "구체 품질 피드백을 반영해 재구성했습니다.");
    assert.equal(result.qualityRetry?.recovered, true);
    assert.equal(result.qualityRetry?.firstFailureDetails?.textWrapRiskTooHigh, true);
    assert.equal(result.qualityRetry?.firstFailureDetails?.componentBBoxSizeTooLow, true);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("runCodexImageLayoutPlan rejects understructured image layouts", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-understructured.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
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
      ),
    (error) => error?.code === "codex_cli_image_layout_understructured"
  );
});

test("runCodexImageLayoutPlan ignores source-image-reference subtrees in quality checks", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-reference-mask.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.textCoverageTooLow === true &&
      error?.details?.coveredRoleLabelCount === 0 &&
      error?.details?.missingRoleLabels?.includes("이벤트 쿠폰 적금 알아보기")
  );
});

test("runCodexImageLayoutPlan rejects mobile screenshots with too few recognized roles", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-underrecognized.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.recognizedRoleCountTooLow === true
  );
});

test("runCodexImageLayoutPlan rejects mobile screenshots without enough coordinate placement", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-unpositioned.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.coordinateCoverageTooLow === true &&
      error?.details?.nodeCoverageTooLow === false
  );
});

test("runCodexImageLayoutPlan rejects mobile screenshots with incomplete x-only coordinates", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-incomplete-coordinates.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.coordinateCoverageTooLow === true &&
      error?.details?.coordinateNodeCount === 0
  );
});

test("runCodexImageLayoutPlan rejects partial text matches for longer visible labels", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-partial-labels.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.coveredRoleLabelCount === 2 &&
      error?.details?.textCoverageTooLow === true &&
      Array.isArray(error?.details?.missingRoleLabels) &&
      error.details.missingRoleLabels.includes("이벤트 쿠폰 적금 알아보기") &&
      error.details.missingRoleLabels.includes("내 자산 연결 해제")
  );
});

test("runCodexImageLayoutPlan rejects mobile screenshots with major layers stacked at the origin", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-origin-stacked.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.topOriginStackingTooHigh === true &&
      error?.details?.topOriginCoordinateNodeCount >= 3 &&
      error?.details?.coordinateCoverageTooLow === false &&
      error?.details?.textCoverageTooLow === false
  );
});

test("runCodexImageLayoutPlan rejects visible labels placed far from their roleMap bbox", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-bbox-misaligned.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.bboxAlignmentTooLow === true &&
      error?.details?.bboxRoleLabelCount === 4 &&
      error?.details?.bboxAlignedRoleLabelCount < error?.details?.requiredBboxAlignedRoleLabelCount &&
      error?.details?.coordinateCoverageTooLow === false &&
      error?.details?.textCoverageTooLow === false
  );
});

test("runCodexImageLayoutPlan rejects visible labels shifted horizontally away from roleMap bbox", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-bbox-x-misaligned.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.bboxAlignmentTooLow === true &&
      error?.details?.bboxRoleLabelCount === 4 &&
      error?.details?.bboxAlignedRoleLabelCount < error?.details?.requiredBboxAlignedRoleLabelCount &&
      error?.details?.coordinateCoverageTooLow === false &&
      error?.details?.textCoverageTooLow === false
  );
});

test("runCodexImageLayoutPlan rejects text nodes too narrow for one-line role labels", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-text-wrap-risk.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.textWrapRiskTooHigh === true &&
      error?.details?.wrapRiskRoleLabels?.includes("생활통장") &&
      error?.details?.coordinateCoverageTooLow === false &&
      error?.details?.textCoverageTooLow === false
  );
});

test("runCodexImageLayoutPlan rejects row and button components much smaller than their roleMap bbox", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-component-bbox-small.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.componentBBoxSizeTooLow === true &&
      error?.details?.componentBBoxMismatchLabels?.includes("이벤트 쿠폰 적금 알아보기") &&
      error?.details?.componentBBoxMismatchLabels?.includes("내 자산 연결 해제") &&
      error?.details?.coordinateCoverageTooLow === false &&
      error?.details?.textCoverageTooLow === false
  );
});

test("runCodexImageLayoutPlan rejects list rows that shrink far below their parent width", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-shrunken-list-rows.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.childComponentWidthTooLow === true &&
      error?.details?.shrunkenChildComponentLabels?.includes("After party row") &&
      error?.details?.componentBBoxSizeTooLow === false &&
      error?.details?.textCoverageTooLow === false
  );
});

test("runCodexImageLayoutPlan rejects outlined roles rendered as filled gray components", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-outlined-style-mismatch.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.outlinedStyleMismatchTooHigh === true &&
      error?.details?.outlinedStyleMismatchLabels?.includes("이벤트 쿠폰 적금 알아보기") &&
      error?.details?.outlinedStyleMismatchLabels?.includes("내 자산 연결 해제") &&
      error?.details?.coordinateCoverageTooLow === false &&
      error?.details?.textCoverageTooLow === false
  );
});

test("runCodexImageLayoutPlan rejects visual sanity regressions in status bar and icon fallback text", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-visual-sanity-regression.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.visualSanityTooLow === true &&
      error?.details?.statusBarUnknownTextCount >= 2 &&
      error?.details?.verticalSplitLabelCount >= 1 &&
      error?.details?.unknownShortTextCount >= 3
  );
});

test("runCodexImageLayoutPlan can return analysis-only output without enforcing build quality gates", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-visual-sanity-regression.mjs", import.meta.url);

  const result = await runCodexImageLayoutPlan(
    {
      request: "이미지를 분석만 하고 화면 구현은 하지마",
      figmaContext: { fileName: "Demo", pageName: "Screens" },
      imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
    },
    {
      bin: script,
      entrypoint: entrypoint.pathname,
      imageAnalysisOnly: true,
      env: {
        XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
      }
    }
  );

  assert.equal(result.analysisOnly, true);
  assert.equal(result.semanticQualityPassed, false);
  assert.equal(result.semanticQuality.visualSanityTooLow, true);
  assert.equal(result.roleMap.length >= 1, true);
  assert.equal(result.tree.helper, "screen");
});

test("runCodexImageLayoutPlan rejects overlapping visible text nodes", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-overlap-regression.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 만들어줘",
          figmaContext: { fileName: "Demo", pageName: "Screens" },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.visualSanityTooLow === true &&
      error?.details?.textOverlapCount >= 1 &&
      Array.isArray(error?.details?.textOverlapEntries) &&
      error.details.textOverlapEntries.some((entry) =>
        /생활통장|케이뱅크/u.test(`${entry?.left || ""} ${entry?.right || ""}`)
      )
  );
});

test("runCodexImageLayoutPlan repairs simple text overlaps from roleMap bbox before retrying Codex", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-recovers-on-bbox-overlap-repair.mjs", import.meta.url);

  const result = await runCodexImageLayoutPlan(
    {
      request: "이미지를 확인하고 화면을 만들어줘",
      figmaContext: { fileName: "Demo", pageName: "Screens" },
      imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
    },
    {
      bin: script,
      entrypoint: entrypoint.pathname,
      imageQualityRetry: false,
      env: {
        XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
      }
    }
  );

  assert.equal(result.semanticQuality.visualSanityTooLow, false);
  assert.equal(result.semanticQuality.textOverlapCount, 0);
  assert.equal(result.qualityRetry?.deterministicRepair, true);
  assert.equal(result.qualityRetry?.recovered, true);
});

test("runCodexImageLayoutPlan rejects a new candidate that regresses against prior semantic quality", async () => {
  const script = process.execPath;
  const entrypoint = new URL("./fixtures/mock-codex-image-layout-candidate-regression.mjs", import.meta.url);

  await assert.rejects(
    () =>
      runCodexImageLayoutPlan(
        {
          request: "이미지를 확인하고 화면을 다시 만들어줘",
          figmaContext: {
            fileName: "Demo",
            pageName: "Screens",
            generatedScreen: {
              semanticQuality: {
                roleCount: 4,
                coveredRoleLabelCount: 4,
                visibleRoleLabelCount: 4,
                missingRoleLabels: [],
                visualSanityIssueCount: 0
              }
            }
          },
          imagePaths: [new URL("./fixtures/detail-api-regression.json", import.meta.url).pathname]
        },
        {
          bin: script,
          entrypoint: entrypoint.pathname,
          imageQualityRetry: false,
          env: {
            XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test"
          }
        }
      ),
    (error) =>
      error?.code === "codex_cli_image_layout_understructured" &&
      error?.details?.candidateQualityRegressed === true &&
      error?.details?.baselineCoveredRoleLabelCount === 4 &&
      error?.details?.coveredRoleLabelCount === 3
  );
});

test("runCodexImageLayoutPlan retries coordinate-poor mobile layouts with coordinate feedback", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "xbridge-image-layout-coordinate-retry-test-"));
  try {
    const script = process.execPath;
    const entrypoint = new URL("./fixtures/mock-codex-image-layout-recovers-on-coordinate-retry.mjs", import.meta.url);
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
          XBRIDGE_CODEX_CLI_WRITE_MODEL: "gpt-test",
          XBRIDGE_IMAGE_LAYOUT_RETRY_MARKER: path.join(tempDir, "retry-marker")
        }
      }
    );

    assert.equal(result.summary, "좌표 품질 피드백을 반영해 화면 요소를 위치 기반 레이어로 구성했습니다.");
    assert.equal(result.qualityRetry?.recovered, true);
    assert.equal(result.qualityRetry?.firstFailureDetails?.coordinateCoverageTooLow, true);
    assert.equal(
      result.semanticQuality.coordinateNodeCount >= result.semanticQuality.requiredCoordinateNodeCount,
      true
    );
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
