import test from "node:test";
import assert from "node:assert/strict";

import {
  canApplyExpiryGrace,
  isReadHeavyCommandType,
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

test("export node is treated as a read-heavy detail command", () => {
  assert.equal(isReadHeavyCommandType("export_node"), true);
  assert.equal(canApplyExpiryGrace("export_node"), true);
  assert.equal(resolvePollingFallbackClass("export_node"), "detail");
});
