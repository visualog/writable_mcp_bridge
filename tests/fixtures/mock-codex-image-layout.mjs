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

writeFileSync(
  args[outputIndex + 1],
  JSON.stringify({
    summary: "이미지 구조를 기반으로 모바일 화면 레이아웃을 만들었습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4,
      margin: { x: 24, y: 0 },
      columns: 4,
      gutter: 16
    }),
    layoutMapJson: JSON.stringify([
      {
        id: "screen",
        targetName: "Generated from image",
        role: "mobile-screen",
        direction: "none",
        sizing: { widthMode: "fixed", heightMode: "fixed" }
      }
    ]),
    roleMapJson: JSON.stringify([
      {
        id: "header-title",
        role: "header-nav",
        label: "Running Challenge",
        strategy: "toolbar",
        bbox: { x: 24, y: 44, width: 342, height: 44 }
      },
      {
        id: "metric",
        role: "statistic-card",
        label: "2.4 km",
        strategy: "metric",
        bbox: { x: 24, y: 116, width: 120, height: 48 }
      },
      {
        id: "progress",
        role: "progress-bar",
        label: "65%",
        strategy: "progress",
        bbox: { x: 24, y: 188, width: 342, height: 16 }
      },
      {
        id: "action",
        role: "button",
        label: "Start Run",
        strategy: "button",
        bbox: { x: 24, y: 720, width: 342, height: 52 }
      }
    ]),
    textStyleMapJson: JSON.stringify([
      {
        id: "header-title-style",
        targetName: "Title",
        role: "nav-title",
        text: "Running Challenge",
        fontSize: 14,
        fontStyle: "Semi Bold",
        lineHeight: 20
      }
    ]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Generated from image",
      width: 390,
      height: 844,
      children: [
        {
          helper: "text",
          name: "Title",
          characters: "Running Challenge",
          role: "title",
          x: 24,
          y: 44,
          width: 220,
          height: 24
        },
        {
          helper: "text",
          name: "Distance metric",
          characters: "2.4 km",
          role: "metric",
          x: 24,
          y: 116,
          width: 120,
          height: 36
        },
        {
          helper: "progress-bar",
          name: "Challenge progress",
          progress: 0.65,
          label: "65%",
          role: "progress-bar",
          x: 24,
          y: 188,
          width: 342,
          height: 16
        },
        {
          helper: "status-chip",
          name: "Primary action",
          label: "Start Run",
          role: "button",
          x: 24,
          y: 720,
          width: 342,
          height: 52
        }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
