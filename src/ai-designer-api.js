import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_MODEL = "nvidia/nemotron-3-nano-30b-a3b";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434/v1";
const DEFAULT_OLLAMA_MODEL = "llama3.2:3b";
const DEFAULT_LMSTUDIO_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_LMSTUDIO_MODEL = "local-model";
const DEFAULT_CUSTOM_BASE_URL = "http://127.0.0.1:1234/v1";
const DEFAULT_CUSTOM_MODEL = "local-model";
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_NEMOTRON_SYSTEM_PROMPT_PATH = path.resolve(
  MODULE_DIR,
  "../prompts/nemotron-system-prompt.txt"
);

function normalizeString(value) {
  return String(value || "").trim();
}

function sanitizeKoreanUiText(value) {
  const text = normalizeString(value);
  if (!text) {
    return "";
  }

  return text
    .replace(/^\/think.*$/gimu, "")
    .replace(/\bhi[\s-]?fi\b/giu, "하이파이")
    .replace(/\bwire[\s-]?frame\b/giu, "와이어프레임")
    .replace(/\bdashboard\b/giu, "대시보드")
    .replace(/\bonboarding\b/giu, "온보딩")
    .replace(/와이어\s*프레임/gu, "와이어프레임")
    .replace(/하이\s*파이/gu, "하이파이")
    .replace(/히피\s*디자인/gu, "하이파이 디자인")
    .replace(/히피/gu, "하이파이")
    .replace(/來由/gu, "유래")
    .replace(/由來/gu, "유래")
    .replace(/出處/gu, "출처")
    .replace(/確認/gu, "확인")
    .replace(/整理/gu, "정리")
    .replace(/適用/gu, "적용")
    .replace(/構造/gu, "구조")
    .replace(/어느 텍스트에서 유래한지/gu, "어느 텍스트에서 왔는지")
    .replace(/텍스트에서 유래한지/gu, "어느 텍스트에서 왔는지")
    .replace(/텍스트에서 출처한지/gu, "어느 텍스트에서 왔는지")
    .replace(/어느 어느 텍스트에서 왔는지/gu, "어느 텍스트에서 왔는지")
    .replace(/([가-힣])한지 확인해 주세요\./gu, "$1는지 확인해 주세요.")
    .replace(/\s+/gu, " ")
    .trim();
}

function translateUiTerm(term) {
  const normalized = normalizeString(term).toLowerCase();
  const dictionary = new Map([
    ["dashboard", "대시보드"],
    ["analytics", "분석"],
    ["messages", "메시지"],
    ["message", "메시지"],
    ["task", "작업"],
    ["add task", "작업 추가"],
    ["in progress", "진행 중"],
    ["wireframing", "와이어프레임"],
    ["onboarding", "온보딩"],
    ["login", "로그인"],
    ["log in", "로그인"],
    ["sign up", "회원가입"],
    ["home", "홈"],
    ["board", "보드"],
    ["page", "페이지"],
    ["screen", "화면"],
    ["main screen", "메인 화면"],
    ["design", "디자인"]
  ]);
  if (dictionary.has(normalized)) {
    return dictionary.get(normalized);
  }
  return sanitizeKoreanUiText(term);
}

function translateKnownUiTerm(term) {
  const normalized = normalizeString(term).toLowerCase();
  const dictionary = new Map([
    ["dashboard", "대시보드"],
    ["analytics", "분석"],
    ["messages", "메시지"],
    ["message", "메시지"],
    ["task", "작업"],
    ["add task", "작업 추가"],
    ["in progress", "진행 중"],
    ["wireframing", "와이어프레임"],
    ["onboarding", "온보딩"],
    ["login", "로그인"],
    ["log in", "로그인"],
    ["sign up", "회원가입"],
    ["home", "홈"],
    ["board", "보드"],
    ["page", "페이지"],
    ["screen", "화면"],
    ["main screen", "메인 화면"],
    ["design", "디자인"]
  ]);
  return dictionary.get(normalized) || "";
}

function deterministicTranslateUiText(value) {
  const source = normalizeString(value);
  if (!source) {
    return "";
  }
  if (/[가-힣]/u.test(source)) {
    return sanitizeKoreanUiText(source);
  }
  const directUiTermTranslation = translateKnownUiTerm(source);
  if (directUiTermTranslation) {
    return directUiTermTranslation;
  }

  let text = source;
  let match = text.match(/^Create wireframe for (.+?) page$/iu);
  if (match) {
    return `${translateUiTerm(match[1])} 페이지 와이어프레임 생성`;
  }
  match = text.match(/^Create hi[\s-]?fi design for (.+?) page$/iu);
  if (match) {
    return `${translateUiTerm(match[1])} 페이지 하이파이 디자인 생성`;
  }
  match = text.match(/^Create hi[\s-]?fi design (\d+) main screen$/iu);
  if (match) {
    return `하이파이 디자인 ${match[1]}개 메인 화면 생성`;
  }
  match = text.match(/^Create hi[\s-]?fi a design onboarding step by step$/iu);
  if (match) {
    return "온보딩 단계별 하이파이 디자인 생성";
  }
  if (/^I couldn't reach the server$/iu.test(text) || /^Could not reach the server$/iu.test(text)) {
    return "서버에 연결할 수 없습니다";
  }
  if (/^In a few minutes, try again\.?$/iu.test(text) || /^Try again in a few minutes\.?$/iu.test(text)) {
    return "잠시 후 다시 시도해 주세요.";
  }
  if (/^Cell text$/iu.test(text)) {
    return "셀 텍스트";
  }
  if (/^wireframing$/iu.test(text)) {
    return "와이어프레임";
  }

  text = text
    .replace(/Create wireframe for /giu, "")
    .replace(/Create hi[\s-]?fi design for /giu, "")
    .replace(/Create /giu, "")
    .replace(/\bwire[\s-]?frame\b/giu, "와이어프레임")
    .replace(/\bhi[\s-]?fi\b/giu, "하이파이")
    .replace(/\bDashboard\b/giu, "대시보드")
    .replace(/\bAnalytics\b/giu, "분석")
    .replace(/\bMessages\b/giu, "메시지")
    .replace(/\bOnboarding\b/giu, "온보딩")
    .replace(/\bpage\b/giu, "페이지")
    .replace(/\bscreen\b/giu, "화면")
    .replace(/\bdesign\b/giu, "디자인")
    .replace(/\bmain\b/giu, "메인")
    .replace(/\bstep by step\b/giu, "단계별")
    .replace(/\s+/gu, " ")
    .trim();
  return sanitizeKoreanUiText(text);
}

