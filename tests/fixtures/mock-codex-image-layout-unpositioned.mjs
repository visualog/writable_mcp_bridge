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
  { id: "header-title", role: "header-nav", label: "Running Challenge" },
  { id: "metric", role: "statistic-card", label: "2.4 km" },
  { id: "progress", role: "progress-bar", label: "65%" },
  { id: "action", role: "button", label: "Start Run" }
];

writeFileSync(
  args[outputIndex + 1],
  JSON.stringify({
    summary: "요소는 인식했지만 스크린샷 위치를 반영하지 않았습니다.",
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
      layout: "column",
      children: [
        { helper: "text", name: "Title", characters: "Running Challenge" },
        { helper: "text", name: "Metric", characters: "2.4 km" },
        { helper: "progress-bar", name: "Progress", label: "65%", progress: 0.65 },
        { helper: "status-chip", name: "Action", label: "Start Run" }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
