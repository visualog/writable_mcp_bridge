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
    summary: "화면을 단순 박스로 축약했습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4,
      margin: { x: 24, y: 0 },
      columns: 4,
      gutter: 16
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "title", role: "screen-title", label: "생활통장" },
      { id: "balance", role: "metric", label: "케이뱅크 100" },
      { id: "badge", role: "chip", label: "간편결제" },
      { id: "row", role: "list-row", label: "이벤트 쿠폰 적금 알아보기" },
      { id: "section", role: "section-title", label: "내 자산에서 노출" },
      { id: "button", role: "button", label: "내 자산 연결 해제" }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Generated from image",
      width: 390,
      height: 844,
      children: [
        {
          helper: "card",
          name: "Phone screenshot copy",
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
