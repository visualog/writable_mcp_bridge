#!/usr/bin/env node
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");

if (outputIndex === -1 || !args[outputIndex + 1]) {
  console.error("missing output path");
  process.exit(1);
}

writeFileSync(
  args[outputIndex + 1],
  JSON.stringify({
    summary: "role별 구현 힌트를 포함한 화면 구조입니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      {
        id: "coupon",
        role: "coupon_row",
        label: "이벤트 쿠폰 적금 알아보기",
        styleIntent: "outlined",
        bbox: { x: 24, y: 280, width: 342, height: 48 },
        visualStyle: {
          fill: "#FFFFFF",
          stroke: "#E5E5E5",
          radius: 8,
          textAlign: "left"
        },
        implementation: {
          helper: "row",
          layout: "row",
          children: ["icon", "text", "chevron"]
        }
      },
      {
        id: "toggle",
        role: "toggle_on",
        label: "ON",
        styleIntent: "interactive_control",
        bbox: { x: 320, y: 356, width: 46, height: 26 },
        visualStyle: {
          fill: "#15C064",
          radius: 13
        },
        implementation: {
          helper: "toggle",
          layout: "none",
          children: ["track", "knob", "text"]
        }
      },
      {
        id: "button",
        role: "outlined_button",
        label: "내 자산 연결 해제",
        styleIntent: "outlined",
        bbox: { x: 24, y: 524, width: 342, height: 44 },
        visualStyle: {
          fill: "#FFFFFF",
          stroke: "#E5E5E5",
          radius: 6,
          textAlign: "center"
        },
        implementation: {
          helper: "button",
          layout: "none",
          children: ["text"]
        }
      },
      {
        id: "separator",
        role: "section_separator",
        label: "",
        styleIntent: "separator",
        bbox: { x: 0, y: 336, width: 390, height: 12 },
        visualStyle: {
          fill: "#F5F6F8"
        },
        implementation: {
          helper: "divider",
          layout: "none",
          children: []
        }
      }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Role implementation hints screen",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", name: "Title", characters: "생활통장", x: 24, y: 96, width: 100, height: 28 },
        { helper: "text", name: "Balance", characters: "케이뱅크 100", x: 24, y: 128, width: 100, height: 20 },
        { helper: "status-chip", name: "Coupon row", label: "이벤트 쿠폰 적금 알아보기", x: 24, y: 280, width: 342, height: 48, fill: "#FFFFFF", stroke: "#E5E5E5" },
        { helper: "status-chip", name: "Toggle", label: "ON", x: 320, y: 356, width: 46, height: 26, fill: "#15C064" },
        { helper: "status-chip", name: "Disconnect", label: "내 자산 연결 해제", x: 24, y: 524, width: 342, height: 44, fill: "#FFFFFF", stroke: "#E5E5E5" }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
