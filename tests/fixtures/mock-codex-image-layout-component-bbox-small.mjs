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
    summary: "버튼과 행 문구는 맞췄지만 컴포넌트 박스를 원본보다 너무 작게 만들었습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "title", role: "screen-title", label: "생활통장", bbox: { x: 24, y: 96, width: 100, height: 28 } },
      { id: "balance", role: "metric", label: "케이뱅크 100", bbox: { x: 24, y: 128, width: 100, height: 20 } },
      { id: "row", role: "list-row", label: "이벤트 쿠폰 적금 알아보기", bbox: { x: 24, y: 280, width: 342, height: 48 } },
      { id: "button", role: "button", label: "내 자산 연결 해제", bbox: { x: 24, y: 524, width: 342, height: 44 } }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Component bbox too small screen",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", name: "Title", characters: "생활통장", x: 24, y: 96, width: 100, height: 28 },
        { helper: "text", name: "Balance", characters: "케이뱅크 100", x: 24, y: 128, width: 100, height: 20 },
        { helper: "status-chip", name: "Event row", label: "이벤트 쿠폰 적금 알아보기", x: 24, y: 280, width: 132, height: 24 },
        { helper: "status-chip", name: "Disconnect", label: "내 자산 연결 해제", x: 24, y: 524, width: 132, height: 24 }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
