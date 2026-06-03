import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildDesignerWorkflowReadinessReport } from "../src/designer-workflow-readiness-report.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const baseUrl = process.env.XBRIDGE_BASE_URL || "http://127.0.0.1:3846";
const explicitPluginId = process.env.XBRIDGE_QA_PLUGIN_ID || "";
const explicitDsFileKey = process.env.XBRIDGE_QA_DS_FILE_KEY || "";
const dsComponentQuery = process.env.XBRIDGE_QA_DS_COMPONENT_QUERY || "button";
const requireDsComponentSet = /^(1|true|yes)$/iu.test(
  process.env.XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET || ""
);
const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
const outputDir = path.join(repoRoot, "docs", "qa", "runs", `designer-workflow-${runStamp}`);
const captureDir = path.join(outputDir, "captures");
const FIXTURE_IMAGE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8AARLJgYGD4DwABBgEAGFneWAAAAABJRU5ErkJggg==";

function runCommand(command, args = []) {
  return new Promise((resolve) => {
    execFile(command, args, { cwd: repoRoot }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error?.code ?? 0,
        stdout: String(stdout || ""),
        stderr: String(stderr || "")
      });
    });
  });
}

async function capture(name) {
  await mkdir(captureDir, { recursive: true });
  await runCommand("osascript", ["-e", 'tell application "Figma" to activate']);
  await new Promise((resolve) => setTimeout(resolve, 800));
  const filePath = path.join(captureDir, `${name}.png`);
  const result = await runCommand("screencapture", ["-x", filePath]);
  return {
    ok: result.ok,
    filePath,
    error: result.ok ? null : result.stderr || result.stdout || "screencapture failed"
  };
}

async function exportNodeCapture(pluginId, targetNodeId, name) {
  await mkdir(captureDir, { recursive: true });
  const filePath = path.join(captureDir, `${name}.png`);
  const response = await post("/api/export-node", {
    pluginId,
    targetNodeId,
    format: "png",
    scale: 1,
    contentsOnly: false
  });
  const dataBase64 = response.body?.result?.dataBase64;
  if (!response.ok || !dataBase64) {
    const fallback = await capture(`${name}-desktop-fallback`);
    return {
      ok: false,
      filePath,
      error: response.error || response.body?.error || "export-node did not return dataBase64",
      fallback
    };
  }
  await writeFile(filePath, Buffer.from(String(dataBase64), "base64"));
  return {
    ok: true,
    filePath,
    durationMs: response.durationMs,
    export: {
      status: response.status,
      nodeId: targetNodeId,
      format: "png"
    }
  };
}

async function summarizeResults(resultPath) {
  const summaryPath = path.join(outputDir, "summary.md");
  const args = [
    path.join("scripts", "summarize-designer-workflow-qa.mjs"),
    "--input",
    resultPath,
    "--output",
    summaryPath
  ];
  if (requireDsComponentSet) {
    args.push("--require-release-gates");
  }
  const result = await runCommand(process.execPath, args);
  let parsed = null;
  try {
    parsed = result.stdout.trim() ? JSON.parse(result.stdout) : null;
  } catch {
    parsed = null;
  }
  return {
    ok: result.ok && parsed?.ok !== false,
    summaryPath,
    exitCode: result.code,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    parsed
  };
}

function formatReadinessMarkdown(report) {
  const nextActions = Array.isArray(report.nextActions) ? report.nextActions : [];
  return [
    "# Designer Workflow Live Readiness",
    "",
    `- ok: ${report.ok ? "true" : "false"}`,
    `- reason: ${report.reason}`,
    `- serverVersion: ${report.serverVersion || "unknown"}`,
    `- transport: ${report.transport}`,
    `- commandReadiness: ${report.commandReadiness}`,
    `- writeReadiness: ${report.writeReadiness}`,
    `- requiresExplicitPluginId: ${report.requiresExplicitPluginId ? "true" : "false"}`,
    `- explicitPluginId: ${report.explicitPluginId || "(none)"}`,
    `- livePluginIds: ${report.livePluginIds.length ? report.livePluginIds.join(", ") : "(none)"}`,
    "",
    "## Summary",
    "",
    report.summary,
    "",
    "## Next Actions",
    "",
    ...nextActions.map((item) => `- ${item}`),
    ""
  ].join("\n");
}

async function writeReadinessReport(healthBefore) {
  const readiness = buildDesignerWorkflowReadinessReport({
    health: healthBefore,
    explicitPluginId
  });
  const readinessPath = path.join(outputDir, "live-readiness.json");
  const readinessMarkdownPath = path.join(outputDir, "live-readiness.md");
  await writeFile(readinessPath, JSON.stringify(readiness, null, 2), "utf8");
  await writeFile(readinessMarkdownPath, formatReadinessMarkdown(readiness), "utf8");
  return {
    readiness,
    readinessPath,
    readinessMarkdownPath
  };
}

async function request(method, urlPath, body) {
  const startedAt = Date.now();
  let response;
  let payload;
  try {
    response = await fetch(`${baseUrl}${urlPath}`, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const text = await response.text();
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }
  } catch (error) {
    return {
      ok: false,
      status: 0,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      body: null
    };
  }
  return {
    ok: response.ok && payload?.ok !== false,
    status: response.status,
    durationMs: Date.now() - startedAt,
    error: payload?.error || null,
    body: payload
  };
}

const get = (urlPath) => request("GET", urlPath);
const post = (urlPath, body) => request("POST", urlPath, body);

function resultNodeId(response, key = "created") {
  return (
    response?.body?.result?.[key]?.id ||
    response?.body?.result?.id ||
    response?.body?.result?.nodeId ||
    null
  );
}

function resultComponentId(response) {
  return (
    response?.body?.result?.component?.id ||
    response?.body?.result?.created?.component?.id ||
    response?.body?.result?.created?.id ||
    response?.body?.result?.id ||
    null
  );
}

async function createNode(pluginId, body) {
  const response = await post("/api/create-node", {
    pluginId,
    ...body
  });
  return {
    response,
    id: resultNodeId(response)
  };
}

async function readNode(pluginId, nodeId, maxDepth = 1) {
  return post("/api/get-node-details", {
    pluginId,
    targetNodeId: nodeId,
    maxDepth,
    maxNodes: 80
  });
}

function compactEvidence(response) {
  const result = response?.body?.result || {};
  const node = result.node || result.root || result;
  return {
    ok: response?.ok === true,
    status: response?.status,
    durationMs: response?.durationMs,
    error: response?.error || response?.body?.error || null,
    node: node && typeof node === "object"
      ? {
          id: node.id,
          name: node.name,
          type: node.type,
          visible: node.visible,
          locked: node.locked,
          isMask: node.isMask,
          clipsContent: node.clipsContent,
          geometry: node.geometry,
          fills: Array.isArray(node.fills) ? node.fills.slice(0, 3) : undefined,
          boundVariables: node.boundVariables,
          layoutMode: node.layoutMode,
          itemSpacing: node.itemSpacing,
          cornerRadius: node.cornerRadius,
          strokeWeight: node.strokeWeight,
          strokes: Array.isArray(node.strokes) ? node.strokes.slice(0, 3) : undefined,
          effects: Array.isArray(node.effects) ? node.effects.slice(0, 3) : undefined,
          effectCount: Array.isArray(node.effects) ? node.effects.length : undefined,
          characters: node.characters,
          childCount: node.childCount ?? (Array.isArray(node.children) ? node.children.length : undefined)
        }
      : null,
    resultKeys: result && typeof result === "object" ? Object.keys(result).slice(0, 12) : []
  };
}

