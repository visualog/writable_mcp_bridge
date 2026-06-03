import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";

const repoRoot = new URL("..", import.meta.url);

function runSummary(inputPath, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/summarize-designer-workflow-qa.mjs", "--input", inputPath, ...extraArgs],
      {
        cwd: repoRoot,
        stdio: ["ignore", "pipe", "pipe"]
      }
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      resolve({ code, stdout, stderr });
    });
  });
}

async function writeResultsFixture(data) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "xbridge-designer-summary-"));
  const filePath = path.join(dir, "results.json");
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  return { dir, filePath };
}

function makeDesignerWorkflowCases(overrides = {}) {
  const cases = [
    { id: "RAG01", status: "pass", area: "RAG", readbackEvidence: { knowledgeReferenceCount: 3 } },
    { id: "DS01", status: "pass", area: "Design System Component Evidence", readbackEvidence: { matchCount: 2 } },
    { id: "N01-N06", status: "pass", area: "Network", readbackEvidence: { health: { commandReadiness: "ready", writeReadiness: "ready" } } }
  ];
  for (let index = 1; index <= 31; index += 1) {
    const id = `L${String(index).padStart(2, "0")}`;
    cases.push({
      id,
      status: "pass",
      area: "Designer Workflow",
      action: `fixture action ${id}`,
      readbackEvidence: { node: { geometry: { width: 100 + index, height: 40 + index } } },
      ...overrides[id]
    });
  }
  return cases;
}

test("designer workflow QA summary writes markdown and passes clean release evidence", async () => {
  const { dir, filePath } = await writeResultsFixture({
    summary: {
      pluginId: "page:demo",
      casesTotal: 34,
      passTotal: 33,
      skipTotal: 1,
      failTotal: 0,
      beforeCapture: { ok: true, filePath: "/tmp/before.png" },
      afterCapture: { ok: true, filePath: "/tmp/after.png" },
      healthAfter: {
        transport: "healthy",
        commandReadiness: "ready",
        writeReadiness: "ready"
      },
      runtimeAfter: {
        pendingTotal: 0,
        pendingResultsTotal: 0,
        recentFailedTotal: 0
      }
    },
    cases: [
      ...makeDesignerWorkflowCases({ L28: { action: "hidden fixture mutation blocked" } }),
      { id: "I00", status: "skip", area: "Optional", failureHandling: "Not in scope" }
    ]
  });

  const outputPath = path.join(dir, "summary.md");
  const result = await runSummary(filePath, ["--output", outputPath, "--require-release-gates"]);

  assert.equal(result.code, 0, result.stderr || result.stdout);
  const report = await readFile(outputPath, "utf8");
  assert.match(report, /# Designer Workflow QA Summary/);
  assert.match(report, /Gate verdict: PASS/);
  assert.match(report, /DS01/);
  assert.match(report, /RAG01/);
  assert.match(report, /hidden fixture mutation blocked/);
  const requiredEvidence = report.split("## Required Evidence")[1].split("## All Cases")[0];
  assert.match(requiredEvidence, /\| L01 \| pass \|/);
  assert.match(requiredEvidence, /\| L31 \| pass \|/);
  assert.match(requiredEvidence, /\| N01-N06 \| pass \|/);
});

test("designer workflow QA summary fails release gate when DS01 is skipped", async () => {
  const { dir, filePath } = await writeResultsFixture({
    summary: {
      pluginId: "page:demo",
      casesTotal: 2,
      passTotal: 1,
      skipTotal: 1,
      failTotal: 0,
      healthAfter: { transport: "healthy", commandReadiness: "ready", writeReadiness: "ready" },
      runtimeAfter: { pendingTotal: 0, pendingResultsTotal: 0, recentFailedTotal: 0 }
    },
    cases: [
      { id: "RAG01", status: "pass", area: "RAG", readbackEvidence: { knowledgeReferenceCount: 2 } },
      { id: "DS01", status: "skip", area: "Design System Component Evidence", failureHandling: "missing token" }
    ]
  });

  const outputPath = path.join(dir, "summary.md");
  const result = await runSummary(filePath, ["--output", outputPath, "--require-release-gates"]);

  assert.equal(result.code, 1);
  const report = await readFile(outputPath, "utf8");
  assert.match(report, /Gate verdict: FAIL/);
  assert.match(report, /Release-required case `DS01` is skip/);
});

test("designer workflow QA summary fails release gate when any documented L case is missing", async () => {
  const cases = makeDesignerWorkflowCases().filter((entry) => entry.id !== "L31");
  const { dir, filePath } = await writeResultsFixture({
    summary: {
      pluginId: "page:demo",
      casesTotal: cases.length,
      passTotal: cases.length,
      skipTotal: 0,
      failTotal: 0,
      healthAfter: { transport: "healthy", commandReadiness: "ready", writeReadiness: "ready" },
      runtimeAfter: { pendingTotal: 0, pendingResultsTotal: 0, recentFailedTotal: 0 }
    },
    cases
  });

  const outputPath = path.join(dir, "summary.md");
  const result = await runSummary(filePath, ["--output", outputPath, "--require-release-gates"]);

  assert.equal(result.code, 1);
  const report = await readFile(outputPath, "utf8");
  assert.match(report, /Gate verdict: FAIL/);
  assert.match(report, /Release-required case `L31` is missing/);
});

test("designer workflow QA summary fails release gate when a required case has no readback evidence", async () => {
  const cases = makeDesignerWorkflowCases({ L12: { readbackEvidence: {} } });
  const { dir, filePath } = await writeResultsFixture({
    summary: {
      pluginId: "page:demo",
      casesTotal: cases.length,
      passTotal: cases.length,
      skipTotal: 0,
      failTotal: 0,
      healthAfter: { transport: "healthy", commandReadiness: "ready", writeReadiness: "ready" },
      runtimeAfter: { pendingTotal: 0, pendingResultsTotal: 0, recentFailedTotal: 0 }
    },
    cases
  });

  const outputPath = path.join(dir, "summary.md");
  const result = await runSummary(filePath, ["--output", outputPath, "--require-release-gates"]);

  assert.equal(result.code, 1);
  const report = await readFile(outputPath, "utf8");
  assert.match(report, /Gate verdict: FAIL/);
  assert.match(report, /Release-required case `L12` has no readback evidence/);
});
