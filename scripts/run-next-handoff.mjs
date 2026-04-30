import { spawn } from "node:child_process";
import { inferLocalExecutionPlan } from "../src/local-handoff-runner.js";

const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3846";
const WORKER_ID = process.env.WORKER_ID || "local-agent";
const WORKER_LABEL = process.env.WORKER_LABEL || "Local Agent";
const OUTPUT_LIMIT = 400;

function parseArgs(argv = []) {
  const changedFiles = [];
  const tests = [];
  let shouldComplete = false;
  let auto = false;
  let summary = "Local implementation work completed.";
  let execCommand = "";

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--complete") {
      shouldComplete = true;
      continue;
    }
    if (current === "--auto") {
      auto = true;
      continue;
    }
    if (current === "--summary") {
      const next = argv[index + 1];
      if (next) {
        summary = next;
        index += 1;
      }
      continue;
    }
    if (current === "--exec") {
      const next = argv[index + 1];
      if (next) {
        execCommand = next;
        index += 1;
      }
      continue;
    }
    if (current === "--file") {
      const next = argv[index + 1];
      if (next) {
        changedFiles.push(next);
        index += 1;
      }
      continue;
    }
    if (current === "--test") {
      const next = argv[index + 1];
      if (next) {
        tests.push(next);
        index += 1;
      }
    }
  }

  return {
    shouldComplete,
    auto,
    summary,
    execCommand,
    changedFiles,
    tests
  };
}

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const body = await response.json().catch(() => null);
  return {
    status: response.status,
    ok: response.ok,
    body
  };
}

function trimOutput(value) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  return text.length > OUTPUT_LIMIT ? `${text.slice(0, OUTPUT_LIMIT)}...` : text;
}

function runExecCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
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
    child.once("exit", (code, signal) => {
      resolve({
        command,
        success: code === 0,
        exitCode: typeof code === "number" ? code : null,
        signal: signal || null,
        stdout: trimOutput(stdout),
        stderr: trimOutput(stderr)
      });
    });
  });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  const nextResult = await fetchJson("/api/handoffs/next");
  if (!nextResult.ok || nextResult.body?.ok !== true) {
    throw new Error(
      `Failed to read next handoff (${nextResult.status}): ${JSON.stringify(nextResult.body)}`
    );
  }

  const nextHandoff = nextResult.body?.handoff || null;
  if (!nextHandoff) {
    process.stdout.write(
      `${JSON.stringify(
        { ok: true, claimed: false, completed: false, handoff: null, executionPlan: null },
        null,
        2
      )}\n`
    );
    return;
  }

  const executionPlan = inferLocalExecutionPlan(nextHandoff, {
    auto: parsed.auto,
    execCommand: parsed.execCommand,
    env: process.env
  });

  if ((parsed.auto || parsed.execCommand) && !executionPlan.executable) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          claimed: false,
          completed: false,
          handoff: nextHandoff,
          executionPlan
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const claimResult = await fetchJson("/api/handoffs/claim", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      handoffId: nextHandoff.handoffId,
      workerId: WORKER_ID,
      workerLabel: WORKER_LABEL
    })
  });

  if (!claimResult.ok || claimResult.body?.ok !== true) {
    throw new Error(
      `Failed to claim handoff (${claimResult.status}): ${JSON.stringify(claimResult.body)}`
    );
  }

  const output = {
    ok: true,
    claimed: true,
    completed: false,
    executionPlan,
    execution: null,
    handoff: claimResult.body?.handoff || null
  };

  if (executionPlan.executable) {
    output.execution = await runExecCommand(executionPlan.command);
    if (!output.execution.success) {
      throw new Error(
        `Execution command failed (${output.execution.exitCode ?? "?"}): ${output.execution.stderr || output.execution.stdout || output.execution.command}`
      );
    }
  }

  if (parsed.shouldComplete && output.handoff?.handoffId) {
    const completeResult = await fetchJson("/api/handoffs/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        handoffId: output.handoff.handoffId,
        workerId: WORKER_ID,
        summary: parsed.summary,
        result: {
          changedFiles: parsed.changedFiles,
          tests: parsed.tests,
          execution: output.execution,
          executionPlan
        }
      })
    });

    if (!completeResult.ok || completeResult.body?.ok !== true) {
      throw new Error(
        `Failed to complete handoff (${completeResult.status}): ${JSON.stringify(completeResult.body)}`
      );
    }

    output.completed = true;
    output.handoff = completeResult.body?.handoff || output.handoff;
  }

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
