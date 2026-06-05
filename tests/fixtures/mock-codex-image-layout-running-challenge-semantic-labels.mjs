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
    summary: "Running Challenge 화면을 실제 visible text와 visual role로 분리해 구성했습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 402,
      height: 870,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      {
        id: "status",
        role: "system_status_bar",
        label: "9:41, cellular, Wi-Fi, battery",
        bbox: { x: 24, y: 14, width: 354, height: 18 }
      },
      {
        id: "title",
        role: "header_nav",
        label: "Running Challenge",
        bbox: { x: 116, y: 50, width: 174, height: 24 }
      },
      {
        id: "team",
        role: "status-chip",
        label: "Weekend Warriors",
        bbox: { x: 24, y: 86, width: 132, height: 32 }
      },
      {
        id: "hero",
        role: "hero_image",
        label: "Competitor image collage",
        bbox: { x: 24, y: 132, width: 354, height: 170 }
      },
      {
        id: "results-table",
        role: "results_table",
        label: "Results table: Athletes, Time, Score, Aikos, Amp, Avg",
        bbox: { x: 24, y: 322, width: 354, height: 112 }
      },
      {
        id: "leaderboard",
        role: "leaderboard",
        textLabels: ["Results", "Me", "Sam", "Lara"],
        visualLabel: "ranked progress list",
        bbox: { x: 24, y: 456, width: 354, height: 142 }
      },
      {
        id: "reward",
        role: "reward_banner",
        label: "Winner gets 50 coins + Champion Badge",
        bbox: { x: 24, y: 626, width: 354, height: 44 }
      }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Running Challenge semantic screen",
      width: 402,
      height: 870,
      layout: "none",
      children: [
        { helper: "text", name: "status-time", characters: "9:41", x: 28, y: 14, width: 44, height: 16 },
        { helper: "row", name: "status-icons", role: "status-icons", x: 318, y: 14, width: 54, height: 16 },
        { helper: "text", name: "title", characters: "Running Challenge", x: 116, y: 50, width: 174, height: 24 },
        { helper: "status-chip", name: "team-chip", label: "Weekend Warriors", x: 24, y: 86, width: 132, height: 32 },
        { helper: "card", name: "competitor-collage", role: "hero_image", x: 24, y: 132, width: 354, height: 170, layout: "none", clipsContent: true, fill: "#FF5E35" },
        { helper: "text", name: "stats-title", characters: "Results", x: 36, y: 326, width: 72, height: 18 },
        { helper: "text", name: "table-me", characters: "Me", x: 176, y: 326, width: 44, height: 18 },
        { helper: "text", name: "leader-title", characters: "Results", x: 36, y: 464, width: 72, height: 18 },
        { helper: "text", name: "leader-me", characters: "Me", x: 56, y: 494, width: 40, height: 18 },
        { helper: "text", name: "leader-sam", characters: "Sam", x: 56, y: 528, width: 48, height: 18 },
        { helper: "text", name: "leader-lara", characters: "Lara", x: 56, y: 562, width: 48, height: 18 },
        { helper: "status-chip", name: "reward", label: "Winner gets 50 coins + Champion Badge", x: 24, y: 626, width: 354, height: 44 }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
