#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");

if (outputIndex === -1 || !args[outputIndex + 1]) {
  console.error("missing output path");
  process.exit(1);
}

const prompt = readFileSync(0, "utf8");
const markerPath =
  process.env.XBRIDGE_IMAGE_LAYOUT_RETRY_MARKER ||
  join(tmpdir(), `xbridge-image-layout-coordinate-retry-${process.ppid}.marker`);
const isRetry = existsSync(markerPath);
writeFileSync(markerPath, "1", "utf8");

const roleMap = [
  { id: "header-title", role: "header-nav", label: "Running Challenge" },
  { id: "metric", role: "statistic-card", label: "2.4 km" },
  { id: "progress", role: "progress-bar", label: "65%" },
  { id: "action", role: "button", label: "Start Run" }
];

const base = {
  canvasSpecJson: JSON.stringify({
    surfaceType: "mobile-app",
    width: 390,
    height: 844,
    gridUnit: 4
  }),
  layoutMapJson: JSON.stringify([]),
  roleMapJson: JSON.stringify(roleMap),
  textStyleMapJson: JSON.stringify([])
};

const unpositioned = {
  ...base,
  summary: "요소는 인식했지만 좌표 배치를 반영하지 않았습니다.",
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
};

const hasCoordinateRetryFeedback =
  /requiredCoordinateNodeCount|좌표 노드|coordinate node/iu.test(prompt) &&
  /coordinateCoverageTooLow|좌표 반영 부족/iu.test(prompt);

const positioned = {
  ...base,
  summary: "좌표 품질 피드백을 반영해 화면 요소를 위치 기반 레이어로 구성했습니다.",
  treeJson: JSON.stringify({
    helper: "screen",
    name: "Generated from image",
    width: 390,
    height: 844,
    layout: "none",
    children: [
      { helper: "text", name: "Title", characters: "Running Challenge", x: 24, y: 44, width: 220, height: 24 },
      { helper: "text", name: "Metric", characters: "2.4 km", x: 24, y: 116, width: 120, height: 36 },
      { helper: "progress-bar", name: "Progress", label: "65%", progress: 0.65, x: 24, y: 188, width: 342, height: 16 },
      { helper: "status-chip", name: "Action", label: "Start Run", x: 24, y: 720, width: 342, height: 52 }
    ]
  })
};

writeFileSync(args[outputIndex + 1], JSON.stringify(isRetry && hasCoordinateRetryFeedback ? positioned : unpositioned), "utf8");
process.exit(0);
