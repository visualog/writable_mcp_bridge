import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFileCommentsPlan,
  buildFileSummaryPlan,
  buildProjectFilesPlan,
  buildTeamProjectsPlan,
  listFileComments
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

test("buildFileCommentsPlan normalizes options", () => {
  const plan = buildFileCommentsPlan({
    fileKey: "  ABC123  ",
    maxResults: 800,
    includeResolved: false,
    targetNodeId: " 10:1 "
  });
  assert.equal(plan.fileKey, "ABC123");
  assert.equal(plan.maxResults, 500);
  assert.equal(plan.includeResolved, false);
  assert.equal(plan.targetNodeId, "10:1");
});

test("listFileComments filters resolved comments when requested", async () => {
  const result = await listFileComments(
    {
      fileKey: "FILE-1",
      includeResolved: false,
      maxResults: 20
    },
    {
      accessToken: "token",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: "c-1",
              message: "open",
              file_key: "FILE-1",
              created_at: "2026-01-01T00:00:00.000Z",
              user: { id: "u-1", handle: "dev" },
              client_meta: { node_id: "10:1" }
            },
            {
              id: "c-2",
              message: "resolved",
              file_key: "FILE-1",
              created_at: "2026-01-02T00:00:00.000Z",
              resolved_at: "2026-01-03T00:00:00.000Z",
              user: { id: "u-2", handle: "reviewer" },
              client_meta: { node_id: "20:1" }
            }
          ]
        })
      })
    }
  );

  assert.equal(result.fileKey, "FILE-1");
  assert.equal(result.includeResolved, false);
  assert.equal(result.comments.length, 1);
  assert.equal(result.comments[0].id, "c-1");
  assert.equal(result.comments[0].resolved, false);
  assert.equal(result.comments[0].target.nodeId, "10:1");
});

test("listFileComments filters by target node id when provided", async () => {
  const result = await listFileComments(
    {
      fileKey: "FILE-1",
      includeResolved: true,
      targetNodeId: "20:1",
      maxResults: 20
    },
    {
      accessToken: "token",
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          comments: [
            {
              id: "c-1",
              message: "open",
              file_key: "FILE-1",
              created_at: "2026-01-01T00:00:00.000Z",
              user: { id: "u-1", handle: "dev" },
              client_meta: { node_id: "10:1" }
            },
            {
              id: "c-2",
              message: "node-20",
              file_key: "FILE-1",
              created_at: "2026-01-02T00:00:00.000Z",
              user: { id: "u-2", handle: "reviewer" },
              client_meta: { node_id: "20:1" }
            }
          ]
        })
      })
    }
  );

  assert.equal(result.targetNodeId, "20:1");
  assert.equal(result.comments.length, 1);
  assert.equal(result.comments[0].id, "c-2");
  assert.equal(result.comments[0].target.nodeId, "20:1");
});
