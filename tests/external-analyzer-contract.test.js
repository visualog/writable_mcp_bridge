import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeExternalComposeInput,
  normalizeIntentSection,
  normalizeReferenceAnalysis
} from "../src/external-analyzer-contract.js";

test("normalizeIntentSection keeps allowed fields and requires intent", () => {
  const normalized = normalizeIntentSection(
    {
      intent: "screen/topbar",
      title: "Overview",
      unknown: "ignored",
      leftItems: [{ helper: "text" }]
    },
    0
  );

  assert.equal(normalized.intent, "screen/topbar");
  assert.equal(normalized.title, "Overview");
  assert.deepEqual(normalized.leftItems, [{ helper: "text" }]);
  assert.equal("unknown" in normalized, false);
});

test("normalizeReferenceAnalysis normalizes sections and nested intentSections", () => {
  const normalized = normalizeReferenceAnalysis({
    width: 1440,
    sections: [{ type: "navigation", name: "sidebar", headerTitle: "Workspace" }],
    intentSections: [{ intent: "screen/sidebar", title: "Workspace" }]
  });

  assert.equal(normalized.width, 1440);
  assert.equal(normalized.sections[0].type, "navigation");
  assert.equal(normalized.intentSections[0].intent, "screen/sidebar");
});

test("normalizeExternalComposeInput normalizes top-level compose payload", () => {
  const normalized = normalizeExternalComposeInput({
    sections: [{ intent: "screen/topbar", title: "Topbar" }],
    intentSections: [{ intent: "screen/sidebar", title: "Sidebar" }],
    referenceAnalysis: {
      sections: [{ type: "header", name: "header", headerTitle: "Header" }]
    }
  });

  assert.equal(normalized.sections[0].intent, "screen/topbar");
  assert.equal(normalized.intentSections[0].intent, "screen/sidebar");
  assert.equal(normalized.referenceAnalysis.sections[0].type, "header");
});
