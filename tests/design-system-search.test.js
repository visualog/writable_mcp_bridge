import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDesignSystemSearchPlan,
  mergeDesignSystemSearchResults
} from "../src/design-system-search.js";

test("buildDesignSystemSearchPlan normalizes defaults", () => {
  const plan = buildDesignSystemSearchPlan({});

  assert.equal(plan.query, "");
  assert.equal(plan.maxResults, 30);
  assert.deepEqual(plan.kinds, ["components", "styles", "variables"]);
  assert.deepEqual(plan.sources, ["local-file"]);
  assert.equal(plan.includeComponents, true);
  assert.equal(plan.includeStyles, true);
  assert.equal(plan.includeVariables, true);
  assert.deepEqual(plan.fileKeys, []);
});

test("buildDesignSystemSearchPlan clamps results and dedupes file keys", () => {
  const plan = buildDesignSystemSearchPlan({
    query: "  Button  ",
    maxResults: 500,
    fileKeys: ["abc", "abc", "def", ""]
  });

  assert.equal(plan.query, "button");
  assert.equal(plan.maxResults, 100);
  assert.deepEqual(plan.sources, ["all"]);
  assert.deepEqual(plan.fileKeys, ["abc", "def"]);
});

test("buildDesignSystemSearchPlan prefers kinds and sources over legacy flags", () => {
  const plan = buildDesignSystemSearchPlan({
    kinds: ["styles", "variables", "styles", "unknown"],
    sources: ["library-files", "local-file", "library-files"],
    includeComponents: true,
    includeStyles: false,
    includeVariables: false
  });

  assert.deepEqual(plan.kinds, ["styles", "variables"]);
  assert.deepEqual(plan.sources, ["library-files", "local-file"]);
  assert.equal(plan.includeComponents, false);
  assert.equal(plan.includeStyles, true);
  assert.equal(plan.includeVariables, true);
});

test("mergeDesignSystemSearchResults filters by type flags and query", () => {
  const result = mergeDesignSystemSearchResults(
    [
      {
        matches: [
          { sourceType: "LOCAL_COMPONENT", id: "1", assetType: "COMPONENT", name: "Button" },
          { sourceType: "LOCAL_STYLE", id: "2", assetType: "STYLE", name: "Primary Fill" },
          { sourceType: "LOCAL_VARIABLE", id: "3", assetType: "VARIABLE", name: "color/primary" }
        ]
      }
    ],
    {
      query: "pri",
      includeComponents: false,
      includeVariables: false
    }
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].name, "Primary Fill");
});

test("mergeDesignSystemSearchResults dedupes and truncates", () => {
  const result = mergeDesignSystemSearchResults(
    [
      {
        matches: [
          { sourceType: "LOCAL_COMPONENT", id: "1", assetType: "COMPONENT", name: "Avatar" },
          { sourceType: "LOCAL_COMPONENT", id: "1", assetType: "COMPONENT", name: "Avatar" },
          { sourceType: "LOCAL_COMPONENT_SET", id: "2", assetType: "COMPONENT_SET", name: "Badge" },
          { sourceType: "LOCAL_STYLE", id: "3", assetType: "STYLE", name: "Card Shadow" }
        ]
      }
    ],
    { maxResults: 2 }
  );

  assert.equal(result.matches.length, 2);
  assert.equal(result.truncated, true);
  assert.deepEqual(
    result.matches.map((item) => item.name),
    ["Avatar", "Badge"]
  );
});

test("mergeDesignSystemSearchResults filters by source model", () => {
  const result = mergeDesignSystemSearchResults(
    [
      {
        matches: [
          { sourceType: "LOCAL_COMPONENT", id: "1", assetType: "COMPONENT", name: "Button" },
          { sourceType: "FILE_COMPONENT", id: "2", assetType: "COMPONENT", name: "Button Remote" }
        ]
      }
    ],
    {
      kinds: ["components"],
      sources: ["library-files"]
    }
  );

  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].name, "Button Remote");
  assert.deepEqual(result.sources, ["library-files"]);
});
