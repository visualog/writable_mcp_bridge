import test from "node:test";
import assert from "node:assert/strict";

import {
  attachDesignerKnowledgeReferences,
  buildCodexAugmentedSuggestionBundle,
  buildDesignerPipelineSnapshot,
  resolveDesignerCodexInspectTimeoutMs
} from "../src/ai-designer-server-contract.js";

test("resolveDesignerCodexInspectTimeoutMs gives Codex inspect enough time by default", () => {
  assert.equal(resolveDesignerCodexInspectTimeoutMs({}), 45000);
});

test("resolveDesignerCodexInspectTimeoutMs respects explicit positive env values", () => {
  assert.equal(
    resolveDesignerCodexInspectTimeoutMs({
      XBRIDGE_CODEX_CLI_INSPECT_TIMEOUT_MS: "150"
    }),
    1000
  );
  assert.equal(
    resolveDesignerCodexInspectTimeoutMs({
      XBRIDGE_CODEX_CLI_INSPECT_TIMEOUT_MS: "30000"
    }),
    30000
  );
});

test("buildCodexAugmentedSuggestionBundle preserves deterministic primitive color reports", () => {
  const bundle = buildCodexAugmentedSuggestionBundle(
    {
      summaryText: "프리미티브 컬러 팔레트 분석 결과\n잘 구성된 부분",
      primitiveColorReport: "프리미티브 컬러 팔레트 분석 결과\n잘 구성된 부분",
      findings: [],
      recommendations: []
    },
    {
      reply: "선택된 대상은 primitives 섹션입니다. 현재 읽기 결과는 부분 수집 상태입니다."
    }
  );

  assert.equal(
    bundle.summaryText,
    "프리미티브 컬러 팔레트 분석 결과\n잘 구성된 부분"
  );
  assert.equal(bundle.codex.reply.includes("부분 수집 상태"), true);
});

test("buildCodexAugmentedSuggestionBundle preserves generic Buddy audit reports", () => {
  const bundle = buildCodexAugmentedSuggestionBundle(
    {
      summaryText: "UX/UI 리뷰 결과\n근거",
      buddyAuditReport: "UX/UI 리뷰 결과\n근거",
      findings: [],
      recommendations: []
    },
    {
      reply: "선택된 대상은 primitives 섹션입니다."
    }
  );

  assert.equal(bundle.summaryText, "UX/UI 리뷰 결과\n근거");
});

test("buildDesignerPipelineSnapshot summarizes the bridge-to-codex execution pipeline", () => {
  const snapshot = buildDesignerPipelineSnapshot({
    request: "선택한 화면을 리뷰해줘",
    intentEnvelope: {
      intents: [{ kind: "improve_hierarchy" }],
      intentClassification: { userIntentKind: "analyze_design" },
      contextScope: { targetType: "current_selection", selectionRequired: true },
      readPlan: {
        headline: "선택 화면 읽기",
        commands: ["get_selection", "get_metadata", "get_node_details"]
      }
    },
    execution: {
      summary: { commandCount: 3, okCount: 3, errorCount: 0, skippedCount: 0 },
      contextWarnings: [],
      contextModel: {
        focusedNode: {
          node: { name: "Dashboard", type: "FRAME" },
          layout: { layoutMode: "VERTICAL" },
          variantProperties: {},
          componentProperties: {}
        },
        structure: { childCount: 8, textNodeCount: 4, instanceCount: 2, autoLayoutFrames: 3 },
        designSystem: {
          componentCandidates: [{ name: "Card" }],
          instanceMatches: [],
          variableDefs: [],
          tokenSnapshot: { collectionCount: 2, variableCount: 40, colorScaleGroups: [] }
        }
      }
    },
    suggestionBundle: {
      summaryText: "UX/UI 리뷰 결과",
      buddyAuditReport: "UX/UI 리뷰 결과\n근거",
      recommendations: [{ title: "레이아웃 정리", reason: "간격이 흔들립니다.", actionType: "layout" }]
    },
    actionMode: "answer_or_plan"
  });

  assert.equal(snapshot.intent.kind, "improve_hierarchy");
  assert.deepEqual(snapshot.read.commands, ["get_selection", "get_metadata", "get_node_details"]);
  assert.equal(snapshot.context.focusedNode.name, "Dashboard");
  assert.equal(snapshot.context.designSystem.tokenSnapshot.variableCount, 40);
  assert.equal(snapshot.deterministicEvidence.report.includes("UX/UI 리뷰 결과"), true);
  assert.equal(snapshot.retrieval.strategy, "local_document_chunk_bm25_light");
  assert.equal(snapshot.retrieval.resultCount > 0, true);
  assert.equal(
    snapshot.retrieval.results.some((entry) => entry.sourcePath === "docs/buddy/06-operational-contract.md"),
    true
  );
  assert.equal(
    snapshot.retrieval.results.some((entry) => entry.sourceKind === "document_chunk"),
    true
  );
  assert.equal(snapshot.responsePolicy.evidenceFirst, true);
  assert.equal(snapshot.responsePolicy.preserveDeterministicReport, true);
});

test("attachDesignerKnowledgeReferences exposes retrieval evidence on suggestion bundles", () => {
  const bundle = attachDesignerKnowledgeReferences(
    { summaryText: "분석 결과", findings: [], recommendations: [] },
    {
      retrieval: {
        results: [
          {
            id: "designer-workflow-qa#l01",
            title: "Designer workflow editing QA matrix",
            sourcePath: "docs/qa/figma-designer-workflow-test-plan-20260601.ko.md",
            sourceKind: "document_chunk",
            score: 12,
            guidance: "L01 Auto Layout requires readback evidence."
          },
          {
            id: "buddy-operational-contract",
            title: "Buddy-style evidence-first response contract",
            sourcePath: "docs/buddy/06-operational-contract.md",
            sourceKind: "static_summary",
            score: 8,
            guidance: "Evidence first, limitations last."
          }
        ]
      }
    }
  );

  assert.equal(bundle.knowledgeReferences.length, 2);
  assert.deepEqual(bundle.knowledgeReferences[0], {
    id: "designer-workflow-qa#l01",
    title: "Designer workflow editing QA matrix",
    sourcePath: "docs/qa/figma-designer-workflow-test-plan-20260601.ko.md",
    sourceKind: "document_chunk",
    guidance: "L01 Auto Layout requires readback evidence."
  });
});
