import test from "node:test";
import assert from "node:assert/strict";

import { validateExternalComposeInput } from "../src/validate-external-compose-input.js";

test("validateExternalComposeInput reports compose-ready payload", () => {
  const result = validateExternalComposeInput({
    parentId: "817:417",
    intentSections: [{ intent: "screen/topbar", title: "Dashboard" }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.canCompose, true);
  assert.equal(result.resolved.source, "intentSections");
  assert.equal(result.resolved.sectionCount, 1);
});

test("validateExternalComposeInput reports missing parentId and missing sections", () => {
  const result = validateExternalComposeInput({});

  assert.equal(result.ok, false);
  assert.equal(result.canCompose, false);
  assert.equal(result.errors[0].code, "missing_parent_id");
  assert.equal(result.errors[1].code, "missing_intent_sections");
});

test("validateExternalComposeInput warns when invalid entries are dropped", () => {
  const result = validateExternalComposeInput({
    parentId: "817:417",
    intentSections: [{ title: "Missing intent" }, { intent: "screen/sidebar", title: "Sidebar" }]
  });

  assert.equal(result.ok, true);
  assert.equal(result.warnings.some((warning) => warning.code === "dropped_entries"), true);
  assert.equal(result.resolved.sectionCount, 1);
});

test("validateExternalComposeInput derives sections from reference analysis when needed", () => {
  const result = validateExternalComposeInput({
    parentId: "817:417",
    referenceAnalysis: {
      sections: [{ type: "header", name: "header", headerTitle: "Overview" }]
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.resolved.source, "referenceAnalysis.sections");
  assert.equal(result.resolved.sectionCount, 1);
});
