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
    summary: "화면에서 제목 하나만 인식했습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      {
        id: "header-title",
        role: "header-nav",
        label: "Running Challenge",
        strategy: "toolbar",
        bbox: { x: 24, y: 44, width: 342, height: 44 }
      }
    ]),
    textStyleMapJson: JSON.stringify([]),
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
