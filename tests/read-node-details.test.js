import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNodeDetailsPlan,
  buildComponentVariantDetailsPlan,
  buildInstanceDetailsPlan
} from "../src/read-node-details.js";

test("buildNodeDetailsPlan accepts nodeId alias for targetNodeId", () => {
  const plan = buildNodeDetailsPlan({
    nodeId: " 2:167 ",
    detailLevel: "layout",
    maxDepth: 2
  });

  assert.equal(plan.targetNodeId, "2:167");
  assert.equal(plan.detailLevel, "layout");
  assert.equal(plan.maxDepth, 2);
  assert.equal(plan.maxNodes, 48);
  assert.equal(plan.includeChildren, false);
});

test("buildComponentVariantDetailsPlan accepts nodeId alias", () => {
  const plan = buildComponentVariantDetailsPlan({
    nodeId: "2:203"
  });

  assert.equal(plan.targetNodeId, "2:203");
  assert.equal(plan.detailLevel, "full");
  assert.equal(plan.maxDepth, 2);
  assert.equal(plan.maxNodes, 56);
});

test("buildInstanceDetailsPlan accepts nodeId alias and includeResolvedChildren", () => {
  const plan = buildInstanceDetailsPlan({
    nodeId: "2:203",
    maxNodes: 24,
    includeResolvedChildren: true
  });

  assert.equal(plan.targetNodeId, "2:203");
  assert.equal(plan.detailLevel, "full");
  assert.equal(plan.maxNodes, 24);
  assert.equal(plan.includeResolvedChildren, true);
});
