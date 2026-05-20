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
    summary: "현재 variant를 compact 목적에 맞게 조정했습니다.",
    componentNodeId: "30:1",
    variantProperties: {
      Size: "Medium",
      State: "Default"
    }
  }),
  "utf8"
);

process.exit(0);
