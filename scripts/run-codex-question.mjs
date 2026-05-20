#!/usr/bin/env node

import { spawn } from "node:child_process";

const prompt = "What is 49+2";
const args = [
  "exec",
  "--json",
  "--skip-git-repo-check",
  "--ephemeral",
  "--color",
  "never",
  prompt,
];

const child = spawn("codex", args, {
  stdio: ["ignore", "pipe", "pipe"],
});

let lastAgentMessage = "";
let stderr = "";

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  for (const line of chunk.split(/\r?\n/)) {
    if (!line.trim()) {
      continue;
    }
    try {
      const event = JSON.parse(line);
      if (
        event.type === "item.completed" &&
        event.item?.type === "agent_message" &&
        typeof event.item.text === "string"
      ) {
        lastAgentMessage = event.item.text;
      }
    } catch {
      // In JSON mode stdout is expected to be JSONL, but ignore stray lines.
    }
  }
});

child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  stderr += chunk;
});

child.on("error", (error) => {
  console.error(`Failed to start codex: ${error.message}`);
  process.exit(1);
});

child.on("close", (code, signal) => {
  if (code !== 0 || signal) {
    const detail = signal ? `signal ${signal}` : `exit code ${code}`;
    console.error(`codex failed with ${detail}`);
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    process.exit(code ?? 1);
  }

  if (!lastAgentMessage) {
    console.error("codex completed without an agent message");
    if (stderr.trim()) {
      console.error(stderr.trim());
    }
    process.exit(1);
  }

  console.log(lastAgentMessage);
});
