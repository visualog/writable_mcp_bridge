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

function buildCodexCliInvocationOptions(options = {}) {
  const env = options.env || process.env;
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || env.XBRIDGE_CODEX_CLI_TIMEOUT_MS || 45000));
  const bin = normalizeString(
    options.bin || env.XBRIDGE_CODEX_CLI_BIN || "/Applications/Codex.app/Contents/Resources/codex"
  );
  const entrypoint = normalizeString(options.entrypoint || env.XBRIDGE_CODEX_CLI_ENTRYPOINT || "");
  const model = normalizeString(options.model || "");
  const cwd = options.cwd || process.cwd();
  return {
    env,
    timeoutMs,
    bin,
    entrypoint,
    model,
    cwd
  };
}

async function runCodexCliJsonJob(prompt, schema, options = {}) {
  const { env, timeoutMs, bin, entrypoint, model, cwd } = buildCodexCliInvocationOptions(options);

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
