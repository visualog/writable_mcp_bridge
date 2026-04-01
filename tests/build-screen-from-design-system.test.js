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
    sectionSpecs: [
      { key: "header", type: "header", name: "header", contentComponentQueries: [] },
      { key: "content", type: "content", name: "content", contentComponentQueries: [] },
      { key: "actions", type: "actions", name: "actions", contentComponentQueries: [] }
    ],
    backgroundColor: "#FFFFFF",
    headerQuery: undefined,
    headerTitle: undefined,
    contentTitle: undefined,
    contentBody: undefined,
    contentComponentQueries: [],
    primaryActionQuery: undefined,
    primaryActionLabel: undefined,
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
    sectionSpecs: [
      { key: "header", type: "header", name: "header", contentComponentQueries: [] },
      { key: "content", type: "content", name: "content", contentComponentQueries: [] },
      { key: "actions", type: "actions", name: "actions", contentComponentQueries: [] }
    ],
    backgroundColor: "#F9FAFB",
    headerQuery: undefined,
    headerTitle: undefined,
    contentTitle: undefined,
    contentBody: undefined,
    contentComponentQueries: [],
    primaryActionQuery: undefined,
    primaryActionLabel: undefined,
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

test("buildScreenFromDesignSystemPlan keeps content copy inputs", () => {
  const plan = buildScreenFromDesignSystemPlan({
    parentId: "33023:62",
    contentTitle: "Detail",
    contentBody: "Body copy"
  });

  assert.equal(plan.contentTitle, "Detail");
  assert.equal(plan.contentBody, "Body copy");
  assert.deepEqual(plan.contentComponentQueries, []);
});

test("buildScreenFromDesignSystemPlan keeps unique content component queries", () => {
  const plan = buildScreenFromDesignSystemPlan({
    parentId: "33023:62",
    contentComponentQueries: ["Card", "List", "Card", "", null]
  });

  assert.deepEqual(plan.contentComponentQueries, ["Card", "List"]);
});

test("buildScreenFromDesignSystemPlan supports typed section specs", () => {
  const plan = buildScreenFromDesignSystemPlan({
    parentId: "33023:62",
    sectionSpecs: [
      { type: "navigation", name: "left-nav" },
      { type: "summary-cards", name: "kpis" },
      { type: "table", name: "project-table", contentComponentQueries: ["TableRow", "TableRow"] },
      { type: "actions", primaryActionQuery: "button", primaryActionLabel: "Continue" },
      { type: "unknown", name: "skip-me" }
    ]
  });

  assert.deepEqual(plan.sections, ["navigation", "summary-cards", "table", "actions"]);
  assert.deepEqual(plan.sectionSpecs, [
    { key: "left-nav", type: "navigation", name: "left-nav", contentComponentQueries: [] },
    { key: "kpis", type: "summary-cards", name: "kpis", contentComponentQueries: [] },
    {
      key: "project-table",
      type: "table",
      name: "project-table",
      contentComponentQueries: ["TableRow"]
    },
    {
      key: "actions",
      type: "actions",
      name: "actions",
      primaryActionQuery: "button",
      primaryActionLabel: "Continue",
      contentComponentQueries: []
    }
  ]);
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

test("buildSectionBlueprints supports typed sections beyond the legacy scaffold", () => {
  const plan = buildScreenFromDesignSystemPlan({
    parentId: "33023:62",
    sectionSpecs: [
      { type: "navigation", name: "left-nav" },
      { type: "summary-cards", name: "kpis" },
      { type: "timeline", name: "schedule" },
      { type: "table", name: "project-table" }
    ]
  });

  const blueprints = buildSectionBlueprints(plan);
  assert.deepEqual(
    blueprints.map((item) => item.type),
    ["navigation", "summary-cards", "timeline", "table"]
  );
  assert.equal(blueprints[0].layoutMode, "VERTICAL");
  assert.equal(blueprints[1].layoutMode, "HORIZONTAL");
  assert.equal(blueprints[2].height, 360);
  assert.equal(blueprints[3].height, 320);
  assert.deepEqual(
    blueprints.map((item) => item.name),
    ["left-nav", "kpis", "schedule", "project-table"]
  );
});
