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
    summary: "리스트 영역과 텍스트는 인식했지만 내부 행 폭을 부모보다 과도하게 좁게 만들었습니다.",
    canvasSpecJson: JSON.stringify({
      surfaceType: "mobile-app",
      width: 392,
      height: 844,
      gridUnit: 4
    }),
    layoutMapJson: JSON.stringify([]),
    roleMapJson: JSON.stringify([
      { id: "status", role: "system_status_bar", label: "9:41", bbox: { x: 24, y: 12, width: 48, height: 18 } },
      { id: "title", role: "header-title", label: "November Victory", bbox: { x: 96, y: 48, width: 190, height: 24 } },
      {
        id: "schedule",
        role: "event_list",
        label: "Schedule list",
        textLabels: ["After party at Calvin...", "6:00 pm", "1 Run", "8:30 pm"],
        bbox: { x: 24, y: 388, width: 344, height: 112 }
      },
      {
        id: "message",
        role: "bottom_input_bar",
        label: "Message with friends in Running...",
        bbox: { x: 24, y: 784, width: 344, height: 36 }
      }
    ]),
    textStyleMapJson: JSON.stringify([]),
    treeJson: JSON.stringify({
      helper: "screen",
      name: "Shrunken list rows screen",
      width: 392,
      height: 844,
      layout: "none",
      children: [
        { helper: "text", name: "Status time", characters: "9:41", x: 24, y: 12, width: 48, height: 18 },
        { helper: "text", name: "Title", characters: "November Victory", x: 96, y: 48, width: 190, height: 24 },
        {
          helper: "list",
          name: "Schedule list",
          role: "event_list",
          x: 24,
          y: 388,
          width: 344,
          height: 112,
          children: [
            {
              helper: "row",
              name: "After party row",
              x: 0,
              y: 0,
              width: 160,
              height: 44,
              children: [
                { helper: "text", characters: "After party at Calvin...", x: 0, y: 0, width: 132, height: 18 },
                { helper: "text", characters: "6:00 pm", x: 116, y: 0, width: 44, height: 18 }
              ]
            },
            {
              helper: "row",
              name: "Run row",
              x: 0,
              y: 52,
              width: 160,
              height: 44,
              children: [
                { helper: "text", characters: "1 Run", x: 0, y: 0, width: 64, height: 18 },
                { helper: "text", characters: "8:30 pm", x: 116, y: 0, width: 44, height: 18 }
              ]
            }
          ]
        },
        {
          helper: "row",
          name: "Message input bar",
          role: "bottom_input_bar",
          x: 24,
          y: 784,
          width: 344,
          height: 36,
          children: [
            { helper: "text", characters: "Message with friends in Running...", x: 44, y: 10, width: 240, height: 16 }
          ]
        }
      ]
    })
  }),
  "utf8"
);

process.exit(0);
