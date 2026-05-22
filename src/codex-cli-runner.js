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
  suggestionBundle = {}
} = {}) {
  const payload = {
    request: normalizeString(request),
    intentKind: normalizeString(intentKind) || "analyze",
    contextModel: sanitizeContextForPrompt(contextModel),
    evidence: {
      summaryText: normalizeString(suggestionBundle?.summaryText),
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
    "제공된 request, contextModel, evidence만 근거로 설명하세요.",
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

function buildImageLayoutPrompt({ request = "", figmaContext = {}, imageSummaries = [] } = {}) {
  const payload = {
    request: normalizeString(request),
    figmaContext: figmaContext && typeof figmaContext === "object" ? figmaContext : {},
    images: (Array.isArray(imageSummaries) ? imageSummaries : []).map((item) => ({
      name: normalizeString(item?.name || item?.title),
      mimeType: normalizeString(item?.mimeType),
      size: normalizeString(item?.sizeLabel || item?.size)
    }))
  };

  return [
    "당신은 Xbridge의 이미지 기반 Figma 화면 생성 플래너입니다.",
    "첨부 이미지를 시각적으로 분석해 Figma build_layout helper schema로 재현 가능한 화면 tree를 만드세요.",
    "실제 이미지에 보이는 구조, 텍스트, 색상, 간격, 계층만 반영하고 확실하지 않은 내용은 단순화하세요.",
    "tree는 screen helper를 루트로 사용하세요. 앱/웹 표면을 먼저 판단하고 표준 캔버스 규격을 적용하세요.",
    "canvasSpecJson에는 { surfaceType, platform, width, height, gridUnit, margin, columns, gutter, safeArea } 객체를 JSON.stringify 해서 넣으세요.",
    "canvasSpecJson 규칙: mobile app은 width 390 전후/height 844 전후/4 columns/margin x 24/gutter 16, tablet은 768x1024/8 columns/margin x 32/gutter 24, desktop web은 1440x1024/12 columns/margin x 80/gutter 24를 기본으로 하세요.",
    "고정 크기와 여백은 4px 그리드에 맞추세요. 단, divider/hairline 1px와 부모 너비를 gap으로 나눠 fill 하는 경우의 계산값은 예외로 둘 수 있습니다.",
    "사용 가능한 helper 예: screen, row, column, card, section, list, list-item, media-row, status-chip, progress-bar, tabbar, toolbar, text, divider.",
    "먼저 보이는 요소를 UI 역할로 분류하고 roleMapJson에 JSON.stringify 한 배열로 넣으세요.",
    "roleMapJson 각 항목은 { id, role, label, strategy, bbox } 형태로 작성하세요. role 예: system-status-bar, header-nav, chip, button, tab, statistic-card, progress-bar, list-row, avatar, hero-artwork, reward-bar.",
    "layoutMapJson에는 그룹핑/정렬/크기 전략을 JSON.stringify 한 배열로 넣으세요. 각 항목은 { id, targetName, parentId, role, direction, align, justify, gap, padding, sizing, strategy } 형태로 작성하세요.",
    "그룹핑은 화면에서 가까이 묶인 정보 단위를 기준으로 판단하세요. 좌표가 중요한 장식/이미지/히어로는 layout none + fixed, 반복 행/리스트/툴바/칩은 row/column + hug/fill을 사용하세요.",
    "textStyleMapJson에는 텍스트 역할을 JSON.stringify 한 배열로 넣으세요. 각 항목은 { id, targetName, role, text, fontSize, fontStyle, lineHeight, align, color } 형태로 작성하세요.",
    "텍스트는 라벨, 캡션, 본문, 수치, 섹션 제목, 화면 제목, 버튼 라벨인지 판단하고 크기/두께/행간을 지정하세요.",
    "아바타, 아이콘 버튼, 체크박스, 라디오, dot, swatch, 정사각 썸네일처럼 1:1 비율이어야 하는 요소는 width와 height를 같은 값으로 지정하세요.",
    "역할별 helper를 고르세요: chip/pill/badge/button은 status-chip, system-status-bar는 좌표 row/text 아이콘, header/nav는 toolbar 또는 좌표 row, tab 묶음은 tabbar, progress는 progress-bar, 반복 결과 행은 list/list-item 또는 좌표 row를 사용하세요.",
    "원본에 없는 placeholder 텍스트를 만들지 마세요. 특히 \"Status\", \"Label\", \"Button\", \"New text\" 같은 기본 문구는 화면에 보이지 않으면 절대 넣지 마세요.",
    "스크린샷을 비슷하게 재현할 때는 루트 screen에 layout: \"none\"을 쓰고, 주요 요소마다 x, y, width, height를 대략 지정하세요.",
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
  return {
    id: normalizeString(entry.id) || `role-${index + 1}`,
    role: normalizeString(entry.role || entry.type || entry.kind) || "unknown",
    label: normalizeString(entry.label || entry.text || entry.title),
    strategy: normalizeString(entry.strategy),
    bbox
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
    const label = normalizeString(entry?.label);
    if (label) {
      observed.add(label.toLowerCase());
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
      textStyleMap: []
    };
  }
  if (!optionsOrRoleMap || typeof optionsOrRoleMap !== "object") {
    return {
      roleMap: [],
      canvasSpec: null,
      layoutMap: [],
      textStyleMap: []
    };
  }
  return {
    roleMap: Array.isArray(optionsOrRoleMap.roleMap) ? optionsOrRoleMap.roleMap : [],
    canvasSpec: optionsOrRoleMap.canvasSpec || null,
    layoutMap: Array.isArray(optionsOrRoleMap.layoutMap) ? optionsOrRoleMap.layoutMap : [],
    textStyleMap: Array.isArray(optionsOrRoleMap.textStyleMap) ? optionsOrRoleMap.textStyleMap : []
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
  if (coerced.children.length === 0) {
    const fallbackText = normalizeString(node.name);
    if (fallbackText && !/^(row|column|card|section|container|group)$/iu.test(fallbackText)) {
      coerced.children = [createImageLayoutTextNode(fallbackText, "meta")];
    }
  }
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
          child.y = Math.max(0, Math.min(y, Math.max(0, parentHeight - 1)));
          if (typeof child.height === "number" && Number.isFinite(child.height)) {
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
    tree: tree ? coerceImageLayoutTree(tree, { roleMap, canvasSpec, layoutMap, textStyleMap }) : null
  };
}

function validateImageLayoutResult(result = {}) {
  if (!result.summary || !result.tree) {
    throw Object.assign(new Error("codex_cli_invalid_output"), {
      code: "codex_cli_invalid_output"
    });
  }
  return result;
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
  { request = "", intentKind = "", contextModel = {}, suggestionBundle = {} } = {},
  options = {}
) {
  const prompt = buildDesignerSuggestionPrompt({
    request,
    intentKind,
    contextModel,
    suggestionBundle
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
  const prompt = buildImageLayoutPrompt({ request, figmaContext, imageSummaries });
  const parsed = await runCodexCliJsonJob(prompt, IMAGE_LAYOUT_SCHEMA, {
    ...options,
    imagePaths,
    timeoutMs:
      options.timeoutMs ||
      options.env?.XBRIDGE_CODEX_CLI_IMAGE_TIMEOUT_MS ||
      process.env.XBRIDGE_CODEX_CLI_IMAGE_TIMEOUT_MS ||
      90000,
    model:
      options.model ||
      options.env?.XBRIDGE_CODEX_CLI_WRITE_MODEL ||
      options.env?.XBRIDGE_CODEX_CLI_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_WRITE_MODEL ||
      process.env.XBRIDGE_CODEX_CLI_MODEL ||
      ""
  });
  const validated = validateImageLayoutResult(normalizeImageLayoutResult(parsed));
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
    tree: validated.tree
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
