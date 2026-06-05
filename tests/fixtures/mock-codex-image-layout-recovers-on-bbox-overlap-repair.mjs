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
    summary: "겹친 텍스트를 roleMap bbox로 보정할 수 있는 화면입니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "title", role: "screen-title", label: "생활통장", bbox: { x: 24, y: 96, width: 120, height: 28 } },
      { id: "balance", role: "metric", label: "케이뱅크 100", bbox: { x: 24, y: 136, width: 120, height: 20 } },
      { id: "row", role: "coupon_row", label: "이벤트 쿠폰 적금 알아보기", bbox: { x: 24, y: 280, width: 342, height: 48 } },
      { id: "button", role: "outlined_button", label: "내 자산 연결 해제", bbox: { x: 24, y: 524, width: 342, height: 44 } }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Repairable overlap screen",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", name: "Title", characters: "생활통장", x: 24, y: 96, width: 120, height: 28 },
        { helper: "text", name: "Balance", characters: "케이뱅크 100", x: 28, y: 102, width: 120, height: 20 },
        { helper: "text", name: "Coupon label", characters: "이벤트 쿠폰 적금 알아보기", x: 56, y: 294, width: 200, height: 20 },
        { helper: "status-chip", name: "Disconnect", label: "내 자산 연결 해제", x: 24, y: 524, width: 342, height: 44, fill: "#FFFFFF", stroke: "#E5E5E5" }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
