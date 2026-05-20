#!/usr/bin/env node

import { spawn } from "node:child_process";

function runCodex(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdoutBuffer = "";
    let stderr = "";
    let threadId = null;
    let lastAgentMessage = "";
    const events = [];

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdoutBuffer += chunk;
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }
        try {
          const event = JSON.parse(line);
          events.push(event);
          if (event.type === "thread.started" && typeof event.thread_id === "string") {
            threadId = event.thread_id;
          }
          if (
            event.type === "item.completed" &&
            event.item?.type === "agent_message" &&
            typeof event.item.text === "string"
          ) {
            lastAgentMessage = event.item.text;
          }
        } catch {
          // Ignore non-JSON stdout lines defensively.
        }
      }
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (stdoutBuffer.trim()) {
        try {
          const event = JSON.parse(stdoutBuffer.trim());
          events.push(event);
        } catch {
          // Ignore trailing non-JSON stdout.
        }
      }

      if (code !== 0 || signal) {
        reject(
          new Error(
            `codex failed with ${signal ? `signal ${signal}` : `exit code ${code}`}\n${stderr}`,
          ),
        );
        return;
      }

      resolve({ threadId, lastAgentMessage, events, stderr });
    });
  });
}

const commonArgs = [
  "exec",
  "--json",
  "--skip-git-repo-check",
  "--color",
  "never",
];

const first = await runCodex([
  ...commonArgs,
  "내 이름은 김파수야. 이 사실을 기억해줘.",
]);

if (!first.threadId) {
  throw new Error("First codex call did not emit a thread id.");
}

const second = await runCodex([
  ...commonArgs,
  "resume",
  first.threadId,
  "내 이름이 뭐라고?",
]);

console.log(`thread_id: ${first.threadId}`);
console.log(`first_response: ${first.lastAgentMessage}`);
console.log(`second_response: ${second.lastAgentMessage}`);

if (!second.lastAgentMessage.includes("김파수")) {
  throw new Error("The resumed conversation did not remember the name 김파수.");
}
