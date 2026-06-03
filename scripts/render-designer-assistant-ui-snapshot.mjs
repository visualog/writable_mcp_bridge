#!/usr/bin/env node
import assert from "node:assert/strict";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import vm from "node:vm";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const uiPath = path.join(repoRoot, "figma-plugin", "ui.html");
const uiSource = readFileSync(uiPath, "utf8");
const execFileAsync = promisify(execFile);

function extractUiFunctionSource(source, functionName) {
  const start = source.indexOf(`function ${functionName}`);
  assert.notEqual(start, -1, `missing UI function ${functionName}`);
  const argsOpen = source.indexOf("(", start);
  assert.notEqual(argsOpen, -1, `missing UI function args ${functionName}`);
  let argsDepth = 0;
  let argsClose = -1;
  for (let index = argsOpen; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") {
      argsDepth += 1;
    } else if (char === ")") {
      argsDepth -= 1;
      if (argsDepth === 0) {
        argsClose = index;
        break;
      }
    }
  }
  assert.notEqual(argsClose, -1, `unterminated UI function args ${functionName}`);
  const openBrace = source.indexOf("{", argsClose);
  assert.notEqual(openBrace, -1, `missing UI function body ${functionName}`);
  let depth = 0;
  for (let index = openBrace; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`unterminated UI function ${functionName}`);
}

function createRenderer(source) {
  const functionNames = [
    "escapeHtml",
    "normalizeDesignerString",
    "normalizeDesignerArray",
    "normalizeDesignerAssistantText",
    "formatDesignerInlineMarkdown",
    "normalizeDesignerAssistantSectionKey",
    "isDesignerAssistantSectionHeading",
    "buildDesignerAssistantBlocks",
    "getDesignerAssistantCardAttrs",
    "renderDesignerAssistantBlock",
    "buildDesignerResponseFilterbar",
    "stripDesignerEvidencePrefix",
    "getDesignerAssistantTitle",
    "getDesignerAssistantConclusion",
    "getDesignerAssistantEvidenceItems",
    "getDesignerAssistantIssueItems",
    "getDesignerAssistantPriorityItems",
    "getDesignerAssistantActionItems",
    "getDesignerAssistantKnowledgeItems",
    "getDesignerAssistantLimitations",
    "formatDesignerAssistantReply"
  ];
  const context = vm.createContext({});
  vm.runInContext(functionNames.map((name) => extractUiFunctionSource(source, name)).join("\n"), context);
  return context;
}

function extractInlineCss(source) {
  const match = source.match(/<style>\s*([\s\S]*?)\s*<\/style>/u);
  return match?.[1] || "";
}

function createSampleBundle() {
  return {
    result: {
      ai: {
        response: {
          reply:
            "프리미티브 컬러 팔레트 분석 결과입니다. limitations: styleCount가 0이어서 스타일 사용 현황은 판단하지 않았습니다."
        }
      }
    },
    bundle: {
      summaryText: "프리미티브 컬러 팔레트 분석 결과",
      findings: [
        { detail: "컬렉션 7개, 변수 548개, 프리미티브 변수 222개를 확인했습니다." },
        { detail: "[높음] dark/Black alpha 명칭이 실제 역할과 다를 수 있습니다." }
      ],
      recommendations: [
        {
          actionType: "design_system_alignment",
          title: "dark/Black alpha 역할 확인",
          reason: "white alpha 역할이면 명칭을 조정해야 합니다."
        },
        { actionType: "next_step", title: "semantic/theme 연결을 확인하세요." }
      ],
      knowledgeReferences: [
        {
          title: "Designer Workflow QA",
          sourceKind: "document_chunk",
          sourcePath: "docs/qa/figma-designer-workflow-test-plan-20260601.ko.md",
          guidance:
            "답변은 근거, 개선 필요, 우선순위, 다음 액션, readback evidence를 분리해 표시합니다."
        }
      ]
    }
  };
}

