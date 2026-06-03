#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry.startsWith("--")) {
      continue;
    }
    const separator = entry.indexOf("=");
    if (separator >= 0) {
      options[entry.slice(2, separator)] = entry.slice(separator + 1);
      continue;
    }
    const key = entry.slice(2);
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = "true";
    }
  }
  return options;
}

function escapeMarkdown(value) {
  return String(value ?? "")
    .replace(/\r?\n/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function caseById(cases, id) {
  return cases.find((entry) => entry?.id === id) || null;
}

function buildStatusCounts(cases) {
  const counts = { pass: 0, fail: 0, skip: 0, other: 0 };
  for (const entry of cases) {
    if (entry?.status === "pass") counts.pass += 1;
    else if (entry?.status === "fail") counts.fail += 1;
    else if (entry?.status === "skip") counts.skip += 1;
    else counts.other += 1;
  }
  return counts;
}

function summarizeEvidence(entry) {
  const evidence = entry?.readbackEvidence || {};
  const parts = [];
  if (typeof evidence.knowledgeReferenceCount === "number") {
    parts.push(`knowledgeReferences=${evidence.knowledgeReferenceCount}`);
  }
  if (typeof evidence.matchCount === "number") {
    parts.push(`matches=${evidence.matchCount}`);
  }
  if (evidence.node?.geometry) {
    const geometry = evidence.node.geometry;
    parts.push(`geometry=${geometry.width ?? "?"}x${geometry.height ?? "?"}`);
  }
  if (entry?.action) {
    parts.push(`action=${entry.action}`);
  }
  if (entry?.failureHandling) {
    parts.push(`handling=${entry.failureHandling}`);
  }
  return parts.length > 0 ? parts.join("; ") : "-";
}

function hasReadbackEvidence(entry) {
  const evidence = entry?.readbackEvidence;
  return Boolean(
    evidence &&
      typeof evidence === "object" &&
      !Array.isArray(evidence) &&
      Object.keys(evidence).length > 0
  );
}

function buildReleaseFindings(cases, options = {}) {
  const findings = [];
  const failedCases = cases.filter((entry) => entry?.status === "fail");
  for (const entry of failedCases) {
    findings.push(`Case \`${entry.id || "unknown"}\` failed.`);
  }

  if (options.requireReleaseGates) {
    const requiredIds = buildReleaseRequiredCaseIds();
    for (const id of requiredIds) {
      const entry = caseById(cases, id);
      if (!entry) {
        findings.push(`Release-required case \`${id}\` is missing.`);
      } else if (entry.status !== "pass") {
        findings.push(`Release-required case \`${id}\` is ${entry.status || "unknown"}.`);
      } else if (!hasReadbackEvidence(entry)) {
        findings.push(`Release-required case \`${id}\` has no readback evidence.`);
      }
    }
  }

  return findings;
}

function buildReleaseRequiredCaseIds() {
  return [
    "RAG01",
    "DS01",
    ...Array.from({ length: 31 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`),
    "N01-N06"
  ];
}

function buildMarkdownReport(results, options = {}) {
  const summary = results.summary || {};
  const cases = Array.isArray(results.cases) ? results.cases : [];
  const counts = buildStatusCounts(cases);
  const findings = buildReleaseFindings(cases, options);
  const pass = findings.length === 0;
  const requiredCases = buildReleaseRequiredCaseIds();

  const lines = [
    "# Designer Workflow QA Summary",
    "",
    `Gate verdict: ${pass ? "PASS" : "FAIL"}`,
    "",
    "## Run",
    "",
    `- pluginId: ${escapeMarkdown(summary.pluginId || "-")}`,
    `- cases: ${cases.length} total, ${counts.pass} pass, ${counts.skip} skip, ${counts.fail} fail`,
    `- transport: ${escapeMarkdown(summary.healthAfter?.transport || "-")}`,
    `- commandReadiness: ${escapeMarkdown(summary.healthAfter?.commandReadiness || "-")}`,
    `- writeReadiness: ${escapeMarkdown(summary.healthAfter?.writeReadiness || "-")}`,
    `- pending: ${summary.runtimeAfter?.pendingTotal ?? "-"} commands, ${summary.runtimeAfter?.pendingResultsTotal ?? "-"} results`,
    `- recentFailedTotal: ${summary.runtimeAfter?.recentFailedTotal ?? "-"}`,
    `- beforeCapture: ${summary.beforeCapture?.ok ? escapeMarkdown(summary.beforeCapture.filePath) : "missing"}`,
    `- afterCapture: ${summary.afterCapture?.ok ? escapeMarkdown(summary.afterCapture.filePath) : "missing"}`,
    "",
    "## Release Findings",
    ""
  ];

  if (findings.length === 0) {
    lines.push("- No blocking release findings.");
  } else {
    lines.push(...findings.map((finding) => `- ${finding}`));
  }

  lines.push("", "## Required Evidence", "", "| Case | Status | Evidence |", "| --- | --- | --- |");
  for (const id of requiredCases) {
    const entry = caseById(cases, id);
    lines.push(
      `| ${id} | ${escapeMarkdown(entry?.status || "missing")} | ${escapeMarkdown(summarizeEvidence(entry))} |`
    );
  }

  lines.push("", "## All Cases", "", "| Case | Area | Status | Evidence |", "| --- | --- | --- | --- |");
  for (const entry of cases) {
    lines.push(
      `| ${escapeMarkdown(entry.id || "-")} | ${escapeMarkdown(entry.area || "-")} | ${escapeMarkdown(entry.status || "-")} | ${escapeMarkdown(summarizeEvidence(entry))} |`
    );
  }

  lines.push("");
  return {
    markdown: lines.join("\n"),
    pass,
    findings
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input;
  if (!input) {
    throw new Error("--input is required");
  }
  const output = args.output || path.join(path.dirname(input), "summary.md");
  const requireReleaseGates = args["require-release-gates"] === "true";
  const results = JSON.parse(await readFile(input, "utf8"));
  const report = buildMarkdownReport(results, { requireReleaseGates });
  await writeFile(output, report.markdown, "utf8");
  console.log(JSON.stringify({ ok: report.pass, output, findings: report.findings }, null, 2));
  if (!report.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
