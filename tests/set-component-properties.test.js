import test from "node:test";
import assert from "node:assert/strict";

import { buildSetComponentPropertiesPlan } from "../src/set-component-properties.js";

test("buildSetComponentPropertiesPlan normalizes node id and properties", () => {
  assert.deepEqual(
    buildSetComponentPropertiesPlan({
      nodeId: " 123:4 ",
      properties: {
        item1: "false",
        item2: "true",
        enabled: true
      }
    }),
    {
      nodeId: "123:4",
      properties: {
        item1: "false",
        item2: "true",
        enabled: true
      }
    }
  );
});

test("buildSetComponentPropertiesPlan rejects invalid input", () => {
  assert.throws(() => buildSetComponentPropertiesPlan({}), /nodeId is required/);
  assert.throws(
    () => buildSetComponentPropertiesPlan({ nodeId: "123:4" }),
    /properties object is required/
  );
  assert.throws(
    () => buildSetComponentPropertiesPlan({ nodeId: "123:4", properties: {} }),
    /properties must contain at least one entry/
  );
  assert.throws(
    () =>
      buildSetComponentPropertiesPlan({
        nodeId: "123:4",
        properties: { item1: 1 }
      }),
    /component property values must be strings or booleans/
  );
});
