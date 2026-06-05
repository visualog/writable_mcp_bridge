#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = readFileSync(0, "utf8");

if (outputIndex === -1 || !args[outputIndex + 1]) {
  console.error("missing output path");
  process.exit(1);
}

const markerPath =
  process.env.XBRIDGE_IMAGE_LAYOUT_RETRY_MARKER ||
  join(tmpdir(), `xbridge-image-layout-specific-feedback-${process.ppid}.marker`);
const isRetry = existsSync(markerPath);
writeFileSync(markerPath, "1", "utf8");

if (
  isRetry &&
  !(
    /Newsletter Victory/u.test(prompt) &&
    /Dates: 1 of 26/u.test(prompt) &&
    /Message with Newsletter Victory/u.test(prompt) &&
    /Results/u.test(prompt)
  )
) {
  console.error("missing specific retry feedback labels");
  process.exit(2);
}

const roleMap = [
  {
    id: "title",
    role: "header-title",
    label: "Newsletter Victory",
    bbox: { x: 96, y: 48, width: 190, height: 24 }
  },
  {
    id: "dates",
    role: "header-subtitle",
    label: "Dates: 1 of 26",
    bbox: { x: 96, y: 74, width: 150, height: 18 }
  },
  {
    id: "message",
    role: "message-row",
    label: "Message with Newsletter Victory",
    bbox: { x: 16, y: 720, width: 358, height: 44 }
  },
  {
    id: "results",
    role: "results-card",
    textLabels: ["Results", "Distance", "Runs"],
    bbox: { x: 16, y: 276, width: 358, height: 112 }
  }
];

const base = {
  summary: isRetry ? "구체 품질 피드백을 반영해 재구성했습니다." : "좁은 텍스트와 작은 컴포넌트로 구성했습니다.",
  canvasSpecJson: JSON.stringify({
    surfaceType: "mobile-app",
    width: 392,
    height: 844,
    gridUnit: 4
  }),
  layoutMapJson: JSON.stringify([]),
  roleMapJson: JSON.stringify(roleMap),
  textStyleMapJson: JSON.stringify([])
};

const tree = isRetry
  ? {
      helper: "screen",
      name: "Running Challenge retry",
      width: 392,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", characters: "Newsletter Victory", x: 96, y: 48, width: 190, height: 24 },
        { helper: "text", characters: "Dates: 1 of 26", x: 96, y: 74, width: 150, height: 18 },
        { helper: "card", name: "Results card", role: "results-card", label: "Results", x: 16, y: 276, width: 358, height: 112 },
        { helper: "text", characters: "Distance", x: 32, y: 316, width: 80, height: 16 },
        { helper: "text", characters: "Runs", x: 132, y: 316, width: 64, height: 16 },
        { helper: "row", name: "Message with Newsletter Victory", role: "message-row", label: "Message with Newsletter Victory", x: 16, y: 720, width: 358, height: 44 }
      ]
    }
  : {
      helper: "screen",
      name: "Running Challenge too narrow",
      width: 392,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", characters: "Newsletter Victory", x: 96, y: 48, width: 28, height: 24 },
        { helper: "text", characters: "Dates: 1 of 26", x: 96, y: 74, width: 24, height: 18 },
        { helper: "card", name: "Results tiny card", role: "results-card", label: "Results", x: 16, y: 276, width: 80, height: 24 },
        { helper: "text", characters: "Distance", x: 32, y: 316, width: 80, height: 16 },
        { helper: "text", characters: "Runs", x: 132, y: 316, width: 64, height: 16 },
        { helper: "row", name: "Tiny message row", role: "message-row", label: "Message with Newsletter Victory", x: 16, y: 720, width: 80, height: 20 }
      ]
    };

writeFileSync(args[outputIndex + 1], JSON.stringify({ ...base, treeJson: JSON.stringify(tree) }), "utf8");
process.exit(0);
