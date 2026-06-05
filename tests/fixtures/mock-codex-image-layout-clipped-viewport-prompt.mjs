#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");
const prompt = readFileSync(0, "utf8");

if (
  !/clipped_frame_viewport/u.test(prompt) ||
  !/프레임 밖으로 넘친 자식 이미지\/레이어 영역은 무시/u.test(prompt) ||
  !/"frameViewportClipped": true/u.test(prompt) ||
  !/"contentsOnly": false/u.test(prompt) ||
  !/"useAbsoluteBounds": false/u.test(prompt)
) {
  console.error("missing clipped frame viewport prompt guidance");
  process.exit(2);
}

writeFileSync(
  args[outputIndex + 1],
  JSON.stringify({
    summary: "클리핑된 프레임 viewport 기준으로 화면을 구성했습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 402,
      height: 870,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "status", role: "system_status_bar", label: "9:41", bbox: { x: 30, y: 18, width: 48, height: 16 } },
      { id: "title", role: "header_nav", label: "Running Challenge", bbox: { x: 120, y: 56, width: 170, height: 24 } },
      { id: "team", role: "status-chip", label: "Weekend Warriors", bbox: { x: 28, y: 90, width: 126, height: 32 } },
      { id: "results", role: "section-title", label: "Results", bbox: { x: 24, y: 420, width: 80, height: 20 } }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Running Challenge viewport reconstruction",
      width: 402,
      height: 870,
      layout: "none",
      children: [
        { helper: "text", name: "status-time", text: "9:41", x: 30, y: 18, width: 48, height: 16 },
        { helper: "text", name: "title", text: "Running Challenge", x: 120, y: 56, width: 170, height: 24 },
        { helper: "status-chip", name: "team-chip", label: "Weekend Warriors", x: 28, y: 90, width: 126, height: 32 },
        { helper: "text", name: "results-title", text: "Results", x: 24, y: 420, width: 80, height: 20 }
      ]
    })
  }),
  "utf8"
);
