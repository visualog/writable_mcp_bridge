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
    summary: "현재 선택을 기준으로 구조와 시스템 정합성을 요약했습니다.",
    findings: [
      "선택 대상은 인스턴스이며 source component 연결이 유지되고 있습니다.",
      "토큰/라이브러리 기준 비교는 추가 조회가 필요합니다."
    ],
    recommendations: [
      "기준 variant와 현재 override 차이를 먼저 기록하세요.",
      "토큰 정의를 읽어 spacing과 typography를 대조하세요."
    ]
  }),
  "utf8"
);

process.exit(0);