function scoreSemanticColorVariable(variable) {
  if (String(variable?.resolvedType || "").toUpperCase() !== "COLOR") {
    return -1;
  }
  const haystack = [
    variable.name,
    variable.collection,
    Array.isArray(variable.scopes) ? variable.scopes.join(" ") : ""
  ]
    .join(" ")
    .toLowerCase();
  let score = 1;
  if (/semantic|theme|surface|background|bg|container|canvas/.test(haystack)) score += 4;
  if (/semantic/.test(haystack)) score += 4;
  if (/surface|background|bg|container|canvas/.test(haystack)) score += 4;
  if (/color/.test(haystack)) score += 1;
  if (/primitive|avatar|chart|alpha/.test(haystack)) score -= 2;
  if (variable.remote === false) score += 1;
  if (variable.id) score += 2;
  return score;
}

async function selectSemanticColorVariableCandidate(tokenExportResponse) {
  const filePath = tokenExportResponse?.body?.result?.filePath;
  if (!filePath) {
    return null;
  }
  const artifact = JSON.parse(await readFile(filePath, "utf8"));
  const variables = Array.isArray(artifact.variables) ? artifact.variables : [];
  const candidates = variables
    .filter((variable) => variable && variable.id && String(variable.resolvedType || "").toUpperCase() === "COLOR")
    .map((variable) => ({ variable, score: scoreSemanticColorVariable(variable) }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || String(a.variable.name || "").localeCompare(String(b.variable.name || "")));
  const selected = candidates[0]?.variable || null;
  if (!selected) {
    return null;
  }
  return {
    id: selected.id,
    key: selected.key || null,
    name: selected.name || "",
    collection: selected.collection || "",
    resolvedType: selected.resolvedType || "",
    score: candidates[0].score,
    filePath,
    candidateCount: candidates.length
  };
}

function compactDesignerChatEvidence(response) {
  const bundle = response?.body?.designerSuggestionBundle || {};
  const references = Array.isArray(bundle.knowledgeReferences)
    ? bundle.knowledgeReferences
    : [];
  return {
    ok: response?.ok === true,
    status: response?.status,
    durationMs: response?.durationMs,
    error: response?.error || response?.body?.error || null,
    intentKind: response?.body?.intentKind || response?.body?.intentEnvelope?.intents?.[0]?.kind || null,
    aiBackend: response?.body?.aiBackend || null,
    codexStatus: response?.body?.codexStatus || null,
    fallbackUsed: Boolean(response?.body?.fallbackUsed),
    knowledgeReferenceCount: references.length,
    knowledgeReferences: references.slice(0, 4).map((entry) => ({
      id: entry.id,
      title: entry.title,
      sourcePath: entry.sourcePath,
      sourceKind: entry.sourceKind
    }))
  };
}

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function resolveDsFileKey(healthResponse) {
  const body = healthResponse?.body || {};
  const activeSession = body.activeSession || {};
  return pickFirstString(
    explicitDsFileKey,
    activeSession.fileKey,
    activeSession.file?.key,
    activeSession.figmaFileKey,
    body.fileKey,
    body.activeFileKey
  );
}

function compactComponentSearchEvidence(response) {
  const result = response?.body?.result || {};
  const matches = Array.isArray(result.matches) ? result.matches : [];
  return {
    ok: response?.ok === true,
    status: response?.status,
    durationMs: response?.durationMs,
    error: response?.error || response?.body?.error || null,
    fileKey: result.fileKey || null,
    query: dsComponentQuery,
    matchCount: matches.length,
    truncated: Boolean(result.truncated),
    matches: matches.slice(0, 5).map((item) => ({
      key: item.key,
      nodeId: item.nodeId,
      name: item.name,
      description: item.description,
      containingFrame: item.containingFrame?.name || null
    }))
  };
}

function findDesignSystemComponentPage(pagesResponse) {
  const pages = Array.isArray(pagesResponse?.body?.result?.pages)
    ? pagesResponse.body.result.pages
    : [];
  const query = dsComponentQuery.toLowerCase();
  return (
    pages.find((page) => String(page?.name || "").toLowerCase().includes(query)) ||
    pages.find((page) => /button/i.test(String(page?.name || ""))) ||
    null
  );
}

function compactLiveComponentNodeEvidence(response, page) {
  const result = response?.body?.result || {};
  const matches = Array.isArray(result.matches) ? result.matches : [];
  return {
    ok: response?.ok === true,
    status: response?.status,
    durationMs: response?.durationMs,
    error: response?.error || response?.body?.error || null,
    source: "live_search_nodes",
    pageId: page?.id || null,
    pageName: page?.name || null,
    query: dsComponentQuery,
    matchCount: matches.length,
    truncated: Boolean(result.truncated),
    matches: matches.slice(0, 5).map((item) => ({
      nodeId: item.id || item.nodeId || null,
      name: item.name,
      type: item.type,
      depth: item.depth,
      childCount: item.childCount
    }))
  };
}

async function searchLiveDesignSystemComponentCandidate(pluginId) {
  const pages = await get(`/api/pages?pluginId=${encodeURIComponent(pluginId)}`);
  const page = findDesignSystemComponentPage(pages);
  if (!pages.ok || !page?.id) {
    return {
      evidence: {
        ok: false,
        status: pages.status,
        durationMs: pages.durationMs,
        error: pages.error || pages.body?.error || "No matching design-system component page found.",
        source: "live_search_nodes",
        query: dsComponentQuery,
        pageId: null,
        pageName: null,
        matchCount: 0
      }
    };
  }
  const search = await post("/api/search-nodes", {
    pluginId,
    pageId: page.id,
    scope: "current-page",
    query: dsComponentQuery,
    nodeTypes: ["COMPONENT_SET", "COMPONENT"],
    maxDepth: 8,
    maxResults: 10,
    detailLevel: "light"
  });
  return {
    evidence: compactLiveComponentNodeEvidence(search, page)
  };
}

function makeCase(id, area, prompt, selection, expected, action) {
  return {
    id,
    area,
    prompt,
    selection,
    expected,
    action,
    startedAt: new Date().toISOString()
  };
}

async function runCase(cases, definition, fn) {
  const entry = { ...definition };
  try {
    const result = await fn();
    entry.status = result.status || (result.pass === false ? "fail" : "pass");
    entry.readbackEvidence = result.evidence || {};
    entry.failureHandling = result.failureHandling || null;
    entry.durationMs = result.durationMs;
  } catch (error) {
    entry.status = "fail";
    entry.readbackEvidence = {
      error: error instanceof Error ? error.message : String(error)
    };
  }
  entry.finishedAt = new Date().toISOString();
  cases.push(entry);
  return entry;
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const healthBefore = await get("/health");
  const activeSessionResolution = healthBefore.body?.activeSessionResolution || {};
  const requiresExplicitPluginId = Boolean(activeSessionResolution.requiresExplicitPluginId);
  if (!explicitPluginId && requiresExplicitPluginId) {
    const readinessReport = await writeReadinessReport(healthBefore);
    console.log(JSON.stringify({ ok: false, reason: readinessReport.readiness.reason, ...readinessReport }, null, 2));
    process.exitCode = 1;
    return;
  }
  const pluginId =
    explicitPluginId ||
    activeSessionResolution.primaryPluginId ||
    healthBefore.body?.activePluginId;

  if (!pluginId) {
    const readinessReport = await writeReadinessReport(healthBefore);
    console.log(JSON.stringify({ ok: false, reason: readinessReport.readiness.reason, ...readinessReport }, null, 2));
    process.exitCode = 1;
    return;
  }

  const cases = [];
  const createdNodeIds = [];

  const root = await createNode(pluginId, {
    nodeType: "FRAME",
    name: `QA Designer Workflow Fixture ${runStamp}`,
    x: -3920,
    y: 4940,
    width: 760,
    height: 560,
    fillColor: "#F8FAFC",
    cornerRadius: 18
  });
  if (!root.id) {
    throw new Error(`Failed to create fixture root: ${root.response.error || root.response.status}`);
  }
  createdNodeIds.push(root.id);

  const title = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "TEXT",
    name: "fixture-title",
    x: 24,
    y: 24,
    width: 360,
    height: 36,
    characters: "QA Designer Workflow",
    fontSize: 18
  });
  const cardA = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "FRAME",
    name: "card-a",
    x: 24,
    y: 80,
    width: 200,
    height: 104,
    fillColor: "#FFFFFF",
    cornerRadius: 10
  });
  const cardB = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "FRAME",
    name: "card-b",
    x: 250,
    y: 80,
    width: 200,
    height: 104,
    fillColor: "#FFFFFF",
    cornerRadius: 10
  });
  const buttonA = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "RECTANGLE",
    name: "button-a",
    x: 24,
    y: 230,
    width: 132,
    height: 40,
    fillColor: "#0066FF",
    cornerRadius: 8
  });
  const buttonB = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "RECTANGLE",
    name: "button-b",
    x: 180,
    y: 236,
    width: 116,
    height: 36,
    fillColor: "#0066FF",
    cornerRadius: 6
  });
  const rowA = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "FRAME",
    name: "row-a",
    x: 24,
    y: 320,
    width: 480,
    height: 48,
    fillColor: "#EEF2F7",
    cornerRadius: 6
  });
  const rowB = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "FRAME",
    name: "row-b",
    x: 24,
    y: 384,
    width: 480,
    height: 56,
    fillColor: "#EEF2F7",
    cornerRadius: 6
  });
  const hidden = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "RECTANGLE",
    name: "hidden-safety-target",
    x: 560,
    y: 80,
    width: 72,
    height: 72,
    fillColor: "#F97316",
    cornerRadius: 8
  });
  const lockedTarget = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "RECTANGLE",
    name: "locked-safety-target",
    x: 650,
    y: 80,
    width: 72,
    height: 72,
    fillColor: "#FACC15",
    cornerRadius: 8
  });
  const maskTarget = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "RECTANGLE",
    name: "mask-safety-target",
    x: 650,
    y: 170,
    width: 88,
    height: 88,
    fillColor: "#111827",
    cornerRadius: 20,
    isMask: true
  });
  const empty = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "FRAME",
    name: "empty-cleanup-target",
    x: 560,
    y: 190,
    width: 100,
    height: 72,
    fillColor: "#FFFFFF",
    cornerRadius: 8
  });
  const componentSource = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "FRAME",
    name: "component-source-button",
    x: 560,
    y: 290,
    width: 140,
    height: 44,
    fillColor: "#111827",
    cornerRadius: 10
  });
  const variantSourceA = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "FRAME",
    name: "variant-source-state-default",
    x: 560,
    y: 360,
    width: 140,
    height: 44,
    fillColor: "#2563EB",
    cornerRadius: 10
  });
  const variantSourceB = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "FRAME",
    name: "variant-source-state-disabled",
    x: 560,
    y: 420,
    width: 140,
    height: 44,
    fillColor: "#CBD5E1",
    cornerRadius: 10
  });
  const imageCardA = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "RECTANGLE",
    name: "image-card-a",
    x: 360,
    y: 230,
    width: 120,
    height: 80,
    cornerRadius: 10,
    imageDataBase64: FIXTURE_IMAGE_PNG_BASE64,
    imageScaleMode: "FILL"
  });
  const imageCardB = await createNode(pluginId, {
    parentId: root.id,
    nodeType: "RECTANGLE",
    name: "image-card-b",
    x: 360,
    y: 330,
    width: 148,
    height: 92,
    cornerRadius: 10,
    imageDataBase64: FIXTURE_IMAGE_PNG_BASE64,
    imageScaleMode: "FILL"
  });

  const childIds = [
    title,
    cardA,
    cardB,
    buttonA,
    buttonB,
    rowA,
    rowB,
    hidden,
    lockedTarget,
    maskTarget,
    empty,
    componentSource,
    variantSourceA,
    variantSourceB,
    imageCardA,
    imageCardB
  ]
    .map((item) => item.id)
    .filter(Boolean);
  createdNodeIds.push(...childIds);
  const beforeCapture = await exportNodeCapture(pluginId, root.id, "before");

  await runCase(cases, makeCase(
    "RAG01",
    "RAG / Response Evidence",
    "이 QA fixture의 Designer Workflow Auto Layout 검수 기준과 참조한 기준을 근거로 정리해줘",
    root.id,
    "designer chat 응답에 document_chunk 기반 knowledgeReferences가 포함된다.",
    "/api/designer/chat"
  ), async () => {
    const chat = await post("/api/designer/chat", {
      pluginId,
      message: "이 QA fixture의 Designer Workflow Auto Layout 검수 기준과 참조한 기준을 근거로 정리해줘",
      figmaContext: {
        pageName: "Designer Workflow QA",
        selection: [{ id: root.id, name: `QA Designer Workflow Fixture ${runStamp}`, type: "FRAME" }]
      }
    });
    const references = Array.isArray(chat.body?.designerSuggestionBundle?.knowledgeReferences)
      ? chat.body.designerSuggestionBundle.knowledgeReferences
      : [];
    return {
      evidence: compactDesignerChatEvidence(chat),
      pass:
        chat.ok &&
        references.length > 0 &&
        references.some((entry) => entry.sourceKind === "document_chunk"),
      failureHandling: "knowledgeReferences가 없으면 RAG가 실제 브리지 응답에 남지 않은 것으로 보고 release gate를 통과시키지 않는다."
    };
  });

  await runCase(cases, makeCase(
    "DS01",
    "Design System Component Evidence",
    "실제 디자인 시스템 버튼 컴포넌트셋 후보를 찾아 variant/property 근거를 보여줘",
    "live Figma component page or current file REST component metadata",
    "실제 DS 파일의 component/component set 후보를 검색하고 후보 이름, nodeId, containing frame을 evidence로 남긴다.",
    "search_nodes live component page + search_file_components release fixture"
  ), async () => {
    const liveCandidate = await searchLiveDesignSystemComponentCandidate(pluginId);
    if (liveCandidate.evidence.matchCount > 0) {
      return {
        status: "pass",
        evidence: {
          ...liveCandidate.evidence,
          required: requireDsComponentSet
        },
        failureHandling: "실제 live Figma component/component set 후보가 검색되면 DS component evidence gate를 통과한다."
      };
    }

    const fileKey = resolveDsFileKey(healthBefore);
    const hasToken = Boolean(String(process.env.FIGMA_ACCESS_TOKEN || "").trim());
    if (!fileKey || !hasToken) {
      return {
        status: requireDsComponentSet ? "fail" : "skip",
        evidence: {
          liveCandidate: liveCandidate.evidence,
          fileKeyAvailable: Boolean(fileKey),
          figmaAccessTokenAvailable: hasToken,
          required: requireDsComponentSet,
          query: dsComponentQuery
        },
        failureHandling: "Release 검수에서는 live Figma component page search 또는 XBRIDGE_QA_DS_FILE_KEY/active session fileKey와 FIGMA_ACCESS_TOKEN으로 실제 DS component set 후보를 검증해야 한다."
      };
    }
    const search = await post("/api/search-file-components", {
      fileKey,
      query: dsComponentQuery,
      maxResults: 10
    });
    const evidence = compactComponentSearchEvidence(search);
    const hasComponentCandidate = evidence.matchCount > 0;
    return {
      status: hasComponentCandidate ? "pass" : requireDsComponentSet ? "fail" : "skip",
      evidence: {
        ...evidence,
        required: requireDsComponentSet
      },
      failureHandling: "실제 DS component 후보가 없으면 자동 대체/variant 변경을 수행하지 않고 후보 없음 또는 검색 범위/쿼리 조정 필요를 보고해야 한다."
    };
  });

  await runCase(cases, makeCase(
    "L01",
    "Auto Layout",
    "선택한 카드 묶음을 세로 Auto Layout으로 정리하고 간격을 12로 맞춰줘",
    root.id,
    "부모 frame이 VERTICAL auto layout과 gap 12를 가진다.",
    "update_node"
  ), async () => {
    const update = await post("/api/update-node", {
      pluginId,
      nodeId: root.id,
      layoutMode: "VERTICAL",
      itemSpacing: 12,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 16,
      paddingBottom: 16
    });
    const readback = await readNode(pluginId, root.id);
    return {
      evidence: { update: compactEvidence(update), readback: compactEvidence(readback) },
      pass: update.ok && readback.ok
    };
  });

  await runCase(cases, makeCase("L02", "Auto Layout", "이 버튼 그룹을 가로 정렬로 바꾸고 좌우 padding을 맞춰줘", root.id, "HORIZONTAL layout과 padding 값이 적용된다.", "update_node"), async () => {
    const update = await post("/api/update-node", {
      pluginId,
      nodeId: root.id,
      layoutMode: "HORIZONTAL",
      itemSpacing: 16,
      paddingLeft: 20,
      paddingRight: 20
    });
    const readback = await readNode(pluginId, root.id);
    return { evidence: { update: compactEvidence(update), readback: compactEvidence(readback) }, pass: update.ok && readback.ok };
  });

  await runCase(cases, makeCase("L03", "Padding", "선택한 카드 padding을 16으로 통일해줘", root.id, "padding 4방향이 16으로 통일된다.", "update_node"), async () => {
    const update = await post("/api/update-node", {
      pluginId,
      nodeId: root.id,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 16,
      paddingBottom: 16
    });
    const readback = await readNode(pluginId, root.id);
    return { evidence: { update: compactEvidence(update), readback: compactEvidence(readback) }, pass: update.ok && readback.ok };
  });

  await runCase(cases, makeCase("L04", "Spacing", "리스트 행 사이 간격을 8로 통일해줘", root.id, "auto-layout spacing이 8로 정규화된다.", "normalize_spacing"), async () => {
    const normalized = await post("/api/normalize-spacing", {
      pluginId,
      containerId: root.id,
      spacing: 8,
      mode: "both",
      recursive: false
    });
    const readback = await readNode(pluginId, root.id);
    return { evidence: { normalized: compactEvidence(normalized), readback: compactEvidence(readback) }, pass: normalized.ok && readback.ok };
  });

  await runCase(cases, makeCase("L05", "Alignment", "선택한 요소들의 왼쪽 기준선을 맞춰줘", [buttonA.id, buttonB.id], "두 버튼의 x 좌표를 같은 값으로 맞춘다.", "bulk_update_nodes"), async () => {
    await post("/api/update-node", { pluginId, nodeId: root.id, layoutMode: "NONE" });
    const update = await post("/api/bulk-update-nodes", {
      pluginId,
      updates: [
        { nodeId: buttonA.id, x: 32 },
        { nodeId: buttonB.id, x: 32 }
      ]
    });
    const a = await readNode(pluginId, buttonA.id);
    const b = await readNode(pluginId, buttonB.id);
    return { evidence: { update: compactEvidence(update), buttonA: compactEvidence(a), buttonB: compactEvidence(b) }, pass: update.ok && a.ok && b.ok };
  });

  await runCase(cases, makeCase("L06", "Alignment", "아이콘과 텍스트를 세로 중앙 정렬해줘", root.id, "counterAxisAlignItems=CENTER가 적용된다.", "update_node"), async () => {
    const update = await post("/api/update-node", {
      pluginId,
      nodeId: root.id,
      layoutMode: "HORIZONTAL",
      counterAxisAlignItems: "CENTER"
    });
    const readback = await readNode(pluginId, root.id);
    return { evidence: { update: compactEvidence(update), readback: compactEvidence(readback) }, pass: update.ok && readback.ok };
  });

  await runCase(cases, makeCase("L07", "Distribution", "상단 탭들을 같은 간격으로 배치해줘", root.id, "SPACE_BETWEEN 분배가 적용된다.", "update_node"), async () => {
    const update = await post("/api/update-node", {
      pluginId,
      nodeId: root.id,
      layoutMode: "HORIZONTAL",
      primaryAxisAlignItems: "SPACE_BETWEEN"
    });
    const readback = await readNode(pluginId, root.id);
    return { evidence: { update: compactEvidence(update), readback: compactEvidence(readback) }, pass: update.ok && readback.ok };
  });

  let buttonGroupFrameId = null;

  await runCase(cases, makeCase("L08", "Layer Structure", "선택한 레이어들을 하나의 프레임으로 묶어줘", [cardA.id, cardB.id], "새 wrapper frame이 생기고 card들이 그 안으로 이동한다.", "create_node + move_node"), async () => {
    const wrapper = await createNode(pluginId, {
      parentId: root.id,
      nodeType: "FRAME",
      name: "wrapped-card-group",
      x: 24,
      y: 80,
      width: 460,
      height: 132,
      fillColor: "#E0F2FE",
      cornerRadius: 12
    });
    const movedA = await post("/api/move-node", { pluginId, nodeId: cardA.id, parentId: wrapper.id, index: 0 });
    const movedB = await post("/api/move-node", { pluginId, nodeId: cardB.id, parentId: wrapper.id, index: 1 });
    const readback = await readNode(pluginId, wrapper.id, 2);
    return { evidence: { wrapperId: wrapper.id, movedA: compactEvidence(movedA), movedB: compactEvidence(movedB), readback: compactEvidence(readback) }, pass: wrapper.id && movedA.ok && movedB.ok && readback.ok };
  });

  await runCase(cases, makeCase("L09", "Layer Structure", "선택한 요소들을 그룹으로 묶어줘", [buttonA.id, buttonB.id], "Figma group API 대신 wrapper frame 대체 정책으로 두 버튼을 묶고 readback으로 검증한다.", "frame wrapping fallback mutation"), async () => {
    const wrapper = await createNode(pluginId, {
      parentId: root.id,
      nodeType: "FRAME",
      name: "button-group-wrapper",
      x: 24,
      y: 224,
      width: 300,
      height: 64,
      fillColor: "#DBEAFE",
      cornerRadius: 12
    });
    buttonGroupFrameId = wrapper.id;
    if (buttonGroupFrameId) {
      createdNodeIds.push(buttonGroupFrameId);
    }
    const movedA = buttonGroupFrameId
      ? await post("/api/move-node", { pluginId, nodeId: buttonA.id, parentId: buttonGroupFrameId, index: 0 })
      : { ok: false, status: 0, error: "button group wrapper missing" };
    const movedB = buttonGroupFrameId
      ? await post("/api/move-node", { pluginId, nodeId: buttonB.id, parentId: buttonGroupFrameId, index: 1 })
      : { ok: false, status: 0, error: "button group wrapper missing" };
    const readback = buttonGroupFrameId
      ? await readNode(pluginId, buttonGroupFrameId, 2)
      : { ok: false, status: 0, error: "button group wrapper missing" };
    return {
      evidence: {
        wrapperId: buttonGroupFrameId,
        wrapper: compactEvidence(wrapper.response),
        movedA: compactEvidence(movedA),
        movedB: compactEvidence(movedB),
        readback: compactEvidence(readback)
      },
      pass: Boolean(buttonGroupFrameId) && movedA.ok && movedB.ok && readback.ok,
      failureHandling: "native group API가 없어도 frame wrapping fallback을 실제 mutation으로 수행하고, 파괴적 편집 없이 wrapper readback을 남긴다."
    };
  });

  await runCase(cases, makeCase("L10", "Layer Structure", "불필요한 그룹을 풀고 레이어를 정리해줘", "button-group-wrapper", "wrapper frame의 자식 버튼들을 root로 되돌리고 wrapper를 삭제한다.", "move_node + delete_node unwrap fallback"), async () => {
    const before = buttonGroupFrameId
      ? await readNode(pluginId, buttonGroupFrameId, 2)
      : { ok: false, status: 0, error: "button group wrapper missing" };
    const movedA = buttonGroupFrameId
      ? await post("/api/move-node", { pluginId, nodeId: buttonA.id, parentId: root.id, index: 2 })
      : { ok: false, status: 0, error: "button group wrapper missing" };
    const movedB = buttonGroupFrameId
      ? await post("/api/move-node", { pluginId, nodeId: buttonB.id, parentId: root.id, index: 3 })
      : { ok: false, status: 0, error: "button group wrapper missing" };
    const deleted = buttonGroupFrameId
      ? await post("/api/delete-node", { pluginId, nodeId: buttonGroupFrameId })
      : { ok: false, status: 0, error: "button group wrapper missing" };
    const wrapperReadback = buttonGroupFrameId
      ? await readNode(pluginId, buttonGroupFrameId)
      : { ok: false, status: 0, error: "button group wrapper missing" };
    const buttonAReadback = await readNode(pluginId, buttonA.id);
    const buttonBReadback = await readNode(pluginId, buttonB.id);
    return {
      evidence: {
        before: compactEvidence(before),
        movedA: compactEvidence(movedA),
        movedB: compactEvidence(movedB),
        deleted: compactEvidence(deleted),
        wrapperReadback: compactEvidence(wrapperReadback),
        buttonA: compactEvidence(buttonAReadback),
        buttonB: compactEvidence(buttonBReadback)
      },
      pass: before.ok && movedA.ok && movedB.ok && deleted.ok && !wrapperReadback.ok && buttonAReadback.ok && buttonBReadback.ok,
      failureHandling: "native ungroup API가 없어도 자식 이동 후 wrapper 삭제로 되돌릴 수 있는 경우에만 mutation을 수행한다."
    };
  });

  await runCase(cases, makeCase("L11", "Section Move", "선택한 컴포넌트를 Component 섹션 아래로 옮겨줘", root.id, "SECTION이 아닌 대상은 move-section에서 실패하고 변경하지 않는다.", "move_section safe failure"), async () => {
    const moved = await post("/api/move-section", {
      pluginId,
      sectionId: root.id,
      destinationParentId: root.id,
      index: 0
    });
    return {
      evidence: { moved: compactEvidence(moved) },
      pass: moved.ok === false || moved.status >= 400,
      failureHandling: "대상 section을 특정하지 못하거나 선택 노드가 SECTION이 아니면 중단해야 한다."
    };
  });

  await runCase(cases, makeCase("L12", "Naming", "선택한 모바일 화면 레이어 이름을 규칙에 맞게 정리해줘", root.id, "naming rule preview가 생성되고 실제 rename은 명시적으로만 가능하다.", "apply_naming_rule preview"), async () => {
    const preview = await post("/api/apply-naming-rule", {
      pluginId,
      rootNodeId: root.id,
      ruleSet: "app-screen",
      recursive: true,
      previewOnly: true
    });
    return { evidence: { preview: compactEvidence(preview), updateCount: preview.body?.result?.updates?.length || 0 }, pass: preview.ok };
  });

  await runCase(cases, makeCase("L13", "Style", "선택한 버튼 색상을 primary 토큰으로 바꿔줘", buttonA.id, "버튼 fill이 primary fallback 색상으로 변경된다.", "update_node"), async () => {
    const update = await post("/api/update-node", {
      pluginId,
      nodeId: buttonA.id,
      fillColor: "#0052CC"
    });
    const readback = await readNode(pluginId, buttonA.id);
    return { evidence: { update: compactEvidence(update), readback: compactEvidence(readback) }, pass: update.ok && readback.ok };
  });

  await runCase(cases, makeCase("L14", "Typography", "제목 텍스트에 FDS heading 스타일을 적용해줘", title.id, "텍스트 크기가 heading 수준으로 커진다.", "update_node"), async () => {
    const update = await post("/api/update-node", {
      pluginId,
      nodeId: title.id,
      fontSize: 24,
      height: 40
    });
    const readback = await readNode(pluginId, title.id);
    return { evidence: { update: compactEvidence(update), readback: compactEvidence(readback) }, pass: update.ok && readback.ok };
  });

  await runCase(cases, makeCase("L15", "Style", "선택한 카드에 기본 border와 shadow 스타일을 적용해줘", cardA.id, "style id가 없으면 명확히 실패한 뒤 수동 border/shadow fallback을 실제 적용하고 readback으로 검증한다.", "apply_style invalid + manual_border_shadow"), async () => {
    const applied = await post("/api/apply-style", {
      pluginId,
      nodeId: cardA.id,
      styleType: "effect",
      styleId: "missing-effect-style-for-live-qa"
    });
    const fallback = await post("/api/update-node", {
      pluginId,
      nodeId: cardA.id,
      strokeColor: "#D0D7E2",
      strokeWeight: 1,
      dropShadow: {
        color: "#0F172A",
        opacity: 0.14,
        x: 0,
        y: 8,
        blur: 18
      }
    });
    const readback = await readNode(pluginId, cardA.id);
    const node = readback.body?.result?.node || {};
    const hasStroke = node.strokeWeight === 1 && Array.isArray(node.strokes) && node.strokes.some((stroke) => stroke.hex === "D0D7E2");
    const hasShadow = Array.isArray(node.effects) && node.effects.some((effect) => effect.type === "DROP_SHADOW" && effect.color?.hex === "0F172A");
    return {
      evidence: { applied: compactEvidence(applied), fallback: compactEvidence(fallback), readback: compactEvidence(readback) },
      pass: (applied.ok === false || applied.status >= 400) && fallback.ok && readback.ok && hasStroke && hasShadow,
      failureHandling: "스타일 id/key가 없으면 실패 근거를 유지하고, 사용자가 요청한 시각 효과는 명시 수동값 fallback으로 적용한다."
    };
  });

  await runCase(cases, makeCase("L16", "Variable", "이 배경색을 semantic surface 변수에 연결해줘", root.id, "token export에서 현재 파일의 semantic/surface COLOR 변수를 찾아 fills.color에 binding하고 readback으로 검증한다.", "export_design_tokens + bind_variable fills.color"), async () => {
    const tokenExport = await post("/api/export-design-tokens", {
      pluginId,
      includeAliases: true,
      includeResolvedValues: true,
      includeStyles: false
    });
    let candidate = null;
    if (tokenExport.ok) {
      candidate = await selectSemanticColorVariableCandidate(tokenExport);
    }
    const bind = await post("/api/bind-variable", {
      pluginId,
      nodeId: root.id,
      property: "fills.color",
      variableId: candidate?.id || "missing-variable-for-live-qa"
    });
    const readback = await readNode(pluginId, root.id);
    const boundAliases = readback.body?.result?.node?.boundVariables?.fills || [];
    const boundToCandidate = Array.isArray(boundAliases) && boundAliases.some((alias) => alias.variableId === candidate?.id);
    return {
      evidence: { tokenExport: compactEvidence(tokenExport), candidate, bind: compactEvidence(bind), readback: compactEvidence(readback) },
      pass: tokenExport.ok && Boolean(candidate?.id) && bind.ok && readback.ok && boundToCandidate,
      failureHandling: "semantic/surface COLOR 후보를 찾지 못하면 임의 변수로 바인딩하지 않고 후보 부족을 보고해야 한다."
    };
  });

  await runCase(cases, makeCase("L17", "Variable Safety", "색상 변수 연결을 해제하고 현재 색상은 유지해줘", buttonA.id, "unbind=true가 안전하게 처리되고 현재 색상은 유지된다.", "bind_variable unbind"), async () => {
    const unbind = await post("/api/bind-variable", {
      pluginId,
      nodeId: buttonA.id,
      property: "fills.color",
      unbind: true
    });
    const readback = await readNode(pluginId, buttonA.id);
    return {
      evidence: { unbind: compactEvidence(unbind), readback: compactEvidence(readback) },
      pass: unbind.ok && readback.ok,
      failureHandling: "resolved color가 확인되지 않으면 실제 unlink 전 confirmation을 요구해야 한다."
    };
  });

  await runCase(cases, makeCase("L21", "Hierarchy", "이 화면의 정보 계층을 더 명확하게 다듬어줘", title.id, "제목이 더 큰 크기와 상단 위치로 조정된다.", "update_node"), async () => {
    const update = await post("/api/update-node", {
      pluginId,
      nodeId: title.id,
      x: 24,
      y: 18,
      fontSize: 26
    });
    const readback = await readNode(pluginId, title.id);
    return { evidence: { update: compactEvidence(update), readback: compactEvidence(readback) }, pass: update.ok && readback.ok };
  });

  await runCase(cases, makeCase("L22", "Spacing", "이 화면 전체 간격을 FDS 기준으로 정리해줘", root.id, "recursive spacing normalize가 실행된다.", "normalize_spacing recursive"), async () => {
    const normalized = await post("/api/normalize-spacing", {
      pluginId,
      containerId: root.id,
      spacing: 12,
      mode: "both",
      recursive: true
    });
    const readback = await readNode(pluginId, root.id, 2);
    return { evidence: { normalized: compactEvidence(normalized), readback: compactEvidence(readback) }, pass: normalized.ok && readback.ok };
  });

  await runCase(cases, makeCase("L23", "Cleanup", "빈 프레임과 중복 텍스트를 정리해줘", empty.id, "명시 대상 empty frame이 삭제된다.", "delete_node"), async () => {
    const deleted = await post("/api/delete-node", { pluginId, nodeId: empty.id });
    const readback = await readNode(pluginId, empty.id);
    return { evidence: { deleted: compactEvidence(deleted), readbackAfterDelete: compactEvidence(readback) }, pass: deleted.ok && !readback.ok };
  });

  await runCase(cases, makeCase("L24", "Batch Edit", "선택한 버튼들을 모두 같은 높이와 radius로 맞춰줘", [buttonA.id, buttonB.id], "버튼 높이와 radius가 동일해진다.", "bulk_update_nodes"), async () => {
    const update = await post("/api/bulk-update-nodes", {
      pluginId,
      updates: [
        { nodeId: buttonA.id, height: 44, cornerRadius: 12 },
        { nodeId: buttonB.id, height: 44, cornerRadius: 12 }
      ]
    });
    const a = await readNode(pluginId, buttonA.id);
    const b = await readNode(pluginId, buttonB.id);
    return { evidence: { update: compactEvidence(update), buttonA: compactEvidence(a), buttonB: compactEvidence(b) }, pass: update.ok && a.ok && b.ok };
  });

  await runCase(cases, makeCase("L25", "Repeated Cards", "카드 리스트의 제목/본문 간격을 모두 같게 맞춰줘", [cardA.id, cardB.id], "반복 카드의 itemSpacing이 동일해진다.", "bulk_update_nodes"), async () => {
    const update = await post("/api/bulk-update-nodes", {
      pluginId,
      updates: [
        { nodeId: cardA.id, layoutMode: "VERTICAL", itemSpacing: 10, paddingLeft: 12, paddingTop: 12 },
        { nodeId: cardB.id, layoutMode: "VERTICAL", itemSpacing: 10, paddingLeft: 12, paddingTop: 12 }
      ]
    });
    const a = await readNode(pluginId, cardA.id);
    const b = await readNode(pluginId, cardB.id);
    return { evidence: { update: compactEvidence(update), cardA: compactEvidence(a), cardB: compactEvidence(b) }, pass: update.ok && a.ok && b.ok };
  });

  await runCase(cases, makeCase("L26", "Rows", "테이블 행 높이를 40으로 통일하고 텍스트를 왼쪽 정렬해줘", [rowA.id, rowB.id], "반복 row 높이가 40으로 통일된다.", "bulk_update_nodes"), async () => {
    const update = await post("/api/bulk-update-nodes", {
      pluginId,
      updates: [
        { nodeId: rowA.id, height: 40 },
        { nodeId: rowB.id, height: 40 }
      ]
    });
    const a = await readNode(pluginId, rowA.id);
    const b = await readNode(pluginId, rowB.id);
    return { evidence: { update: compactEvidence(update), rowA: compactEvidence(a), rowB: compactEvidence(b) }, pass: update.ok && a.ok && b.ok };
  });

  let componentId = null;
  let instanceId = null;
  let configurableInstanceId = null;
  let variantComponentAId = null;
  let variantComponentBId = null;
  let variantComponentSetId = null;

  await runCase(cases, makeCase("L18", "Component", "이 아이콘을 검색 아이콘 인스턴스로 교체해줘", componentSource.id, "로컬 component를 만들고 instance를 생성할 수 있다. 실제 swap은 후보 확인이 필요하다.", "create_component + create_instance"), async () => {
    const component = await post("/api/create-component", {
      pluginId,
      targetNodeId: componentSource.id,
      name: "QA/Icon/Search"
    });
    componentId = resultComponentId(component);
    if (componentId) {
      createdNodeIds.push(componentId);
    }
    const instance = componentId
      ? await post("/api/create-instance", {
          pluginId,
          sourceNodeId: componentId,
          parentId: root.id,
          name: "QA Search Icon Instance",
          x: 390,
          y: 292
        })
      : null;
    instanceId =
      instance?.body?.result?.created?.id ||
      instance?.body?.result?.id ||
      null;
    if (instanceId) {
      createdNodeIds.push(instanceId);
    }
    const readback = instanceId ? await readNode(pluginId, instanceId) : null;
    return {
      evidence: { component: compactEvidence(component), componentId, instance: compactEvidence(instance), instanceId, readback: compactEvidence(readback) },
      pass: component.ok && Boolean(componentId) && instance?.ok && Boolean(instanceId) && readback?.ok,
      failureHandling: "실제 검색 아이콘 후보가 여러 개면 자동 swap하지 않고 후보 선택을 받아야 한다."
    };
  });

  await runCase(cases, makeCase("L19", "Component", "선택한 버튼을 large / primary / disabled 상태로 바꿔줘", [variantSourceA.id, variantSourceB.id], "두 버튼 fixture를 component set으로 묶고 variant property 변경을 readback으로 검증한다.", "create_component_set + set_variant_properties"), async () => {
    const variantA = await post("/api/create-component", {
      pluginId,
      targetNodeId: variantSourceA.id,
      name: "State=Default, Size=Medium, Tone=Primary"
    });
    const variantB = await post("/api/create-component", {
      pluginId,
      targetNodeId: variantSourceB.id,
      name: "State=Disabled, Size=Medium, Tone=Primary"
    });
    variantComponentAId = resultComponentId(variantA);
    variantComponentBId = resultComponentId(variantB);
    if (variantComponentAId) {
      createdNodeIds.push(variantComponentAId);
    }
    if (variantComponentBId) {
      createdNodeIds.push(variantComponentBId);
    }
    const componentSet =
      variantComponentAId && variantComponentBId
        ? await post("/api/create-component-set", {
            pluginId,
            componentNodeIds: [variantComponentAId, variantComponentBId],
            parentId: root.id,
            name: "QA/Button"
          })
        : { ok: false, status: 0, error: "variant component ids missing" };
    variantComponentSetId =
      componentSet.body?.result?.componentSet?.id ||
      componentSet.body?.result?.created?.componentSet?.id ||
      componentSet.body?.result?.id ||
      null;
    if (variantComponentSetId) {
      createdNodeIds.push(variantComponentSetId);
    }
    const setComponentIds = Array.isArray(componentSet.body?.result?.componentIds)
      ? componentSet.body.result.componentIds
      : [variantComponentAId, variantComponentBId].filter(Boolean);
    const targetVariantId = setComponentIds[0] || variantComponentAId;
    const variant = targetVariantId
      ? await post("/api/set-variant-properties", {
          pluginId,
          componentNodeId: targetVariantId,
          variantProperties: { Size: "Large", Tone: "Primary", State: "Default" }
        })
      : { ok: false, status: 0, error: "target variant id missing" };
    const detail = variantComponentSetId
      ? await post("/api/get-component-variant-details", {
          pluginId,
          nodeId: variantComponentSetId,
          includeChildren: false,
          maxDepth: 1,
          maxNodes: 20
        })
      : { ok: false, status: 0, error: "component set id missing" };
    const variants = Array.isArray(detail.body?.result?.variants)
      ? detail.body.result.variants
      : [];
    const updatedVariant = variants.find((item) => item.id === targetVariantId) || null;
    return {
      evidence: {
        variantA: compactEvidence(variantA),
        variantB: compactEvidence(variantB),
        componentSet: compactEvidence(componentSet),
        componentSetId: variantComponentSetId,
        targetVariantId,
        variant: compactEvidence(variant),
        detail: compactEvidence(detail),
        updatedVariant: updatedVariant
          ? {
              id: updatedVariant.id,
              name: updatedVariant.name,
              variantProperties: updatedVariant.variantProperties || null
            }
          : null
      },
      pass:
        variantA.ok &&
        variantB.ok &&
        Boolean(variantComponentAId) &&
        Boolean(variantComponentBId) &&
        componentSet.ok &&
        Boolean(variantComponentSetId) &&
        variant.ok &&
        detail.ok &&
        variants.length >= 2 &&
        Boolean(updatedVariant) &&
        updatedVariant.variantProperties?.Size === "Large",
      failureHandling: "variant 축/값이 실제 component set에서 확인되지 않으면 자동 변경하지 않고 후보 속성/값 매핑 보고 후 중단해야 한다."
    };
  });

  await runCase(cases, makeCase("L20", "Component", "직접 그린 버튼을 디자인 시스템 버튼 컴포넌트로 대체해줘", componentSource.id, "local component instance로 대체 가능한 경로를 검증하고 원본 보존 여부를 증거로 남긴다.", "component replacement proxy"), async () => {
    const source = await readNode(pluginId, componentId || componentSource.id);
    const instance = instanceId ? await readNode(pluginId, instanceId) : null;
    return {
      evidence: { componentSource: compactEvidence(source), replacementInstance: compactEvidence(instance) },
      pass: source.ok && instance?.ok,
      failureHandling: "원본 삭제/대체는 파괴적이므로 backup 또는 confirmation 없이는 자동 삭제하지 않는다."
    };
  });

  await runCase(cases, makeCase("L27", "Safety", "선택한 화면 전체를 정리해줘", root.id, "locked fixture는 명시 허용 없이 수정되지 않고 readback으로 locked/geometry 보존을 확인한다.", "locked fixture mutation blocked"), async () => {
    const lock = await post("/api/update-node", {
      pluginId,
      nodeId: lockedTarget.id,
      locked: true
    });
    const blockedMutation = await post("/api/update-node", {
      pluginId,
      nodeId: lockedTarget.id,
      width: 120,
      height: 120
    });
    const readback = await readNode(pluginId, lockedTarget.id);
    const node = readback.body?.result?.node || {};
    const geometry = node.geometry || {};
    return {
      evidence: { lock: compactEvidence(lock), blockedMutation: compactEvidence(blockedMutation), readback: compactEvidence(readback) },
      pass:
        lock.ok &&
        (blockedMutation.ok === false || blockedMutation.status >= 400) &&
        readback.ok &&
        node.locked === true &&
        geometry.width === 72 &&
        geometry.height === 72,
      failureHandling: "locked node는 allowLocked=true 같은 명시 허용 없이는 자동 수정하지 않고 skipped/blocked로 보고해야 한다."
    };
  });

  await runCase(cases, makeCase("L28", "Hidden Safety", "숨겨진 레이어까지 포함해서 정리해줘", hidden.id, "hidden fixture는 명시 허용 없이 수정되지 않고 readback으로 visible/geometry 보존을 확인한다.", "hidden fixture mutation blocked"), async () => {
    const hide = await post("/api/update-node", { pluginId, nodeId: hidden.id, visible: false });
    const blockedMutation = await post("/api/update-node", {
      pluginId,
      nodeId: hidden.id,
      width: 120,
      height: 120,
      fillColor: "#EF4444"
    });
    const readback = await readNode(pluginId, hidden.id);
    const node = readback.body?.result?.node || {};
    const geometry = node?.geometry || {};
    return {
      evidence: { hide: compactEvidence(hide), blockedMutation: compactEvidence(blockedMutation), readback: compactEvidence(readback) },
      pass:
        hide.ok &&
        (blockedMutation.ok === false || blockedMutation.status >= 400) &&
        readback.ok &&
        node.visible === false &&
        geometry.width === 72 &&
        geometry.height === 72,
      failureHandling: "hidden node는 allowHidden=true 같은 명시 허용 없이는 자동 수정하지 않고 skipped/blocked로 보고해야 한다."
    };
  });

  await runCase(cases, makeCase("L29", "Safety", "이미지 카드들을 같은 크기로 맞춰줘", root.id, "이미지 fill을 유지한 채 컨테이너 크기만 맞추고 readback으로 imageHash/scaleMode 보존을 확인한다.", "image card resize preserving fills"), async () => {
    const beforeA = await readNode(pluginId, imageCardA.id);
    const beforeB = await readNode(pluginId, imageCardB.id);
    const update = await post("/api/bulk-update-nodes", {
      pluginId,
      updates: [
        { nodeId: imageCardA.id, width: 160, height: 96 },
        { nodeId: imageCardB.id, width: 160, height: 96 }
      ]
    });
    const afterA = await readNode(pluginId, imageCardA.id);
    const afterB = await readNode(pluginId, imageCardB.id);
    const beforeNodeA = beforeA.body?.result?.node || {};
    const beforeNodeB = beforeB.body?.result?.node || {};
    const afterNodeA = afterA.body?.result?.node || {};
    const afterNodeB = afterB.body?.result?.node || {};
    const beforeFillA = Array.isArray(beforeNodeA.fills) ? beforeNodeA.fills.find((fill) => fill.type === "IMAGE") : null;
    const beforeFillB = Array.isArray(beforeNodeB.fills) ? beforeNodeB.fills.find((fill) => fill.type === "IMAGE") : null;
    const afterFillA = Array.isArray(afterNodeA.fills) ? afterNodeA.fills.find((fill) => fill.type === "IMAGE") : null;
    const afterFillB = Array.isArray(afterNodeB.fills) ? afterNodeB.fills.find((fill) => fill.type === "IMAGE") : null;
    const geometryA = afterNodeA.geometry || {};
    const geometryB = afterNodeB.geometry || {};
    const sizeMatched = geometryA.width === 160 && geometryA.height === 96 && geometryB.width === 160 && geometryB.height === 96;
    const fillsPreserved =
      beforeFillA &&
      beforeFillB &&
      afterFillA &&
      afterFillB &&
      beforeFillA.imageHash === afterFillA.imageHash &&
      beforeFillB.imageHash === afterFillB.imageHash &&
      afterFillA.scaleMode === "FILL" &&
      afterFillB.scaleMode === "FILL";
    return {
      evidence: {
        beforeA: compactEvidence(beforeA),
        beforeB: compactEvidence(beforeB),
        update: compactEvidence(update),
        afterA: compactEvidence(afterA),
        afterB: compactEvidence(afterB)
      },
      pass: beforeA.ok && beforeB.ok && update.ok && afterA.ok && afterB.ok && sizeMatched && fillsPreserved,
      failureHandling: "이미지 crop/mask 자체를 바꾸지 않고 size만 변경하며, imageHash/scaleMode가 바뀌면 실패로 보고해야 한다."
    };
  });

  await runCase(cases, makeCase("L31", "Mask Safety", "마스크로 잘린 이미지 카드까지 포함해서 정리해줘", maskTarget.id, "mask fixture는 명시 허용 없이 수정되지 않고 readback으로 isMask/geometry 보존을 확인한다.", "mask fixture mutation blocked"), async () => {
    const before = await readNode(pluginId, maskTarget.id);
    const blockedMutation = await post("/api/update-node", {
      pluginId,
      nodeId: maskTarget.id,
      width: 140,
      height: 140,
      fillColor: "#EF4444"
    });
    const readback = await readNode(pluginId, maskTarget.id);
    const node = readback.body?.result?.node || {};
    const geometry = node.geometry || {};
    return {
      evidence: { before: compactEvidence(before), blockedMutation: compactEvidence(blockedMutation), readback: compactEvidence(readback) },
      pass:
        before.ok &&
        (blockedMutation.ok === false || blockedMutation.status >= 400) &&
        readback.ok &&
        node.isMask === true &&
        geometry.width === 88 &&
        geometry.height === 88,
      failureHandling: "mask node는 allowMask=true 같은 명시 허용 없이는 자동 수정하지 않고 skipped/blocked로 보고해야 한다."
    };
  });

  await runCase(cases, makeCase("L30", "Safety", "인스턴스 안의 텍스트와 색상을 직접 고쳐줘", instanceId || root.id, "지원 가능한 component property는 실제 변경하고 내부 레이어 직접 수정은 confirmation 대상으로 남긴다.", "add_component_property + set_component_properties"), async () => {
    const addProperty = componentId
      ? await post("/api/add-component-property", {
          pluginId,
          targetNodeId: componentId,
          propertyName: "Label",
          propertyType: "TEXT",
          defaultValue: "Default label"
        })
      : { ok: false, status: 0, error: "componentId missing" };
    const configurableInstance =
      componentId && addProperty.ok
        ? await post("/api/create-instance", {
            pluginId,
            sourceNodeId: componentId,
            parentId: root.id,
            name: "QA Configurable Instance",
            x: 390,
            y: 352
          })
        : { ok: false, status: 0, error: "component property unavailable" };
    configurableInstanceId =
      configurableInstance.body?.result?.created?.id ||
      configurableInstance.body?.result?.id ||
      null;
    if (configurableInstanceId) {
      createdNodeIds.push(configurableInstanceId);
    }
    const beforeProperties = configurableInstanceId
      ? await post("/api/list-component-properties", {
          pluginId,
          targetNodeId: configurableInstanceId
        })
      : { ok: false, status: 0, error: "configurable instance missing" };
    const propertyName = Array.isArray(beforeProperties.body?.result?.properties)
      ? beforeProperties.body.result.properties.find((item) => String(item.name || "").startsWith("Label#"))?.name ||
        beforeProperties.body.result.properties[0]?.name ||
        null
      : null;
    const setProps =
      configurableInstanceId && propertyName
        ? await post("/api/set-component-properties", {
            pluginId,
            nodeId: configurableInstanceId,
            properties: { [propertyName]: "Updated label" }
          })
        : { ok: false, status: 0, error: "component property key missing" };
    const afterProperties = configurableInstanceId
      ? await post("/api/list-component-properties", {
          pluginId,
          targetNodeId: configurableInstanceId
        })
      : { ok: false, status: 0, error: "configurable instance missing" };
    const updatedProperty = Array.isArray(afterProperties.body?.result?.properties)
      ? afterProperties.body.result.properties.find((item) => item.name === propertyName) || null
      : null;
    return {
      evidence: {
        addProperty: compactEvidence(addProperty),
        configurableInstance: compactEvidence(configurableInstance),
        configurableInstanceId,
        beforeProperties: compactEvidence(beforeProperties),
        propertyName,
        setProps: compactEvidence(setProps),
        afterProperties: compactEvidence(afterProperties),
        updatedProperty
      },
      pass:
        addProperty.ok &&
        configurableInstance.ok &&
        Boolean(configurableInstanceId) &&
        beforeProperties.ok &&
        Boolean(propertyName) &&
        setProps.ok &&
        afterProperties.ok &&
        updatedProperty?.value === "Updated label",
      failureHandling: "component property로 노출된 값만 자동 변경하고, 인스턴스 내부 레이어 직접 수정/분리는 confirmation 없이는 금지한다."
    };
  });

  await runCase(cases, makeCase("N01-N06", "Network", "네트워크 안전성과 속도 확인", pluginId, "health/runtime queue/transport/write readiness가 정상이다.", "health + runtime"), async () => {
    const recoveryWrite = await post("/api/rename-node", {
      pluginId,
      nodeId: root.id,
      name: `QA Designer Workflow Fixture ${runStamp} verified`
    });
    const health = await get("/health");
    const runtime = await get("/api/runtime-ops");
    const queue = runtime.body?.result?.queue || {};
    const commandStatus = health.body?.commandReadiness?.status;
    const writeStatus = health.body?.writeReadiness?.status;
    return {
      evidence: {
        recoveryWrite: compactEvidence(recoveryWrite),
        health: {
          status: health.status,
          durationMs: health.durationMs,
          transport: health.body?.transportHealth?.grade,
          commandReadiness: commandStatus,
          writeReadiness: writeStatus,
          activeSessionResolution: health.body?.activeSessionResolution?.status
        },
        runtime: {
          status: runtime.status,
          durationMs: runtime.durationMs,
          pendingTotal: queue.pendingTotal,
          pendingResultsTotal: queue.pendingResultsTotal,
          recentFailedTotal: runtime.body?.result?.failures?.recentFailedTotal,
          fallbackRate: runtime.body?.result?.transportHealth?.fallbackRate,
          wsDispatchSuccessRate: runtime.body?.result?.transportHealth?.wsDispatchSuccessRate
        }
      },
      pass:
        recoveryWrite.ok &&
        health.ok &&
        runtime.ok &&
        commandStatus === "ready" &&
        writeStatus === "ready" &&
        queue.pendingTotal === 0 &&
        queue.pendingResultsTotal === 0
    };
  });

  const afterCapture = await exportNodeCapture(pluginId, root.id, "after");
  const healthAfter = await get("/health");
  const runtimeAfter = await get("/api/runtime-ops");
  const summary = {
    baseUrl,
    pluginId,
    runStamp,
    outputDir,
    rootNodeId: root.id,
    createdNodeCount: createdNodeIds.length,
    casesTotal: cases.length,
    passTotal: cases.filter((item) => item.status === "pass").length,
    skipTotal: cases.filter((item) => item.status === "skip").length,
    failTotal: cases.filter((item) => item.status === "fail").length,
    beforeCapture,
    afterCapture,
    healthBefore: {
      ok: healthBefore.body?.ok,
      status: healthBefore.status,
      durationMs: healthBefore.durationMs,
      activeSessionResolution: healthBefore.body?.activeSessionResolution,
      transport: healthBefore.body?.transportHealth?.grade,
      commandReadiness: healthBefore.body?.commandReadiness?.status,
      writeReadiness: healthBefore.body?.writeReadiness?.status
    },
    healthAfter: {
      ok: healthAfter.body?.ok,
      status: healthAfter.status,
      durationMs: healthAfter.durationMs,
      activeSessionResolution: healthAfter.body?.activeSessionResolution,
      transport: healthAfter.body?.transportHealth?.grade,
      commandReadiness: healthAfter.body?.commandReadiness?.status,
      writeReadiness: healthAfter.body?.writeReadiness?.status
    },
    runtimeAfter: {
      status: runtimeAfter.status,
      durationMs: runtimeAfter.durationMs,
      pendingTotal: runtimeAfter.body?.result?.queue?.pendingTotal,
      pendingResultsTotal: runtimeAfter.body?.result?.queue?.pendingResultsTotal,
      recentFailedTotal: runtimeAfter.body?.result?.failures?.recentFailedTotal,
      historicalFailedTotal: runtimeAfter.body?.result?.failures?.historicalFailedTotal
    }
  };

  const result = {
    summary,
    cases
  };

  const resultPath = path.join(outputDir, "results.json");
  await writeFile(resultPath, JSON.stringify(result, null, 2), "utf8");
  const qaSummary = await summarizeResults(resultPath);
  console.log(JSON.stringify({ ok: summary.failTotal === 0 && qaSummary.ok, resultPath, summaryPath: qaSummary.summaryPath, summary, qaSummary }, null, 2));
  if (summary.failTotal > 0 || !qaSummary.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
