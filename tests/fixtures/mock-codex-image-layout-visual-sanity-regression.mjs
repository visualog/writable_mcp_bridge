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
    summary: "구조는 만들었지만 상태바와 아이콘 fallback 텍스트가 깨진 화면입니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "status", role: "system_status_bar", label: "1:51", bbox: { x: 16, y: 12, width: 48, height: 16 } },
      { id: "title", role: "screen-title", label: "생활통장", bbox: { x: 24, y: 96, width: 100, height: 28 } },
      { id: "balance", role: "metric", label: "케이뱅크 100", bbox: { x: 24, y: 128, width: 100, height: 20 } },
      { id: "row", role: "coupon_row", label: "이벤트 쿠폰 적금 알아보기", bbox: { x: 24, y: 280, width: 342, height: 48 } },
      { id: "button", role: "outlined_button", label: "내 자산 연결 해제", bbox: { x: 24, y: 524, width: 342, height: 44 } }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Visual sanity regression screen",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", name: "time", characters: "1:51", x: 24, y: 12, width: 44, height: 16 },
        { helper: "text", name: "bad-cellular", characters: "ce", x: 312, y: 12, width: 20, height: 12 },
        { helper: "text", name: "bad-battery", characters: "ba", x: 344, y: 12, width: 20, height: 12 },
        { helper: "text", name: "Title", characters: "생활통장", x: 24, y: 96, width: 100, height: 28 },
        { helper: "text", name: "Balance", characters: "케이뱅크 100", x: 24, y: 128, width: 100, height: 20 },
        { helper: "text", name: "bad-icon-b", characters: "b", x: 38, y: 294, width: 8, height: 10 },
        { helper: "text", name: "bad-icon-a", characters: "a", x: 38, y: 306, width: 8, height: 10 },
        { helper: "text", name: "bad-icon-n", characters: "n", x: 38, y: 318, width: 8, height: 10 },
        { helper: "text", name: "Coupon label", characters: "이벤트 쿠폰 적금 알아보기", x: 56, y: 294, width: 200, height: 20 },
        { helper: "status-chip", name: "Disconnect", label: "내 자산 연결 해제", x: 24, y: 524, width: 342, height: 44, fill: "#FFFFFF", stroke: "#E5E5E5" }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
