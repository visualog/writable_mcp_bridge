import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAddAnnotationPlan,
  buildBulkAddAnnotationsPlan,
  listSupportedAnnotationPropertyTypes
} from "../src/add-annotation.js";

test("listSupportedAnnotationPropertyTypes exposes supported annotation property pins", () => {
  assert.ok(listSupportedAnnotationPropertyTypes().includes("fills"));
  assert.ok(listSupportedAnnotationPropertyTypes().includes("textAlignHorizontal"));
  assert.ok(listSupportedAnnotationPropertyTypes().includes("mainComponent"));
});

test("buildAddAnnotationPlan normalizes annotation input", () => {
  assert.deepEqual(
    buildAddAnnotationPlan({
      targetNodeId: " 123:4 ",
      label: "  Main navigation ",
      properties: [" fills ", "fontSize"],
      replace: true
    }),
    {
      targetNodeId: "123:4",
      label: "Main navigation",
      properties: ["fills", "fontSize"],
      replace: true
    }
  );
});

test("buildAddAnnotationPlan accepts markdown-only annotations", () => {
  assert.deepEqual(
    buildAddAnnotationPlan({
      labelMarkdown: "  # Important\nUse DS button  "
    }),
    {
      labelMarkdown: "# Important\nUse DS button"
    }
  );
});

test("buildAddAnnotationPlan supports clear mode", () => {
  assert.deepEqual(
    buildAddAnnotationPlan({
      targetNodeId: "123:4",
      clear: true
    }),
    {
      targetNodeId: "123:4",
      clear: true
    }
  );
});

test("buildAddAnnotationPlan rejects empty annotations and unsupported properties", () => {
  assert.throws(() => buildAddAnnotationPlan({}), /requires label, labelMarkdown, or properties/);
  assert.throws(
    () => buildAddAnnotationPlan({ label: "Note", properties: ["bogus"] }),
    /properties must be one of:/
  );
});

test("buildBulkAddAnnotationsPlan normalizes multiple annotations", () => {
  const plan = buildBulkAddAnnotationsPlan({
    annotations: [
      { targetNodeId: "123:4", label: "Main navigation" },
      { targetNodeId: "123:5", labelMarkdown: "**Body**" }
    ]
  });

  assert.equal(plan.annotations.length, 2);
  assert.equal(plan.annotations[0].label, "Main navigation");
  assert.equal(plan.annotations[1].labelMarkdown, "**Body**");
});

test("buildBulkAddAnnotationsPlan rejects empty input", () => {
  assert.throws(
    () => buildBulkAddAnnotationsPlan({ annotations: [] }),
    /annotations is required/
  );
});
