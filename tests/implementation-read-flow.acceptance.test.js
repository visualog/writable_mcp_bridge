import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const feedbackDir = path.resolve(__dirname, "../feedback");
const docsDir = path.resolve(__dirname, "../docs/authoring");

const acceptanceChecklistPath = path.join(
  feedbackDir,
  "2026-04-13-toolbar-acceptance-checklist.md"
);

const troubleshootingPath = path.join(
  docsDir,
  "search-nodes-troubleshooting.md"
);

// Assumption: these tests are a contract scaffold for APIs that are not yet merged.
// They intentionally stay red-free by using test.todo until the read APIs land.
test.todo("get_node_details layout field extraction includes layoutMode, itemSpacing, padding, and sizing fields");
test.todo("get_component_variant_details extracts variant property definitions and per-variant visibility");
test.todo("get_instance_details extracts source linkage and override summaries");
test.todo("search_nodes detailLevel supports light, layout, and full behavior");
test.todo("get_metadata returns XML and structured JSON in a compatible dual-output response");

test("toolbar acceptance checklist asks nine questions without coordinate inference", async () => {
  const text = await readFile(acceptanceChecklistPath, "utf8");

  assert.match(text, /without coordinate inference/i);
  assert.match(text, /pattern\/toolbar/i);

  const questions = text.match(/^\d+\.\s.+$/gm) ?? [];
  assert.equal(questions.length, 9);
  assert.match(text, /What is the root auto-layout direction\?/);
  assert.match(text, /Which variants contain status text\?/);
  assert.match(text, /Which instance properties or overrides differ by variant\?/);
});

test("search_nodes troubleshooting doc documents an operational decision tree", async () => {
  const text = await readFile(troubleshootingPath, "utf8");

  assert.match(text, /Decision Tree/i);
  assert.match(text, /no active plugin session/i);
  assert.match(text, /narrow the query/i);
  assert.match(text, /lower the detail level/i);
  assert.match(text, /escalate/i);
});
