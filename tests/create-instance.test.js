import test from "node:test";
import assert from "node:assert/strict";

import { buildCreateInstancePlan } from "../src/create-instance.js";

test("buildCreateInstancePlan normalizes required and optional fields", () => {
  const plan = buildCreateInstancePlan({
    sourceNodeId: " 100:1 ",
    parentId: " 200:1 ",
    name: "Primary CTA",
    index: 2,
    x: 120,
    y: 240
  });

  assert.deepEqual(plan, {
    sourceNodeId: "100:1",
    parentId: "200:1",
    name: "Primary CTA",
    index: 2,
    x: 120,
    y: 240
  });
});

test("buildCreateInstancePlan falls back to defaultParentId", () => {
  const plan = buildCreateInstancePlan({
    sourceNodeId: "100:1",
    defaultParentId: "page:1"
  });

  assert.deepEqual(plan, {
    sourceNodeId: "100:1",
    parentId: "page:1"
  });
});

test("buildCreateInstancePlan requires sourceNodeId and a parent source", () => {
  assert.throws(() => buildCreateInstancePlan({ parentId: "200:1" }), /sourceNodeId is required/);
  assert.throws(
    () => buildCreateInstancePlan({ sourceNodeId: "100:1" }),
    /parentId is required when there is no registered current page/
  );
});
