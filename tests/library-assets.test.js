import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLibraryAssetSearchPlan,
  buildLibraryAssetRequests,
  filterLibraryAssets,
  searchLibraryAssets
} from "../src/library-assets.js";

test("buildLibraryAssetSearchPlan normalizes defaults", () => {
  const plan = buildLibraryAssetSearchPlan({
    fileKey: "abc123",
    query: "  tab bar  "
  });

  assert.equal(plan.fileKey, "abc123");
  assert.equal(plan.query, "tab bar");
  assert.deepEqual(plan.assetTypes, ["COMPONENT", "COMPONENT_SET", "STYLE"]);
  assert.equal(plan.maxResults, 30);
});

test("buildLibraryAssetSearchPlan keeps unique asset types and clamps results", () => {
  const plan = buildLibraryAssetSearchPlan({
    fileKey: "abc123",
    assetTypes: ["STYLE", "COMPONENT", "STYLE", "UNKNOWN"],
    maxResults: 999
  });

  assert.deepEqual(plan.assetTypes, ["STYLE", "COMPONENT"]);
  assert.equal(plan.maxResults, 100);
});

test("buildLibraryAssetRequests maps asset types to official file endpoints", () => {
  const requests = buildLibraryAssetRequests({
    fileKey: "apple-library",
    assetTypes: ["COMPONENT", "COMPONENT_SET", "STYLE"]
  });

  assert.deepEqual(requests, [
    {
      assetType: "COMPONENT",
      path: "/v1/files/apple-library/components",
      responseKey: "components"
    },
    {
      assetType: "COMPONENT_SET",
      path: "/v1/files/apple-library/component_sets",
      responseKey: "component_sets"
    },
    {
      assetType: "STYLE",
      path: "/v1/files/apple-library/styles",
      responseKey: "styles"
    }
  ]);
});

test("filterLibraryAssets matches query across name, description, and containing frame", () => {
  const result = filterLibraryAssets(
    [
      {
        key: "cmp_1",
        name: "Tab Bar",
        description: "Bottom navigation",
        assetType: "COMPONENT",
        containing_frame: { name: "Navigation" }
      },
      {
        key: "style_1",
        name: "Large Title",
        description: "App Store hero heading",
        assetType: "STYLE",
        containing_frame: { name: "Typography" }
      }
    ],
    {
      query: "hero",
      assetTypes: ["STYLE"],
      maxResults: 10
    }
  );

  assert.deepEqual(result.matches.map((item) => item.key), ["style_1"]);
  assert.equal(result.truncated, false);
});

test("searchLibraryAssets fetches metadata and returns normalized matches", async () => {
  const requests = [];
  const responses = new Map([
    [
      "https://api.figma.com/v1/files/apple-library/components",
      {
        meta: {
          components: [
            {
              key: "cmp_1",
              file_key: "apple-library",
              node_id: "10:1",
              name: "Today Card",
              description: "Editorial hero card",
              containing_frame: { name: "Today" }
            }
          ]
        }
      }
    ],
    [
      "https://api.figma.com/v1/files/apple-library/styles",
      {
        meta: {
          styles: [
            {
              key: "style_1",
              file_key: "apple-library",
              node_id: "20:1",
              style_type: "TEXT",
              name: "Large Title",
              description: "Apple editorial title"
            }
          ]
        }
      }
    ]
  ]);

  const result = await searchLibraryAssets(
    {
      fileKey: "apple-library",
      query: "today",
      assetTypes: ["COMPONENT", "STYLE"],
      maxResults: 10
    },
    {
      accessToken: "figd_test",
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return {
          ok: true,
          async json() {
            return responses.get(url);
          }
        };
      }
    }
  );

  assert.equal(requests.length, 2);
  assert.equal(
    requests[0].options.headers["X-Figma-Token"],
    "figd_test"
  );
  assert.deepEqual(result.matches.map((item) => item.key), ["cmp_1"]);
  assert.equal(result.matches[0].assetType, "COMPONENT");
});