function containsKoreanText(value) {
  return /[가-힣]/u.test(normalizeString(value));
}

function containsAlphabeticText(value) {
  return /[A-Za-z]/u.test(normalizeString(value));
}

function looksMostlyEnglishText(value) {
  const text = normalizeString(value);
  if (!text) {
    return false;
  }
  const asciiWordMatches = text.match(/[A-Za-z]{2,}/g) || [];
  return asciiWordMatches.join("").length >= Math.max(6, Math.floor(text.length * 0.3));
}

function shouldReplaceWithDeterministicTranslation(sourceText, outputText) {
  const source = normalizeString(sourceText);
  const output = normalizeString(outputText);
  if (!source) {
    return false;
  }
  if (!output) {
    return true;
  }
  if (/^\/think\b/i.test(output) || /\/think/i.test(output)) {
    return true;
  }
  if (output.toLowerCase() === source.toLowerCase() && /[a-z]/iu.test(source)) {
    return true;
  }
  if (/[a-z]/iu.test(output) && !/[가-힣]/u.test(output)) {
    return true;
  }
  if (/^create\b/i.test(output) || /\bdesign\b/i.test(output)) {
    return true;
  }
  return false;
}

function applyDeterministicTranslationFallback(updates = [], textNodes = []) {
  const sourceNodes = Array.isArray(textNodes) ? textNodes : [];
  const byId = new Map(
    sourceNodes
      .map((node) => [
        normalizeString(node?.id),
        {
          id: normalizeString(node?.id),
          characters: normalizeString(node?.characters)
        }
      ])
      .filter(([id]) => id)
  );
  const updateById = new Map(
    (Array.isArray(updates) ? updates : [])
      .map((entry) => [
        normalizeString(entry?.id),
        normalizeString(entry?.text)
      ])
      .filter(([id]) => id)
  );

  return sourceNodes
    .map((node) => {
      const id = normalizeString(node?.id);
      const original = normalizeString(node?.characters);
      const textValue = updateById.get(id) || "";
      if (!id) {
        return null;
      }
      if (shouldReplaceWithDeterministicTranslation(original, textValue)) {
        return {
          id,
          text: deterministicTranslateUiText(original)
        };
      }
      return {
        id,
        text: sanitizeKoreanUiText(textValue)
      };
    })
    .filter(Boolean);
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(normalizeString(value));
}

function isSupportedProvider(provider) {
  return (
    provider === "openai" ||
    provider === "nvidia" ||
    provider === "ollama" ||
    provider === "lmstudio" ||
    provider === "custom"
  );
}

function providerRequiresApiKey(provider) {
  return provider === "openai" || provider === "nvidia";
}

function usesChatCompletions(provider) {
  return (
    provider === "nvidia" ||
    provider === "ollama" ||
    provider === "lmstudio" ||
    provider === "custom"
  );
}

function usesOllamaNativeGenerate(provider) {
  return provider === "ollama";
}

function getLocalRewriteGenerationBudget(taskKind, textNodes = []) {
  const count = Array.isArray(textNodes) ? textNodes.length : 0;
  if (taskKind === "title_generate") {
    if (count <= 1) {
      return 180;
    }
    if (count <= 3) {
      return 280;
    }
    if (count <= 5) {
      return 420;
    }
    return 560;
  }
  if (taskKind === "translate") {
    return count <= 3 ? 160 : 256;
  }
  return count <= 3 ? 220 : 360;
}

function getLocalRewriteTimeoutMs(taskKind, rewriteWorkload = {}) {
  if (taskKind === "title_generate") {
    if (rewriteWorkload.isSingleShortText) {
      return 22000;
    }
    if (rewriteWorkload.isCompactBatch) {
      return 36000;
    }
    return 45000;
  }
  if (taskKind === "translate") {
    if (rewriteWorkload.isSingleShortText) {
      return 14000;
    }
    if (rewriteWorkload.isCompactBatch) {
      return 22000;
    }
    return 30000;
  }
  if (rewriteWorkload.isSingleShortText) {
    return 14000;
  }
  if (rewriteWorkload.isCompactBatch) {
    return 22000;
  }
  return 30000;
}

function getOllamaNativeBaseUrl(baseUrl) {
  const normalized = normalizeString(baseUrl).replace(/\/+$/u, "");
  return normalized.endsWith("/v1") ? normalized.slice(0, -3) : normalized;
}

function resolveProviderDefaults(provider) {
  if (provider === "nvidia") {
    return {
      baseUrl: DEFAULT_NVIDIA_BASE_URL,
      model: DEFAULT_NVIDIA_MODEL
    };
  }
  if (provider === "ollama") {
    return {
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      model: DEFAULT_OLLAMA_MODEL
    };
  }
  if (provider === "lmstudio") {
    return {
      baseUrl: DEFAULT_LMSTUDIO_BASE_URL,
      model: DEFAULT_LMSTUDIO_MODEL
    };
  }
  if (provider === "custom") {
    return {
      baseUrl: DEFAULT_CUSTOM_BASE_URL,
      model: DEFAULT_CUSTOM_MODEL
    };
  }
  return {
    baseUrl: DEFAULT_OPENAI_BASE_URL,
    model: DEFAULT_OPENAI_MODEL
  };
}

