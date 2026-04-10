import test from "node:test";
import assert from "node:assert/strict";

import { createComposeRuntimeMetricsStore } from "../src/compose-runtime-metrics.js";

test("compose runtime metrics records validation and compose quality counters", () => {
  const store = createComposeRuntimeMetricsStore();

  store.recordValidation({
    validationMode: "strict",
    blockedByStrict: true,
    report: {
      status: "warn",
      canCompose: true,
      errorCount: 0,
      warningCount: 1
    }
  });

  store.recordCompose({
    validationMode: "strict",
    ok: false,
    errorMessage: "strict validation blocked compose"
  });

  store.recordValidation({
    validationMode: "lenient",
    report: {
      status: "pass",
      canCompose: true,
      errorCount: 0,
      warningCount: 0
    }
  });

  store.recordCompose({
    validationMode: "lenient",
    ok: true,
    composition: [
      { status: "exact-swap" },
      { status: "fallback-helper" },
      { status: "blocked" }
    ]
  });

  const report = store.getReport();

  assert.equal(report.validation.total, 2);
  assert.equal(report.validation.pass, 1);
  assert.equal(report.validation.warn, 1);
  assert.equal(report.validation.strictBlocks, 1);

  assert.equal(report.compose.total, 2);
  assert.equal(report.compose.success, 1);
  assert.equal(report.compose.failed, 1);
  assert.equal(report.compose.blockedSectionsTotal, 1);
  assert.equal(report.compose.fallbackSectionsTotal, 1);
  assert.equal(report.compose.strictModeTotal, 1);
  assert.equal(report.compose.strictModeFailures, 1);
  assert.equal(report.ratios.strictModeFailureRatio, 1);
});
