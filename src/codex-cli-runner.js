import { spawn } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const INSPECT_SELECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "summary", "details", "followUp"],
  properties: {
    intent: { type: "string" },
    summary: { type: "string" },
    details: {
      type: "array",
      items: { type: "string" }
    },
    followUp: { type: "string" }
  }
};

const TEXT_REWRITE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "updates"],
  properties: {
    summary: { type: "string" },
    updates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text"],
        properties: {
          id: { type: "string" },
          text: { type: "string" }
        }
      }
    }
  }
};

const VARIANT_UPDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "componentNodeId", "variantProperties"],
  properties: {
    summary: { type: "string" },
    componentNodeId: { type: "string" },
    variantProperties: {
      type: "object",
      minProperties: 1,
      additionalProperties: {
        type: "string"
      }
    }
  }
};

const DESIGNER_SUGGESTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings", "recommendations"],
  properties: {
    summary: { type: "string" },
    findings: {
      type: "array",
      items: { type: "string" }
    },
    recommendations: {
      type: "array",
      items: { type: "string" }
    }
  }
};

const IMAGE_LAYOUT_HELPERS = new Set([
  "screen",
  "row",
  "column",
  "card",
  "section",
  "list",
  "list-item",
  "media-row",
  "search-result-row",
  "status-chip",
  "avatar-stack",
  "progress-bar",
  "toolbar",
  "tabbar",
  "data-table",
  "browser-chrome",
  "sidebar-nav",
  "workspace-switcher",
  "profile-summary",
  "divider",
  "app-shell",
  "dashboard-board",
  "text"
]);

const IMAGE_LAYOUT_ICON_FONT_FAMILY = "SF Pro";
const IMAGE_LAYOUT_ICON_FONT_STYLE = "Regular";
const IMAGE_LAYOUT_GRID_UNIT = 4;
export const DEFAULT_IMAGE_LAYOUT_TIMEOUT_MS = 240000;
const IMAGE_LAYOUT_CANVAS_PRESETS = {
  mobile: {
    width: 390,
    height: 844,
    margin: { x: 24, y: 0 },
    columns: 4,
    gutter: 16
  },
  tablet: {
    width: 768,
    height: 1024,
    margin: { x: 32, y: 0 },
    columns: 8,
    gutter: 24
  },
  web: {
    width: 1440,
    height: 1024,
    margin: { x: 80, y: 0 },
    columns: 12,
    gutter: 24
  }
};
const IMAGE_LAYOUT_SQUARE_ROLE_PATTERN =
  /\b(avatar|icon-button|icon|symbol|checkbox|radio|dot|knob|swatch|app-icon|square-media|thumbnail-square)\b|아바타|아이콘/u;
const IMAGE_LAYOUT_TEXT_ROLE_PRESETS = {
  "nav-title": { fontSize: 14, fontStyle: "Semi Bold", lineHeight: 20 },
  "screen-title": { fontSize: 28, fontStyle: "Bold", lineHeight: 36 },
  "section-title": { fontSize: 16, fontStyle: "Semi Bold", lineHeight: 20 },
  label: { fontSize: 12, fontStyle: "Medium", lineHeight: 16 },
  "chip-label": { fontSize: 12, fontStyle: "Medium", lineHeight: 16 },
  "tab-label": { fontSize: 12, fontStyle: "Medium", lineHeight: 16 },
  body: { fontSize: 14, fontStyle: "Regular", lineHeight: 20 },
  "body-strong": { fontSize: 14, fontStyle: "Semi Bold", lineHeight: 20 },
  caption: { fontSize: 11, fontStyle: "Regular", lineHeight: 16 },
  meta: { fontSize: 12, fontStyle: "Regular", lineHeight: 16 },
  "meta-strong": { fontSize: 12, fontStyle: "Semi Bold", lineHeight: 16 },
  metric: { fontSize: 14, fontStyle: "Semi Bold", lineHeight: 20 },
  value: { fontSize: 14, fontStyle: "Semi Bold", lineHeight: 20 },
  "button-label": { fontSize: 14, fontStyle: "Medium", lineHeight: 20 }
};

export const IMAGE_LAYOUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["canvasSpecJson", "layoutMapJson", "roleMapJson", "summary", "textStyleMapJson", "treeJson"],
  properties: {
    canvasSpecJson: { type: "string" },
    layoutMapJson: { type: "string" },
    summary: { type: "string" },
    textStyleMapJson: { type: "string" },
    roleMapJson: { type: "string" },
    treeJson: { type: "string" }
  }
};

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(value) {
  const text = normalizeString(value).toLowerCase();
  return text === "1" || text === "true" || text === "yes" || text === "on";
}

function sanitizeContextForPrompt(contextModel = {}) {
  if (!contextModel || typeof contextModel !== "object") {
    return {};
  }
  return {
    meta: contextModel.meta || {},
    target: contextModel.target || {},
    selection: Array.isArray(contextModel.selection) ? contextModel.selection : [],
    focusedNode: contextModel.focusedNode || {},
    structure: contextModel.structure || {},
    designSystem: contextModel.designSystem || {},
    pageContext: contextModel.pageContext || {},
    readMeta: contextModel.readMeta || {}
  };
}

function buildInspectSelectionPrompt({ request = "", contextModel = {} } = {}) {
  const payload = {
    request: normalizeString(request),
    contextModel: sanitizeContextForPrompt(contextModel)
  };

  return [
    "당신은 Xbridge의 Figma 선택 구조 설명 백엔드 작업자입니다.",
    "직접 캔버스를 수정하지 마세요.",
    "제공된 contextModel만 근거로 설명하세요.",
    "variant, override, source component가 있으면 우선 설명하세요.",
    "확실하지 않은 내용은 추정하지 말고 부족하다고 적으세요.",
    "최종 출력은 주어진 JSON Schema에 맞는 JSON 하나만 반환하세요.",
    "",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

function buildDesignerSuggestionPrompt({
  request = "",
  intentKind = "",
  contextModel = {},
  suggestionBundle = {},
  pipeline = null
} = {}) {
  const payload = {
    request: normalizeString(request),
    intentKind: normalizeString(intentKind) || "analyze",
    contextModel: sanitizeContextForPrompt(contextModel),
    pipeline: pipeline && typeof pipeline === "object" ? pipeline : null,
    evidence: {
      summaryText: normalizeString(suggestionBundle?.summaryText),
      buddyAuditReport: normalizeString(suggestionBundle?.buddyAuditReport || suggestionBundle?.primitiveColorReport),
      findings: Array.isArray(suggestionBundle?.findings)
        ? suggestionBundle.findings.slice(0, 5).map((entry) => ({
            label: normalizeString(entry?.label),
            detail: normalizeString(entry?.detail)
          }))
        : [],
      recommendations: Array.isArray(suggestionBundle?.recommendations)
        ? suggestionBundle.recommendations.slice(0, 5).map((entry) => normalizeString(entry?.title))
        : []
    }
  };

  return [
    "당신은 Xbridge의 Figma 읽기 결과 설명 백엔드 작업자입니다.",
    "직접 캔버스를 수정하지 마세요.",
    "제공된 request, pipeline, contextModel, evidence만 근거로 설명하세요.",
    "pipeline.retrieval.results가 있으면 로컬 RAG 지식으로 사용해 QA 기준, 진행 UX, 안전 실패 기준을 보강하세요.",
    "pipeline.responsePolicy.preserveDeterministicReport가 true이면 deterministic report의 판단과 순서를 덮어쓰지 말고 보강만 하세요.",
    "pipeline.read.warnings나 부족한 데이터는 가능한 진단 뒤에 limitations로 분리하세요.",
    "추측하지 말고, 없는 정보는 부족하다고 말하세요.",
    "recommendations는 짧고 실행 가능한 다음 제안만 남기세요.",
    "최종 출력은 주어진 JSON Schema에 맞는 JSON 하나만 반환하세요.",
    "",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

function stripCodeFence(text) {
  const source = String(text || "").trim();
  const match = source.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : source;
}

function parseJsonLike(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(stripCodeFence(value));
    } catch {
      return fallback;
    }
  }
  return typeof value === "undefined" || value === null ? fallback : value;
}

function buildCodexCliInvocationOptions(options = {}) {
  const env = options.env || process.env;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || env.XBRIDGE_CODEX_CLI_TIMEOUT_MS || 45000));
  const bin = normalizeString(
    options.bin || env.XBRIDGE_CODEX_CLI_BIN || "/Applications/Codex.app/Contents/Resources/codex"
  );
  const entrypoint = normalizeString(options.entrypoint || env.XBRIDGE_CODEX_CLI_ENTRYPOINT || "");
  const model = normalizeString(options.model || "");
  const cwd = options.cwd || process.cwd();
  const imagePaths = Array.isArray(options.imagePaths)
    ? options.imagePaths.map((value) => normalizeString(value)).filter(Boolean)
    : [];
  return {
    env,
    timeoutMs,
    bin,
    entrypoint,
    model,
    cwd,
    imagePaths
  };
}

async function runCodexCliJsonJob(prompt, schema, options = {}) {
  const { env, timeoutMs, bin, entrypoint, model, cwd, imagePaths } = buildCodexCliInvocationOptions(options);

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "xbridge-codex-cli-"));
  const schemaPath = path.join(tempRoot, "schema.json");
  const outputPath = path.join(tempRoot, "output.json");
  await mkdir(tempRoot, { recursive: true });
  await writeFile(schemaPath, JSON.stringify(schema, null, 2), "utf8");

  const args = [];
  if (entrypoint) {
    args.push(entrypoint);
  }
  args.push(
    "exec",
    "--skip-git-repo-check",
    "--ephemeral",
    "-s",
    "read-only",
    "--output-schema",
    schemaPath,
    "-o",
    outputPath,
    "-"
  );
  if (model) {
    args.splice(entrypoint ? 2 : 1, 0, "-m", model);
  }
  for (const imagePath of imagePaths) {
    args.splice(args.length - 1, 0, "--image", imagePath);
  }

  try {
    const { exitCode, stderrText } = await new Promise((resolve, reject) => {
      const child = spawn(bin, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ["pipe", "ignore", "pipe"]
      });
      let stderrText = "";
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        const error = new Error("codex_cli_timeout");
        error.code = "codex_cli_timeout";
        reject(error);
      }, timeoutMs);
      timer.unref?.();

      child.stderr.on("data", (chunk) => {
        stderrText += chunk.toString("utf8");
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        resolve({ exitCode, stderrText });
      });
      child.stdin.end(prompt);
    });

    if (exitCode !== 0) {
      const error = new Error(normalizeString(stderrText) || "codex_cli_process_failed");
      error.code = "codex_cli_process_failed";
      throw error;
    }

    const rawOutput = await readFile(outputPath, "utf8");
    return JSON.parse(stripCodeFence(rawOutput));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function buildImageLayoutQualityRetryLines(qualityFeedback = null) {
  if (!qualityFeedback || typeof qualityFeedback !== "object") {
    return [];
  }
  const formatQualityLabels = (value) => {
    return Array.isArray(value)
      ? value.map((item) => normalizeString(item)).filter(Boolean).slice(0, 8)
      : [];
  };
  const formatQualityLabelLine = (label, values) => {
    const labels = formatQualityLabels(values);
    return labels.length > 0
      ? `${label}: ${labels.map((item) => `"${item}"`).join(", ")}.`
      : "";
  };
  const roleTooLow = qualityFeedback.recognizedRoleCountTooLow === true
    ? `role 인식 부족: 최소 ${Number(qualityFeedback.requiredRoleCount || 0)}개 role이 필요하지만 ${Number(qualityFeedback.roleCount || 0)}개만 인식했습니다.`
    : "";
  const nodeTooLow = qualityFeedback.nodeCoverageTooLow === true
    ? `레이어 분해 부족(nodeCoverageTooLow): 최소 tree node ${Number(qualityFeedback.requiredNodeCount || 0)}개가 필요하지만 ${Number(qualityFeedback.generatedNodeCount || 0)}개만 생성했습니다.`
    : "";
  const coordinateTooLow = qualityFeedback.coordinateCoverageTooLow === true
    ? `좌표 반영 부족(coordinateCoverageTooLow): 최소 좌표 노드(requiredCoordinateNodeCount) ${Number(qualityFeedback.requiredCoordinateNodeCount || 0)}개가 필요하지만 ${Number(qualityFeedback.coordinateNodeCount || 0)}개만 x/y 좌표를 가졌습니다.`
    : "";
  const topOriginStackingTooHigh = qualityFeedback.topOriginStackingTooHigh === true
    ? `원점 중첩 과다(topOriginStackingTooHigh): 주요 레이어 ${Number(qualityFeedback.topOriginCoordinateNodeCount || 0)}개가 y=0 부근에 몰려 있습니다. status bar를 제외한 헤더, 섹션, 버튼, 하단바는 스크린샷의 실제 세로 위치 y 좌표로 배치하세요.`
    : "";
  const bboxAlignmentTooLow = qualityFeedback.bboxAlignmentTooLow === true
    ? `bbox 위치 반영 부족(bboxAlignmentTooLow): roleMap bbox가 있는 visible label ${Number(qualityFeedback.bboxRoleLabelCount || 0)}개 중 ${Number(qualityFeedback.bboxAlignedRoleLabelCount || 0)}개만 treeJson의 같은 문구와 비슷한 x/y 위치에 배치되었습니다. roleMapJson의 bbox.x/bbox.y를 참고해 같은 문구 노드를 실제 위치에 놓으세요.`
    : "";
  const textWrapRiskTooHigh = qualityFeedback.textWrapRiskTooHigh === true
    ? `텍스트 줄바꿈 위험(textWrapRiskTooHigh): 한 줄이어야 하는 문구가 너무 좁은 text width로 생성되었습니다. ${Number(qualityFeedback.wrapRiskRoleLabels?.length || 0)}개 label의 width를 roleMap bbox와 글자 수에 맞게 넓히세요.`
    : "";
  const wrapRiskLabelLine = qualityFeedback.textWrapRiskTooHigh === true
    ? formatQualityLabelLine("줄바꿈 위험 label", qualityFeedback.wrapRiskRoleLabels)
    : "";
  const componentBBoxSizeTooLow = qualityFeedback.componentBBoxSizeTooLow === true
    ? `컴포넌트 bbox 크기 부족(componentBBoxSizeTooLow): row/button/toggle 같은 주요 컴포넌트가 roleMap bbox보다 너무 작게 생성되었습니다. 원본 카드/행/버튼의 width와 height를 유지하세요.`
    : "";
  const componentBBoxLabelLine = qualityFeedback.componentBBoxSizeTooLow === true
    ? formatQualityLabelLine("bbox가 너무 작은 컴포넌트 label", qualityFeedback.componentBBoxMismatchLabels)
    : "";
  const childComponentWidthTooLow = qualityFeedback.childComponentWidthTooLow === true
    ? "내부 행 폭 수축(childComponentWidthTooLow): list/card/section 안의 반복 row가 부모 폭보다 과도하게 좁습니다. 결과표/일정/메시지 행은 부모 content width에 맞춰 full-width row로 구성하세요."
    : "";
  const shrunkenChildLabelLine = qualityFeedback.childComponentWidthTooLow === true
    ? formatQualityLabelLine("부모보다 과도하게 좁은 내부 row", qualityFeedback.shrunkenChildComponentLabels)
    : "";
  const outlinedStyleMismatchTooHigh = qualityFeedback.outlinedStyleMismatchTooHigh === true
    ? `outlined 스타일 불일치(outlinedStyleMismatchTooHigh): outlined/bordered role이 회색 filled pill/card처럼 생성되었습니다. 흰색 fill, 연한 stroke, 원본 radius를 사용하세요.`
    : "";
  const visualSanityTooLow = qualityFeedback.visualSanityTooLow === true
    ? `시각 sanity 실패(visualSanityTooLow): 텍스트 겹침 ${Number(qualityFeedback.textOverlapCount || 0)}개, status bar 알파벳 조각 ${Number(qualityFeedback.statusBarUnknownTextCount || 0)}개, 아이콘/짧은 fallback 텍스트 ${Number(qualityFeedback.unknownShortTextCount || 0)}개, 세로 쪼개짐 label ${Number(qualityFeedback.verticalSplitLabelCount || 0)}개가 감지되었습니다.`
    : "";
  const overlapEntryLine = qualityFeedback.visualSanityTooLow === true && Array.isArray(qualityFeedback.textOverlapEntries)
    ? formatQualityLabelLine(
      "겹치는 텍스트 쌍",
      qualityFeedback.textOverlapEntries.map((entry) => `${entry.left} ↔ ${entry.right}`)
    )
    : "";
  const textTooLow = qualityFeedback.textCoverageTooLow === true
    ? `텍스트 반영 부족(textCoverageTooLow): 최소 visible label ${Number(qualityFeedback.requiredCoveredRoleLabelCount || 0)}개가 필요하지만 ${Number(qualityFeedback.coveredRoleLabelCount || 0)}개만 treeJson 텍스트로 확인되었습니다.`
    : "";
  const missingLabels = Array.isArray(qualityFeedback.missingRoleLabels)
    ? qualityFeedback.missingRoleLabels.map((item) => normalizeString(item)).filter(Boolean).slice(0, 8)
    : [];
  const missingLabelLine = missingLabels.length
    ? `treeJson에 누락되거나 너무 일부만 반영된 visible label: ${missingLabels.map((item) => `"${item}"`).join(", ")}.`
    : "";
  return [
    "이전 출력은 Figma 화면 구성을 진행하기에 구조가 부족해서 거부되었습니다.",
    `품질 지표: 인식 role ${Number(qualityFeedback.roleCount || 0)}개, 생성 tree node ${Number(qualityFeedback.generatedNodeCount || 0)}개, 좌표 노드 ${Number(qualityFeedback.coordinateNodeCount || 0)}개, 텍스트 반영 ${Number(qualityFeedback.coveredRoleLabelCount || 0)}/${Number(qualityFeedback.visibleRoleLabelCount || 0)}개.`,
    `최소 요구: role ${Number(qualityFeedback.requiredRoleCount || 0)}개 이상, 생성 tree node ${Number(qualityFeedback.requiredNodeCount || 0)}개 이상, 좌표 노드(requiredCoordinateNodeCount) ${Number(qualityFeedback.requiredCoordinateNodeCount || 0)}개 이상, 텍스트 반영 ${Number(qualityFeedback.requiredCoveredRoleLabelCount || 0)}개 이상.`,
    roleTooLow,
    nodeTooLow,
    coordinateTooLow,
    topOriginStackingTooHigh,
    bboxAlignmentTooLow,
    textWrapRiskTooHigh,
    wrapRiskLabelLine,
    componentBBoxSizeTooLow,
    componentBBoxLabelLine,
    childComponentWidthTooLow,
    shrunkenChildLabelLine,
    outlinedStyleMismatchTooHigh,
    visualSanityTooLow,
    overlapEntryLine,
    textTooLow,
    missingLabelLine,
    "재시도에서는 roleMapJson에 적은 모든 주요 UI 역할을 treeJson의 실제 편집 가능한 레이어로 옮기세요.",
    "visualSanityTooLow가 true이면 status bar에는 ce/ba 같은 알파벳 조각을 넣지 말고, 아이콘 분석 단어(battery/wifi/camera/banner 등)를 화면 텍스트로 노출하지 마세요. 확실하지 않은 아이콘은 작은 중립 도형/기호로 처리하세요.",
    "텍스트끼리 겹치거나 한 label이 b/a/n처럼 세로로 쪼개지면 실패입니다. 같은 label은 하나의 충분한 width를 가진 text 노드로 배치하세요.",
    "coordinateCoverageTooLow가 true이면 모바일 스크린샷 루트는 layout:\"none\"으로 두고 주요 status/header/content/row/toggle/button 노드에 x, y, width, height를 지정하세요.",
    "큰 흰색 배경/스크린샷 복사 박스 하나로 축약하지 말고, 상태바/헤더/정보 텍스트/칩/행/토글/버튼/하단바를 각각 별도 children으로 작성하세요."
  ].filter(Boolean);
}

