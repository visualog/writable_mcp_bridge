import test from "node:test";
import assert from "node:assert/strict";

import {
  resolvePollingFallbackClass,
  resolvePollingFallbackPolicy
} from "../src/command-queue-policy.js";

test("interactive read commands use the interactive fallback class", () => {
  assert.equal(resolvePollingFallbackClass("list_text_nodes"), "interactive");
  assert.equal(resolvePollingFallbackClass("search_nodes"), "interactive");
});

test("interactive read fallback policy is more aggressive than detail fallback", () => {
  const interactive = resolvePollingFallbackPolicy({
    type: "list_text_nodes",
    baseGraceMs: 1000,
    timeoutMs: 5000,
    basePriority: 100
  });
  const detail = resolvePollingFallbackPolicy({
    type: "get_node_details",
    baseGraceMs: 1000,
    timeoutMs: 5000,
    basePriority: 100
  });

  assert.equal(interactive.fallbackClass, "interactive");
  assert.equal(interactive.effectiveGraceMs < detail.effectiveGraceMs, true);
  assert.equal(interactive.pollingPriority > detail.pollingPriority, true);
});
