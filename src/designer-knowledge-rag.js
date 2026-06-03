import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KNOWLEDGE_CORPUS = [
  {
    id: "buddy-operational-contract",
    title: "Buddy-style evidence-first response contract",
    sourcePath: "docs/buddy/06-operational-contract.md",
    tags: ["buddy", "report", "evidence", "limitations", "response"],
    guidance:
      "Start with what was read, summarize evidence, then provide strengths, issues, priorities, next actions, and put limitations at the end."
  },
  {
    id: "pipeline-architecture",
    title: "Bridge to Codex to Figma pipeline architecture",
    sourcePath: "docs/buddy/08-xbridge-pipeline-architecture.md",
    tags: ["pipeline", "codex", "figma", "readback", "write"],
    guidance:
      "Classify intent, read Figma deterministically, compact context/evidence, ask Codex for structured output, run write commands only when needed, then validate with readback."
  },
  {
    id: "designer-workflow-qa",
    title: "Designer workflow editing QA matrix",
    sourcePath: "docs/qa/figma-designer-workflow-test-plan-20260601.ko.md",
    tags: ["designer", "workflow", "layout", "component", "style", "safety", "figma"],
    guidance:
      "Designer requests must be checked against layout, layer structure, style/token, component, repeated edit, screen polish, and safety handling scenarios with readback evidence."
  },
  {
    id: "response-display-ux",
    title: "Progressive chat response display UX",
    sourcePath: "docs/reverse-engineering/response-display-ux-ui.md",
    tags: ["ui", "console", "chat", "progress", "message", "streaming"],
    guidance:
      "Render assistant output as structured chat blocks with progressive status, markdown sections, bullets, priority lists, and concise completion cards instead of one long escaped text blob."
  },
  {
    id: "streaming-first-ops",
    title: "Streaming-first transport and queue safety",
    sourcePath: "docs/authoring/streaming-first-ops.md",
    tags: ["network", "transport", "streaming", "sse", "websocket", "queue", "readiness"],
    guidance:
      "Keep WS/SSE first, verify health/runtime parity, watch pending queue totals, distinguish historical failures from recent failures, and recover readiness after successful commands."
  },
  {
    id: "dynamic-page-figma-guide",
    title: "Figma dynamic-page access constraints",
    sourcePath: "tests/token-export-contract.test.js",
    tags: ["figma", "dynamic-page", "style", "variable", "async", "token"],
    guidance:
      "Under documentAccess dynamic-page, use async node/style/variable APIs and page-scoped loading before reading or mutating local styles, variables, and node details."
  },
  {
    id: "image-reconstruction-quality",
    title: "Image reconstruction quality gates",
    sourcePath: "docs/image-analysis-post-build-quality-gate.md",
    tags: ["image", "screen", "generation", "quality", "bbox", "text", "overlap"],
    guidance:
      "Image-to-screen generation must validate role coverage, text coverage, bbox alignment, overlap, icon fallback, and readback quality before claiming success."
  },
  {
    id: "design-system-registry",
    title: "Design system registry and component knowledge",
    sourcePath: "docs/authoring/ds-registry-schema.md",
    tags: ["design-system", "registry", "component", "token", "semantic"],
    guidance:
      "Use registry knowledge to map semantic intents to components, tokens, and safe fallbacks instead of inventing component names or token bindings."
  }
];

const DOCUMENT_CORPUS = [
  {
    id: "buddy-operational-contract",
    title: "Buddy-style evidence-first response contract",
    sourcePath: "docs/buddy/06-operational-contract.md",
    tags: ["buddy", "report", "evidence", "limitations", "response"]
  },
  {
    id: "pipeline-architecture",
    title: "Bridge to Codex to Figma pipeline architecture",
    sourcePath: "docs/buddy/08-xbridge-pipeline-architecture.md",
    tags: ["pipeline", "codex", "figma", "readback", "write"]
  },
  {
    id: "designer-workflow-qa",
    title: "Designer workflow editing QA matrix",
    sourcePath: "docs/qa/figma-designer-workflow-test-plan-20260601.ko.md",
    tags: ["designer", "workflow", "layout", "component", "style", "safety", "figma"]
  },
  {
    id: "diverse-bridge-qa",
    title: "Figma bridge diverse QA matrix",
    sourcePath: "docs/qa/figma-bridge-diverse-test-plan-20260601.md",
    tags: ["qa", "designer", "workflow", "release", "test", "figma"]
  },
  {
    id: "streaming-first-ops",
    title: "Streaming-first transport and queue safety",
    sourcePath: "docs/authoring/streaming-first-ops.md",
    tags: ["network", "transport", "streaming", "sse", "websocket", "queue", "readiness"]
  },
  {
    id: "design-system-registry",
    title: "Design system registry and component knowledge",
    sourcePath: "docs/authoring/ds-registry-schema.md",
    tags: ["design-system", "registry", "component", "token", "semantic"]
  },
  {
    id: "image-reconstruction-quality",
    title: "Image reconstruction quality gates",
    sourcePath: "docs/image-analysis-post-build-quality-gate.md",
    tags: ["image", "screen", "generation", "quality", "bbox", "text", "overlap"]
  }
];

const MAX_DOCUMENT_CHARS = 90000;
const MAX_CHUNKS_PER_DOCUMENT = 18;
const MAX_CHUNK_GUIDANCE_CHARS = 900;
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(MODULE_DIR, "..");
let cachedDocumentChunks = null;