function buildImageLayoutPrompt({ request = "", figmaContext = {}, imageSummaries = [], qualityFeedback = null } = {}) {
  const normalizedImageSummaries = Array.isArray(imageSummaries) ? imageSummaries : [];
  const hasClippedFrameViewportImage = normalizedImageSummaries.some(
    (item) => normalizeString(item?.analysisScope) === "clipped_frame_viewport" || item?.frameViewportClipped === true
  );
  const payload = {
    request: normalizeString(request),
    figmaContext: figmaContext && typeof figmaContext === "object" ? figmaContext : {},
    images: normalizedImageSummaries.map((item) => ({
      name: normalizeString(item?.name || item?.title),
      mimeType: normalizeString(item?.mimeType),
      size: normalizeString(item?.sizeLabel || item?.size),
      selectedNodeId: normalizeString(item?.selectedNodeId),
      selectedNodeType: normalizeString(item?.selectedNodeType),
      analysisScope: normalizeString(item?.analysisScope),
      frameViewportClipped: item?.frameViewportClipped === true,
      exportScale: typeof item?.exportScale === "number" && Number.isFinite(item.exportScale) ? item.exportScale : null,
      contentsOnly: typeof item?.contentsOnly === "boolean" ? item.contentsOnly : null,
      useAbsoluteBounds: typeof item?.useAbsoluteBounds === "boolean" ? item.useAbsoluteBounds : null,
      note: normalizeString(item?.note)
    }))
  };

  return [
    "당신은 Xbridge의 이미지 분석 기반 Figma 화면 구성 플래너입니다.",
    "첨부 이미지를 시각적으로 분석해 Figma build_layout helper schema로 재현 가능한 화면 tree를 만드세요.",
    "목표는 새 디자인을 상상하는 것이 아니라 원본 스크린샷의 구조를 편집 가능한 Figma 레이어로 최대한 충실히 옮기는 것입니다.",
    "실제 이미지에 보이는 구조, 텍스트, 색상, 간격, 계층만 반영하고 확실하지 않은 내용은 단순화하세요.",
    hasClippedFrameViewportImage
      ? "중요: images[].analysisScope가 clipped_frame_viewport인 이미지는 선택한 Figma 프레임의 clipped viewport 안에 실제로 보이는 픽셀만 분석 대상입니다. 프레임 밖으로 넘친 자식 이미지/레이어 영역은 무시하고, bbox와 canvas 크기도 보이는 프레임 viewport 기준으로 잡으세요."
      : null,
    "tree는 screen helper를 루트로 사용하세요. 앱/웹 표면을 먼저 판단하고 표준 캔버스 규격을 적용하세요.",
    "canvasSpecJson에는 { surfaceType, platform, width, height, gridUnit, margin, columns, gutter, safeArea } 객체를 JSON.stringify 해서 넣으세요.",
    "canvasSpecJson 규칙: mobile app은 width 390 전후/height 844 전후/4 columns/margin x 24/gutter 16, tablet은 768x1024/8 columns/margin x 32/gutter 24, desktop web은 1440x1024/12 columns/margin x 80/gutter 24를 기본으로 하세요.",
    "고정 크기와 여백은 4px 그리드에 맞추세요. 단, divider/hairline 1px와 부모 너비를 gap으로 나눠 fill 하는 경우의 계산값은 예외로 둘 수 있습니다.",
    "사용 가능한 helper 예: screen, row, column, card, section, list, list-item, media-row, status-chip, progress-bar, tabbar, toolbar, text, divider.",
    "먼저 보이는 요소를 UI 역할로 분류하고 roleMapJson에 JSON.stringify 한 배열로 넣으세요.",
    "roleMapJson 각 항목은 { id, role, label, textLabel, textLabels, visualLabel, visibleText, strategy, styleIntent, bbox, visualStyle, implementation } 형태로 작성하세요. bbox는 원본 스크린샷 안의 대략적인 { x, y, width, height } 위치이며 treeJson의 같은 요소도 이 위치와 맞아야 합니다.",
    "중요: 실제 화면에 글자로 보이는 문구만 textLabel/textLabels에 넣으세요. 아바타, 이미지 콜라주, 히어로 그래픽, 상태바 아이콘(cellular/wifi/battery), 테이블 구조 설명은 visualLabel에 넣고 visibleText:false로 표시하세요.",
    "아바타/러너 사진/참가자 사진/히어로 이미지 내부의 얼굴·사진·원형 이미지는 텍스트가 아닙니다. 화면에 이름이 실제로 인쇄되어 보이지 않으면 Amanda, Lara 같은 인물명을 만들거나 textLabels에 넣지 마세요.",
    "상태바는 9:41 같은 시간만 textLabel로 두고 cellular/wifi/battery는 visualLabel 또는 implementation children으로 분리하세요. Results table 같은 영역은 실제 보이는 셀 문구(Results, Me, Lara, Sam, Distance, Runs, Avg Pace 등)만 textLabels로 넣으세요.",
    "role은 구현 가능한 단위로 세분화하세요. 예: system_status_bar, header_nav, account_title_group, info_table, info_label, info_value, coupon_row, outlined_button, filled_button, toggle_on, toggle_off, section_separator, browser_toolbar.",
    "계좌/자산/관리 화면에서는 계좌명과 배지를 account_title_group으로 묶고, 계좌구분/적용금리/개설일 같은 정보는 하나의 긴 문장이 아니라 info_table 아래의 info_label + info_value 행으로 분리하세요.",
    "계좌구분, 적용금리, 개설일처럼 좌측 label과 우측 value가 보이는 영역은 각 label/value를 별도 text 노드로 만들고, 같은 row 안에서 x/y/width/height를 원본 bbox 기준으로 맞추세요.",
    "관리형 모바일 화면의 쿠폰/연결 행은 coupon_row 또는 plain_row, ON/OFF 컨트롤은 toggle_on/toggle_off, 하단 액션은 outlined_button으로 분리하고 회색 filled pill로 뭉개지 않게 하세요.",
    "visualStyle에는 원본에서 보이는 fill, stroke, radius, textAlign을 넣으세요. implementation에는 Figma helper, layout, 필요한 children 의미(icon/text/chevron/track/knob)를 넣으세요.",
    "원본에서 한 줄로 보이는 짧은 제목/버튼/행 문구는 treeJson text width를 충분히 넓게 잡아 줄바꿈되지 않게 하세요. 특히 한글 label은 글자 수 기준 최소 폭보다 좁게 만들지 마세요.",
    "button/list-row/toggle/toolbar 같은 주요 컴포넌트는 텍스트 위치만 맞추지 말고 roleMap bbox의 width/height와 비슷한 크기의 컨테이너 노드를 만드세요.",
    "outlined/bordered 버튼이나 행은 회색 filled pill로 만들지 마세요. 원본처럼 흰 fill, 연한 stroke, 적당한 radius를 가진 card/status-chip/row로 구현하세요.",
    "layoutMapJson에는 그룹핑/정렬/크기 전략을 JSON.stringify 한 배열로 넣으세요. 각 항목은 { id, targetName, parentId, role, direction, align, justify, gap, padding, sizing, strategy } 형태로 작성하세요.",
    "그룹핑은 화면에서 가까이 묶인 정보 단위를 기준으로 판단하세요. 좌표가 중요한 장식/이미지/히어로는 layout none + fixed, 반복 행/리스트/툴바/칩은 row/column + hug/fill을 사용하세요.",
    "textStyleMapJson에는 텍스트 역할을 JSON.stringify 한 배열로 넣으세요. 각 항목은 { id, targetName, role, text, fontSize, fontStyle, lineHeight, align, color } 형태로 작성하세요.",
    "텍스트는 라벨, 캡션, 본문, 수치, 섹션 제목, 화면 제목, 버튼 라벨인지 판단하고 크기/두께/행간을 지정하세요.",
    "중요: 화면을 이미지 덩어리나 장식 박스로 복사하지 말고, 사용자가 편집할 수 있는 UI 컨트롤 단위로 분해하세요. 예: iOS 상태바, 상단 내비게이션, 제목/본문 정보 그룹, 배지, 리스트 행, 토글, 버튼, 하단 내비게이션은 각각 별도 노드/그룹이어야 합니다.",
    "각 roleMapJson 항목 중 화면에 텍스트가 보이는 textLabel/textLabels는 treeJson 안에도 반드시 helper:\"text\" 또는 status-chip label로 구현하세요. roleMap에만 쓰고 tree에서 누락하지 마세요.",
    "원본 화면에 보이는 주요 인터랙션 요소(뒤로가기, 더보기/chevron, 토글, 카드형 행, 버튼, 하단바 아이콘)는 의미 있는 role/name을 가진 별도 노드로 만드세요. 얇은 선/아이콘을 제외한 주요 요소를 하나의 큰 card로 합치지 마세요.",
    "아바타, 아이콘 버튼, 체크박스, 라디오, dot, swatch, 정사각 썸네일처럼 1:1 비율이어야 하는 요소는 width와 height를 같은 값으로 지정하세요.",
    "역할별 helper를 고르세요: chip/pill/badge/button은 status-chip, system-status-bar는 좌표 row/text 아이콘, header/nav는 toolbar 또는 좌표 row, tab 묶음은 tabbar, progress는 progress-bar, 반복 결과 행은 list/list-item 또는 좌표 row를 사용하세요.",
    "원본에 없는 placeholder 텍스트를 만들지 마세요. 특히 \"Status\", \"Label\", \"Button\", \"New text\" 같은 기본 문구는 화면에 보이지 않으면 절대 넣지 마세요.",
    "스크린샷을 비슷하게 재현할 때는 루트 screen에 layout: \"none\"을 쓰고, 주요 요소마다 x, y, width, height를 대략 지정하세요.",
    "모바일 앱/웹뷰 스크린샷은 기본적으로 layout: \"none\" 좌표 배치로 처리하세요. 큰 column 하나로 단순화하지 말고, 상태바/헤더/섹션/버튼/하단바의 위치와 크기를 보이는 순서대로 잡으세요.",
    "서버가 원본 이미지를 낮은 투명도의 reference layer로 함께 배치합니다. 당신의 tree는 그 위에 놓일 편집 가능한 텍스트/도형/섹션 구조를 만드세요.",
    "겹치는 원형 이미지, 히어로 카드, 진행 바처럼 위치가 중요한 요소는 auto layout 스택으로 만들지 말고 card/text 노드를 좌표로 배치하세요.",
    "히어로 카드, 일러스트/사진 영역, 장식 그래픽 영역은 반드시 layout: \"none\", clipsContent: true, padding: 0인 card/frame처럼 만들고 내부 요소를 좌표로 배치하세요.",
    "복잡한 사진/일러스트를 정확히 재현하기 어렵다면 단순한 이미지 플레이스홀더 card 하나로 축약하고, 그 안에 억지로 row/column 스택을 만들지 마세요.",
    "아이콘은 SVG path를 만들지 마세요. SF Symbols glyph를 텍스트로 사용하세요: 실제 심볼 glyph를 characters 또는 sfSymbolCharacter에 넣고 fontFamily: \"SF Pro\", fontStyle: \"Regular\"를 지정하세요.",
    "SF Symbols glyph를 확실히 모르면 sfSymbol 필드에 이름(예: chevron.left, chevron.right, flame.fill, trophy.fill, bolt.fill, figure.run)을 넣으세요. 서버가 가까운 텍스트 fallback과 SF Pro 폰트 지정을 보정합니다.",
    "단순 리스트나 행처럼 자연스럽게 흐르는 영역에만 row/column auto layout을 사용하세요.",
    "모든 하위 구조는 반드시 children 배열로 넣으세요. sections, items, rows, content 같은 별도 배열 키를 쓰지 마세요.",
    "화면에 보이는 모든 문구는 반드시 { helper: \"text\", characters: \"...\" } 노드로 넣으세요. title, label, subtitle만 단독으로 쓰지 마세요.",
    "카드나 섹션을 만들 때도 내부에 text/status-chip/progress-bar 같은 실제 자식 노드를 넣어 빈 박스가 생기지 않게 하세요.",
    "treeJson에는 roleMapJson의 역할 분류를 반영한 build_layout tree 객체만 JSON.stringify 한 문자열로 넣으세요. Markdown이나 설명 문장은 넣지 마세요.",
    "최종 출력은 주어진 JSON Schema에 맞는 JSON 하나만 반환하세요.",
    ...buildImageLayoutQualityRetryLines(qualityFeedback),
    "",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

function normalizeImageLayoutHelper(value = "", fallback = "column") {
  const normalized = normalizeString(value).toLowerCase();
  if (["icon", "symbol", "sf-symbol", "sfsymbol"].includes(normalized)) {
    return "text";
  }
  if (["status-bar", "system-status-bar", "ios-status-bar", "phone-status-bar"].includes(normalized)) {
    return "row";
  }
  if (["chip", "pill", "badge", "status-chip", "button"].includes(normalized)) {
    return "status-chip";
  }
  if (["header", "nav", "navigation", "topbar", "appbar", "toolbar"].includes(normalized)) {
    return "toolbar";
  }
  if (["tabs", "tab-bar", "segmented-control", "segmented"].includes(normalized)) {
    return "tabbar";
  }
  if (["progress", "progressbar", "progress-bar", "bar"].includes(normalized)) {
    return "progress-bar";
  }
  if (["list-row", "result-row", "leaderboard-row", "table-row"].includes(normalized)) {
    return "list-item";
  }
  if (["frame", "container", "group"].includes(normalized)) {
    return fallback;
  }
  if (["rect", "rectangle", "shape", "circle", "ellipse", "avatar"].includes(normalized)) {
    return "card";
  }
  if (IMAGE_LAYOUT_HELPERS.has(normalized)) {
    return normalized;
  }
  return fallback;
}

function resolveImageLayoutIconCharacter(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return "";
  }
  const direct = normalizeString(value);
  if (direct.length <= 2 && !/[a-z]/iu.test(direct)) {
    return direct;
  }
  const iconMap = {
    "chevron.left": "‹",
    "chevron.right": "›",
    "chevron.up": "⌃",
    "chevron.down": "⌄",
    "arrow.left": "←",
    "arrow.right": "→",
    "arrow.up.right": "↗",
    "ellipsis": "⋯",
    "wifi": "▰",
    "battery.100": "▰",
    "battery": "▰",
    "flame.fill": "●",
    "flame": "●",
    "clock": "◷",
    "timer": "◷",
    "trophy.fill": "🏆",
    "trophy": "🏆",
    "bolt.fill": "⚡",
    "bolt": "⚡",
    "figure.run": "↯",
    "figure.walk": "↯",
    "location.fill": "◆",
    "star.fill": "✦",
    "star": "✦",
    "sparkles": "✦",
    "person.fill": "●",
    "photo": "▧",
    "image": "▧"
  };
  return iconMap[normalized] || iconMap[normalized.replaceAll("_", ".")] || direct;
}

function getImageLayoutTextValue(node = {}) {
  const candidates = [
    node.characters,
    node.sfSymbolCharacter,
    node.symbol,
    node.text,
    resolveImageLayoutIconCharacter(node.sfSymbol || node.symbolName || node.icon),
    node.label,
    node.title,
    node.subtitle,
    node.value,
    node.caption,
    node.meta,
    node.badge
  ];
  return candidates.map((value) => normalizeString(value)).find(Boolean) || "";
}

function getImageLayoutChildCandidates(node = {}) {
  const keys = [
    "children",
    "sections",
    "items",
    "rows",
    "columns",
    "cards",
    "content",
    "body",
    "stats",
    "results",
    "leaderboard",
    "tabs",
    "actions"
  ];
  return keys.flatMap((key) => (Array.isArray(node?.[key]) ? node[key] : []));
}

function hasFiniteCoordinate(node = {}) {
  return (
    (typeof node.x === "number" && Number.isFinite(node.x)) ||
    (typeof node.y === "number" && Number.isFinite(node.y))
  );
}

function hasCompleteCoordinatePair(node = {}) {
  return (
    typeof node.x === "number" &&
    Number.isFinite(node.x) &&
    typeof node.y === "number" &&
    Number.isFinite(node.y)
  );
}

function copyImageLayoutScalarFields(source = {}, target = {}) {
  for (const key of [
    "name",
    "preset",
    "role",
    "widthMode",
    "heightMode",
    "fill",
    "background",
    "color",
    "stroke",
    "fontFamily",
    "fontStyle",
    "layout",
    "tone"
  ]) {
    if (typeof source[key] === "string" && source[key].trim()) {
      target[key] = source[key].trim();
    }
  }
  if (!target.fill && target.background) {
    target.fill = target.background;
  }
  if (!target.fill && target.color) {
    target.fill = target.color;
  }
  delete target.background;
  delete target.color;
  for (const key of ["x", "y", "width", "height", "itemSpacing", "gap", "radius", "fontSize", "lineHeight", "progress", "percent", "value"]) {
    if (typeof source[key] === "number" && Number.isFinite(source[key])) {
      target[key] = source[key];
    }
  }
  if (typeof source.padding === "number" && Number.isFinite(source.padding)) {
    target.padding = source.padding;
  } else if (source.padding && typeof source.padding === "object" && !Array.isArray(source.padding)) {
    target.padding = { ...source.padding };
  }
  if (typeof source.clipsContent === "boolean") {
    target.clipsContent = source.clipsContent;
  } else if (typeof source.clipContent === "boolean") {
    target.clipsContent = source.clipContent;
  } else if (typeof source.clips === "boolean") {
    target.clipsContent = source.clips;
  }
  const iconCharacter = resolveImageLayoutIconCharacter(source.sfSymbol || source.symbolName);
  if (iconCharacter && !target.characters) {
    target.characters = iconCharacter;
  }
  return target;
}

function createImageLayoutTextNode(characters, role = "meta", name = "text") {
  return {
    helper: "text",
    name,
    characters,
    role
  };
}

function isIconMeaningWord(value = "") {
  return /^(cellular|wifi|wi-fi|battery|signal|camera|banner|chevron|toggle|switch|icon|image)$/iu.test(
    normalizeString(value)
  );
}

function isLikelyVisualOnlyRoleLabel(value = "", role = "") {
  const text = normalizeString(value).toLowerCase();
  const roleText = normalizeString(role).toLowerCase();
  if (!text) {
    return false;
  }
  if (/\b(image|collage|avatar|artwork|illustration|photo|picture|graphic|hero visual|competitor image)\b/u.test(text)) {
    return true;
  }
  if (/\b(image|avatar|artwork|illustration|photo|graphic|hero)\b/u.test(roleText) && !/[\p{Script=Hangul}\d:]/u.test(text)) {
    return true;
  }
  return false;
}

function extractStatusBarTextLabels(value = "") {
  const text = normalizeString(value);
  const timeMatch = text.match(/\b\d{1,2}:\d{2}\b/u);
  if (!timeMatch) {
    return [];
  }
  const parts = text
    .split(/[,/|]+/u)
    .map((part) => normalizeString(part))
    .filter(Boolean);
  const hasIconMeaning = parts.some((part) => isIconMeaningWord(part));
  return hasIconMeaning ? [timeMatch[0]] : [];
}

function normalizeVisibleTextLabelList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeString(item)).filter(Boolean);
  }
  const text = normalizeString(value);
  return text ? [text] : [];
}

