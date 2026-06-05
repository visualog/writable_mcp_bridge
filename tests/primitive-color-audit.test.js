import test from "node:test";
import assert from "node:assert/strict";

import {
  auditPrimitiveColorTokens,
  buildBuddyStylePrimitiveColorReport
} from "../src/primitive-color-audit.js";

const tokenSnapshot = {
  collectionCount: 7,
  variableCount: 548,
  styleCount: 45,
  collections: [
    { name: "0.2.theme*", variableCount: 114, modeCount: 2 },
    { name: "0.1. primitives", variableCount: 222, modeCount: 1 },
    { name: "1.0.semantic", variableCount: 200, modeCount: 2 }
  ],
  tokenBucketCounts: { colors: 198, spacing: 19, radius: 10 },
  colorScaleGroups: [
    { group: "light/Blue", steps: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] },
    { group: "light/LightBlue", steps: [20, 30, 50, 60, 70, 90], alpha: true },
    { group: "light/Red", steps: [20, 30, 50, 60, 80], alpha: true },
    { group: "light/Orange", steps: [20, 30, 50, 60, 80], alpha: true },
    { group: "light/CoolGray", steps: [20, 30, 50, 70, 90], alpha: true },
    { group: "dark/Black alpha", steps: [10, 20, 30, 40, 50, 60, 70, 80, 90] }
  ],
  sampleVariables: [
    { name: "light/Blue/60", resolvedType: "COLOR", modes: { default: "#3182F6" } },
    { name: "light/LightBlue/60", resolvedType: "COLOR", modes: { default: "#3E80F4" } },
    { name: "dark/Black alpha/10", resolvedType: "COLOR", modes: { default: "#FFFFFF/0.1" } }
  ]
};

test("auditPrimitiveColorTokens finds Buddy-style primitive color QA issues", () => {
  const audit = auditPrimitiveColorTokens(tokenSnapshot);

  assert.equal(audit.evidence.collectionCount, 7);
  assert.equal(audit.evidence.variableCount, 548);
  assert.equal(audit.evidence.primitiveCollection.variableCount, 222);
  assert.ok(audit.strengths.some((item) => item.includes("0.1. primitives")));
  assert.ok(audit.issues.some((issue) => issue.type === "missing_scale_steps" && issue.subject === "light/Red"));
  assert.ok(audit.issues.some((issue) => issue.type === "alpha_naming_mismatch"));
  assert.ok(audit.issues.some((issue) => issue.type === "similar_color_family"));
  assert.ok(audit.priorities.some((item) => item.severity === "high"));
});

test("buildBuddyStylePrimitiveColorReport returns evidence-first QA report text", () => {
  const report = buildBuddyStylePrimitiveColorReport(tokenSnapshot);

  assert.match(report, /프리미티브 컬러 팔레트 분석/);
  assert.match(report, /0\.1\. primitives/);
  assert.match(report, /222개/);
  assert.match(report, /548개/);
  assert.match(report, /개선이 필요한 부분/);
  assert.match(report, /light\/Red/);
  assert.match(report, /Black alpha/);
  assert.match(report, /Blue vs LightBlue/);
  assert.doesNotMatch(report, /데이터가 없어 판단/);
});
