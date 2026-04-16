import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function runCandidateScript(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/create-xlog-candidate.mjs", ...args], {
      cwd: new URL("..", import.meta.url),
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || stdout || `exit ${code}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

test("create-xlog-candidate writes structured handoff payload", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "xlog-candidate-"));
  const output = path.join(tempDir, "candidate.json");
  const writtenPath = await runCandidateScript([
    "--title",
    "streaming fallback reason added",
    "--summary",
    "fallback reason counters were added",
    "--tag",
    "xbridge",
    "--tag",
    "streaming",
    "--file",
    "src/server.js",
    "--test",
    "npm test",
    "--output",
    output
  ]);

  assert.equal(writtenPath, output);
  const payload = JSON.parse(await readFile(output, "utf8"));
  assert.equal(payload.title, "streaming fallback reason added");
  assert.equal(payload.displayDate.startsWith("20"), true);
  assert.deepEqual(payload.tags, ["xbridge", "streaming"]);
  assert.deepEqual(payload.changedFiles, ["src/server.js"]);
  assert.deepEqual(payload.tests, ["npm test"]);
  assert.equal(payload.source.generator, "scripts/create-xlog-candidate.mjs");
});