function deriveImageRoleTextLabels(entry = {}, rawLabel = "") {
  const role = normalizeString(entry.role || entry.type || entry.kind);
  if (entry.visibleText === false || entry.isVisibleText === false || entry.textVisible === false) {
    return [];
  }
  const roleIsPrimarilyVisual =
    /(^|[_\s-])(image|collage|avatar|artwork|illustration|photo|picture|graphic|hero|runner|participant)($|[_\s-])/u.test(
      role.toLowerCase()
    );
  if (roleIsPrimarilyVisual && entry.visibleText !== true && entry.isVisibleText !== true && entry.textVisible !== true) {
    return [];
  }
  const explicitTextLabels = [
    ...normalizeVisibleTextLabelList(entry.textLabels),
    ...normalizeVisibleTextLabelList(entry.visibleTextLabels),
    ...normalizeVisibleTextLabelList(entry.textLabel),
    ...normalizeVisibleTextLabelList(entry.visibleText)
  ].filter((label) => label.toLowerCase() !== "false" && label.toLowerCase() !== "true");
  if (explicitTextLabels.length > 0) {
    return [...new Set(explicitTextLabels)];
  }
  const statusBarTextLabels = extractStatusBarTextLabels(rawLabel);
  if (statusBarTextLabels.length > 0) {
    return statusBarTextLabels;
  }
  if (isLikelyVisualOnlyRoleLabel(rawLabel, role)) {
    return [];
  }
  const normalized = normalizeString(rawLabel);
  const lower = normalized.toLowerCase();
  if (/^results\s+table\s*:/iu.test(normalized)) {
    return [];
  }
  if (/^[^:]{2,32}:\s*[^:]+[,，][^:]+/u.test(normalized)) {
    return [];
  }
  if (normalized.includes(",") && normalized.split(",").filter((part) => normalizeString(part)).length >= 3) {
    const parts = normalized.split(",").map((part) => normalizeString(part));
    if (parts.every((part) => isIconMeaningWord(part) || /^[a-z][a-z\s-]*$/iu.test(part))) {
      return [];
    }
  }
  if (isIconMeaningWord(lower)) {
    return [];
  }
  return normalized ? [normalized] : [];
}

function normalizeImageRoleMapEntry(entry = {}, index = 0) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const bbox = entry.bbox && typeof entry.bbox === "object" && !Array.isArray(entry.bbox)
    ? {
        x: typeof entry.bbox.x === "number" && Number.isFinite(entry.bbox.x) ? entry.bbox.x : undefined,
        y: typeof entry.bbox.y === "number" && Number.isFinite(entry.bbox.y) ? entry.bbox.y : undefined,
        width: typeof entry.bbox.width === "number" && Number.isFinite(entry.bbox.width) ? entry.bbox.width : undefined,
        height: typeof entry.bbox.height === "number" && Number.isFinite(entry.bbox.height) ? entry.bbox.height : undefined
      }
    : {};
  Object.keys(bbox).forEach((key) => {
    if (typeof bbox[key] === "undefined") {
      delete bbox[key];
    }
  });
  const visualStyle = entry.visualStyle && typeof entry.visualStyle === "object" && !Array.isArray(entry.visualStyle)
    ? {
        fill: normalizeString(entry.visualStyle.fill),
        stroke: normalizeString(entry.visualStyle.stroke || entry.visualStyle.border || entry.visualStyle.borderColor),
        radius: typeof entry.visualStyle.radius === "number" && Number.isFinite(entry.visualStyle.radius) ? entry.visualStyle.radius : undefined,
        textAlign: normalizeString(entry.visualStyle.textAlign || entry.visualStyle.align)
      }
    : {};
  Object.keys(visualStyle).forEach((key) => {
    if (typeof visualStyle[key] === "undefined" || visualStyle[key] === "") {
      delete visualStyle[key];
    }
  });
  const implementation = entry.implementation && typeof entry.implementation === "object" && !Array.isArray(entry.implementation)
    ? {
        helper: normalizeString(entry.implementation.helper),
        layout: normalizeString(entry.implementation.layout),
        children: Array.isArray(entry.implementation.children)
          ? entry.implementation.children.map((item) => normalizeString(item)).filter(Boolean).slice(0, 8)
          : []
      }
    : {};
  Object.keys(implementation).forEach((key) => {
    if (
      typeof implementation[key] === "undefined" ||
      implementation[key] === "" ||
      (Array.isArray(implementation[key]) && implementation[key].length === 0)
    ) {
      delete implementation[key];
    }
  });
  const rawLabel = normalizeString(entry.label || entry.text || entry.title);
  const role = normalizeString(entry.role || entry.type || entry.kind) || "unknown";
  const textLabels = deriveImageRoleTextLabels(entry, rawLabel);
  const visualLabel = normalizeString(entry.visualLabel || entry.description || entry.alt || (textLabels.includes(rawLabel) ? "" : rawLabel));
  return {
    id: normalizeString(entry.id) || `role-${index + 1}`,
    role,
    label: rawLabel,
    textLabel: textLabels[0] || "",
    textLabels,
    visualLabel,
    visibleText: textLabels.length > 0,
    strategy: normalizeString(entry.strategy),
    styleIntent: normalizeString(entry.styleIntent || entry.intent || entry.variant),
    bbox,
    visualStyle,
    implementation
  };
}

function normalizeImageRoleMap(value) {
  const parsed = parseJsonLike(value, []);
  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.roles)
      ? parsed.roles
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];
  return entries
    .slice(0, 48)
    .map((entry, index) => normalizeImageRoleMapEntry(entry, index))
    .filter(Boolean);
}

function inferImageCanvasPresetKey(input = {}, tree = {}) {
  const haystack = [
    input.surfaceType,
    input.platform,
    input.type,
    input.kind,
    tree?.name,
    tree?.preset
  ].map((value) => normalizeString(value).toLowerCase()).join(" ");
  if (/\b(web|desktop|browser|dashboard)\b/u.test(haystack)) {
    return "web";
  }
  if (/\b(tablet|ipad)\b/u.test(haystack)) {
    return "tablet";
  }
  if (/\b(mobile|phone|iphone|android|app)\b/u.test(haystack)) {
    return "mobile";
  }
  const width = typeof tree?.width === "number" ? tree.width : typeof input.width === "number" ? input.width : 0;
  return width >= 900 ? "web" : width >= 600 ? "tablet" : "mobile";
}

function snapToImageGrid(value, grid = IMAGE_LAYOUT_GRID_UNIT, { min = 0, preserveOne = false } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }
  if (preserveOne && Math.abs(value) === 1) {
    return value;
  }
  return Math.max(min, Math.round(value / grid) * grid);
}

function normalizeImagePaddingForGrid(value, grid = IMAGE_LAYOUT_GRID_UNIT) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return snapToImageGrid(value, grid);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return value;
  }
  const result = { ...value };
  for (const key of ["x", "y", "top", "right", "bottom", "left"]) {
    if (typeof result[key] === "number" && Number.isFinite(result[key])) {
      result[key] = snapToImageGrid(result[key], grid);
    }
  }
  return result;
}

function normalizeImageMargin(value, fallback, grid = IMAGE_LAYOUT_GRID_UNIT) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const snapped = snapToImageGrid(value, grid);
    return { x: snapped, y: 0 };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...fallback };
  }
  const x = typeof value.x === "number" && Number.isFinite(value.x)
    ? value.x
    : typeof value.left === "number" && Number.isFinite(value.left)
      ? value.left
      : fallback.x;
  const y = typeof value.y === "number" && Number.isFinite(value.y)
    ? value.y
    : typeof value.top === "number" && Number.isFinite(value.top)
      ? value.top
      : fallback.y;
  return {
    x: snapToImageGrid(x, grid),
    y: snapToImageGrid(y, grid)
  };
}

function normalizeImageCanvasSpec(value, tree = {}) {
  const input = parseJsonLike(value, {});
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const presetKey = inferImageCanvasPresetKey(source, tree);
  const preset = IMAGE_LAYOUT_CANVAS_PRESETS[presetKey] || IMAGE_LAYOUT_CANVAS_PRESETS.mobile;
  const gridUnit = typeof source.gridUnit === "number" && Number.isFinite(source.gridUnit)
    ? Math.max(1, Math.round(source.gridUnit))
    : IMAGE_LAYOUT_GRID_UNIT;
  const width = snapToImageGrid(
    typeof source.width === "number" && Number.isFinite(source.width) ? source.width : preset.width,
    gridUnit,
    { min: 1 }
  );
  const height = snapToImageGrid(
    typeof source.height === "number" && Number.isFinite(source.height) ? source.height : preset.height,
    gridUnit,
    { min: 1 }
  );
  return {
    surfaceType: normalizeString(source.surfaceType || source.type || presetKey) || presetKey,
    platform: normalizeString(source.platform),
    width,
    height,
    gridUnit,
    margin: normalizeImageMargin(source.margin, preset.margin, gridUnit),
    columns: typeof source.columns === "number" && Number.isFinite(source.columns)
      ? Math.max(1, Math.round(source.columns))
      : preset.columns,
    gutter: snapToImageGrid(
      typeof source.gutter === "number" && Number.isFinite(source.gutter) ? source.gutter : preset.gutter,
      gridUnit
    ),
    safeArea: source.safeArea && typeof source.safeArea === "object" && !Array.isArray(source.safeArea)
      ? normalizeImagePaddingForGrid(source.safeArea, gridUnit)
      : undefined
  };
}

function normalizeImageMapEntries(value, preferredArrayKey = "items", max = 80) {
  const parsed = parseJsonLike(value, []);
  const entries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.[preferredArrayKey])
      ? parsed[preferredArrayKey]
      : Array.isArray(parsed?.items)
        ? parsed.items
        : [];
  return entries
    .slice(0, max)
    .filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry))
    .map((entry, index) => ({
      ...entry,
      id: normalizeString(entry.id) || `${preferredArrayKey}-${index + 1}`,
      targetName: normalizeString(entry.targetName || entry.name || entry.target),
      role: normalizeString(entry.role || entry.type || entry.kind)
    }));
}

function normalizeImageLayoutMap(value) {
  return normalizeImageMapEntries(value, "layout", 96);
}

function normalizeImageTextStyleMap(value) {
  return normalizeImageMapEntries(value, "textStyles", 96).map((entry) => ({
    ...entry,
    text: normalizeString(entry.text || entry.characters || entry.label),
    fontStyle: normalizeString(entry.fontStyle || entry.weight),
    color: normalizeString(entry.color || entry.fill)
  }));
}

function collectObservedRoleMapText(roleMap = []) {
  const observed = new Set();
  for (const entry of Array.isArray(roleMap) ? roleMap : []) {
    const labels = Array.isArray(entry?.textLabels) && entry.textLabels.length > 0
      ? entry.textLabels
      : [entry?.textLabel || entry?.label];
    for (const labelValue of labels) {
      const label = normalizeString(labelValue);
      if (label) {
        observed.add(label.toLowerCase());
      }
    }
  }
  return observed;
}

