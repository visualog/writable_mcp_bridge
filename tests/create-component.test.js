import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreateComponentPlan,
  listSupportedCreateComponentSourceTypes
} from "../src/create-component.js";

test("listSupportedCreateComponentSourceTypes exposes first-slice source types", () => {
  assert.deepEqual(listSupportedCreateComponentSourceTypes(), [
    "FRAME",
    "GROUP",
    "COMPONENT"
  ]);
});

test("buildCreateComponentPlan normalizes required and optional fields", () => {
  assert.deepEqual(
    buildCreateComponentPlan({
      targetNodeId: " 123:4 ",
      name: "  promo/card ",
      description: "  Reusable promo card "
    }),
    {
      targetNodeId: "123:4",
      name: "promo/card",
      description: "Reusable promo card"
    }
  );
});

test("buildCreateComponentPlan rejects missing targetNodeId", () => {
  assert.throws(() => buildCreateComponentPlan({}), /targetNodeId is required/);
});
