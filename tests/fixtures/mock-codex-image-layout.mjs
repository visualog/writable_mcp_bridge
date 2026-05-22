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
          role: "title"
        }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
