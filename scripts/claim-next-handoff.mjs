const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:3846";
const WORKER_ID = process.env.WORKER_ID || "local-agent";
const WORKER_LABEL = process.env.WORKER_LABEL || "Local Agent";

async function fetchJson(pathname, options = {}) {
  const response = await fetch(`${BASE_URL}${pathname}`, options);
  const body = await response.json().catch(() => null);
  return {
    status: response.status,
    ok: response.ok,
    body
  };
}

async function main() {
  const nextResult = await fetchJson("/api/handoffs/next");
  if (!nextResult.ok || nextResult.body?.ok !== true) {
    throw new Error(
      `Failed to read next handoff (${nextResult.status}): ${JSON.stringify(nextResult.body)}`
    );
  }

  const nextHandoff = nextResult.body?.handoff || null;
  if (!nextHandoff) {
    process.stdout.write(
      `${JSON.stringify({ ok: true, claimed: false, handoff: null }, null, 2)}\n`
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

  process.stdout.write(
    `${JSON.stringify(
      {
        ok: true,
        claimed: true,
        handoff: claimResult.body?.handoff || null
      },
      null,
      2
    )}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
