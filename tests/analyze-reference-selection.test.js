import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAnalyzeReferenceSelectionPlan,
  deriveReferenceAnalysisDraft
} from "../src/analyze-reference-selection.js";

test("buildAnalyzeReferenceSelectionPlan normalizes defaults", () => {
  assert.deepEqual(buildAnalyzeReferenceSelectionPlan({}), {
    targetNodeId: undefined,
    includeExport: true,
    includeSvg: false
  });
});

test("deriveReferenceAnalysisDraft classifies landscape dashboard references", () => {
  const draft = deriveReferenceAnalysisDraft({
    fileName: "Agent_skill_test",
    pageName: "Codex Generated Screens",
    xml: '<selection><frame id="1:2" name="clone dashboard" width="1200" height="900"></frame></selection>'
  });

  assert.equal(draft.heuristic, "dashboard-landscape");
  assert.equal(draft.referenceAnalysis.width, 1200);
  assert.equal(draft.referenceAnalysis.height, 900);
  assert.equal(draft.referenceAnalysis.backgroundColor, "#F7F8FA");
  assert.deepEqual(
    draft.referenceAnalysis.sections.map((section) => section.type),
    [
      "navigation",
      "header",
      "summary-cards",
      "summary-cards",
      "summary-cards",
      "timeline",
      "table",
      "actions"
    ]
  );
  assert.deepEqual(
    draft.intentSections.map((section) => section.intent),
    [
      "screen/sidebar",
      "screen/topbar",
      "content/section",
      "content/section",
      "content/section",
      "content/section",
      "data/table",
      "screen/actions"
    ]
  );
});

test("deriveReferenceAnalysisDraft classifies portrait references as mobile detail", () => {
  const draft = deriveReferenceAnalysisDraft({
    fileName: "Agent_skill_test",
    pageName: "Codex Generated Screens",
    xml: '<selection><frame id="1:3" name="ticket detail" width="390" height="844"></frame></selection>'
  });

  assert.equal(draft.heuristic, "mobile-detail");
  assert.equal(draft.referenceAnalysis.width, 390);
  assert.equal(draft.referenceAnalysis.height, 844);
  assert.deepEqual(
    draft.referenceAnalysis.sections.map((section) => section.type),
    ["header", "content", "actions"]
  );
  assert.deepEqual(
    draft.intentSections.map((section) => section.intent),
    ["screen/topbar", "content/section", "screen/actions"]
  );
});

test("deriveReferenceAnalysisDraft detects sidebar-like fragments before mobile fallback", () => {
  const draft = deriveReferenceAnalysisDraft({
    fileName: "Radix Themes (Community)",
    pageName: "Heading",
    xml: '<selection><frame id="3494:1037" name="sidebar-shell" width="122" height="248"></frame></selection>'
  });

  assert.equal(draft.heuristic, "sidebar-fragment");
  assert.equal(draft.confidence, "high");
  assert.deepEqual(
    draft.referenceAnalysis.sections.map((section) => section.type),
    ["navigation"]
  );
  assert.deepEqual(
    draft.intentSections.map((section) => section.intent),
    ["screen/sidebar"]
  );
});

test("deriveReferenceAnalysisDraft detects named header fragments before dashboard fallback", () => {
  const draft = deriveReferenceAnalysisDraft({
    fileName: "Radix Themes (Community)",
    pageName: "Heading",
    xml: '<selection><frame id="3526:1102" name="header" width="1440" height="17"></frame></selection>'
  });

  assert.equal(draft.heuristic, "header-fragment");
  assert.equal(draft.confidence, "high");
  assert.deepEqual(
    draft.referenceAnalysis.sections.map((section) => section.type),
    ["header"]
  );
  assert.deepEqual(
    draft.intentSections.map((section) => section.intent),
    ["screen/topbar"]
  );
});

test("deriveReferenceAnalysisDraft detects named action fragments before dashboard fallback", () => {
  const draft = deriveReferenceAnalysisDraft({
    fileName: "Radix Themes (Community)",
    pageName: "Heading",
    xml: '<selection><frame id="3526:1109" name="footer-actions" width="139" height="24"></frame></selection>'
  });

  assert.equal(draft.heuristic, "actions-fragment");
  assert.equal(draft.confidence, "medium");
  assert.deepEqual(
    draft.referenceAnalysis.sections.map((section) => section.type),
    ["actions"]
  );
  assert.deepEqual(
    draft.intentSections.map((section) => section.intent),
    ["screen/actions"]
  );
});
