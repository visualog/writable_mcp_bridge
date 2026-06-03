import test from "node:test";
import assert from "node:assert/strict";

import {
  listDesignerKnowledgeSources,
  retrieveDesignerKnowledge
} from "../src/designer-knowledge-rag.js";

test("designer knowledge RAG retrieves response display guidance for console UX requests", () => {
  const result = retrieveDesignerKnowledge({
    request: "브리지 콘솔 메시지를 코덱스 채팅창처럼 단계적으로 보여줘",
    intentKind: "inspect_response_display",
    targetType: "plugin_ui",
    readCommands: ["get_selection"],
    contextHints: ["chat progress streaming"]
  });

  assert.equal(result.strategy, "local_document_chunk_bm25_light");
  assert.equal(result.resultCount > 0, true);
  assert.equal(
    result.results.some((entry) => entry.id === "response-display-ux"),
    true
  );
});

test("designer knowledge RAG retrieves real document chunks with snippets", () => {
  const result = retrieveDesignerKnowledge({
    request: "Designer Workflow L01 Auto Layout 편집을 readback evidence로 검수해줘",
    intentKind: "designer_workflow_edit",
    targetType: "current_selection",
    readCommands: ["get_node_details", "write_node"],
    contextHints: ["L01 Auto Layout Readback Evidence Failure Handling"]
  });

  assert.equal(result.resultCount > 0, true);
  assert.equal(
    result.results.some((entry) => entry.sourceKind === "document_chunk"),
    true
  );
  assert.equal(
    result.results.some((entry) =>
      entry.sourcePath === "docs/qa/figma-designer-workflow-test-plan-20260601.ko.md" &&
      /Auto Layout|Readback Evidence|Failure Handling/u.test(entry.guidance || "")
    ),
    true
  );
});

test("designer knowledge RAG retrieves workflow and safety guidance for Figma edit requests", () => {
  const result = retrieveDesignerKnowledge({
    request: "선택한 버튼과 카드 리스트를 디자인 시스템에 맞게 정리하고 안전하게 수정해줘",
    intentKind: "align_to_design_system",
    targetType: "current_selection",
    readCommands: ["get_node_details", "search_instances", "export_design_tokens"],
    contextHints: ["component token safety"]
  });

  const ids = result.results.map((entry) => entry.id);
  assert.equal(ids.some((id) => id.startsWith("designer-workflow-qa")), true);
  assert.equal(
    ids.some((id) => id.startsWith("design-system-registry")) ||
      ids.some((id) => id.startsWith("buddy-operational-contract")),
    true
  );
});

test("designer knowledge source list exposes durable source paths", () => {
  const sources = listDesignerKnowledgeSources();
  assert.equal(sources.length >= 6, true);
  assert.equal(sources.every((entry) => entry.id && entry.sourcePath), true);
  assert.equal(sources.some((entry) => entry.sourceKind === "document_chunk"), true);
});
