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
    summary: "문구는 반영했지만 roleMap bbox와 다른 위치에 배치했습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "title", role: "screen-title", label: "Running Challenge", bbox: { x: 24, y: 44, width: 342, height: 44 } },
      { id: "metric", role: "statistic-card", label: "2.4 km", bbox: { x: 24, y: 116, width: 120, height: 48 } },
      { id: "progress", role: "progress-bar", label: "65%", bbox: { x: 24, y: 188, width: 342, height: 16 } },
      { id: "action", role: "button", label: "Start Run", bbox: { x: 24, y: 720, width: 342, height: 52 } }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "BBox misaligned screen",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", name: "Title", characters: "Running Challenge", x: 24, y: 300, width: 220, height: 24 },
        { helper: "text", name: "Distance metric", characters: "2.4 km", x: 24, y: 360, width: 120, height: 36 },
        { helper: "progress-bar", name: "Challenge progress", label: "65%", progress: 0.65, x: 24, y: 420, width: 342, height: 16 },
        { helper: "status-chip", name: "Primary action", label: "Start Run", x: 24, y: 480, width: 342, height: 52 }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
