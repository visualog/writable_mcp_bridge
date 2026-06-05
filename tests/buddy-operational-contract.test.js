import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const repoRoot = new URL("..", import.meta.url);

test("Buddy operational contract documents the reverse-engineered pipeline gates", async () => {
  const source = await readFile(
    new URL("docs/buddy/06-operational-contract.md", repoRoot),
    "utf8"
  );

  for (const heading of [
    "Intent Contract",
    "Read Strategy Contract",
    "Evidence Extraction Contract",
    "Domain QA Contract",
    "Report Composition Contract",
    "Progress UX Contract",
    "Failure Fallback Contract",
    "Regression Contract"
  ]) {
    assert.equal(source.includes(heading), true);
  }

  assert.match(source, /composeBuddyStyleAuditReport/);
  assert.match(source, /BUDDY_PROGRESS_STATES/);
  assert.match(source, /데이터 부족.*시작하면 안 됩니다/);
});
