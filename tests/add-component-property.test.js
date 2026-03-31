import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAddComponentPropertyPlan,
  listSupportedComponentPropertyTypes
} from "../src/add-component-property.js";

test("listSupportedComponentPropertyTypes exposes first-slice property types", () => {
  assert.deepEqual(listSupportedComponentPropertyTypes(), [
    "BOOLEAN",
    "TEXT",
    "VARIANT"
  ]);
});

test("buildAddComponentPropertyPlan normalizes required fields", () => {
  assert.deepEqual(
    buildAddComponentPropertyPlan({
      targetNodeId: " 123:4 ",
      propertyName: "  isOpen ",
      propertyType: " boolean ",
      defaultValue: true
    }),
    {
      targetNodeId: "123:4",
      propertyName: "isOpen",
      propertyType: "BOOLEAN",
      defaultValue: true
    }
  );
});

test("buildAddComponentPropertyPlan accepts string defaults for text-like property types", () => {
  assert.deepEqual(
    buildAddComponentPropertyPlan({
      targetNodeId: "123:4",
      propertyName: "tab",
      propertyType: "VARIANT",
      defaultValue: " item1 "
    }),
    {
      targetNodeId: "123:4",
      propertyName: "tab",
      propertyType: "VARIANT",
      defaultValue: "item1"
    }
  );
});

test("buildAddComponentPropertyPlan rejects invalid defaults", () => {
  assert.throws(
    () =>
      buildAddComponentPropertyPlan({
        targetNodeId: "123:4",
        propertyName: "isOpen",
        propertyType: "BOOLEAN",
        defaultValue: "true"
      }),
    /BOOLEAN component properties require a boolean defaultValue/
  );

  assert.throws(
    () =>
      buildAddComponentPropertyPlan({
        targetNodeId: "123:4",
        propertyName: "label",
        propertyType: "TEXT",
        defaultValue: false
      }),
    /TEXT component properties require a string defaultValue/
  );
}
);
