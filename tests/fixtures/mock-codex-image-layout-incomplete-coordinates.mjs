#!/usr/bin/env node
import { writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const imageIndex = args.indexOf("--image");

if (outputIndex === -1 || !args[outputIndex + 1]) {
  console.error("missing output path");
  process.exit(1);
}

if (imageIndex === -1 || !args[imageIndex + 1]) {
  console.error("missing image attachment");
  process.exit(1);
}

const roleMap = [
  { id: "title", role: "screen-title", label: "Running Challenge" },
  { id: "metric", role: "statistic-card", label: "2.4 km" },
  { id: "progress", role: "progress-bar", label: "65%" },
  { id: "action", role: "button", label: "Start Run" }
];

writeFileSync(
  args[outputIndex + 1],
  JSON.stringify({
    summary: "x 좌표만 있고 y 좌표가 빠진 화면입니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify(roleMap),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Generated from image",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", name: "Title", characters: "Running Challenge", x: 24, width: 220, height: 24 },
        { helper: "text", name: "Metric", characters: "2.4 km", x: 24, width: 120, height: 36 },
        { helper: "progress-bar", name: "Progress", label: "65%", progress: 0.65, x: 24, width: 342, height: 16 },
        { helper: "status-chip", name: "Action", label: "Start Run", x: 24, width: 342, height: 52 }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
