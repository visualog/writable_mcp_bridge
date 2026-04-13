import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGetAnnotationsPlan,
  normalizeAnnotationReadResult
} from "../src/read-annotations.js";

test("buildGetAnnotationsPlan normalizes node targeting and defaults", () => {
  assert.deepEqual(
    buildGetAnnotationsPlan({
      targetNodeId: " 10:1 "
    }),
    {
      targetNodeId: "10:1",
      includeInferredComments: true
    }
  );

  assert.deepEqual(
    buildGetAnnotationsPlan({
      nodeId: " 20:9 ",
      includeInferredComments: false
    }),
    {
      targetNodeId: "20:9",
      includeInferredComments: false
    }
  );
});

test("normalizeAnnotationReadResult returns explicit structured fields and inferred comments", () => {
  const result = normalizeAnnotationReadResult({
    source: "explicit",
    node: {
      id: "10:1",
      name: "Card",
      type: "FRAME"
    },
    annotations: [
      {
        label: "Keep spacing tokenized",
        properties: [{ type: "padding" }]
      },
      {
        labelMarkdown: "**Use DS body**"
      }
    ]
  });

  assert.equal(result.source, "explicit");
  assert.equal(result.targetNodeId, "10:1");
  assert.equal(result.node.id, "10:1");
  assert.equal(result.count.annotations, 2);
  assert.equal(result.count.comments, 2);
  assert.equal(result.annotations[0].source, "explicit");
  assert.equal(result.annotations[0].annotationIndex, 0);
  assert.equal(result.annotations[0].properties[0].type, "padding");
  assert.equal(result.comments[0].source, "inferred");
  assert.equal(result.comments[0].format, "plain");
  assert.equal(result.comments[1].format, "markdown");
});

test("normalizeAnnotationReadResult can suppress inferred comments", () => {
  const result = normalizeAnnotationReadResult(
    {
      source: "inferred",
      node: {
        id: "11:2",
        name: "Sidebar",
        type: "FRAME"
      },
      annotations: [{ label: "Do not collapse spacing" }]
    },
    { includeInferredComments: false }
  );

  assert.equal(result.source, "inferred");
  assert.equal(result.count.annotations, 1);
  assert.equal(result.count.comments, 0);
  assert.deepEqual(result.comments, []);
});
