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
    summary: "선택 텍스트 초안을 만들었습니다.",
    updates: [
      { id: "20:1", text: "짧은 제목" },
      { id: "20:2", text: "짧은 본문" }
    ]
  }),
  "utf8"
);

process.exit(0);
