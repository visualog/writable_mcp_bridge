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
    summary: "주요 화면 요소를 분해했지만 여러 섹션을 원점에 겹쳐 배치했습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 390,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "status", role: "system-status-bar", label: "1:51" },
      { id: "nav", role: "header-nav", label: "관리" },
      { id: "title", role: "screen-title", label: "생활통장" },
      { id: "balance", role: "metric", label: "케이뱅크 100" },
      { id: "row", role: "list-row", label: "이벤트 쿠폰 적금 알아보기" },
      { id: "section", role: "section-title", label: "내 자산에서 노출" },
      { id: "button", role: "button", label: "내 자산 연결 해제" }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Origin stacked screen",
      width: 390,
      height: 844,
      layout: "none",
      children: [
        { helper: "frame", name: "status_bar", role: "system-status-bar", x: 0, y: 0, width: 390, height: 44 },
        { helper: "text", name: "Nav title", characters: "관리", x: 176, y: 0, width: 40, height: 20 },
        { helper: "text", name: "Account title", characters: "생활통장", x: 24, y: 104, width: 96, height: 24 },
        { helper: "text", name: "Balance", characters: "케이뱅크 100", x: 24, y: 132, width: 120, height: 18 },
        { helper: "text", name: "Event row", characters: "이벤트 쿠폰 적금 알아보기", x: 56, y: 0, width: 200, height: 20 },
        { helper: "text", name: "Section title", characters: "내 자산에서 노출", x: 24, y: 0, width: 140, height: 20 },
        { helper: "text", name: "Disconnect", characters: "내 자산 연결 해제", x: 96, y: 448, width: 180, height: 20 }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
