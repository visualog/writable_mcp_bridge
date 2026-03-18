import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportLibraryComponentPlan,
  listSupportedImportLibraryAssetTypes
} from "../src/import-library-component.js";

test("listSupportedImportLibraryAssetTypes exposes importable library asset types", () => {
  assert.deepEqual(listSupportedImportLibraryAssetTypes(), [
    "COMPONENT",
    "COMPONENT_SET"
  ]);
});

test("buildImportLibraryComponentPlan defaults asset type and keeps placement metadata", () => {
  const plan = buildImportLibraryComponentPlan({
    key: "cmp_123",
    parentId: "214:563",
    name: "Today Hero",
    x: 24,
    y: 120,
    index: 2
  });

  assert.equal(plan.key, "cmp_123");
  assert.equal(plan.parentId, "214:563");
  assert.equal(plan.assetType, "COMPONENT");
  assert.equal(plan.name, "Today Hero");
  assert.equal(plan.x, 24);
  assert.equal(plan.y, 120);
  assert.equal(plan.index, 2);
});

test("buildImportLibraryComponentPlan supports component sets", () => {
  const plan = buildImportLibraryComponentPlan({
    key: "set_123",
    parentId: "214:563",
    assetType: "COMPONENT_SET"
  });

  assert.equal(plan.assetType, "COMPONENT_SET");
});

test("buildImportLibraryComponentPlan rejects non-importable asset types", () => {
  assert.throws(
    () =>
      buildImportLibraryComponentPlan({
        key: "style_123",
        parentId: "214:563",
        assetType: "STYLE"
      }),
    /Unsupported library asset type/
  );
});

test("buildImportLibraryComponentPlan requires key and parentId", () => {
  assert.throws(() => buildImportLibraryComponentPlan({ parentId: "214:563" }), /key is required/);
  assert.throws(() => buildImportLibraryComponentPlan({ key: "cmp_123" }), /parentId is required/);
});
