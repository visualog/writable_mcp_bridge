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
    summary: "아바타 이름을 시각 요소로 처리한 Running Challenge 화면입니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 402,
      height: 870,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "status", role: "system_status_bar", label: "9:41", bbox: { x: 24, y: 14, width: 48, height: 18 } },
      { id: "title", role: "header_nav", label: "Running Challenge", bbox: { x: 116, y: 50, width: 174, height: 24 } },
      { id: "avatar", role: "runner_avatar_photo", label: "Amanda Rodriguez", textLabels: ["Amanda Rodriguez"], bbox: { x: 150, y: 128, width: 56, height: 56 } },
      { id: "stats", role: "results_table", textLabels: ["Results", "Me"], bbox: { x: 24, y: 322, width: 354, height: 72 } }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Running Challenge avatar visual-only screen",
      width: 402,
      height: 870,
      layout: "none",
      children: [
        { helper: "text", name: "status-time", characters: "9:41", x: 28, y: 14, width: 44, height: 16 },
        { helper: "text", name: "title", characters: "Running Challenge", x: 116, y: 50, width: 174, height: 24 },
        { helper: "card", name: "Amanda Rodriguez avatar", role: "runner_avatar_photo", x: 150, y: 128, width: 56, height: 56, radius: 28, fill: "#D4D4D4" },
        { helper: "text", name: "stats-title", characters: "Results", x: 36, y: 326, width: 72, height: 18 },
        { helper: "text", name: "table-me", characters: "Me", x: 176, y: 326, width: 44, height: 18 }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