function removeUnobservedPlaceholders(node, observedText = new Set()) {
  if (!node || typeof node !== "object") {
    return node;
  }
  const placeholderTexts = new Set(["status", "label", "button", "new text"]);
  if (node.helper === "text") {
    const text = normalizeString(node.characters).toLowerCase();
    return placeholderTexts.has(text) && !observedText.has(text) ? null : node;
  }
  if (node.helper === "status-chip") {
    const label = normalizeString(node.label).toLowerCase();
    if (placeholderTexts.has(label) && !observedText.has(label)) {
      node.helper = "row";
      delete node.label;
    }
  }
  if (Array.isArray(node.children)) {
    node.children = node.children
      .map((child) => removeUnobservedPlaceholders(child, observedText))
      .filter(Boolean);
  }
  return node;
}

function createImageLayoutOptions(optionsOrRoleMap = []) {
  if (Array.isArray(optionsOrRoleMap)) {
    return {
      roleMap: optionsOrRoleMap,
      canvasSpec: null,
      layoutMap: [],
      textStyleMap: [],
      applyRoleMapBBoxRepairs: true
    };
  }
  if (!optionsOrRoleMap || typeof optionsOrRoleMap !== "object") {
    return {
      roleMap: [],
      canvasSpec: null,
      layoutMap: [],
      textStyleMap: [],
      applyRoleMapBBoxRepairs: true
    };
  }
  return {
    roleMap: Array.isArray(optionsOrRoleMap.roleMap) ? optionsOrRoleMap.roleMap : [],
    canvasSpec: optionsOrRoleMap.canvasSpec || null,
    layoutMap: Array.isArray(optionsOrRoleMap.layoutMap) ? optionsOrRoleMap.layoutMap : [],
    textStyleMap: Array.isArray(optionsOrRoleMap.textStyleMap) ? optionsOrRoleMap.textStyleMap : [],
    applyRoleMapBBoxRepairs: optionsOrRoleMap.applyRoleMapBBoxRepairs !== false
  };
}

function findImageMapEntryForNode(entries = [], node = {}) {
  const name = normalizeString(node.name).toLowerCase();
  const role = normalizeString(node.role).toLowerCase();
  const text = normalizeString(node.characters || node.label).toLowerCase();
  return entries.find((entry) => {
    const target = normalizeString(entry.targetName).toLowerCase();
    const entryRole = normalizeString(entry.role).toLowerCase();
    const entryText = normalizeString(entry.text || entry.label).toLowerCase();
    return (
      (target && name && target === name) ||
      (entryRole && role && entryRole === role) ||
      (entryText && text && entryText === text)
    );
  }) || null;
}

function applyImageLayoutMapHints(node = {}, layoutMap = []) {
  if (!node || typeof node !== "object") {
    return;
  }
  const entry = findImageMapEntryForNode(layoutMap, node);
  if (entry) {
    for (const key of ["layout", "align", "justify", "gap", "padding"]) {
      if (typeof entry[key] !== "undefined") {
        node[key] = entry[key];
      }
    }
    if (entry.sizing && typeof entry.sizing === "object" && !Array.isArray(entry.sizing)) {
      if (typeof entry.sizing.widthMode === "string") {
        node.widthMode = entry.sizing.widthMode;
      }
      if (typeof entry.sizing.heightMode === "string") {
        node.heightMode = entry.sizing.heightMode;
      }
    }
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => applyImageLayoutMapHints(child, layoutMap));
  }
}

function applyImageTextStyleHints(node = {}, textStyleMap = [], grid = IMAGE_LAYOUT_GRID_UNIT) {
  if (!node || typeof node !== "object") {
    return;
  }
  if (node.helper === "text") {
    const entry = findImageMapEntryForNode(textStyleMap, node);
    const role = normalizeString(entry?.role || node.role).toLowerCase();
    const preset = IMAGE_LAYOUT_TEXT_ROLE_PRESETS[role] || null;
    if (role && !node.role) {
      node.role = role;
    }
    const fontSize = typeof entry?.fontSize === "number" && Number.isFinite(entry.fontSize)
      ? entry.fontSize
      : typeof node.fontSize === "number" && Number.isFinite(node.fontSize)
        ? node.fontSize
        : preset?.fontSize;
    const lineHeight = typeof entry?.lineHeight === "number" && Number.isFinite(entry.lineHeight)
      ? entry.lineHeight
      : typeof node.lineHeight === "number" && Number.isFinite(node.lineHeight)
        ? node.lineHeight
        : preset?.lineHeight;
    if (typeof fontSize === "number" && Number.isFinite(fontSize)) {
      node.fontSize = snapToImageGrid(fontSize, grid, { min: 4 });
    }
    if (typeof lineHeight === "number" && Number.isFinite(lineHeight)) {
      node.lineHeight = snapToImageGrid(lineHeight, grid, { min: 4 });
    }
    if (entry?.fontStyle || preset?.fontStyle) {
      node.fontStyle = entry?.fontStyle || node.fontStyle || preset.fontStyle;
    }
    if (entry?.color && !node.fill) {
      node.fill = entry.color;
    }
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => applyImageTextStyleHints(child, textStyleMap, grid));
  }
}

function imageRoleMatchesNode(roleEntry = {}, node = {}) {
  const label = normalizeString(roleEntry.label);
  const role = normalizeString(roleEntry.role).toLowerCase();
  const normalizedLabel = normalizeComparableText(label);
  const nodeRole = normalizeString(node.role).toLowerCase();
  const nodeName = normalizeComparableText(node.name);
  const nodeText = normalizeComparableText(node.characters || node.label);
  const canMatchByName = normalizedLabel.length >= 4;
  return Boolean(
    (normalizedLabel && nodeText && (nodeText.includes(normalizedLabel) || normalizedLabel.includes(nodeText))) ||
    (normalizedLabel && canMatchByName && nodeName && nodeName.includes(normalizedLabel)) ||
    (role && nodeRole && role === nodeRole)
  );
}

function collectImageLayoutNodes(node = {}, result = []) {
  if (!node || typeof node !== "object") {
    return result;
  }
  result.push(node);
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => collectImageLayoutNodes(child, result));
  }
  return result;
}

function normalizeRoleImplementationHelper(roleEntry = {}, fallback = "card") {
  const requested = normalizeString(roleEntry.implementation?.helper).toLowerCase();
  const role = normalizeString(roleEntry.role).toLowerCase();
  if (requested === "button" || /outlined_button|filled_button/u.test(role)) {
    return "status-chip";
  }
  if (requested === "toggle" || /toggle|switch/u.test(role)) {
    return "card";
  }
  if (requested === "divider" || /separator/u.test(role)) {
    return "divider";
  }
  if (requested) {
    return normalizeImageLayoutHelper(requested, fallback);
  }
  if (/coupon_row|plain_row|list-row|row/u.test(role)) {
    return "row";
  }
  return fallback;
}

function applyRoleBBoxAndStyle(node = {}, roleEntry = {}) {
  const bbox = normalizeImageRoleBBox(roleEntry);
  if (bbox) {
    node.x = bbox.x;
    node.y = bbox.y;
    node.width = bbox.width;
    node.height = bbox.height;
    node.widthMode = "fixed";
    node.heightMode = "fixed";
  }
  const style = roleEntry.visualStyle && typeof roleEntry.visualStyle === "object" ? roleEntry.visualStyle : {};
  if (style.fill) {
    node.fill = style.fill;
  }
  if (style.stroke) {
    node.stroke = style.stroke;
  } else if (expectsOutlinedComponent(roleEntry)) {
    node.stroke = "#E5E5E5";
  }
  if (typeof style.radius === "number" && Number.isFinite(style.radius)) {
    node.radius = style.radius;
  }
}

function ensureTextChild(node = {}, label = "", role = "meta") {
  const normalizedLabel = normalizeString(label);
  if (!normalizedLabel) {
    return;
  }
  if (!Array.isArray(node.children)) {
    node.children = [];
  }
  const hasText = node.children.some((child) => normalizeComparableText(child.characters || child.label) === normalizeComparableText(normalizedLabel));
  if (!hasText) {
    node.children.push(createImageLayoutTextNode(normalizedLabel, role, `${normalizeString(node.name) || "role"}-label`));
  }
}

function ensureCouponRowStructure(node = {}, roleEntry = {}) {
  if (!Array.isArray(node.children)) {
    node.children = [];
  }
  const hasIcon = node.children.some((child) => normalizeString(child.role) === "leading-icon");
  if (!hasIcon) {
    node.children.unshift({
      helper: "text",
      name: "coupon-icon",
      role: "leading-icon",
      characters: "▧",
      fontFamily: IMAGE_LAYOUT_ICON_FONT_FAMILY,
      fontStyle: IMAGE_LAYOUT_ICON_FONT_STYLE,
      width: 20,
      height: 20
    });
  }
  ensureTextChild(node, roleEntry.label, "body-strong");
  const hasChevron = node.children.some((child) => normalizeString(child.role) === "trailing-chevron");
  if (!hasChevron) {
    node.children.push({
      helper: "text",
      name: "chevron",
      role: "trailing-chevron",
      characters: "›",
      fontFamily: IMAGE_LAYOUT_ICON_FONT_FAMILY,
      fontStyle: IMAGE_LAYOUT_ICON_FONT_STYLE,
      width: 20,
      height: 20
    });
  }
  node.layout = normalizeString(node.layout) || "row";
  node.align = normalizeString(node.align) || "center";
  if (typeof node.gap !== "number") {
    node.gap = 8;
  }
}

function ensureToggleStructure(node = {}, roleEntry = {}) {
  node.helper = "card";
  node.layout = "none";
  node.clipsContent = true;
  if (!Array.isArray(node.children)) {
    node.children = [];
  }
  const height = typeof node.height === "number" && Number.isFinite(node.height) ? node.height : 26;
  const width = typeof node.width === "number" && Number.isFinite(node.width) ? node.width : 46;
  const knobSize = Math.max(12, Math.min(height - 4, 22));
  const hasKnob = node.children.some((child) => normalizeString(child.role) === "toggle-knob");
  if (!hasKnob) {
    node.children.push({
      helper: "card",
      name: "toggle-knob",
      role: "toggle-knob",
      x: Math.max(2, width - knobSize - 2),
      y: Math.max(2, (height - knobSize) / 2),
      width: knobSize,
      height: knobSize,
      radius: knobSize / 2,
      fill: "#FFFFFF"
    });
  }
  if (normalizeString(roleEntry.label)) {
    const hasLabel = node.children.some((child) => normalizeComparableText(child.characters || child.label) === normalizeComparableText(roleEntry.label));
    if (!hasLabel) {
      node.children.unshift({
        helper: "text",
        name: "toggle-label",
        role: "toggle-label",
        characters: normalizeString(roleEntry.label),
        x: 6,
        y: Math.max(2, (height - 12) / 2),
        width: Math.max(12, width - knobSize - 8),
        height: 12,
        fontSize: 8,
        lineHeight: 12,
        fill: "#FFFFFF"
      });
    }
  }
}

function applyImageRoleMapImplementationHints(tree = {}, roleMap = []) {
  if (!tree || typeof tree !== "object" || !Array.isArray(roleMap) || roleMap.length === 0) {
    return;
  }
  const nodes = collectImageLayoutNodes(tree).filter((node) => node !== tree);
  for (const roleEntry of roleMap) {
    if (!roleEntry || typeof roleEntry !== "object") {
      continue;
    }
    const hasExplicitImplementationHint = Boolean(
      normalizeString(roleEntry.styleIntent) ||
      (roleEntry.visualStyle && typeof roleEntry.visualStyle === "object" && Object.keys(roleEntry.visualStyle).length > 0) ||
      (roleEntry.implementation && typeof roleEntry.implementation === "object" && Object.keys(roleEntry.implementation).length > 0)
    );
    if (!hasExplicitImplementationHint) {
      continue;
    }
    const target = nodes.find((node) => imageRoleMatchesNode(roleEntry, node));
    if (!target) {
      continue;
    }
    const role = normalizeString(roleEntry.role).toLowerCase();
    target.role = normalizeString(roleEntry.role) || target.role;
    target.styleIntent = normalizeString(roleEntry.styleIntent) || target.styleIntent;
    target.helper = normalizeRoleImplementationHelper(roleEntry, target.helper || "card");
    if (roleEntry.implementation?.layout) {
      target.layout = roleEntry.implementation.layout;
    }
    applyRoleBBoxAndStyle(target, roleEntry);
    if (expectsOutlinedComponent(roleEntry) && !target.fill) {
      target.fill = "#FFFFFF";
    }
    if (/coupon_row/u.test(role)) {
      ensureCouponRowStructure(target, roleEntry);
    } else if (/toggle|switch/u.test(role)) {
      ensureToggleStructure(target, roleEntry);
    } else if (/outlined_button|filled_button|button/u.test(role)) {
      ensureTextChild(target, roleEntry.label, "button-label");
    } else if (/separator/u.test(role)) {
      target.children = [];
    }
  }
}

function isImageLayoutTextNode(node = {}) {
  return normalizeString(node.helper).toLowerCase() === "text" || normalizeString(node.characters);
}

function applyImageRoleMapBBoxRepairs(tree = {}, roleMap = []) {
  if (!tree || typeof tree !== "object" || !Array.isArray(roleMap) || roleMap.length === 0) {
    return;
  }
  const nodes = collectImageLayoutNodes(tree).filter((node) => node !== tree);
  for (const roleEntry of roleMap) {
    if (!roleEntry || typeof roleEntry !== "object" || !normalizeImageRoleBBox(roleEntry)) {
      continue;
    }
    const labels = getVisibleTextLabelsForRole(roleEntry);
    if (labels.length === 1) {
      const textTarget = nodes.find((node) => isImageLayoutTextNode(node) && imageRoleMatchesNode(roleEntry, node));
      if (textTarget) {
        applyRoleBBoxAndStyle(textTarget, roleEntry);
      }
    }
    const role = normalizeString(roleEntry.role).toLowerCase();
    if (isRoleComponentLike(role)) {
      const componentTarget = nodes.find((node) => !isImageLayoutTextNode(node) && imageRoleMatchesNode(roleEntry, node));
      if (componentTarget) {
        applyRoleBBoxAndStyle(componentTarget, roleEntry);
      }
    }
  }
}

function isImageSquareCandidate(node = {}) {
  const semanticName = [
    node.name,
    node.role,
    node.helper,
    node.type,
    node.kind,
    node.sfSymbol,
    node.symbolName
  ].map((value) => normalizeString(value).toLowerCase()).join(" ");
  return IMAGE_LAYOUT_SQUARE_ROLE_PATTERN.test(semanticName);
}

function normalizeImageLayoutNumbers(node = {}, grid = IMAGE_LAYOUT_GRID_UNIT) {
  if (!node || typeof node !== "object") {
    return;
  }
  const numericKeys = ["x", "y", "width", "height", "itemSpacing", "gap", "radius", "fontSize", "lineHeight"];
  for (const key of numericKeys) {
    if (typeof node[key] === "number" && Number.isFinite(node[key])) {
      node[key] = snapToImageGrid(node[key], grid, {
        min: key === "width" || key === "height" || key === "fontSize" || key === "lineHeight" ? 1 : 0,
        preserveOne: key === "width" || key === "height"
      });
    }
  }
  if (typeof node.padding !== "undefined") {
    node.padding = normalizeImagePaddingForGrid(node.padding, grid);
  }
  if (isImageSquareCandidate(node)) {
    const size =
      typeof node.width === "number" && Number.isFinite(node.width)
        ? node.width
        : typeof node.height === "number" && Number.isFinite(node.height)
          ? node.height
          : null;
    if (size !== null) {
      node.width = size;
      node.height = size;
      if (/\b(avatar|circle|radio|dot|knob)\b/u.test(normalizeString(`${node.name} ${node.role} ${node.type} ${node.kind}`).toLowerCase())) {
        node.radius = size / 2;
      }
    }
  }
  if (Array.isArray(node.children)) {
    node.children.forEach((child) => normalizeImageLayoutNumbers(child, grid));
  }
}

function applyImageCanvasSpecToTree(tree = {}, canvasSpec = null) {
  if (!tree || typeof tree !== "object" || !canvasSpec) {
    return;
  }
  tree.width = canvasSpec.width;
  tree.height = canvasSpec.height;
  tree.canvasGrid = {
    gridUnit: canvasSpec.gridUnit,
    margin: canvasSpec.margin,
    columns: canvasSpec.columns,
    gutter: canvasSpec.gutter
  };
  if (canvasSpec.safeArea) {
    tree.safeArea = canvasSpec.safeArea;
  }
}

