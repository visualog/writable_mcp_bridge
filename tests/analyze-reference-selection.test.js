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
});
