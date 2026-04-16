#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
      continue;
    }
    if (flags[key] == null) {
      flags[key] = next;
    } else if (Array.isArray(flags[key])) {
      flags[key].push(next);
    } else {
      flags[key] = [flags[key], next];
    }
    index += 1;
  }
  return flags;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value == null || value === false) {
    return [];
  }
  return [value];
}

function compact(list) {
  return list.filter((item) => item != null && item !== "");
}

function formatKoreanDateTime(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 || 12;
  return `${year}.${month}.${day} ${period} ${hour12}:${minutes}`;
}

function stamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

function slugify(value, fallback = "xlog-candidate") {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function printUsage() {
  console.log(`
create xlog candidate

Usage:
  node scripts/create-xlog-candidate.mjs --title "streaming fallback reason added"
  node scripts/create-xlog-candidate.mjs --input ./preflight.json --kind preflight

Optional:
  --kind manual|preflight|soak
  --type feature|verification
  --status done|unspecified
  --summary "..."
  --detail "..."
  --tag xbridge
  --file src/server.js
  --test "npm test"
  --version 0.3.0
  --commit abc1234
  --date "2026.04.14 오후 4:54"
  --input -
  --output docs/handoff/xlog-candidates/custom.json
`);
}

async function readInputPayload(inputPath) {
  if (!inputPath) {
    return null;
  }

  const raw = inputPath === "-" ? await readStdin() : await fs.readFile(path.resolve(process.cwd(), inputPath), "utf8");
  const trimmed = String(raw).trim();
  return trimmed ? JSON.parse(trimmed) : null;
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
    });
    process.stdin.on("end", () => resolve(raw));
    process.stdin.on("error", reject);
    if (process.stdin.isTTY) {
      resolve("");
    }
  });
}

function inferKind(flags, input) {
  const explicit = String(flags.kind || "").trim().toLowerCase();
  if (explicit) {
    return explicit;
  }
  if (input?.profile || Array.isArray(input?.runs)) {
    return "soak";
  }
  if (input?.transportHealth || input?.runtimeOpsOk != null || input?.recommendedNext) {
    return "preflight";
  }
  return "manual";
}

function buildPreflightPayload(input, now) {
  const transportGrade = input?.transportHealth?.grade || "unknown";
  const activePlugins = asArray(input?.activePlugins);
  const failures = asArray(input?.failures);
  const recommendations = asArray(input?.recommendedNext);
  const serverVersion = input?.serverVersion || input?.packageVersion || "0.3.0";
  const summary = input?.ok
    ? `Preflight confirmed ${input?.server || "bridge"} ${serverVersion} with ${transportGrade} transport.`
    : `Preflight found ${failures.length} issue(s) while checking ${input?.server || "bridge"}.`;

  return {
    title: `agent preflight: ${transportGrade} transport`,
    type: "verification",
    status: input?.ok ? "done" : "unspecified",
    version: serverVersion,
    createdAt: now.toISOString(),
    displayDate: formatKoreanDateTime(now),
    summary,
    details: compact([
      `server: ${input?.server || "unknown"}`,
      `serverVersion: ${serverVersion}`,
      `activePlugins: ${activePlugins.length > 0 ? activePlugins.join(", ") : "none"}`,
      `runtimeOpsOk: ${input?.runtimeOpsOk ? "true" : "false"}`,
      input?.transportHealth?.summary ? `transportHealth: ${input.transportHealth.summary}` : null,
      ...failures.slice(0, 3).map((failure) => {
        const step = failure?.step || "failure";
        const message = failure?.message || failure?.error || "failed";
        return `${step}: ${message}`;
      }),
      ...recommendations.slice(0, 4).map((entry) => `next: ${entry}`)
    ]),
    changedFiles: ["scripts/agent-preflight.mjs", "src/server.js", "figma-plugin/ui.html"],
    tests: ["node scripts/agent-preflight.mjs"],
    tags: ["xbridge", "harness", "verification", "preflight", "streaming"],
    commit: "",
    thumbnailHint: `Health panel showing ${transportGrade} transport`,
    source: {
      repo: "xbridge",
      generator: "scripts/create-xlog-candidate.mjs",
      kind: "preflight"
    }
  };
}