function buildSnapshot(renderer, sample) {
  const reply = renderer.formatDesignerAssistantReply(sample.result, sample.bundle);
  const blocks = renderer.buildDesignerAssistantBlocks(reply);
  const filterbar = renderer.buildDesignerResponseFilterbar(blocks);
  const renderedBlocks = blocks.map((block) => renderer.renderDesignerAssistantBlock(block));
  const renderedHtml = [filterbar, ...renderedBlocks].join("\n");
  const sectionCounts = blocks.reduce((counts, block) => {
    const key = block.sectionKey || "summary";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
  const requiredSections = ["summary", "evidence", "issue", "priority", "action", "knowledge", "limitation"];
  const checks = {
    requiredSectionsPresent: requiredSections.every((key) => sectionCounts[key] > 0),
    knowledgeCardRendered: /designer-assistant-card-knowledge/u.test(renderedHtml),
    issueCardRendered: /designer-assistant-card-issue/u.test(renderedHtml),
    actionCardRendered: /designer-assistant-card-action/u.test(renderedHtml),
    knowledgeFilterRendered: /data-designer-response-filter="knowledge"/u.test(renderedHtml),
    referenceTextNotSplitIntoFakeSections:
      /Designer Workflow QA[^<]+근거, 개선 필요, 우선순위, 다음 액션, readback evidence/u.test(renderedHtml)
  };
  return {
    reply,
    blocks,
    filterbar,
    renderedHtml,
    sectionCounts,
    checks,
    ok: Object.values(checks).every(Boolean)
  };
}

function buildPreviewHtml(css, renderedHtml) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Xbridge Assistant Response UI Snapshot</title>
  <style>
${css}
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: start center;
      padding: 32px;
      background: #1f2023;
      color: #f2f4f5;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .snapshot-frame {
      width: min(560px, 100%);
      padding: 18px;
      border-radius: 18px;
      background: #111214;
      box-shadow: 0 18px 60px rgba(0, 0, 0, 0.34);
    }
  </style>
</head>
<body>
  <main class="snapshot-frame">
    <section id="designer-messages" class="designer-messages" role="log" aria-live="polite">
      <div class="designer-message assistant" data-response-filter="all">
        <div class="designer-message-body">
          <div class="designer-message-copy">
${renderedHtml}
          </div>
        </div>
      </div>
    </section>
  </main>
</body>
</html>
`;
}

async function findChromeExecutable() {
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed Chromium-based browser.
    }
  }
  return null;
}

async function renderScreenshotIfAvailable(htmlPath, pngPath) {
  const chrome = await findChromeExecutable();
  if (!chrome) {
    return { ok: false, skipped: true, reason: "Chrome/Chromium executable not found" };
  }
  try {
    await execFileAsync(chrome, [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--window-size=760,1100",
      `--screenshot=${pngPath}`,
      `file://${htmlPath}`
    ]);
    const info = await stat(pngPath);
    return { ok: true, filePath: pngPath, bytes: info.size, chrome };
  } catch (error) {
    return {
      ok: false,
      skipped: true,
      reason: error?.message || "Chrome screenshot failed",
      chrome
    };
  }
}

const renderer = createRenderer(uiSource);
const sample = createSampleBundle();
const snapshot = buildSnapshot(renderer, sample);
assert.equal(snapshot.ok, true, `assistant UI snapshot checks failed: ${JSON.stringify(snapshot.checks)}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(repoRoot, "docs", "qa", "runs", `assistant-response-ui-${stamp}`);
await mkdir(outputDir, { recursive: true });

await writeFile(
  path.join(outputDir, "snapshot.json"),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      uiPath: path.relative(repoRoot, uiPath),
      sectionCounts: snapshot.sectionCounts,
      checks: snapshot.checks,
      reply: snapshot.reply,
      blocks: snapshot.blocks
    },
    null,
    2
  )
);

await writeFile(
  path.join(outputDir, "assistant-response.html"),
  buildPreviewHtml(extractInlineCss(uiSource), snapshot.renderedHtml)
);

const htmlPath = path.join(outputDir, "assistant-response.html");
const pngPath = path.join(outputDir, "assistant-response.png");
const screenshot = await renderScreenshotIfAvailable(htmlPath, pngPath);

console.log(
  JSON.stringify(
    {
      ok: true,
      outputDir,
      html: htmlPath,
      screenshot,
      snapshot: path.join(outputDir, "snapshot.json"),
      sectionCounts: snapshot.sectionCounts,
      checks: snapshot.checks
    },
    null,
    2
  )
);
