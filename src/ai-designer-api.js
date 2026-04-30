const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const DEFAULT_NVIDIA_MODEL = "nvidia/nemotron-3-nano-30b-a3b";

function normalizeString(value) {
  return String(value || "").trim();
}

function looksLikeUrl(value) {
  return /^https?:\/\//i.test(normalizeString(value));
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

  if (!provider || (provider !== "openai" && provider !== "nvidia")) {
    issues.push("unsupported_provider");
  }

  if (!baseUrl || !looksLikeUrl(baseUrl)) {
    issues.push("invalid_base_url");
  }

  if (!model) {
    issues.push("missing_model");
  } else if (looksLikeUrl(model)) {
    issues.push("model_looks_like_url");
  } else if (model === "openai" || model === "nvidia") {
    issues.push("model_looks_like_provider");
  }

  if (baseUrl === "openai" || baseUrl === "nvidia") {
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
    return "AI provider 설정이 올바르지 않습니다. 현재는 openai 또는 nvidia만 지원합니다.";
  }
  return "AI 설정이 완전하지 않습니다. keychain의 provider, model, base URL 값을 다시 확인해 주세요.";
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

function normalizeDesignerAiResponse(parsed, fallbackText = "") {
  const value = parsed && typeof parsed === "object" ? parsed : {};

  return {
    reply: normalizeString(value.reply) || fallbackText || "AI 응답을 생성했습니다.",
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
    "Use concise Korean for user-facing reply text when the user request is Korean."
  ].join("\n");
}

function buildDesignerAiInstructions(config = {}, env = process.env) {
  const configuredPrompt = normalizeString(
    env.XBRIDGE_AI_SYSTEM_PROMPT || config.systemPrompt || ""
  );
  return configuredPrompt || buildDefaultNemotronSystemPrompt();
}

function buildDesignerAiInput({
  message,
  figmaContext,
  intentEnvelope,
  execution,
  designerSuggestionBundle
}) {
  return {
    userMessage: message,
    figmaContext: figmaContext || {},
    intentEnvelope: intentEnvelope || null,
    readExecutionSummary: execution?.summary || null,
    readPlan: intentEnvelope?.readPlan || null,
    designerSuggestionBundle: designerSuggestionBundle || null,
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
  const apiKey = normalizeString(env.XBRIDGE_AI_API_KEY || env.OPENAI_API_KEY);
  const defaultBaseUrl = provider === "nvidia" ? DEFAULT_NVIDIA_BASE_URL : DEFAULT_OPENAI_BASE_URL;
  const baseUrl = normalizeString(env.XBRIDGE_AI_BASE_URL || env.OPENAI_BASE_URL || defaultBaseUrl).replace(/\/+$/, "");
  const defaultModel = provider === "nvidia" ? DEFAULT_NVIDIA_MODEL : DEFAULT_OPENAI_MODEL;
  const model = normalizeString(env.XBRIDGE_AI_MODEL || env.OPENAI_MODEL || defaultModel);
  const systemPrompt = normalizeString(env.XBRIDGE_AI_SYSTEM_PROMPT || "");

  const config = {
    provider,
    configured: Boolean(apiKey),
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

  if (normalizedConfig.provider !== "openai" && normalizedConfig.provider !== "nvidia") {
    return {
      provider: normalizedConfig.provider,
      configured: true,
      model: normalizedConfig.model,
      status: "unsupported_provider",
      response: normalizeDesignerAiResponse({
        reply: `지원되지 않는 AI provider입니다: ${normalizedConfig.provider}`,
        safety: {
          canApply: false,
          reason: "Supported providers are openai and nvidia."
        }
      })
    };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required for AI API calls");
  }

  const responsePayloadText = JSON.stringify(buildDesignerAiInput(input), null, 2);
  const requestBody =
    normalizedConfig.provider === "nvidia"
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
    normalizedConfig.provider === "nvidia" ? "/chat/completions" : "/responses";

  const response = await fetchImpl(`${normalizedConfig.baseUrl}${endpointPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${normalizedConfig.apiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const messageFromPayload =
      payload?.error?.message ||
      payload?.message ||
      `${normalizedConfig.provider} AI request failed: HTTP ${response.status}`;
    throw new Error(messageFromPayload);
  }

  const outputText =
    normalizedConfig.provider === "nvidia"
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
