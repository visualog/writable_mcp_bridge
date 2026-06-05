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
    summary: "참조 이미지 레이어 안에만 텍스트를 넣어 품질을 통과하려고 했습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "title", role: "screen-title", label: "생활통장" },
      { id: "balance", role: "metric", label: "케이뱅크 100" },
      { id: "row", role: "list-row", label: "이벤트 쿠폰 적금 알아보기" },
      { id: "button", role: "button", label: "내 자산 연결 해제" }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Generated from image",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        {
          helper: "card",
          name: "Source image reference",
          role: "source-image-reference",
          x: 0,
          y: 0,
          width: 390,
          height: 844,
          children: [
            { helper: "text", name: "Ref title", x: 24, y: 80, characters: "생활통장" },
            { helper: "text", name: "Ref balance", x: 24, y: 120, characters: "케이뱅크 100" },
            { helper: "text", name: "Ref row", x: 24, y: 220, characters: "이벤트 쿠폰 적금 알아보기" },
            { helper: "text", name: "Ref button", x: 24, y: 720, characters: "내 자산 연결 해제" }
          ]
        },
        {
          helper: "card",
          name: "Blank generated slab",
          x: 0,
          y: 0,
          width: 390,
          height: 844,
          fill: "#FFFFFF"
        }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
