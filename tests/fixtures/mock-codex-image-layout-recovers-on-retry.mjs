#!/usr/bin/env node
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");

if (outputIndex === -1 || !args[outputIndex + 1]) {
  console.error("missing output path");
  process.exit(1);
}

const markerPath =
  process.env.XBRIDGE_IMAGE_LAYOUT_RETRY_MARKER ||
  join(tmpdir(), `xbridge-image-layout-retry-${process.ppid}.marker`);
const isRetry = existsSync(markerPath);
writeFileSync(markerPath, "1", "utf8");

const roleMap = [
  { id: "status", role: "system-status-bar", label: "1:51" },
  { id: "title", role: "screen-title", label: "생활통장" },
  { id: "balance", role: "metric", label: "케이뱅크 100" },
  { id: "badge", role: "chip", label: "간편결제" },
  { id: "row", role: "list-row", label: "이벤트 쿠폰 적금 알아보기" },
  { id: "section", role: "section-title", label: "내 자산에서 노출" },
  { id: "button", role: "button", label: "내 자산 연결 해제" }
];

const base = {
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
  roleMapJson: JSON.stringify(roleMap),
  textStyleMapJson: JSON.stringify([])
};

const output = isRetry
  ? {
      ...base,
      summary: "품질 피드백을 반영해 UI 요소를 편집 가능한 레이어로 분해했습니다.",
      treeJson: JSON.stringify({
        helper: "screen",
        name: "Generated from image",
        width: 390,
        height: 844,
        layout: "none",
        children: [
          { helper: "text", name: "Status time", characters: "1:51", x: 28, y: 16, width: 40, height: 16 },
          { helper: "text", name: "Back", characters: "‹", role: "icon", x: 16, y: 56, width: 24, height: 24 },
          { helper: "text", name: "Nav title", characters: "관리", x: 176, y: 58, width: 40, height: 20 },
          { helper: "text", name: "Account title", characters: "생활통장", x: 24, y: 104, width: 96, height: 24 },
          { helper: "text", name: "Account balance", characters: "케이뱅크 100", x: 24, y: 132, width: 120, height: 18 },
          { helper: "status-chip", name: "Payment chip", label: "간편결제", x: 24, y: 156, width: 56, height: 24 },
          { helper: "text", name: "Event row label", characters: "이벤트 쿠폰 적금 알아보기", x: 56, y: 252, width: 200, height: 20 },
          { helper: "text", name: "Section title", characters: "내 자산에서 노출", x: 24, y: 344, width: 140, height: 20 },
          { helper: "card", name: "Toggle on", role: "toggle", x: 318, y: 340, width: 40, height: 24, radius: 12 },
          { helper: "text", name: "Disconnect button", characters: "내 자산 연결 해제", x: 96, y: 448, width: 180, height: 20 }
        ]
      })
    }
  : {
      ...base,
      summary: "화면을 단순 박스로 축약했습니다.",
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
    };

writeFileSync(args[outputIndex + 1], JSON.stringify(output), "utf8");
process.exit(0);
