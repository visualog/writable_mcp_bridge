import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshotPlan,
  snapshotNodeTree
} from "../src/scene-snapshot.js";

function makeSourceTree() {
  return {
    id: "root",
    name: "Today Header",
    type: "FRAME",
    x: 24,
    y: 40,
    width: 320,
    height: 120,
    visible: true,
    opacity: 1,
    fillColor: "FFFFFF",
    children: [
      {
        id: "title",
        name: "Title",
        type: "TEXT",
        x: 0,
        y: 0,
        width: 120,
        height: 28,
        visible: true,
        opacity: 1,
        characters: "Today",
        children: []
      },
      {
        id: "badge",
        name: "Badge",
        type: "INSTANCE",
        x: 0,
        y: 40,
        width: 48,
        height: 24,
        visible: true,
        opacity: 1,
        children: []
      }
    ]
  };
}

test("buildSnapshotPlan normalizes depth and node limits", () => {
  const plan = buildSnapshotPlan({ maxDepth: 99, maxNodes: 0 });

  assert.equal(plan.maxDepth, 5);
  assert.equal(plan.maxNodes, 1);
  assert.equal(plan.placeholderInstances, true);
});

test("snapshotNodeTree preserves supported node fields", () => {
  const result = snapshotNodeTree(makeSourceTree(), {
    maxDepth: 3,
    maxNodes: 10
  });

  assert.equal(result.snapshot.name, "Today Header");
  assert.equal(result.snapshot.type, "FRAME");
  assert.equal(result.snapshot.children.length, 2);
  assert.equal(result.snapshot.children[0].characters, "Today");
  assert.equal(result.snapshot.children[1].type, "INSTANCE");
});

test("snapshotNodeTree clamps traversal depth", () => {
  const root = makeSourceTree();
  root.children[0].children = [
    {
      id: "nested",
      name: "Nested Label",
      type: "TEXT",
      x: 0,
      y: 0,
      width: 40,
      height: 16,
      visible: true,
      opacity: 1,
      characters: "Nested",
      children: []
    }
  ];

  const result = snapshotNodeTree(root, { maxDepth: 1, maxNodes: 10 });

  assert.equal(result.snapshot.children[0].children.length, 0);
  assert.equal(result.truncated, true);
});

test("snapshotNodeTree rejects unsupported nodes when placeholders are disabled", () => {
  const root = makeSourceTree();
  root.children.push({
    id: "vector",
    name: "Vector",
    type: "VECTOR",
    x: 0,
    y: 80,
    width: 32,
    height: 32,
    visible: true,
    opacity: 1,
    children: []
  });

  assert.throws(
    () =>
      snapshotNodeTree(root, {
        maxDepth: 3,
        maxNodes: 10,
        placeholderInstances: false
      }),
    /Unsupported node type/
  );
});

test("snapshotNodeTree supports component roots as snapshot sources", () => {
  const root = {
    ...makeSourceTree(),
    type: "COMPONENT"
  };

  const result = snapshotNodeTree(root, {
    maxDepth: 3,
    maxNodes: 10
  });

  assert.equal(result.snapshot.type, "COMPONENT");
  assert.equal(result.snapshot.children.length, 2);
});
