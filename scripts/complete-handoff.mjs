const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3846";
const WORKER_ID = process.env.WORKER_ID || "local-agent";

function parseArgs(argv = []) {
  const positionals = [];
  const changedFiles = [];
  const tests = [];

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
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
      continue;
    }
    positionals.push(current);
  }

  return {
    handoffId: positionals[0] || "",
    summary:
      positionals.slice(1).join(" ").trim() || "Local implementation work completed.",
    changedFiles,
    tests
  };
}

const parsed = parseArgs(process.argv.slice(2));

if (!parsed.handoffId) {
  process.stderr.write(
    "Usage: node scripts/complete-handoff.mjs <handoffId> [summary...] [--file path] [--test command]\n"
  );
  process.exit(1);
}

async function main() {
  const response = await fetch(`${BASE_URL}/api/handoffs/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      handoffId: parsed.handoffId,
      workerId: WORKER_ID,
      summary: parsed.summary,
      result: {
        changedFiles: parsed.changedFiles,
        tests: parsed.tests
      }
    })
  });

  const body = await response.json().catch(() => null);
  if (!response.ok || body?.ok !== true) {
    throw new Error(`Failed to complete handoff (${response.status}): ${JSON.stringify(body)}`);
  }

  process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
