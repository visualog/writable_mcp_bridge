import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCreateFallbackPlan,
  buildReuseOrCreateComponentPlan
} from "../src/reuse-or-create-component.js";

test("buildReuseOrCreateComponentPlan normalizes search and create fields", () => {
  const plan = buildReuseOrCreateComponentPlan({
    query: " Button ",
    parentId: " 200:1 ",
    targetNodeId: " 300:2 ",
    createName: " Primary Button ",
    createDescription: " Main CTA "
  });

  assert.deepEqual(plan, {
    query: "Button",
    parentId: "200:1",
    fileKeys: [],
    maxResults: 10,
    assetTypes: ["COMPONENT", "COMPONENT_SET"],
    preferLocal: true,
    targetNodeId: "300:2",
    createName: "Primary Button",
    createDescription: "Main CTA"
  });
});

test("buildCreateFallbackPlan returns null without a target node", () => {
  assert.equal(
    buildCreateFallbackPlan({
      query: "Button"
    }),
    null
  );
});

test("buildCreateFallbackPlan uses explicit create fields with query fallback", () => {
  assert.deepEqual(
    buildCreateFallbackPlan({
      query: "Button",
      targetNodeId: "300:2",
      createName: "Primary Button",
      createDescription: "Main CTA"
    }),
    {
      targetNodeId: "300:2",
      name: "Primary Button",
      description: "Main CTA"
    }
  );

  assert.deepEqual(
    buildCreateFallbackPlan({
      query: "Button",
      targetNodeId: "300:2"
    }),
    {
      targetNodeId: "300:2",
      name: "Button"
    }
  );
});
