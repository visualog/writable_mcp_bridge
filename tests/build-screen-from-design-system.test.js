import test from "node:test";
import assert from "node:assert/strict";

import {
  buildScreenFromDesignSystemPlan,
  buildSectionBlueprints
} from "../src/build-screen-from-design-system.js";

test("buildScreenFromDesignSystemPlan normalizes defaults", () => {
  const plan = buildScreenFromDesignSystemPlan({
    parentId: "33023:62"
  });

  assert.deepEqual(plan, {
    parentId: "33023:62",
    name: "screen",
    width: 393,
    height: 852,
    x: undefined,
    y: undefined,
    sections: ["header", "content", "actions"],
    backgroundColor: "#FFFFFF",
    paddingX: 24,
    paddingY: 24,
    sectionGap: 24,
    contentGap: 16
  });
});

test("buildScreenFromDesignSystemPlan supports custom sections and sizing", () => {
  const plan = buildScreenFromDesignSystemPlan({
    parentId: "33023:62",
    name: "ticket-detail",
    width: 430,
    height: 932,
    sections: ["header", "content", "content", "actions", "unknown"],
    x: 100,
    y: 200,
    backgroundColor: "#F9FAFB",
    paddingX: 20,
    paddingY: 28,
    sectionGap: 20,
    contentGap: 12
  });

  assert.deepEqual(plan, {
    parentId: "33023:62",
    name: "ticket-detail",
    width: 430,
    height: 932,
    x: 100,
    y: 200,
    sections: ["header", "content", "actions"],
    backgroundColor: "#F9FAFB",
    paddingX: 20,
    paddingY: 28,
    sectionGap: 20,
    contentGap: 12
  });
});

test("buildScreenFromDesignSystemPlan requires parentId", () => {
  assert.throws(
    () => buildScreenFromDesignSystemPlan({}),
    /parentId is required/
  );
});

test("buildSectionBlueprints returns deterministic section layouts", () => {
  const plan = buildScreenFromDesignSystemPlan({
    parentId: "33023:62",
    sections: ["header", "content", "actions"],
    contentGap: 20
  });

  const blueprints = buildSectionBlueprints(plan);
  assert.equal(blueprints.length, 3);
  assert.deepEqual(
    blueprints.map((item) => item.name),
    ["header", "content", "actions"]
  );
  assert.equal(blueprints[0].layoutMode, "HORIZONTAL");
  assert.equal(blueprints[1].layoutGrow, 1);
  assert.equal(blueprints[1].itemSpacing, 20);
  assert.equal(blueprints[2].height, 52);
});
