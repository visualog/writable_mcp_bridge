import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFileComponentSearchPlan,
  filterFileComponents,
  searchFileComponents
} from "../src/file-components.js";

test("buildFileComponentSearchPlan normalizes defaults", () => {
  const plan = buildFileComponentSearchPlan({
    fileKey: "abc123",
    query: "  tab bar  "
  });

  assert.equal(plan.fileKey, "abc123");
  assert.equal(plan.query, "tab bar");
  assert.equal(plan.maxResults, 30);
});

test("filterFileComponents matches by name and containing page", () => {
  const result = filterFileComponents(
    [
      {
        key: "cmp_1",
        nodeId: "10:1",
        name: "Tab Bar / iOS",
        description: "",
        containingFrame: { name: "Navigation" }
      },
      {
        key: "cmp_2",
        nodeId: "20:1",
        name: "Editorial Card",
        description: "",
        containingFrame: { name: "Today" }
      }
    ],
    {
      fileKey: "abc123",
      query: "today",
      maxResults: 10
    }
  );

  assert.deepEqual(result.matches.map((item) => item.key), ["cmp_2"]);
});

test("searchFileComponents reads the file endpoint and returns normalized component metadata", async () => {
  const requests = [];
  const result = await searchFileComponents(
    {
      fileKey: "apple-file",
      query: "tab",
      maxResults: 10
    },
    {
      accessToken: "figd_test",
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return {
          ok: true,
          async json() {
            return {
              components: {
                "10:1": {
                  key: "cmp_1",
                  node_id: "10:1",
                  name: "Tab Bar / iOS",
                  description: "Bottom navigation",
                  containing_frame: { name: "Navigation" }
                },
                "20:1": {
                  key: "cmp_2",
                  node_id: "20:1",
                  name: "Editorial Card",
                  description: "Today hero"
                }
              }
            };
          }
        };
      }
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "https://api.figma.com/v1/files/apple-file?depth=2"
  );
  assert.equal(requests[0].options.headers["X-Figma-Token"], "figd_test");
  assert.deepEqual(result.matches.map((item) => item.key), ["cmp_1"]);
  assert.equal(result.matches[0].nodeId, "10:1");
});