function coerceImageLayoutNode(node, depth = 0, budget = { count: 0, max: 160 }) {
  if (budget.count >= budget.max) {
    return null;
  }
  budget.count += 1;

  if (typeof node === "string" || typeof node === "number") {
    return createImageLayoutTextNode(String(node), depth <= 1 ? "section-title" : "meta");
  }
  if (Array.isArray(node)) {
    const children = node
      .map((child) => coerceImageLayoutNode(child, depth + 1, budget))
      .filter(Boolean);
    return { helper: depth === 0 ? "screen" : "column", children };
  }
  if (!node || typeof node !== "object") {
    return null;
  }

  const helper = depth === 0
    ? "screen"
    : normalizeImageLayoutHelper(node.helper || node.type || node.kind, getImageLayoutTextValue(node) ? "card" : "column");
  const coerced = copyImageLayoutScalarFields(node, { helper });
  const semanticName = [
    node.name,
    node.role,
    node.kind,
    node.type,
    node.sfSymbol,
    node.symbolName,
    node.label,
    node.title
  ].map((value) => normalizeString(value).toLowerCase()).join(" ");
  const isHeroLike = /\b(hero|banner|artwork|illustration|image|photo|cover|visual)\b|히어로|이미지|사진|일러스트/u.test(semanticName);
  const isIconLike = /\b(icon|symbol|sf-symbol|sfsymbol)\b/u.test(semanticName) || Boolean(node.sfSymbol || node.sfSymbolCharacter || node.symbolName);
  if (helper === "screen") {
    coerced.width = typeof coerced.width === "number" ? coerced.width : 390;
    coerced.height = typeof coerced.height === "number" ? coerced.height : 844;
    coerced.name = normalizeString(coerced.name) || "Generated image screen";
    coerced.layout = normalizeString(coerced.layout) || "none";
    if (!coerced.padding) {
      coerced.padding = { x: 16, y: 0 };
    }
    if (typeof coerced.gap !== "number") {
      coerced.gap = 12;
    }
  } else if (
    !coerced.widthMode &&
    !hasFiniteCoordinate(coerced) &&
    ["card", "section", "list", "row", "toolbar", "tabbar", "progress-bar"].includes(helper)
  ) {
    coerced.widthMode = "fill";
  } else if (hasFiniteCoordinate(coerced) && !coerced.widthMode) {
    coerced.widthMode = "fixed";
    coerced.heightMode = "fixed";
  }

  const textValue = getImageLayoutTextValue(node);
  const childCandidates = getImageLayoutChildCandidates(node);
  const children = childCandidates
    .map((child) => coerceImageLayoutNode(child, depth + 1, budget))
    .filter(Boolean);

  if (
    helper !== "text" &&
    helper !== "screen" &&
    (isHeroLike || (!normalizeString(coerced.layout) && children.some((child) => hasFiniteCoordinate(child))))
  ) {
    coerced.layout = "none";
  }
  if (isHeroLike && helper !== "text" && helper !== "screen") {
    coerced.clipsContent = coerced.clipsContent !== false;
    if (!coerced.padding) {
      coerced.padding = 0;
    }
    if (typeof coerced.gap !== "number") {
      coerced.gap = 0;
    }
  }

  if (helper === "text") {
    coerced.characters = textValue || normalizeString(node.name) || " ";
    if (isIconLike) {
      coerced.fontFamily = normalizeString(coerced.fontFamily) || IMAGE_LAYOUT_ICON_FONT_FAMILY;
      coerced.fontStyle = normalizeString(coerced.fontStyle) || IMAGE_LAYOUT_ICON_FONT_STYLE;
      coerced.role = normalizeString(coerced.role) || "meta";
    }
    coerced.children = [];
    return coerced;
  }

  const title = normalizeString(node.title || node.label);
  const subtitle = normalizeString(node.subtitle || node.caption);
  const valueText = normalizeString(node.value);
  const directText = textValue && textValue !== title && textValue !== subtitle ? textValue : "";
  const textChildren = [
    title ? createImageLayoutTextNode(title, depth <= 1 ? "section-title" : "meta-strong", `${normalizeString(node.name) || helper}-title`) : null,
    subtitle ? createImageLayoutTextNode(subtitle, "meta", `${normalizeString(node.name) || helper}-subtitle`) : null,
    valueText && valueText !== title && valueText !== subtitle
      ? createImageLayoutTextNode(valueText, "meta", `${normalizeString(node.name) || helper}-value`)
      : null,
    directText ? createImageLayoutTextNode(directText, "meta", `${normalizeString(node.name) || helper}-copy`) : null
  ].filter(Boolean);

  if (helper === "status-chip" && textValue) {
    coerced.label = textValue;
  }
  if (helper === "status-chip" && !textValue) {
    coerced.helper = "row";
  }
  if (["circle", "ellipse", "avatar"].includes(normalizeString(node.type || node.kind || node.helper).toLowerCase())) {
    const size =
      typeof coerced.width === "number" && Number.isFinite(coerced.width)
        ? coerced.width
        : typeof coerced.height === "number" && Number.isFinite(coerced.height)
          ? coerced.height
          : 32;
    coerced.width = size;
    coerced.height = typeof coerced.height === "number" ? coerced.height : size;
    coerced.radius = typeof coerced.radius === "number" ? coerced.radius : size / 2;
  }

  coerced.children = [...textChildren, ...children];
  return coerced;
}

export function coerceImageLayoutTree(tree = {}, optionsOrRoleMap = []) {
  const options = createImageLayoutOptions(optionsOrRoleMap);
  const coerced = coerceImageLayoutNode(tree, 0);
  if (!coerced || typeof coerced !== "object") {
    return null;
  }
  coerced.helper = "screen";
  const canvasSpec = options.canvasSpec
    ? normalizeImageCanvasSpec(options.canvasSpec, coerced)
    : null;
  coerced.width = typeof coerced.width === "number" ? coerced.width : 390;
  coerced.height = typeof coerced.height === "number" ? coerced.height : 844;
  applyImageCanvasSpecToTree(coerced, canvasSpec);
  if (!Array.isArray(coerced.children)) {
    coerced.children = [];
  }
  applyImageLayoutMapHints(coerced, options.layoutMap);
  applyImageTextStyleHints(coerced, options.textStyleMap, canvasSpec?.gridUnit || IMAGE_LAYOUT_GRID_UNIT);
  applyImageRoleMapImplementationHints(coerced, options.roleMap);
  if (options.applyRoleMapBBoxRepairs) {
    applyImageRoleMapBBoxRepairs(coerced, options.roleMap);
  }
  if (canvasSpec || options.layoutMap.length || options.textStyleMap.length) {
    normalizeImageLayoutNumbers(coerced, canvasSpec?.gridUnit || IMAGE_LAYOUT_GRID_UNIT);
  }
  removeUnobservedPlaceholders(coerced, collectObservedRoleMapText(options.roleMap));
  constrainFreeformChildren(coerced);
  return coerced;
}

function constrainFreeformChildren(node = {}) {
  if (!node || typeof node !== "object" || !Array.isArray(node.children)) {
    return;
  }

  const parentWidth =
    typeof node.width === "number" && Number.isFinite(node.width) ? node.width : null;
  const parentHeight =
    typeof node.height === "number" && Number.isFinite(node.height) ? node.height : null;
  const isFreeform = normalizeString(node.layout).toLowerCase() === "none";

  for (const child of node.children) {
    if (child && typeof child === "object") {
      if (isFreeform) {
        if (!hasFiniteCoordinate(child)) {
          constrainFreeformChildren(child);
          continue;
        }
        const x = typeof child.x === "number" && Number.isFinite(child.x) ? child.x : 0;
        const y = typeof child.y === "number" && Number.isFinite(child.y) ? child.y : 0;
        if (parentWidth !== null) {
          child.x = Math.max(0, Math.min(x, Math.max(0, parentWidth - 1)));
          if (typeof child.width === "number" && Number.isFinite(child.width)) {
            child.width = Math.max(1, Math.min(child.width, Math.max(1, parentWidth - child.x)));
          }
          if (child.widthMode === "fill") {
            child.widthMode = "fixed";
          }
        }
        if (parentHeight !== null) {
          if (typeof child.y === "number" && Number.isFinite(child.y)) {
            child.y = Math.max(0, Math.min(y, Math.max(0, parentHeight - 1)));
          }
          if (
            typeof child.y === "number" &&
            Number.isFinite(child.y) &&
            typeof child.height === "number" &&
            Number.isFinite(child.height)
          ) {
            child.height = Math.max(1, Math.min(child.height, Math.max(1, parentHeight - child.y)));
          }
          if (child.heightMode === "fill") {
            child.heightMode = "fixed";
          }
        }
      }
      constrainFreeformChildren(child);
    }
  }
}

function normalizeImageLayoutResult(result = {}) {
  const roleMap = normalizeImageRoleMap(result.roleMapJson || result.roleMap || result.roles);
  const rawTree = result.tree && typeof result.tree === "object" && !Array.isArray(result.tree)
    ? result.tree
    : null;
  const canvasSpec = normalizeImageCanvasSpec(result.canvasSpecJson || result.canvasSpec || result.canvas, rawTree || {});
  const layoutMap = normalizeImageLayoutMap(result.layoutMapJson || result.layoutMap || result.layouts);
  const textStyleMap = normalizeImageTextStyleMap(result.textStyleMapJson || result.textStyleMap || result.textStyles);
  let tree = result.tree && typeof result.tree === "object" && !Array.isArray(result.tree)
    ? result.tree
    : null;
  if (!tree && typeof result.treeJson === "string" && result.treeJson.trim()) {
    try {
      const parsedTree = JSON.parse(stripCodeFence(result.treeJson));
      if (parsedTree && typeof parsedTree === "object" && !Array.isArray(parsedTree)) {
        tree = parsedTree;
      }
    } catch {}
  }
  return {
    summary: normalizeString(result.summary),
    canvasSpec,
    layoutMap,
    roleMap,
    textStyleMap,
    tree: tree ? coerceImageLayoutTree(tree, {
      roleMap,
      canvasSpec,
      layoutMap,
      textStyleMap,
      applyRoleMapBBoxRepairs: false
    }) : null
  };
}

function validateImageLayoutResult(result = {}) {
  if (!result.summary || !result.tree) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  return {
    ...result,
    semanticQuality: validateImageLayoutSemanticCoverage(result)
  };
}

function applyValidatedImageLayoutRepairs(result = {}) {
  if (!result || typeof result !== "object" || !result.tree) {
    return result;
  }
  return {
    ...result,
    tree: coerceImageLayoutTree(result.tree, {
      roleMap: result.roleMap,
      canvasSpec: result.canvasSpec,
      layoutMap: result.layoutMap,
      textStyleMap: result.textStyleMap,
      applyRoleMapBBoxRepairs: true
    })
  };
}

function shouldTryDeterministicImageLayoutRepair(details = null) {
  if (!details || typeof details !== "object") {
    return false;
  }
  return Array.isArray(details.textOverlapEntries) && details.textOverlapEntries.length > 0;
}

function validateDeterministicImageLayoutRepair(result = {}, details = null, baselineQuality = null) {
  if (!shouldTryDeterministicImageLayoutRepair(details)) {
    return null;
  }
  const repaired = applyValidatedImageLayoutRepairs(result);
  const validated = validateImageLayoutResult(repaired);
  assertImageCandidateDoesNotRegress(validated.semanticQuality, baselineQuality);
  return validated;
}

function normalizeComparableText(value = "") {
  return normalizeString(value).toLowerCase().replace(/\s+/g, "");
}

function isImageLayoutLabelCoveredByText(label = "", text = "") {
  const normalizedLabel = normalizeComparableText(label);
  const normalizedText = normalizeComparableText(text);
  if (!normalizedLabel || !normalizedText) {
    return false;
  }
  if (normalizedText.includes(normalizedLabel)) {
    return true;
  }
  if (normalizedLabel.length <= 4) {
    return normalizedLabel.includes(normalizedText);
  }
  const minContainedLength = Math.max(4, Math.ceil(normalizedLabel.length * 0.75));
  return normalizedText.length >= minContainedLength && normalizedLabel.includes(normalizedText);
}

function isVisibleRoleLabel(value = "") {
  const text = normalizeString(value);
  return text.length >= 2 && text.length <= 80 && /[\p{L}\p{N}]/u.test(text);
}

function getVisibleTextLabelsForRole(entry = {}) {
  const labels = Array.isArray(entry?.textLabels) && entry.textLabels.length > 0
    ? entry.textLabels
    : entry?.textLabel
      ? [entry.textLabel]
      : entry?.visibleText === false
        ? []
        : [entry?.label];
  return labels.map((label) => normalizeString(label)).filter(isVisibleRoleLabel);
}