function buildSoakPayload(input, now) {
  const profile = input?.profile || "custom";
  const iterations = Number(input?.iterations || input?.completedIterations || 0);
  const passed = Number(input?.passed || 0);
  const failed = Number(input?.failed || 0);
  const avgDurationMs = input?.avgDurationMs ?? null;
  const maxDurationMs = input?.maxDurationMs ?? null;
  const minDurationMs = input?.minDurationMs ?? null;
  const maxInFlightObserved = input?.concurrency?.maxInFlightObserved ?? null;
  const firstFailure = input?.firstFailure || input?.failures?.[0] || null;
  const summary = input?.ok
    ? `Soak ${profile} finished with ${passed}/${iterations} passes and avg ${avgDurationMs ?? "n/a"}ms.`
    : `Soak ${profile} reported ${failed} failure(s) across ${iterations} iteration(s).`;

  return {
    title: `streaming soak: ${profile} ${input?.ok ? "passed" : "needs follow-up"}`,
    type: "verification",
    status: input?.ok ? "done" : "unspecified",
    version: input?.packageVersion || input?.serverVersion || "0.3.0",
    createdAt: now.toISOString(),
    displayDate: formatKoreanDateTime(now),
    summary,
    details: compact([
      `profile: ${profile}`,
      `iterations: ${iterations}`,
      `passed: ${passed}`,
      `failed: ${failed}`,
      avgDurationMs != null ? `avgDurationMs: ${avgDurationMs}` : null,
      maxDurationMs != null ? `maxDurationMs: ${maxDurationMs}` : null,
      minDurationMs != null ? `minDurationMs: ${minDurationMs}` : null,
      maxInFlightObserved != null ? `maxInFlightObserved: ${maxInFlightObserved}` : null,
      firstFailure?.error ? `firstFailure: ${firstFailure.error}` : null
    ]),
    changedFiles: [
      "scripts/validate-streaming-first.mjs",
      "scripts/validate-streaming-first-soak.mjs",
      "tests/websocket-command-channel.integration.test.js",
      "tests/ws-events.integration.test.js"
    ],
    tests: [`node scripts/validate-streaming-first-soak.mjs --profile=${profile}`],
    tags: ["xbridge", "streaming", "soak", "verification"],
    commit: "",
    thumbnailHint: `Soak profile ${profile} at ${passed}/${iterations}`,
    source: {
      repo: "xbridge",
      generator: "scripts/create-xlog-candidate.mjs",
      kind: "soak"
    }
  };
}

function buildManualPayload(flags, now) {
  return {
    title: flags.title,
    type: flags.type || "feature",
    status: flags.status || "done",
    version: flags.version || "0.3.0",
    createdAt: now.toISOString(),
    displayDate: flags.date || formatKoreanDateTime(now),
    summary: flags.summary || `${flags.title} 작업을 기록한다.`,
    details: asArray(flags.detail),
    changedFiles: asArray(flags.file),
    tests: asArray(flags.test),
    tags: asArray(flags.tag),
    commit: flags.commit || "",
    thumbnailHint: flags["thumbnail-hint"] || "",
    source: {
      repo: "xbridge",
      generator: "scripts/create-xlog-candidate.mjs",
      kind: "manual"
    }
  };
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printUsage();
    process.exitCode = 0;
    return;
  }

  const inputPayload = await readInputPayload(flags.input);
  const kind = inferKind(flags, inputPayload);
  const now = new Date();
  const basePayload =
    kind === "preflight"
      ? buildPreflightPayload(inputPayload || {}, now)
      : kind === "soak"
        ? buildSoakPayload(inputPayload || {}, now)
        : buildManualPayload(flags, now);

  if (kind === "manual" && !flags.title) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const payload = {
    ...basePayload,
    title: flags.title || basePayload.title,
    type: flags.type || basePayload.type,
    status: flags.status || basePayload.status,
    version: flags.version || basePayload.version,
    displayDate: flags.date || basePayload.displayDate,
    summary: flags.summary || basePayload.summary,
    details: flags.detail ? asArray(flags.detail) : basePayload.details,
    changedFiles: flags.file ? asArray(flags.file) : basePayload.changedFiles,
    tests: flags.test ? asArray(flags.test) : basePayload.tests,
    tags: flags.tag ? asArray(flags.tag) : basePayload.tags,
    commit: flags.commit ?? basePayload.commit ?? "",
    thumbnailHint: flags["thumbnail-hint"] || basePayload.thumbnailHint || "",
    source: {
      ...basePayload.source,
      inputPath: flags.input ? String(flags.input) : ""
    }
  };

  const defaultOutput = path.join(
    "docs",
    "handoff",
    "xlog-candidates",
    `${stamp(now)}-${slugify(payload.title)}.json`
  );
  const outputPath = path.resolve(process.cwd(), flags.output || defaultOutput);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