function validateDesignerAiConfig(config = {}) {
  const issues = [];
  const provider = normalizeString(config.provider || "").toLowerCase();
  const model = normalizeString(config.model || "");
  const baseUrl = normalizeString(config.baseUrl || "");

  if (!config.configured) {
    return {
      valid: false,
      issues: ["missing_api_key"]
    };
  }

  if (!provider || !isSupportedProvider(provider)) {
    issues.push("unsupported_provider");
  }

  if (!baseUrl || !looksLikeUrl(baseUrl)) {
    issues.push("invalid_base_url");
  }

  if (!model) {
    issues.push("missing_model");
  } else if (looksLikeUrl(model)) {
    issues.push("model_looks_like_url");
  } else if (["openai", "nvidia", "ollama", "lmstudio", "custom"].includes(model)) {
    issues.push("model_looks_like_provider");
  }

  if (["openai", "nvidia", "ollama", "lmstudio", "custom"].includes(baseUrl)) {
    issues.push("base_url_looks_like_provider");
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

function buildMisconfiguredReply(configValidation = {}) {
  const issues = Array.isArray(configValidation.validationIssues)
    ? configValidation.validationIssues
    : Array.isArray(configValidation.issues)
      ? configValidation.issues
      : [];
  if (issues.includes("model_looks_like_url") || issues.includes("base_url_looks_like_provider")) {
    return "AI 설정이 잘못되었습니다. 모델명과 Base URL이 서로 뒤바뀐 것 같습니다. `set:keychain-ai`를 다시 실행해 주세요.";
  }
  if (issues.includes("missing_model")) {
    return "AI 모델명이 비어 있습니다. `set:keychain-ai`로 모델명을 다시 저장해 주세요.";
  }
  if (issues.includes("invalid_base_url")) {
    return "AI Base URL 형식이 올바르지 않습니다. `https://.../v1` 형식으로 다시 저장해 주세요.";
  }
  if (issues.includes("unsupported_provider")) {
    return "AI provider 설정이 올바르지 않습니다. 현재는 openai, nvidia, ollama, lmstudio, custom을 지원합니다.";
  }
  return "AI 설정이 완전하지 않습니다. keychain의 provider, model, base URL 값을 다시 확인해 주세요.";
}

function uniqueStrings(values = []) {
  return [...new Set(values.map((value) => normalizeString(value)).filter(Boolean))];
}

function createDiscoveryTimeoutSignal(timeoutMs = 900) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  return undefined;
}

function createAiRequestTimeoutSignal(timeoutMs = 0) {
  const normalizedTimeoutMs = Math.max(0, Number(timeoutMs) || 0);
  if (!normalizedTimeoutMs) {
    return undefined;
  }
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(normalizedTimeoutMs);
  }
  return undefined;
}

function isAbortLikeError(error) {
  const message = normalizeString(error?.message || "");
  const code = normalizeString(error?.code || "");
  return (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    code === "ABORT_ERR" ||
    code === "20" ||
    code === "23" ||
    /aborted|timed out|timeout|fetch failed/iu.test(message)
  );
}

function buildDeterministicTranslationPreviewResponse(textNodes = [], reply = "") {
  return {
    reply:
      sanitizeKoreanUiText(reply) ||
      "선택한 텍스트를 한글로 번역 적용했어요. 일부 표현은 UI 용어 규칙에 맞게 정리했습니다.",
    updates: applyDeterministicTranslationFallback([], textNodes),
    safety: {
      canApply: false,
      reason: "Preview only until the user confirms the write."
    }
  };
}

function inferRewriteTaskKind(message = "") {
  const normalized = normalizeString(message).toLowerCase();
  if (/(번역|translate|영어로|한글로|한국어로)/iu.test(normalized)) {
    return "translate";
  }
  if (/(제목|title|헤드라인)/iu.test(normalized)) {
    return "title_generate";
  }
  return "rewrite";
}

function summarizeRewriteWorkload(textNodes = []) {
  const nodes = Array.isArray(textNodes) ? textNodes : [];
  const nodeCount = nodes.length;
  const totalChars = nodes.reduce(
    (sum, node) => sum + normalizeString(node?.characters).length,
    0
  );
  return {
    nodeCount,
    totalChars,
    isSingleShortText: nodeCount === 1 && totalChars > 0 && totalChars <= 180,
    isCompactBatch: nodeCount > 0 && nodeCount <= 5 && totalChars <= 320
  };
}

function classifyRewriteFailureCode(error) {
  const explicitCode = normalizeString(error?.code || "");
  if (explicitCode === "20" || explicitCode === "23" || explicitCode === "ABORT_ERR") {
    return "model_timeout_or_abort";
  }
  if (explicitCode) {
    return explicitCode;
  }
  const message = normalizeString(error?.message || "").toLowerCase();
  if (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("fetch failed")
  ) {
    return "network_fetch_failed";
  }
  if (
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("aborted")
  ) {
    return "model_timeout_or_abort";
  }
  return "designer_ai_request_failed";
}