function normalizeImageRoleBBox(entry = {}) {
  const bbox = entry && typeof entry.bbox === "object" ? entry.bbox : null;
  if (!bbox) {
    return null;
  }
  const x = Number(bbox.x);
  const y = Number(bbox.y);
  const width = Number(bbox.width);
  const height = Number(bbox.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function isLikelyIntentionalTopOriginNode(node = {}) {
  const role = normalizeString(node.role).toLowerCase();
  const name = normalizeString(node.name || node.helper).toLowerCase();
  return /(source|reference|background|status|system|safe-area|safe_area|notch|home-indicator|home_indicator|divider|hairline|separator)/u.test(
    `${role} ${name}`
  );
}

function getImageLayoutNodeBox(node = {}, parentOffset = { x: 0, y: 0 }) {
  if (!hasCompleteCoordinatePair(node)) {
    return null;
  }
  return {
    x: parentOffset.x + node.x,
    y: parentOffset.y + node.y,
    width: typeof node.width === "number" && Number.isFinite(node.width) ? node.width : 0,
    height: typeof node.height === "number" && Number.isFinite(node.height) ? node.height : 0
  };
}

function isImageLayoutContainerForChildWidthCheck(node = {}) {
  const text = normalizeString(`${node.helper || ""} ${node.role || ""} ${node.name || ""}`).toLowerCase();
  return /(list|section|schedule|results|table|card|column|content|group)/u.test(text);
}

function isImageLayoutRowForChildWidthCheck(node = {}) {
  const text = normalizeString(`${node.helper || ""} ${node.role || ""} ${node.name || ""}`).toLowerCase();
  if (/(divider|separator|hairline|icon|leading|indicator|knob|dot|avatar)/u.test(text)) {
    return false;
  }
  return /(row|list-item|list_item|media-row|event|result)/u.test(text);
}

function isShrunkenChildComponent(node = {}, parentNode = {}, nodeBox = null, parentBox = null) {
  if (!nodeBox || !parentBox || !isImageLayoutContainerForChildWidthCheck(parentNode) || !isImageLayoutRowForChildWidthCheck(node)) {
    return false;
  }
  const parentWidth = Number(parentBox.width || 0);
  const childWidth = Number(nodeBox.width || 0);
  const childHeight = Number(nodeBox.height || 0);
  if (!Number.isFinite(parentWidth) || !Number.isFinite(childWidth) || parentWidth < 240 || childWidth <= 0 || childHeight < 20) {
    return false;
  }
  return childWidth < parentWidth * 0.65;
}

function collectImageLayoutTreeQuality(
  node = {},
  stats = { nodes: 0, coordinateNodes: 0, topOriginCoordinateNodes: 0, texts: [], positionedTexts: [], positionedComponents: [], shrunkenChildComponents: [] },
  parentOffset = { x: 0, y: 0 },
  parentNode = null,
  parentBox = null
) {
  if (!node || typeof node !== "object") {
    return stats;
  }
  if (node.role === "source-image-reference") {
    return stats;
  }
  stats.nodes += 1;
  if (hasCompleteCoordinatePair(node)) {
    stats.coordinateNodes += 1;
    const nodeBox = getImageLayoutNodeBox(node, parentOffset);
    const absoluteY = parentOffset.y + node.y;
    const height = typeof node.height === "number" && Number.isFinite(node.height) ? node.height : 0;
    if (absoluteY <= 1 && height >= 12 && !isLikelyIntentionalTopOriginNode(node)) {
      stats.topOriginCoordinateNodes += 1;
    }
    const componentEntry = {
      helper: normalizeString(node.helper),
      role: normalizeString(node.role),
      name: normalizeString(node.name),
      text: normalizeString(node.characters || node.label),
      fill: normalizeString(node.fill),
      stroke: normalizeString(node.stroke || node.border || node.borderColor),
      radius: typeof node.radius === "number" && Number.isFinite(node.radius) ? node.radius : null,
      ...nodeBox
    };
    stats.positionedComponents.push(componentEntry);
    if (isShrunkenChildComponent(node, parentNode || {}, nodeBox, parentBox)) {
      stats.shrunkenChildComponents.push({
        ...componentEntry,
        parentName: normalizeString(parentNode?.name),
        parentRole: normalizeString(parentNode?.role),
        parentWidth: Number(parentBox?.width || 0)
      });
    }
  }
  const text = normalizeString(node.characters || node.label);
  if (text) {
    stats.texts.push(text);
    const nodeBox = getImageLayoutNodeBox(node, parentOffset);
    if (nodeBox) {
      stats.positionedTexts.push({
        text,
        textAlign: normalizeString(node.textAlign || node.align),
        ...nodeBox
      });
    } else if (Number.isFinite(parentOffset.x) && Number.isFinite(parentOffset.y)) {
      stats.positionedTexts.push({
        text,
        textAlign: normalizeString(node.textAlign || node.align),
        x: parentOffset.x,
        y: parentOffset.y,
        width: typeof node.width === "number" && Number.isFinite(node.width) ? node.width : 0,
        height: typeof node.height === "number" && Number.isFinite(node.height) ? node.height : 0
      });
    }
  }
  if (Array.isArray(node.children)) {
    const nodeBox = getImageLayoutNodeBox(node, parentOffset) || parentBox;
    const nextOffset = {
      x: parentOffset.x + (typeof node.x === "number" && Number.isFinite(node.x) ? node.x : 0),
      y: parentOffset.y + (typeof node.y === "number" && Number.isFinite(node.y) ? node.y : 0)
    };
    node.children.forEach((child) => collectImageLayoutTreeQuality(child, stats, nextOffset, node, nodeBox));
  }
  return stats;
}

function isRoleLabelMatchedToText(roleEntry = {}, positionedText = {}) {
  const labels = getVisibleTextLabelsForRole(roleEntry);
  return labels.some((label) => isImageLayoutLabelCoveredByText(label, positionedText.text));
}

function isRoleBBoxCoveredByPositionedText(roleEntry = {}, positionedText = {}) {
  const bbox = normalizeImageRoleBBox(roleEntry);
  if (!bbox || !isRoleLabelMatchedToText(roleEntry, positionedText)) {
    return false;
  }
  const roleCenterY = bbox.y + bbox.height / 2;
  const roleCenterX = bbox.x + bbox.width / 2;
  const nodeHeight = Number(positionedText.height || 0) || bbox.height;
  const nodeWidth = Number(positionedText.width || 0) || bbox.width;
  const nodeCenterY = Number(positionedText.y || 0) + nodeHeight / 2;
  const nodeCenterX = Number(positionedText.x || 0) + nodeWidth / 2;
  const yTolerance = Math.max(32, bbox.height * 1.5, nodeHeight * 1.5);
  const xTolerance = Math.max(48, bbox.width * 1.25, nodeWidth * 1.25);
  return (
    Math.abs(roleCenterY - nodeCenterY) <= yTolerance &&
    Math.abs(roleCenterX - nodeCenterX) <= xTolerance
  );
}

function getVisualRoleLabel(entry = {}) {
  return normalizeString(entry.visualLabel || entry.label || entry.role || entry.type || entry.kind);
}

function isPostBuildVisualRoleCoverageRequired(entry = {}) {
  const role = normalizeString(entry.role || entry.type || entry.kind).toLowerCase();
  const label = getVisualRoleLabel(entry);
  if (!normalizeImageRoleBBox(entry) || !label || getVisibleTextLabelsForRole(entry).length > 0) {
    return false;
  }
  if (/source|reference|background|decorative/u.test(role)) {
    return false;
  }
  return /(progress|toggle|switch|tabbar|tab_bar|toolbar|bottom|navigation|nav|avatar|image|photo|hero|media|artwork|illustration|collage|chart|graph|table|card|coupon|browser)/u.test(
    `${role} ${label.toLowerCase()}`
  );
}

function componentMatchesVisualRoleKind(roleEntry = {}, component = {}) {
  const role = normalizeString(roleEntry.role || roleEntry.type || roleEntry.kind).toLowerCase();
  const label = getVisualRoleLabel(roleEntry).toLowerCase();
  const componentText = normalizeString(
    `${component.helper || ""} ${component.role || ""} ${component.name || ""} ${component.text || ""}`
  ).toLowerCase();
  if (!componentText) {
    return false;
  }
  if (/progress/u.test(`${role} ${label}`)) {
    return /progress/u.test(componentText);
  }
  if (/(toggle|switch)/u.test(`${role} ${label}`)) {
    return /(toggle|switch|knob)/u.test(componentText);
  }
  if (/(tabbar|tab_bar|bottom|navigation|nav)/u.test(`${role} ${label}`)) {
    return /(tabbar|tab-bar|toolbar|nav|navigation|bottom)/u.test(componentText);
  }
  if (/(avatar|image|photo|hero|media|artwork|illustration|collage)/u.test(`${role} ${label}`)) {
    return /(avatar|image|photo|hero|media|artwork|illustration|collage|card)/u.test(componentText);
  }
  if (/(chart|graph|table|card|coupon|browser)/u.test(`${role} ${label}`)) {
    return /(chart|graph|table|card|coupon|browser|section|row|list)/u.test(componentText);
  }
  const comparableRole = normalizeComparableText(role);
  const comparableLabel = normalizeComparableText(label);
  const comparableComponent = normalizeComparableText(componentText);
  return (
    (comparableRole && comparableComponent.includes(comparableRole)) ||
    (comparableLabel && comparableComponent.includes(comparableLabel))
  );
}

function isRoleBBoxCoveredByPositionedComponent(roleEntry = {}, component = {}) {
  const bbox = normalizeImageRoleBBox(roleEntry);
  if (!bbox || !componentMatchesVisualRoleKind(roleEntry, component)) {
    return false;
  }
  const width = Number(component.width || 0);
  const height = Number(component.height || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }
  const roleCenterY = bbox.y + bbox.height / 2;
  const roleCenterX = bbox.x + bbox.width / 2;
  const componentCenterY = Number(component.y || 0) + height / 2;
  const componentCenterX = Number(component.x || 0) + width / 2;
  const yTolerance = Math.max(32, bbox.height * 2, height * 1.5);
  const xTolerance = Math.max(48, bbox.width * 1.25, width * 1.25);
  return (
    Math.abs(roleCenterY - componentCenterY) <= yTolerance &&
    Math.abs(roleCenterX - componentCenterX) <= xTolerance
  );
}

function estimateOneLineTextMinWidth(label = "") {
  const normalized = normalizeString(label);
  if (!normalized) {
    return 0;
  }
  let width = 0;
  for (const char of Array.from(normalized)) {
    if (/\s/u.test(char)) {
      width += 4;
    } else if (/[\p{Script=Hangul}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char)) {
      width += 11;
    } else if (/[A-Z0-9]/u.test(char)) {
      width += 8;
    } else {
      width += 7;
    }
  }
  return Math.max(24, width);
}

function isTextWrapRiskForRole(roleEntry = {}, positionedText = {}) {
  const labels = getVisibleTextLabelsForRole(roleEntry);
  const label = labels.find((item) => isImageLayoutLabelCoveredByText(item, positionedText.text)) || "";
  const role = normalizeString(roleEntry.role).toLowerCase();
  const bbox = normalizeImageRoleBBox(roleEntry);
  if (!bbox || !isVisibleRoleLabel(label) || !isRoleLabelMatchedToText(roleEntry, positionedText)) {
    return false;
  }
  if (/status.*bar|system_status_bar|ios_status_bar/u.test(role)) {
    return false;
  }
  if (/table|stats|statistics|leaderboard|results|scoreboard/u.test(role) || labels.length >= 4) {
    return false;
  }
  if (label.length < 4 || bbox.width < 40) {
    return false;
  }
  const estimatedMinWidth = estimateOneLineTextMinWidth(label);
  const nodeWidth = Number(positionedText.width || 0);
  if (!Number.isFinite(nodeWidth) || nodeWidth <= 0) {
    return false;
  }
  return nodeWidth < estimatedMinWidth || nodeWidth < Math.min(bbox.width * 0.45, estimatedMinWidth * 1.1);
}

function isRoleComponentLike(role = "") {
  return /(button|row|list|toggle|switch|toolbar|tabbar|tab|chip|card|coupon|browser)/u.test(
    normalizeString(role).toLowerCase()
  );
}

function findBestPositionedComponentForRole(roleEntry = {}, components = []) {
  const bbox = normalizeImageRoleBBox(roleEntry);
  const role = normalizeString(roleEntry.role).toLowerCase();
  const label = normalizeString(roleEntry.label);
  if (!bbox) {
    return null;
  }
  const candidates = components.filter((component) => {
    const textMatched = label && isImageLayoutLabelCoveredByText(label, component.text);
    const roleMatched = role && normalizeString(component.role).toLowerCase() === role;
    const nameMatched = label && normalizeComparableText(component.name).includes(normalizeComparableText(label));
    return textMatched || roleMatched || nameMatched;
  });
  if (candidates.length === 0) {
    return null;
  }
  const bboxCenterX = bbox.x + bbox.width / 2;
  const bboxCenterY = bbox.y + bbox.height / 2;
  return candidates
    .map((component) => {
      const centerX = component.x + (Number(component.width || 0) || bbox.width) / 2;
      const centerY = component.y + (Number(component.height || 0) || bbox.height) / 2;
      return {
        component,
        distance: Math.abs(centerX - bboxCenterX) + Math.abs(centerY - bboxCenterY)
      };
    })
    .sort((a, b) => a.distance - b.distance)[0].component;
}

function isComponentBBoxTooSmallForRole(roleEntry = {}, component = {}) {
  const bbox = normalizeImageRoleBBox(roleEntry);
  const role = normalizeString(roleEntry.role).toLowerCase();
  if (!bbox || !isRoleComponentLike(role)) {
    return false;
  }
  const width = Number(component.width || 0);
  const height = Number(component.height || 0);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return false;
  }
  const minWidthRatio = /toggle|switch|chip/u.test(role) ? 0.45 : 0.6;
  const minHeightRatio = /toggle|switch|chip/u.test(role) ? 0.45 : 0.5;
  return width < bbox.width * minWidthRatio || height < bbox.height * minHeightRatio;
}

function isWhiteLikeFill(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  return !normalized || normalized === "none" || normalized === "transparent" || /^#(?:fff|ffffff|fefefe|fcfcfc|fafafa)$/u.test(normalized);
}

function expectsOutlinedComponent(roleEntry = {}) {
  const strategy = normalizeString(roleEntry.strategy).toLowerCase();
  const role = normalizeString(roleEntry.role).toLowerCase();
  const visualStyle = roleEntry.visualStyle && typeof roleEntry.visualStyle === "object" ? roleEntry.visualStyle : {};
  const styleFill = normalizeString(visualStyle.fill);
  const styleStroke = normalizeString(visualStyle.stroke || visualStyle.border || visualStyle.borderColor);
  const explicitlyOutlinedRole = /(outline|outlined|bordered|stroke)/u.test(role);
  const componentRole = /(button|row|list|chip|coupon|field|input|card)/u.test(role);
  if (explicitlyOutlinedRole) {
    return true;
  }
  if (styleStroke && isWhiteLikeFill(styleFill)) {
    return componentRole;
  }
  return componentRole && /(outline|outlined|border|bordered|stroke)/u.test(strategy);
}

function isOutlinedStyleMismatch(roleEntry = {}, component = {}) {
  if (!expectsOutlinedComponent(roleEntry)) {
    return false;
  }
  const fill = normalizeString(component.fill);
  const stroke = normalizeString(component.stroke);
  return !isWhiteLikeFill(fill) || !stroke;
}

function boxesOverlapRatio(a = {}, b = {}) {
  const ax2 = Number(a.x || 0) + Number(a.width || 0);
  const ay2 = Number(a.y || 0) + Number(a.height || 0);
  const bx2 = Number(b.x || 0) + Number(b.width || 0);
  const by2 = Number(b.y || 0) + Number(b.height || 0);
  const overlapWidth = Math.max(0, Math.min(ax2, bx2) - Math.max(Number(a.x || 0), Number(b.x || 0)));
  const overlapHeight = Math.max(0, Math.min(ay2, by2) - Math.max(Number(a.y || 0), Number(b.y || 0)));
  const overlapArea = overlapWidth * overlapHeight;
  const minArea = Math.min(
    Math.max(1, Number(a.width || 0) * Number(a.height || 0)),
    Math.max(1, Number(b.width || 0) * Number(b.height || 0))
  );
  return overlapArea / minArea;
}

function isShortUnknownAlphaText(text = "", visibleLabelSet = new Set()) {
  const normalized = normalizeString(text);
  if (!/^[A-Za-z]{1,4}$/u.test(normalized)) {
    return false;
  }
  const comparable = normalizeComparableText(normalized);
  if (!comparable || visibleLabelSet.has(comparable)) {
    return false;
  }
  const allowed = new Set(["on", "off", "am", "pm", "mi", "km", "hr", "hrs", "min", "pts"]);
  return !allowed.has(comparable);
}

function isIconFallbackWord(text = "") {
  const comparable = normalizeComparableText(text);
  return /^(battery|batteryfill|batterylevel|wifi|wifibars|cellular|cellularbars|signal|signalbars|camera|banner|chevron|chevronright|toggle|switch|icon|image)$/iu.test(
    comparable
  );
}

function normalizePositionedTextsForOverlap(positionedTexts = []) {
  return positionedTexts.filter((item) => {
    return isVisibleRoleLabel(item.text) && Number(item.width || 0) > 0 && Number(item.height || 0) > 0;
  }).map((item) => {
    const boxWidth = Number(item.width || 0) || 0;
    const estimatedTextWidth = Math.min(boxWidth, estimateOneLineTextMinWidth(item.text) + 4);
    const textAlign = normalizeString(item.textAlign).toLowerCase();
    const x =
      /center|middle/u.test(textAlign)
        ? Number(item.x || 0) + Math.max(0, (boxWidth - estimatedTextWidth) / 2)
        : /right|end/u.test(textAlign)
          ? Number(item.x || 0) + Math.max(0, boxWidth - estimatedTextWidth)
          : Number(item.x || 0);
    return {
      ...item,
      x,
      width: estimatedTextWidth
    };
  });
}

function collectTextOverlapEntries(positionedTexts = []) {
  const entries = [];
  const texts = normalizePositionedTextsForOverlap(positionedTexts);
  for (let i = 0; i < texts.length; i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      if (normalizeComparableText(texts[i].text) === normalizeComparableText(texts[j].text)) {
        continue;
      }
      const overlapRatio = boxesOverlapRatio(texts[i], texts[j]);
      if (overlapRatio >= 0.28) {
        entries.push({
          left: texts[i].text,
          right: texts[j].text,
          overlapRatio: Number(overlapRatio.toFixed(3)),
          leftBox: {
            x: Math.round(Number(texts[i].x || 0)),
            y: Math.round(Number(texts[i].y || 0)),
            width: Math.round(Number(texts[i].width || 0)),
            height: Math.round(Number(texts[i].height || 0))
          },
          rightBox: {
            x: Math.round(Number(texts[j].x || 0)),
            y: Math.round(Number(texts[j].y || 0)),
            width: Math.round(Number(texts[j].width || 0)),
            height: Math.round(Number(texts[j].height || 0))
          }
        });
      }
    }
  }
  return entries;
}

function countTextOverlaps(positionedTexts = []) {
  return collectTextOverlapEntries(positionedTexts).length;
}

function countVerticalSplitLabels(positionedTexts = [], visibleLabelSet = new Set()) {
  const singleLetters = positionedTexts
    .filter((item) => /^[A-Za-z]$/u.test(normalizeString(item.text)))
    .map((item) => ({
      text: normalizeString(item.text),
      x: Math.round(Number(item.x || 0) / 4) * 4,
      y: Number(item.y || 0)
    }))
    .sort((a, b) => a.x - b.x || a.y - b.y);
  const groups = new Map();
  singleLetters.forEach((item) => {
    if (!groups.has(item.x)) {
      groups.set(item.x, []);
    }
    groups.get(item.x).push(item);
  });
  let count = 0;
  for (const group of groups.values()) {
    if (group.length < 3) {
      continue;
    }
    const word = group.map((item) => item.text).join("").toLowerCase();
    if (!visibleLabelSet.has(word)) {
      count += 1;
    }
  }
  return count;
}

function buildImageLayoutVisualSanityDetails(stats = {}, roleLabels = []) {
  const visibleLabelSet = new Set(roleLabels.map(normalizeComparableText).filter(Boolean));
  const positionedTexts = Array.isArray(stats.positionedTexts) ? stats.positionedTexts : [];
  const statusBarUnknownTextCount = positionedTexts.filter((item) => {
    return Number(item.y || 0) <= 36 && isShortUnknownAlphaText(item.text, visibleLabelSet);
  }).length;
  const unknownShortTextCount = positionedTexts.filter((item) => {
    return isShortUnknownAlphaText(item.text, visibleLabelSet) || isIconFallbackWord(item.text);
  }).length;
  const iconFallbackTextCount = positionedTexts.filter((item) => isIconFallbackWord(item.text)).length;
  const verticalSplitLabelCount = countVerticalSplitLabels(positionedTexts, visibleLabelSet);
  const textOverlapEntries = collectTextOverlapEntries(positionedTexts);
  const textOverlapCount = textOverlapEntries.length;
  const severeTextOverlapCount = textOverlapCount >= 3 ? textOverlapCount : 0;
  const visualSanityIssueCount =
    statusBarUnknownTextCount +
    unknownShortTextCount +
    iconFallbackTextCount +
    verticalSplitLabelCount +
    severeTextOverlapCount;
  return {
    statusBarUnknownTextCount,
    unknownShortTextCount,
    iconFallbackTextCount,
    verticalSplitLabelCount,
    textOverlapCount,
    textOverlapEntries: textOverlapEntries.slice(0, 12),
    severeTextOverlapCount,
    visualSanityIssueCount,
    visualSanityTooLow: visualSanityIssueCount > 0
  };
}

