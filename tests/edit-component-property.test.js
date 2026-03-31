import test from "node:test";
import assert from "node:assert/strict";

import { buildEditComponentPropertyPlan } from "../src/edit-component-property.js";

test("buildEditComponentPropertyPlan normalizes rename and default value updates", () => {
  assert.deepEqual(
    buildEditComponentPropertyPlan({
      targetNodeId: " 123:4 ",
      propertyName: " ButtonText#0:1 ",
      name: " Label ",
      defaultValue: " Submit "
    }),
    {
      targetNodeId: "123:4",
      propertyName: "ButtonText#0:1",
      name: "Label",
      defaultValue: "Submit"
    }
  );
});

test("buildEditComponentPropertyPlan supports boolean default updates", () => {
  assert.deepEqual(
    buildEditComponentPropertyPlan({
      targetNodeId: "123:4",
      propertyName: "Visible#0:0",
      defaultValue: false
    }),
    {
      targetNodeId: "123:4",
      propertyName: "Visible#0:0",
      defaultValue: false
    }
  );
});

test("buildEditComponentPropertyPlan rejects missing mutations and invalid defaults", () => {
  assert.throws(
    () =>
      buildEditComponentPropertyPlan({
        targetNodeId: "123:4",
        propertyName: "ButtonText#0:1"
      }),
    /name or defaultValue is required/
  );

  assert.throws(
    () =>
      buildEditComponentPropertyPlan({
        targetNodeId: "123:4",
        propertyName: "ButtonText#0:1",
        defaultValue: 1
      }),
    /defaultValue must be a string or boolean/
  );
});
