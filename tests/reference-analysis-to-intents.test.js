import test from "node:test";
import assert from "node:assert/strict";

import { deriveIntentSectionsFromReferenceAnalysis } from "../src/reference-analysis-to-intents.js";

test("deriveIntentSectionsFromReferenceAnalysis maps dashboard-like section types to semantic intents", () => {
  const sections = deriveIntentSectionsFromReferenceAnalysis({
    sections: [
      { type: "navigation", name: "sidebar", headerTitle: "Workspace" },
      { type: "header", name: "topbar", headerTitle: "Dashboard" },
      { type: "summary-cards", name: "kpis", contentTitle: "Overall Tasks", contentBody: "Spread across projects." },
      { type: "table", name: "project-list", contentTitle: "Projects", contentBody: "All active work." }
    ]
  });

  assert.deepEqual(
    sections.map((item) => item.intent),
    ["screen/sidebar", "screen/topbar", "content/section", "data/table"]
  );
  assert.equal(sections[2].children[0].helper, "card");
  assert.deepEqual(sections[3].columns, ["Name", "Summary"]);
});
