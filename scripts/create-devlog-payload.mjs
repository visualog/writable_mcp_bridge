import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.join(__dirname, "devlog-payload.template.json");

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

function formatDate(date = new Date()) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "long" });
  const year = date.getFullYear();
  return `${day} ${month}, ${year}`;
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

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function printUsage() {
  console.log(`
create devlog payload

Usage:
  node scripts/create-devlog-payload.mjs --title "dashboard-board helper added"

Optional:
  --type feature
  --output /tmp/devlog-payload.json
  --tag xbridge
  --tag build-layout
  --file src/build-layout.js
`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help || !flags.title) {
    printUsage();
    process.exitCode = flags.help ? 0 : 1;
    return;
  }

  const template = JSON.parse(await fs.readFile(TEMPLATE_PATH, "utf8"));
  const now = new Date();
  const payload = {
    ...template,
    type: flags.type ?? template.type,
    title: flags.title,
    date: formatDate(now),
    summary: flags.summary ?? `${flags.title} 작업을 기록한다.`,
    details: flags.detail ? [flags.detail] : template.details,
    tags: Array.isArray(flags.tag) ? flags.tag : flags.tag ? [flags.tag] : template.tags,
    commit: flags.commit ?? "",
    version: flags.version ?? template.version,
    files: flags.file ? (Array.isArray(flags.file) ? flags.file : [flags.file]) : template.files,
    thumbnail: flags.thumbnail ?? "",
    codeSnippets: template.codeSnippets
  };

  const outputPath = path.resolve(
    process.cwd(),
    flags.output ?? `/tmp/devlog-payload-${slugify(flags.title)}-${stamp(now)}.json`
  );

  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
