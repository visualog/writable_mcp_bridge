import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBindVariablePlan,
  listSupportedBindVariableFields
} from "../src/bind-variable.js";

test("listSupportedBindVariableFields exposes simple and paint bindings", () => {
  const fields = listSupportedBindVariableFields();

  assert.ok(fields.includes("width"));
  assert.ok(fields.includes("itemSpacing"));
  assert.ok(fields.includes("fills.color"));
  assert.ok(fields.includes("strokes.color"));
});

test("buildBindVariablePlan normalizes variable id bindings", () => {
  assert.deepEqual(
    buildBindVariablePlan({
      nodeId: "123:4",
      property: "fills.color",
      variableId: "VariableID:1:2"
    }),
    {
      nodeId: "123:4",
      property: "fills.color",
      variableId: "VariableID:1:2"
    }
  );
});

test("buildBindVariablePlan supports variable key bindings and unbind mode", () => {
  assert.deepEqual(
    buildBindVariablePlan({
      nodeId: "123:4",
      property: "width",
      variableKey: "VariableKey:abc"
    }),
    {
      nodeId: "123:4",
      property: "width",
      variableKey: "VariableKey:abc"
    }
  );

  assert.deepEqual(
    buildBindVariablePlan({
      nodeId: "123:4",
      property: "strokes.color",
      unbind: true
    }),
    {
      nodeId: "123:4",
      property: "strokes.color",
      unbind: true
    }
  );
});

test("buildBindVariablePlan rejects invalid combinations", () => {
  assert.throws(
    () => buildBindVariablePlan({ nodeId: "123:4", property: "fills.color" }),
    /variableId, variableKey, or unbind=true is required/
  );

  assert.throws(
    () =>
      buildBindVariablePlan({
        nodeId: "123:4",
        property: "fills.color",
        variableId: "VariableID:1:2",
        unbind: true
      }),
    /unbind cannot be combined/
  );

  assert.throws(
    () =>
      buildBindVariablePlan({
        nodeId: "123:4",
        property: "effects.color",
        variableId: "VariableID:1:2"
      }),
    /Unsupported bindable property/
  );
});
