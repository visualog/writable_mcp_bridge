import test from "node:test";
import assert from "node:assert/strict";

import {
  buildApplyStylePlan,
  listSupportedApplyStyleTypes
} from "../src/apply-style.js";

test("listSupportedApplyStyleTypes exposes supported style types", () => {
  assert.deepEqual(listSupportedApplyStyleTypes(), ["text", "effect"]);
});

test("buildApplyStylePlan normalizes style id and style key requests", () => {
  assert.deepEqual(
    buildApplyStylePlan({
      nodeId: "123:4",
      styleType: "text",
      styleId: "StyleID:1:2"
    }),
    {
      nodeId: "123:4",
      styleType: "text",
      styleId: "StyleID:1:2"
    }
  );

  assert.deepEqual(
    buildApplyStylePlan({
      nodeId: "123:4",
      styleType: "effect",
      styleKey: "S:abc"
    }),
    {
      nodeId: "123:4",
      styleType: "effect",
      styleKey: "S:abc"
    }
  );
});

test("buildApplyStylePlan supports clear mode and rejects invalid combinations", () => {
  assert.deepEqual(
    buildApplyStylePlan({
      nodeId: "123:4",
      styleType: "text",
      clear: true
    }),
    {
      nodeId: "123:4",
      styleType: "text",
      clear: true
    }
  );

  assert.throws(
    () => buildApplyStylePlan({ nodeId: "123:4", styleType: "text" }),
    /styleId, styleKey, or clear=true is required/
  );

  assert.throws(
    () =>
      buildApplyStylePlan({
        nodeId: "123:4",
        styleType: "effect",
        styleId: "StyleID:1:2",
        clear: true
      }),
    /clear cannot be combined/
  );
});
