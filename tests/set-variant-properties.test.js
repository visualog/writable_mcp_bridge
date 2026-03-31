import test from "node:test";
import assert from "node:assert/strict";

import { buildSetVariantPropertiesPlan } from "../src/set-variant-properties.js";

test("buildSetVariantPropertiesPlan normalizes component node id and properties", () => {
  assert.deepEqual(
    buildSetVariantPropertiesPlan({
      componentNodeId: " 123:4 ",
      variantProperties: {
        State: " Active ",
        Size: " M "
      }
    }),
    {
      componentNodeId: "123:4",
      variantProperties: {
        State: "Active",
        Size: "M"
      }
    }
  );
});

test("buildSetVariantPropertiesPlan rejects invalid input", () => {
  assert.throws(() => buildSetVariantPropertiesPlan({}), /componentNodeId is required/);
  assert.throws(
    () => buildSetVariantPropertiesPlan({ componentNodeId: "123:4" }),
    /variantProperties object is required/
  );
  assert.throws(
    () =>
      buildSetVariantPropertiesPlan({
        componentNodeId: "123:4",
        variantProperties: {}
      }),
    /variantProperties must contain at least one entry/
  );
  assert.throws(
    () =>
      buildSetVariantPropertiesPlan({
        componentNodeId: "123:4",
        variantProperties: { State: "" }
      }),
    /variant property values must be non-empty strings/
  );
});
