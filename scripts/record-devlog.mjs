import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    flags[key] = next;
    index += 1;
  }

  return flags;
}

function printUsage() {
  console.log(`
writable_mcp_bridge devlog recorder

Usage:
  node scripts/record-devlog.mjs --input ./payload.json

Optional:
  --xlink-dir ../figma_skills/xlink
  --source-agent bridge-agent
  --target-agent devlog-agent
  --sync-agent devlog-agent
  --priority medium
  --handoff-title "..."
  --result "..."
  --note "..."
`);
}

function pushFlag(args, key, value) {
  if (value == null || value === false) {
    return;
  }

  args.push(`--${key}`);
  if (value !== true) {
    args.push(String(value));
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help || flags["input"] == null) {
    printUsage();
    process.exitCode = flags.help ? 0 : 1;
    return;
  }

  const xlinkDir = path.resolve(
    process.cwd(),
    flags["xlink-dir"] ?? path.join(__dirname, "..", "..", "figma_skills", "xlink")
  );
  const cliPath = path.join(xlinkDir, "src", "cli.js");

  const cliArgs = [cliPath, "record-devlog"];
  pushFlag(cliArgs, "input", path.resolve(process.cwd(), flags.input));
  pushFlag(cliArgs, "source-agent", flags["source-agent"] ?? "bridge-agent");
  pushFlag(cliArgs, "target-agent", flags["target-agent"] ?? "devlog-agent");
  pushFlag(cliArgs, "sync-agent", flags["sync-agent"] ?? flags["target-agent"] ?? "devlog-agent");
  pushFlag(cliArgs, "priority", flags.priority);
  pushFlag(cliArgs, "handoff-title", flags["handoff-title"]);
  pushFlag(cliArgs, "result", flags.result);
  pushFlag(cliArgs, "note", flags.note);

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, cliArgs, {
      cwd: xlinkDir,
      stdio: "inherit",
      env: process.env
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`xlink record-devlog failed with exit code ${code}`));
    });
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
