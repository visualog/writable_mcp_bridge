#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { evaluateFragmentGoldenSet } from "../src/fragment-accuracy-report.js";

const DEFAULT_INPUT = path.resolve("docs/authoring/fragment-golden-set.json");

function getArg(name, fallback = undefined) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) {
    return fallback;
  }
  return process.argv[index + 1] ?? fallback;
}

async function main() {
  const inputPath = path.resolve(getArg("input", DEFAULT_INPUT));
  const outputPath = getArg("output");
  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = JSON.parse(raw);
  const report = evaluateFragmentGoldenSet(parsed.cases);

  if (outputPath) {
    await fs.writeFile(path.resolve(outputPath), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }

  const failed = report.details.filter((item) => item.pass === false);
  const result = {
    inputPath,
    outputPath: outputPath ? path.resolve(outputPath) : null,
    summary: report.summary,
    failedCaseIds: failed.map((item) => item.id)
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
