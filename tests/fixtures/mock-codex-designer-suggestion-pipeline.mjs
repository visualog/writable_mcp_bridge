#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("-o");

if (outputIndex === -1 || !args[outputIndex + 1]) {
  console.error("missing output path");
  process.exit(1);
}

const prompt = readFileSync(0, "utf8");

if (!prompt.includes("\"pipeline\"")) {
  console.error("missing pipeline payload");
  process.exit(2);
}
if (!prompt.includes("\"preserveDeterministicReport\": true")) {
  console.error("missing deterministic report policy");
  process.exit(3);
}
if (!prompt.includes("pipeline.retrieval.results")) {
  console.error("missing RAG instruction");
  process.exit(4);
}
if (!prompt.includes("\"id\": \"response-display-ux\"")) {
  console.error("missing retrieval payload");
  process.exit(5);
}
if (!prompt.includes("deterministic report의 판단과 순서")) {
  console.error("missing preservation instruction");
  process.exit(6);
}

writeFileSync(
  args[outputIndex + 1],
  JSON.stringify({
    summary: "pipeline 근거를 유지한 요약입니다.",
    findings: ["pipeline.read.commands와 deterministic report를 확인했습니다."],
    recommendations: ["Bridge context를 먼저 보강하고 Codex는 해석을 보강하세요."]
  }),
  "utf8"
);

process.exit(0);
