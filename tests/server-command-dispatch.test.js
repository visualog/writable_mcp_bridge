import test from "node:test";
import assert from "node:assert/strict";

import {
  createHandleToolCall,
  resolveBulkBindVariablesTimeoutMs,
  resolveCommandTimeoutMs
} from "../src/server-command-dispatch.js";

test("resolveCommandTimeoutMs gives token export chunks a large timeout", () => {
  assert.equal(
    resolveCommandTimeoutMs("export_design_tokens_chunk", { defaultTimeoutMs: 30000 }),
    120000
  );
});

test("resolveBulkBindVariablesTimeoutMs scales with binding count and caps at 120s", () => {
  assert.equal(resolveBulkBindVariablesTimeoutMs(3, { defaultTimeoutMs: 30000 }), 33600);
  assert.equal(resolveBulkBindVariablesTimeoutMs(200, { defaultTimeoutMs: 30000 }), 120000);
});

test("createHandleToolCall dispatches simple plugin read commands", async () => {
  const calls = [];
  const handleToolCall = createHandleToolCall({
    executePluginCommand: async (...args) => {
      calls.push(args);
      return { selection: [{ id: "1:2", name: "Title" }] };
    }
  });

  const result = await handleToolCall("get_selection", { pluginId: "page:1" });

  assert.deepEqual(calls, [["page:1", "get_selection"]]);
  assert.equal(result.content[0].type, "text");
  assert.deepEqual(JSON.parse(result.content[0].text), {
    selection: [{ id: "1:2", name: "Title" }]
  });
});
