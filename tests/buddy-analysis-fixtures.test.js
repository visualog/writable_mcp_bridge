import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("..", import.meta.url);

test("Buddy analysis fixtures cover the six benchmark request types", async () => {
  const samples = JSON.parse(
    await readFile(new URL("tests/fixtures/buddy-analysis-samples.json", repoRoot), "utf8")
  );
  const categories = new Set(samples.map((sample) => sample.category));

  assert.equal(samples.length, 6);
  assert.deepEqual(
    [...categories].sort(),
    [
      "component_improvement_analysis",
      "design_system_alignment",
      "failure_partial_data_response",
      "frame_ux_ui_review",
      "image_based_screen_reconstruction",
      "primitive_color_analysis"
    ].sort()
  );
  for (const sample of samples) {
    assert.equal(Boolean(sample.userRequest), true);
    assert.equal(Boolean(sample.buddyFirstMove), true);
    assert.equal(sample.observedActions.length > 0, true);
    assert.equal(sample.dataUsed.length > 0, true);
    assert.equal(sample.responseShape.includes("start_expectation"), true);
    assert.equal(sample.inferredRules.length > 0, true);
    assert.equal(sample.xbridgeReproducible.length > 0, true);
    assert.equal(sample.xbridgeGap.length > 0, true);
  }
});
