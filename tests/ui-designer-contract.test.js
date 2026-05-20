import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = new URL("..", import.meta.url);

async function readPluginUiHtml() {
  return readFile(path.join(repoRoot.pathname, "figma-plugin", "ui.html"), "utf8");
}

test("plugin UI routes inspect selection requests to the dedicated inspect endpoint", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /\/api\/designer\/inspect-selection/);
  assert.match(source, /serverIntentKind/);
});

test("plugin UI reports malformed HTTP 200 bridge responses with a stable code", async () => {
  const source = await readPluginUiHtml();

  assert.match(source, /bridge_response_invalid/);
});