function validateImageLayoutSemanticCoverage(result = {}) {
  const roleMap = Array.isArray(result.roleMap) ? result.roleMap : [];
  if (roleMap.length === 0 || !result.tree) {
    return null;
  }

  const stats = collectImageLayoutTreeQuality(result.tree);
  const canvasSpec = result.canvasSpec && typeof result.canvasSpec === "object" ? result.canvasSpec : {};
  const surfaceType = normalizeString(canvasSpec.surfaceType || canvasSpec.type).toLowerCase();
  const treeWidth = Number(result.tree.width || canvasSpec.width || 0) || 0;
  const treeHeight = Number(result.tree.height || canvasSpec.height || 0) || 0;
  const isFullMobileScreen =
    /mobile|phone|ios|android/.test(surfaceType) ||
    (treeWidth >= 320 && treeWidth <= 480 && treeHeight >= 600);
  const roleLabels = roleMap.flatMap((entry) => getVisibleTextLabelsForRole(entry));
  const treeText = stats.texts.map(normalizeComparableText).filter(Boolean);
  const coveredLabels = roleLabels.filter((label) => {
    return treeText.some((text) => isImageLayoutLabelCoveredByText(label, text));
  });
  const missingRoleLabels = roleLabels.filter((label) => !coveredLabels.includes(label));
  const roleEntriesWithBbox = roleMap.filter((entry) => {
    return getVisibleTextLabelsForRole(entry).length > 0 && normalizeImageRoleBBox(entry);
  });
  const bboxCoveredLabels = roleEntriesWithBbox.filter((entry) => {
    return stats.positionedTexts.some((item) => isRoleBBoxCoveredByPositionedText(entry, item));
  });
  const bboxMissingRoleLabels = roleEntriesWithBbox
    .filter((entry) => !bboxCoveredLabels.includes(entry))
    .flatMap((entry) => getVisibleTextLabelsForRole(entry))
    .filter(Boolean);
  const wrapRiskEntries = roleEntriesWithBbox.filter((entry) => {
    return stats.positionedTexts.some((item) => isTextWrapRiskForRole(entry, item));
  });
  const componentBBoxMismatchEntries = roleEntriesWithBbox.filter((entry) => {
    const component = findBestPositionedComponentForRole(entry, stats.positionedComponents);
    return component && isComponentBBoxTooSmallForRole(entry, component);
  });
  const outlinedStyleMismatchEntries = roleEntriesWithBbox.filter((entry) => {
    const component = findBestPositionedComponentForRole(entry, stats.positionedComponents);
    return component && isOutlinedStyleMismatch(entry, component);
  });
  const visualSanityDetails = buildImageLayoutVisualSanityDetails(stats, roleLabels);

  const minNodeCount = Math.min(40, Math.max(1, Math.ceil(roleMap.length * 0.65)));
  const minLabelCoverage =
    roleLabels.length >= 4 ? Math.max(3, Math.ceil(roleLabels.length * 0.6)) : roleLabels.length;
  const minRecognizedRoleCount = isFullMobileScreen ? 4 : 1;
  const minCoordinateNodeCount = isFullMobileScreen
    ? Math.max(3, Math.ceil(Math.min(roleMap.length, stats.nodes) * 0.5))
    : 0;
  const maxTopOriginCoordinateNodes = isFullMobileScreen ? 2 : Infinity;
  const minBboxAlignedLabelCount =
    isFullMobileScreen && roleEntriesWithBbox.length >= 3
      ? Math.max(2, Math.ceil(roleEntriesWithBbox.length * 0.6))
      : 0;
  const details = {
    roleCount: roleMap.length,
    generatedNodeCount: stats.nodes,
    coordinateNodeCount: stats.coordinateNodes,
    topOriginCoordinateNodeCount: stats.topOriginCoordinateNodes,
    visibleRoleLabelCount: roleLabels.length,
    coveredRoleLabelCount: coveredLabels.length,
    missingRoleLabels: missingRoleLabels.slice(0, 12),
    bboxRoleLabelCount: roleEntriesWithBbox.length,
    bboxAlignedRoleLabelCount: bboxCoveredLabels.length,
    bboxMisalignedRoleLabels: bboxMissingRoleLabels.slice(0, 12),
    requiredNodeCount: minNodeCount,
    requiredCoveredRoleLabelCount: minLabelCoverage,
    requiredRoleCount: minRecognizedRoleCount,
    requiredCoordinateNodeCount: minCoordinateNodeCount,
    maxTopOriginCoordinateNodeCount: Number.isFinite(maxTopOriginCoordinateNodes)
      ? maxTopOriginCoordinateNodes
      : null,
    requiredBboxAlignedRoleLabelCount: minBboxAlignedLabelCount,
    visualOnlyRoleCount: roleMap.filter((entry) => getVisibleTextLabelsForRole(entry).length === 0 && normalizeString(entry?.visualLabel || entry?.label)).length,
    visualOnlyRoleLabels: roleMap
      .filter((entry) => getVisibleTextLabelsForRole(entry).length === 0)
      .map((entry) => normalizeString(entry.visualLabel || entry.label))
      .filter(Boolean)
      .slice(0, 12),
    wrapRiskRoleLabels: wrapRiskEntries.flatMap((entry) => getVisibleTextLabelsForRole(entry)).filter(Boolean).slice(0, 12),
    componentBBoxMismatchLabels: componentBBoxMismatchEntries.flatMap((entry) => getVisibleTextLabelsForRole(entry)).filter(Boolean).slice(0, 12),
    shrunkenChildComponentLabels: (Array.isArray(stats.shrunkenChildComponents) ? stats.shrunkenChildComponents : [])
      .map((entry) => normalizeString(entry.name || entry.role || entry.text))
      .filter(Boolean)
      .slice(0, 12),
    outlinedStyleMismatchLabels: outlinedStyleMismatchEntries.flatMap((entry) => getVisibleTextLabelsForRole(entry)).filter(Boolean).slice(0, 12),
    recognizedRoleCountTooLow: roleMap.length < minRecognizedRoleCount,
    nodeCoverageTooLow: stats.nodes < minNodeCount,
    textCoverageTooLow: coveredLabels.length < minLabelCoverage,
    coordinateCoverageTooLow: stats.coordinateNodes < minCoordinateNodeCount,
    topOriginStackingTooHigh: stats.topOriginCoordinateNodes > maxTopOriginCoordinateNodes,
    bboxAlignmentTooLow: bboxCoveredLabels.length < minBboxAlignedLabelCount,
    textWrapRiskTooHigh: wrapRiskEntries.length > 0,
    componentBBoxSizeTooLow: componentBBoxMismatchEntries.length > 0,
    childComponentWidthTooLow: (stats.shrunkenChildComponents?.length || 0) > 0,
    outlinedStyleMismatchTooHigh: outlinedStyleMismatchEntries.length > 0,
    ...visualSanityDetails
  };

  if (
    roleMap.length < minRecognizedRoleCount ||
    stats.coordinateNodes < minCoordinateNodeCount ||
    stats.nodes < minNodeCount ||
    coveredLabels.length < minLabelCoverage ||
    stats.topOriginCoordinateNodes > maxTopOriginCoordinateNodes ||
    bboxCoveredLabels.length < minBboxAlignedLabelCount ||
    wrapRiskEntries.length > 0 ||
    componentBBoxMismatchEntries.length > 0 ||
    (stats.shrunkenChildComponents?.length || 0) > 0 ||
    outlinedStyleMismatchEntries.length > 0 ||
    visualSanityDetails.visualSanityTooLow
  ) {
    throw Object.assign(new Error("codex_cli_image_layout_understructured"), {
      code: "codex_cli_image_layout_understructured",
      details
    });
  }
  return details;
}

function resolveBuildQualityRoot(buildResult = {}) {
  if (buildResult?.plan?.root && typeof buildResult.plan.root === "object") {
    return buildResult.plan.root;
  }
  if (buildResult?.root && typeof buildResult.root === "object") {
    return buildResult.root;
  }
  if (buildResult?.helper || buildResult?.children || buildResult?.characters || buildResult?.label) {
    return buildResult;
  }
  return null;
}

export function validateGeneratedImageBuildQuality({
  roleMap = [],
  semanticQuality = null,
  buildResult = {}
} = {}) {
  const root = resolveBuildQualityRoot(buildResult);
  if (!root) {
    return {
      ok: true,
      skipped: true,
      reason: "missing_build_root",
      postBuildQualityTooLow: false
    };
  }

  const stats = collectImageLayoutTreeQuality(root);
  const roleLabels = (Array.isArray(roleMap) ? roleMap : []).flatMap((entry) => getVisibleTextLabelsForRole(entry));
  const visibleLabelSet = new Set(roleLabels.map(normalizeComparableText).filter(Boolean));
  const buildTexts = stats.texts.map(normalizeString).filter(Boolean);
  const buildComparableTexts = buildTexts.map(normalizeComparableText).filter(Boolean);
  const coveredLabels = roleLabels.filter((label) => {
    return buildComparableTexts.some((text) => isImageLayoutLabelCoveredByText(label, text));
  });
  const missingRoleLabels = roleLabels.filter((label) => !coveredLabels.includes(label));
  const roleEntriesWithBbox = (Array.isArray(roleMap) ? roleMap : []).filter((entry) => {
    return getVisibleTextLabelsForRole(entry).length > 0 && normalizeImageRoleBBox(entry);
  });
  const bboxAlignedRoleEntries = roleEntriesWithBbox.filter((entry) => {
    return stats.positionedTexts.some((item) => isRoleBBoxCoveredByPositionedText(entry, item));
  });
  const bboxMisalignedRoleLabels = roleEntriesWithBbox
    .filter((entry) => !bboxAlignedRoleEntries.includes(entry))
    .flatMap((entry) => getVisibleTextLabelsForRole(entry))
    .filter(Boolean);
  const visualRoleEntries = (Array.isArray(roleMap) ? roleMap : []).filter(isPostBuildVisualRoleCoverageRequired);
  const visualRoleCoveredEntries = visualRoleEntries.filter((entry) => {
    return stats.positionedComponents.some((component) => isRoleBBoxCoveredByPositionedComponent(entry, component));
  });
  const missingVisualRoleLabels = visualRoleEntries
    .filter((entry) => !visualRoleCoveredEntries.includes(entry))
    .map(getVisualRoleLabel)
    .filter(Boolean);
  const visualSanity = buildImageLayoutVisualSanityDetails(stats, roleLabels);
  const unobservedVisibleTexts = buildTexts.filter((text) => {
    const comparable = normalizeComparableText(text);
    if (!comparable || !isVisibleRoleLabel(text)) {
      return false;
    }
    return !Array.from(visibleLabelSet).some((label) => {
      return isImageLayoutLabelCoveredByText(label, comparable) || isImageLayoutLabelCoveredByText(comparable, label);
    });
  });
  const unobservedProgressLabels = unobservedVisibleTexts.filter((text) => /^\d{1,3}%$/u.test(normalizeString(text)));
  const iconFallbackTexts = buildTexts.filter((text) => isIconFallbackWord(text));
  const requiredCoveredRoleLabelCount = Math.max(
    roleLabels.length,
    typeof semanticQuality?.coveredRoleLabelCount === "number" ? semanticQuality.coveredRoleLabelCount : 0,
    typeof semanticQuality?.requiredCoveredRoleLabelCount === "number"
      ? semanticQuality.requiredCoveredRoleLabelCount
      : 0
  );
  const requiredBboxAlignedRoleLabelCount =
    typeof semanticQuality?.requiredBboxAlignedRoleLabelCount === "number"
      ? semanticQuality.requiredBboxAlignedRoleLabelCount
      : roleEntriesWithBbox.length >= 3
        ? Math.max(2, Math.ceil(roleEntriesWithBbox.length * 0.6))
        : 0;
  const requiredVisualRoleCount =
    typeof semanticQuality?.requiredVisualRoleCount === "number"
      ? semanticQuality.requiredVisualRoleCount
      : visualRoleEntries.length;
  const postBuildTextCoverageTooLow = coveredLabels.length < requiredCoveredRoleLabelCount;
  const postBuildBboxAlignmentTooLow =
    bboxAlignedRoleEntries.length < requiredBboxAlignedRoleLabelCount;
  const postBuildVisualRoleCoverageTooLow =
    visualRoleCoveredEntries.length < requiredVisualRoleCount;
  const postBuildQualityTooLow =
    postBuildTextCoverageTooLow ||
    postBuildBboxAlignmentTooLow ||
    postBuildVisualRoleCoverageTooLow ||
    visualSanity.visualSanityTooLow ||
    unobservedProgressLabels.length > 0 ||
    iconFallbackTexts.length > 0;

  return {
    ok: !postBuildQualityTooLow,
    postBuildQualityTooLow,
    generatedNodeCount: stats.nodes,
    coordinateNodeCount: stats.coordinateNodes,
    visibleRoleLabelCount: roleLabels.length,
    coveredRoleLabelCount: coveredLabels.length,
    missingRoleLabels: missingRoleLabels.slice(0, 12),
    requiredCoveredRoleLabelCount,
    bboxRoleLabelCount: roleEntriesWithBbox.length,
    bboxAlignedRoleLabelCount: bboxAlignedRoleEntries.length,
    bboxMisalignedRoleLabels: bboxMisalignedRoleLabels.slice(0, 12),
    requiredBboxAlignedRoleLabelCount,
    visualRoleCount: visualRoleEntries.length,
    visualRoleCoveredCount: visualRoleCoveredEntries.length,
    missingVisualRoleLabels: missingVisualRoleLabels.slice(0, 12),
    requiredVisualRoleCount,
    postBuildTextCoverageTooLow,
    postBuildBboxAlignmentTooLow,
    postBuildVisualRoleCoverageTooLow,
    unobservedVisibleTextCount: unobservedVisibleTexts.length,
    unobservedVisibleTexts: unobservedVisibleTexts.slice(0, 16),
    unobservedProgressLabelCount: unobservedProgressLabels.length,
    unobservedProgressLabels: unobservedProgressLabels.slice(0, 8),
    iconFallbackTextCount: iconFallbackTexts.length,
    iconFallbackTexts: iconFallbackTexts.slice(0, 8),
    ...visualSanity
  };
}

function getBaselineImageLayoutQuality(figmaContext = {}) {
  const direct = figmaContext?.generatedScreen?.semanticQuality;
  if (direct && typeof direct === "object" && !Array.isArray(direct)) {
    return direct;
  }
  const nested = figmaContext?.latestGeneratedScreen?.semanticQuality;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return nested;
  }
  return null;
}

function getQualityNumber(value, key, fallback = 0) {
  const number = Number(value?.[key]);
  return Number.isFinite(number) ? number : fallback;
}

function assertImageCandidateDoesNotRegress(candidateQuality = {}, baselineQuality = null) {
  if (!baselineQuality || !candidateQuality) {
    return;
  }
  const baselineCovered = getQualityNumber(baselineQuality, "coveredRoleLabelCount");
  const candidateCovered = getQualityNumber(candidateQuality, "coveredRoleLabelCount");
  const baselineMissing = Array.isArray(baselineQuality.missingRoleLabels)
    ? baselineQuality.missingRoleLabels.length
    : Math.max(0, getQualityNumber(baselineQuality, "visibleRoleLabelCount") - baselineCovered);
  const candidateMissing = Array.isArray(candidateQuality.missingRoleLabels)
    ? candidateQuality.missingRoleLabels.length
    : Math.max(0, getQualityNumber(candidateQuality, "visibleRoleLabelCount") - candidateCovered);
  const baselineVisual = getQualityNumber(baselineQuality, "visualSanityIssueCount");
  const candidateVisual = getQualityNumber(candidateQuality, "visualSanityIssueCount");
  const baselineOverlap = getQualityNumber(baselineQuality, "textOverlapCount");
  const candidateOverlap = getQualityNumber(candidateQuality, "textOverlapCount");
  const regressed =
    candidateCovered < baselineCovered ||
    candidateMissing > baselineMissing ||
    candidateVisual > baselineVisual ||
    candidateOverlap > baselineOverlap;
  if (!regressed) {
    return;
  }
  throw Object.assign(new Error("codex_cli_image_layout_understructured"), {
    code: "codex_cli_image_layout_understructured",
    details: {
      ...candidateQuality,
      candidateQualityRegressed: true,
      baselineCoveredRoleLabelCount: baselineCovered,
      baselineMissingRoleLabelCount: baselineMissing,
      baselineVisualSanityIssueCount: baselineVisual,
      baselineTextOverlapCount: baselineOverlap,
      candidateVisualSanityIssueCount: candidateVisual,
      candidateTextOverlapCount: candidateOverlap
    }
  });
}

