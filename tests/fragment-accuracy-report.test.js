import test from "node:test";
import assert from "node:assert/strict";

import { evaluateFragmentGoldenSet } from "../src/fragment-accuracy-report.js";

test("evaluateFragmentGoldenSet returns full pass summary for matching cases", () => {
  const result = evaluateFragmentGoldenSet([
    {
      id: "header-case",
      expectedHeuristic: "header-fragment",
      expectedSectionTypes: ["header"],
      expectedIntentSections: ["screen/topbar"],
      metadata: {
        xml: '<selection><frame id="1:1" name="header" width="1200" height="80"></frame></selection>'
      }
    },
    {
      id: "action-case",
      expectedHeuristic: "actions-fragment",
      expectedSectionTypes: ["actions"],
      expectedIntentSections: ["screen/actions"],
      metadata: {
        xml: '<selection><frame id="1:2" name="footer-actions" width="320" height="48"></frame></selection>'
      }
    }
  ]);

  assert.equal(result.summary.caseCount, 2);
  assert.equal(result.summary.fullPassCount, 2);
  assert.equal(result.summary.fullPassRatio, 1);
  assert.equal(result.details.every((item) => item.pass), true);
});

test("evaluateFragmentGoldenSet reports mismatch details", () => {
  const result = evaluateFragmentGoldenSet([
    {
      id: "mismatch",
      expectedHeuristic: "header-fragment",
      expectedSectionTypes: ["header"],
      expectedIntentSections: ["screen/topbar"],
      metadata: {
        xml: '<selection><frame id="1:3" name="sidebar-shell" width="122" height="248"></frame></selection>'
      }
    }
  ]);

  assert.equal(result.summary.caseCount, 1);
  assert.equal(result.summary.fullPassCount, 0);
  assert.equal(result.details[0].heuristic.match, false);
});