function normalizeString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function tokenize(value) {
  return Array.from(
    new Set(
      normalizeString(value)
        .toLowerCase()
        .split(/[^0-9a-z가-힣_./:-]+/u)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  );
}

function buildQuery({ request = "", intentKind = "", targetType = "", readCommands = [], contextHints = [] } = {}) {
  return [
    request,
    intentKind,
    targetType,
    Array.isArray(readCommands) ? readCommands.join(" ") : "",
    Array.isArray(contextHints) ? contextHints.join(" ") : ""
  ]
    .map(normalizeString)
    .filter(Boolean)
    .join(" ");
}

function slugify(value = "") {
  return normalizeString(value)
    .toLowerCase()
    .replace(/[^0-9a-z가-힣]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 48) || "chunk";
}

function clampGuidance(value = "") {
  const normalized = normalizeString(value);
  return normalized.length > MAX_CHUNK_GUIDANCE_CHARS
    ? `${normalized.slice(0, MAX_CHUNK_GUIDANCE_CHARS - 1)}…`
    : normalized;
}

function splitDocumentIntoSections(markdown = "") {
  const lines = String(markdown || "").split(/\r?\n/u);
  const sections = [];
  let currentHeading = "Document";
  let currentLines = [];
  const flush = () => {
    const body = currentLines.join("\n").trim();
    if (body) {
      sections.push({ heading: currentHeading, body });
    }
    currentLines = [];
  };
  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,4})\s+(.+?)\s*$/u);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[2].trim();
      continue;
    }
    currentLines.push(line);
  }
  flush();
  return sections.length > 0 ? sections : [{ heading: "Document", body: markdown }];
}

function buildDocumentChunksForSource(source, repoRoot = DEFAULT_REPO_ROOT) {
  const absolutePath = path.join(repoRoot, source.sourcePath);
  if (!existsSync(absolutePath)) {
    return [];
  }
  const markdown = readFileSync(absolutePath, "utf8").slice(0, MAX_DOCUMENT_CHARS);
  const chunks = [];
  for (const section of splitDocumentIntoSections(markdown)) {
    if (chunks.length >= MAX_CHUNKS_PER_DOCUMENT) {
      break;
    }
    const paragraphs = section.body
      .split(/\n{2,}/u)
      .map((item) => item.trim())
      .filter(Boolean);
    let buffer = "";
    for (const paragraph of paragraphs) {
      const candidate = [buffer, paragraph].filter(Boolean).join("\n\n");
      if (candidate.length > 1600 && buffer) {
        chunks.push({
          ...source,
          id: `${source.id}#${slugify(section.heading)}-${chunks.length + 1}`,
          sourceKind: "document_chunk",
          chunkHeading: section.heading,
          guidance: clampGuidance(`${section.heading}: ${buffer}`)
        });
        buffer = paragraph;
        if (chunks.length >= MAX_CHUNKS_PER_DOCUMENT) {
          break;
        }
      } else {
        buffer = candidate;
      }
    }
    if (buffer && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
      chunks.push({
        ...source,
        id: `${source.id}#${slugify(section.heading)}-${chunks.length + 1}`,
        sourceKind: "document_chunk",
        chunkHeading: section.heading,
        guidance: clampGuidance(`${section.heading}: ${buffer}`)
      });
    }
  }
  return chunks;
}

function getDocumentKnowledgeChunks() {
  if (cachedDocumentChunks) {
    return cachedDocumentChunks;
  }
  cachedDocumentChunks = DOCUMENT_CORPUS.flatMap((source) =>
    buildDocumentChunksForSource(source)
  );
  return cachedDocumentChunks;
}

function getStaticKnowledgeDocuments() {
  return KNOWLEDGE_CORPUS.map((document) => ({
    ...document,
    sourceKind: "static_summary"
  }));
}

function getKnowledgeDocuments() {
  return [
    ...getDocumentKnowledgeChunks(),
    ...getStaticKnowledgeDocuments()
  ];
}

function scoreDocument(document, queryTokens) {
  if (!queryTokens.length) {
    return 0;
  }
  const haystack = tokenize([
    document.id,
    document.title,
    document.sourcePath,
    Array.isArray(document.tags) ? document.tags.join(" ") : "",
    document.chunkHeading,
    document.guidance
  ].join(" "));
  const haystackSet = new Set(haystack);
  let score = 0;
  for (const token of queryTokens) {
    if (haystackSet.has(token)) {
      score += 3;
      continue;
    }
    if (document.tags.some((tag) => tag.includes(token) || token.includes(tag))) {
      score += 2;
      continue;
    }
    if (document.guidance.toLowerCase().includes(token)) {
      score += 1;
    }
  }
  return score;
}

export function retrieveDesignerKnowledge(input = {}, { limit = 4 } = {}) {
  const query = buildQuery(input);
  const queryTokens = tokenize(query);
  const ranked = getKnowledgeDocuments()
    .map((document) => ({
      ...document,
      score: scoreDocument(document, queryTokens)
    }))
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(8, Math.floor(limit))))
    .map((document) => ({
      id: document.id,
      title: document.title,
      sourcePath: document.sourcePath,
      sourceKind: document.sourceKind || "static_summary",
      chunkHeading: normalizeString(document.chunkHeading),
      score: document.score,
      tags: Array.isArray(document.tags) ? document.tags.slice(0, 6) : [],
      guidance: document.guidance
    }));

  return {
    strategy: "local_document_chunk_bm25_light",
    query,
    queryTokens: queryTokens.slice(0, 16),
    resultCount: ranked.length,
    results: ranked
  };
}

export function listDesignerKnowledgeSources() {
  return getKnowledgeDocuments().map((document) => ({
    id: document.id,
    title: document.title,
    sourcePath: document.sourcePath,
    sourceKind: document.sourceKind || "static_summary",
    chunkHeading: normalizeString(document.chunkHeading),
    tags: Array.isArray(document.tags) ? document.tags.slice() : []
  }));
}
