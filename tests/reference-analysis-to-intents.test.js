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

test("deriveIntentSectionsFromReferenceAnalysis maps table schema and action groups", () => {
  const sections = deriveIntentSectionsFromReferenceAnalysis({
    sections: [
      {
        type: "table",
        name: "project-list",
        density: "compact",
        tableColumns: [
          { key: "task", label: "Task", width: 260, align: "min" },
          { key: "progress", label: "Progress", width: 140, align: "max" }
        ],
        tableRowPattern: ["media-row", { type: "progress-bar" }]
      },
      {
        type: "actions",
        name: "footer-actions",
        actionGroups: [
          {
            label: "Primary",
            actions: [{ label: "Create" }, { label: "Share" }]
          }
        ]
      }
    ]
  });

  assert.equal(sections[0].intent, "data/table");
  assert.equal(sections[0].density, "compact");
  assert.equal(sections[0].columns[0].width, 260);
  assert.equal(sections[0].rows[0].cells[0].pattern, "media-row");
  assert.equal(sections[0].rows[0].cells[1].helper, "progress-bar");

  assert.equal(sections[1].intent, "screen/actions");
  assert.equal(sections[1].children[0].helper, "row");
  assert.equal(sections[1].children[0].children[1].characters, "Create · Share");
});
