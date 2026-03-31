import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFindOrImportComponentPlan,
  selectPreferredComponentMatch
} from "../src/find-or-import-component.js";

test("buildFindOrImportComponentPlan normalizes required and optional fields", () => {
  assert.deepEqual(
    buildFindOrImportComponentPlan({
      query: "  button ",
      parentId: " 123:4 ",
      fileKeys: ["abc", "abc", "def", ""],
      assetTypes: ["component_set", "component", "bad"],
      preferLocal: false,
      maxResults: 99,
      index: 2,
      x: 40,
      y: 80
    }),
    {
      query: "button",
      parentId: "123:4",
      fileKeys: ["abc", "def"],
      maxResults: 50,
      assetTypes: ["COMPONENT_SET", "COMPONENT"],
      preferLocal: false,
      index: 2,
      x: 40,
      y: 80
    }
  );
});

test("buildFindOrImportComponentPlan rejects missing query and parentId", () => {
  assert.throws(
    () => buildFindOrImportComponentPlan({ parentId: "123:4" }),
    /query is required/
  );
  assert.throws(
    () => buildFindOrImportComponentPlan({ query: "button" }),
    /parentId is required/
  );
});

test("selectPreferredComponentMatch prefers exact local component matches", () => {
  const match = selectPreferredComponentMatch(
    [
      {
        sourceType: "FILE_COMPONENT",
        assetType: "COMPONENT",
        name: "Button",
        key: "remote-exact"
      },
      {
        sourceType: "LOCAL_COMPONENT",
        assetType: "COMPONENT",
        name: "Button",
        key: "local-exact"
      },
      {
        sourceType: "LOCAL_COMPONENT_SET",
        assetType: "COMPONENT_SET",
        name: "Button Group",
        key: "local-set"
      }
    ],
    {
      query: "button",
      parentId: "123:4",
      preferLocal: true
    }
  );

  assert.equal(match.key, "local-exact");
});

test("selectPreferredComponentMatch can target component sets only", () => {
  const match = selectPreferredComponentMatch(
    [
      {
        sourceType: "LOCAL_COMPONENT",
        assetType: "COMPONENT",
        name: "Button",
        key: "component"
      },
      {
        sourceType: "LOCAL_COMPONENT_SET",
        assetType: "COMPONENT_SET",
        name: "Button",
        key: "component-set"
      }
    ],
    {
      query: "button",
      parentId: "123:4",
      assetTypes: ["COMPONENT_SET"]
    }
  );

  assert.equal(match.key, "component-set");
});

