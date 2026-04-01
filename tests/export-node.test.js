import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExportNodePlan,
  listSupportedExportFormats
} from "../src/export-node.js";

test("listSupportedExportFormats exposes svg and png", () => {
  assert.deepEqual(listSupportedExportFormats(), ["svg", "png"]);
});

test("buildExportNodePlan normalizes export input", () => {
  assert.deepEqual(
    buildExportNodePlan({
      targetNodeId: " 33081:1638 ",
      format: "SVG",
      scale: 2,
      contentsOnly: true,
      useAbsoluteBounds: true,
      svgOutlineText: false,
      svgIdAttribute: true
    }),
    {
      targetNodeId: "33081:1638",
      format: "svg",
      scale: 2,
      contentsOnly: true,
      useAbsoluteBounds: true,
      svgOutlineText: false,
      svgIdAttribute: true
    }
  );
});

test("buildExportNodePlan defaults to svg and rejects unsupported formats", () => {
  assert.deepEqual(buildExportNodePlan({}), { format: "svg" });
  assert.throws(
    () => buildExportNodePlan({ format: "jpg" }),
    /format must be one of: svg, png/
  );
});
