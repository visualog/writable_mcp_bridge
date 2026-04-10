import test from "node:test";
import assert from "node:assert/strict";

import { buildAnalyzeSelectionToComposePlan } from "../src/analyze-selection-to-compose.js";

test("buildAnalyzeSelectionToComposePlan derives compose input from analysis result", () => {
  const plan = buildAnalyzeSelectionToComposePlan(
    {
      parentId: "817:417"
    },
    {
      selection: {
        name: "sidebar-shell"
      },
      referenceAnalysis: {
        width: 122,
        height: 248,
        backgroundColor: "#F7F8FA"
      },
      intentSections: [
        {
          key: "sidebar",
          intent: "screen/sidebar",
          title: "sidebar-shell"
        }
      ]
    }
  );

  assert.equal(plan.parentId, "817:417");
  assert.equal(plan.name, "sidebar-shell-composed");
  assert.equal(plan.width, 122);
  assert.equal(plan.height, 248);
  assert.equal(plan.backgroundColor, "#F7F8FA");
  assert.equal(plan.sections.length, 1);
});

test("buildAnalyzeSelectionToComposePlan requires parentId and intentSections", () => {
  assert.throws(
    () => buildAnalyzeSelectionToComposePlan({}, { intentSections: [{ intent: "screen/topbar" }] }),
    /parentId is required/
  );

  assert.throws(
    () => buildAnalyzeSelectionToComposePlan({ parentId: "1:2" }, {}),
    /intentSections/
  );
});
