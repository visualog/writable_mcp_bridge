import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

test("package, server, and plugin UI versions stay aligned", async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(repoRoot, "package.json"), "utf8")
  );
  const serverSource = await readFile(path.join(repoRoot, "src", "server.js"), "utf8");
  const pluginSource = await readFile(path.join(repoRoot, "figma-plugin", "ui.html"), "utf8");

  const serverMatch = serverSource.match(/const BRIDGE_VERSION = "([^"]+)";/);
  const pluginMatch = pluginSource.match(/const BRIDGE_VERSION = "([^"]+)";/);

  assert.ok(serverMatch, "Expected BRIDGE_VERSION in src/server.js");
  assert.ok(pluginMatch, "Expected BRIDGE_VERSION in figma-plugin/ui.html");
  assert.equal(packageJson.version, serverMatch[1]);
  assert.equal(packageJson.version, pluginMatch[1]);
});
