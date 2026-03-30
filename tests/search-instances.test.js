import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSearchInstancesPlan,
  SEARCH_INSTANCES_DEFAULTS
} from "../src/search-instances.js";

test("buildSearchInstancesPlan normalizes query and target node id", () => {
  assert.deepEqual(
    buildSearchInstancesPlan({
      query: "  button  ",
      targetNodeId: "  123:4  ",
      includeProperties: false
    }),
    {
      query: "button",
      targetNodeId: "123:4",
      maxDepth: SEARCH_INSTANCES_DEFAULTS.maxDepth,
      maxResults: SEARCH_INSTANCES_DEFAULTS.maxResults,
      includeProperties: false
    }
  );
});

test("buildSearchInstancesPlan clamps numeric fields and defaults includeProperties", () => {
  assert.deepEqual(
    buildSearchInstancesPlan({
      maxDepth: 99,
      maxResults: 999
    }),
    {
      query: undefined,
      maxDepth: 10,
      maxResults: 300,
      includeProperties: true
    }
  );

  assert.deepEqual(
    buildSearchInstancesPlan({
      maxDepth: -2,
      maxResults: 0
    }),
    {
      query: undefined,
      maxDepth: 0,
      maxResults: 1,
      includeProperties: true
    }
  );
});