function buildRewriteValidationReport({
  taskKind = "rewrite",
  updates = [],
  textNodes = []
} = {}) {
  const normalizedNodes = Array.isArray(textNodes) ? textNodes : [];
  const byId = new Map(
    normalizedNodes
      .map((node) => [normalizeString(node?.id), normalizeString(node?.characters)])
      .filter(([id]) => id)
  );
  const normalizedUpdates = Array.isArray(updates)
    ? updates
        .map((entry) => ({
          id: normalizeString(entry?.id),
          text: sanitizeKoreanUiText(
            stripKnownNodeIdPrefix(normalizeString(entry?.text), normalizedNodes)
          )
        }))
        .filter((entry) => entry.id && byId.has(entry.id) && entry.text)
    : [];

  const invalidReasons = [];
  let unchangedCount = 0;
  let missingCount = 0;
  let englishOnlyCount = 0;
  let metaArtifactCount = 0;

  const validatedUpdates = normalizedNodes
    .map((node) => {
      const id = normalizeString(node?.id);
      const sourceText = normalizeString(node?.characters);
      const update = normalizedUpdates.find((entry) => entry.id === id);
      if (!update) {
        missingCount += 1;
        return null;
      }
      const translatedText = normalizeString(update.text);
      if (
        /^\/think\b/iu.test(translatedText) ||
        /^```/u.test(translatedText) ||
        /^[-*]\s/u.test(translatedText) ||
        /^\d+\.\s/u.test(translatedText) ||
        translatedText.includes("REQUEST\t")
      ) {
        metaArtifactCount += 1;
        return null;
      }
      if (taskKind === "translate") {
        if (translatedText.toLowerCase() === sourceText.toLowerCase()) {
          unchangedCount += 1;
          return null;
        }
        if (looksMostlyEnglishText(sourceText) && !containsKoreanText(translatedText)) {
          englishOnlyCount += 1;
          return null;
        }
      } else if (
        (taskKind === "title_generate" || taskKind === "rewrite") &&
        translatedText.toLowerCase() === sourceText.toLowerCase()
      ) {
        unchangedCount += 1;
      }
      return {
        id,
        text: translatedText
      };
    })
    .filter(Boolean);

  if (missingCount > 0) {
    invalidReasons.push("missing_updates");
  }
  if (metaArtifactCount > 0) {
    invalidReasons.push("meta_artifact");
  }
  if (taskKind === "translate") {
    if (unchangedCount > 0) {
      invalidReasons.push("unchanged_translation");
    }
    if (englishOnlyCount > 0) {
      invalidReasons.push("english_only_translation");
    }
  } else if (
    (taskKind === "title_generate" || taskKind === "rewrite") &&
    normalizedNodes.length > 0 &&
    unchangedCount === normalizedNodes.length
  ) {
    invalidReasons.push("unchanged_rewrite");
  }

  const valid =
    validatedUpdates.length === normalizedNodes.length &&
    invalidReasons.length === 0 &&
    validatedUpdates.every((entry) => normalizeString(entry.text));

  return {
    taskKind,
    valid,
    updates: validatedUpdates,
    invalidReasons,
    missingCount,
    unchangedCount,
    englishOnlyCount,
    metaArtifactCount,
    sourceCount: normalizedNodes.length,
    updateCount: validatedUpdates.length
  };
}

function extractLocalProviderModels(provider, payload = {}) {
  if (provider === "ollama") {
    return uniqueStrings(
      Array.isArray(payload?.models) ? payload.models.map((entry) => entry?.name) : []
    );
  }
  if (provider === "lmstudio") {
    return uniqueStrings(
      Array.isArray(payload?.data) ? payload.data.map((entry) => entry?.id) : []
    );
  }
  return [];
}

export async function discoverLocalDesignerProviders(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required for local AI discovery");
  }

  const definitions = [
    {
      provider: "ollama",
      label: "Ollama",
      discoverUrl: "http://127.0.0.1:11434/api/tags",
      baseUrl: DEFAULT_OLLAMA_BASE_URL,
      defaultModel: DEFAULT_OLLAMA_MODEL
    },
    {
      provider: "lmstudio",
      label: "LM Studio",
      discoverUrl: "http://127.0.0.1:1234/v1/models",
      baseUrl: DEFAULT_LMSTUDIO_BASE_URL,
      defaultModel: DEFAULT_LMSTUDIO_MODEL
    }
  ];

  const results = await Promise.all(
    definitions.map(async (definition) => {
      try {
        const response = await fetchImpl(definition.discoverUrl, {
          method: "GET",
          signal: createDiscoveryTimeoutSignal(options.timeoutMs)
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = await response.json().catch(() => ({}));
        const models = extractLocalProviderModels(definition.provider, payload);
        return {
          provider: definition.provider,
          label: definition.label,
          available: true,
          baseUrl: definition.baseUrl,
          models: models.length > 0 ? models : [definition.defaultModel]
        };
      } catch (error) {
        return {
          provider: definition.provider,
          label: definition.label,
          available: false,
          baseUrl: definition.baseUrl,
          models: [],
          error: normalizeString(error?.message || "unavailable")
        };
      }
    })
  );

  return {
    discoveredAt: new Date().toISOString(),
    providers: results
  };
}

function safeJsonParse(text) {
  if (!text || typeof text !== "string") {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function extractResponseText(payload = {}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output) ? payload.output : [];
  const texts = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      if (part?.type === "output_text" && typeof part.text === "string") {
        texts.push(part.text);
      }
      if (part?.type === "text" && typeof part.text === "string") {
        texts.push(part.text);
      }
    }
  }

  return texts.join("\n").trim();
}

function extractChatCompletionText(payload = {}) {
  const choices = Array.isArray(payload.choices) ? payload.choices : [];
  const firstChoice = choices[0] || null;
  const message = firstChoice?.message;
  if (typeof message?.content === "string" && message.content.trim()) {
    return message.content.trim();
  }

  if (Array.isArray(message?.content)) {
    const texts = [];
    for (const part of message.content) {
      if (typeof part?.text === "string" && part.text.trim()) {
        texts.push(part.text.trim());
      }
      if (typeof part?.content === "string" && part.content.trim()) {
        texts.push(part.content.trim());
      }
    }
    return texts.join("\n").trim();
  }

  return "";
}

function extractOllamaGenerateText(payload = {}) {
  if (typeof payload.response === "string" && payload.response.trim()) {
    return payload.response.trim();
  }
  return "";
}

function stripLocalModelThoughtArtifacts(text = "") {
  return String(text || "")
    .replace(/<think>[\s\S]*?<\/think>/giu, "")
    .replace(/^\/think.*$/gimu, "")
    .trim();
}

function stripKnownNodeIdPrefix(text = "", textNodes = []) {
  const value = normalizeString(text);
  if (!value) {
    return "";
  }
  const knownIds = (Array.isArray(textNodes) ? textNodes : [])
    .map((node) => normalizeString(node?.id))
    .filter(Boolean)
    .sort((left, right) => right.length - left.length);
  for (const nodeId of knownIds) {
    if (
      value === nodeId ||
      value.startsWith(`${nodeId}\t`) ||
      value.startsWith(`${nodeId} `) ||
      value.startsWith(`${nodeId}:`) ||
      value.startsWith(`${nodeId}-`) ||
      value.startsWith(`${nodeId})`) ||
      value.startsWith(`${nodeId}.`)
    ) {
      return normalizeString(value.slice(nodeId.length).replace(/^[\s\t:.)-]+/u, ""));
    }
  }
  return value;
}

function normalizeDesignerAiResponse(parsed, fallbackText = "") {
  const value = parsed && typeof parsed === "object" ? parsed : {};

  return {
    reply: sanitizeKoreanUiText(normalizeString(value.reply) || fallbackText || "AI 응답을 생성했습니다."),
    intent:
      value.intent && typeof value.intent === "object"
        ? value.intent
        : {
            kind: normalizeString(value.intentKind) || "analyze",
            confidence: "low"
          },
    readRequests: Array.isArray(value.readRequests) ? value.readRequests : [],
    actionPlan: Array.isArray(value.actionPlan) ? value.actionPlan : [],
    safety:
      value.safety && typeof value.safety === "object"
        ? value.safety
        : {
            canApply: false,
            reason: "No explicit safety assessment returned."
          }
  };
}

function normalizeDesignerRewritePreviewResponse(parsed, textNodes = [], fallbackText = "") {
  const value = parsed && typeof parsed === "object" ? parsed : {};
  const knownIds = new Set(
    (Array.isArray(textNodes) ? textNodes : [])
      .map((node) => normalizeString(node?.id))
      .filter(Boolean)
  );
  const normalizedNodes = Array.isArray(textNodes) ? textNodes : [];
  const rawUpdates = Array.isArray(value.updates)
    ? value.updates
    : Array.isArray(value.rewrites)
      ? value.rewrites
      : Array.isArray(value.items)
        ? value.items
        : [];

  const updates = rawUpdates
    .map((entry, index) => {
      const candidate = entry && typeof entry === "object" ? entry : {};
      const resolvedId =
        normalizeString(candidate.id) ||
        normalizeString(normalizedNodes[index]?.id);
      const text =
        normalizeString(candidate.text) ||
        normalizeString(candidate.characters) ||
        normalizeString(candidate.value);

      if (!resolvedId || !text || !knownIds.has(resolvedId)) {
        return null;
      }

      return {
        id: resolvedId,
        text: sanitizeKoreanUiText(stripKnownNodeIdPrefix(text, normalizedNodes))
      };
    })
    .filter(Boolean);

  return {
    reply: sanitizeKoreanUiText(
      normalizeString(value.reply) || fallbackText || "텍스트 변경 초안을 만들었습니다."
    ),
    updates,
    safety:
      value.safety && typeof value.safety === "object"
        ? value.safety
        : {
            canApply: false,
            reason: "Preview only until the user confirms the write."
          }
  };
}

function parseLineBasedRewriteUpdates(text = "", textNodes = []) {
  const sanitizedText = stripLocalModelThoughtArtifacts(text);
  const lines = sanitizedText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return [];
  }

  const byId = new Map(
    (Array.isArray(textNodes) ? textNodes : [])
      .map((node) => [normalizeString(node?.id), node])
      .filter(([id]) => id)
  );

  const updates = [];
  const positionalCandidates = [];
  for (const line of lines) {
    let id = "";
    let textValue = "";
    const tabIndex = line.indexOf("\t");
    if (tabIndex > 0) {
      id = normalizeString(line.slice(0, tabIndex));
      textValue = sanitizeKoreanUiText(normalizeString(line.slice(tabIndex + 1)));
    } else {
      const match = line.match(/^(.+?)\s=>\s(.+)$/u);
      if (match) {
        id = normalizeString(match[1]);
        textValue = sanitizeKoreanUiText(normalizeString(match[2]));
      }
    }

    if (!id || !textValue || !byId.has(id)) {
      const positionalText = sanitizeKoreanUiText(
        stripKnownNodeIdPrefix(
          line
            .replace(/^\d+[\].:\-)]\s*/u, "")
            .replace(/^[-*•]\s*/u, ""),
          textNodes
        )
      );
      if (positionalText) {
        positionalCandidates.push(positionalText);
      }
      continue;
    }
    updates.push({ id, text: textValue });
  }
  if (updates.length === 0 && positionalCandidates.length > 0) {
    const normalizedNodes = Array.isArray(textNodes) ? textNodes : [];
    if (positionalCandidates.length === normalizedNodes.length) {
      return normalizedNodes.map((node, index) => ({
        id: normalizeString(node?.id),
        text: positionalCandidates[index]
      })).filter((entry) => entry.id && entry.text);
    }
    if (normalizedNodes.length === 1 && positionalCandidates.length >= 1) {
      return [
        {
          id: normalizeString(normalizedNodes[0]?.id),
          text: positionalCandidates[0]
        }
      ].filter((entry) => entry.id && entry.text);
    }
  }
  return updates;
}

function buildDefaultNemotronSystemPrompt() {
  return [
    "You are Xbridge Nemotron, the bridge-resident AI designer for a Figma workflow.",
    "Your job is to interpret user requests, decide whether the bridge can apply them directly, and produce safe next actions for the bridge.",
    "Treat the bridge as the execution owner. Do not describe actions as if an external coding assistant performed them.",
    "Use the supplied figmaContext, intent envelope, read execution, and suggestion bundle as your evidence.",
    "If the request is a small text or copy edit, prefer direct bridge apply readiness.",
    "If the request implies layout restructuring, large visual changes, or ambiguous structural edits, require confirmation first.",
    "Do not claim that you changed Figma unless an explicit apply result is present in the input.",
    "Prefer targeted reads over full-file scans.",
    "Return only JSON with keys: reply, intent, readRequests, actionPlan, safety.",
    "Use concise Korean for user-facing reply text when the user request is Korean.",
    "Use natural modern Korean.",
    "Do not use Hanja, mixed-script Korean, archaic literary phrasing, or stiff bureaucratic wording."
  ].join("\n");
}

function loadDefaultNemotronSystemPrompt() {
  try {
    const text = fs.readFileSync(DEFAULT_NEMOTRON_SYSTEM_PROMPT_PATH, "utf8");
    const normalized = normalizeString(text);
    if (normalized) {
      return normalized;
    }
  } catch {}
  return buildDefaultNemotronSystemPrompt();
}

const DEFAULT_NEMOTRON_SYSTEM_PROMPT = loadDefaultNemotronSystemPrompt();

function buildDesignerAiInstructions(config = {}, env = process.env) {
  const configuredPrompt = normalizeString(
    env.XBRIDGE_AI_SYSTEM_PROMPT || config.systemPrompt || ""
  );
  return configuredPrompt || DEFAULT_NEMOTRON_SYSTEM_PROMPT;
}

function buildDesignerAiInput({
  message,
  figmaContext,
  intentEnvelope,
  execution,
  designerSuggestionBundle,
  applyResult
}) {
  return {
    userMessage: message,
    figmaContext: figmaContext || {},
    intentEnvelope: intentEnvelope || null,
    readExecutionSummary: execution?.summary || null,
    readPlan: intentEnvelope?.readPlan || null,
    designerSuggestionBundle: designerSuggestionBundle || null,
    applyResult: applyResult || null,
    expectedJsonShape: {
      reply: "short user-facing response",
      intent: {
        kind: "designer intent kind",
        confidence: "low | medium | high",
        targetSummary: "what should be read or changed"
      },
      readRequests: [
        {
          phase: "fast_context | focused_detail | asset_lookup",
          reason: "why this read is needed",
          command: "bridge command name when applicable"
        }
      ],
      actionPlan: [
        {
          title: "next design action",
          detail: "what to do",
          requiresConfirmation: true
        }
      ],
      safety: {
        canApply: false,
        reason: "why direct Figma writes are or are not safe"
      }
    }
  };
}

export function getDesignerAiConfig(env = process.env) {
  const provider = normalizeString(env.XBRIDGE_AI_PROVIDER || "nvidia").toLowerCase();
  const defaults = resolveProviderDefaults(provider);
  const rawApiKey = normalizeString(env.XBRIDGE_AI_API_KEY || env.OPENAI_API_KEY);
  const apiKey =
    provider === "ollama"
      ? rawApiKey || "ollama"
      : provider === "lmstudio"
        ? rawApiKey || "lmstudio"
        : rawApiKey;
  const baseUrl = normalizeString(
    env.XBRIDGE_AI_BASE_URL || env.OPENAI_BASE_URL || defaults.baseUrl
  ).replace(/\/+$/, "");
  const model = normalizeString(env.XBRIDGE_AI_MODEL || env.OPENAI_MODEL || defaults.model);
  const systemPrompt = normalizeString(env.XBRIDGE_AI_SYSTEM_PROMPT || "");
  const configured = providerRequiresApiKey(provider)
    ? Boolean(apiKey)
    : Boolean(baseUrl && model);

  const config = {
    provider,
    configured,
    apiKey,
    baseUrl,
    model,
    systemPrompt
  };
  const validation = validateDesignerAiConfig(config);

  return {
    ...config,
    valid: validation.valid,
    validationIssues: validation.issues
  };
}

export async function runDesignerAiChat(input = {}, options = {}) {
  const config = options.config || getDesignerAiConfig(options.env);
  const normalizedConfig =
    config && typeof config === "object" && typeof config.valid === "boolean"
      ? config
      : {
          ...config,
          ...validateDesignerAiConfig(config)
        };
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const message = normalizeString(input.message || input.prompt || input.request || input.input);

  if (!message) {
    return {
      provider: normalizedConfig.provider,
      configured: normalizedConfig.configured,
      model: normalizedConfig.model,
      status: "needs_input",
      response: normalizeDesignerAiResponse({
        reply: "먼저 디자인 요청을 입력해 주세요.",
        safety: {
          canApply: false,
          reason: "No user message was provided."
        }
      })
    };
  }

  if (!normalizedConfig.configured) {
    return {
      provider: normalizedConfig.provider,
      configured: false,
      model: normalizedConfig.model,
      status: "unconfigured",
      response: normalizeDesignerAiResponse({
        reply: "AI API 키가 아직 설정되지 않아, 현재는 브리지의 규칙 기반 읽기/제안 결과만 사용할 수 있습니다.",
        intent: input.intentEnvelope?.intents?.[0] || { kind: "analyze", confidence: "low" },
        readRequests: input.intentEnvelope?.readPlan?.phases || [],
        actionPlan: input.designerSuggestionBundle?.recommendations || [],
        safety: {
          canApply: false,
          reason: "Set XBRIDGE_AI_API_KEY or OPENAI_API_KEY on the bridge server."
        }
      })
    };
  }

  if (normalizedConfig.valid === false) {
    return {
      provider: normalizedConfig.provider,
      configured: true,
      model: normalizedConfig.model,
      status: "misconfigured",
      response: normalizeDesignerAiResponse({
        reply: buildMisconfiguredReply(normalizedConfig),
        safety: {
          canApply: false,
          reason: `AI configuration issues: ${normalizedConfig.validationIssues.join(", ")}`
        }
      })
    };
  }

  if (!isSupportedProvider(normalizedConfig.provider)) {
    return {
      provider: normalizedConfig.provider,
      configured: true,
      model: normalizedConfig.model,
      status: "unsupported_provider",
      response: normalizeDesignerAiResponse({
        reply: `지원되지 않는 AI provider입니다: ${normalizedConfig.provider}`,
        safety: {
          canApply: false,
          reason: "Supported providers are openai, nvidia, ollama, and custom."
        }
      })
    };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required for AI API calls");
  }

  const responsePayloadText = JSON.stringify(buildDesignerAiInput(input), null, 2);
  const requestBody =
    usesChatCompletions(normalizedConfig.provider)
      ? {
          model: normalizedConfig.model,
          messages: [
            {
              role: "system",
              content: buildDesignerAiInstructions(normalizedConfig, options.env)
            },
            {
              role: "user",
              content: responsePayloadText
            }
          ],
          temperature: 0.2
        }
      : {
          model: normalizedConfig.model,
          instructions: buildDesignerAiInstructions(normalizedConfig, options.env),
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: responsePayloadText
                }
              ]
            }
          ]
        };
  const endpointPath =
    usesChatCompletions(normalizedConfig.provider) ? "/chat/completions" : "/responses";

  const headers = {
    "Content-Type": "application/json"
  };
  if (normalizedConfig.apiKey) {
    headers.Authorization = `Bearer ${normalizedConfig.apiKey}`;
  }

  const aiTimeoutMs = Math.max(
    0,
    Number(
      options.timeoutMs ||
        (usesChatCompletions(normalizedConfig.provider) &&
        (normalizedConfig.provider === "ollama" || normalizedConfig.provider === "lmstudio")
          ? process.env.XBRIDGE_LOCAL_CHAT_TIMEOUT_MS || 18000
          : 0)
    ) || 0
  );
  let response;
  try {
    response = await fetchImpl(`${normalizedConfig.baseUrl}${endpointPath}`, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: createAiRequestTimeoutSignal(aiTimeoutMs)
    });
  } catch (error) {
    const classifiedCode = classifyRewriteFailureCode(error);
    const wrappedError = new Error(
      classifiedCode === "model_timeout_or_abort"
        ? "선택한 모델 응답이 너무 오래 걸렸습니다."
        : "선택한 모델과 통신하지 못했습니다."
    );
    wrappedError.code = classifiedCode;
    throw wrappedError;
  }
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const messageFromPayload =
      payload?.error?.message ||
      payload?.message ||
      `${normalizedConfig.provider} AI request failed: HTTP ${response.status}`;
    const error = new Error(messageFromPayload);
    error.code =
      response.status >= 500 ? "designer_ai_upstream_failed" : "designer_ai_request_failed";
    throw error;
  }

  const outputText =
    usesChatCompletions(normalizedConfig.provider)
      ? extractChatCompletionText(payload)
      : extractResponseText(payload);
  const parsed = safeJsonParse(outputText);

  return {
    provider: normalizedConfig.provider,
    configured: true,
    model: normalizedConfig.model,
    status: "completed",
    response: normalizeDesignerAiResponse(parsed, outputText),
    rawText: outputText,
    usage: payload.usage || null,
    responseId: payload.id || null
  };
}

export async function runDesignerTextRewritePreview(input = {}, options = {}) {
  const config = options.config || getDesignerAiConfig(options.env);
  const normalizedConfig =
    config && typeof config === "object" && typeof config.valid === "boolean"
      ? config
      : {
          ...config,
          ...validateDesignerAiConfig(config)
        };
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const message = normalizeString(input.message || input.prompt || input.request || input.input);
  const textNodes = Array.isArray(input.textNodes) ? input.textNodes : [];

  if (!message) {
    return {
      provider: normalizedConfig.provider,
      configured: normalizedConfig.configured,
      model: normalizedConfig.model,
      status: "needs_input",
      response: normalizeDesignerRewritePreviewResponse(
        {
          reply: "먼저 어떤 방향으로 텍스트를 바꿀지 알려 주세요.",
          updates: []
        },
        textNodes
      )
    };
  }

  if (textNodes.length === 0) {
    return {
      provider: normalizedConfig.provider,
      configured: normalizedConfig.configured,
      model: normalizedConfig.model,
      status: "missing_text_nodes",
      response: normalizeDesignerRewritePreviewResponse(
        {
          reply: "바꿀 텍스트 노드를 아직 찾지 못했습니다.",
          updates: []
        },
        textNodes
      )
    };
  }

  if (!normalizedConfig.configured) {
    return {
      provider: normalizedConfig.provider,
      configured: false,
      model: normalizedConfig.model,
      status: "unconfigured",
      response: normalizeDesignerRewritePreviewResponse(
        {
          reply: "AI가 아직 연결되지 않아 쓰기 미리보기를 만들 수 없습니다.",
          updates: []
        },
        textNodes
      )
    };
  }

  if (normalizedConfig.valid === false) {
    return {
      provider: normalizedConfig.provider,
      configured: true,
      model: normalizedConfig.model,
      status: "misconfigured",
      response: normalizeDesignerRewritePreviewResponse(
        {
          reply: buildMisconfiguredReply(normalizedConfig),
          updates: []
        },
        textNodes
      )
    };
  }

  if (!isSupportedProvider(normalizedConfig.provider)) {
    return {
      provider: normalizedConfig.provider,
      configured: true,
      model: normalizedConfig.model,
      status: "unsupported_provider",
      response: normalizeDesignerRewritePreviewResponse(
        {
          reply: `지원되지 않는 AI provider입니다: ${normalizedConfig.provider}`,
          updates: []
        },
        textNodes
      )
    };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required for AI API calls");
  }

  const inputPayload = {
    task: "designer_text_rewrite_preview",
    userMessage: message,
    figmaContext: input.figmaContext || {},
    actionLabel: normalizeString(input.actionLabel),
    candidate: input.candidate || null,
    textNodes: textNodes.map((node) => ({
      id: normalizeString(node?.id),
      name: normalizeString(node?.name) || "text",
      characters: normalizeString(node?.characters)
    })),
    expectedJsonShape: {
      reply: "short korean preview summary",
      updates: textNodes.slice(0, 2).map((node) => ({
        id: normalizeString(node?.id) || "node-id",
        text: "rewritten text"
      })),
      safety: {
        canApply: false,
        reason: "Preview before confirm"
      }
    }
  };

  const translationRequest = /(번역|translate|영어로|한글로|한국어로)/i.test(message);
  const taskKind = inferRewriteTaskKind(message);
  const isLocalProvider =
    normalizedConfig.provider === "ollama" || normalizedConfig.provider === "lmstudio";
  const rewriteWorkload = summarizeRewriteWorkload(textNodes);
  const localGenerationBudget = getLocalRewriteGenerationBudget(taskKind, textNodes);
  const derivedLocalRewriteTimeoutMs = getLocalRewriteTimeoutMs(taskKind, rewriteWorkload);
  const localRewriteTimeoutMs = Math.max(
    2000,
    Number(
      options.localRewriteTimeoutMs ||
        options.rewriteTimeoutMs ||
        process.env.XBRIDGE_LOCAL_REWRITE_TIMEOUT_MS ||
        derivedLocalRewriteTimeoutMs
    ) || derivedLocalRewriteTimeoutMs
  );
  const defaultSystemPrompt = [
    "You rewrite selected Figma text nodes for bridge-applied updates.",
    "Return JSON only with keys: reply, updates, safety.",
    "Each update must contain { id, text } and must keep the original node ids.",
    "Create exactly one update per input text node.",
    "Do not add or remove nodes.",
    "Keep the reply short and use concise modern Korean when the user request is Korean.",
    "Preserve common product and UI terms naturally in Korean.",
    "Translate wireframe as 와이어프레임 and hi-fi as 하이파이.",
    "Infer from the userMessage whether this is a faithful translation, title generation, or general rewrite task.",
    translationRequest
      ? "If the user is asking for translation, translate faithfully while keeping design/product terms natural. Do not summarize or paraphrase."
      : taskKind === "title_generate"
        ? "If the user is asking for title generation, produce concise, specific, publishable Korean post titles. Avoid repeating the source text unchanged, avoid generic filler like '관련 게시물 제목', do not include node ids, and make adjacent titles distinct from each other."
        : "If the user is asking for rewriting, keep the result natural and concise."
  ].join("\n");

  const systemPrompt = isLocalProvider
    ? translationRequest
      ? [
          "Translate the selected UI text into natural Korean.",
          "Read REQUEST first and follow it faithfully.",
          "Output exactly one line per input node.",
          "Format: id<TAB>text",
          "No markdown, JSON, bullets, notes, or explanations.",
          "Keep the original meaning.",
          "Translate wireframe as 와이어프레임 and hi-fi as 하이파이.",
          "If the source is already Korean, keep it natural and concise."
        ].join("\n")
      : [
          "Rewrite the selected UI text for bridge-applied updates.",
          "The first line begins with REQUEST<TAB> and contains the user's request.",
          "Output exactly one line per input node.",
          "Use the format: id<TAB>text",
          "Do not use markdown or JSON.",
          "Do not add explanations.",
          "Keep 와이어프레임 and 하이파이 as Korean UI terms.",
          "Infer from REQUEST whether this is faithful translation, title generation, or general rewriting.",
          taskKind === "title_generate"
            ? "If REQUEST asks for title generation, write concise Korean post titles that feel publishable, specific, and distinct from each other. Do not echo node ids, placeholder words, or generic filler like '관련 게시물 제목'."
            : "If REQUEST asks for rewriting, rewrite naturally and concisely for Korean UI copy.",
          "When REQUEST is ambiguous, follow the wording and intent in REQUEST instead of guessing from the source text alone."
        ].join("\n")
    : defaultSystemPrompt;
  const userContent = isLocalProvider
    ? [
        `REQUEST\t${message}`,
        `MODE\t${taskKind}`,
        ...textNodes.map(
          (node) => `NODE\t${normalizeString(node?.id)}\t${normalizeString(node?.characters)}`
        )
      ].join("\n")
    : JSON.stringify(inputPayload, null, 2);

  const requestBody = usesOllamaNativeGenerate(normalizedConfig.provider)
    ? {
        model: normalizedConfig.model,
        prompt: `${systemPrompt}\n\n${userContent}`,
        stream: false,
        think: false,
        options: {
          temperature: 0.1,
          num_predict: isLocalProvider
            ? localGenerationBudget
            : translationRequest
              ? 320
              : 900
        }
      }
    : usesChatCompletions(normalizedConfig.provider)
      ? {
          model: normalizedConfig.model,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: userContent
            }
          ],
          temperature: isLocalProvider ? 0.1 : 0.2,
          max_tokens: isLocalProvider ? localGenerationBudget : 500,
          think: isLocalProvider ? false : undefined
        }
      : {
          model: normalizedConfig.model,
          instructions: defaultSystemPrompt,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify(inputPayload, null, 2)
                }
              ]
            }
          ]
        };
  const endpointPath = usesOllamaNativeGenerate(normalizedConfig.provider)
    ? "/api/generate"
    : usesChatCompletions(normalizedConfig.provider)
      ? "/chat/completions"
      : "/responses";
  const headers = {
    "Content-Type": "application/json"
  };
  if (normalizedConfig.apiKey) {
    headers.Authorization = `Bearer ${normalizedConfig.apiKey}`;
  }

  let response;
  try {
    const requestUrl = usesOllamaNativeGenerate(normalizedConfig.provider)
      ? `${getOllamaNativeBaseUrl(normalizedConfig.baseUrl)}${endpointPath}`
      : `${normalizedConfig.baseUrl}${endpointPath}`;
    response = await fetchImpl(requestUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: isLocalProvider ? createAiRequestTimeoutSignal(localRewriteTimeoutMs) : undefined
    });
  } catch (error) {
    if (translationRequest && isLocalProvider && isAbortLikeError(error)) {
      return {
        provider: normalizedConfig.provider,
        configured: true,
        model: normalizedConfig.model,
        status: "completed",
        response: buildDeterministicTranslationPreviewResponse(textNodes),
        rawText: "",
        usage: null,
        responseId: null,
        fallbackMode: "deterministic_translation_timeout",
        failureCode: "model_timeout_or_abort",
        taskKind,
        outputValidation: {
          taskKind,
          valid: true,
          fallbackApplied: true,
          invalidReasons: [],
          sourceCount: textNodes.length,
          updateCount: textNodes.length
        }
      };
    }
    const wrappedError = new Error(
      classifyRewriteFailureCode(error) === "model_timeout_or_abort"
        ? "선택한 모델 응답이 너무 오래 걸렸습니다."
        : "선택한 모델과 통신하지 못했습니다."
    );
    wrappedError.code = classifyRewriteFailureCode(error);
    throw wrappedError;
  }
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const messageFromPayload =
      payload?.error?.message ||
      payload?.message ||
      `${normalizedConfig.provider} AI request failed: HTTP ${response.status}`;
    if (translationRequest && isLocalProvider) {
      return {
        provider: normalizedConfig.provider,
        configured: true,
        model: normalizedConfig.model,
        status: "completed",
        response: buildDeterministicTranslationPreviewResponse(textNodes),
        rawText: "",
        usage: null,
        responseId: payload.id || null,
        fallbackMode: "deterministic_translation_http_error",
        failureCode: "network_fetch_failed",
        taskKind,
        outputValidation: {
          taskKind,
          valid: true,
          fallbackApplied: true,
          invalidReasons: [],
          sourceCount: textNodes.length,
          updateCount: textNodes.length
        }
      };
    }
    const error = new Error(messageFromPayload);
    error.code = "designer_ai_upstream_failed";
    throw error;
  }

  const outputText = usesOllamaNativeGenerate(normalizedConfig.provider)
    ? extractOllamaGenerateText(payload)
    : usesChatCompletions(normalizedConfig.provider)
      ? extractChatCompletionText(payload)
      : extractResponseText(payload);
  const parsed = safeJsonParse(outputText);
  if (!parsed && isLocalProvider) {
    let lineUpdates = parseLineBasedRewriteUpdates(outputText, textNodes);
    if (translationRequest) {
      lineUpdates = applyDeterministicTranslationFallback(lineUpdates, textNodes);
    }
    const validation = buildRewriteValidationReport({
      taskKind,
      updates: lineUpdates,
      textNodes
    });
    return {
      provider: normalizedConfig.provider,
      configured: true,
      model: normalizedConfig.model,
      status: validation.valid ? "completed" : "failed",
      response: {
        reply: validation.valid
          ? taskKind === "translate"
            ? "선택한 텍스트를 한글로 바로 번역했어요."
            : "선택한 텍스트를 요청한 방향에 맞게 바로 변경했어요."
          : "선택한 텍스트에 대한 AI 초안을 완성하지 못했습니다.",
        updates: validation.valid ? validation.updates : [],
        safety: {
          canApply: false,
          reason: "Preview only until the user confirms the write."
        }
      },
      rawText: outputText,
      usage: payload.usage || null,
      responseId: payload.id || null,
      failureCode: validation.valid ? null : "invalid_model_output",
      taskKind,
      outputValidation: validation
    };
  }

  let normalized = normalizeDesignerRewritePreviewResponse(parsed, textNodes, outputText);
  let fallbackMode = null;
  if (translationRequest) {
    normalized.updates = applyDeterministicTranslationFallback(normalized.updates, textNodes);
    fallbackMode = "deterministic_translation_validation";
  }
  const validation = buildRewriteValidationReport({
    taskKind,
    updates: normalized.updates,
    textNodes
  });
  return {
    provider: normalizedConfig.provider,
    configured: true,
    model: normalizedConfig.model,
    status: validation.valid ? "completed" : "failed",
    response: {
      ...normalized,
      reply: validation.valid
        ? normalized.reply
        : taskKind === "translate"
          ? "선택한 텍스트를 번역 가능한 형태로 만들지 못했습니다."
          : "선택한 텍스트에 대한 AI 초안을 완성하지 못했습니다.",
      updates: validation.valid ? validation.updates : []
    },
    rawText: outputText,
    usage: payload.usage || null,
    responseId: payload.id || null,
    fallbackMode: translationRequest ? fallbackMode : null,
    failureCode: validation.valid ? null : "invalid_model_output",
    taskKind,
    outputValidation: validation
  };
}