function normalizeInspectSelectionResult(result = {}) {
  const details = Array.isArray(result.details)
    ? result.details.map((item) => normalizeString(item)).filter(Boolean)
    : [];
  return {
    intent: normalizeString(result.intent) || "inspect_selection",
    summary: normalizeString(result.summary),
    details,
    followUp: normalizeString(result.followUp)
  };
}

function validateInspectSelectionResult(result = {}) {
  if (!result.summary) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  if (!Array.isArray(result.details)) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  return result;
}

export function shouldUseCodexCliForInspect(env = process.env) {
  const explicit = normalizeString(env.XBRIDGE_CODEX_CLI_ENABLED);
  if (explicit) {
    return parseBoolean(explicit);
  }
  return true;
}

export function shouldUseCodexCliForWrite(env = process.env) {
  const explicit = normalizeString(env.XBRIDGE_CODEX_CLI_WRITE_ENABLED);
  if (explicit) {
    return parseBoolean(explicit);
  }
  return true;
}

export function buildCodexInspectSuggestionBundle(baseBundle = {}, codexResult = {}) {
  const summary = normalizeString(codexResult.summary);
  const details = Array.isArray(codexResult.details)
    ? codexResult.details.map((item) => normalizeString(item)).filter(Boolean)
    : [];
  const followUp = normalizeString(codexResult.followUp);
  const baseFindings = Array.isArray(baseBundle.findings) ? baseBundle.findings : [];
  const baseRecommendations = Array.isArray(baseBundle.recommendations)
    ? baseBundle.recommendations
    : [];
  const codexRecommendation = followUp
    ? {
        id: "rec-codex-inspect-followup",
        title: followUp,
        reason: "현재 선택을 기준으로 다음 확인 단계를 제안했습니다.",
        actionType: "analysis_only"
      }
    : null;

  return {
    ...baseBundle,
    summaryText: summary || baseBundle.summaryText,
    findings: [
      {
        id: "finding-codex-inspect",
        severity: "low",
        label: summary || "선택 구조 설명을 정리했습니다.",
        detail: details.join(" · ")
      },
      ...baseFindings
    ],
    recommendations: codexRecommendation
      ? [codexRecommendation, ...baseRecommendations]
      : baseRecommendations,
    applyActions: [],
    risks: Array.isArray(baseBundle.risks) ? baseBundle.risks : [],
    codex: {
      source: "codex_cli",
      status: "ok",
      inspect: {
        intent: normalizeString(codexResult.intent) || "inspect_selection",
        summary,
        details,
        followUp: followUp || null
      }
    }
  };
}

export async function runCodexInspectSelection(
  { request = "", contextModel = {} } = {},
  options = {}
) {
  const prompt = buildInspectSelectionPrompt({ request, contextModel });
  const parsed = await runCodexCliJsonJob(prompt, INSPECT_SELECTION_SCHEMA, {
    ...options,
    model:
      options.model ||
      options.env?.XBRIDGE_CODEX_CLI_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_MODEL ||
      ""
  });
  return validateInspectSelectionResult(normalizeInspectSelectionResult(parsed));
}

function normalizeDesignerSuggestionResult(result = {}) {
  return {
    summary: normalizeString(result.summary),
    findings: Array.isArray(result.findings)
      ? result.findings.map((item) => normalizeString(item)).filter(Boolean)
      : [],
    recommendations: Array.isArray(result.recommendations)
      ? result.recommendations.map((item) => normalizeString(item)).filter(Boolean)
      : []
  };
}

function validateDesignerSuggestionResult(result = {}) {
  if (!result.summary) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  if (!Array.isArray(result.findings) || !Array.isArray(result.recommendations)) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  return result;
}

export async function runCodexDesignerSuggestion(
  { request = "", intentKind = "", contextModel = {}, suggestionBundle = {}, pipeline = null } = {},
  options = {}
) {
  const prompt = buildDesignerSuggestionPrompt({
    request,
    intentKind,
    contextModel,
    suggestionBundle,
    pipeline
  });
  const parsed = await runCodexCliJsonJob(prompt, DESIGNER_SUGGESTION_SCHEMA, {
    ...options,
    model:
      options.model ||
      options.env?.XBRIDGE_CODEX_CLI_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_MODEL ||
      ""
  });
  const normalized = normalizeDesignerSuggestionResult(parsed);
  const validated = validateDesignerSuggestionResult(normalized);
  return {
    provider: "codex_cli",
    model:
      normalizeString(options.model) ||
      normalizeString(options.env?.XBRIDGE_CODEX_CLI_MODEL) ||
      normalizeString(process.env.XBRIDGE_CODEX_CLI_MODEL) ||
      null,
    reply: validated.summary,
    findings: validated.findings,
    recommendations: validated.recommendations
  };
}

export async function runCodexImageLayoutPlan(
  { request = "", figmaContext = {}, imagePaths = [], imageSummaries = [] } = {},
  options = {}
) {
  const imageOptions = {
    ...options,
    imagePaths,
    timeoutMs:
      options.timeoutMs ||
      options.env?.XBRIDGE_CODEX_CLI_IMAGE_TIMEOUT_MS ||
      process.env.XBRIDGE_CODEX_CLI_IMAGE_TIMEOUT_MS ||
      DEFAULT_IMAGE_LAYOUT_TIMEOUT_MS,
    model:
      options.model ||
      options.env?.XBRIDGE_CODEX_CLI_WRITE_MODEL ||
      options.env?.XBRIDGE_CODEX_CLI_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_WRITE_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_MODEL ||
      ""
  };
  const analysisOnly = options.imageAnalysisOnly === true;
  const maxAttempts =
    analysisOnly ||
    options.imageQualityRetry === false ||
    options.env?.XBRIDGE_CODEX_CLI_IMAGE_QUALITY_RETRY === "0" ||
    process.env.XBRIDGE_CODEX_CLI_IMAGE_QUALITY_RETRY === "0"
      ? 1
      : 2;
  let validated = null;
  let qualityRetry = null;
  let qualityFeedback = null;
  const baselineQuality = getBaselineImageLayoutQuality(figmaContext);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const prompt = buildImageLayoutPrompt({
      request,
      figmaContext,
      imageSummaries,
      qualityFeedback
    });
    const parsed = await runCodexCliJsonJob(prompt, IMAGE_LAYOUT_SCHEMA, imageOptions);
    const normalized = normalizeImageLayoutResult(parsed);
    try {
      validated = validateImageLayoutResult(normalized);
      assertImageCandidateDoesNotRegress(validated.semanticQuality, baselineQuality);
      validated = applyValidatedImageLayoutRepairs(validated);
      if (attempt > 1) {
        qualityRetry = {
          attempted: true,
          attempts: attempt,
          recovered: true,
          firstFailureDetails: qualityFeedback
        };
      }
      break;
    } catch (error) {
      if (analysisOnly && error?.code === "codex_cli_image_layout_understructured") {
        validated = {
          ...normalized,
          semanticQuality: error.details || null,
          semanticQualityPassed: false
        };
        qualityRetry = null;
        break;
      }
      if (error?.code === "codex_cli_image_layout_understructured") {
        const firstFailureDetails = error.details || null;
        try {
          const repaired = validateDeterministicImageLayoutRepair(normalized, firstFailureDetails, baselineQuality);
          if (repaired) {
            validated = repaired;
            qualityRetry = {
              attempted: true,
              attempts: attempt,
              recovered: true,
              deterministicRepair: true,
              firstFailureDetails
            };
            break;
          }
        } catch {
          // If deterministic repair cannot satisfy the quality gate, fall through to the normal retry/failure path.
        }
      }
      if (error?.code !== "codex_cli_image_layout_understructured" || attempt >= maxAttempts) {
        if (qualityRetry && error && typeof error === "object") {
          error.details = {
            ...(error.details || {}),
            retry: qualityRetry
          };
        }
        throw error;
      }
      qualityFeedback = error.details || null;
      qualityRetry = {
        attempted: true,
        attempts: attempt + 1,
        recovered: false,
        firstFailureDetails: qualityFeedback
      };
    }
  }
  return {
    provider: "codex_cli",
    model:
      normalizeString(options.model) ||
      normalizeString(options.env?.XBRIDGE_CODEX_CLI_WRITE_MODEL) ||
      normalizeString(options.env?.XBRIDGE_CODEX_CLI_MODEL) ||
      normalizeString(process.env.XBRIDGE_CODEX_CLI_WRITE_MODEL) ||
      normalizeString(process.env.XBRIDGE_CODEX_CLI_MODEL) ||
      null,
    summary: validated.summary,
    canvasSpec: validated.canvasSpec,
    layoutMap: validated.layoutMap,
    roleMap: validated.roleMap,
    textStyleMap: validated.textStyleMap,
    semanticQuality: validated.semanticQuality || null,
    semanticQualityPassed: validated.semanticQualityPassed !== false,
    tree: validated.tree,
    qualityRetry,
    analysisOnly
  };
}

function buildTextRewritePrompt({ message = "", figmaContext = {}, textNodes = [] } = {}) {
  const payload = {
    request: normalizeString(message),
    figmaContext: figmaContext && typeof figmaContext === "object" ? figmaContext : {},
    textNodes: (Array.isArray(textNodes) ? textNodes : []).map((node) => ({
      id: normalizeString(node?.id),
      name: normalizeString(node?.name),
      text: normalizeString(node?.characters || node?.text)
    }))
  };

  return [
    "당신은 Xbridge의 Figma 텍스트 수정 초안 백엔드 작업자입니다.",
    "직접 캔버스를 수정하지 마세요.",
    "제공된 textNodes만 수정 대상으로 사용하세요.",
    "각 update의 id는 반드시 입력 textNodes의 id와 정확히 일치해야 합니다.",
    "최종 출력은 주어진 JSON Schema에 맞는 JSON 하나만 반환하세요.",
    "",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

function normalizeTextRewriteResult(result = {}) {
  const updates = Array.isArray(result.updates)
    ? result.updates
        .map((entry) => ({
          id: normalizeString(entry?.id),
          text: normalizeString(entry?.text)
        }))
        .filter((entry) => entry.id && entry.text)
    : [];
  return {
    summary: normalizeString(result.summary),
    updates
  };
}

function validateTextRewriteResult(result = {}, knownNodeIds = []) {
  if (!result.summary) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  if (!Array.isArray(result.updates) || result.updates.length === 0) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  const allowedIds = new Set((Array.isArray(knownNodeIds) ? knownNodeIds : []).map((value) => normalizeString(value)));
  const validUpdates = result.updates.filter((entry) => allowedIds.has(entry.id));
  if (allowedIds.size > 0 && validUpdates.length === 0) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  return {
    ...result,
    updates: validUpdates
  };
}

export async function runCodexTextRewritePreview(
  { message = "", figmaContext = {}, textNodes = [] } = {},
  options = {}
) {
  const prompt = buildTextRewritePrompt({ message, figmaContext, textNodes });
  const parsed = await runCodexCliJsonJob(prompt, TEXT_REWRITE_SCHEMA, {
    ...options,
    model:
      options.model ||
      options.env?.XBRIDGE_CODEX_CLI_WRITE_MODEL ||
      options.env?.XBRIDGE_CODEX_CLI_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_WRITE_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_MODEL ||
      ""
  });
  const normalized = normalizeTextRewriteResult(parsed);
  const validated = validateTextRewriteResult(
    normalized,
    (Array.isArray(textNodes) ? textNodes : []).map((node) => node?.id)
  );
  return {
    provider: "codex_cli",
    model:
      normalizeString(options.model) ||
      normalizeString(options.env?.XBRIDGE_CODEX_CLI_WRITE_MODEL) ||
      normalizeString(options.env?.XBRIDGE_CODEX_CLI_MODEL) ||
      normalizeString(process.env.XBRIDGE_CODEX_CLI_WRITE_MODEL) ||
      normalizeString(process.env.XBRIDGE_CODEX_CLI_MODEL) ||
      null,
    reply: validated.summary,
    updates: validated.updates
  };
}

function buildVariantUpdatePrompt({ message = "", figmaContext = {}, variantDetail = {} } = {}) {
  const normalizedVariantDetail =
    variantDetail?.detail && typeof variantDetail.detail === "object"
      ? variantDetail.detail
      : variantDetail && typeof variantDetail === "object"
        ? variantDetail
        : {};
  const payload = {
    request: normalizeString(message),
    figmaContext: figmaContext && typeof figmaContext === "object" ? figmaContext : {},
    variantDetail: normalizedVariantDetail
  };

  return [
    "당신은 Xbridge의 Figma variant 변경 초안 백엔드 작업자입니다.",
    "직접 캔버스를 수정하지 마세요.",
    "componentNodeId는 제공된 target component id와 정확히 일치해야 합니다.",
    "variantProperties는 현재 바꿀 필요가 있는 속성만 포함하세요.",
    "제공된 component set과 variant 정보에 없는 사실은 추정하지 마세요.",
    "최종 출력은 주어진 JSON Schema에 맞는 JSON 하나만 반환하세요.",
    "",
    JSON.stringify(payload, null, 2)
  ].join("\n");
}

function normalizeVariantUpdateResult(result = {}) {
  const variantProperties =
    result?.variantProperties && typeof result.variantProperties === "object" && !Array.isArray(result.variantProperties)
      ? Object.fromEntries(
          Object.entries(result.variantProperties)
            .map(([key, value]) => [normalizeString(key), normalizeString(value)])
            .filter(([key, value]) => key && value)
        )
      : {};
  return {
    summary: normalizeString(result.summary),
    componentNodeId: normalizeString(result.componentNodeId),
    variantProperties
  };
}

function validateVariantUpdateResult(result = {}, expectedComponentNodeId = "", knownVariantPropertyNames = []) {
  if (!result.summary || !result.componentNodeId) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  if (normalizeString(expectedComponentNodeId) && result.componentNodeId !== normalizeString(expectedComponentNodeId)) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  const entries = Object.entries(result.variantProperties || {});
  if (entries.length === 0) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  const allowedNames = new Set((Array.isArray(knownVariantPropertyNames) ? knownVariantPropertyNames : []).map((value) => normalizeString(value)));
  if (allowedNames.size > 0 && entries.some(([key]) => !allowedNames.has(normalizeString(key)))) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  return result;
}

export async function runCodexVariantUpdatePreview(
  { message = "", figmaContext = {}, variantDetail = {} } = {},
  options = {}
) {
  const normalizedVariantDetail =
    variantDetail?.detail && typeof variantDetail.detail === "object"
      ? variantDetail.detail
      : variantDetail && typeof variantDetail === "object"
        ? variantDetail
        : {};
  const prompt = buildVariantUpdatePrompt({ message, figmaContext, variantDetail });
  const parsed = await runCodexCliJsonJob(prompt, VARIANT_UPDATE_SCHEMA, {
    ...options,
    model:
      options.model ||
      options.env?.XBRIDGE_CODEX_CLI_WRITE_MODEL ||
      options.env?.XBRIDGE_CODEX_CLI_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_WRITE_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_MODEL ||
      ""
  });
  const normalized = normalizeVariantUpdateResult(parsed);
  const currentVariantProperties =
    normalizedVariantDetail?.targetNode?.variantProperties &&
    typeof normalizedVariantDetail.targetNode.variantProperties === "object"
      ? normalizedVariantDetail.targetNode.variantProperties
      : normalizedVariantDetail?.variantProperties && typeof normalizedVariantDetail.variantProperties === "object"
        ? normalizedVariantDetail.variantProperties
        : {};
  const validated = validateVariantUpdateResult(
    normalized,
    normalizedVariantDetail?.targetNode?.id ||
      normalizedVariantDetail?.node?.id ||
      normalizedVariantDetail?.componentNodeId ||
      "",
    Object.keys(currentVariantProperties)
  );
  return {
    provider: "codex_cli",
    model:
      normalizeString(options.model) ||
      normalizeString(options.env?.XBRIDGE_CODEX_CLI_WRITE_MODEL) ||
      normalizeString(options.env?.XBRIDGE_CODEX_CLI_MODEL) ||
      normalizeString(process.env.XBRIDGE_CODEX_CLI_WRITE_MODEL) ||
      normalizeString(process.env.XBRIDGE_CODEX_CLI_MODEL) ||
      null,
    reply: validated.summary,
    componentNodeId: validated.componentNodeId,
    variantProperties: validated.variantProperties
  };
}
