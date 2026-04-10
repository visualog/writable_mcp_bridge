import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFileSummaryPlan,
  buildProjectFilesPlan,
  buildTeamProjectsPlan
} from "../src/figma-account.js";

test("buildTeamProjectsPlan normalizes required fields", () => {
  const plan = buildTeamProjectsPlan({
    teamId: " 12345 ",
    query: "  Design ",
    maxResults: 500
  });

  assert.equal(plan.teamId, "12345");
  assert.equal(plan.query, "design");
  assert.equal(plan.maxResults, 200);
});

test("buildTeamProjectsPlan requires teamId", () => {
  assert.throws(() => buildTeamProjectsPlan({}), /teamId is required/);
});

test("buildProjectFilesPlan normalizes flags and limits", () => {
  const plan = buildProjectFilesPlan({
    projectId: " 678 ",
    query: "  docs ",
    maxResults: 0,
    branchData: 1
  });

  assert.equal(plan.projectId, "678");
  assert.equal(plan.query, "docs");
  assert.equal(plan.maxResults, 1);
  assert.equal(plan.branchData, true);
});

test("buildProjectFilesPlan requires projectId", () => {
  assert.throws(() => buildProjectFilesPlan({}), /projectId is required/);
});

test("buildFileSummaryPlan trims file keys", () => {
  const plan = buildFileSummaryPlan({
    fileKey: "  ABC123  "
  });

  assert.equal(plan.fileKey, "ABC123");
});

test("buildFileSummaryPlan requires fileKey", () => {
  assert.throws(() => buildFileSummaryPlan({}), /fileKey is required/);
});
