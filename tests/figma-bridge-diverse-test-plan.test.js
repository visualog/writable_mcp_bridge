import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = new URL("..", import.meta.url);
const planPath = path.join(repoRoot.pathname, "docs", "qa", "figma-bridge-diverse-test-plan-20260601.md");
const koreanWorkflowPlanPath = path.join(
  repoRoot.pathname,
  "docs",
  "qa",
  "figma-designer-workflow-test-plan-20260601.ko.md"
);
const runnerPath = path.join(repoRoot.pathname, "scripts", "run-figma-designer-workflow-live-qa.mjs");

function parseDesignerWorkflowRows(markdown) {
  return markdown
    .split(/\r?\n/u)
    .filter((line) => /^\| L\d{2} \|/u.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      return {
        cells,
        id: cells[0],
        scenario: cells[1],
        prompt: cells[2],
        selection: cells[3],
        expectedChange: cells[4],
        readbackEvidence: cells[5],
        failureHandling: cells[6]
      };
    });
}

test("diverse QA plan keeps Designer Workflow editing coverage broad and evidence-based", async () => {
  const markdown = await readFile(planPath, "utf8");
  const rows = parseDesignerWorkflowRows(markdown);
  const ids = rows.map((row) => row.id);

  assert.equal(rows.length, 31);
  assert.deepEqual(
    ids,
    Array.from({ length: 31 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`)
  );
  for (const row of rows) {
    assert.equal(row.cells.length, 7, `${row.id} must keep the 7-column QA contract`);
    assert.ok(row.prompt.length > 8, `${row.id} prompt is missing`);
    assert.ok(row.selection.length > 4, `${row.id} selection is missing`);
    assert.ok(row.expectedChange.length > 8, `${row.id} expected Figma change is missing`);
    assert.ok(row.readbackEvidence.length > 8, `${row.id} readback evidence is missing`);
    assert.ok(row.failureHandling.length > 8, `${row.id} failure handling is missing`);
  }

  const planText = rows
    .map((row) => [
      row.id,
      row.scenario,
      row.prompt,
      row.selection,
      row.expectedChange,
      row.readbackEvidence,
      row.failureHandling
    ].join(" "))
    .join("\n");

  const requiredCoverage = [
    /Auto Layout|padding|gap|Align|Distribute/iu,
    /Wrap|Group|Ungroup|section|naming/iu,
    /color token|text style|stroke|semantic variable|Unbind/iu,
    /Instance swap|variant property|component|override/iu,
    /hierarchy|spacing across screen|redundant/iu,
    /multiple buttons|repeated cards|table\/list rows/iu,
    /Locked|Hidden|Mask|image|confirmation/iu
  ];
  for (const pattern of requiredCoverage) {
    assert.match(planText, pattern);
  }
});

test("diverse QA plan summarizes Designer Workflow coverage by real Figma task type", async () => {
  const markdown = await readFile(planPath, "utf8");

  assert.match(markdown, /### Designer Workflow Coverage Matrix/u);
  const requiredRows = [
    /Layout editing\s*\|\s*L01-L07/u,
    /Layer structure\s*\|\s*L08-L12/u,
    /Style and token application\s*\|\s*L13-L17/u,
    /Component operations\s*\|\s*L18-L20/u,
    /Screen improvement\s*\|\s*L21-L23/u,
    /Repeated and batch editing\s*\|\s*L24-L26/u,
    /Safety and guarded mutation\s*\|\s*L27-L31/u
  ];
  for (const rowPattern of requiredRows) {
    assert.match(markdown, rowPattern);
  }
});

test("diverse QA plan requires release gates, live readiness artifacts, and safe unsupported handling", async () => {
  const markdown = await readFile(planPath, "utf8");

  assert.match(markdown, /unsupported\/confirmation\/partial-guidance response rather than a silent no-op/u);
  assert.match(markdown, /DS01 real design-system component evidence check/u);
  assert.match(markdown, /XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=1/u);
  assert.match(markdown, /L01-L31/u);
  assert.match(markdown, /summary\.md/u);
  assert.match(markdown, /audit-designer-workflow-release-readiness\.mjs/u);
  assert.match(markdown, /release-readiness-latest\.md/u);
  assert.match(markdown, /live-readiness\.json/u);
  assert.match(markdown, /live-readiness\.md/u);
  assert.match(markdown, /XBRIDGE_QA_PLUGIN_ID/u);
  assert.match(markdown, /This readiness artifact is not a pass verdict/u);
});

test("Korean Designer Workflow plan stays aligned with the release matrix", async () => {
  const markdown = await readFile(koreanWorkflowPlanPath, "utf8");
  const rows = parseDesignerWorkflowRows(markdown);
  const ids = rows.map((row) => row.id);

  assert.equal(rows.length, 31);
  assert.deepEqual(
    ids,
    Array.from({ length: 31 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`)
  );
  assert.match(markdown, /RAG01, DS01, L01-L31, N01-N06/u);
  assert.match(markdown, /L 섹션 31개 케이스/u);
  assert.match(markdown, /비어 있지 않은 readback evidence/u);
  assert.match(markdown, /audit-designer-workflow-release-readiness\.mjs/u);
  assert.match(markdown, /XBRIDGE_QA_PLUGIN_ID/u);
  assert.match(markdown, /Mask node safety/u);
});

test("live Designer Workflow runner stays synchronized with the documented QA matrix", async () => {
  const source = await readFile(runnerPath, "utf8");
  const caseIds = Array.from(source.matchAll(/makeCase\(\s*"([^"]+)"/gu), (match) => match[1]);

  assert.ok(caseIds.includes("RAG01"));
  assert.ok(caseIds.includes("DS01"));
  assert.ok(caseIds.includes("N01-N06"));
  for (const id of Array.from({ length: 31 }, (_, index) => `L${String(index + 1).padStart(2, "0")}`)) {
    assert.ok(caseIds.includes(id), `runner is missing documented case ${id}`);
  }
  assert.match(source, /buildDesignerWorkflowReadinessReport/);
  assert.match(source, /live-readiness\.json/);
  assert.match(source, /summarize-designer-workflow-qa\.mjs/);
});
