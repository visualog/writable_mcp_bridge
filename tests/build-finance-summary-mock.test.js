import test from "node:test";
import assert from "node:assert/strict";

import { buildFinanceSummaryMockPlan } from "../src/build-finance-summary-mock.js";

test("buildFinanceSummaryMockPlan normalizes defaults", () => {
  const plan = buildFinanceSummaryMockPlan({
    parentId: "33023:62"
  });

  assert.deepEqual(plan, {
    parentId: "33023:62",
    name: "finance-summary-screen",
    width: 652,
    height: 1303,
    x: undefined,
    y: undefined
  });
});

test("buildFinanceSummaryMockPlan keeps explicit placement and name", () => {
  const plan = buildFinanceSummaryMockPlan({
    parentId: "33023:62",
    name: "demo-screen",
    x: 120,
    y: 240,
    width: 700,
    height: 1400
  });

  assert.deepEqual(plan, {
    parentId: "33023:62",
    name: "demo-screen",
    width: 700,
    height: 1400,
    x: 120,
    y: 240
  });
});

test("buildFinanceSummaryMockPlan falls back to defaultParentId", () => {
  const plan = buildFinanceSummaryMockPlan({
    defaultParentId: "page:1"
  });

  assert.equal(plan.parentId, "page:1");
});

test("buildFinanceSummaryMockPlan requires a parent source", () => {
  assert.throws(
    () => buildFinanceSummaryMockPlan({}),
    /parentId is required when there is no registered current page/
  );
});
