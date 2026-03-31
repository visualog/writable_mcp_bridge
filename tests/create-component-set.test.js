import test from "node:test";
import assert from "node:assert/strict";

import { buildCreateComponentSetPlan } from "../src/create-component-set.js";

test("buildCreateComponentSetPlan normalizes component ids and optional fields", () => {
  assert.deepEqual(
    buildCreateComponentSetPlan({
      componentNodeIds: [" 12:1 ", "12:2", "12:1"],
      parentId: " 10:1 ",
      index: 2.8,
      name: " Button ",
      description: " Primary buttons "
    }),
    {
      componentNodeIds: ["12:1", "12:2"],
      parentId: "10:1",
      index: 2,
      name: "Button",
      description: "Primary buttons"
    }
  );
});

test("buildCreateComponentSetPlan rejects insufficient ids", () => {
  assert.throws(
    () => buildCreateComponentSetPlan({ componentNodeIds: ["12:1"] }),
    /at least two component node ids/
  );
  assert.throws(
    () => buildCreateComponentSetPlan({ componentNodeIds: ["12:1", "12:1"] }),
    /at least two unique component node ids/
  );
});
