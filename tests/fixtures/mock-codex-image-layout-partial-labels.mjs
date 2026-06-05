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
    summary: "긴 문구를 일부 단어만 반영했습니다.",
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
      { id: "event-row", role: "list-row", label: "이벤트 쿠폰 적금 알아보기" },
      { id: "disconnect", role: "button", label: "내 자산 연결 해제" }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Generated from image",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", name: "Title", characters: "생활통장", x: 24, y: 104, width: 96, height: 24 },
        { helper: "text", name: "Balance", characters: "케이뱅크 100", x: 24, y: 132, width: 120, height: 18 },
        { helper: "text", name: "Partial event", characters: "이벤트", x: 56, y: 252, width: 60, height: 20 },
        { helper: "text", name: "Partial disconnect", characters: "연결", x: 96, y: 448, width: 40, height: 20 }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
