import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReplayPlan,
  flattenReplayOperations
} from "../src/replay-snapshot.js";

const snapshot = {
  name: "Today Header",
  type: "FRAME",
  x: 24,
  y: 40,
  width: 320,
  height: 120,
  visible: true,
  opacity: 1,
  fillColor: "FFFFFF",
  children: [
    {
      name: "Title",
      type: "TEXT",
      x: 16,
      y: 16,
      width: 100,
      height: 24,
      visible: true,
      opacity: 1,
      characters: "Today",
      children: []
    },
    {
      name: "Badge",
      type: "INSTANCE",
      x: 16,
      y: 56,
      width: 48,
      height: 24,
      visible: true,
      opacity: 1,
      children: []
    }
  ]
};

test("buildReplayPlan creates a root replay node under the target parent", () => {
  const plan = buildReplayPlan(snapshot, { targetParentId: "4:3" });

  assert.equal(plan.targetParentId, "4:3");
  assert.equal(plan.root.name, "Today Header");
  assert.equal(plan.root.targetNodeType, "FRAME");
});

test("buildReplayPlan converts instances into placeholder frames", () => {
  const plan = buildReplayPlan(snapshot, { targetParentId: "4:3" });
  const operations = flattenReplayOperations(plan);
  const placeholder = operations.find((item) => item.name === "Badge");

  assert.equal(placeholder.targetNodeType, "FRAME");
  assert.equal(placeholder.placeholderFor, "INSTANCE");
});

test("flattenReplayOperations preserves parent-child relationships", () => {
  const plan = buildReplayPlan(snapshot, { targetParentId: "4:3" });
  const operations = flattenReplayOperations(plan);

  assert.equal(operations.length, 3);
  assert.equal(operations[0].parentRef, "4:3");
  assert.equal(operations[1].parentRef, operations[0].ref);
  assert.equal(operations[2].parentRef, operations[0].ref);
});
