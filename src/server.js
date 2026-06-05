import http from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildApplyStylePlan } from "./apply-style.js";
import { buildAddComponentPropertyPlan } from "./add-component-property.js";
import {
  buildBulkAddAnnotationsPlan,
  buildAddAnnotationPlan
} from "./add-annotation.js";
import {
  buildBulkBindVariablesPlan,
  buildBindVariablePlan
} from "./bind-variable.js";
import { buildCreateComponentPlan } from "./create-component.js";
import { buildCreateComponentSetPlan } from "./create-component-set.js";
import { buildCreateInstancePlan } from "./create-instance.js";
import {
  buildBulkCreateNodesPlan,
  buildCreateNodePlan
} from "./create-node.js";
import { buildFileComponentSearchPlan, searchFileComponents } from "./file-components.js";
import {
  buildFindOrImportComponentPlan,
  selectPreferredComponentMatch
} from "./find-or-import-component.js";
import { buildImportLibraryComponentPlan } from "./import-library-component.js";
import {
  buildDesignSystemSearchPlan,
  mergeDesignSystemSearchResults
} from "./design-system-search.js";
import { buildEditComponentPropertyPlan } from "./edit-component-property.js";
import { buildExportNodePlan } from "./export-node.js";
import {
  buildAnalyzeReferenceSelectionPlan,
  deriveReferenceAnalysisDraft
} from "./analyze-reference-selection.js";
import { buildAnalyzeSelectionToComposePlan } from "./analyze-selection-to-compose.js";
import { buildLibraryAssetSearchPlan, searchLibraryAssets } from "./library-assets.js";
import { buildSearchInstancesPlan } from "./search-instances.js";
import { buildReplayPlan } from "./replay-snapshot.js";
import {
  buildCreateFallbackPlan,
  buildReuseOrCreateComponentPlan
} from "./reuse-or-create-component.js";
import {
  buildScreenFromDesignSystemPlan,
  buildSectionBlueprints
} from "./build-screen-from-design-system.js";
import { buildComposeScreenFromIntentsPlan } from "./compose-screen-from-intents.js";
import { createComposeRuntimeMetricsStore } from "./compose-runtime-metrics.js";
import { validateExternalComposeInput } from "./validate-external-compose-input.js";
import { buildFinanceSummaryMockPlan } from "./build-finance-summary-mock.js";
import { buildLayoutPlan } from "./build-layout.js";
import { buildSnapshotPlan } from "./scene-snapshot.js";
import { buildSetComponentPropertiesPlan } from "./set-component-properties.js";
import { buildSetVariantPropertiesPlan } from "./set-variant-properties.js";
import { buildSearchNodesPlan } from "./node-discovery.js";
import {
  buildNodeDetailsPlan,
  buildComponentVariantDetailsPlan,
  buildInstanceDetailsPlan
} from "./read-node-details.js";
import {
  buildGetAnnotationsPlan,
  normalizeAnnotationReadResult
} from "./read-annotations.js";
import { createDesignerIntentEnvelope } from "./ai-designer-intents.js";
import { executeDesignerReadPlan } from "./ai-designer-read-executor.js";
import { augmentDesignerReadRoute } from "./ai-designer-read-routing.js";
import { buildDesignerActionPreviewBundle } from "./ai-designer-action-preview.js";
import {
  augmentDesignerSuggestionBundleWithAiPlan,
  buildDesignerSuggestionBundle
} from "./ai-designer-suggestions-v2.js";
import {
  discoverLocalDesignerProviders,
  getDesignerAiConfig
} from "./ai-designer-api.js";
import {
  buildCodexInspectSuggestionBundle,
  runCodexDesignerSuggestion,
  runCodexImageLayoutPlan,
  runCodexTextRewritePreview,
  runCodexVariantUpdatePreview,
  validateGeneratedImageBuildQuality,
  runCodexInspectSelection,
  shouldUseCodexCliForInspect,
  shouldUseCodexCliForWrite
} from "./codex-cli-runner.js";
import {
  attachDesignerKnowledgeReferences,
  buildAiDesignerSnapshot,
  buildCodexAugmentedSuggestionBundle,
  buildDesignerCodexAiPayload,
  buildDesignerCodexFallbackMeta,
  buildDesignerPipelineSnapshot,
  normalizeCodexCliStatus,
  resolveDesignerCodexInspectTimeoutMs
} from "./ai-designer-server-contract.js";
import {
  buildClubTopicTextUpdates,
  matchGenericSelectionTextRewriteFastPath,
  matchSelectionTextRewriteFastPath
} from "./ai-designer-fast-path.js";
import { parseSelectionMetadataTree } from "./metadata-tree.js";
import {
  buildFileCommentsPlan,
  buildFileSummaryPlan,
  buildProjectFilesPlan,
  buildTeamProjectsPlan,
  getCurrentUser,
  listFileComments,
  getFileSummary,
  listProjectFiles,
  listTeamProjects
} from "./figma-account.js";
import { validatePluginLocalHandoffPayload } from "./plugin-handoff-contract.js";
import {
  BridgeRuntimeError,
  SESSION_STATES,
  createSession,
  getSessionRecencyAt,
  getSessionState,
  markSessionHeartbeat,
  preflightPluginCommand,
  registerSession,
  toSessionSnapshot
} from "./runtime-session-state.js";
import {
  buildCommandDedupeKey,
  isBatchWriteCommandType,
  canApplyExpiryGrace,
  canSafelyCancelStalePendingCommand,
  canSafelyDedupeCommand,
  isInteractiveCommandType,
  isReadHeavyCommandType,
  isSimpleWriteCommandType,
  isWriteHeavyCommandType,
  resolvePollingFallbackClass,
  resolveCommandPriority
} from "./command-queue-policy.js";
import { exportDesignTokensArtifact as exportDesignTokensArtifactImpl } from "./server-token-export.js";
import { buildToolDefinitions } from "./server-tool-definitions.js";
import {
  createHandleToolCall,
  resolveBulkBindVariablesTimeoutMs as resolveBulkBindVariablesTimeoutMsImpl,
  resolveCommandTimeoutMs as resolveCommandTimeoutMsImpl
} from "./server-command-dispatch.js";
import {
  createDesignerRouteHandler
} from "./server-designer-routes.js";
import {
  createRouteTable,
  createStableRouteHandlers,
  handleRouteTableRequest
} from "./server-routes.js";
import {
  buildActiveRecoverySummary,
  buildActiveSessionResolution,
  buildCommandReadinessSnapshot,
  buildLivePluginIdsSnapshot,
  buildPluginUiMetricsSnapshot,
  buildPrimaryLiveSessionSnapshot,
  buildQueueDiagnosticsSnapshot,
  buildRecentTransportActivitySnapshot,
  buildRuntimeObservabilitySnapshot,
  buildRuntimeOpsSnapshot as buildRuntimeOpsSnapshotResponse,
  buildTransportHealthInputs,
  buildTransportHealthSnapshot,
  buildWriteReadinessSnapshot,
  buildWriteReadinessInputs,
  createQueueObservabilityStore
} from "./server-transport-state.js";

const DEFAULT_PORT = 3846;
const BRIDGE_PACKAGE_NAME = "figma-writable-mcp-prototype";
const BRIDGE_VERSION = "0.5.65";
const AI_KEYCHAIN_SERVICE_NAME = "writable-mcp-bridge";
const AI_KEYCHAIN_ACCOUNTS = {
  apiKey: "xbridge-ai-api-key",
  model: "xbridge-ai-model",
  baseUrl: "xbridge-ai-base-url",
  provider: "xbridge-ai-provider"
};
const DESIGNER_MODEL_PRESETS = [
  {
    id: "gpt-4.1-mini",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    shortLabel: "GPT-4.1 Mini",
    displayLabel: "GPT-4.1 Mini · 중간",
    levelLabel: "중간"
  },
  {
    id: "gpt-4.1",
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    shortLabel: "GPT-4.1",
    displayLabel: "GPT-4.1 · 높음",
    levelLabel: "높음"
  },
  {
    id: "nvidia/nemotron-mini-4b-instruct",
    provider: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    shortLabel: "Nemotron Mini 4B",
    displayLabel: "Nemotron Mini 4B · 낮음",
    levelLabel: "낮음"
  },
  {
    id: "nvidia/nemotron-3-nano-30b-a3b",
    provider: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    shortLabel: "Nemotron Nano 30B",
    displayLabel: "Nemotron Nano 30B · 중간",
    levelLabel: "중간"
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    provider: "nvidia",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    shortLabel: "Nemotron Super 120B",
    displayLabel: "Nemotron Super 120B · 높음",
    levelLabel: "높음"
  }
];

const DESIGNER_PROVIDER_OPTIONS = [
  {
    id: "nvidia",
    label: "NVIDIA",
    requiresApiKey: true,
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1"
  },
  {
    id: "openai",
    label: "OpenAI",
    requiresApiKey: true,
    defaultBaseUrl: "https://api.openai.com/v1"
  },
  {
    id: "ollama",
    label: "Ollama",
    requiresApiKey: false,
    defaultBaseUrl: "http://127.0.0.1:11434/v1"
  },
  {
    id: "lmstudio",
    label: "LM Studio",
    requiresApiKey: false,
    defaultBaseUrl: "http://127.0.0.1:1234/v1"
  },
  {
    id: "custom",
    label: "Custom",
    requiresApiKey: false,
    defaultBaseUrl: "http://127.0.0.1:1234/v1"
  }
];

function readKeychainValue(accountName) {
  try {
    return String(
      execFileSync("security", [
        "find-generic-password",
        "-a",
        accountName,
        "-s",
        AI_KEYCHAIN_SERVICE_NAME,
        "-w"
      ], { encoding: "utf8" })
    ).trim();
  } catch {
    return "";
  }
}

function writeKeychainValue(accountName, value) {
  execFileSync(
    "security",
    [
      "add-generic-password",
      "-a",
      accountName,
      "-s",
      AI_KEYCHAIN_SERVICE_NAME,
      "-w",
      String(value),
      "-U"
    ],
    { encoding: "utf8" }
  );
}

function getDesignerModelPresetList(currentConfig = null) {
  const config = currentConfig || getDesignerAiConfig();
  const currentModelId = String(config.model || "").trim();
  return DESIGNER_MODEL_PRESETS.map((preset) => ({
    id: preset.id,
    provider: preset.provider,
    baseUrl: preset.baseUrl,
    shortLabel: preset.shortLabel,
    displayLabel: preset.displayLabel,
    levelLabel: preset.levelLabel,
    selected: preset.id === currentModelId
  }));
}

function getDesignerProviderOptionList() {
  return DESIGNER_PROVIDER_OPTIONS.map((option) => ({ ...option }));
}

async function validateConfiguredLocalDesignerModel(provider, model) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedModel = String(model || "").trim();
  if (!normalizedProvider || !normalizedModel) {
    return;
  }
  if (normalizedProvider !== "ollama" && normalizedProvider !== "lmstudio") {
    return;
  }

  const discovery = await discoverLocalDesignerProviders();
  const providerEntry = Array.isArray(discovery?.providers)
    ? discovery.providers.find((entry) => String(entry?.provider || "").trim().toLowerCase() === normalizedProvider)
    : null;

  if (!providerEntry || providerEntry.available !== true) {
    const error = new Error(
      normalizedProvider === "ollama"
        ? "Ollama가 실행 중이 아니거나 응답하지 않습니다."
        : "LM Studio가 실행 중이 아니거나 응답하지 않습니다."
    );
    error.code = "local_ai_provider_unavailable";
    throw error;
  }

  const availableModels = Array.isArray(providerEntry.models)
    ? providerEntry.models.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];

  if (availableModels.length > 0 && !availableModels.includes(normalizedModel)) {
    const error = new Error(
      `선택한 로컬 모델을 찾지 못했습니다: ${normalizedModel}. 사용 가능한 모델: ${availableModels.join(", ")}`
    );
    error.code = "local_ai_model_not_found";
    error.availableModels = availableModels;
    throw error;
  }
}

async function runDesignerModelConnectionProbe({
  provider,
  model,
  baseUrl,
  apiKey,
  timeoutMs
} = {}) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedModel = String(model || "").trim();
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/+$/, "");
  const normalizedApiKey = String(apiKey || "").trim();
  if (!normalizedProvider || !normalizedModel || !normalizedBaseUrl) {
    const error = new Error("Provider, model, base URL을 확인해 주세요.");
    error.code = "designer_model_probe_missing_config";
    throw error;
  }

  const probeTimeoutMs = Math.max(
    2500,
    Number(timeoutMs || process.env.XBRIDGE_MODEL_TEST_TIMEOUT_MS || 30000)
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), probeTimeoutMs);
  try {
    const headers = {
      "Content-Type": "application/json"
    };
    if (normalizedApiKey) {
      headers.Authorization = `Bearer ${normalizedApiKey}`;
    }
    const response = await fetch(`${normalizedBaseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: normalizedModel,
        messages: [
          {
            role: "system",
            content: "Reply with exactly OK."
          },
          {
            role: "user",
            content: "OK"
          }
        ],
        stream: false,
        temperature: 0,
        max_tokens: 8,
        think: false
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        payload?.error?.message ||
          payload?.message ||
          `모델 연결 테스트 실패: HTTP ${response.status}`
      );
      error.code =
        response.status >= 500 ? "designer_model_probe_upstream_failed" : "designer_model_probe_failed";
      throw error;
    }
    const content =
      payload?.choices?.[0]?.message?.content ||
      payload?.choices?.[0]?.text ||
      payload?.message?.content ||
      "";
    return {
      ok: true,
      provider: normalizedProvider,
      model: normalizedModel,
      responseText: String(content || "").trim(),
      usage: payload?.usage || null
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("선택한 모델 응답이 너무 오래 걸렸습니다.");
      timeoutError.code = "model_timeout_or_abort";
      throw timeoutError;
    }
    const wrappedError = new Error(error?.message || "선택한 모델과 통신하지 못했습니다.");
    wrappedError.code = error?.code || "network_fetch_failed";
    throw wrappedError;
  } finally {
    clearTimeout(timeout);
  }
}

function applyDesignerModelPreset(modelId) {
  const preset = DESIGNER_MODEL_PRESETS.find((item) => item.id === modelId);
  if (!preset) {
    const error = new Error(`Unsupported designer model preset: ${modelId}`);
    error.code = "unsupported_model_preset";
    throw error;
  }

  const existingApiKey = readKeychainValue(AI_KEYCHAIN_ACCOUNTS.apiKey);
  if (!existingApiKey && !["ollama", "lmstudio", "custom"].includes(preset.provider)) {
    const error = new Error("AI API key is not stored in macOS Keychain.");
    error.code = "missing_ai_api_key";
    throw error;
  }

  writeKeychainValue(AI_KEYCHAIN_ACCOUNTS.model, preset.id);
  writeKeychainValue(AI_KEYCHAIN_ACCOUNTS.baseUrl, preset.baseUrl);
  writeKeychainValue(AI_KEYCHAIN_ACCOUNTS.provider, preset.provider);
  if ((preset.provider === "ollama" || preset.provider === "lmstudio") && !existingApiKey) {
    writeKeychainValue(AI_KEYCHAIN_ACCOUNTS.apiKey, preset.provider);
  }

  process.env.XBRIDGE_AI_API_KEY =
    existingApiKey || (preset.provider === "ollama" || preset.provider === "lmstudio" ? preset.provider : "");
  process.env.XBRIDGE_AI_MODEL = preset.id;
  process.env.XBRIDGE_AI_BASE_URL = preset.baseUrl;
  process.env.XBRIDGE_AI_PROVIDER = preset.provider;

  return preset;
}

function applyDesignerModelConfig({
  provider,
  model,
  baseUrl,
  apiKey
} = {}) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  const normalizedModel = String(model || "").trim();
  const normalizedBaseUrl = String(baseUrl || "").trim().replace(/\/+$/, "");
  const normalizedApiKey = String(apiKey || "").trim();
  const existingApiKey = readKeychainValue(AI_KEYCHAIN_ACCOUNTS.apiKey);

  if (!DESIGNER_PROVIDER_OPTIONS.some((option) => option.id === normalizedProvider)) {
    const error = new Error(`Unsupported designer AI provider: ${normalizedProvider || "(empty)"}`);
    error.code = "unsupported_ai_provider";
    throw error;
  }
  if (!normalizedModel) {
    const error = new Error("모델명을 입력해 주세요.");
    error.code = "missing_ai_model";
    throw error;
  }
  if (!/^https?:\/\//i.test(normalizedBaseUrl)) {
    const error = new Error("Base URL은 http:// 또는 https:// 로 시작해야 합니다.");
    error.code = "invalid_ai_base_url";
    throw error;
  }
  if (
    (normalizedProvider === "nvidia" || normalizedProvider === "openai") &&
    !normalizedApiKey &&
    !existingApiKey
  ) {
    const error = new Error("이 provider는 API 키가 필요합니다.");
    error.code = "missing_ai_api_key";
    throw error;
  }

  const storedApiKey =
    normalizedApiKey ||
    existingApiKey ||
    (normalizedProvider === "ollama" || normalizedProvider === "lmstudio"
      ? normalizedProvider
      : "");

  writeKeychainValue(AI_KEYCHAIN_ACCOUNTS.model, normalizedModel);
  writeKeychainValue(AI_KEYCHAIN_ACCOUNTS.baseUrl, normalizedBaseUrl);
  writeKeychainValue(AI_KEYCHAIN_ACCOUNTS.provider, normalizedProvider);
  if (storedApiKey) {
    writeKeychainValue(AI_KEYCHAIN_ACCOUNTS.apiKey, storedApiKey);
  }

  process.env.XBRIDGE_AI_MODEL = normalizedModel;
  process.env.XBRIDGE_AI_BASE_URL = normalizedBaseUrl;
  process.env.XBRIDGE_AI_PROVIDER = normalizedProvider;
  process.env.XBRIDGE_AI_API_KEY = storedApiKey;

  const responsePayload = {
    provider: normalizedProvider,
    model: normalizedModel,
    baseUrl: normalizedBaseUrl
  };
  return responsePayload;
}
const REQUESTED_PORT = process.env.PORT ? Number(process.env.PORT) : null;
const CANDIDATE_PORTS = [REQUESTED_PORT || DEFAULT_PORT];
const TOOL_TIMEOUT_MS = Number(process.env.TOOL_TIMEOUT_MS || 30000);
const EXPORT_NODE_COMMAND_TIMEOUT_MS = Number(
  process.env.EXPORT_NODE_COMMAND_TIMEOUT_MS || 120000
);
const DESIGNER_COMPARE_REQUEST_TIMEOUT_MS = Number(
  process.env.XBRIDGE_DESIGNER_COMPARE_REQUEST_TIMEOUT_MS || 45000
);
const DESIGNER_IMPROVE_REQUEST_TIMEOUT_MS = Number(
  process.env.XBRIDGE_DESIGNER_IMPROVE_REQUEST_TIMEOUT_MS || 60000
);
const EXPORT_DESIGN_TOKENS_COMMAND_TIMEOUT_MS = Number(
  process.env.EXPORT_DESIGN_TOKENS_COMMAND_TIMEOUT_MS || 300000
);
const EXPORT_DESIGN_TOKENS_CHUNK_TIMEOUT_MS = Number(
  process.env.EXPORT_DESIGN_TOKENS_CHUNK_TIMEOUT_MS || 120000
);
const EXPORT_DESIGN_TOKENS_SOFT_BUDGET_MS = Number(
  process.env.EXPORT_DESIGN_TOKENS_SOFT_BUDGET_MS || 300000
);
const EXPORT_DESIGN_TOKENS_CHUNK_MAX_LIMIT = Number(
  process.env.EXPORT_DESIGN_TOKENS_CHUNK_MAX_LIMIT || 100
);
const EXPORT_DESIGN_TOKENS_CHUNK_LIMIT = Number(
  process.env.EXPORT_DESIGN_TOKENS_CHUNK_LIMIT || 20
);
const XBRIDGE_TOKEN_EXPORT_DIR =
  process.env.XBRIDGE_TOKEN_EXPORT_DIR || "/private/tmp/xbridge-token-exports";
const IMAGE_SCREEN_SELECTED_EXPORT_SCALE = Number(
  process.env.IMAGE_SCREEN_SELECTED_EXPORT_SCALE || 1
);
const IMAGE_SCREEN_SELECTED_FRAME_EXPORT_SCALE = Number(
  process.env.IMAGE_SCREEN_SELECTED_FRAME_EXPORT_SCALE || 0.25
);
const FRAME_LIKE_SELECTION_TYPES = new Set(["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "SECTION"]);
const READ_HEAVY_COMMAND_TIMEOUT_MULTIPLIER = Number(
  process.env.READ_HEAVY_COMMAND_TIMEOUT_MULTIPLIER || 3
);
const READ_HEAVY_COMMAND_TIMEOUT_BUFFER_MS = Number(
  process.env.READ_HEAVY_COMMAND_TIMEOUT_BUFFER_MS || 400
);
const READ_HEAVY_QUEUE_EXPIRY_GRACE_MS = Number(
  process.env.READ_HEAVY_QUEUE_EXPIRY_GRACE_MS || 1200
);
const INTERACTIVE_COMMAND_TIMEOUT_MULTIPLIER = Number(
  process.env.INTERACTIVE_COMMAND_TIMEOUT_MULTIPLIER || 0.85
);
const INTERACTIVE_COMMAND_TIMEOUT_BUFFER_MS = Number(
  process.env.INTERACTIVE_COMMAND_TIMEOUT_BUFFER_MS || 150
);
const INTERACTIVE_COMMAND_MIN_TIMEOUT_MS = Number(
  process.env.INTERACTIVE_COMMAND_MIN_TIMEOUT_MS || 700
);
const INTERACTIVE_QUEUE_EXPIRY_GRACE_MS = Number(
  process.env.INTERACTIVE_QUEUE_EXPIRY_GRACE_MS || 250
);
const WRITE_HEAVY_COMMAND_TIMEOUT_MULTIPLIER = Number(
  process.env.WRITE_HEAVY_COMMAND_TIMEOUT_MULTIPLIER || 1.6
);
const WRITE_HEAVY_COMMAND_TIMEOUT_BUFFER_MS = Number(
  process.env.WRITE_HEAVY_COMMAND_TIMEOUT_BUFFER_MS || 600
);
const SIMPLE_WRITE_COMMAND_TIMEOUT_MULTIPLIER = Number(
  process.env.SIMPLE_WRITE_COMMAND_TIMEOUT_MULTIPLIER || 1.2
);
const SIMPLE_WRITE_COMMAND_TIMEOUT_BUFFER_MS = Number(
  process.env.SIMPLE_WRITE_COMMAND_TIMEOUT_BUFFER_MS || 300
);
const SIMPLE_WRITE_COMMAND_MIN_TIMEOUT_MS = Number(
  process.env.SIMPLE_WRITE_COMMAND_MIN_TIMEOUT_MS || 900
);
const WRITE_HEAVY_QUEUE_EXPIRY_GRACE_MS = Number(
  process.env.WRITE_HEAVY_QUEUE_EXPIRY_GRACE_MS || 1500
);
const SIMPLE_WRITE_QUEUE_EXPIRY_GRACE_MS = Number(
  process.env.SIMPLE_WRITE_QUEUE_EXPIRY_GRACE_MS || 700
);
const WRITE_HEARTBEAT_GAP_DEGRADED_MS = Number(
  process.env.WRITE_HEARTBEAT_GAP_DEGRADED_MS || 12000
);
const WRITE_PENDING_BACKLOG_THRESHOLD_MS = Number(
  process.env.WRITE_PENDING_BACKLOG_THRESHOLD_MS || 2000
);
const BIND_VARIABLE_COALESCE_WINDOW_MS = Number(
  process.env.BIND_VARIABLE_COALESCE_WINDOW_MS || 20
);
const SEARCH_NODES_RETRY_MAX_ATTEMPTS = Number(
  process.env.SEARCH_NODES_RETRY_MAX_ATTEMPTS || 3
);
const SEARCH_NODES_RETRY_BASE_DELAY_MS = Number(
  process.env.SEARCH_NODES_RETRY_BASE_DELAY_MS || 40
);
const SEARCH_NODES_RETRY_MAX_DELAY_MS = Number(
  process.env.SEARCH_NODES_RETRY_MAX_DELAY_MS || 320
);
const RECENT_FAILURE_WINDOW_MS = Number(
  process.env.RECENT_FAILURE_WINDOW_MS || 120000
);
const RECENT_TRANSPORT_WINDOW_MS = Number(
  process.env.RECENT_TRANSPORT_WINDOW_MS || RECENT_FAILURE_WINDOW_MS
);
const RECENT_FAILURE_HISTORY_LIMIT = Number(
  process.env.RECENT_FAILURE_HISTORY_LIMIT || 200
);
const RECENT_COMMAND_LIFECYCLE_LIMIT = Number(
  process.env.RECENT_COMMAND_LIFECYCLE_LIMIT || 12
);
const RECENT_RUNTIME_EVENT_LIMIT = Number(
  process.env.RECENT_RUNTIME_EVENT_LIMIT || 200
);
const SESSION_ACTIVE_WINDOW_MS = Number(process.env.SESSION_ACTIVE_WINDOW_MS || 45000);
const SESSION_RETENTION_MS = Number(process.env.SESSION_RETENTION_MS || 600000);
const SESSION_PRUNE_INTERVAL_MS = Number(process.env.SESSION_PRUNE_INTERVAL_MS || 5000);
const STALE_PENDING_COMMAND_MS = Number(process.env.STALE_PENDING_COMMAND_MS || 4000);
const pluginSessions = new Map();
const pendingCommands = new Map();
const pendingResults = new Map();
const bindVariableCoalescers = new Map();
const queueObservability = createQueueObservabilityStore({
  lifecycleLimit: RECENT_COMMAND_LIFECYCLE_LIMIT,
  failureWindowMs: RECENT_FAILURE_WINDOW_MS,
  failureHistoryLimit: RECENT_FAILURE_HISTORY_LIMIT,
  runtimeErrorClass: BridgeRuntimeError
});
const recentRuntimeEvents = [];
const sseClients = new Map();
const wsClients = new Map();
const sessionStateByPlugin = new Map();
const recentHandoffs = [];
let sseClientSequence = 0;
let wsClientSequence = 0;
let runtimeEventSequence = 0;
let lastHealthEventSignature = null;
const RECENT_HANDOFF_LIMIT = Number(process.env.RECENT_HANDOFF_LIMIT || 50);

function isWriteCommandType(type) {
  return resolvePollingFallbackClass(type) === "mutation";
}
const WS_COMMAND_MIRROR_RETRY_DELAY_MS = Number(
  process.env.WS_COMMAND_MIRROR_RETRY_DELAY_MS || 160
);
const WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS = Number(
  process.env.WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS || 1200
);
const WS_PLUGIN_RESUME_ACK_GRACE_MS = Number(
  process.env.WS_PLUGIN_RESUME_ACK_GRACE_MS ||
    Math.max(WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS, 900)
);
const WS_POLLING_FALLBACK_GRACE_MS = Number(
  process.env.WS_POLLING_FALLBACK_GRACE_MS ||
    Math.max(WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS, 120)
);
const WS_POLLING_FALLBACK_CRITICAL_MULTIPLIER = Number(
  process.env.WS_POLLING_FALLBACK_CRITICAL_MULTIPLIER || 1
);
const WS_POLLING_FALLBACK_INTERACTIVE_MULTIPLIER = Number(
  process.env.WS_POLLING_FALLBACK_INTERACTIVE_MULTIPLIER || 0.7
);
const WS_POLLING_FALLBACK_STANDARD_MULTIPLIER = Number(
  process.env.WS_POLLING_FALLBACK_STANDARD_MULTIPLIER || 1.2
);
const WS_POLLING_FALLBACK_DETAIL_MULTIPLIER = Number(
  process.env.WS_POLLING_FALLBACK_DETAIL_MULTIPLIER || 1.45
);
const WS_POLLING_FALLBACK_QUEUE_PRESSURE_THRESHOLD = Number(
  process.env.WS_POLLING_FALLBACK_QUEUE_PRESSURE_THRESHOLD || 3
);
const WS_POLLING_FALLBACK_NEAR_TIMEOUT_RATIO = Number(
  process.env.WS_POLLING_FALLBACK_NEAR_TIMEOUT_RATIO || 0.65
);
const POLLING_FALLBACK_READY_MAX_DELIVER_PER_TICK = Number(
  process.env.POLLING_FALLBACK_READY_MAX_DELIVER_PER_TICK || 1
);
const POLLING_FALLBACK_MODE_RAW = String(
  process.env.POLLING_FALLBACK_MODE || "recovery_only"
).trim().toLowerCase();
const POLLING_FALLBACK_MODE =
  POLLING_FALLBACK_MODE_RAW === "legacy" ? "legacy" : "recovery_only";
const WS_MAX_TEXT_PAYLOAD_BYTES = Number(
  process.env.WS_MAX_TEXT_PAYLOAD_BYTES || 65536
);
const WS_INBOUND_READ_COMMANDS = new Set([
  "ping",
  "get_selection",
  "get_metadata",
  "get_node_details",
  "get_component_variant_details",
  "get_instance_details",
  "get_variable_collections_summary",
  "export_design_tokens_chunk"
]);
const requestContext = new AsyncLocalStorage();
const pendingRecoveryByPlugin = new Map();
const runtimeCounters = {
  queue: {
    enqueuedTotal: 0,
    dedupedTotal: 0,
    canceledStaleTotal: 0,
    canceledStaleByType: {},
    clientAbortedCommandTotal: 0,
    clientAbortedCommandByType: {},
    deliveredTotal: 0,
    completedTotal: 0,
    failedTotal: 0,
    expiredTotal: 0,
    writeCoalescedBatchTotal: 0,
    writeCoalescedRequestTotal: 0,
    writeCoalescedSavedCommandTotal: 0
  },
  preflight: {
    failuresTotal: 0,
    failuresByCode: {},
    recovery: {
      pendingTotal: 0,
      recoveredTotal: 0
    }
  },
  sessions: {
    pruneRunsTotal: 0,
    prunedTotal: 0
  },
  transport: {
    wsDispatchAttemptedTotal: 0,
    wsDispatchedTotal: 0,
    wsDispatchFailedTotal: 0,
    wsAckTotal: 0,
    wsResultTotal: 0,
    wsInboundRequestTotal: 0,
    wsInboundAcceptedTotal: 0,
    wsInboundResultTotal: 0,
    wsInboundErrorTotal: 0,
    pollingDeliveredTotal: 0,
    pollingFallbackAfterWsDispatchTotal: 0,
    pollingDeferredByWsGuardTotal: 0,
    pollingDeferredByReadyCapTotal: 0,
    pollingDeferredByPolicyBlockTotal: 0,
    fallbackReasons: {
      noWsPluginClientsTotal: 0,
      wsDispatchFailedTotal: 0,
      wsAckTimeoutTotal: 0,
      unsupportedWsCommandTotal: 0
    },
    lastFallbackReason: null
  }
};
let activeHttpPort = null;
const DESIGN_SYSTEM_SEARCH_CACHE_TTL_MS = 10000;
const designSystemSearchCache = new Map();
const composeRuntimeMetrics = createComposeRuntimeMetricsStore();
const SCREEN_FALLBACK_TYPO = {
  headerTitleStyle: "Server/Heading/H2",
  contentTitleStyle: "Server/Heading/H2",
  contentBodyStyle: "Server/Body2/regular",
  textColorVariable: "Color/text/primary"
};

const FIGMA_ACCOUNT_API_OPTIONS = {
  accessToken: process.env.FIGMA_ACCESS_TOKEN
};

async function performDesignSystemSearch(pluginId, input = {}) {
  const plan = buildDesignSystemSearchPlan(input);
  const cacheKey = JSON.stringify({
    pluginId,
    query: plan.query,
    maxResults: plan.maxResults,
    includeComponents: plan.includeComponents,
    includeStyles: plan.includeStyles,
    includeVariables: plan.includeVariables,
    fileKeys: plan.fileKeys,
    kinds: plan.kinds,
    sources: plan.sources
  });
  const cached = designSystemSearchCache.get(cacheKey);
  if (cached && Date.now() - cached.at <= DESIGN_SYSTEM_SEARCH_CACHE_TTL_MS) {
    return cached.result;
  }

  const localResult = await executePluginCommand(pluginId, "search_design_system", plan);
  const sources = [localResult];

  if (plan.fileKeys.length > 0 && (plan.sources.includes("all") || plan.sources.includes("library-files"))) {
    for (const fileKey of plan.fileKeys) {
      if (plan.includeComponents || plan.includeStyles) {
        sources.push(
          await searchLibraryAssets(
            {
              fileKey,
              query: plan.query,
              assetTypes: [
                ...(plan.includeComponents ? ["COMPONENT", "COMPONENT_SET"] : []),
                ...(plan.includeStyles ? ["STYLE"] : [])
              ],
              maxResults: plan.maxResults
            },
            {
              accessToken: process.env.FIGMA_ACCESS_TOKEN
            }
          )
        );
      }

      if (plan.includeComponents) {
        sources.push(
          await searchFileComponents(
            {
              fileKey,
              query: plan.query,
              maxResults: plan.maxResults
            },
            {
              accessToken: process.env.FIGMA_ACCESS_TOKEN
            }
          )
        );
      }
    }
  }

  const merged = mergeDesignSystemSearchResults(sources, plan);
  designSystemSearchCache.set(cacheKey, {
    at: Date.now(),
    result: merged
  });
  return merged;
}

async function performFindOrImportComponent(pluginId, input = {}) {
  const plan = buildFindOrImportComponentPlan(input);
  const fallbackTargetNodeId =
    typeof pluginId === "string" && pluginId.startsWith("page:")
      ? pluginId.replace(/^page:/, "")
      : undefined;

  let localNodeSearch = { matches: [] };
  try {
    localNodeSearch = await executePluginCommand(pluginId, "search_nodes", {
      targetNodeId: plan.targetNodeId || fallbackTargetNodeId,
      query: plan.query,
      nodeTypes: ["COMPONENT", "COMPONENT_SET"],
      maxDepth: 8,
      maxResults: plan.maxResults
    });
  } catch (error) {
    if (!String(error?.message || "").includes("No selection available")) {
      throw error;
    }
  }

  const localMatches = Array.isArray(localNodeSearch?.matches)
    ? localNodeSearch.matches.map((match) => ({
        sourceType: match.type === "COMPONENT_SET" ? "LOCAL_COMPONENT_SET" : "LOCAL_COMPONENT",
        assetType: match.type,
        id: match.id,
        nodeId: match.id,
        name: match.name || "",
        description: "",
        containingFrame: null
      }))
    : [];

  const sources = [{ matches: localMatches }];

  if (plan.fileKeys.length > 0) {
    const remoteResult = await performDesignSystemSearch(pluginId, {
      query: plan.query,
      maxResults: plan.maxResults,
      kinds: ["components"],
      sources: ["all"],
      fileKeys: plan.fileKeys
    });
    sources.push({ matches: remoteResult.matches });
  }

  const searchResult = mergeDesignSystemSearchResults(sources, {
    query: plan.query,
    maxResults: plan.maxResults,
    kinds: ["components"],
    sources: plan.fileKeys.length > 0 ? ["all"] : ["local-file"]
  });

  const match = selectPreferredComponentMatch(searchResult.matches, plan);
  if (!match) {
    return {
      action: "not_found",
      query: plan.query,
      search: searchResult
    };
  }

  const isLocal =
    match.sourceType === "LOCAL_COMPONENT" ||
    match.sourceType === "LOCAL_COMPONENT_SET";

  if (isLocal || !match.key) {
    return {
      action: "found_local",
      query: plan.query,
      match,
      search: searchResult
    };
  }

  const importPlan = buildImportLibraryComponentPlan({
    key: match.key,
    parentId: plan.parentId,
    assetType: String(match.assetType || "COMPONENT").toUpperCase(),
    name: match.name,
    index: plan.index,
    x: plan.x,
    y: plan.y
  });

  const imported = await executePluginCommand(pluginId, "import_library_component", importPlan);

  const responsePayload = {
    action: "imported_library",
    query: plan.query,
    match,
    imported,
    search: searchResult
  };
}

async function performReuseOrCreateComponent(pluginId, input = {}) {
  const plan = buildReuseOrCreateComponentPlan(input);
  const result = await performFindOrImportComponent(pluginId, plan);

  if (result.action !== "not_found") {
    return result;
  }

  const createPlan = buildCreateFallbackPlan(plan);
  if (!createPlan) {
    return result;
  }

  const created = await executePluginCommand(pluginId, "create_component", createPlan);
  const responsePayload = {
    action: "created_local",
    query: plan.query,
    created,
    search: result.search
  };
}

async function performBuildScreenFromDesignSystem(pluginId, input = {}) {
  const plan = buildScreenFromDesignSystemPlan(input);
  const annotationResults = [];
  const pendingAnnotations = [];
  const addAnnotationIfNeeded = async (targetNodeId, annotation, properties) => {
    const normalized =
      typeof annotation === "string"
        ? { label: annotation }
        : annotation && typeof annotation === "object"
          ? annotation
          : null;

    if (!plan.annotate || !targetNodeId || !normalized?.label) {
      return null;
    }

    pendingAnnotations.push({
      targetNodeId,
      label:
        typeof normalized.labelMarkdown === "string" &&
        normalized.labelMarkdown.trim()
          ? undefined
          : normalized.label,
      labelMarkdown:
        typeof normalized.labelMarkdown === "string" &&
        normalized.labelMarkdown.trim()
          ? normalized.labelMarkdown.trim()
          : undefined,
      replace: false,
      properties: Array.isArray(properties) ? properties : undefined,
      __meta: {
        label: normalized.label,
        labelMarkdown: normalized.labelMarkdown,
        properties: Array.isArray(properties) ? properties : []
      }
    });
    return true;
  };
  const sectionTypeLabelMap = {
    header: "헤더",
    content: "콘텐츠",
    actions: "액션",
    navigation: "내비게이션",
    "summary-cards": "요약 카드",
    timeline: "타임라인",
    list: "리스트",
    table: "테이블",
    form: "폼"
  };
  const sectionTypeDescriptionMap = {
    header: "화면 상단의 제목 또는 헤더 컴포넌트 영역",
    content: "주요 본문 콘텐츠를 배치하는 기본 영역",
    actions: "주요 CTA와 보조 액션을 배치하는 영역",
    navigation: "페이지 이동과 전역 탐색을 위한 영역",
    "summary-cards": "KPI, 상태 요약, 핵심 수치를 보여주는 카드 영역",
    timeline: "일정, 진행 흐름, 활동 순서를 보여주는 영역",
    list: "반복 항목을 세로로 나열하는 영역",
    table: "행/열 기반 데이터 표시 영역",
    form: "입력 필드와 제출 액션을 포함하는 영역"
  };
  const buildSectionAnnotation = (sectionType, sectionName) => {
    const typeLabel = sectionTypeLabelMap[sectionType] || sectionType;
    const description = sectionTypeDescriptionMap[sectionType] || "화면 섹션";
    return {
      label: `${typeLabel} 섹션`,
      labelMarkdown: [
        `**${typeLabel} 섹션**`,
        "",
        `- 역할: ${description}`,
        `- 섹션 이름: ${sectionName || sectionType}`,
        `- 생성 방식: screen scaffold 워크플로`
      ].join("\n")
    };
  };
  const resolveDesignSystemMatch = async (kind, name) => {
    if (!name) {
      return null;
    }

    const result = await performDesignSystemSearch(pluginId, {
      query: name,
      kinds: [kind],
      sources: ["local-file"],
      maxResults: 10
    });

    const matches = Array.isArray(result?.matches) ? result.matches : [];
    return (
      matches.find((match) => String(match?.name || "").trim() === name) ||
      matches[0] ||
      null
    );
  };

  const headerTitleStyleMatch = await resolveDesignSystemMatch(
    "styles",
    SCREEN_FALLBACK_TYPO.headerTitleStyle
  );
  const contentTitleStyleMatch = await resolveDesignSystemMatch(
    "styles",
    SCREEN_FALLBACK_TYPO.contentTitleStyle
  );
  const contentBodyStyleMatch = await resolveDesignSystemMatch(
    "styles",
    SCREEN_FALLBACK_TYPO.contentBodyStyle
  );
  const textColorVariableMatch = await resolveDesignSystemMatch(
    "variables",
    SCREEN_FALLBACK_TYPO.textColorVariable
  );

  let rootNodeId = plan.targetRootId || null;

  if (!rootNodeId) {
    const root = await executePluginCommand(pluginId, "create_node", {
      parentId: plan.parentId,
      nodeType: "FRAME",
      name: plan.name,
      width: plan.width,
      height: plan.height,
      x: plan.x,
      y: plan.y,
      fillColor: plan.backgroundColor
    });

    rootNodeId = root?.created?.id;
    if (!rootNodeId) {
      throw new Error("Failed to create screen root");
    }

    await addAnnotationIfNeeded(rootNodeId, {
      label: "화면 scaffold 루트",
      labelMarkdown: [
        "**화면 scaffold 루트**",
        "",
        "- 역할: 화면의 최상위 레이아웃 컨테이너",
        `- 화면 이름: ${plan.name}`,
        "- 생성 방식: build_screen_from_design_system"
      ].join("\n")
    }, [
      "width",
      "height",
      "fills"
    ]);

    await executePluginCommand(pluginId, "update_node", {
      nodeId: rootNodeId,
      layoutMode: "VERTICAL",
      itemSpacing: plan.sectionGap,
      paddingLeft: plan.paddingX,
      paddingRight: plan.paddingX,
      paddingTop: plan.paddingY,
      paddingBottom: plan.paddingY,
      primaryAxisAlignItems: "MIN",
      counterAxisAlignItems: "MIN",
      primaryAxisSizingMode: "FIXED",
      counterAxisSizingMode: "FIXED"
    });
  }

  const blueprints = buildSectionBlueprints(plan);
  const sections = [];

  for (const blueprint of blueprints) {
    if (plan.replaceExistingSections) {
      const existing = await executePluginCommand(pluginId, "search_nodes", {
        targetNodeId: rootNodeId,
        query: blueprint.name,
        maxDepth: 1,
        maxResults: 20
      });
      const directMatches = Array.isArray(existing?.matches)
        ? existing.matches.filter(
            (match) =>
              Number(match?.depth) === 1 &&
              String(match?.name || "").trim() === blueprint.name
          )
        : [];
      for (const match of directMatches) {
        await executePluginCommand(pluginId, "delete_node", {
          nodeId: match.id
        });
      }
    }
  }

  const createdSectionsResult = await executePluginCommand(pluginId, "bulk_create_nodes", {
    nodes: blueprints.map((blueprint) => ({
      parentId: rootNodeId,
      nodeType: "FRAME",
      name: blueprint.name,
      width: plan.width - plan.paddingX * 2,
      height: blueprint.height,
      fillColor: "#FFFFFF"
    }))
  });

  const createdSections = Array.isArray(createdSectionsResult?.created?.created)
    ? createdSectionsResult.created.created
    : [];

  if (createdSections.length !== blueprints.length) {
    throw new Error("Failed to create one or more screen sections");
  }

  await executePluginCommand(pluginId, "bulk_update_nodes", {
    updates: createdSections.map((created, index) => {
      const blueprint = blueprints[index];
      return {
        nodeId: created.id,
        layoutMode: blueprint.layoutMode,
        itemSpacing: blueprint.itemSpacing,
        paddingLeft: blueprint.paddingLeft,
        paddingRight: blueprint.paddingRight,
        paddingTop: blueprint.paddingTop,
        paddingBottom: blueprint.paddingBottom,
        primaryAxisAlignItems: blueprint.primaryAxisAlignItems,
        counterAxisAlignItems: blueprint.counterAxisAlignItems,
        primaryAxisSizingMode: blueprint.primaryAxisSizingMode,
        counterAxisSizingMode: blueprint.counterAxisSizingMode,
        layoutAlign: blueprint.layoutAlign,
        layoutGrow: blueprint.layoutGrow
      };
    })
  });

  for (let index = 0; index < blueprints.length; index += 1) {
    const blueprint = blueprints[index];
    const created = createdSections[index];
    const nodeId = created.id;

    sections.push({
      key: blueprint.key,
      type: blueprint.type,
      name: blueprint.name,
      id: nodeId,
      spec:
        Array.isArray(plan.sectionSpecs)
          ? plan.sectionSpecs.find((item) => item.key === blueprint.key) || null
          : null
    });

    await addAnnotationIfNeeded(nodeId, buildSectionAnnotation(blueprint.type, blueprint.name), [
      "layoutMode",
      "padding",
      "itemSpacing"
    ]);
  }

  const setFirstTextProperty = async (nodeId, value) => {
    if (!nodeId || !value) {
      return false;
    }

    try {
      const properties = await executePluginCommand(pluginId, "list_component_properties", {
        targetNodeId: nodeId
      });
      const entries = Array.isArray(properties?.properties) ? properties.properties : [];
      const textProperty = entries.find((entry) => entry.type === "TEXT");
      if (!textProperty) {
        return false;
      }

      await executePluginCommand(pluginId, "set_component_properties", {
        nodeId,
        properties: {
          [textProperty.name]: value
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  };

  const createTextNode = async (parentId, options) => {
    const created = await executePluginCommand(pluginId, "create_node", {
      parentId,
      nodeType: "TEXT",
      name: options.name,
      characters: options.characters,
      fontFamily: options.fontFamily || "SF Compact Text",
      fontStyle: options.fontStyle || "Regular",
      fontSize: options.fontSize,
      width: options.width,
      height: options.height
    });

    const nodeId = created?.created?.id || null;
    if (!nodeId) {
      return null;
    }

    if (options.styleId || options.styleKey) {
      await executePluginCommand(pluginId, "apply_style", {
        nodeId,
        styleType: "text",
        styleId: options.styleId,
        styleKey: options.styleKey
      });
    }

    if (options.textColorVariableId || options.textColorVariableKey) {
      await executePluginCommand(pluginId, "bind_variable", {
        nodeId,
        property: "fills.color",
        variableId: options.textColorVariableId,
        variableKey: options.textColorVariableKey
      });
    }

    return nodeId;
  };

  const bulkCreateTextNodes = async (items = []) => {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const result = await executePluginCommand(pluginId, "bulk_create_nodes", {
      nodes: items.map((item) => ({
        parentId: item.parentId,
        nodeType: "TEXT",
        name: item.name,
        characters: item.characters,
        fontFamily: item.fontFamily || "SF Compact Text",
        fontStyle: item.fontStyle || "Regular",
        fontSize: item.fontSize,
        width: item.width,
        height: item.height
      }))
    });

    const created = Array.isArray(result?.created?.created) ? result.created.created : [];
    const pendingTextColorBindings = [];

    for (let index = 0; index < created.length; index += 1) {
      const node = created[index];
      const item = items[index];
      if (!node || !item) {
        continue;
      }

      if (item.styleId || item.styleKey) {
        await executePluginCommand(pluginId, "apply_style", {
          nodeId: node.id,
          styleType: "text",
          styleId: item.styleId,
          styleKey: item.styleKey
        });
      }

      if (item.textColorVariableId || item.textColorVariableKey) {
        pendingTextColorBindings.push({
          nodeId: node.id,
          property: "fills.color",
          variableId: item.textColorVariableId,
          variableKey: item.textColorVariableKey
        });
      }
    }

    if (pendingTextColorBindings.length > 0) {
      await executePluginCommand(pluginId, "bulk_bind_variables", {
        bindings: pendingTextColorBindings
      });
    }

    return created.map((node) => node.id);
  };

  const createPanelFrame = async (parentId, options = {}) => {
    const created = await executePluginCommand(pluginId, "create_node", {
      parentId,
      nodeType: "FRAME",
      name: options.name || "panel",
      width: options.width,
      height: options.height,
      fillColor: options.fillColor || "#FFFFFF",
      cornerRadius:
        typeof options.cornerRadius === "number" ? options.cornerRadius : 16
    });

    const nodeId = created?.created?.id || null;
    if (!nodeId) {
      return null;
    }

    await executePluginCommand(pluginId, "update_node", {
      nodeId,
      layoutMode: options.layoutMode || "VERTICAL",
      itemSpacing:
        typeof options.itemSpacing === "number" ? options.itemSpacing : 12,
      paddingLeft:
        typeof options.paddingLeft === "number" ? options.paddingLeft : 16,
      paddingRight:
        typeof options.paddingRight === "number" ? options.paddingRight : 16,
      paddingTop:
        typeof options.paddingTop === "number" ? options.paddingTop : 16,
      paddingBottom:
        typeof options.paddingBottom === "number" ? options.paddingBottom : 16,
      primaryAxisAlignItems: options.primaryAxisAlignItems || "MIN",
      counterAxisAlignItems: options.counterAxisAlignItems || "MIN",
      primaryAxisSizingMode: options.primaryAxisSizingMode || "AUTO",
      counterAxisSizingMode: options.counterAxisSizingMode || "AUTO",
      layoutAlign: options.layoutAlign || "STRETCH",
      layoutGrow: options.layoutGrow
    });

    return nodeId;
  };

  const createRectangleNode = async (parentId, options = {}) => {
    const created = await executePluginCommand(pluginId, "create_node", {
      parentId,
      nodeType: "RECTANGLE",
      name: options.name || "block",
      width: options.width,
      height: options.height,
      fillColor: options.fillColor || "#E9EEF5",
      cornerRadius:
        typeof options.cornerRadius === "number" ? options.cornerRadius : 8
    });

    const nodeId = created?.created?.id || null;
    if (!nodeId) {
      return null;
    }

    if (
      options.layoutAlign ||
      typeof options.layoutGrow === "number" ||
      typeof options.visible === "boolean"
    ) {
      await executePluginCommand(pluginId, "update_node", {
        nodeId,
        layoutAlign: options.layoutAlign,
        layoutGrow: options.layoutGrow,
        visible: options.visible
      });
    }

    return nodeId;
  };

  const createStackFrame = async (parentId, options = {}) => {
    const created = await executePluginCommand(pluginId, "create_node", {
      parentId,
      nodeType: "FRAME",
      name: options.name || "stack",
      width: options.width,
      height: options.height,
      fillColor: options.fillColor,
      cornerRadius:
        typeof options.cornerRadius === "number" ? options.cornerRadius : undefined
    });

    const nodeId = created?.created?.id || null;
    if (!nodeId) {
      return null;
    }

    await executePluginCommand(pluginId, "update_node", {
      nodeId,
      layoutMode: options.layoutMode || "VERTICAL",
      itemSpacing:
        typeof options.itemSpacing === "number" ? options.itemSpacing : 8,
      paddingLeft:
        typeof options.paddingLeft === "number" ? options.paddingLeft : 0,
      paddingRight:
        typeof options.paddingRight === "number" ? options.paddingRight : 0,
      paddingTop:
        typeof options.paddingTop === "number" ? options.paddingTop : 0,
      paddingBottom:
        typeof options.paddingBottom === "number" ? options.paddingBottom : 0,
      primaryAxisAlignItems: options.primaryAxisAlignItems || "MIN",
      counterAxisAlignItems: options.counterAxisAlignItems || "MIN",
      primaryAxisSizingMode: options.primaryAxisSizingMode || "AUTO",
      counterAxisSizingMode: options.counterAxisSizingMode || "AUTO",
      layoutAlign: options.layoutAlign || "STRETCH",
      layoutGrow: options.layoutGrow
    });

    return nodeId;
  };

  const bulkCreateFrames = async (items = []) => {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const result = await executePluginCommand(pluginId, "bulk_create_nodes", {
      nodes: items.map((item) => ({
        parentId: item.parentId,
        nodeType: "FRAME",
        name: item.name || "frame",
        width: item.width,
        height: item.height,
        fillColor: item.fillColor,
        cornerRadius: item.cornerRadius
      }))
    });

    const created = Array.isArray(result?.created?.created) ? result.created.created : [];

    if (created.length > 0) {
      await executePluginCommand(pluginId, "bulk_update_nodes", {
        updates: created.map((node, index) => {
          const item = items[index];
          return {
            nodeId: node.id,
            layoutMode: item.layoutMode || "VERTICAL",
            itemSpacing:
              typeof item.itemSpacing === "number" ? item.itemSpacing : 8,
            paddingLeft:
              typeof item.paddingLeft === "number" ? item.paddingLeft : 0,
            paddingRight:
              typeof item.paddingRight === "number" ? item.paddingRight : 0,
            paddingTop:
              typeof item.paddingTop === "number" ? item.paddingTop : 0,
            paddingBottom:
              typeof item.paddingBottom === "number" ? item.paddingBottom : 0,
            primaryAxisAlignItems: item.primaryAxisAlignItems || "MIN",
            counterAxisAlignItems: item.counterAxisAlignItems || "MIN",
            primaryAxisSizingMode: item.primaryAxisSizingMode || "AUTO",
            counterAxisSizingMode: item.counterAxisSizingMode || "AUTO",
            layoutAlign: item.layoutAlign || "STRETCH",
            layoutGrow: item.layoutGrow
          };
        })
      });
    }

    return created.map((node) => node.id);
  };

  const buildSummaryCardRecipe = (section) => {
    const name = String(section?.name || "").toLowerCase();
    if (name.includes("overall") || name.includes("task")) {
      return {
        value: "23",
        unit: "Tasks",
        trend: "+6.4%",
        accent: "#5B8DEF",
        bars: [0.62, 0.24, 0.14]
      };
    }
    if (name.includes("track")) {
      return {
        value: "4892",
        unit: "Referral",
        trend: "+12.2%",
        accent: "#34C759",
        bars: [0.38, 0.52, 0.31, 0.46]
      };
    }
    return {
      value: "89%",
      unit: "Progress",
      trend: "+10.2%",
      accent: "#32C997",
      bars: [0.74, 0.59, 0.66, 0.81, 0.72]
    };
  };

  const populateSummaryCardVisuals = async (section, parentId) => {
    const recipe = buildSummaryCardRecipe(section);
    const statRowId = await createStackFrame(parentId, {
      name: "stat-row",
      layoutMode: "HORIZONTAL",
      itemSpacing: 12,
      counterAxisAlignItems: "CENTER",
      primaryAxisSizingMode: "AUTO",
      counterAxisSizingMode: "AUTO"
    });
    if (!statRowId) {
      return;
    }

    await createTextNode(statRowId, {
      name: "value",
      characters: recipe.value,
      fontStyle: "Semibold",
      fontSize: 34,
      width: 140,
      height: 44,
      styleId: contentTitleStyleMatch?.id,
      styleKey: contentTitleStyleMatch?.key,
      textColorVariableId: textColorVariableMatch?.id,
      textColorVariableKey: textColorVariableMatch?.key
    });
    await createTextNode(statRowId, {
      name: "unit",
      characters: recipe.unit,
      fontSize: 16,
      width: 120,
      height: 24,
      styleId: contentBodyStyleMatch?.id,
      styleKey: contentBodyStyleMatch?.key,
      textColorVariableId: textColorVariableMatch?.id,
      textColorVariableKey: textColorVariableMatch?.key
    });
    const trendChipId = await createStackFrame(parentId, {
      name: "trend-chip",
      layoutMode: "HORIZONTAL",
      itemSpacing: 4,
      paddingLeft: 10,
      paddingRight: 10,
      paddingTop: 6,
      paddingBottom: 6,
      counterAxisAlignItems: "CENTER",
      fillColor: "#EAF8F0",
      cornerRadius: 999
    });
    if (trendChipId) {
      await createTextNode(trendChipId, {
        name: "trend",
        characters: recipe.trend,
        fontSize: 14,
        width: 72,
        height: 20,
        fontStyle: "Semibold"
      });
    }

    const barsRowId = await createStackFrame(parentId, {
      name: "bar-chart",
      layoutMode: "HORIZONTAL",
      itemSpacing: 10,
      counterAxisAlignItems: "MAX",
      primaryAxisSizingMode: "AUTO",
      counterAxisSizingMode: "AUTO"
    });
    if (!barsRowId) {
      return;
    }
    const groupIds = await bulkCreateFrames(
      recipe.bars.map((ratio, index) => ({
        parentId: barsRowId,
        name: `bar-group-${index + 1}`,
        layoutMode: "VERTICAL",
        itemSpacing: 0,
        primaryAxisAlignItems: "MAX",
        counterAxisAlignItems: "CENTER",
        width: 24,
        height: 84,
        primaryAxisSizingMode: "FIXED",
        counterAxisSizingMode: "FIXED"
      }))
    );
    for (let index = 0; index < recipe.bars.length; index += 1) {
      const ratio = recipe.bars[index];
      const groupId = groupIds[index];
      await executePluginCommand(pluginId, "bulk_create_nodes", {
        nodes: [
          {
            parentId: groupId,
            nodeType: "RECTANGLE",
            name: "spacer",
            width: 24,
            height: Math.max(8, Math.round(84 * (1 - ratio))),
            fillColor: "#FFFFFF",
            cornerRadius: 0
          },
          {
            parentId: groupId,
            nodeType: "RECTANGLE",
            name: "bar",
            width: 24,
            height: Math.max(12, Math.round(84 * ratio)),
            fillColor: recipe.accent,
            cornerRadius: 8
          }
        ]
      });
    }
  };

  const populateTimelineVisuals = async (section, parentId) => {
    const hoursId = await createStackFrame(parentId, {
      name: "hours",
      layoutMode: "HORIZONTAL",
      itemSpacing: 18,
      primaryAxisSizingMode: "AUTO",
      counterAxisSizingMode: "AUTO"
    });
    const hourLabels = ["08:00", "10:00", "12:00", "14:00", "16:00"];
    await bulkCreateTextNodes(
      hourLabels.map((hour) => ({
        parentId: hoursId,
        name: "hour",
        characters: hour,
        fontSize: 12,
        width: 54,
        height: 18,
        styleId: contentBodyStyleMatch?.id,
        styleKey: contentBodyStyleMatch?.key
      }))
    );

    const lanesId = await createStackFrame(parentId, {
      name: "events",
      layoutMode: "VERTICAL",
      itemSpacing: 10
    });
    const events = [
      { label: "Meeting Brief Project", fill: "#E8F1FE" },
      { label: "Build Website & Mobile", fill: "#E6F8EE" },
      { label: "Review & Feedback", fill: "#FFF4E5" }
    ];
    const pillIds = await bulkCreateFrames(
      events.map((event) => ({
        parentId: lanesId,
        name: "event-pill",
        layoutMode: "HORIZONTAL",
        itemSpacing: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        paddingBottom: 10,
        fillColor: event.fill,
        cornerRadius: 12
      }))
    );
    await bulkCreateTextNodes(
      events.map((event, index) => ({
        parentId: pillIds[index],
        name: "event-label",
        characters: event.label,
        fontSize: 14,
        width: 220,
        height: 20,
        styleId: contentBodyStyleMatch?.id,
        styleKey: contentBodyStyleMatch?.key,
        textColorVariableId: textColorVariableMatch?.id,
        textColorVariableKey: textColorVariableMatch?.key
      }))
    );
  };

  const populateTableVisuals = async (section, parentId) => {
    const toolbarId = await createStackFrame(parentId, {
      name: "toolbar",
      layoutMode: "HORIZONTAL",
      itemSpacing: 12,
      primaryAxisSizingMode: "AUTO",
      counterAxisSizingMode: "AUTO"
    });
    const searchId = await createPanelFrame(toolbarId, {
      name: "search",
      layoutMode: "HORIZONTAL",
      itemSpacing: 8,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
      fillColor: "#F5F7FB",
      cornerRadius: 12
    });
    await createTextNode(searchId, {
      name: "placeholder",
      characters: "Search task...",
      fontSize: 14,
      width: 120,
      height: 20,
      styleId: contentBodyStyleMatch?.id,
      styleKey: contentBodyStyleMatch?.key
    });
    const filterId = await createPanelFrame(toolbarId, {
      name: "filter",
      layoutMode: "HORIZONTAL",
      itemSpacing: 6,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 10,
      paddingBottom: 10,
      fillColor: "#FFFFFF",
      cornerRadius: 12
    });
    await createTextNode(filterId, {
      name: "filter-label",
      characters: "Filter",
      fontSize: 14,
      width: 48,
      height: 20,
      styleId: contentBodyStyleMatch?.id,
      styleKey: contentBodyStyleMatch?.key
    });

    const headerRowId = await createStackFrame(parentId, {
      name: "table-head",
      layoutMode: "HORIZONTAL",
      itemSpacing: 16,
      paddingTop: 8,
      paddingBottom: 8
    });
    await bulkCreateTextNodes(
      ["Project", "Due", "Status", "Progress"].map((label) => ({
        parentId: headerRowId,
        name: "th",
        characters: label,
        fontSize: 13,
        width: 120,
        height: 18,
        fontStyle: "Semibold",
        styleId: contentBodyStyleMatch?.id,
        styleKey: contentBodyStyleMatch?.key
      }))
    );

    const rowsId = await createStackFrame(parentId, {
      name: "table-rows",
      layoutMode: "VERTICAL",
      itemSpacing: 8
    });
    const rows = [
      ["Vortex", "Sept 24, 2025", "Active", "40%"],
      ["Energy", "Sept 24, 2025", "Active", "65%"],
      ["Eyez", "Sept 24, 2025", "Active", "90%"]
    ];
    const rowIds = await bulkCreateFrames(
      rows.map(() => ({
        parentId: rowsId,
        name: "row",
        layoutMode: "HORIZONTAL",
        itemSpacing: 16,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 12,
        paddingBottom: 12,
        fillColor: "#FFFFFF",
        cornerRadius: 12
      }))
    );
    await bulkCreateTextNodes(
      rows.flatMap((row, rowIndex) =>
        row.map((cell) => ({
          parentId: rowIds[rowIndex],
          name: "td",
          characters: cell,
          fontSize: 14,
          width: 120,
          height: 20,
          styleId: contentBodyStyleMatch?.id,
          styleKey: contentBodyStyleMatch?.key,
          textColorVariableId: textColorVariableMatch?.id,
          textColorVariableKey: textColorVariableMatch?.key
        }))
      )
    );
  };

  const findSectionByTypes = (...types) =>
    sections.find((section) => types.includes(section.type || section.key));
  const resolveSectionContentParent = async (section) => {
    if (!section) {
      return null;
    }

    if (section.contentParentId) {
      return section.contentParentId;
    }

    const panelLikeTypes = ["summary-cards", "timeline", "table", "list", "form"];
    if (!panelLikeTypes.includes(section.type)) {
      section.contentParentId = section.id;
      return section.id;
    }

    const panelNodeId = await createPanelFrame(section.id, {
      name: `${section.name}-panel`,
      itemSpacing: 10,
      layoutGrow: section.type === "table" ? 1 : undefined
    });

    if (panelNodeId) {
      section.contentParentId = panelNodeId;
      await addAnnotationIfNeeded(
        panelNodeId,
        {
          label: "내부 패널",
          labelMarkdown: [
            "**내부 패널**",
            "",
            `- 섹션 타입: ${section.type}`,
            "- 목적: 레퍼런스 화면의 카드/패널 구조를 가깝게 재현하기 위한 fallback 컨테이너"
          ].join("\n")
        },
        ["fills", "cornerRadius", "padding", "itemSpacing"]
      );
      return panelNodeId;
    }

    section.contentParentId = section.id;
    return section.id;
  };

  const resolveHeaderPayload = (section) => ({
    query: section?.spec?.headerQuery || plan.headerQuery,
    title: section?.spec?.headerTitle || plan.headerTitle
  });

  const resolveContentPayload = (section) => ({
    title: section?.spec?.contentTitle || plan.contentTitle,
    body: section?.spec?.contentBody || plan.contentBody,
    componentQueries:
      Array.isArray(section?.spec?.contentComponentQueries) &&
      section.spec.contentComponentQueries.length > 0
        ? section.spec.contentComponentQueries
        : plan.contentComponentQueries
  });

  const resolveActionPayload = (section) => ({
    query: section?.spec?.primaryActionQuery || plan.primaryActionQuery,
    label: section?.spec?.primaryActionLabel || plan.primaryActionLabel
  });

  {
    const headerSection = findSectionByTypes("header", "navigation");
    const headerPayload = resolveHeaderPayload(headerSection);
      if (headerPayload.query || headerPayload.title) {
      if (!headerSection) {
        throw new Error("No header-capable section available");
      }
      let headerNodeId = null;
      let headerResult = "fallback";

      if (headerPayload.query) {
        const headerComponent = await performFindOrImportComponent(pluginId, {
          query: headerPayload.query,
          parentId: headerSection.id
        });

        if (headerComponent.action === "found_local") {
          const created = await executePluginCommand(pluginId, "create_instance", {
            sourceNodeId: headerComponent.match.nodeId,
            parentId: headerSection.id
          });
          headerNodeId = created?.created?.id || null;
          headerResult = headerComponent.action;
        } else if (headerComponent.action === "imported_library") {
          headerNodeId = headerComponent.imported?.imported?.id || headerComponent.imported?.id || null;
          headerResult = headerComponent.action;
        }
      }

      if (headerNodeId && headerPayload.title) {
        const applied = await setFirstTextProperty(headerNodeId, headerPayload.title);
        if (!applied) {
          const fallbackTitleNodeId = await createTextNode(headerSection.id, {
            name: "title",
            characters: headerPayload.title,
            fontSize: 20,
            width: 220,
            height: 28,
            fontStyle: "Semibold",
            styleId: headerTitleStyleMatch?.id,
            styleKey: headerTitleStyleMatch?.key,
            textColorVariableId: textColorVariableMatch?.id,
            textColorVariableKey: textColorVariableMatch?.key
          });
          await addAnnotationIfNeeded(
            fallbackTitleNodeId,
            {
              label: "헤더 fallback 타이틀",
              labelMarkdown: [
                "**헤더 fallback 타이틀**",
                "",
                "- 이유: 재사용 가능한 헤더 컴포넌트의 텍스트 프로퍼티를 찾지 못해 fallback으로 생성됨",
                `- 적용 스타일: ${SCREEN_FALLBACK_TYPO.headerTitleStyle}`,
                `- 적용 변수: ${SCREEN_FALLBACK_TYPO.textColorVariable}`
              ].join("\n")
            },
            ["textStyleId", "fills", "fontSize"]
          );
        }
      } else if (headerPayload.title) {
        const fallbackTitleNodeId = await createTextNode(headerSection.id, {
          name: "title",
          characters: headerPayload.title,
          fontSize: 20,
          width: 220,
          height: 28,
          fontStyle: "Semibold",
          styleId: headerTitleStyleMatch?.id,
          styleKey: headerTitleStyleMatch?.key,
          textColorVariableId: textColorVariableMatch?.id,
          textColorVariableKey: textColorVariableMatch?.key
        });
        headerNodeId = fallbackTitleNodeId || headerNodeId;
        await addAnnotationIfNeeded(
          fallbackTitleNodeId,
          {
            label: "헤더 fallback 타이틀",
            labelMarkdown: [
              "**헤더 fallback 타이틀**",
              "",
              "- 이유: 헤더 컴포넌트 대신 fallback 텍스트로 생성됨",
              `- 적용 스타일: ${SCREEN_FALLBACK_TYPO.headerTitleStyle}`,
              `- 적용 변수: ${SCREEN_FALLBACK_TYPO.textColorVariable}`
            ].join("\n")
          },
          ["textStyleId", "fills", "fontSize"]
        );
      }

      if (headerNodeId && headerResult !== "fallback") {
        await addAnnotationIfNeeded(headerNodeId, {
          label: "헤더 재사용 컴포넌트",
          labelMarkdown: [
            "**헤더 재사용 컴포넌트**",
            "",
            `- 소스: ${headerPayload.query || "local design system"}`,
            "- 처리 방식: find_or_import_component 후 인스턴스 배치",
            "- 상태: 디자인 시스템 자산 재사용"
          ].join("\n")
        }, [
          "mainComponent"
        ]);
      }

      headerSection.headerContent = {
        query: headerPayload.query || null,
        title: headerPayload.title || null,
        nodeId: headerNodeId,
        result: headerResult
      };
    }
  }

  {
    const actionsSection = findSectionByTypes("actions", "form", "table", "list");
    const actionPayload = resolveActionPayload(actionsSection);
      if (actionPayload.query) {
      if (!actionsSection) {
        throw new Error("No action-capable section available");
      }
      const actionComponent = await performFindOrImportComponent(pluginId, {
        query: actionPayload.query,
        parentId: actionsSection.id
      });

      let instanceNodeId = null;
        if (actionComponent.action === "found_local") {
          const created = await executePluginCommand(pluginId, "create_instance", {
            sourceNodeId: actionComponent.match.nodeId,
            parentId: actionsSection.id,
            name: actionPayload.label
          });
          instanceNodeId = created?.created?.id || null;
      } else if (actionComponent.action === "imported_library") {
        instanceNodeId = actionComponent.imported?.imported?.id || actionComponent.imported?.id || null;
      }

      if (instanceNodeId && actionPayload.label) {
        await setFirstTextProperty(instanceNodeId, actionPayload.label);
      }

      if (instanceNodeId) {
        await addAnnotationIfNeeded(instanceNodeId, {
          label: "액션 재사용 컴포넌트",
          labelMarkdown: [
            "**액션 재사용 컴포넌트**",
            "",
            `- 소스: ${actionPayload.query}`,
            `- 라벨: ${actionPayload.label || "기본값 유지"}`,
            "- 상태: 디자인 시스템 액션 컴포넌트 재사용"
          ].join("\n")
        }, [
          "mainComponent",
          "padding",
          "fills"
        ]);
      }

      actionsSection.primaryAction = {
        query: actionPayload.query,
        nodeId: instanceNodeId,
        result: actionComponent.action
      };
    }
  }

  {
    const contentSections = sections.filter((section) =>
      ["content", "summary-cards", "timeline", "table", "list", "form"].includes(
        section.type || section.key
      )
    );

    for (const contentSection of contentSections) {
      const contentPayload = resolveContentPayload(contentSection);

      if (contentPayload.title || contentPayload.body) {
        const contentParentId = await resolveSectionContentParent(contentSection);
        const contentNodes = [];

        if (contentPayload.title) {
          const titleNodeId = await createTextNode(contentParentId, {
            name: "title",
            characters: contentPayload.title,
            fontStyle: "Semibold",
            fontSize: 28,
            width: plan.width - plan.paddingX * 2,
            height: 36,
            styleId: contentTitleStyleMatch?.id,
            styleKey: contentTitleStyleMatch?.key,
            textColorVariableId: textColorVariableMatch?.id,
            textColorVariableKey: textColorVariableMatch?.key
          });
          if (titleNodeId) {
            await addAnnotationIfNeeded(titleNodeId, {
              label: "콘텐츠 fallback 제목",
              labelMarkdown: [
                "**콘텐츠 fallback 제목**",
                "",
                "- 이유: 재사용 가능한 콘텐츠 컴포넌트 없이 fallback 텍스트로 생성됨",
                `- 적용 스타일: ${SCREEN_FALLBACK_TYPO.contentTitleStyle}`,
                `- 적용 변수: ${SCREEN_FALLBACK_TYPO.textColorVariable}`
              ].join("\n")
            }, ["textStyleId", "fills", "fontSize"]);
            contentNodes.push({
              type: "title",
              nodeId: titleNodeId
            });
          }
        }

        if (contentPayload.body) {
          const bodyNodeId = await createTextNode(contentParentId, {
            name: "body",
            characters: contentPayload.body,
            fontStyle: "Regular",
            fontSize: 16,
            width: plan.width - plan.paddingX * 2,
            height: 72,
            styleId: contentBodyStyleMatch?.id,
            styleKey: contentBodyStyleMatch?.key,
            textColorVariableId: textColorVariableMatch?.id,
            textColorVariableKey: textColorVariableMatch?.key
          });
          if (bodyNodeId) {
            await addAnnotationIfNeeded(bodyNodeId, {
              label: "콘텐츠 fallback 본문",
              labelMarkdown: [
                "**콘텐츠 fallback 본문**",
                "",
                "- 이유: 재사용 가능한 본문 블록 없이 fallback 텍스트로 생성됨",
                `- 적용 스타일: ${SCREEN_FALLBACK_TYPO.contentBodyStyle}`,
                `- 적용 변수: ${SCREEN_FALLBACK_TYPO.textColorVariable}`
              ].join("\n")
            }, [
              "textStyleId",
              "fills",
              "fontSize"
            ]);
            contentNodes.push({
              type: "body",
              nodeId: bodyNodeId
            });
          }
        }

        contentSection.contentBlocks = contentNodes;
      }

      if (!contentSection.visualRecipeApplied) {
        const contentParentId =
          contentSection.contentParentId || (await resolveSectionContentParent(contentSection));

        if (contentSection.type === "summary-cards") {
          await populateSummaryCardVisuals(contentSection, contentParentId);
          contentSection.visualRecipeApplied = "summary-cards";
        } else if (contentSection.type === "timeline") {
          await populateTimelineVisuals(contentSection, contentParentId);
          contentSection.visualRecipeApplied = "timeline";
        } else if (contentSection.type === "table") {
          await populateTableVisuals(contentSection, contentParentId);
          contentSection.visualRecipeApplied = "table";
        }
      }

      if (contentPayload.componentQueries && contentPayload.componentQueries.length > 0) {
        const contentParentId = await resolveSectionContentParent(contentSection);
        const contentComponents = [];

        for (const query of contentPayload.componentQueries) {
          const contentComponent = await performFindOrImportComponent(pluginId, {
            query,
            parentId: contentParentId
          });

          let instanceNodeId = null;
          if (contentComponent.action === "found_local") {
            const created = await executePluginCommand(pluginId, "create_instance", {
              sourceNodeId: contentComponent.match.nodeId,
              parentId: contentParentId
            });
            instanceNodeId = created?.created?.id || null;
          } else if (contentComponent.action === "imported_library") {
            instanceNodeId =
              contentComponent.imported?.imported?.id ||
              contentComponent.imported?.id ||
              null;
          }

          contentComponents.push({
            query,
            nodeId: instanceNodeId,
            result: contentComponent.action
          });

          if (instanceNodeId) {
            await addAnnotationIfNeeded(
              instanceNodeId,
              {
                label: `콘텐츠 재사용 컴포넌트: ${query}`,
                labelMarkdown: [
                  `**콘텐츠 재사용 컴포넌트: ${query}**`,
                  "",
                  `- 소스 쿼리: ${query}`,
                  "- 처리 방식: find_or_import_component 후 인스턴스 배치",
                  "- 상태: 디자인 시스템 콘텐츠 자산 재사용"
                ].join("\n")
              },
              ["mainComponent"]
            );
          }
        }

        contentSection.contentComponents = contentComponents;
      }
    }
  }

  if (plan.annotate && pendingAnnotations.length > 0) {
    try {
      const result = await executePluginCommand(pluginId, "bulk_add_annotations", {
        annotations: pendingAnnotations.map((item) => ({
          targetNodeId: item.targetNodeId,
          label: item.label,
          labelMarkdown: item.labelMarkdown,
          replace: item.replace,
          properties: item.properties
        }))
      });
      const annotated = Array.isArray(result?.annotated?.annotated)
        ? result.annotated.annotated
        : [];
      pendingAnnotations.forEach((item, index) => {
        annotationResults.push({
          targetNodeId: item.targetNodeId,
          label: item.__meta.label,
          labelMarkdown: item.__meta.labelMarkdown,
          properties: item.__meta.properties,
          result: annotated[index] || null
        });
      });
    } catch (error) {
      pendingAnnotations.forEach((item) => {
        annotationResults.push({
          targetNodeId: item.targetNodeId,
          label: item.__meta.label,
          labelMarkdown: item.__meta.labelMarkdown,
          properties: item.__meta.properties,
          error: error.message
        });
      });
    }
  }

  return {
    root: {
      id: rootNodeId,
      name: plan.name
    },
    sections,
    plan,
    annotationsApplied: {
      enabled: Boolean(plan.annotate),
      count: annotationResults.filter((item) => !item.error).length,
      results: annotationResults
    }
  };
}

async function performBuildFinanceSummaryMock(pluginId, input = {}) {
  const plan = buildFinanceSummaryMockPlan(input);
  const rootResult = await executePluginCommand(pluginId, "create_node", {
    parentId: plan.parentId,
    nodeType: "FRAME",
    name: plan.name,
    width: plan.width,
    height: plan.height,
    x: plan.x,
    y: plan.y,
    fillColor: "#FFFFFF"
  });

  const rootNodeId = rootResult?.created?.id;
  if (!rootNodeId) {
    throw new Error("Failed to create finance summary root frame");
  }

  const nodes = [
    { nodeType: "TEXT", name: "time", characters: "12:58", fontSize: 27, x: 48, y: 28 },
    { nodeType: "RECTANGLE", name: "battery", width: 42, height: 28, x: 585, y: 28, fillColor: "#111111", cornerRadius: 8 },
    { nodeType: "TEXT", name: "battery-label", characters: "86", fontSize: 16, x: 594, y: 34 },
    { nodeType: "RECTANGLE", name: "battery-tip", width: 3, height: 12, x: 628, y: 36, fillColor: "#CCCCCC", cornerRadius: 2 },
    { nodeType: "TEXT", name: "search", characters: "⌕", fontSize: 38, x: 48, y: 96 },
    { nodeType: "TEXT", name: "filter", characters: "▽", fontSize: 42, x: 565, y: 100 },
    { nodeType: "TEXT", name: "hero-label", characters: "Net total", fontSize: 28, x: 207, y: 196 },
    { nodeType: "RECTANGLE", name: "year-chip", width: 128, height: 40, x: 318, y: 187, fillColor: "#FFFFFF", cornerRadius: 18 },
    { nodeType: "TEXT", name: "year-chip-text", characters: "this year", fontSize: 24, x: 333, y: 196 },
    { nodeType: "TEXT", name: "symbol", characters: "+₹", fontSize: 58, x: 92, y: 242, opacity: 0.45 },
    { nodeType: "TEXT", name: "total", characters: "41,440.00", fontSize: 90, x: 157, y: 220 },
    { nodeType: "TEXT", name: "income", characters: "+76,000.00", fontSize: 28, x: 156, y: 330, fillColor: "#1CD4AE" },
    { nodeType: "TEXT", name: "divider", characters: "|", fontSize: 28, x: 323, y: 329, opacity: 0.2 },
    { nodeType: "TEXT", name: "expense", characters: "-34,560.00", fontSize: 28, x: 343, y: 330, fillColor: "#F05D57" },
    { nodeType: "TEXT", name: "today-label", characters: "TODAY", fontSize: 22, x: 48, y: 456, opacity: 0.35 },
    { nodeType: "TEXT", name: "today-total", characters: "-₹ 58.00", fontSize: 19, x: 510, y: 458, opacity: 0.35 },
    { nodeType: "RECTANGLE", name: "today-line", width: 556, height: 1, x: 48, y: 494, fillColor: "#F0F0F0" },
    { nodeType: "FRAME", name: "investments-icon-bg", width: 58, height: 58, x: 48, y: 522, fillColor: "#35D95A", cornerRadius: 16 },
    { nodeType: "TEXT", name: "investments-icon", characters: "¥", fontSize: 28, x: 66, y: 534 },
    { nodeType: "RECTANGLE", name: "investments-badge", width: 24, height: 24, x: 84, y: 560, fillColor: "#FFFFFF", cornerRadius: 12 },
    { nodeType: "TEXT", name: "investments-badge-icon", characters: "◔", fontSize: 14, x: 89, y: 564, opacity: 0.5 },
    { nodeType: "TEXT", name: "investments-title", characters: "Investments", fontSize: 28, x: 120, y: 524 },
    { nodeType: "TEXT", name: "investments-time", characters: "12:44 AM", fontSize: 20, x: 120, y: 556, opacity: 0.35 },
    { nodeType: "TEXT", name: "investments-value", characters: "+₹ 1,000.00", fontSize: 29, x: 432, y: 535, fillColor: "#1CD4AE" },
    { nodeType: "FRAME", name: "zoka-icon-bg", width: 58, height: 58, x: 48, y: 603, fillColor: "#5EADF6", cornerRadius: 16 },
    { nodeType: "TEXT", name: "zoka-icon", characters: "≋", fontSize: 26, x: 66, y: 617 },
    { nodeType: "TEXT", name: "zoka-title", characters: "Zoka", fontSize: 28, x: 120, y: 605 },
    { nodeType: "TEXT", name: "zoka-time", characters: "12:31 AM", fontSize: 20, x: 120, y: 637, opacity: 0.35 },
    { nodeType: "TEXT", name: "zoka-value", characters: "-₹ 1,058.00", fontSize: 29, x: 441, y: 616 },
    { nodeType: "TEXT", name: "yesterday-label", characters: "YESTERDAY", fontSize: 22, x: 48, y: 708, opacity: 0.35 },
    { nodeType: "TEXT", name: "yesterday-total", characters: "+₹ 4,700.00", fontSize: 19, x: 469, y: 710, opacity: 0.35 },
    { nodeType: "RECTANGLE", name: "yesterday-line", width: 556, height: 1, x: 48, y: 746, fillColor: "#F0F0F0" },
    { nodeType: "FRAME", name: "taxi-icon-bg", width: 58, height: 58, x: 48, y: 774, fillColor: "#C88DB1", cornerRadius: 16 },
    { nodeType: "TEXT", name: "taxi-icon", characters: "⊞", fontSize: 24, x: 65, y: 790 },
    { nodeType: "TEXT", name: "taxi-title", characters: "Taxi", fontSize: 28, x: 120, y: 776 },
    { nodeType: "TEXT", name: "taxi-time", characters: "12:57 PM", fontSize: 20, x: 120, y: 808, opacity: 0.35 },
    { nodeType: "TEXT", name: "taxi-value", characters: "-₹ 300.00", fontSize: 29, x: 462, y: 787 },
    { nodeType: "FRAME", name: "gifts-icon-bg", width: 58, height: 58, x: 48, y: 855, fillColor: "#7EF0AE", cornerRadius: 16 },
    { nodeType: "TEXT", name: "gifts-icon", characters: "▣", fontSize: 24, x: 67, y: 871 },
    { nodeType: "TEXT", name: "gifts-title", characters: "Gifts", fontSize: 28, x: 120, y: 857 },
    { nodeType: "TEXT", name: "gifts-time", characters: "12:45 PM", fontSize: 20, x: 120, y: 889, opacity: 0.35 },
    { nodeType: "TEXT", name: "gifts-value", characters: "+₹ 5,000.00", fontSize: 29, x: 426, y: 868, fillColor: "#1CD4AE" },
    { nodeType: "TEXT", name: "mon-label", characters: "MON, 6 NOV", fontSize: 22, x: 48, y: 962, opacity: 0.35 },
    { nodeType: "TEXT", name: "mon-total", characters: "-₹ 3,525.00", fontSize: 19, x: 474, y: 964, opacity: 0.35 },
    { nodeType: "RECTANGLE", name: "mon-line", width: 556, height: 1, x: 48, y: 1000, fillColor: "#F0F0F0" },
    { nodeType: "FRAME", name: "fresh-icon-bg", width: 58, height: 58, x: 48, y: 1028, fillColor: "#D08AEF", cornerRadius: 16 },
    { nodeType: "TEXT", name: "fresh-icon", characters: "⊟", fontSize: 24, x: 66, y: 1044 },
    { nodeType: "TEXT", name: "fresh-title", characters: "Expenses at Fresh M...", fontSize: 28, x: 120, y: 1030 },
    { nodeType: "TEXT", name: "fresh-time", characters: "8:36 PM", fontSize: 20, x: 120, y: 1062, opacity: 0.35 },
    { nodeType: "TEXT", name: "fresh-value", characters: "-₹ 3,525.00", fontSize: 29, x: 435, y: 1041 },
    { nodeType: "TEXT", name: "sun-label", characters: "SUN, 5 NOV", fontSize: 22, x: 48, y: 1136, opacity: 0.35 },
    { nodeType: "TEXT", name: "sun-total", characters: "-₹ 2,556.00", fontSize: 19, x: 482, y: 1138, opacity: 0.35 },
    { nodeType: "RECTANGLE", name: "sun-line", width: 556, height: 1, x: 48, y: 1174, fillColor: "#F0F0F0" },
    { nodeType: "FRAME", name: "dog-icon-bg", width: 58, height: 58, x: 48, y: 1202, fillColor: "#8392FA", cornerRadius: 16 },
    { nodeType: "TEXT", name: "dog-icon", characters: "◌", fontSize: 24, x: 67, y: 1218 },
    { nodeType: "TEXT", name: "dog-title", characters: "Dog Food", fontSize: 28, x: 120, y: 1204 },
    { nodeType: "TEXT", name: "dog-time", characters: "1:34 PM", fontSize: 20, x: 120, y: 1236, opacity: 0.35 },
    { nodeType: "TEXT", name: "dog-value", characters: "-₹ 2,556.00", fontSize: 29, x: 435, y: 1215 },
    { nodeType: "TEXT", name: "nav-left", characters: "▤", fontSize: 36, x: 58, y: 1196, opacity: 0.82 },
    { nodeType: "TEXT", name: "nav-pause", characters: "◫", fontSize: 34, x: 170, y: 1199, opacity: 0.18 },
    { nodeType: "RECTANGLE", name: "nav-plus-bg", width: 102, height: 58, x: 274, y: 1190, fillColor: "#3A3838", cornerRadius: 18 },
    { nodeType: "TEXT", name: "nav-plus", characters: "+", fontSize: 44, x: 314, y: 1194, fillColor: "#FFFFFF" },
    { nodeType: "TEXT", name: "nav-grid", characters: "⠿", fontSize: 34, x: 443, y: 1201, opacity: 0.18 },
    { nodeType: "TEXT", name: "nav-hex", characters: "⬢", fontSize: 34, x: 563, y: 1201, opacity: 0.18 },
    { nodeType: "RECTANGLE", name: "home-indicator", width: 144, height: 7, x: 255, y: 1274, fillColor: "#080808", cornerRadius: 999 },
    { nodeType: "RECTANGLE", name: "watermark-bg", width: 652, height: 71, x: 0, y: 1232, fillColor: "#101010" },
    { nodeType: "TEXT", name: "watermark-mark", characters: "✿", fontSize: 28, x: 218, y: 1251, fillColor: "#FFFFFF" },
    { nodeType: "TEXT", name: "watermark-text", characters: "appshots", fontSize: 33, x: 266, y: 1245, fillColor: "#FFFFFF" }
  ].map((node) => ({ parentId: rootNodeId, ...node }));

  const created = await executePluginCommand(pluginId, "bulk_create_nodes", { nodes });
  return {
    plan,
    root: rootResult.created,
    created: created?.created || created,
    createdCount: (created?.created?.count || 0) + 1
  };
}

function resolveAxisAlign(value, fallback = "MIN") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "space-between") {
    return "SPACE_BETWEEN";
  }

  if (normalized === "center") {
    return "CENTER";
  }

  if (normalized === "max" || normalized === "end") {
    return "MAX";
  }

  return fallback;
}

function resolveLayoutSizingMode(mode) {
  if (mode === "fixed" || mode === "fill") {
    return "FIXED";
  }

  return "AUTO";
}

function clampLayoutSize(value, fallback) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value));
}

function estimateTextIntrinsicSize(node) {
  const fontSize =
    typeof node.fontSize === "number" && Number.isFinite(node.fontSize)
      ? node.fontSize
      : 16;
  const text = typeof node.characters === "string" ? node.characters : "";
  const charFactor = /[^\u0000-\u00ff]/.test(text) ? 0.92 : 0.58;
  const width = Math.max(12, Math.ceil(text.length * fontSize * charFactor));
  const height = Math.max(20, Math.ceil(fontSize * 1.35));

  return { width, height };
}

function resolveTextRoleDefaults(node) {
  const role = typeof node.role === "string" ? node.role : "";

  if (role === "screen-title") {
    return {
      fontSize: node.fontSize || 28,
      fontStyle: node.fontStyle || "Semi Bold"
    };
  }

  if (role === "section-title") {
    return {
      fontSize: node.fontSize || 20,
      fontStyle: node.fontStyle || "Semi Bold"
    };
  }

  if (role === "meta-strong") {
    return {
      fontSize: node.fontSize || 18,
      fontStyle: node.fontStyle || "Semi Bold"
    };
  }

  if (role === "meta") {
    return {
      fontSize: node.fontSize || 16,
      fontStyle: node.fontStyle || "Regular"
    };
  }

  if (role === "body-strong") {
    return {
      fontSize: node.fontSize || 18,
      fontStyle: node.fontStyle || "Semi Bold"
    };
  }

  return {
    fontSize: node.fontSize,
    fontStyle: node.fontStyle
  };
}

function estimateNodeIntrinsicSize(node) {
  if (node.helper === "text") {
    return estimateTextIntrinsicSize(node);
  }

  const paddingLeft = node.padding?.left || 0;
  const paddingRight = node.padding?.right || 0;
  const paddingTop = node.padding?.top || 0;
  const paddingBottom = node.padding?.bottom || 0;
  const children = Array.isArray(node.children) ? node.children : [];
  const childSizes = children.map((child) => estimateNodeIntrinsicSize(child));

  if (children.length === 0) {
    return {
      width: clampLayoutSize(node.width, 120),
      height: clampLayoutSize(node.height, 44)
    };
  }

  if (node.layout === "none") {
    const maxRight = childSizes.reduce((max, size, index) => {
      const child = children[index] || {};
      const x = typeof child.x === "number" && Number.isFinite(child.x) ? child.x : 0;
      return Math.max(max, x + size.width);
    }, 0);
    const maxBottom = childSizes.reduce((max, size, index) => {
      const child = children[index] || {};
      const y = typeof child.y === "number" && Number.isFinite(child.y) ? child.y : 0;
      return Math.max(max, y + size.height);
    }, 0);
    return {
      width: clampLayoutSize(maxRight + paddingLeft + paddingRight, node.width),
      height: clampLayoutSize(maxBottom + paddingTop + paddingBottom, node.height)
    };
  }

  if (node.layout === "row") {
    const contentWidth =
      childSizes.reduce((sum, size) => sum + size.width, 0) +
      Math.max(0, children.length - 1) * (node.gap || 0);
    const contentHeight = childSizes.reduce((max, size) => Math.max(max, size.height), 0);
    return {
      width: clampLayoutSize(contentWidth + paddingLeft + paddingRight, node.width),
      height: clampLayoutSize(contentHeight + paddingTop + paddingBottom, node.height)
    };
  }

  const contentWidth = childSizes.reduce((max, size) => Math.max(max, size.width), 0);
  const contentHeight =
    childSizes.reduce((sum, size) => sum + size.height, 0) +
    Math.max(0, children.length - 1) * (node.gap || 0);

  return {
    width: clampLayoutSize(contentWidth + paddingLeft + paddingRight, node.width),
    height: clampLayoutSize(contentHeight + paddingTop + paddingBottom, node.height)
  };
}

function resolveInitialFrameSize(node, parentLayout, parentBox, siblingCount = 1) {
  const safeSiblingCount = Math.max(1, siblingCount);
  const parentInnerWidth = parentBox
    ? Math.max(1, parentBox.width - parentBox.padding.left - parentBox.padding.right)
    : null;
  const parentInnerHeight = parentBox
    ? Math.max(1, parentBox.height - parentBox.padding.top - parentBox.padding.bottom)
    : null;

  let width = node.width;
  let height = node.height;
  const intrinsic = estimateNodeIntrinsicSize(node);

  if (node.widthMode === "fill" && parentInnerWidth) {
    if (parentLayout === "HORIZONTAL") {
      width = Math.max(72, Math.floor(parentInnerWidth / safeSiblingCount));
    } else {
      width = parentInnerWidth;
    }
  } else if (node.widthMode === "hug") {
    width = intrinsic.width;
  }

  if (node.heightMode === "fill" && parentInnerHeight) {
    if (parentLayout === "VERTICAL") {
      height = Math.max(72, Math.floor(parentInnerHeight / safeSiblingCount));
    } else {
      height = parentInnerHeight;
    }
  } else if (node.heightMode === "hug") {
    height = intrinsic.height;
  }

  return {
    width: clampLayoutSize(width, node.width),
    height: clampLayoutSize(height, node.height)
  };
}

function mapChildLayoutConstraints(parentLayout, node) {
  const result = {};
  if (parentLayout === "HORIZONTAL") {
    if (node.widthMode === "fill") {
      result.layoutGrow = 1;
    }
    if (node.heightMode === "fill") {
      result.layoutAlign = "STRETCH";
    }
  } else if (parentLayout === "VERTICAL") {
    if (node.heightMode === "fill") {
      result.layoutGrow = 1;
    }
    if (node.widthMode === "fill") {
      result.layoutAlign = "STRETCH";
    }
  }
  return result;
}

async function exportDesignTokensArtifact(pluginId, args = {}) {
  return exportDesignTokensArtifactImpl(pluginId, args, {
    broadcastRuntimeEvent,
    chunkLimit: EXPORT_DESIGN_TOKENS_CHUNK_LIMIT,
    chunkMaxLimit: EXPORT_DESIGN_TOKENS_CHUNK_MAX_LIMIT,
    chunkTimeoutMs: EXPORT_DESIGN_TOKENS_CHUNK_TIMEOUT_MS,
    executePluginCommand,
    exportDir: XBRIDGE_TOKEN_EXPORT_DIR,
    joinPath: path.join,
    mkdir,
    now: Date.now,
    randomUUID,
    readFile,
    readdir,
    softBudgetMs: EXPORT_DESIGN_TOKENS_SOFT_BUDGET_MS,
    writeFile
  });
}

async function runDesignerReadCommand(pluginId, command, args = {}) {
  if (command === "get_selection") {
    return executePluginCommand(pluginId, "get_selection");
  }

  if (command === "get_metadata") {
    return executePluginCommand(pluginId, "get_metadata", {
      pageId: args.pageId,
      targetNodeId: resolveTargetNodeId(args),
      maxDepth: args.maxDepth,
      maxNodes: args.maxNodes,
      includeJson: args.includeJson === true
    });
  }

  if (command === "get_node_details") {
    const plan = buildNodeDetailsPlan(args);
    try {
      return await executePluginCommand(pluginId, "get_node_details", plan);
    } catch (error) {
      return readMetadataFallbackForDetail(pluginId, plan, error);
    }
  }

  if (command === "get_component_variant_details") {
    const plan = buildComponentVariantDetailsPlan(args);
    try {
      return await executePluginCommand(pluginId, "get_component_variant_details", plan);
    } catch (error) {
      const fallback = await readMetadataFallbackForDetail(pluginId, plan, error);
      return {
        ...fallback,
        targetNode: fallback.node,
        componentSet: null,
        variantCount: 0,
        variants: []
      };
    }
  }

  if (command === "get_instance_details") {
    const plan = buildInstanceDetailsPlan(args);
    try {
      return await executePluginCommand(pluginId, "get_instance_details", plan);
    } catch (error) {
      const fallback = await readMetadataFallbackForDetail(pluginId, plan, error);
      return {
        ...fallback,
        instance: fallback.node,
        sourceComponent: null,
        sourceComponentSet: null,
        componentPropertyDefinitions: [],
        variantProperties: null,
        componentProperties: null,
        resolvedChildCount: 0
      };
    }
  }

  if (command === "list_text_nodes") {
    return executePluginCommand(pluginId, "list_text_nodes", {
      targetNodeId: args.targetNodeId,
      scope: args.scope
    });
  }

  if (command === "get_annotations") {
    const plan = buildGetAnnotationsPlan(args);
    const rawResult = await executePluginCommand(pluginId, "get_annotations", plan);
    return normalizeAnnotationReadResult(rawResult, {
      includeInferredComments: plan.includeInferredComments
    });
  }

  if (command === "get_variable_defs") {
    return executePluginCommand(pluginId, "get_variable_defs", {
      pageId: args.pageId,
      targetNodeId: resolveTargetNodeId(args),
      maxDepth: args.maxDepth,
      maxNodes: args.maxNodes
    });
  }

  if (command === "export_design_tokens") {
    return exportDesignTokensArtifact(pluginId, args);
  }

  if (command === "search_nodes") {
    return executeSearchNodesWithRetry(pluginId, buildSearchNodesPlan(args));
  }

  if (command === "search_design_system") {
    return performDesignSystemSearch(pluginId, args);
  }

  if (command === "search_instances") {
    return executePluginCommand(pluginId, "search_instances", {
      ...buildSearchInstancesPlan(args),
      pageId: args.pageId
    });
  }

  if (command === "search_file_components") {
    return searchFileComponents(buildFileComponentSearchPlan(args), {
      accessToken: process.env.FIGMA_ACCESS_TOKEN
    });
  }

  if (command === "search_library_assets") {
    return searchLibraryAssets(buildLibraryAssetSearchPlan(args), {
      accessToken: process.env.FIGMA_ACCESS_TOKEN
    });
  }

  if (command === "snapshot_selection") {
    const plan = buildSnapshotPlan(args);
    return executePluginCommand(pluginId, "snapshot_selection", {
      pageId: plan.pageId,
      targetNodeId: plan.targetNodeId || args.targetNodeId,
      maxDepth: plan.maxDepth,
      maxNodes: plan.maxNodes,
      placeholderInstances: plan.placeholderInstances
    });
  }

  throw new Error(`Unsupported designer read command: ${command}`);
}

async function runDesignerActionCandidateCommand(pluginId, candidate = {}, options = {}) {
  const command = String(candidate?.command || "").trim();
  const targetNodeId = String(
    candidate?.targetNodeId || candidate?.argsHint?.targetNodeId || ""
  ).trim();
  const scope = String(candidate?.argsHint?.scope || "").trim();
  const queryHint = String(candidate?.argsHint?.queryHint || options.query || "").trim();
  const readOnly = candidate?.readOnly !== false;

  const allowedReadOnlyCommands = new Set([
    "get_selection",
    "get_metadata",
    "get_node_details",
    "get_instance_details",
    "get_component_variant_details",
    "list_text_nodes",
    "get_annotations",
    "get_variable_defs",
    "export_design_tokens",
    "search_design_system",
    "search_instances",
    "search_file_components",
    "snapshot_selection"
  ]);

  if (!command || !readOnly || !allowedReadOnlyCommands.has(command)) {
    const error = new Error("지원되지 않는 액션 후보입니다.");
    error.code = "unsupported_action_candidate";
    throw error;
  }

  const fileKey = String(options.fileKey || "").trim();
  const fileKeys = Array.isArray(options.fileKeys)
    ? options.fileKeys.map((value) => String(value || "").trim()).filter(Boolean)
    : [];

  return runDesignerReadCommand(pluginId, command, {
    targetNodeId: targetNodeId || undefined,
    scope: scope || (targetNodeId ? "target" : "selection"),
    query: queryHint || undefined,
    fileKey: fileKey || undefined,
    fileKeys,
    maxDepth: command === "get_metadata" ? 1 : undefined,
    maxNodes:
      command === "get_metadata"
        ? targetNodeId
          ? 36
          : 48
        : command === "get_variable_defs"
          ? 72
          : undefined,
    includeAliases: command === "export_design_tokens" ? true : undefined,
    includeResolvedValues: command === "export_design_tokens" ? true : undefined,
    includeStyles: command === "export_design_tokens" ? true : undefined,
    includeUsages: command === "export_design_tokens" ? false : undefined,
    artifact: command === "export_design_tokens" ? true : undefined,
    includeJson: command === "get_metadata"
  });
}

async function collectDesignerActionCandidateTextNodes(pluginId, candidate = {}) {
  const targetNodeId = String(
    candidate?.targetNodeId || candidate?.argsHint?.targetNodeId || ""
  ).trim();
  const scope = String(candidate?.argsHint?.scope || "").trim() || (targetNodeId ? "target" : "selection");
  const result = await runDesignerReadCommand(pluginId, "list_text_nodes", {
    targetNodeId: targetNodeId || undefined,
    scope
  });
  return Array.isArray(result?.textNodes) ? result.textNodes : [];
}

async function collectDesignerActionCandidateVariantDetail(pluginId, candidate = {}) {
  const componentNodeId = String(
    candidate?.componentNodeId ||
      candidate?.targetNodeId ||
      candidate?.argsHint?.componentNodeId ||
      candidate?.argsHint?.targetNodeId ||
      ""
  ).trim();
  if (!componentNodeId) {
    const error = new Error("variant preview requires component target");
    error.code = "missing_variant_component_target";
    throw error;
  }
  return runDesignerReadCommand(pluginId, "get_component_variant_details", {
    targetNodeId: componentNodeId
  });
}

function getDesignerRewriteBatchSize(aiConfig = {}) {
  return 12;
}

function shouldRetryDesignerRewriteChunk(error) {
  const code = String(error?.code || "").trim().toLowerCase();
  return (
    code === "designer_fast_path_empty_ai_updates" ||
    code === "invalid_model_output" ||
    code === "model_timeout_or_abort" ||
    code.startsWith("designer_fast_path_failed") ||
    code.startsWith("designer_fast_path_completed")
  );
}

function classifyDesignerChatError(error) {
  const code = String(error?.code || "").trim().toLowerCase();
  if (code === "selection_required" || code === "selection_sync_missing") {
    return {
      code: "selection_required",
      statusCode: 409,
      message: "현재 선택이 브리지에 동기화되지 않았습니다."
    };
  }
  if (code === "network_fetch_failed" || code === "designer_ai_upstream_failed") {
    return {
      code: "network_fetch_failed",
      statusCode: 502,
      message: "브리지와 Codex CLI 사이의 요청이 실패했습니다."
    };
  }
  if (
    code === "model_timeout_or_abort" ||
    code === "codex_cli_timeout" ||
    code === "designer_ai_reply_timeout" ||
    code === "designer_model_timeout"
  ) {
    return {
      code: "model_timeout_or_abort",
      statusCode: 504,
      message: "Codex 응답이 너무 오래 걸려 요청을 마치지 못했습니다."
    };
  }
  if (code === "debug_bridge_failure") {
    return {
      code: "debug_bridge_failure",
      statusCode: 504,
      message: "이미지 분석/화면 구성 브리지 요청이 실패했습니다. 실패 단계와 원인을 진단 정보로 반환합니다."
    };
  }
  if (
    code === "invalid_model_output" ||
    code === "designer_fast_path_empty_ai_updates" ||
    code === "designer_invalid_output"
  ) {
    return {
      code: "invalid_model_output",
      statusCode: 422,
      message: "Codex가 적용 가능한 결과를 만들지 못했습니다."
    };
  }
  if (code === "codex_cli_image_layout_understructured") {
    return {
      code: "codex_cli_image_layout_understructured",
      statusCode: 422,
      message:
        "이미지에서 인식한 UI 요소가 편집 가능한 Figma 레이어로 충분히 변환되지 않아 화면 구성을 중단했습니다."
    };
  }
  if (code === "selected_image_export_failed") {
    return {
      code: "selected_image_export_failed",
      statusCode: 422,
      message:
        "선택한 이미지를 화면 분석용 PNG로 내보내지 못했습니다. 이미지/스크린샷 노드를 다시 선택한 뒤 시도해 주세요."
    };
  }
  if (code === "image_attachment_missing") {
    return {
      code: "image_attachment_missing",
      statusCode: 422,
      message: "분석할 이미지 첨부나 선택된 이미지 노드를 찾지 못했습니다."
    };
  }
  if (code === "compare_targets_required") {
    return {
      code: "compare_targets_required",
      statusCode: 409,
      message: "참조 화면과 생성 화면 비교에는 선택된 Figma 노드가 2개 이상 필요합니다."
    };
  }
  return {
    code: code || "designer_chat_failed",
    statusCode: 400,
    message: error instanceof Error ? error.message : String(error)
  };
}

function parseDebugFailureMetric(text = "", patterns = []) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match.slice(1).map((value) => Number(value)).filter((value) => Number.isFinite(value));
    }
  }
  return [];
}

function parseQuotedFailureItems(text = "", labelPattern) {
  const labelMatch = text.match(labelPattern);
  if (!labelMatch) {
    return [];
  }
  const tail = text.slice(labelMatch.index + labelMatch[0].length);
  const untilSentence = tail.split(/\n|\.|。/u)[0] || tail;
  return [...untilSentence.matchAll(/"([^"]+)"/g)]
    .map((match) => normalizeString(match[1]))
    .filter(Boolean)
    .slice(0, 20);
}

function buildBridgeFailureDiagnosis(message = "", figmaContext = {}, intentEnvelope = null) {
  const rawText = normalizeString(message);
  const normalized = rawText.toLowerCase();
  const signals = [];
  const recommendations = [];
  let stage = "unknown";
  let failureSource = "unknown";

  const pushSignal = (code, detail = "") => {
    signals.push({ code, detail });
  };
  const pushRecommendation = (text) => {
    if (text && !recommendations.includes(text)) {
      recommendations.push(text);
    }
  };

  if (/timed out waiting for plugin response:\s*export_node|export_node|selected image export|내보내지 못|export timeout/u.test(normalized)) {
    stage = "selected_image_export";
    failureSource = "plugin_export_timeout";
    pushSignal("selected_export_timeout", "선택 노드 PNG export 단계에서 플러그인 응답이 지연되거나 실패했습니다.");
    pushRecommendation("선택 노드가 실제 이미지/프레임인지 확인하고, 큰 프레임은 clipped viewport 기준으로 더 작은 대상부터 export하세요.");
  }
  if (/codex_cli_timeout|codex.*timeout|image_analysis_codex|분석이 제한 시간을 넘|타임아웃/u.test(normalized)) {
    stage = stage === "unknown" ? "image_analysis_codex" : stage;
    failureSource = failureSource === "unknown" ? "codex_cli_timeout" : failureSource;
    pushSignal("codex_timeout", "이미지 export 이후 Codex 분석 단계가 제한 시간을 넘었습니다.");
    pushRecommendation("상태바, 헤더, 정보 그룹, 카드, 테이블, 하단바처럼 구조 단위를 명시해 분석 범위를 줄이세요.");
  }
  if (/편집 가능한 figma 레이어로 충분히 변환되지|understructured|생성 노드|좌표 노드|텍스트 반영/u.test(normalized)) {
    stage = "semantic_quality_gate";
    failureSource = "understructured_layer_conversion";
    pushSignal("semantic_gate_understructured", "인식된 UI 역할이 편집 가능한 노드/좌표/텍스트로 충분히 변환되지 않았습니다.");
    pushRecommendation("OCR 텍스트와 visual role을 분리하고, 각 역할을 독립 Figma layer/group으로 생성하도록 재시도 프롬프트를 구성하세요.");
  }
  if (/treejson.*텍스트|텍스트 노드.*반영|문구가.*반영되지|누락된 문구/u.test(normalized)) {
    if (stage === "unknown") {
      stage = "codex_output_validation";
      failureSource = "text_mapping_incomplete";
    }
    pushSignal("text_mapping_incomplete", "화면에 보이는 문구가 treeJson TEXT 노드로 충분히 들어가지 않았습니다.");
    pushRecommendation("보이는 문구만 TEXT 노드로 만들고, 사진/아바타/아이콘 설명어는 텍스트로 만들지 않도록 검증하세요.");
  }
  if (/bbox|좌표|위치.*어긋|alignment|오프셋/u.test(normalized)) {
    if (stage === "unknown") {
      stage = "post_build_quality_gate";
      failureSource = "bbox_alignment_mismatch";
    }
    pushSignal("bbox_alignment_mismatch", "인식 bbox와 생성 레이어 위치가 일치하지 않습니다.");
    pushRecommendation("선택 root frame의 origin과 clipped viewport를 기준으로 bbox를 정규화한 뒤 생성 결과를 다시 비교하세요.");
  }
  const likelyClippedViewportReference =
    /(clipped[_\s-]?frame[_\s-]?viewport|clipscontent|clip content|overflow hidden|clipped viewport|frame viewport|viewport 기준)/iu.test(rawText) ||
    /(프레임보다\s*큰|프레임\s*안에\s*담겨|넘친\s*(?:컨텐츠|콘텐츠)|넘치는\s*(?:컨텐츠|콘텐츠)|숨기기|클리핑|클립|잘린|보이는\s*부분만)/u.test(rawText);
  if (likelyClippedViewportReference) {
    pushSignal("clipped_viewport_reference", "참조가 프레임 viewport에 clipping된 큰 이미지/레이어일 가능성이 있습니다.");
    pushRecommendation("참조 프레임의 전체 자식 bounds가 아니라 visible viewport pixels만 기준으로 role, bbox, canvas를 산출하세요.");
  }

  const roleMetrics = parseDebugFailureMetric(rawText, [
    /인식\s*역할\s*(\d+)\s*개\s*중\s*생성\s*노드\s*(\d+)\s*개/u,
    /recognized\s*roles?\D+(\d+)\D+generated\s*nodes?\D+(\d+)/iu
  ]);
  const coordinateMetrics = parseDebugFailureMetric(rawText, [
    /좌표\s*노드\s*(\d+)\s*\/\s*(\d+)\s*개/u,
    /coordinate\s*nodes?\D+(\d+)\D+(\d+)/iu
  ]);
  const textMetrics = parseDebugFailureMetric(rawText, [
    /텍스트\s*반영\s*(\d+)\s*\/\s*(\d+)\s*개/u,
    /text\s*(?:coverage|mapped|reflected)\D+(\d+)\D+(\d+)/iu
  ]);
  const missingTexts = parseQuotedFailureItems(rawText, /누락된\s*문구\s*:\s*/u);
  if (missingTexts.length > 0) {
    pushSignal("missing_visible_text", `${missingTexts.length}개 visible text가 누락됐습니다.`);
  }

  if (signals.length === 0) {
    pushSignal("unclassified_failure", "실패 문구에서 알려진 export/Codex/semantic/post-build 신호를 찾지 못했습니다.");
    pushRecommendation("실패 원문, 선택 노드 id/name/type, 직전 요청 intent, 생성된 node tree 요약을 함께 첨부해 다시 진단하세요.");
  }

  return {
    intentKind: "debug_bridge_failure",
    failureSource,
    stage,
    confidence: failureSource === "unknown" ? "low" : "medium",
    signals,
    metrics: {
      recognizedRoleCount: roleMetrics[0] ?? null,
      generatedNodeCount: roleMetrics[1] ?? null,
      coordinateNodeCount: coordinateMetrics[0] ?? null,
      coordinateExpectedCount: coordinateMetrics[1] ?? null,
      textMappedCount: textMetrics[0] ?? null,
      textExpectedCount: textMetrics[1] ?? null,
      clippedViewportReferenceLikely: likelyClippedViewportReference
    },
    missingTexts,
    selection: Array.isArray(figmaContext?.selection)
      ? figmaContext.selection.map((item) => ({
          id: normalizeString(item?.id),
          name: normalizeString(item?.name),
          type: normalizeString(item?.type)
        })).filter((item) => item.id || item.name || item.type)
      : [],
    recommendations,
    intentClassification: intentEnvelope?.intentClassification || {
      userIntentKind: "debug_bridge_failure",
      internalIntentKind: "inspect_selection"
    }
  };
}

async function executeDesignerDebugBridgeFailureRequest({
  pluginId,
  message = "",
  figmaContext = {},
  intentEnvelope
}) {
  const diagnosis = buildBridgeFailureDiagnosis(message, figmaContext, intentEnvelope);
  const summary = diagnosis.failureSource === "unknown"
    ? "실패 원인을 자동 분류하지 못했습니다. 실패 원문과 선택 정보가 더 필요합니다."
    : `실패 단계는 ${diagnosis.stage}, 주요 원인은 ${diagnosis.failureSource}로 보입니다.`;
  return {
    ok: true,
    intentKind: "debug_bridge_failure",
    pluginId,
    aiBackend: "deterministic",
    codexStatus: "skipped",
    fallbackUsed: false,
    fallbackReason: null,
    intentEnvelope,
    intentClassification: diagnosis.intentClassification,
    bridgeFailureDiagnosis: diagnosis,
    designerSuggestionBundle: {
      version: "1.0",
      intentKind: "debug_bridge_failure",
      headline: "브리지 실패 원인 진단",
      summaryText: summary,
      findings: diagnosis.signals.map((signal, index) => ({
        id: `finding-debug-bridge-failure-${index + 1}`,
        severity: signal.code === "unclassified_failure" ? "medium" : "high",
        label: signal.code,
        detail: signal.detail
      })),
      recommendations: diagnosis.recommendations.map((detail, index) => ({
        id: `rec-debug-bridge-failure-${index + 1}`,
        title: "다음 조치",
        detail
      })),
      applyActions: [],
      risks: []
    },
    ai: buildDesignerCodexAiPayload({
      status: "completed",
      reply: summary
    })
  };
}

function createDesignerWorkflowTimeoutError({
  userIntentKind,
  stage,
  timeoutMs,
  message = "",
  figmaContext = {}
}) {
  const error = new Error(`${userIntentKind || "designer_chat"} timed out after ${timeoutMs}ms`);
  error.code = "debug_bridge_failure";
  error.details = {
    userIntentKind: userIntentKind || null,
    failureIntentKind: "debug_bridge_failure",
    failureSource: "designer_chat_workflow_timeout",
    stage: stage || "designer_chat_workflow",
    timeoutMs,
    reason: "request_timeout",
    message: normalizeString(message),
    selection: Array.isArray(figmaContext?.selection)
      ? figmaContext.selection.map((item) => ({
          id: normalizeString(item?.id),
          name: normalizeString(item?.name),
          type: normalizeString(item?.type)
        })).filter((item) => item.id || item.name || item.type)
      : []
  };
  error.designerMeta = {
    originalCode: "designer_chat_workflow_timeout",
    taskKind: userIntentKind || null,
    fallbackMode: null
  };
  return error;
}

function withDesignerWorkflowTimeout(promise, options = {}) {
  const timeoutMs = Number(options.timeoutMs || 0);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return typeof promise === "function" ? promise() : promise;
  }
  const context = getRequestContext();
  const previousWorkflowCommandIds = context.designerWorkflowCommandIds;
  const previousWorkflowCanceled = context.designerWorkflowCanceled;
  context.designerWorkflowCommandIds = new Set();
  context.designerWorkflowCanceled = false;
  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      context.designerWorkflowCanceled = true;
      cancelDesignerWorkflowPendingCommands(context, {
        userIntentKind: options.userIntentKind,
        stage: options.stage,
        timeoutMs
      });
      reject(createDesignerWorkflowTimeoutError(options));
    }, timeoutMs);
  });
  const operationPromise = typeof promise === "function" ? promise() : promise;
  operationPromise.finally(() => {
    context.designerWorkflowCommandIds = previousWorkflowCommandIds;
    context.designerWorkflowCanceled = previousWorkflowCanceled;
  }).catch(() => {});
  return Promise.race([operationPromise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function cancelDesignerWorkflowPendingCommands(context = {}, details = {}) {
  const commandIds = context.designerWorkflowCommandIds instanceof Set
    ? [...context.designerWorkflowCommandIds]
    : [];
  for (const commandId of commandIds) {
    const command = pendingCommands.get(commandId);
    if (!command || isWriteHeavyCommandType(command.type) || isSimpleWriteCommandType(command.type)) {
      continue;
    }
    runtimeCounters.queue.canceledStaleTotal += 1;
    incrementNamedCounter(runtimeCounters.queue.canceledStaleByType, command.type);
    completeCommand(commandId, null, {
      code: "ERR_COMMAND_CANCELED_WORKFLOW_TIMEOUT",
      message: `Command canceled because designer workflow timed out: ${command.type}`,
      statusCode: 504,
      details: {
        commandId,
        pluginId: command.pluginId,
        type: command.type,
        userIntentKind: details.userIntentKind || null,
        stage: details.stage || null,
        timeoutMs: details.timeoutMs || null
      }
    });
  }
}

function buildImageLayoutQualityFailureSummary(quality = null) {
  if (!quality || typeof quality !== "object") {
    return null;
  }
  const flagKeys = [
    "recognizedRoleCountTooLow",
    "nodeCoverageTooLow",
    "textCoverageTooLow",
    "coordinateCoverageTooLow",
    "topOriginStackingTooHigh",
    "bboxAlignmentTooLow",
    "textWrapRiskTooHigh",
    "componentBBoxSizeTooLow",
    "outlinedStyleMismatchTooHigh",
    "visualSanityTooLow",
    "postBuildTextCoverageTooLow",
    "postBuildBboxAlignmentTooLow",
    "postBuildVisualRoleCoverageTooLow"
  ];
  const labels = (value) =>
    Array.isArray(value)
      ? value.map((item) => normalizeString(item)).filter(Boolean).slice(0, 12)
      : [];
  const failureFlags = flagKeys.filter((key) => quality[key] === true);
  const labelsToFix = {
    missing: labels(quality.missingRoleLabels),
    bboxMisaligned: labels(quality.bboxMisalignedRoleLabels),
    wrapRisk: labels(quality.wrapRiskRoleLabels),
    componentTooSmall: labels(quality.componentBBoxMismatchLabels),
    outlinedMismatch: labels(quality.outlinedStyleMismatchLabels),
    missingVisualRoles: labels(quality.missingVisualRoleLabels),
    hallucinated: labels(quality.unobservedVisibleTexts)
  };
  const nextActions = [];
  if (quality.nodeCoverageTooLow || quality.coordinateCoverageTooLow || quality.recognizedRoleCountTooLow) {
    nextActions.push("상태바/헤더/본문/카드/행/버튼/하단바를 각각 편집 가능한 별도 레이어로 분해하세요.");
  }
  if (quality.textCoverageTooLow || quality.postBuildTextCoverageTooLow) {
    nextActions.push("누락된 visible label을 실제 TEXT 노드로 생성하고 placeholder/internal name은 화면 텍스트로 만들지 마세요.");
  }
  if (quality.bboxAlignmentTooLow || quality.postBuildBboxAlignmentTooLow || quality.topOriginStackingTooHigh) {
    nextActions.push("roleMap bbox 기준으로 같은 문구와 컴포넌트를 실제 x/y 위치에 배치하세요.");
  }
  if (quality.textWrapRiskTooHigh) {
    nextActions.push("줄바꿈 위험 label은 원본 bbox와 글자 수에 맞게 text width를 넓히세요.");
  }
  if (quality.componentBBoxSizeTooLow || quality.postBuildVisualRoleCoverageTooLow) {
    nextActions.push("row/button/toggle/progress/card 같은 주요 UI 역할은 원본 bbox와 비슷한 크기의 컨테이너로 구현하세요.");
  }
  if (quality.visualSanityTooLow || quality.outlinedStyleMismatchTooHigh) {
    nextActions.push("아이콘 분석 단어를 텍스트로 노출하지 말고, 겹침/세로 쪼개짐/filled-vs-outlined 스타일 오류를 수정하세요.");
  }
  return {
    failureFlags,
    labelsToFix,
    counts: {
      roleCount: Number(quality.roleCount || 0),
      generatedNodeCount: Number(quality.generatedNodeCount || 0),
      coordinateNodeCount: Number(quality.coordinateNodeCount || 0),
      visibleRoleLabelCount: Number(quality.visibleRoleLabelCount || 0),
      coveredRoleLabelCount: Number(quality.coveredRoleLabelCount || 0),
      bboxRoleLabelCount: Number(quality.bboxRoleLabelCount || 0),
      bboxAlignedRoleLabelCount: Number(quality.bboxAlignedRoleLabelCount || 0)
    },
    retry: quality.retry
      ? {
          attempted: quality.retry.attempted === true,
          attempts: Number(quality.retry.attempts || 0),
          recovered: quality.retry.recovered === true,
          firstFailureFlags: flagKeys.filter((key) => quality.retry?.firstFailureDetails?.[key] === true),
          firstFailureLabelsToFix: {
            missing: labels(quality.retry?.firstFailureDetails?.missingRoleLabels),
            bboxMisaligned: labels(quality.retry?.firstFailureDetails?.bboxMisalignedRoleLabels),
            wrapRisk: labels(quality.retry?.firstFailureDetails?.wrapRiskRoleLabels),
            componentTooSmall: labels(quality.retry?.firstFailureDetails?.componentBBoxMismatchLabels),
            outlinedMismatch: labels(quality.retry?.firstFailureDetails?.outlinedStyleMismatchLabels),
            missingVisualRoles: labels(quality.retry?.firstFailureDetails?.missingVisualRoleLabels)
          }
        }
      : null,
    nextActions
  };
}

function stripDesignerLeakedNodeIdPrefix(text = "", knownNodeIds = []) {
  const value = String(text || "").trim();
  if (!value) {
    return "";
  }
  const ids = (Array.isArray(knownNodeIds) ? knownNodeIds : [])
    .map((nodeId) => String(nodeId || "").trim())
    .filter(Boolean);
  const canonicalIds = new Set(ids.map((nodeId) => nodeId.replace(/^id(?=\d+:\d+$)/iu, "")));
  const variants = Array.from(
    new Set(
      ids.flatMap((nodeId) => {
        const canonical = nodeId.replace(/^id(?=\d+:\d+$)/iu, "");
        return [nodeId, canonical, `id${canonical}`].filter(Boolean);
      })
    )
  ).sort((left, right) => right.length - left.length);
  for (const nodeId of variants) {
    if (
      value === nodeId ||
      value.startsWith(`${nodeId}\t`) ||
      value.startsWith(`${nodeId} `) ||
      value.startsWith(`${nodeId}:`) ||
      value.startsWith(`${nodeId}-`) ||
      value.startsWith(`${nodeId})`) ||
      value.startsWith(`${nodeId}.`)
    ) {
      return value.slice(nodeId.length).replace(/^[\s\t:.)-]+/u, "").trim();
    }
  }
  const genericMatch = value.match(/^id?(\d+:\d+)[\s\t:.)-]+(.+)$/iu);
  if (genericMatch && canonicalIds.has(genericMatch[1])) {
    return String(genericMatch[2] || "").trim();
  }
  return value;
}

function sanitizeDesignerTextUpdates(updates = [], knownNodeIds = []) {
  return (Array.isArray(updates) ? updates : [])
    .map((entry) => {
      const nodeId = String(entry?.nodeId || entry?.id || "").trim();
      const text = stripDesignerLeakedNodeIdPrefix(entry?.text, knownNodeIds);
      return {
        ...entry,
        nodeId,
        id: String(entry?.id || nodeId).trim(),
        text
      };
    })
    .filter((entry) => entry.nodeId && entry.text);
}

async function buildDesignerTextRewriteDraftChunk({
  message,
  figmaContext,
  textNodes,
  aiConfig
} = {}) {
  let draft;
  try {
    draft = await runCodexTextRewritePreview(
      {
        message,
        figmaContext,
        textNodes
      },
      {
        env: process.env,
        cwd: process.cwd()
      }
    );
  } catch (error) {
    const codexStatus = normalizeCodexCliStatus(error?.code);
    const mappedCode =
      codexStatus === "timeout"
        ? "model_timeout_or_abort"
        : codexStatus === "invalid_output"
          ? "invalid_model_output"
          : "codex_cli_process_failed";
    const wrapped = new Error(
      codexStatus === "timeout"
        ? "Codex 응답이 너무 오래 걸려 요청을 마치지 못했습니다."
        : codexStatus === "invalid_output"
          ? "Codex가 적용 가능한 결과를 만들지 못했습니다."
          : "Codex 응답을 처리하지 못했습니다."
    );
    wrapped.code = mappedCode;
    wrapped.designerMeta = {
      provider: "codex_cli",
      model: null,
      taskKind: "revise_copy",
      fallbackMode: "read_result",
      outputValidation: codexStatus,
      codexStatus
    };
    throw wrapped;
  }

  const provider = String(draft?.provider || "codex_cli").trim();
  const model = String(draft?.model || "").trim();

  const chunkUpdates = Array.isArray(draft?.updates)
    ? draft.updates
        .map((entry) => ({
          nodeId: String(entry?.id || "").trim(),
          text: String(entry?.text || entry?.characters || "").trim()
        }))
        .filter((entry) => entry.nodeId && entry.text)
    : [];

  if (chunkUpdates.length === 0) {
    const error = new Error(
      "선택한 텍스트에 대한 AI 초안을 완성하지 못했습니다. 같은 모델로 다시 시도하거나 입력 범위를 줄여 주세요."
    );
    error.code = "designer_fast_path_empty_ai_updates";
    error.designerMeta = {
      provider,
      model,
      taskKind: "revise_copy",
      fallbackMode: "read_result",
      outputValidation: "invalid_output",
      codexStatus: "invalid_output"
    };
    throw error;
  }

  return {
    provider,
    model,
    taskKind: "revise_copy",
    fallbackMode: null,
    outputValidation: "completed",
    chunkCount: 1,
    retryCount: 0,
    updates: chunkUpdates,
    reply: draft?.reply ? String(draft.reply).trim() : ""
  };
}

async function buildDesignerTextRewriteDraftAdaptive({
  message,
  figmaContext,
  textNodes,
  aiConfig
} = {}) {
  const nodes = Array.isArray(textNodes) ? textNodes : [];
  if (nodes.length === 0) {
    return {
      provider: String(aiConfig?.provider || "").trim(),
      model: String(aiConfig?.model || "").trim(),
      updates: [],
      reply: ""
    };
  }

  try {
    return await buildDesignerTextRewriteDraftChunk({
      message,
      figmaContext,
      textNodes: nodes,
      aiConfig
    });
  } catch (error) {
    if (nodes.length <= 1 || !shouldRetryDesignerRewriteChunk(error)) {
      throw error;
    }

    const splitAt = Math.ceil(nodes.length / 2);
    const left = await buildDesignerTextRewriteDraftAdaptive({
      message,
      figmaContext,
      textNodes: nodes.slice(0, splitAt),
      aiConfig
    });
    const right = await buildDesignerTextRewriteDraftAdaptive({
      message,
      figmaContext,
      textNodes: nodes.slice(splitAt),
      aiConfig
    });

    return {
      provider: String(right.provider || left.provider || aiConfig?.provider || "").trim(),
      model: String(right.model || left.model || aiConfig?.model || "").trim(),
      taskKind: String(right.taskKind || left.taskKind || "").trim() || null,
      fallbackMode: right.fallbackMode || left.fallbackMode || null,
      outputValidation: right.outputValidation || left.outputValidation || null,
      chunkCount: Number(left.chunkCount || 0) + Number(right.chunkCount || 0),
      retryCount: Number(left.retryCount || 0) + Number(right.retryCount || 0) + 1,
      updates: [...left.updates, ...right.updates],
      reply: String(right.reply || left.reply || "").trim()
    };
  }
}

async function buildDesignerTextRewriteDraft({
  message,
  figmaContext,
  textNodes,
  aiConfig
} = {}) {
  const nodes = Array.isArray(textNodes) ? textNodes : [];
  const batchSize = Math.max(1, getDesignerRewriteBatchSize(aiConfig));
  const updates = [];
  const replies = [];
  let provider = String(aiConfig?.provider || "").trim();
  let model = String(aiConfig?.model || "").trim();
  let taskKind = null;
  const fallbackModes = [];
  let outputValidation = null;
  let chunkCount = 0;
  let retryCount = 0;

  for (let index = 0; index < nodes.length; index += batchSize) {
    const batch = nodes.slice(index, index + batchSize);
    const ai = await buildDesignerTextRewriteDraftAdaptive({
      message,
      figmaContext,
      textNodes: batch,
      aiConfig
    });

    provider = String(ai?.provider || provider || "").trim();
    model = String(ai?.model || model || "").trim();
    taskKind = taskKind || ai?.taskKind || null;
    if (ai?.fallbackMode) {
      fallbackModes.push(ai.fallbackMode);
    }
    outputValidation = ai?.outputValidation || outputValidation;
    chunkCount += Number(ai?.chunkCount || 0);
    retryCount += Number(ai?.retryCount || 0);
    updates.push(...(Array.isArray(ai?.updates) ? ai.updates : []));
    if (ai?.reply) {
      replies.push(String(ai.reply).trim());
    }
  }

  return {
    provider,
    model,
    taskKind,
    fallbackMode: fallbackModes.length > 0 ? fallbackModes[fallbackModes.length - 1] : null,
    outputValidation,
    chunkCount,
    retryCount,
    updates,
    reply:
      replies.length > 0
        ? replies[replies.length - 1]
        : `선택된 텍스트 ${updates.length}개를 요청한 방향에 맞게 바로 변경했어요.`
  };
}

async function previewDesignerActionCandidateCommand(pluginId, candidate = {}, options = {}) {
  const command = String(candidate?.command || "").trim();
  const readOnly = candidate?.readOnly !== false;

  const deterministicRepairWriteCommands = new Set([
    "generated_screen_repair",
    "bulk_create_nodes",
    "bulk_update_nodes",
    "delete_node"
  ]);

  if (
    !command ||
    readOnly ||
    (
      command !== "bulk_update_texts" &&
      command !== "set_variant_properties" &&
      !deterministicRepairWriteCommands.has(command)
    )
  ) {
    const error = new Error("지원되지 않는 쓰기 미리보기 후보입니다.");
    error.code = "unsupported_write_candidate";
    throw error;
  }

  if (candidate?.blocked) {
    const error = new Error("현재 이 후보는 바로 미리보기를 만들 수 없습니다.");
    error.code = "blocked_write_candidate";
    throw error;
  }

  if (command === "generated_screen_repair") {
    const targetNodeId = String(candidate?.targetNodeId || "").trim();
    const rawRepairPlan = candidate?.argsHint?.repairPlan && typeof candidate.argsHint.repairPlan === "object"
      ? candidate.argsHint.repairPlan
      : {};
    const rawCreateTextNodes = Array.isArray(rawRepairPlan.createTextNodes) ? rawRepairPlan.createTextNodes : [];
    const createTextNodes = rawCreateTextNodes.map((node, index) => ({
      ...node,
      parentId: String(node?.parentId || targetNodeId || "").trim(),
      nodeType: String(node?.nodeType || "TEXT").trim(),
      name: String(node?.name || `missing-text-${index + 1}`).trim(),
      characters: String(node?.characters || node?.text || "").trim()
    }));
    const rawCreateVisualNodes = Array.isArray(rawRepairPlan.createVisualNodes) ? rawRepairPlan.createVisualNodes : [];
    const createVisualNodes = rawCreateVisualNodes.map((node, index) => ({
      ...node,
      parentId: String(node?.parentId || targetNodeId || "").trim(),
      nodeType: String(node?.nodeType || "RECTANGLE").trim(),
      name: String(node?.name || `missing-visual-${index + 1}`).trim()
    }));
    const regroupNodes = (Array.isArray(rawRepairPlan.regroupNodes) ? rawRepairPlan.regroupNodes : [])
      .map((entry, index) => ({
        name: String(entry?.name || `regroup-${index + 1}`).trim(),
        role: entry?.role || null,
        partial: entry?.partial === true,
        generatedTextCoverage: typeof entry?.generatedTextCoverage === "number" ? entry.generatedTextCoverage : null,
        textSignature: Array.isArray(entry?.textSignature)
          ? entry.textSignature.map((text) => normalizeString(text)).filter(Boolean)
          : [],
        nodeIds: Array.isArray(entry?.nodeIds)
          ? entry.nodeIds.map((nodeId) => String(nodeId || "").trim()).filter(Boolean)
          : [],
        frame: {
          ...(entry?.frame && typeof entry.frame === "object" ? entry.frame : {}),
          parentId: String(entry?.frame?.parentId || targetNodeId || "").trim(),
          nodeType: "FRAME",
          name: String(entry?.frame?.name || entry?.name || `regroup-${index + 1}`).trim()
        },
        action: "create_frame_and_move_existing_nodes"
      }))
      .filter((entry) => entry.nodeIds.length >= 2);
    const createPlan =
      createTextNodes.length > 0 || createVisualNodes.length > 0 || regroupNodes.length > 0
        ? buildBulkCreateNodesPlan({
            defaultParentId: targetNodeId || undefined,
            nodes: [...createTextNodes, ...createVisualNodes, ...regroupNodes.map((entry) => entry.frame)]
          })
        : { nodes: [] };
    const updateNodeBboxes = Array.isArray(rawRepairPlan.updateNodeBboxes)
      ? rawRepairPlan.updateNodeBboxes
          .map((entry) => ({
            nodeId: String(entry?.nodeId || entry?.id || "").trim(),
            x: typeof entry?.x === "number" ? entry.x : undefined,
            y: typeof entry?.y === "number" ? entry.y : undefined,
            width: typeof entry?.width === "number" ? entry.width : undefined,
            height: typeof entry?.height === "number" ? entry.height : undefined
          }))
          .filter((entry) => entry.nodeId)
      : [];
    const deleteNodeIds = (Array.isArray(rawRepairPlan.deleteNodeIds) ? rawRepairPlan.deleteNodeIds : [])
      .map((nodeId) => String(nodeId || "").trim())
      .filter(Boolean);
    const commandCount =
      (createPlan.nodes.length > 0 ? 1 : 0) +
      (updateNodeBboxes.length > 0 ? 1 : 0) +
      (deleteNodeIds.length > 0 ? 1 : 0) +
      (regroupNodes.length > 0 ? 1 : 0);
    if (commandCount === 0) {
      const error = new Error("미리보기용 생성 화면 보정 후보가 비어 있습니다.");
      error.code = "empty_write_preview";
      throw error;
    }
    return {
      command,
      provider: "deterministic",
      model: null,
      preview: {
        targetNodeId: targetNodeId || null,
        commandCount,
        repairPlan: {
          createTextNodes: createPlan.nodes
            .filter((node) => String(node?.nodeType || "").toUpperCase() === "TEXT")
            .map((node, index) => ({
              ...node,
              regroupTargetIndex:
                typeof createTextNodes[index]?.regroupTargetIndex === "number"
                  ? createTextNodes[index].regroupTargetIndex
                  : undefined
            })),
          createVisualNodes: createPlan.nodes
            .filter((node) => String(node?.nodeType || "").toUpperCase() !== "TEXT")
            .filter((node) => !regroupNodes.some((entry) => entry.frame?.name === node.name)),
          createGroupFrames: regroupNodes.map((entry) => entry.frame),
          regroupNodes,
          updateNodeBboxes,
          deleteNodeIds,
          visualRepairs: rawRepairPlan.visualRepairs && typeof rawRepairPlan.visualRepairs === "object"
            ? rawRepairPlan.visualRepairs
            : {}
        }
      }
    };
  }

  if (command === "bulk_create_nodes") {
    const targetNodeId = String(candidate?.targetNodeId || candidate?.argsHint?.parentId || "").trim();
    const rawNodes = Array.isArray(candidate?.argsHint?.nodes) ? candidate.argsHint.nodes : [];
    const nodes = rawNodes.map((node, index) => ({
      ...node,
      parentId: String(node?.parentId || targetNodeId || "").trim(),
      nodeType: String(node?.nodeType || "TEXT").trim(),
      name: String(node?.name || `missing-text-${index + 1}`).trim(),
      characters: String(node?.characters || node?.text || "").trim()
    }));
    const plan = buildBulkCreateNodesPlan({
      defaultParentId: targetNodeId || undefined,
      nodes
    });
    return {
      command,
      provider: "deterministic",
      model: null,
      preview: {
        targetNodeId: targetNodeId || null,
        nodeCount: plan.nodes.length,
        nodes: plan.nodes
      }
    };
  }

  if (command === "bulk_update_nodes") {
    const updates = Array.isArray(candidate?.argsHint?.updates)
      ? candidate.argsHint.updates
          .map((entry) => ({
            nodeId: String(entry?.nodeId || entry?.id || "").trim(),
            x: typeof entry?.x === "number" ? entry.x : undefined,
            y: typeof entry?.y === "number" ? entry.y : undefined,
            width: typeof entry?.width === "number" ? entry.width : undefined,
            height: typeof entry?.height === "number" ? entry.height : undefined
          }))
          .filter((entry) => entry.nodeId)
      : [];
    if (updates.length === 0) {
      const error = new Error("미리보기용 bbox 업데이트 후보가 비어 있습니다.");
      error.code = "empty_write_preview";
      throw error;
    }
    return {
      command,
      provider: "deterministic",
      model: null,
      preview: {
        updateCount: updates.length,
        updates
      }
    };
  }

  if (command === "delete_node") {
    const nodeIds = (Array.isArray(candidate?.argsHint?.nodeIds)
      ? candidate.argsHint.nodeIds
      : [candidate?.argsHint?.nodeId]
    )
      .map((nodeId) => String(nodeId || "").trim())
      .filter(Boolean);
    if (nodeIds.length === 0) {
      const error = new Error("미리보기용 삭제 노드 후보가 비어 있습니다.");
      error.code = "empty_write_preview";
      throw error;
    }
    return {
      command,
      provider: "deterministic",
      model: null,
      preview: {
        deleteCount: nodeIds.length,
        nodeIds
      }
    };
  }

  if (command === "set_variant_properties") {
    const useCodexCliWrite = await shouldUseCodexCliForWrite(process.env);
    if (!useCodexCliWrite) {
      const error = new Error("variant 미리보기는 현재 Codex CLI write backend가 필요합니다.");
      error.code = "unsupported_write_candidate";
      throw error;
    }
    const variantDetail = await collectDesignerActionCandidateVariantDetail(pluginId, candidate);
    const draft = await runCodexVariantUpdatePreview(
      {
        message:
          String(options.message || options.request || options.prompt || "").trim() ||
          String(options.actionLabel || candidate?.reason || "현재 local variant 값을 새 목적에 맞게 바꿔 주세요.").trim(),
        figmaContext: options.figmaContext || {},
        variantDetail
      },
      {
        env: process.env,
        cwd: process.cwd()
      }
    );
    const variantProperties =
      draft.variantProperties && typeof draft.variantProperties === "object"
        ? draft.variantProperties
        : {};
    if (Object.keys(variantProperties).length === 0) {
      const error = new Error("AI가 반영할 variant 초안을 만들지 못했습니다.");
      error.code = "empty_write_preview";
      throw error;
    }
    return {
      command,
      provider: draft.provider,
      model: draft.model,
      preview: {
        reply: String(draft.reply || "").trim(),
        componentNodeId: draft.componentNodeId,
        variantPropertyCount: Object.keys(variantProperties).length,
        variantProperties,
        targetNodeId: draft.componentNodeId
      }
    };
  }

  const textNodes = await collectDesignerActionCandidateTextNodes(pluginId, candidate);
  if (textNodes.length === 0) {
    const error = new Error("미리보기용 텍스트 노드를 찾지 못했습니다.");
    error.code = "missing_candidate_text_nodes";
    throw error;
  }

  const aiConfig = options.aiConfig || getDesignerAiConfig();
  const rewriteMessage =
    String(options.message || options.request || options.prompt || "").trim() ||
    String(options.actionLabel || candidate?.reason || "선택한 텍스트를 새 방향에 맞게 다듬어 주세요.").trim();
  const useCodexCliWrite = await shouldUseCodexCliForWrite(process.env);
  const draft = useCodexCliWrite
    ? await runCodexTextRewritePreview(
        {
          message: rewriteMessage,
          figmaContext: options.figmaContext || {},
          textNodes
        },
        {
          env: process.env,
          cwd: process.cwd()
        }
      )
    : await buildDesignerTextRewriteDraft({
        message: rewriteMessage,
        figmaContext: options.figmaContext || {},
        textNodes,
        aiConfig
      });
  const sanitizedDraftUpdates = sanitizeDesignerTextUpdates(
    draft.updates,
    textNodes.map((node) => node?.id)
  );
  const updates = Array.isArray(sanitizedDraftUpdates)
    ? sanitizedDraftUpdates.map((entry) => ({
        id: entry.nodeId,
        text: entry.text
      }))
    : [];
  if (updates.length === 0) {
    const error = new Error("AI가 반영할 텍스트 초안을 만들지 못했습니다.");
    error.code = "empty_write_preview";
    throw error;
  }

  return {
    command,
    provider: draft.provider,
    model: draft.model,
    preview: {
      reply: String(draft.reply || "").trim(),
      textNodeCount: textNodes.length,
      updateCount: updates.length,
      targetNodeId:
        String(candidate?.targetNodeId || candidate?.argsHint?.targetNodeId || "").trim() || null,
      updates,
      textNodes: textNodes.map((node) => ({
        id: String(node?.id || "").trim(),
        name: String(node?.name || "").trim() || "text",
        characters: String(node?.characters || "").trim()
      }))
    }
  };
}

async function confirmDesignerActionCandidateCommand(pluginId, candidate = {}, options = {}) {
  const command = String(candidate?.command || "").trim();
  const readOnly = candidate?.readOnly !== false;
  const preview = options.preview && typeof options.preview === "object" ? options.preview : {};
  if (!command || readOnly) {
    const error = new Error("확인 후 실행할 쓰기 후보 정보가 올바르지 않습니다.");
    error.code = "invalid_write_candidate_confirm";
    throw error;
  }
  if (command === "set_variant_properties") {
    const componentNodeId = String(preview.componentNodeId || candidate?.componentNodeId || candidate?.targetNodeId || "").trim();
    const variantProperties =
      preview.variantProperties && typeof preview.variantProperties === "object" && !Array.isArray(preview.variantProperties)
        ? Object.fromEntries(
            Object.entries(preview.variantProperties)
              .map(([key, value]) => [String(key || "").trim(), String(value || "").trim()])
              .filter(([key, value]) => key && value)
          )
        : {};
    if (!componentNodeId || Object.keys(variantProperties).length === 0) {
      const error = new Error("확인 후 실행할 variant 후보 정보가 올바르지 않습니다.");
      error.code = "invalid_write_candidate_confirm";
      throw error;
    }
    const result = await executePluginCommand(pluginId, "set_variant_properties", {
      componentNodeId,
      variantProperties
    });
    return {
      command,
      appliedUpdateCount: Object.keys(variantProperties).length,
      result
    };
  }

  if (command === "generated_screen_repair") {
    const repairPlan = preview.repairPlan && typeof preview.repairPlan === "object" ? preview.repairPlan : {};
    const createTextNodes = Array.isArray(repairPlan.createTextNodes) ? repairPlan.createTextNodes : [];
    const createVisualNodes = Array.isArray(repairPlan.createVisualNodes) ? repairPlan.createVisualNodes : [];
    const createGroupFrames = Array.isArray(repairPlan.createGroupFrames) ? repairPlan.createGroupFrames : [];
    const regroupNodes = Array.isArray(repairPlan.regroupNodes)
      ? repairPlan.regroupNodes
          .map((entry) => ({
            ...entry,
            partial: entry?.partial === true,
            generatedTextCoverage: typeof entry?.generatedTextCoverage === "number" ? entry.generatedTextCoverage : null,
            textSignature: Array.isArray(entry?.textSignature)
              ? entry.textSignature.map((text) => normalizeString(text)).filter(Boolean)
              : [],
            nodeIds: Array.isArray(entry?.nodeIds)
              ? entry.nodeIds.map((nodeId) => String(nodeId || "").trim()).filter(Boolean)
              : []
          }))
          .filter((entry) => entry.nodeIds.length >= 2)
      : [];
    const updateNodeBboxes = Array.isArray(repairPlan.updateNodeBboxes)
      ? repairPlan.updateNodeBboxes
          .map((entry) => ({
            nodeId: String(entry?.nodeId || entry?.id || "").trim(),
            x: typeof entry?.x === "number" ? entry.x : undefined,
            y: typeof entry?.y === "number" ? entry.y : undefined,
            width: typeof entry?.width === "number" ? entry.width : undefined,
            height: typeof entry?.height === "number" ? entry.height : undefined
          }))
          .filter((entry) => entry.nodeId)
      : [];
    const visualColorUpdates = Array.isArray(repairPlan.visualRepairs?.colorUpdates)
      ? repairPlan.visualRepairs.colorUpdates
          .map((entry) => ({
            nodeId: String(entry?.generatedNodeId || entry?.nodeId || "").trim(),
            fillColor: String(entry?.referenceColor || "").trim()
          }))
          .filter((entry) => entry.nodeId && entry.fillColor)
      : [];
    const visualSpacingUpdates = Array.isArray(repairPlan.visualRepairs?.spacingUpdates)
      ? repairPlan.visualRepairs.spacingUpdates
          .map((entry) => ({
            nodeId: String(entry?.generatedNodeId || entry?.generatedNodeIds?.[1] || "").trim(),
            y: typeof entry?.targetY === "number" ? entry.targetY : undefined
          }))
          .filter((entry) => entry.nodeId && typeof entry.y === "number")
      : [];
    const visualGeometryUpdates = Array.isArray(repairPlan.visualRepairs?.geometryUpdates)
      ? repairPlan.visualRepairs.geometryUpdates
          .map((entry) => ({
            nodeId: String(entry?.generatedNodeId || entry?.nodeId || "").trim(),
            x: typeof entry?.target?.x === "number" ? entry.target.x : undefined,
            y: typeof entry?.target?.y === "number" ? entry.target.y : undefined,
            width: typeof entry?.target?.width === "number" ? entry.target.width : undefined,
            height: typeof entry?.target?.height === "number" ? entry.target.height : undefined
          }))
          .filter((entry) => entry.nodeId)
      : [];
    const nodeUpdatesById = new Map();
    for (const update of [...updateNodeBboxes, ...visualSpacingUpdates, ...visualGeometryUpdates, ...visualColorUpdates]) {
      const nodeId = String(update?.nodeId || "").trim();
      if (!nodeId) {
        continue;
      }
      nodeUpdatesById.set(nodeId, {
        ...(nodeUpdatesById.get(nodeId) || {}),
        ...update,
        nodeId
      });
    }
    const nodeUpdates = [...nodeUpdatesById.values()];
    const deleteNodeIds = Array.isArray(repairPlan.deleteNodeIds)
      ? repairPlan.deleteNodeIds.map((nodeId) => String(nodeId || "").trim()).filter(Boolean)
      : [];
    if (createTextNodes.length === 0 && createVisualNodes.length === 0 && createGroupFrames.length === 0 && nodeUpdates.length === 0 && deleteNodeIds.length === 0 && regroupNodes.length === 0) {
      const error = new Error("확인 후 실행할 생성 화면 보정 후보 정보가 올바르지 않습니다.");
      error.code = "invalid_write_candidate_confirm";
      throw error;
    }
    const results = {};
    let appliedUpdateCount = 0;
    if (createTextNodes.length > 0 || createVisualNodes.length > 0 || createGroupFrames.length > 0) {
      const plan = buildBulkCreateNodesPlan({
        defaultParentId: String(preview.targetNodeId || candidate?.targetNodeId || "").trim() || undefined,
        nodes: [...createTextNodes, ...createVisualNodes, ...createGroupFrames]
      });
      results.create = await executePluginCommand(pluginId, "bulk_create_nodes", plan);
      appliedUpdateCount += plan.nodes.length;
      const createdNodes = getBulkCreateResultNodes(results.create);
      const groupFrameOffset = createTextNodes.length + createVisualNodes.length;
      if (regroupNodes.length > 0 && createGroupFrames.length > 0) {
        results.move = [];
        const movedCreatedNodeIds = new Set();
        for (let groupIndex = 0; groupIndex < regroupNodes.length; groupIndex += 1) {
          const groupNodeId = String(createdNodes[groupFrameOffset + groupIndex]?.id || "").trim();
          if (!groupNodeId) {
            continue;
          }
          const groupTextKeys = new Set(
            (Array.isArray(regroupNodes[groupIndex].textSignature) ? regroupNodes[groupIndex].textSignature : [])
              .map((text) => normalizeComparableTextMatchKey(text))
              .filter(Boolean)
          );
          const createdTextNodeIds = [];
          if (groupTextKeys.size > 0) {
            for (let createIndex = 0; createIndex < createTextNodes.length; createIndex += 1) {
              const createdNodeId = String(createdNodes[createIndex]?.id || "").trim();
              if (!createdNodeId || movedCreatedNodeIds.has(createdNodeId)) {
                continue;
              }
              const regroupTargetIndex = createTextNodes[createIndex]?.regroupTargetIndex;
              if (typeof regroupTargetIndex === "number" && regroupTargetIndex !== groupIndex) {
                continue;
              }
              const textKey = normalizeComparableTextMatchKey(createTextNodes[createIndex]?.characters);
              if (!textKey || !groupTextKeys.has(textKey)) {
                continue;
              }
              createdTextNodeIds.push(createdNodeId);
              movedCreatedNodeIds.add(createdNodeId);
            }
          }
          for (const nodeId of [...regroupNodes[groupIndex].nodeIds, ...createdTextNodeIds]) {
            results.move.push(await executePluginCommand(pluginId, "move_node", {
              nodeId,
              parentId: groupNodeId
            }));
            appliedUpdateCount += 1;
          }
        }
      }
    }
    if (nodeUpdates.length > 0) {
      results.update = await executePluginCommand(pluginId, "bulk_update_nodes", {
        updates: nodeUpdates
      });
      appliedUpdateCount += nodeUpdates.length;
    }
    if (deleteNodeIds.length > 0) {
      results.delete = [];
      for (const nodeId of deleteNodeIds) {
        results.delete.push(await executePluginCommand(pluginId, "delete_node", { nodeId }));
      }
      appliedUpdateCount += deleteNodeIds.length;
    }
    return {
      command,
      appliedUpdateCount,
      result: results
    };
  }

  if (command === "bulk_create_nodes") {
    const nodes = Array.isArray(preview.nodes) ? preview.nodes : [];
    const plan = buildBulkCreateNodesPlan({
      defaultParentId: String(preview.targetNodeId || candidate?.targetNodeId || "").trim() || undefined,
      nodes
    });
    const result = await executePluginCommand(pluginId, "bulk_create_nodes", plan);
    return {
      command,
      appliedUpdateCount: plan.nodes.length,
      result
    };
  }

  if (command === "bulk_update_nodes") {
    const updates = Array.isArray(preview.updates)
      ? preview.updates
          .map((entry) => ({
            nodeId: String(entry?.nodeId || entry?.id || "").trim(),
            x: typeof entry?.x === "number" ? entry.x : undefined,
            y: typeof entry?.y === "number" ? entry.y : undefined,
            width: typeof entry?.width === "number" ? entry.width : undefined,
            height: typeof entry?.height === "number" ? entry.height : undefined
          }))
          .filter((entry) => entry.nodeId)
      : [];
    if (updates.length === 0) {
      const error = new Error("확인 후 실행할 bbox 업데이트 후보 정보가 올바르지 않습니다.");
      error.code = "invalid_write_candidate_confirm";
      throw error;
    }
    const result = await executePluginCommand(pluginId, "bulk_update_nodes", { updates });
    return {
      command,
      appliedUpdateCount: updates.length,
      result
    };
  }

  if (command === "delete_node") {
    const nodeIds = Array.isArray(preview.nodeIds)
      ? preview.nodeIds.map((nodeId) => String(nodeId || "").trim()).filter(Boolean)
      : [];
    if (nodeIds.length === 0) {
      const error = new Error("확인 후 실행할 삭제 후보 정보가 올바르지 않습니다.");
      error.code = "invalid_write_candidate_confirm";
      throw error;
    }
    const results = [];
    for (const nodeId of nodeIds) {
      results.push(await executePluginCommand(pluginId, "delete_node", { nodeId }));
    }
    return {
      command,
      appliedUpdateCount: nodeIds.length,
      result: { results }
    };
  }

  const updates = Array.isArray(preview.updates)
    ? preview.updates
        .map((entry) => ({
          id: String(entry?.id || "").trim(),
          text: String(entry?.text || entry?.characters || "").trim()
        }))
        .filter((entry) => entry.id && entry.text)
    : [];

  if (command !== "bulk_update_texts" || updates.length === 0) {
    const error = new Error("확인 후 실행할 쓰기 후보 정보가 올바르지 않습니다.");
    error.code = "invalid_write_candidate_confirm";
    throw error;
  }

  const result = await executePluginCommand(pluginId, "bulk_update_texts", { updates });
  return {
    command,
    appliedUpdateCount: updates.length,
    result
  };
}

function normalizeNodeForBuild(node) {
  if (node.helper === "text") {
    const textDefaults = resolveTextRoleDefaults(node);
    return {
      ...node,
      fontSize: textDefaults.fontSize,
      fontStyle: textDefaults.fontStyle
    };
  }

  const normalizedChildren = Array.isArray(node.children)
    ? node.children.map((child) => normalizeNodeForBuild(child))
    : [];

  if (node.helper === "row" && (!node.align || node.align === "min")) {
    return {
      ...node,
      align: "center",
      children: normalizedChildren
    };
  }

  return {
    ...node,
    children: normalizedChildren
  };
}

async function readBuiltNodeMetrics(pluginId, nodeId) {
  const preview = await executePluginCommand(pluginId, "preview_changes", { nodeId });
  const snapshot = Array.isArray(preview?.previews) ? preview.previews[0]?.before : null;

  return {
    width: typeof snapshot?.width === "number" ? snapshot.width : null,
    height: typeof snapshot?.height === "number" ? snapshot.height : null
  };
}

async function performBuildLayout(pluginId, input = {}) {
  const rawPlan = buildLayoutPlan(input);
  const plan = {
    ...rawPlan,
    root: normalizeNodeForBuild(rawPlan.root)
  };
  const bindingSummary = {
    literal: 0,
    boundVariable: 0,
    missingVariable: 0,
    fallback: 0
  };
  const pendingVariableBindings = [];
  const variableNameCache = new Map();

  const resolveVariableByName = async (variableName) => {
    const normalized = String(variableName || "").trim();
    if (!normalized) {
      return null;
    }
    if (variableNameCache.has(normalized)) {
      return variableNameCache.get(normalized);
    }
    const result = await performDesignSystemSearch(pluginId, {
      query: normalized,
      kinds: ["variables"],
      sources: ["local-file"],
      maxResults: 10
    });
    const matches = Array.isArray(result?.matches) ? result.matches : [];
    const match =
      matches.find((item) => String(item?.name || "").trim() === normalized) ||
      matches[0] ||
      null;
    variableNameCache.set(normalized, match);
    return match;
  };

  const queueFillVariableBindingIfAvailable = async (nodeId, node) => {
    if (!node?.fill) {
      return;
    }
    const variableKey = String(node.fillVariableKey || "").trim();
    const variableName = String(node.fillVariableName || "").trim();
    if (!variableKey && !variableName) {
      bindingSummary.literal += 1;
      return;
    }
    let binding = variableKey ? { variableKey } : null;
    if (!binding && variableName) {
      const match = await resolveVariableByName(variableName);
      if (match?.key) {
        binding = { variableKey: match.key };
      } else if (match?.id) {
        binding = { variableId: match.id };
      }
    }
    if (!binding) {
      bindingSummary.missingVariable += 1;
      bindingSummary.fallback += 1;
      return;
    }
    pendingVariableBindings.push({
      nodeId,
      property: "fills.color",
      ...binding
    });
  };

  const flushQueuedVariableBindings = async () => {
    if (pendingVariableBindings.length === 0) {
      return;
    }
    try {
      await executePluginCommand(
        pluginId,
        "bulk_bind_variables",
        { bindings: pendingVariableBindings },
        {
          timeoutMs: Math.max(
            TOOL_TIMEOUT_MS,
            Math.min(120000, TOOL_TIMEOUT_MS + pendingVariableBindings.length * 1200)
          )
        }
      );
      bindingSummary.boundVariable += pendingVariableBindings.length;
    } catch {
      bindingSummary.missingVariable += pendingVariableBindings.length;
      bindingSummary.fallback += pendingVariableBindings.length;
    }
  };

  const createTree = async (
    parentId,
    node,
    parentLayout = null,
    parentBox = null,
    siblingCount = 1,
    placement = {}
  ) => {
    if (node.helper === "text") {
      const intrinsicTextSize = estimateTextIntrinsicSize(node);
      const textPayload = {
        parentId,
        nodeType: "TEXT",
        name: node.name,
        characters: node.characters,
        fillColor: node.fill,
        fontFamily: node.fontFamily,
        fontStyle: node.fontStyle,
        fontSize: node.fontSize,
        lineHeight: node.lineHeight,
        ...placement
      };

      if (node.widthMode === "hug" && node.heightMode === "hug") {
        textPayload.textAutoResize = "WIDTH_AND_HEIGHT";
      } else if (node.widthMode === "fill") {
        const fillWidth = parentBox
          ? Math.max(1, parentBox.width - parentBox.padding.left - parentBox.padding.right)
          : node.width;
        textPayload.width = fillWidth;
        textPayload.height = intrinsicTextSize.height;
        textPayload.textAutoResize = "HEIGHT";
      } else {
        textPayload.width = node.width;
        textPayload.height = node.height;
      }

      const createdText = await executePluginCommand(pluginId, "create_node", {
        ...textPayload
      });

      const textId = createdText?.created?.id;
      if (!textId) {
        throw new Error(`Failed to create text node: ${node.name}`);
      }

      const textLayoutUpdate = mapChildLayoutConstraints(parentLayout, node);
      if (Object.keys(textLayoutUpdate).length > 0) {
        await executePluginCommand(pluginId, "update_node", {
          nodeId: textId,
          ...textLayoutUpdate
        });
      }
      await queueFillVariableBindingIfAvailable(textId, node);

      const actualTextMetrics = await readBuiltNodeMetrics(pluginId, textId);

      return {
        id: textId,
        helper: node.helper,
        name: node.name,
        width:
          actualTextMetrics.width ||
          (typeof createdText?.created?.width === "number"
            ? createdText.created.width
            : intrinsicTextSize.width),
        height:
          actualTextMetrics.height ||
          (typeof createdText?.created?.height === "number"
            ? createdText.created.height
            : intrinsicTextSize.height),
        children: []
      };
    }

    const initialSize = resolveInitialFrameSize(node, parentLayout, parentBox, siblingCount);

    const frameResult = await executePluginCommand(pluginId, "create_node", {
      parentId,
      nodeType: "FRAME",
      name: node.name,
      width: initialSize.width,
      height: initialSize.height,
      fillColor: node.fill,
      cornerRadius: node.radius,
      clipsContent: node.clipsContent,
      opacity: node.opacity,
      imageDataBase64: node.imageDataBase64,
      imageDataUrl: node.imageDataUrl,
      imageScaleMode: node.imageScaleMode,
      ...placement
    });

    const frameId = frameResult?.created?.id;
    if (!frameId) {
      throw new Error(`Failed to create layout frame: ${node.name}`);
    }
    await queueFillVariableBindingIfAvailable(frameId, node);

    const layoutMode =
      node.layout === "none" ? null : node.layout === "row" ? "HORIZONTAL" : "VERTICAL";

    if (layoutMode) {
      const primaryMode =
        layoutMode === "HORIZONTAL"
          ? resolveLayoutSizingMode(node.widthMode)
          : resolveLayoutSizingMode(node.heightMode);
      const counterMode =
        layoutMode === "HORIZONTAL"
          ? resolveLayoutSizingMode(node.heightMode)
          : resolveLayoutSizingMode(node.widthMode);

      await executePluginCommand(pluginId, "update_node", {
        nodeId: frameId,
        layoutMode,
        clipsContent: node.clipsContent,
        itemSpacing: node.gap,
        paddingLeft: node.padding.left,
        paddingRight: node.padding.right,
        paddingTop: node.padding.top,
        paddingBottom: node.padding.bottom,
        primaryAxisAlignItems: resolveAxisAlign(node.justify),
        counterAxisAlignItems: resolveAxisAlign(node.align),
        primaryAxisSizingMode: primaryMode,
        counterAxisSizingMode: counterMode,
        ...mapChildLayoutConstraints(parentLayout, node)
      });
    } else {
      const layoutConstraintUpdate = mapChildLayoutConstraints(parentLayout, node);
      const freeformUpdate = {
        ...layoutConstraintUpdate,
        clipsContent: node.clipsContent
      };
      Object.keys(freeformUpdate).forEach((key) => {
        if (typeof freeformUpdate[key] === "undefined") {
          delete freeformUpdate[key];
        }
      });
      if (Object.keys(freeformUpdate).length > 0) {
        await executePluginCommand(pluginId, "update_node", {
          nodeId: frameId,
          ...freeformUpdate
        });
      }
    }

    const children = [];
    for (const child of node.children) {
      children.push(
        await createTree(
          frameId,
          child,
          layoutMode,
          {
            width: initialSize.width,
            height: initialSize.height,
            padding: node.padding
          },
          node.children.length,
          layoutMode
            ? {}
            : {
                x:
                  typeof child.x === "number" && Number.isFinite(child.x)
                    ? child.x
                    : undefined,
                y:
                  typeof child.y === "number" && Number.isFinite(child.y)
                    ? child.y
                    : undefined
              }
        )
      );
    }

    const actualFrameMetrics = await readBuiltNodeMetrics(pluginId, frameId);

    return {
      id: frameId,
      helper: node.helper,
      name: node.name,
      width: actualFrameMetrics.width || initialSize.width,
      height: actualFrameMetrics.height || initialSize.height,
      children
    };
  };

  const root = await createTree(plan.parentId, plan.root, null, null, 1, {
    x: plan.x,
    y: plan.y
  });
  await flushQueuedVariableBindings();

  return {
    plan,
    root,
    variableBindingSummary: bindingSummary
  };
}

function isImageLikeFigmaSelection(selection = []) {
  return Array.isArray(selection) && selection.some((item) => {
    const type = String(item?.type || item?.nodeType || item?.kind || "").toLowerCase();
    const name = String(item?.name || item?.title || "").toLowerCase();
    return (
      /\b(image|bitmap|screenshot|snapshot|capture)\b|이미지|스크린샷|캡처|시안/u.test(type) ||
      /\b(image|bitmap|screenshot|snapshot|capture|png|jpe?g|webp)\b|(^|[\s_.-])(asset|reference|reconstruction|mockup)($|[\s_.-])|이미지|스크린샷|캡처|시안/u.test(name)
    );
  });
}

function getSelectionIdsFromFigmaContext(figmaContext = {}) {
  return Array.isArray(figmaContext?.selection)
    ? figmaContext.selection.map((item) => String(item?.id || "").trim()).filter(Boolean)
    : [];
}

function isImageToScreenRequest(message = "", attachments = [], figmaContext = {}) {
  const text = String(message || "").toLowerCase();
  const hasImage = Array.isArray(attachments) && attachments.some((item) => item?.kind === "image" && item?.dataUrl);
  const hasSelectedImage = isImageLikeFigmaSelection(figmaContext?.selection);
  const refersToSelectedImage = /(선택한|선택된|selected)/iu.test(text) && /(이미지|image|스크린샷|screenshot)/iu.test(text);
  const mentionsImageSource = /(이미지|image|첨부|스크린샷|screenshot|캡처|capture|시안)/iu.test(text);
  const mentionsScreenSurface = /(화면|screen|페이지|page|프레임|frame|ui|레이아웃|layout)/iu.test(text);
  const imageConstructionAction = /(그대로|만들|생성|그려|구현|구성|재현|복원|따라|비슷하게)/iu.test(text);
  const asksForScreenConstruction =
    (mentionsScreenSurface && /(확인|보고|참고|분석|기반|그대로|만들|생성|그려|구현|구성|재현|복원)/iu.test(text)) ||
    ((hasImage || hasSelectedImage || refersToSelectedImage) && imageConstructionAction);
  return (
    (hasImage || hasSelectedImage || refersToSelectedImage) &&
    (mentionsImageSource || hasImage || hasSelectedImage) &&
    asksForScreenConstruction
  );
}

function isGeneratedScreenFollowUpRequest(message = "", figmaContext = {}) {
  const text = String(message || "").trim().toLowerCase();
  const generatedScreen = figmaContext?.generatedScreen && typeof figmaContext.generatedScreen === "object"
    ? figmaContext.generatedScreen
    : null;
  if (!text || !generatedScreen?.rootId) {
    return false;
  }
  return (
    /(방금|생성한|만든|구성한|generated|created)/iu.test(text) &&
    /(화면|screen|프레임|frame|간격|계층|정리|다듬|디자인 시스템|spacing|hierarchy|polish|refine)/iu.test(text)
  );
}

function buildGeneratedScreenFollowUpReadPlan() {
  return {
    version: "1.0",
    intentKind: "restructure_layout",
    headline: "generated_screen_followup -> fast_context",
    primaryPhase: "fast_context",
    phases: [
      {
        phase: "fast_context",
        summary: "방금 생성한 화면의 후속 요청이므로 현재 선택과 얕은 구조만 확인합니다.",
        commands: ["get_selection", "get_metadata"],
        reason: "큰 프레임의 deep read와 asset lookup은 후속 요청 응답을 막을 수 있어 지연합니다."
      }
    ],
    commands: ["get_selection", "get_metadata"],
    largeFileSafe: true,
    doNotFullScanByDefault: true
  };
}

function buildGeneratedScreenFollowUpIntentEnvelope(body = {}, figmaContext = {}, message = "") {
  const intentEnvelope = createDesignerIntentEnvelope(
    {
      ...body,
      request: message,
      intentKindOverride: "restructure_layout"
    },
    figmaContext
  );
  const generatedScreen = figmaContext?.generatedScreen && typeof figmaContext.generatedScreen === "object"
    ? figmaContext.generatedScreen
    : {};
  const rootId = String(generatedScreen.rootId || "").trim();
  const rootName = String(generatedScreen.rootName || "").trim();
  const intent = Array.isArray(intentEnvelope.intents) ? intentEnvelope.intents[0] : null;
  if (intent) {
    intent.kind = "restructure_layout";
    intent.objective = message;
    intent.target = {
      type: "generated_screen",
      ids: rootId ? [rootId] : [],
      name: rootName || "방금 생성한 화면",
      scopeNote: "Use the previous generated screen context before escalating to deep canvas reads."
    };
  }
  intentEnvelope.readPlan = buildGeneratedScreenFollowUpReadPlan();
  intentEnvelope.contextScope = {
    ...(intentEnvelope.contextScope || {}),
    targetType: "generated_screen",
    targetIds: rootId ? [rootId] : [],
    selectionRequired: false,
    selectionMode: "generated_screen"
  };
  intentEnvelope.designerContext = {
    ...(intentEnvelope.designerContext || {}),
    generatedScreen,
    target: {
      ...(intentEnvelope.designerContext?.target || {}),
      type: "generated_screen",
      label: rootName || "방금 생성한 화면",
      ids: rootId ? [rootId] : []
    },
    readStrategy: {
      ...(intentEnvelope.designerContext?.readStrategy || {}),
      scope: "generated_screen_followup",
      reason: "방금 생성한 화면의 후속 요청이므로 생성 결과 요약과 얕은 읽기를 우선합니다.",
      followUps: ["fast_context"],
      deferredReads: ["deep_generated_screen_scan", "asset_lookup", "full_page_scan"]
    }
  };
  return intentEnvelope;
}

function buildGeneratedScreenFollowUpBaseBundle({ message = "", figmaContext = {}, execution = {} } = {}) {
  const generatedScreen = figmaContext?.generatedScreen && typeof figmaContext.generatedScreen === "object"
    ? figmaContext.generatedScreen
    : {};
  const rootName = String(generatedScreen.rootName || "").trim() || "방금 생성한 화면";
  const summary = String(generatedScreen.summary || "").trim();
  return {
    version: "1.0",
    intentKind: "restructure_layout",
    headline: "생성 화면 후속 정리",
    summaryText: `${rootName}의 간격과 정보 계층을 얕은 읽기 기준으로 점검했습니다.`,
    findings: [
      {
        id: "finding-generated-screen-scope",
        severity: "low",
        label: "방금 생성한 화면을 대상으로 확인했습니다.",
        detail: summary || "생성 결과 요약과 현재 선택 정보를 기준으로 후속 작업 범위를 잡았습니다."
      },
      {
        id: "finding-generated-screen-read-budget",
        severity: execution?.ok ? "low" : "medium",
        label: execution?.ok
          ? "큰 프레임 deep read는 지연했습니다."
          : "읽기 일부가 실패해 확보된 범위에서만 정리했습니다.",
        detail: "응답 지연을 줄이기 위해 현재 선택과 얕은 구조만 먼저 확인했습니다."
      }
    ],
    recommendations: [
      {
        id: "rec-generated-screen-spacing",
        title: "상단부터 섹션 간격을 먼저 정리하기",
        detail: "상태바, 헤더, 본문 카드, 하단 영역을 큰 단위로 나누고 섹션 간 여백을 일정하게 맞추는 순서가 좋습니다."
      },
      {
        id: "rec-generated-screen-hierarchy",
        title: "주요 정보와 보조 정보를 분리하기",
        detail: "계좌명, 잔액/상태, 주요 액션은 강조하고 설명성 텍스트와 보조 액션은 한 단계 낮은 대비로 정리합니다."
      }
    ],
    applyActions: [],
    risks: []
  };
}

async function executeDesignerGeneratedScreenFollowUpRequest({ pluginId, body = {}, message = "", figmaContext = {} }) {
  const intentEnvelope = buildGeneratedScreenFollowUpIntentEnvelope(body, figmaContext, message);
  const execution = await executeDesignerReadPlan(
    {
      intentEnvelope,
      runCommand: (command, args) => runDesignerReadCommand(pluginId, command, args)
    },
    {
      query: body.query || message,
      fileKey: body.fileKey || figmaContext.fileKey,
      fileKeys: body.fileKeys || figmaContext.fileKeys
    }
  );
  const baseSuggestionBundle = buildGeneratedScreenFollowUpBaseBundle({
    message,
    figmaContext,
    execution
  });
  let codexMeta = {
    aiBackend: "codex_cli",
    codexStatus: "completed",
    fallbackUsed: false,
    fallbackReason: null
  };
  let augmentedDesignerSuggestionBundle = baseSuggestionBundle;
  let ai = buildDesignerCodexAiPayload({
    status: "completed",
    reply: baseSuggestionBundle.summaryText
  });
  const pipelineSnapshot = buildDesignerPipelineSnapshot({
    request: message,
    intentEnvelope,
    execution,
    suggestionBundle: baseSuggestionBundle,
    actionMode: "generated_screen_followup"
  });
  const baseSuggestionBundleWithKnowledge = attachDesignerKnowledgeReferences(
    baseSuggestionBundle,
    pipelineSnapshot
  );
  augmentedDesignerSuggestionBundle = baseSuggestionBundleWithKnowledge;

  try {
    const codexSuggestion = await runCodexDesignerSuggestion(
      {
        request: message,
        intentKind: "restructure_layout",
        contextModel: {
          generatedScreen: figmaContext.generatedScreen || null,
          target: execution?.contextModel?.target || null,
          readMeta: execution?.contextModel?.readMeta || null,
          summary: baseSuggestionBundleWithKnowledge.summaryText
        },
        suggestionBundle: baseSuggestionBundleWithKnowledge,
        pipeline: pipelineSnapshot
      },
      {
        env: process.env,
        cwd: process.cwd(),
        timeoutMs: Math.max(5000, Number(process.env.XBRIDGE_CODEX_CLI_FOLLOWUP_TIMEOUT_MS || 18000))
      }
    );
    augmentedDesignerSuggestionBundle = buildCodexAugmentedSuggestionBundle(
      baseSuggestionBundleWithKnowledge,
      codexSuggestion
    );
    ai = buildDesignerCodexAiPayload({
      status: "completed",
      model: codexSuggestion.model,
      reply: codexSuggestion.reply
    });
  } catch (error) {
    codexMeta = buildDesignerCodexFallbackMeta(error);
    augmentedDesignerSuggestionBundle = {
      ...baseSuggestionBundleWithKnowledge,
      codex: {
        source: "codex_cli",
        status: "fallback",
        errorCode: error?.code || null,
        message: error instanceof Error ? error.message : String(error || "")
      }
    };
    ai = buildDesignerCodexAiPayload({
      status: "fallback",
      reply: "Codex 응답을 완성하지 못해 방금 생성한 화면의 읽기 결과를 기준으로 정리했습니다.",
      failureCode: codexMeta.fallbackReason
    });
  }

  return {
    ok: true,
    intentKind: "restructure_layout",
    ...codexMeta,
    intentEnvelope,
    execution,
    designerSuggestionBundle: augmentedDesignerSuggestionBundle,
    designerActionPreviewBundle: buildDesignerActionPreviewBundle({
      intentEnvelope,
      execution,
      designerSuggestionBundle: augmentedDesignerSuggestionBundle
    }),
    ai
  };
}

function getImageExtensionFromMimeType(mimeType = "") {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("jpeg") || normalized.includes("jpg")) return "jpg";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("gif")) return "gif";
  return "png";
}

function parseImageDataUrl(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    return null;
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], "base64")
  };
}

async function writeDesignerImageAttachmentsToTemp(attachments = []) {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "xbridge-image-layout-"));
  const imagePaths = [];
  const imageSummaries = [];
  const sourceImages = [];
  try {
    for (const [index, attachment] of attachments.entries()) {
      if (attachment?.kind !== "image" || !attachment?.dataUrl) {
        continue;
      }
      const parsed = parseImageDataUrl(attachment.dataUrl);
      if (!parsed || parsed.buffer.length === 0) {
        continue;
      }
      const mimeType = String(attachment.mimeType || parsed.mimeType || "image/png");
      const extension = getImageExtensionFromMimeType(mimeType);
      const imagePath = path.join(tempRoot, `image-${index + 1}.${extension}`);
      await writeFile(imagePath, parsed.buffer);
      imagePaths.push(imagePath);
      imageSummaries.push({
        name: String(attachment.title || `image-${index + 1}`),
        mimeType,
        size: String(attachment.size || parsed.buffer.length)
      });
      sourceImages.push({
        name: String(attachment.title || `image-${index + 1}`),
        mimeType,
        dataBase64: parsed.buffer.toString("base64"),
        sizeBytes: parsed.buffer.length
      });
    }
    return {
      tempRoot,
      imagePaths,
      imageSummaries,
      sourceImages
    };
  } catch (error) {
    await rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

function findFigmaSelectionEntryById(selectionEntries = [], targetNodeId = "") {
  if (!Array.isArray(selectionEntries) || !targetNodeId) {
    return null;
  }
  return selectionEntries.find((entry) => String(entry?.id || "").trim() === targetNodeId) || null;
}

function resolveSelectedNodeImageExportPlan(targetNodeId, selectionEntry = null) {
  const selectionType = String(selectionEntry?.type || "").trim().toUpperCase();
  const isFrameLikeSelection = FRAME_LIKE_SELECTION_TYPES.has(selectionType);
  const defaultScale =
    Number.isFinite(IMAGE_SCREEN_SELECTED_EXPORT_SCALE) &&
    IMAGE_SCREEN_SELECTED_EXPORT_SCALE > 0
      ? IMAGE_SCREEN_SELECTED_EXPORT_SCALE
      : 1;
  const frameScale =
    Number.isFinite(IMAGE_SCREEN_SELECTED_FRAME_EXPORT_SCALE) &&
    IMAGE_SCREEN_SELECTED_FRAME_EXPORT_SCALE > 0
      ? IMAGE_SCREEN_SELECTED_FRAME_EXPORT_SCALE
      : 0.25;

  return {
    targetNodeId: targetNodeId || undefined,
    format: "png",
    scale: isFrameLikeSelection ? Math.min(defaultScale, frameScale) : defaultScale,
    contentsOnly: !isFrameLikeSelection,
    useAbsoluteBounds: false,
    analysisScope: isFrameLikeSelection ? "clipped_frame_viewport" : "selected_node_contents",
    frameViewportClipped: isFrameLikeSelection,
    selectedNodeType: selectionType || null
  };
}

async function addSelectedNodeExportToImageWork(pluginId, imageWork, selectionIds = [], selectionEntries = []) {
  if (imageWork.imagePaths.length > 0) {
    return { attempted: false, reason: "attachments_already_present" };
  }
  const targetNodeId = Array.isArray(selectionIds) && selectionIds.length > 0
    ? String(selectionIds[0] || "").trim()
    : "";
  if (!targetNodeId) {
    return { attempted: false, reason: "missing_selection_id" };
  }
  imageWork.selectedExport = {
    attempted: true,
    targetNodeId,
    ok: false
  };
  const selectionEntry = findFigmaSelectionEntryById(selectionEntries, targetNodeId);
  const exportPlan = resolveSelectedNodeImageExportPlan(targetNodeId, selectionEntry);
  const exported = await executePluginCommand(
    pluginId,
    "export_node",
    exportPlan,
    {
      timeoutMs: EXPORT_NODE_COMMAND_TIMEOUT_MS
    }
  );
  if (!exported?.dataBase64) {
    imageWork.selectedExport = {
      ...imageWork.selectedExport,
      ok: false,
      reason: "missing_data_base64",
      nodeName: exported?.node?.name || null,
      mimeType: exported?.mimeType || null
    };
    return imageWork.selectedExport;
  }
  const imagePath = path.join(imageWork.tempRoot, "selected-node.png");
  await writeFile(imagePath, Buffer.from(String(exported.dataBase64), "base64"));
  imageWork.selectedExport = {
    ...imageWork.selectedExport,
    ok: true,
    nodeName: exported?.node?.name || "selected-node",
    mimeType: exported.mimeType || "image/png",
    sizeBytes: Number(exported.sizeBytes || 0),
    exportPlan
  };
  imageWork.imagePaths.push(imagePath);
  imageWork.imageSummaries.push({
    name: exported?.node?.name || "selected-node",
    mimeType: exported.mimeType || "image/png",
    size: String(exported.sizeBytes || 0),
    selectedNodeId: targetNodeId,
    selectedNodeType: exportPlan.selectedNodeType || null,
    analysisScope: exportPlan.analysisScope,
    frameViewportClipped: exportPlan.frameViewportClipped === true,
    exportScale: exportPlan.scale,
    contentsOnly: exportPlan.contentsOnly,
    useAbsoluteBounds: exportPlan.useAbsoluteBounds,
    note:
      exportPlan.analysisScope === "clipped_frame_viewport"
        ? "Analyze only the pixels visible inside the selected frame viewport; ignore child image pixels outside the clipped frame."
        : null
  });
  imageWork.sourceImages.push({
    name: exported?.node?.name || "selected-node",
    mimeType: exported.mimeType || "image/png",
    dataBase64: String(exported.dataBase64),
    sizeBytes: Number(exported.sizeBytes || 0),
    selectedNodeId: targetNodeId,
    selectedNodeType: exportPlan.selectedNodeType || null,
    analysisScope: exportPlan.analysisScope,
    frameViewportClipped: exportPlan.frameViewportClipped === true
  });
  return imageWork.selectedExport;
}

function attachSourceImageReferenceLayer(tree = {}, sourceImages = []) {
  const sourceImage = Array.isArray(sourceImages)
    ? sourceImages.find((item) => item?.dataBase64)
    : null;
  if (!sourceImage || !tree || typeof tree !== "object") {
    return tree;
  }

  const root = {
    ...tree,
    layout: "none",
    children: Array.isArray(tree.children) ? [...tree.children] : []
  };
  const width = typeof root.width === "number" && Number.isFinite(root.width) ? root.width : 390;
  const height = typeof root.height === "number" && Number.isFinite(root.height) ? root.height : 844;
  root.children.unshift({
    helper: "card",
    name: "Source image reference",
    role: "source-image-reference",
    layout: "none",
    x: 0,
    y: 0,
    width,
    height,
    widthMode: "fixed",
    heightMode: "fixed",
    padding: 0,
    gap: 0,
    radius: 0,
    fill: "#FFFFFF",
    opacity: 0.18,
    clipsContent: true,
    imageDataBase64: sourceImage.dataBase64,
    imageScaleMode: "FILL"
  });
  return root;
}

function stripImagePayloadsFromTree(node = {}) {
  if (!node || typeof node !== "object") {
    return node;
  }
  const clone = { ...node };
  if (clone.imageDataBase64) {
    clone.imageDataBase64 = "[image-data-omitted]";
  }
  if (clone.imageDataUrl) {
    clone.imageDataUrl = "[image-data-omitted]";
  }
  if (Array.isArray(clone.children)) {
    clone.children = clone.children.map((child) => stripImagePayloadsFromTree(child));
  }
  return clone;
}

function stripImagePayloadsFromBuildResult(buildResult = {}) {
  if (!buildResult || typeof buildResult !== "object") {
    return buildResult;
  }
  return {
    ...buildResult,
    plan: buildResult.plan
      ? {
          ...buildResult.plan,
          root: stripImagePayloadsFromTree(buildResult.plan.root)
        }
      : buildResult.plan
  };
}

function formatImageLayoutQualityRetryDetail(firstFailureDetails = {}) {
  const parts = [
    `1차 출력은 인식 role ${firstFailureDetails?.roleCount || 0}개 대비 생성 노드 ${firstFailureDetails?.generatedNodeCount || 0}개로 부족해 재시도했습니다.`
  ];
  if (firstFailureDetails?.nodeCoverageTooLow) {
    parts.push(
      `편집 가능한 레이어가 ${firstFailureDetails.generatedNodeCount || 0}/${firstFailureDetails.requiredNodeCount || 0}개로 너무 적었습니다.`
    );
  }
  if (firstFailureDetails?.coordinateCoverageTooLow) {
    parts.push(
      `좌표 노드 ${firstFailureDetails.coordinateNodeCount || 0}/${firstFailureDetails.requiredCoordinateNodeCount || 0}개로 좌표 반영이 부족했습니다.`
    );
  }
  if (firstFailureDetails?.textCoverageTooLow) {
    parts.push(
      `텍스트 반영이 ${firstFailureDetails.coveredRoleLabelCount || 0}/${firstFailureDetails.requiredCoveredRoleLabelCount || 0}개로 부족했습니다.`
    );
  }
  const missingLabels = Array.isArray(firstFailureDetails?.missingRoleLabels)
    ? firstFailureDetails.missingRoleLabels.map((item) => normalizeString(item)).filter(Boolean).slice(0, 5)
    : [];
  if (missingLabels.length > 0) {
    parts.push(`누락된 문구: ${missingLabels.map((item) => `"${item}"`).join(", ")}.`);
  }
  return parts.join(" ");
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

async function resolveSelectedImageScreenPlacement(pluginId, selectionIds = []) {
  const targetNodeId = Array.isArray(selectionIds) && selectionIds.length > 0
    ? String(selectionIds[0] || "").trim()
    : "";
  if (!targetNodeId) {
    return {};
  }
  try {
    const detail = await executePluginCommand(pluginId, "get_node_details", {
      targetNodeId,
      maxDepth: 0,
      maxNodes: 1
    });
    const geometry = detail?.node?.geometry || {};
    const x = Number(geometry.x);
    const y = Number(geometry.y);
    const width = Number(geometry.width);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(width)) {
      return {
        x: x + width + 80,
        y
      };
    }
  } catch {}
  return {};
}

async function executeDesignerImageScreenRequest({ pluginId, message, figmaContext, attachments, selectionIds }) {
  const imageWork = await writeDesignerImageAttachmentsToTemp(attachments);
  try {
    const selectedExport = await addSelectedNodeExportToImageWork(
      pluginId,
      imageWork,
      selectionIds,
      Array.isArray(figmaContext?.selection) ? figmaContext.selection : []
    );
    if (imageWork.imagePaths.length === 0) {
      const error = new Error(
        selectedExport?.attempted
          ? "Selected image export did not return PNG data."
          : "No readable image attachments were provided."
      );
      error.code = selectedExport?.attempted
        ? "selected_image_export_failed"
        : "image_attachment_missing";
      error.details = selectedExport?.attempted
        ? {
            targetNodeId: selectedExport.targetNodeId || null,
            reason: selectedExport.reason || "missing_data_base64",
            nodeName: selectedExport.nodeName || null,
            mimeType: selectedExport.mimeType || null
          }
        : null;
      throw error;
    }
    const codexPlan = await runCodexImageLayoutPlan(
      {
        request: message,
        figmaContext,
        imagePaths: imageWork.imagePaths,
        imageSummaries: imageWork.imageSummaries
      },
      {
        env: process.env,
        cwd: process.cwd()
      }
    );
    const treeWithReference = attachSourceImageReferenceLayer(codexPlan.tree, imageWork.sourceImages);
    const buildResult = await performBuildLayout(
      pluginId,
      withSessionDefaultParent(pluginId, {
        generatedNamePrefix: "image-screen",
        tree: treeWithReference,
        ...(await resolveSelectedImageScreenPlacement(pluginId, selectionIds))
      })
    );
    const safeBuildResult = stripImagePayloadsFromBuildResult(buildResult);
    const qualityRetry = codexPlan.qualityRetry || null;
    const semanticQuality = codexPlan.semanticQuality || null;
    const postBuildQuality = validateGeneratedImageBuildQuality({
      roleMap: codexPlan.roleMap,
      semanticQuality,
      buildResult: safeBuildResult
    });
    if (postBuildQuality?.postBuildQualityTooLow) {
      const error = new Error(
        "Generated image screen failed post-build quality validation."
      );
      error.code = "codex_cli_image_layout_understructured";
      error.details = {
        ...(postBuildQuality || {}),
        stage: "post_build",
        buildResult: safeBuildResult
      };
      throw error;
    }
    const semanticQualityDetail = semanticQuality
      ? `인식 role ${semanticQuality.roleCount || 0}개 중 생성 노드 ${semanticQuality.generatedNodeCount || 0}개, 좌표 노드 ${semanticQuality.coordinateNodeCount || 0}/${semanticQuality.requiredCoordinateNodeCount || 0}개, 텍스트 반영 ${semanticQuality.coveredRoleLabelCount || 0}/${semanticQuality.visibleRoleLabelCount || 0}개입니다.`
      : `${imageWork.imagePaths.length}개 이미지에서 화면 구조를 분석했습니다.`;
    const qualityRetryFinding =
      qualityRetry?.recovered
        ? {
            id: "finding-image-layout-quality-retry",
            severity: "low",
            label: "구조 품질 재시도 후 화면 구성이 완료되었습니다.",
            detail: formatImageLayoutQualityRetryDetail(qualityRetry.firstFailureDetails || {})
          }
        : null;
    return {
      ok: true,
      intentKind: "generate_screen",
      aiBackend: "codex_cli",
      codexStatus: "completed",
      fallbackUsed: false,
      fallbackReason: null,
      imageGeneration: {
        summary: codexPlan.summary,
        imageCount: imageWork.imagePaths.length,
        canvasSpec: codexPlan.canvasSpec || null,
        layoutMap: Array.isArray(codexPlan.layoutMap) ? codexPlan.layoutMap : [],
        roleMap: Array.isArray(codexPlan.roleMap) ? codexPlan.roleMap : [],
        textStyleMap: Array.isArray(codexPlan.textStyleMap) ? codexPlan.textStyleMap : [],
        semanticQuality: codexPlan.semanticQuality || null,
        postBuildQuality,
        qualityRetry,
        buildResult: safeBuildResult
      },
      ai: buildDesignerCodexAiPayload({
        status: "completed",
        model: codexPlan.model,
        reply: codexPlan.summary
      }),
      designerSuggestionBundle: {
        version: "1.0",
        intentKind: "generate_screen",
        headline: "이미지 분석 기반 화면 구성",
        summaryText: codexPlan.summary,
        findings: [
          {
            id: "finding-image-layout",
            severity: "low",
            label: codexPlan.summary,
            detail: semanticQualityDetail
          }
        ].concat(qualityRetryFinding ? [qualityRetryFinding] : []),
        recommendations: [],
        applyActions: [],
        risks: []
      }
    };
  } finally {
    await rm(imageWork.tempRoot, { recursive: true, force: true });
  }
}

async function executeDesignerImageAnalysisOnlyRequest({
  pluginId,
  message,
  figmaContext,
  attachments,
  selectionIds,
  intentEnvelope
}) {
  const imageWork = await writeDesignerImageAttachmentsToTemp(attachments);
  try {
    const selectedExport = await addSelectedNodeExportToImageWork(
      pluginId,
      imageWork,
      selectionIds,
      Array.isArray(figmaContext?.selection) ? figmaContext.selection : []
    );
    if (imageWork.imagePaths.length === 0) {
      const error = new Error(
        selectedExport?.attempted
          ? "Selected image export did not return PNG data."
          : "No readable image attachments were provided."
      );
      error.code = selectedExport?.attempted
        ? "selected_image_export_failed"
        : "image_attachment_missing";
      error.details = selectedExport?.attempted
        ? {
            targetNodeId: selectedExport.targetNodeId || null,
            reason: selectedExport.reason || "missing_data_base64",
            nodeName: selectedExport.nodeName || null,
            mimeType: selectedExport.mimeType || null
          }
        : null;
      throw error;
    }

    let codexPlan;
    try {
      codexPlan = await runCodexImageLayoutPlan(
        {
          request: message,
          figmaContext,
          imagePaths: imageWork.imagePaths,
          imageSummaries: imageWork.imageSummaries
        },
        {
          env: process.env,
          cwd: process.cwd(),
          imageAnalysisOnly: true
        }
      );
    } catch (error) {
      if (error?.code === "codex_cli_timeout") {
        const diagnosticError = new Error("image_analysis_codex_timeout");
        diagnosticError.code = "debug_bridge_failure";
        diagnosticError.details = {
          userIntentKind: "image_analysis_only",
          failureIntentKind: "debug_bridge_failure",
          failureSource: "codex_cli_timeout",
          stage: "image_analysis_codex",
          imageCount: imageWork.imagePaths.length,
          recommendedNext:
            "선택 이미지 export는 완료됐지만 Codex 이미지 분석이 제한 시간을 넘었습니다. 동일 선택으로 재시도하거나, 상태바/헤더/본문/하단바처럼 구조 단위를 명시해 분석 범위를 좁혀 주세요."
        };
        diagnosticError.designerMeta = {
          originalCode: "codex_cli_timeout",
          taskKind: "debug_bridge_failure"
        };
        throw diagnosticError;
      }
      throw error;
    }
    const summary = codexPlan.summary || "선택 이미지의 UI 요소를 분석했습니다.";
    return {
      ok: true,
      intentKind: "inspect_selection",
      aiBackend: "codex_cli",
      codexStatus: "completed",
      fallbackUsed: false,
      fallbackReason: null,
      intentEnvelope,
      intentClassification: intentEnvelope?.intentClassification || {
        userIntentKind: "image_analysis_only",
        internalIntentKind: "inspect_selection"
      },
      imageAnalysis: {
        summary,
        imageCount: imageWork.imagePaths.length,
        canvasSpec: codexPlan.canvasSpec || null,
        layoutMap: Array.isArray(codexPlan.layoutMap) ? codexPlan.layoutMap : [],
        roleMap: Array.isArray(codexPlan.roleMap) ? codexPlan.roleMap : [],
        textStyleMap: Array.isArray(codexPlan.textStyleMap) ? codexPlan.textStyleMap : [],
        semanticQuality: codexPlan.semanticQuality || null,
        semanticQualityPassed: codexPlan.semanticQualityPassed !== false,
        qualityRetry: codexPlan.qualityRetry || null
      },
      ai: buildDesignerCodexAiPayload({
        status: "completed",
        model: codexPlan.model,
        reply: summary
      }),
      designerSuggestionBundle: {
        version: "1.0",
        intentKind: "inspect_selection",
        headline: "이미지 분석",
        summaryText: summary,
        findings: [
          {
            id: "finding-image-analysis-only",
            severity: "low",
            label: "이미지를 분석했지만 Figma 레이어 생성은 수행하지 않았습니다.",
            detail: codexPlan.semanticQuality
              ? `인식 role ${codexPlan.semanticQuality.roleCount || 0}개, visible label ${codexPlan.semanticQuality.visibleRoleLabelCount || 0}개를 분석했습니다.`
              : `${imageWork.imagePaths.length}개 이미지를 분석했습니다.`
          }
        ],
        recommendations: [],
        applyActions: [],
        risks: []
      }
    };
  } finally {
    await rm(imageWork.tempRoot, { recursive: true, force: true });
  }
}

function getComparableNodeGeometry(node = {}, rootGeometry = null) {
  const source =
    node?.geometry ||
    node?.absoluteBoundingBox ||
    node?.absoluteRenderBounds ||
    node?.bounds ||
    node?.layout ||
    null;
  if (!source || typeof source !== "object") {
    return null;
  }
  const x = Number(source.x);
  const y = Number(source.y);
  const width = Number(source.width);
  const height = Number(source.height);
  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }
  const rootX = rootGeometry && Number.isFinite(rootGeometry.x) ? rootGeometry.x : 0;
  const rootY = rootGeometry && Number.isFinite(rootGeometry.y) ? rootGeometry.y : 0;
  return {
    x: Math.round(x - rootX),
    y: Math.round(y - rootY),
    width: Math.round(width),
    height: Math.round(height)
  };
}

function getComparableNodeRawGeometry(node = {}) {
  const source =
    node?.geometry ||
    node?.absoluteBoundingBox ||
    node?.absoluteRenderBounds ||
    node?.bounds ||
    node?.layout ||
    null;
  if (!source || typeof source !== "object") {
    return null;
  }
  const x = Number(source.x);
  const y = Number(source.y);
  const width = Number(source.width);
  const height = Number(source.height);
  if (![x, y, width, height].every(Number.isFinite)) {
    return null;
  }
  return { x, y, width, height };
}

function deriveComparableRootGeometryFromChildren(node = {}) {
  let minX = Infinity;
  let minY = Infinity;
  for (const current of Array.isArray(node.children) ? node.children : []) {
    if (!current || typeof current !== "object") {
      continue;
    }
    if (isComparableSourceReferenceImageEntry(current)) {
      continue;
    }
    const geometry = getComparableNodeRawGeometry(current);
    if (geometry) {
      minX = Math.min(minX, geometry.x);
      minY = Math.min(minY, geometry.y);
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }
  return {
    x: minX,
    y: minY,
    width: 0,
    height: 0
  };
}

function selectComparableRootGeometry(node = {}) {
  const rootGeometry = getComparableNodeGeometry(node, null);
  const childOrigin = deriveComparableRootGeometryFromChildren(node);
  if (!rootGeometry) {
    return childOrigin;
  }
  if (!childOrigin) {
    return rootGeometry;
  }
  const deltaX = childOrigin.x - rootGeometry.x;
  const deltaY = childOrigin.y - rootGeometry.y;
  const width = Number(rootGeometry.width || 0);
  const height = Number(rootGeometry.height || 0);
  const outsideRootBounds =
    (width > 0 && (deltaX < -16 || deltaX > width + 16)) ||
    (height > 0 && (deltaY < -16 || deltaY > height + 16));
  return outsideRootBounds ? childOrigin : rootGeometry;
}

function getComparableNodeText(node = {}) {
  const type = normalizeString(node?.type || node?.nodeType).toUpperCase();
  const text = normalizeString(node?.characters || node?.text || node?.plainText || node?.content);
  if (!text) {
    return "";
  }
  if (type && type !== "TEXT" && !node?.characters) {
    return "";
  }
  if (isComparableSyntheticTextLabel(text, node)) {
    return "";
  }
  return text;
}

function isComparableSyntheticTextLabel(text, node = {}) {
  const normalizedText = normalizeString(text);
  const normalizedName = normalizeString(node?.name).toLowerCase();
  const lowerText = normalizedText.toLowerCase();
  if (!normalizedText) {
    return true;
  }
  if (/^signal bar \d+$/iu.test(normalizedText)) {
    return true;
  }
  if (/^battery (fill|nub|outline)$/iu.test(normalizedText)) {
    return true;
  }
  if (/^(hero lighter panel|hero bottom shade|circle|winner reward coupon)$/iu.test(normalizedText)) {
    return true;
  }
  if (/^(left|center|right)\s+avatar image block$/iu.test(normalizedText)) {
    return true;
  }
  if (/^(coupon )?chevron$/iu.test(normalizedName) && normalizedText.length <= 2) {
    return true;
  }
  if (/^[+·•›‹⌁▧♦♕↯★☆✦✧✓]$/u.test(normalizedText)) {
    return true;
  }
  return false;
}

function walkComparableNodeTree(node = {}, visitor, depth = 0, rootGeometry = null) {
  if (!node || typeof node !== "object") {
    return;
  }
  visitor(node, depth, rootGeometry);
  const nextRootGeometry =
    depth === 0
      ? selectComparableRootGeometry(node)
      : rootGeometry;
  for (const child of Array.isArray(node.children) ? node.children : []) {
    walkComparableNodeTree(child, visitor, depth + 1, nextRootGeometry);
  }
}

function collectComparableTextEntries(rootNode = {}) {
  const entries = [];
  walkComparableNodeTree(rootNode, (node, depth, rootGeometry) => {
    const text = getComparableNodeText(node);
    if (!text) {
      return;
    }
    entries.push({
      id: normalizeString(node.id),
      name: normalizeString(node.name),
      text,
      depth,
      geometry: getComparableNodeGeometry(node, rootGeometry)
    });
  });
  return entries;
}

function collectComparableTypeCounts(rootNode = {}) {
  const counts = {};
  walkComparableNodeTree(rootNode, (node) => {
    const type = normalizeString(node?.type || node?.nodeType || node?.helper || "UNKNOWN").toUpperCase();
    counts[type] = (counts[type] || 0) + 1;
  });
  return counts;
}

function sumComparableTypeCounts(counts = {}) {
  return Object.values(counts).reduce((total, value) => total + Number(value || 0), 0);
}

function normalizeComparableColor(value) {
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    return text.startsWith("#") ? text.toLowerCase() : text;
  }
  if (value && typeof value === "object") {
    if (typeof value.hex === "string" && value.hex.trim()) {
      return value.hex.trim().toLowerCase();
    }
    const r = Number(value.r);
    const g = Number(value.g);
    const b = Number(value.b);
    if ([r, g, b].every(Number.isFinite)) {
      const toHex = (channel) => {
        const normalized = channel <= 1 ? Math.round(channel * 255) : Math.round(channel);
        return Math.max(0, Math.min(255, normalized)).toString(16).padStart(2, "0");
      };
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
  }
  return "";
}

function getComparableNodeFillColor(node = {}) {
  const direct = normalizeComparableColor(node.fillColor || node.color || node.backgroundColor);
  if (direct) {
    return direct;
  }
  const fills = Array.isArray(node.fills) ? node.fills : [];
  for (const fill of fills) {
    if (fill?.visible === false) {
      continue;
    }
    const color = normalizeComparableColor(fill?.color || fill?.hex || fill?.fillColor);
    if (color) {
      return color;
    }
  }
  return "";
}

function inferComparableVisualRole(node = {}) {
  const type = normalizeString(node?.type || node?.nodeType || node?.helper).toUpperCase();
  const name = normalizeString(node?.name).toLowerCase();
  const text = normalizeString(node?.characters || node?.text).toLowerCase();
  const haystack = `${name} ${text}`;
  if (type === "TEXT") {
    return "text";
  }
  if (/status\s*bar|statusbar|ios status|battery|wi-?fi|cellular|browser toolbar|bottom browser|navigation bar|nav bar/iu.test(haystack)) {
    return "status_bar";
  }
  if (/progress|score bar|bar|meter/iu.test(haystack)) {
    return "progress";
  }
  if (/avatar|profile|runner|photo|image|picture|bitmap/iu.test(haystack) || type === "IMAGE") {
    return "image";
  }
  if (/button|cta|chip|badge|pill|tab/iu.test(haystack)) {
    return "control";
  }
  if (/card|panel|section|container|group/iu.test(haystack) || type === "FRAME" || type === "GROUP") {
    return "container";
  }
  if (/icon|chevron|arrow|star|flame|trophy/iu.test(haystack) || type === "VECTOR" || type === "ELLIPSE") {
    return "icon";
  }
  if (type === "RECTANGLE") {
    return "shape";
  }
  return type ? type.toLowerCase() : "unknown";
}

function collectComparableVisualEntries(rootNode = {}) {
  const entries = [];
  walkComparableNodeTree(rootNode, (node, depth, rootGeometry) => {
    if (depth === 0) {
      return;
    }
    const role = inferComparableVisualRole(node);
    const geometry = getComparableNodeGeometry(node, rootGeometry);
    if (!geometry) {
      return;
    }
    const entry = {
      id: normalizeString(node.id),
      name: normalizeString(node.name),
      type: normalizeString(node?.type || node?.nodeType || node?.helper || "UNKNOWN").toUpperCase(),
      role,
      depth,
      geometry,
      fillColor: getComparableNodeFillColor(node)
    };
    if (isComparableSourceReferenceImageEntry(entry)) {
      return;
    }
    entries.push(entry);
  });
  return entries;
}

function isComparableSourceReferenceImageEntry(entry = {}) {
  const role = normalizeString(entry.role);
  const type = normalizeString(entry.type).toUpperCase();
  const name = normalizeString(entry.name).toLowerCase();
  const width = Number(entry.geometry?.width || 0);
  const height = Number(entry.geometry?.height || 0);
  if (/source image|reference image|image reference|원본|참조 이미지/iu.test(name)) {
    return true;
  }
  return role === "image" && (type === "IMAGE" || /image|bitmap|screenshot|capture/iu.test(name)) && width >= 300 && height >= 500;
}

function isExecutableVisualGeometryRepair(entry = {}) {
  const role = normalizeString(entry.role);
  if (isComparableSourceReferenceImageEntry(entry)) {
    return false;
  }
  return ["progress", "image", "icon", "shape", "control"].includes(role);
}

function buildComparableVisualDeltas(referenceNode = {}, generatedNode = {}) {
  const referenceEntries = collectComparableVisualEntries(referenceNode);
  const generatedEntries = collectComparableVisualEntries(generatedNode);
  const countByRole = (entries) =>
    entries.reduce((counts, entry) => {
      counts[entry.role] = (counts[entry.role] || 0) + 1;
      return counts;
    }, {});
  const referenceRoleCounts = countByRole(referenceEntries);
  const generatedRoleCounts = countByRole(generatedEntries);
  const roles = Array.from(new Set([...Object.keys(referenceRoleCounts), ...Object.keys(generatedRoleCounts)])).sort();
  const isGenericLayerRole = (role) => ["text", "container"].includes(normalizeString(role));
  const roleCountDeltas = roles
    .map((role) => ({
      role,
      referenceCount: Number(referenceRoleCounts[role] || 0),
      generatedCount: Number(generatedRoleCounts[role] || 0),
      delta: Number(generatedRoleCounts[role] || 0) - Number(referenceRoleCounts[role] || 0),
      actionable:
        !isGenericLayerRole(role) &&
        (
          Number(referenceRoleCounts[role] || 0) > Number(generatedRoleCounts[role] || 0) ||
          (Number(referenceRoleCounts[role] || 0) === 0 && Number(generatedRoleCounts[role] || 0) > 0)
        )
    }))
    .filter((entry) => entry.delta !== 0);
  const missingRoles = roles.filter((role) =>
    !isGenericLayerRole(role) &&
    (referenceRoleCounts[role] || 0) > (generatedRoleCounts[role] || 0)
  );
  const extraRoles = roles.filter((role) =>
    !isGenericLayerRole(role) &&
    (referenceRoleCounts[role] || 0) === 0 &&
    (generatedRoleCounts[role] || 0) > 0
  );
  const missingRoleEntries = missingRoles.flatMap((role) => {
    if (role === "text") {
      return [];
    }
    const missingCount = Math.max(0, (referenceRoleCounts[role] || 0) - (generatedRoleCounts[role] || 0));
    return referenceEntries
      .filter((entry) => entry.role === role)
      .slice(0, missingCount)
      .map((entry) => ({
        id: entry.id || null,
        name: entry.name || null,
        type: entry.type || null,
        role: entry.role,
        geometry: entry.geometry || null,
        fillColor: entry.fillColor || null
      }));
  });
  const generatedByRoleAndName = new Map();
  for (const entry of generatedEntries) {
    const key = `${entry.role}:${entry.name}`;
    if (!generatedByRoleAndName.has(key)) {
      generatedByRoleAndName.set(key, entry);
    }
  }
  const colorDeltas = [];
  const geometryDeltas = [];
  const geometryDiagnostics = [];
  for (const reference of referenceEntries) {
    const generated = generatedByRoleAndName.get(`${reference.role}:${reference.name}`);
    if (!generated) {
      continue;
    }
    if (isComparableSourceReferenceImageEntry(reference) || isComparableSourceReferenceImageEntry(generated)) {
      continue;
    }
    if (reference.fillColor && generated.fillColor && generated.fillColor !== reference.fillColor) {
      colorDeltas.push({
        role: reference.role,
        name: reference.name,
        referenceNodeId: reference.id || null,
        generatedNodeId: generated.id || null,
        referenceColor: reference.fillColor,
        generatedColor: generated.fillColor
      });
    }
    if (reference.type !== "TEXT" && generated.type !== "TEXT" && reference.geometry && generated.geometry) {
      const delta = {
        role: reference.role,
        name: reference.name,
        referenceNodeId: reference.id || null,
        generatedNodeId: generated.id || null,
        reference: reference.geometry,
        generated: generated.geometry,
        deltaX: generated.geometry.x - reference.geometry.x,
        deltaY: generated.geometry.y - reference.geometry.y,
        deltaWidth: generated.geometry.width - reference.geometry.width,
        deltaHeight: generated.geometry.height - reference.geometry.height
      };
      if (
        Math.abs(delta.deltaX) > 8 ||
        Math.abs(delta.deltaY) > 8 ||
        Math.abs(delta.deltaWidth) > 8 ||
        Math.abs(delta.deltaHeight) > 8
      ) {
        if (isExecutableVisualGeometryRepair(delta)) {
          geometryDeltas.push(delta);
        } else {
          geometryDiagnostics.push({
            ...delta,
            actionable: false,
            reason: "non_executable_visual_role"
          });
        }
      }
    }
  }
  const referenceLayoutSanity = buildComparableLayoutSanity(referenceNode);
  const generatedLayoutSanity = buildComparableLayoutSanity(generatedNode);
  return {
    roleCounts: {
      reference: referenceRoleCounts,
      generated: generatedRoleCounts
    },
    roleCountDeltas,
    missingRoles,
    missingRoleEntries,
    extraRoles,
    colorDeltas,
    geometryDeltas,
    geometryDiagnostics,
    spacingDeltas: buildComparableSpacingDeltas(referenceNode, generatedNode),
    groupDeltas: buildComparableGroupDeltas(referenceNode, generatedNode),
    layoutSanity: {
      reference: referenceLayoutSanity,
      generated: generatedLayoutSanity,
      issueDelta: Number(generatedLayoutSanity.issueCount || 0) - Number(referenceLayoutSanity.issueCount || 0),
      excessGeneratedIssueCount: Math.max(
        0,
        Number(generatedLayoutSanity.issueCount || 0) - Number(referenceLayoutSanity.issueCount || 0)
      )
    }
  };
}

function getComparableRootBounds(rootNode = {}) {
  const rawRoot = getComparableNodeRawGeometry(rootNode);
  if (rawRoot?.width > 0 && rawRoot?.height > 0) {
    return {
      x: 0,
      y: 0,
      width: Math.round(rawRoot.width),
      height: Math.round(rawRoot.height)
    };
  }
  const entries = [
    ...collectComparableTextEntries(rootNode),
    ...collectComparableVisualEntries(rootNode)
  ].filter((entry) => entry.geometry);
  if (entries.length === 0) {
    return null;
  }
  const maxX = Math.max(...entries.map((entry) => Number(entry.geometry.x || 0) + Number(entry.geometry.width || 0)));
  const maxY = Math.max(...entries.map((entry) => Number(entry.geometry.y || 0) + Number(entry.geometry.height || 0)));
  return {
    x: 0,
    y: 0,
    width: Math.round(maxX),
    height: Math.round(maxY)
  };
}

function getComparableGeometryArea(geometry = null) {
  if (!geometry) {
    return 0;
  }
  return Math.max(0, Number(geometry.width || 0)) * Math.max(0, Number(geometry.height || 0));
}

function getComparableGeometryIntersection(left = null, right = null) {
  if (!left || !right) {
    return null;
  }
  const x1 = Math.max(Number(left.x || 0), Number(right.x || 0));
  const y1 = Math.max(Number(left.y || 0), Number(right.y || 0));
  const x2 = Math.min(Number(left.x || 0) + Number(left.width || 0), Number(right.x || 0) + Number(right.width || 0));
  const y2 = Math.min(Number(left.y || 0) + Number(left.height || 0), Number(right.y || 0) + Number(right.height || 0));
  const width = x2 - x1;
  const height = y2 - y1;
  if (width <= 0 || height <= 0) {
    return null;
  }
  return { x: x1, y: y1, width, height };
}

function isComparableGeometryOffscreen(geometry = null, bounds = null, tolerance = 8) {
  if (!geometry || !bounds) {
    return false;
  }
  return (
    Number(geometry.x || 0) < -tolerance ||
    Number(geometry.y || 0) < -tolerance ||
    Number(geometry.x || 0) + Number(geometry.width || 0) > Number(bounds.width || 0) + tolerance ||
    Number(geometry.y || 0) + Number(geometry.height || 0) > Number(bounds.height || 0) + tolerance
  );
}

function shouldTreatComparableChildGeometryAsLocal(rawGeometry = null, parentGeometry = null) {
  if (!rawGeometry || !parentGeometry) {
    return false;
  }
  const parentWidth = Number(parentGeometry.width || 0);
  const parentHeight = Number(parentGeometry.height || 0);
  if (parentWidth <= 0 || parentHeight <= 0) {
    return false;
  }
  return (
    Number(rawGeometry.x || 0) >= -8 &&
    Number(rawGeometry.y || 0) >= -8 &&
    Number(rawGeometry.x || 0) <= parentWidth + 8 &&
    Number(rawGeometry.y || 0) <= parentHeight + 8
  );
}

function collectComparableLayoutEntries(rootNode = {}) {
  const entries = [];
  const rawRoot = getComparableNodeRawGeometry(rootNode) || { x: 0, y: 0, width: 0, height: 0 };
  const rootOrigin = { x: Number(rawRoot.x || 0), y: Number(rawRoot.y || 0) };
  const visit = (node = {}, depth = 0, parentAbsolute = null) => {
    if (!node || typeof node !== "object") {
      return;
    }
    const rawGeometry = getComparableNodeRawGeometry(node);
    let absoluteGeometry = rawGeometry;
    if (depth > 0 && rawGeometry && parentAbsolute && shouldTreatComparableChildGeometryAsLocal(rawGeometry, parentAbsolute)) {
      absoluteGeometry = {
        ...rawGeometry,
        x: Number(parentAbsolute.x || 0) + Number(rawGeometry.x || 0),
        y: Number(parentAbsolute.y || 0) + Number(rawGeometry.y || 0)
      };
    }
    if (depth > 0 && absoluteGeometry) {
      const text = getComparableNodeText(node);
      const type = normalizeString(node?.type || node?.nodeType || node?.helper || "UNKNOWN").toUpperCase();
      entries.push({
        id: normalizeString(node.id),
        name: normalizeString(node.name),
        text,
        type,
        role: inferComparableVisualRole(node),
        depth,
        geometry: {
          x: Math.round(Number(absoluteGeometry.x || 0) - rootOrigin.x),
          y: Math.round(Number(absoluteGeometry.y || 0) - rootOrigin.y),
          width: Math.round(Number(absoluteGeometry.width || 0)),
          height: Math.round(Number(absoluteGeometry.height || 0))
        }
      });
    }
    const nextParent = absoluteGeometry || parentAbsolute;
    for (const child of Array.isArray(node.children) ? node.children : []) {
      visit(child, depth + 1, nextParent);
    }
  };
  visit(rootNode, 0, rawRoot);
  return entries;
}

function buildComparableLayoutSanity(rootNode = {}) {
  const bounds = getComparableRootBounds(rootNode);
  const layoutEntries = collectComparableLayoutEntries(rootNode).filter((entry) => entry.geometry);
  const textEntries = layoutEntries
    .filter((entry) => entry.text && normalizeString(entry.type).toUpperCase() === "TEXT");
  const visualEntries = layoutEntries
    .filter((entry) => entry.geometry)
    .filter((entry) => normalizeString(entry.type).toUpperCase() !== "TEXT")
    .filter((entry) => !["container", "status_bar"].includes(normalizeString(entry.role)));
  const entries = [...textEntries.map((entry) => ({ ...entry, role: "text", type: "TEXT" })), ...visualEntries];
  const offscreenEntries = entries
    .filter((entry) => isComparableGeometryOffscreen(entry.geometry, bounds))
    .map((entry) => ({
      id: entry.id || null,
      name: entry.name || null,
      text: entry.text || null,
      role: entry.role || null,
      type: entry.type || null,
      geometry: entry.geometry
    }));
  const textOverlapEntries = [];
  for (let leftIndex = 0; leftIndex < textEntries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < textEntries.length; rightIndex += 1) {
      const left = textEntries[leftIndex];
      const right = textEntries[rightIndex];
      const intersection = getComparableGeometryIntersection(left.geometry, right.geometry);
      if (!intersection) {
        continue;
      }
      const intersectionArea = getComparableGeometryArea(intersection);
      const minArea = Math.min(getComparableGeometryArea(left.geometry), getComparableGeometryArea(right.geometry));
      const overlapRatio = minArea > 0 ? Number((intersectionArea / minArea).toFixed(3)) : 0;
      if (overlapRatio <= 0.35 || intersection.height <= 4) {
        continue;
      }
      textOverlapEntries.push({
        left: {
          id: left.id || null,
          text: left.text,
          geometry: left.geometry
        },
        right: {
          id: right.id || null,
          text: right.text,
          geometry: right.geometry
        },
        overlapRatio,
        intersection
      });
    }
  }
  return {
    bounds,
    offscreenCount: offscreenEntries.length,
    textOverlapCount: textOverlapEntries.length,
    issueCount: offscreenEntries.length + textOverlapEntries.length,
    offscreenEntries,
    textOverlapEntries
  };
}

function collectComparableTextSignature(rootNode = {}) {
  return collectComparableTextEntries(rootNode)
    .map((entry) => entry.text)
    .filter(Boolean);
}

function isComparableGroupNode(node = {}, depth = 0) {
  if (depth === 0) {
    return false;
  }
  const type = normalizeString(node?.type || node?.nodeType || node?.helper).toUpperCase();
  if (type === "FRAME" || type === "GROUP" || type === "INSTANCE" || type === "COMPONENT") {
    return true;
  }
  const role = inferComparableVisualRole(node);
  return role === "container" || role === "control";
}

function collectComparableGroupEntries(rootNode = {}) {
  const groups = [];
  walkComparableNodeTree(rootNode, (node, depth, rootGeometry) => {
    if (!isComparableGroupNode(node, depth)) {
      return;
    }
    const textEntries = collectComparableTextEntries(node);
    const textSignature = textEntries.map((entry) => entry.text).filter(Boolean);
    if (textSignature.length < 2) {
      return;
    }
    groups.push({
      id: normalizeString(node.id),
      name: normalizeString(node.name),
      type: normalizeString(node?.type || node?.nodeType || node?.helper || "UNKNOWN").toUpperCase(),
      role: inferComparableVisualRole(node),
      geometry: getComparableNodeGeometry(node, rootGeometry),
      textEntries,
      textSignature
    });
  });
  return groups;
}

function distanceBetweenComparableGeometry(left = null, right = null) {
  if (!left || !right) {
    return Number.POSITIVE_INFINITY;
  }
  const leftX = Number(left.x || 0);
  const leftY = Number(left.y || 0);
  const rightX = Number(right.x || 0);
  const rightY = Number(right.y || 0);
  return Math.abs(leftX - rightX) + Math.abs(leftY - rightY);
}

function selectGeneratedTextEntriesForReferenceGroup(referenceGroup = {}, generatedEntriesByText = new Map()) {
  const selected = [];
  const missing = [];
  const usedNodeIds = new Set();
  for (const referenceEntry of Array.isArray(referenceGroup.textEntries) ? referenceGroup.textEntries : []) {
    const key = normalizeComparableTextMatchKey(referenceEntry?.text);
    if (!key) {
      continue;
    }
    const candidates = (generatedEntriesByText.get(key) || [])
      .filter((entry) => entry?.id && !usedNodeIds.has(entry.id));
    if (candidates.length === 0) {
      missing.push(referenceEntry);
      continue;
    }
    const best = candidates
      .slice()
      .sort((left, right) => {
        const distanceDelta =
          distanceBetweenComparableGeometry(left.geometry, referenceEntry.geometry) -
          distanceBetweenComparableGeometry(right.geometry, referenceEntry.geometry);
        if (distanceDelta !== 0) {
          return distanceDelta;
        }
        return String(left.id || "").localeCompare(String(right.id || ""));
      })[0];
    if (best?.id) {
      usedNodeIds.add(best.id);
      selected.push({
        ...best,
        referenceText: referenceEntry.text,
        referenceGeometry: referenceEntry.geometry || null
      });
    }
  }
  return { selected, missing };
}

function getComparableGroupSignatureKey(group = {}) {
  const entries = Array.isArray(group.textEntries) && group.textEntries.length > 0
    ? group.textEntries
        .slice()
        .sort((left, right) => {
          const leftGeometry = left?.geometry || {};
          const rightGeometry = right?.geometry || {};
          const deltaY = Number(leftGeometry.y || 0) - Number(rightGeometry.y || 0);
          if (deltaY !== 0) {
            return deltaY;
          }
          const deltaX = Number(leftGeometry.x || 0) - Number(rightGeometry.x || 0);
          if (deltaX !== 0) {
            return deltaX;
          }
          return String(left?.id || "").localeCompare(String(right?.id || ""));
        })
        .map((entry) => entry.text)
    : (Array.isArray(group.textSignature) ? group.textSignature : []);
  return entries
    .map((text) => normalizeComparableTextMatchKey(text))
    .filter(Boolean)
    .join(" | ");
}

function getComparableGroupTextKeySet(group = {}) {
  return new Set(
    (Array.isArray(group.textSignature) ? group.textSignature : [])
      .map((text) => normalizeComparableTextMatchKey(text))
      .filter(Boolean)
  );
}

function buildComparableGroupDeltas(referenceNode = {}, generatedNode = {}) {
  const referenceGroups = collectComparableGroupEntries(referenceNode);
  const generatedGroups = collectComparableGroupEntries(generatedNode);
  const generatedEntriesByText = buildEntriesByComparableText(collectComparableTextEntries(generatedNode));
  const generatedBySignature = new Map();
  for (const group of generatedGroups) {
    const key = getComparableGroupSignatureKey(group);
    if (key && !generatedBySignature.has(key)) {
      generatedBySignature.set(key, group);
    }
  }
  const referenceBySignature = new Map();
  for (const group of referenceGroups) {
    const key = getComparableGroupSignatureKey(group);
    if (key && !referenceBySignature.has(key)) {
      referenceBySignature.set(key, group);
    }
  }
  const missingGroups = referenceGroups
    .filter((group) => {
      const key = getComparableGroupSignatureKey(group);
      return key && !generatedBySignature.has(key);
    })
    .map((group) => {
      const { selected: generatedTextEntries, missing: missingTextEntries } =
        selectGeneratedTextEntriesForReferenceGroup(group, generatedEntriesByText);
      return {
        ...group,
        generatedTextEntries,
        generatedTextNodeIds: generatedTextEntries.map((entry) => entry.id).filter(Boolean),
        missingTextEntries,
        generatedTextCoverage:
          group.textSignature.length > 0
            ? Number((generatedTextEntries.length / group.textSignature.length).toFixed(3))
            : 0
      };
    });
  const partialGroups = [];
  for (const referenceGroup of missingGroups) {
    const referenceKeys = getComparableGroupTextKeySet(referenceGroup);
    if (referenceKeys.size < 4) {
      continue;
    }
    let best = null;
    for (const generatedGroup of generatedGroups) {
      const generatedKeys = getComparableGroupTextKeySet(generatedGroup);
      const matchedKeys = [...referenceKeys].filter((key) => generatedKeys.has(key));
      const coverage = referenceKeys.size > 0 ? Number((matchedKeys.length / referenceKeys.size).toFixed(3)) : 0;
      if (matchedKeys.length < 2 || coverage < 0.4) {
        continue;
      }
      if (!best || coverage > best.generatedGroupCoverage) {
        best = {
          referenceNodeId: referenceGroup.id || null,
          referenceName: referenceGroup.name || null,
          referenceRole: referenceGroup.role || null,
          generatedNodeId: generatedGroup.id || null,
          generatedName: generatedGroup.name || null,
          generatedRole: generatedGroup.role || null,
          matchedTextCount: matchedKeys.length,
          referenceTextCount: referenceKeys.size,
          generatedGroupCoverage: coverage
        };
      }
    }
    if (best) {
      partialGroups.push(best);
    }
  }
  const extraGroups = generatedGroups.filter((group) => {
    const key = getComparableGroupSignatureKey(group);
    return key && !referenceBySignature.has(key);
  });
  return {
    referenceGroupCount: referenceGroups.length,
    generatedGroupCount: generatedGroups.length,
    missingGroups,
    partialGroups,
    extraGroups
  };
}

function buildComparableSpacingDeltas(referenceNode = {}, generatedNode = {}) {
  const referenceByText = buildFirstEntryByText(collectComparableTextEntries(referenceNode));
  const generatedByText = buildFirstEntryByText(collectComparableTextEntries(generatedNode));
  const matchedReferenceEntries = [...referenceByText.values()]
    .filter((entry) => entry?.geometry && generatedByText.has(normalizeComparableTextMatchKey(entry.text)))
    .sort((left, right) => {
      const deltaY = left.geometry.y - right.geometry.y;
      return deltaY !== 0 ? deltaY : left.geometry.x - right.geometry.x;
    });
  const deltas = [];
  for (let index = 0; index < matchedReferenceEntries.length - 1; index += 1) {
    const fromReference = matchedReferenceEntries[index];
    const toReference = matchedReferenceEntries[index + 1];
    const fromGenerated = generatedByText.get(normalizeComparableTextMatchKey(fromReference.text));
    const toGenerated = generatedByText.get(normalizeComparableTextMatchKey(toReference.text));
    if (!fromGenerated?.geometry || !toGenerated?.geometry) {
      continue;
    }
    const referenceGapY = toReference.geometry.y - (fromReference.geometry.y + fromReference.geometry.height);
    const generatedGapY = toGenerated.geometry.y - (fromGenerated.geometry.y + fromGenerated.geometry.height);
    const deltaGapY = generatedGapY - referenceGapY;
    if (Math.abs(deltaGapY) <= 8) {
      continue;
    }
    deltas.push({
      fromText: fromReference.text,
      toText: toReference.text,
      referenceGapY,
      generatedGapY,
      deltaGapY,
      generatedNodeId: toGenerated.id || null,
      targetY: toReference.geometry.y,
      referenceNodeIds: [fromReference.id || null, toReference.id || null],
      generatedNodeIds: [fromGenerated.id || null, toGenerated.id || null]
    });
  }
  return deltas;
}

function buildFirstEntryByText(entries = []) {
  const map = new Map();
  for (const entry of entries) {
    const key = normalizeComparableTextMatchKey(entry?.text);
    if (!key || map.has(key)) {
      continue;
    }
    map.set(key, entry);
  }
  return map;
}

function buildEntriesByComparableText(entries = []) {
  const map = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    const key = normalizeComparableTextMatchKey(entry?.text);
    if (!key) {
      continue;
    }
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(entry);
  }
  return map;
}

function normalizeComparableTextMatchKey(text) {
  const normalized = normalizeString(text).toLowerCase();
  if (!normalized) {
    return "";
  }
  return normalized
    .replace(/\s+/gu, " ")
    .replace(/(\d(?:[\d.,]*\d)?)\s+(km|pts|pt|m|kg|%|coins|tickets)\b/giu, "$1$2")
    .trim();
}

function compareReferenceAndGeneratedNodes({ referenceNode = {}, generatedNode = {} } = {}) {
  const referenceTexts = collectComparableTextEntries(referenceNode);
  const generatedTexts = collectComparableTextEntries(generatedNode);
  const referenceByText = buildFirstEntryByText(referenceTexts);
  const generatedByText = buildFirstEntryByText(generatedTexts);
  const referenceUniqueKeys = [...referenceByText.keys()];
  const generatedUniqueKeys = [...generatedByText.keys()];
  const referenceUniqueTexts = referenceUniqueKeys.map((key) => referenceByText.get(key)?.text).filter(Boolean);
  const generatedUniqueTexts = generatedUniqueKeys.map((key) => generatedByText.get(key)?.text).filter(Boolean);
  const structureCounts = {
    reference: collectComparableTypeCounts(referenceNode),
    generated: collectComparableTypeCounts(generatedNode)
  };
  const referenceNodeCount = sumComparableTypeCounts(structureCounts.reference);
  const generatedNodeCount = sumComparableTypeCounts(structureCounts.generated);
  const readQuality = {
    sufficient: true,
    reason: "ok",
    referenceNodeCount,
    generatedNodeCount,
    referenceTextCount: referenceUniqueTexts.length,
    generatedTextCount: generatedUniqueTexts.length
  };
  if (
    referenceUniqueTexts.length === 0 &&
    generatedUniqueTexts.length === 0 &&
    referenceNodeCount <= 2 &&
    generatedNodeCount <= 2
  ) {
    readQuality.sufficient = false;
    readQuality.reason = "shallow_or_empty_detail";
  }
  const matchedKeys = referenceUniqueKeys.filter((key) => generatedByText.has(key));
  const missingKeys = referenceUniqueKeys.filter((key) => !generatedByText.has(key));
  const extraKeys = generatedUniqueKeys.filter((key) => !referenceByText.has(key));
  const matchedTexts = matchedKeys.map((key) => referenceByText.get(key)?.text).filter(Boolean);
  const missingTexts = missingKeys.map((key) => referenceByText.get(key)?.text).filter(Boolean);
  const extraTexts = extraKeys.map((key) => generatedByText.get(key)?.text).filter(Boolean);
  const visualDeltas = buildComparableVisualDeltas(referenceNode, generatedNode);
  const bboxDeltas = matchedKeys
    .map((key) => {
      const reference = referenceByText.get(key);
      const generated = generatedByText.get(key);
      if (!reference?.geometry || !generated?.geometry) {
        return null;
      }
      return {
        text: reference.text,
        referenceNodeId: reference.id || null,
        generatedNodeId: generated.id || null,
        reference: reference.geometry,
        generated: generated.geometry,
        deltaX: generated.geometry.x - reference.geometry.x,
        deltaY: generated.geometry.y - reference.geometry.y,
        deltaWidth: generated.geometry.width - reference.geometry.width,
        deltaHeight: generated.geometry.height - reference.geometry.height
      };
    })
    .filter(Boolean);
  const materialBboxDeltaCount = countMaterialComparableBboxDeltas({ bboxDeltas });
  const textCoverage =
    readQuality.sufficient === false
      ? 0
      : referenceUniqueTexts.length > 0
      ? Number((matchedTexts.length / referenceUniqueTexts.length).toFixed(3))
      : 1;
  const summary =
    readQuality.sufficient === false
      ? "참조 화면과 생성 화면의 하위 텍스트/구조를 충분히 읽지 못했습니다."
      : missingTexts.length === 0 && extraTexts.length === 0 && materialBboxDeltaCount === 0
      ? "참조 화면과 생성 화면의 주요 텍스트 구조가 일치합니다."
      : `참조 텍스트 ${referenceUniqueTexts.length}개 중 ${matchedTexts.length}개가 생성 화면에서 확인됐습니다.`;
  const recommendations = [];
  if (readQuality.sufficient === false) {
    recommendations.push("비교 전 reference/generated 노드의 상세 하위 구조와 TEXT 레이어를 다시 읽으세요.");
  }
  if (missingTexts.length > 0) {
    recommendations.push("누락된 참조 텍스트를 실제 TEXT 레이어로 생성하세요.");
  }
  if (extraTexts.length > 0) {
    recommendations.push("참조에 없는 placeholder/helper 문구가 화면에 노출되지 않도록 제거하세요.");
  }
  if (bboxDeltas.some((entry) => Math.abs(entry.deltaX) > 8 || Math.abs(entry.deltaY) > 8)) {
    recommendations.push("매칭된 텍스트의 bbox 위치를 참조 화면 기준 좌표로 재정렬하세요.");
  }
  if (Number(visualDeltas.layoutSanity?.excessGeneratedIssueCount || 0) > 0) {
    recommendations.push("생성 화면의 offscreen 요소와 겹친 텍스트를 정리해 레이아웃 sanity를 회복하세요.");
  }
  return {
    referenceNodeId: normalizeString(referenceNode.id),
    generatedNodeId: normalizeString(generatedNode.id),
    referenceTextCount: referenceUniqueTexts.length,
    generatedTextCount: generatedUniqueTexts.length,
    matchedTexts,
    missingTexts,
    extraTexts,
    missingTextEntries: missingKeys.map((key) => referenceByText.get(key)).filter(Boolean),
    extraTextEntries: extraKeys.map((key) => generatedByText.get(key)).filter(Boolean),
    textCoverage,
    bboxDeltas,
    materialBboxDeltaCount,
    visualDeltas,
    structureCounts,
    readQuality,
    summary,
    recommendations
  };
}

function countMaterialComparableBboxDeltas(comparison = {}) {
  return (Array.isArray(comparison.bboxDeltas) ? comparison.bboxDeltas : []).filter((entry) => {
    return (
      Math.abs(Number(entry?.deltaX || 0)) > 8 ||
      Math.abs(Number(entry?.deltaY || 0)) > 8 ||
      Math.abs(Number(entry?.deltaWidth || 0)) > 8 ||
      Math.abs(Number(entry?.deltaHeight || 0)) > 8
    );
  }).length;
}

function countComparableLayoutSanityIssues(comparison = {}) {
  if (Number.isFinite(Number(comparison?.visualDeltas?.layoutSanity?.excessGeneratedIssueCount))) {
    return Number(comparison.visualDeltas.layoutSanity.excessGeneratedIssueCount);
  }
  const generated = Number(comparison?.visualDeltas?.layoutSanity?.generated?.issueCount || 0);
  const reference = Number(comparison?.visualDeltas?.layoutSanity?.reference?.issueCount || 0);
  return Math.max(0, generated - reference);
}

function buildPostApplyComparisonQualityVerification(previousComparison = {}, postApplyComparison = {}) {
  const beforeCoverage = Number(previousComparison?.textCoverage || 0);
  const afterCoverage = Number(postApplyComparison?.textCoverage || 0);
  const beforeMissing = Array.isArray(previousComparison?.missingTexts)
    ? previousComparison.missingTexts.length
    : 0;
  const afterMissing = Array.isArray(postApplyComparison?.missingTexts)
    ? postApplyComparison.missingTexts.length
    : 0;
  const beforeExtra = Array.isArray(previousComparison?.extraTexts)
    ? previousComparison.extraTexts.length
    : 0;
  const afterExtra = Array.isArray(postApplyComparison?.extraTexts)
    ? postApplyComparison.extraTexts.length
    : 0;
  const beforeMaterialBbox = countMaterialComparableBboxDeltas(previousComparison);
  const afterMaterialBbox = countMaterialComparableBboxDeltas(postApplyComparison);
  const beforeMissingVisualRoles = Array.isArray(previousComparison?.visualDeltas?.missingRoles)
    ? previousComparison.visualDeltas.missingRoles.length
    : 0;
  const afterMissingVisualRoles = Array.isArray(postApplyComparison?.visualDeltas?.missingRoles)
    ? postApplyComparison.visualDeltas.missingRoles.length
    : 0;
  const beforeMissingVisualEntries = Array.isArray(previousComparison?.visualDeltas?.missingRoleEntries)
    ? previousComparison.visualDeltas.missingRoleEntries.length
    : 0;
  const afterMissingVisualEntries = Array.isArray(postApplyComparison?.visualDeltas?.missingRoleEntries)
    ? postApplyComparison.visualDeltas.missingRoleEntries.length
    : 0;
  const beforeMissingGroups = Array.isArray(previousComparison?.visualDeltas?.groupDeltas?.missingGroups)
    ? previousComparison.visualDeltas.groupDeltas.missingGroups.length
    : 0;
  const afterMissingGroups = Array.isArray(postApplyComparison?.visualDeltas?.groupDeltas?.missingGroups)
    ? postApplyComparison.visualDeltas.groupDeltas.missingGroups.length
    : 0;
  const beforePartialGroups = Array.isArray(previousComparison?.visualDeltas?.groupDeltas?.partialGroups)
    ? previousComparison.visualDeltas.groupDeltas.partialGroups.length
    : 0;
  const afterPartialGroups = Array.isArray(postApplyComparison?.visualDeltas?.groupDeltas?.partialGroups)
    ? postApplyComparison.visualDeltas.groupDeltas.partialGroups.length
    : 0;
  const beforeLayoutIssues = countComparableLayoutSanityIssues(previousComparison);
  const afterLayoutIssues = countComparableLayoutSanityIssues(postApplyComparison);
  const metrics = {
    textCoverageBefore: beforeCoverage,
    textCoverageAfter: afterCoverage,
    textCoverageDelta: Number((afterCoverage - beforeCoverage).toFixed(3)),
    missingTextBefore: beforeMissing,
    missingTextAfter: afterMissing,
    missingTextDelta: afterMissing - beforeMissing,
    extraTextBefore: beforeExtra,
    extraTextAfter: afterExtra,
    extraTextDelta: afterExtra - beforeExtra,
    bboxDeltaCountBefore: beforeMaterialBbox,
    bboxDeltaCountAfter: afterMaterialBbox,
    bboxDeltaCountDelta: afterMaterialBbox - beforeMaterialBbox,
    missingVisualRoleBefore: beforeMissingVisualRoles,
    missingVisualRoleAfter: afterMissingVisualRoles,
    missingVisualRoleDelta: afterMissingVisualRoles - beforeMissingVisualRoles,
    missingVisualEntryBefore: beforeMissingVisualEntries,
    missingVisualEntryAfter: afterMissingVisualEntries,
    missingVisualEntryDelta: afterMissingVisualEntries - beforeMissingVisualEntries,
    missingGroupBefore: beforeMissingGroups,
    missingGroupAfter: afterMissingGroups,
    missingGroupDelta: afterMissingGroups - beforeMissingGroups,
    partialGroupMatchBefore: beforePartialGroups,
    partialGroupMatchAfter: afterPartialGroups,
    partialGroupMatchDelta: afterPartialGroups - beforePartialGroups,
    layoutIssueBefore: beforeLayoutIssues,
    layoutIssueAfter: afterLayoutIssues,
    layoutIssueDelta: afterLayoutIssues - beforeLayoutIssues
  };
  const improved =
    metrics.textCoverageDelta >= 0 &&
    metrics.missingTextDelta <= 0 &&
    metrics.extraTextDelta <= 0 &&
    metrics.bboxDeltaCountDelta <= 0 &&
    metrics.missingVisualRoleDelta <= 0 &&
    metrics.missingVisualEntryDelta <= 0 &&
    metrics.missingGroupDelta <= 0 &&
    (metrics.partialGroupMatchDelta >= 0 || metrics.missingGroupDelta < 0) &&
    metrics.layoutIssueDelta <= 0 &&
    (
      metrics.textCoverageDelta > 0 ||
      metrics.missingTextDelta < 0 ||
      metrics.extraTextDelta < 0 ||
      metrics.bboxDeltaCountDelta < 0 ||
      metrics.missingVisualRoleDelta < 0 ||
      metrics.missingVisualEntryDelta < 0 ||
      metrics.missingGroupDelta < 0 ||
      metrics.partialGroupMatchDelta > 0 ||
      metrics.layoutIssueDelta < 0
    );
  return {
    improved,
    status: improved ? "improved" : "not_improved",
    metrics
  };
}

function getBulkCreateResultNodes(result = {}) {
  if (Array.isArray(result?.created)) {
    return result.created;
  }
  if (Array.isArray(result?.created?.created)) {
    return result.created.created;
  }
  if (Array.isArray(result?.result?.created)) {
    return result.result.created;
  }
  if (Array.isArray(result?.result?.created?.created)) {
    return result.result.created.created;
  }
  return [];
}

function buildGeneratedScreenImprovementPlanFromComparison(comparison = {}) {
  const actions = [];
  for (const text of Array.isArray(comparison.missingTexts) ? comparison.missingTexts : []) {
    actions.push({
      type: "create_missing_text",
      priority: "high",
      text,
      detail: "참조 화면에는 보이지만 생성 화면에는 없는 문구입니다. 실제 TEXT 레이어로 추가해야 합니다."
    });
  }
  for (const text of Array.isArray(comparison.extraTexts) ? comparison.extraTexts : []) {
    actions.push({
      type: "remove_hallucinated_text",
      priority: "high",
      text,
      detail: "참조 화면에 없는 문구가 생성 화면에 노출되어 있습니다. placeholder/helper 텍스트인지 확인 후 제거해야 합니다."
    });
  }
  for (const delta of Array.isArray(comparison.bboxDeltas) ? comparison.bboxDeltas : []) {
    if (
      Math.abs(Number(delta.deltaX || 0)) <= 8 &&
      Math.abs(Number(delta.deltaY || 0)) <= 8 &&
      Math.abs(Number(delta.deltaWidth || 0)) <= 8 &&
      Math.abs(Number(delta.deltaHeight || 0)) <= 8
    ) {
      continue;
    }
    actions.push({
      type: "realign_text_bbox",
      priority: "medium",
      text: delta.text,
      reference: delta.reference || null,
      generated: delta.generated || null,
      deltaX: Number(delta.deltaX || 0),
      deltaY: Number(delta.deltaY || 0),
      deltaWidth: Number(delta.deltaWidth || 0),
      deltaHeight: Number(delta.deltaHeight || 0),
      detail: "생성 화면의 텍스트 위치/크기가 참조 bbox와 다릅니다. 참조 좌표에 맞춰 재배치해야 합니다."
    });
  }
  const summary =
    actions.length === 0
      ? "비교 가능한 텍스트 기준으로 즉시 보정할 항목은 없습니다."
      : `비교 결과 기준 ${actions.length}개 개선 항목을 만들었습니다.`;
  return {
    source: "reference_generated_comparison",
    summary,
    actionCount: actions.length,
    actions
  };
}

function buildLayoutSanityTextUpdatesFromComparison(comparison = {}) {
  const overlapEntries = Array.isArray(comparison?.visualDeltas?.layoutSanity?.generated?.textOverlapEntries)
    ? comparison.visualDeltas.layoutSanity.generated.textOverlapEntries
    : [];
  if (overlapEntries.length === 0) {
    return [];
  }
  const overlappedNodeIds = new Set();
  for (const entry of overlapEntries) {
    const leftId = normalizeString(entry?.left?.id);
    const rightId = normalizeString(entry?.right?.id);
    if (leftId) {
      overlappedNodeIds.add(leftId);
    }
    if (rightId) {
      overlappedNodeIds.add(rightId);
    }
  }
  const updatesByNodeId = new Map();
  for (const delta of Array.isArray(comparison.bboxDeltas) ? comparison.bboxDeltas : []) {
    const nodeId = normalizeString(delta?.generatedNodeId);
    if (!nodeId || !overlappedNodeIds.has(nodeId) || !delta?.reference) {
      continue;
    }
    if (
      Math.abs(Number(delta?.deltaX || 0)) <= 8 &&
      Math.abs(Number(delta?.deltaY || 0)) <= 8 &&
      Math.abs(Number(delta?.deltaWidth || 0)) <= 8 &&
      Math.abs(Number(delta?.deltaHeight || 0)) <= 8
    ) {
      continue;
    }
    updatesByNodeId.set(nodeId, {
      nodeId,
      x: delta.reference.x,
      y: delta.reference.y,
      width: delta.reference.width,
      height: delta.reference.height,
      reason: "layout_sanity_text_overlap",
      text: delta.text || null
    });
  }
  return [...updatesByNodeId.values()];
}

function buildGeneratedScreenRepairPlanFromComparison(comparison = {}) {
  const createTextNodes = (Array.isArray(comparison.missingTextEntries)
    ? comparison.missingTextEntries
    : []
  ).map((entry, index) => ({
    nodeType: "TEXT",
    name: `missing-text-${index + 1}`,
    characters: entry.text,
    x: entry.geometry?.x ?? 0,
    y: entry.geometry?.y ?? 0,
    width: entry.geometry?.width ?? 160,
    height: entry.geometry?.height ?? 20
  }));
  const visualDeltas = comparison.visualDeltas && typeof comparison.visualDeltas === "object"
    ? comparison.visualDeltas
    : {};
  const createVisualNodes = (Array.isArray(visualDeltas.missingRoleEntries)
    ? visualDeltas.missingRoleEntries
    : []
  ).filter((entry) => {
    const role = normalizeString(entry.role);
    const type = normalizeString(entry.type).toUpperCase();
    if (isComparableSourceReferenceImageEntry(entry)) {
      return false;
    }
    if (role === "container") {
      return false;
    }
    if ((role === "control" || role === "unknown") && (type === "FRAME" || type === "GROUP")) {
      return false;
    }
    return ["progress", "image", "icon", "shape", "control"].includes(role) ||
      ["RECTANGLE", "ELLIPSE", "VECTOR", "IMAGE"].includes(type);
  }).map((entry, index) => {
    const role = normalizeString(entry.role || "visual");
    const name = normalizeString(entry.name || role || `visual-${index + 1}`);
    const type = normalizeString(entry.type).toUpperCase();
    const nodeType =
      type === "FRAME" || type === "GROUP"
        ? "FRAME"
        : type === "ELLIPSE"
          ? "ELLIPSE"
          : "RECTANGLE";
    return {
      nodeType,
      name: `missing-visual-${name}`,
      x: entry.geometry?.x ?? 0,
      y: entry.geometry?.y ?? 0,
      width: entry.geometry?.width ?? 24,
      height: entry.geometry?.height ?? 24,
      fillColor: entry.fillColor || (role === "image" ? "#d9dde3" : "#e5e7eb"),
      cornerRadius:
        role === "progress"
          ? 3
          : role === "control"
            ? 12
            : undefined
    };
  });
  const materialTextBboxUpdates = (Array.isArray(comparison.bboxDeltas) ? comparison.bboxDeltas : [])
    .filter((entry) => entry.generatedNodeId && entry.reference)
    .filter((entry) => (
      Math.abs(Number(entry?.deltaX || 0)) > 8 ||
      Math.abs(Number(entry?.deltaY || 0)) > 8 ||
      Math.abs(Number(entry?.deltaWidth || 0)) > 8 ||
      Math.abs(Number(entry?.deltaHeight || 0)) > 8
    ))
    .map((entry) => ({
      nodeId: entry.generatedNodeId,
      x: entry.reference.x,
      y: entry.reference.y,
      width: entry.reference.width,
      height: entry.reference.height
    }));
  const layoutSanityTextUpdates = buildLayoutSanityTextUpdatesFromComparison(comparison);
  const updateNodeBboxesById = new Map();
  for (const update of [...materialTextBboxUpdates, ...layoutSanityTextUpdates]) {
    const nodeId = normalizeString(update?.nodeId);
    if (!nodeId) {
      continue;
    }
    updateNodeBboxesById.set(nodeId, {
      ...(updateNodeBboxesById.get(nodeId) || {}),
      ...update,
      nodeId
    });
  }
  const updateNodeBboxes = [...updateNodeBboxesById.values()];
  const deleteNodeIds = (Array.isArray(comparison.extraTextEntries) ? comparison.extraTextEntries : [])
    .map((entry) => entry.id)
    .filter(Boolean);
  const visualRepairs = {
    missingRoles: (Array.isArray(visualDeltas.missingRoles) ? visualDeltas.missingRoles : []).map((role) => ({
      role,
      referenceCount: Number(visualDeltas.roleCounts?.reference?.[role] || 0),
      generatedCount: Number(visualDeltas.roleCounts?.generated?.[role] || 0),
      action: "create_or_group_missing_visual_role"
    })),
    extraRoles: (Array.isArray(visualDeltas.extraRoles) ? visualDeltas.extraRoles : []).map((role) => ({
      role,
      referenceCount: Number(visualDeltas.roleCounts?.reference?.[role] || 0),
      generatedCount: Number(visualDeltas.roleCounts?.generated?.[role] || 0),
      action: "review_extra_visual_role"
    })),
    colorUpdates: (Array.isArray(visualDeltas.colorDeltas) ? visualDeltas.colorDeltas : []).map((entry) => ({
      generatedNodeId: entry.generatedNodeId || null,
      referenceNodeId: entry.referenceNodeId || null,
      role: entry.role || null,
      name: entry.name || null,
      referenceColor: entry.referenceColor || null,
      generatedColor: entry.generatedColor || null,
      action: "update_fill_color"
    })),
    geometryUpdates: (Array.isArray(visualDeltas.geometryDeltas) ? visualDeltas.geometryDeltas : [])
      .filter((entry) => isExecutableVisualGeometryRepair(entry))
      .map((entry) => ({
        generatedNodeId: entry.generatedNodeId || null,
        referenceNodeId: entry.referenceNodeId || null,
        role: entry.role || null,
        name: entry.name || null,
        target: entry.reference || null,
        generated: entry.generated || null,
        deltaX: Number(entry.deltaX || 0),
        deltaY: Number(entry.deltaY || 0),
        deltaWidth: Number(entry.deltaWidth || 0),
        deltaHeight: Number(entry.deltaHeight || 0),
        action: "update_visual_bbox"
      })),
    spacingUpdates: (Array.isArray(visualDeltas.spacingDeltas) ? visualDeltas.spacingDeltas : []).map((entry) => ({
      fromText: entry.fromText || null,
      toText: entry.toText || null,
      referenceGapY: Number(entry.referenceGapY || 0),
      generatedGapY: Number(entry.generatedGapY || 0),
      deltaGapY: Number(entry.deltaGapY || 0),
      generatedNodeId: entry.generatedNodeId || null,
      targetY: typeof entry.targetY === "number" ? entry.targetY : null,
      generatedNodeIds: Array.isArray(entry.generatedNodeIds) ? entry.generatedNodeIds : [],
      action: "adjust_vertical_spacing"
    })),
    layoutSanityUpdates: layoutSanityTextUpdates.map((entry) => ({
      generatedNodeId: entry.nodeId,
      text: entry.text || null,
      target: {
        x: entry.x,
        y: entry.y,
        width: entry.width,
        height: entry.height
      },
      action: "restore_text_bbox_from_reference"
    })),
    groupRepairs: {
      missingGroups: (Array.isArray(visualDeltas.groupDeltas?.missingGroups)
        ? visualDeltas.groupDeltas.missingGroups
        : []
      ).map((entry) => ({
        referenceNodeId: entry.id || null,
        name: entry.name || null,
        role: entry.role || null,
        textSignature: Array.isArray(entry.textSignature) ? entry.textSignature : [],
        action: "create_or_regroup_component_like_structure"
      })),
      extraGroups: (Array.isArray(visualDeltas.groupDeltas?.extraGroups)
        ? visualDeltas.groupDeltas.extraGroups
        : []
      ).map((entry) => ({
        generatedNodeId: entry.id || null,
        name: entry.name || null,
        role: entry.role || null,
        textSignature: Array.isArray(entry.textSignature) ? entry.textSignature : [],
        action: "review_extra_component_like_structure"
      }))
    }
  };
  const regroupSourceGroups = (Array.isArray(visualDeltas.groupDeltas?.missingGroups)
    ? visualDeltas.groupDeltas.missingGroups
    : []
  )
    .filter((entry) => {
      const nodeIds = Array.isArray(entry.generatedTextNodeIds) ? entry.generatedTextNodeIds.filter(Boolean) : [];
      const coverage = Number(entry.generatedTextCoverage || 0);
      const role = normalizeString(entry.role);
      const textCount = Array.isArray(entry.textSignature) ? entry.textSignature.length : 0;
      const missingTextEntries = Array.isArray(entry.missingTextEntries) ? entry.missingTextEntries : [];
      if (nodeIds.length < 2) {
        return false;
      }
      if (coverage >= 1) {
        return true;
      }
      if (missingTextEntries.length > 0 && coverage >= 0.4 && textCount >= 4) {
        return true;
      }
      return coverage >= 0.4 && textCount >= 4 && ["control", "container"].includes(role);
    });
  const assignedRegroupNodeIds = new Set();
  const regroupNodes = regroupSourceGroups.map((entry, index) => {
    const nodeIds = [];
    const missingTextEntries = Array.isArray(entry.missingTextEntries) ? [...entry.missingTextEntries] : [];
    for (const generatedEntry of Array.isArray(entry.generatedTextEntries) ? entry.generatedTextEntries : []) {
      const nodeId = normalizeString(generatedEntry?.id);
      if (!nodeId) {
        continue;
      }
      if (assignedRegroupNodeIds.has(nodeId)) {
        missingTextEntries.push({
          text: generatedEntry.referenceText || generatedEntry.text,
          geometry: generatedEntry.referenceGeometry || generatedEntry.geometry || null
        });
        continue;
      }
      assignedRegroupNodeIds.add(nodeId);
      nodeIds.push(nodeId);
    }
    return {
      name: entry.name || `regroup-${index + 1}`,
      role: entry.role || null,
      nodeIds,
      partial: Number(entry.generatedTextCoverage || 0) < 1,
      generatedTextCoverage: Number(entry.generatedTextCoverage || 0),
      textSignature: Array.isArray(entry.textSignature) ? entry.textSignature : [],
      missingTextEntries,
      frame: {
        nodeType: "FRAME",
        name: entry.name || `regroup-${index + 1}`,
        x: entry.geometry?.x ?? 0,
        y: entry.geometry?.y ?? 0,
        width: entry.geometry?.width ?? 160,
        height: entry.geometry?.height ?? 120,
        fillColor: "#ffffff",
        cornerRadius: 12
      },
      action: "create_frame_and_move_existing_nodes"
    };
  });
  const globalMissingTextKeys = new Set(createTextNodes
    .map((entry) => normalizeComparableTextMatchKey(entry.characters))
    .filter(Boolean));
  const groupScopedCreateTextNodes = regroupNodes.flatMap((group, groupIndex) =>
    (Array.isArray(group.missingTextEntries) ? group.missingTextEntries : [])
      .filter((entry) => !globalMissingTextKeys.has(normalizeComparableTextMatchKey(entry?.text)))
      .map((entry, entryIndex) => ({
      nodeType: "TEXT",
      name: `missing-group-text-${groupIndex + 1}-${entryIndex + 1}`,
      characters: entry.text,
      x: entry.geometry?.x ?? 0,
      y: entry.geometry?.y ?? 0,
      width: entry.geometry?.width ?? 160,
      height: entry.geometry?.height ?? 20,
      regroupTargetIndex: groupIndex
    }))
  );
  return {
    createTextNodes: [...createTextNodes, ...groupScopedCreateTextNodes],
    createVisualNodes,
    regroupNodes,
    updateNodeBboxes,
    deleteNodeIds,
    visualRepairs
  };
}

function countGeneratedScreenRepairPlanActions(repairPlan = {}) {
  return [
    repairPlan.createTextNodes,
    repairPlan.createVisualNodes,
    repairPlan.regroupNodes,
    repairPlan.updateNodeBboxes,
    repairPlan.deleteNodeIds
  ].reduce((total, entries) => total + (Array.isArray(entries) ? entries.length : 0), 0);
}

function hasExecutableDesignerActionCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== "object" || candidate.blocked === true) {
    return false;
  }
  const command = normalizeString(candidate.command);
  const argsHint = candidate.argsHint && typeof candidate.argsHint === "object" ? candidate.argsHint : {};
  if (command === "generated_screen_repair") {
    return countGeneratedScreenRepairPlanActions(argsHint.repairPlan || {}) > 0;
  }
  if (command === "bulk_create_nodes") {
    return Array.isArray(argsHint.nodes) && argsHint.nodes.length > 0;
  }
  if (command === "bulk_update_nodes") {
    return Array.isArray(argsHint.updates) && argsHint.updates.length > 0;
  }
  if (command === "delete_node") {
    return Array.isArray(argsHint.nodeIds) && argsHint.nodeIds.length > 0;
  }
  return Boolean(command);
}

function buildTopLevelDesignerActionCandidates(actionPreviewBundle = {}) {
  const previews = Array.isArray(actionPreviewBundle.previews) ? actionPreviewBundle.previews : [];
  return previews.flatMap((preview, previewIndex) => {
    const candidates = Array.isArray(preview.bridgeCommandCandidates)
      ? preview.bridgeCommandCandidates
      : [];
    return candidates
      .filter((candidate) => hasExecutableDesignerActionCandidate(candidate))
      .map((candidate, candidateIndex) => ({
        ...candidate,
        id: normalizeString(candidate.id) ||
          `${normalizeString(preview.id) || `action-preview-${previewIndex + 1}`}-candidate-${candidateIndex + 1}`,
        actionId: normalizeString(preview.actionId) || normalizeString(preview.id) || null,
        actionType: normalizeString(preview.actionType) || null,
        label: normalizeString(preview.label) || null,
        readiness: normalizeString(preview.readiness) || null,
        applyMode: normalizeString(preview.applyMode) || null,
        canApplyNow: preview.canApplyNow === true
      }));
  });
}

async function executeDesignerCompareReferenceAndGeneratedRequest({
  pluginId,
  body = {},
  message = "",
  figmaContext = {},
  intentEnvelope
}) {
  const selectionIds =
    Array.isArray(body.selectionIds) && body.selectionIds.length > 0
      ? body.selectionIds.map((id) => normalizeString(id)).filter(Boolean)
      : getSelectionIdsFromFigmaContext(figmaContext);
  if (selectionIds.length < 2) {
    const error = new Error("Reference/generated comparison requires at least two selected nodes.");
    error.code = "compare_targets_required";
    throw error;
  }
  const [referenceNodeId, generatedNodeId] = selectionIds;
  const referenceDetail = await readComparableNodeDetail(pluginId, referenceNodeId);
  const generatedDetail = await readComparableNodeDetail(pluginId, generatedNodeId);
  const comparison = compareReferenceAndGeneratedNodes({
    referenceNode: referenceDetail?.node || referenceDetail,
    generatedNode: generatedDetail?.node || generatedDetail
  });
  const materialBboxDeltaCount = countMaterialComparableBboxDeltas(comparison);
  const finalIntentEnvelope =
    intentEnvelope ||
    createDesignerIntentEnvelope(
      {
        ...body,
        request: message
      },
      figmaContext
    );
  return {
    ok: true,
    intentKind: "compare_reference_and_generated",
    pluginId,
    aiBackend: "deterministic",
    codexStatus: "skipped",
    fallbackUsed: false,
    fallbackReason: null,
    intentEnvelope: finalIntentEnvelope,
    intentClassification: finalIntentEnvelope?.intentClassification || {
      userIntentKind: "compare_reference_and_generated",
      internalIntentKind: "inspect_selection"
    },
    comparison,
    designerSuggestionBundle: {
      version: "1.0",
      intentKind: "compare_reference_and_generated",
      headline: "참조 화면과 생성 화면 비교",
      summaryText: comparison.summary,
      findings: [
        {
          id: "finding-reference-generated-text-coverage",
          severity: comparison.readQuality?.sufficient === false || comparison.textCoverage < 0.9 ? "medium" : "low",
          label: `텍스트 커버리지 ${Math.round(comparison.textCoverage * 100)}%`,
          detail: `누락 ${comparison.missingTexts.length}개, 추가 ${comparison.extraTexts.length}개, material bbox delta ${materialBboxDeltaCount}개를 확인했습니다.`
        }
      ],
      recommendations: comparison.recommendations,
      applyActions: [],
      risks: []
    },
    ai: buildDesignerCodexAiPayload({
      status: "completed",
      reply: comparison.summary
    })
  };
}

async function readComparableNodeDetail(pluginId, targetNodeId) {
  const metadataPlan = {
    targetNodeId,
    maxDepth: 6,
    maxNodes: 300,
    includeJson: true
  };
  try {
    const metadata = await executePluginCommand(pluginId, "get_metadata", metadataPlan);
    const roots = getMetadataResultRoots(metadata);
    return {
      pluginId: metadata?.pluginId || pluginId,
      fileKey: metadata?.fileKey || null,
      fileName: metadata?.fileName || null,
      pageId: metadata?.pageId || metadata?.json?.pageId || null,
      pageName: metadata?.pageName || metadata?.json?.pageName || null,
      detailLevel: "metadata",
      includeChildren: true,
      maxDepth: metadataPlan.maxDepth,
      maxNodes: metadataPlan.maxNodes,
      nodeCount: metadata?.nodeCount || roots.length,
      truncated: Boolean(metadata?.truncated),
      source: "metadata",
      node: roots[0] || null,
      metadata
    };
  } catch (error) {
    const detailPlan = buildNodeDetailsPlan({
      targetNodeId,
      includeChildren: true,
      detailLevel: "layout",
      maxDepth: 4,
      maxNodes: 160
    });
    try {
      return await executePluginCommand(pluginId, "get_node_details", detailPlan);
    } catch (detailError) {
      return {
        pluginId,
        detailLevel: "unavailable",
        includeChildren: false,
        maxDepth: 0,
        maxNodes: 0,
        nodeCount: 1,
        truncated: true,
        source: "compare_read_failed",
        fallback: {
          used: true,
          fromCommand: "get_node_details",
          reason: describeFallbackReason(detailError || error)
        },
        node: {
          id: targetNodeId,
          name: targetNodeId,
          type: "UNKNOWN",
          children: []
        }
      };
    }
  }
}

async function executeDesignerImproveGeneratedScreenRequest({
  pluginId,
  body = {},
  message = "",
  figmaContext = {},
  intentEnvelope
}) {
  const comparisonResponse = await executeDesignerCompareReferenceAndGeneratedRequest({
    pluginId,
    body,
    message,
    figmaContext,
    intentEnvelope
  });
  const comparison = comparisonResponse.comparison || {};
  const improvementPlan = buildGeneratedScreenImprovementPlanFromComparison(comparison);
  const repairPlan = buildGeneratedScreenRepairPlanFromComparison(comparison);
  const repairActionCount = countGeneratedScreenRepairPlanActions(repairPlan);
  const materialBboxDeltaCount = countMaterialComparableBboxDeltas(comparison);
  const applyActions =
    improvementPlan.actionCount > 0 || repairActionCount > 0
      ? [
          {
            id: "action-generated-screen-repair",
            actionType: "generated_screen_repair",
            label: "참조 비교 결과로 생성 화면 보정",
            targetNodeId: comparison.generatedNodeId || null,
            repairPlan
          }
        ]
      : [];
  const findings = [
    {
      id: "finding-generated-screen-improvement-comparison",
      severity: improvementPlan.actionCount > 0 || repairActionCount > 0 ? "medium" : "low",
      label: improvementPlan.summary,
      detail: `텍스트 커버리지 ${Math.round(Number(comparison.textCoverage || 0) * 100)}%, 누락 ${comparison.missingTexts?.length || 0}개, 추가 ${comparison.extraTexts?.length || 0}개, bbox 보정 후보 ${materialBboxDeltaCount}개입니다.`
    }
  ];
  const designerSuggestionBundle = {
    version: "1.0",
    intentKind: "improve_generated_screen",
    headline: "생성 화면 개선 계획",
    summaryText: improvementPlan.summary,
    findings,
    recommendations: [
      ...improvementPlan.actions.slice(0, 8).map((action, index) => ({
        id: `rec-generated-screen-improvement-${index + 1}`,
        title:
          action.type === "create_missing_text"
            ? `누락 문구 추가: ${action.text}`
            : action.type === "remove_hallucinated_text"
              ? `불필요 문구 제거: ${action.text}`
              : `bbox 재정렬: ${action.text}`,
        detail: action.detail
      }))
    ],
    applyActions,
    risks: []
  };
  const previewExecution = {
    ok: true,
    summary: { errorCount: 0 },
    phases: [
      {
        phase: "focused_detail",
        commandResults: [{ status: "ok", command: "get_node_details" }]
      }
    ]
  };
  const actionPreviewBundle = buildDesignerActionPreviewBundle({
    intentEnvelope,
    execution: previewExecution,
    designerSuggestionBundle
  });
  return {
    ...comparisonResponse,
    intentKind: "improve_generated_screen",
    intentClassification: comparisonResponse.intentClassification || {
      userIntentKind: "improve_generated_screen",
      internalIntentKind: "generate_screen"
    },
    improvementPlan,
    repairPlan,
    designerSuggestionBundle,
    designerActionPreviewBundle: actionPreviewBundle,
    actionCandidates: buildTopLevelDesignerActionCandidates(actionPreviewBundle),
    ai: buildDesignerCodexAiPayload({
      status: "completed",
      reply: improvementPlan.summary
    })
  };
}

async function performComposeScreenFromIntents(pluginId, input = {}) {
  const normalizedInput = withSessionDefaultParent(pluginId, input);
  try {
    const plan = buildComposeScreenFromIntentsPlan(normalizedInput);
    composeRuntimeMetrics.recordValidation({
      report: plan.validationReport,
      validationMode: plan.validationMode
    });

    const result = await performBuildLayout(pluginId, {
      parentId: plan.parentId,
      x: plan.x,
      y: plan.y,
      tree: plan.tree
    });

    composeRuntimeMetrics.recordCompose({
      validationMode: plan.validationMode,
      validationReport: plan.validationReport,
      composition: plan.composition,
      ok: true
    });

    return {
      plan,
      validationReport: plan.validationReport,
      composition: plan.composition,
      root: result.root
    };
  } catch (error) {
    const message = error?.message || "compose_screen_from_intents failed";
    const requestedMode =
      String(normalizedInput.validationMode || "").trim().toLowerCase() === "strict"
        ? "strict"
        : "lenient";
    if (requestedMode === "strict" && message.includes("strict validation blocked compose")) {
      composeRuntimeMetrics.recordValidation({
        report: {
          status: "warn",
          canCompose: true,
          errorCount: 0,
          warningCount: 1,
          resolvedSource: "unknown",
          resolvedSectionCount: 0
        },
        validationMode: "strict",
        blockedByStrict: true
      });
    }
    composeRuntimeMetrics.recordCompose({
      validationMode: requestedMode,
      ok: false,
      errorMessage: message
    });
    throw error;
  }
}

function performValidateExternalComposeInput(input = {}) {
  const result = validateExternalComposeInput(input);
  composeRuntimeMetrics.recordValidation({
    report: result.report,
    validationMode: input.validationMode
  });
  return {
    ...result,
    validationReport: result.report
  };
}

function performGetComposeMetrics() {
  return composeRuntimeMetrics.getReport();
}

async function tryExecuteDesignerFastPath({
  pluginId,
  message,
  figmaContext,
  intentEnvelope,
  aiDirectedMatch = null
}) {
  const matched =
    aiDirectedMatch ||
    matchSelectionTextRewriteFastPath(message, figmaContext, intentEnvelope) ||
    matchGenericSelectionTextRewriteFastPath(message, figmaContext, intentEnvelope);
  if (!matched) {
    return null;
  }

  let selectionItems = Array.isArray(figmaContext?.selection) ? figmaContext.selection : [];
  const commandResults = [];

  if (selectionItems.length === 0) {
    const error = new Error(
      "No synced selection is available for the requested text operation."
    );
    error.code = "selection_sync_missing";
    throw error;
  }

  if (matched.selectionIds.length === 0) {
    const error = new Error("No synced selection is available for the requested text operation.");
    error.code = "selection_required";
    throw error;
  }

  const selectedTextNodes = selectionItems
    .filter((item) => String(item?.type || "").toUpperCase() === "TEXT")
    .map((item) => ({
      id: item.id,
      name: item.name || "text",
      characters: item.characters || ""
    }));

  const collectedTextNodes = [];

  if (selectedTextNodes.length === matched.selectionIds.length && selectedTextNodes.length > 0) {
    collectedTextNodes.push(...selectedTextNodes);
  } else if (matched.selectionIds.length > 1) {
    const result = await executePluginCommand(pluginId, "list_text_nodes", {
      scope: "selection"
    });
    const textNodes = Array.isArray(result?.textNodes) ? result.textNodes : [];
    collectedTextNodes.push(...textNodes);
    commandResults.push({
      command: "list_text_nodes",
      status: "ok",
      scope: "selection",
      targetCount: matched.selectionIds.length,
      textNodeCount: textNodes.length
    });
  } else {
    for (const targetNodeId of matched.selectionIds) {
      const result = await executePluginCommand(pluginId, "list_text_nodes", {
        targetNodeId,
        scope: "target"
      });
      const textNodes = Array.isArray(result?.textNodes) ? result.textNodes : [];
      collectedTextNodes.push(...textNodes);
      commandResults.push({
        command: "list_text_nodes",
        status: "ok",
        targetNodeId,
        textNodeCount: textNodes.length
      });
    }
  }

  const aiConfig = getDesignerAiConfig();
  let updates = [];
  let ai = null;
  let rewriteTelemetry = null;
  if (matched.type === "selection_text_rewrite") {
    updates = buildClubTopicTextUpdates(matched.topicLabel, collectedTextNodes);
  } else {
    const draft = await buildDesignerTextRewriteDraft({
      message,
      figmaContext,
      textNodes: collectedTextNodes,
      aiConfig
    });
    ai = {
      provider: draft.provider,
      model: draft.model,
      taskKind: draft.taskKind || null,
      fallbackMode: draft.fallbackMode || null,
      outputValidation: draft.outputValidation || null,
      response: {
        reply: draft.reply
      }
    };
    rewriteTelemetry = {
      provider: draft.provider,
      model: draft.model,
      taskKind: draft.taskKind || null,
      chunkCount: Number(draft.chunkCount || 0),
      retryCount: Number(draft.retryCount || 0),
      fallbackMode: draft.fallbackMode || null,
      outputValidation: draft.outputValidation || null
    };
    updates = sanitizeDesignerTextUpdates(
      draft.updates,
      collectedTextNodes.map((node) => node?.id)
    );
  }

  const bulkResult = await executePluginCommand(pluginId, "bulk_update_texts", { updates });
  commandResults.push({
    command: "bulk_update_texts",
    status: "ok",
    updateCount: updates.length
  });

  const fallbackReply =
    matched.type === "selection_text_rewrite"
      ? `선택된 텍스트 ${updates.length}개를 ${matched.topicLabel} 내용으로 바로 변경했어요.`
      : String(ai?.response?.reply || `선택된 텍스트 ${updates.length}개를 요청한 방향에 맞게 바로 변경했어요.`);
  const actionPreviewBundle = {
    summary: {
      actionCount: 1,
      readyTotal: 1,
      blockedTotal: 0
    },
    previews: []
  };

  const responsePayload = {
    ok: true,
    fastPath: {
      type: matched.type,
      topicLabel: matched.topicLabel || null,
      selectionIds: matched.selectionIds,
      appliedTextNodeCount: updates.length,
      telemetry: rewriteTelemetry
    },
    intentEnvelope,
    execution: {
      ok: true,
      phases: [
        {
          phase: "fast_path_text_rewrite",
          ok: true,
          commandResults
        }
      ],
      summary: {
        phaseCount: 1,
        commandCount: commandResults.length,
        okCount: commandResults.length,
        skippedCount: 0,
        errorCount: 0
      }
    },
    designerSuggestionBundle: {
      intentKind: "revise_copy",
      headline:
        matched.type === "selection_text_rewrite"
          ? `${matched.topicLabel} 기준 텍스트 즉시 변경`
          : "AI 기반 선택 텍스트 즉시 변경",
      summaryText:
        matched.type === "selection_text_rewrite"
          ? `선택 텍스트 ${updates.length}개를 ${matched.topicLabel} 내용으로 빠르게 바꿨습니다.`
          : ai?.taskKind === "translate"
            ? `선택 텍스트 ${updates.length}개를 한글 번역 기준으로 빠르게 바꿨습니다.`
            : `선택 텍스트 ${updates.length}개를 요청한 방향에 맞게 빠르게 바꿨습니다.`,
      findings: [
        {
          label: "빠른 텍스트 적용",
          detail: "AI 디자이너 전체 분석 루프 대신 선택 텍스트 읽기와 bulk update만 실행했습니다."
        }
      ],
      recommendations: [],
      risks: [],
      applyActions: [],
      actionPreviewBundle
    },
    designerActionPreviewBundle: actionPreviewBundle,
    ai: null,
    result: bulkResult,
    operation: {
      selectedModel: {
        provider: String(ai?.provider || aiConfig?.provider || "").trim() || null,
        model: String(ai?.model || aiConfig?.model || "").trim() || null
      },
      taskKind: rewriteTelemetry?.taskKind || null,
      chunkCount: rewriteTelemetry?.chunkCount || 0,
      retryCount: rewriteTelemetry?.retryCount || 0,
      fallbackMode: rewriteTelemetry?.fallbackMode || null,
      outputValidation: rewriteTelemetry?.outputValidation || null
    }
  };

  responsePayload.ai = {
    status: "completed",
    provider: "codex_cli",
    model: String(ai?.model || "").trim() || null,
    response: {
      reply: fallbackReply
    }
  };
  responsePayload.aiBackend = "codex_cli";
  responsePayload.codexStatus = "completed";
  responsePayload.fallbackUsed = false;
  responsePayload.fallbackReason = null;
  responsePayload.operation.selectedModel = {
    provider: "codex_cli",
    model: String(ai?.model || "").trim() || null
  };

  return responsePayload;
}

async function performAnalyzeSelectionToCompose(pluginId, input = {}) {
  const normalizedInput = withSessionDefaultParent(pluginId, input);
  const analyzePlan = buildAnalyzeReferenceSelectionPlan(normalizedInput);
  const metadataResult = await executePluginCommand(pluginId, "get_metadata", {
    targetNodeId: analyzePlan.targetNodeId
  });
  const analysis = deriveReferenceAnalysisDraft(metadataResult, analyzePlan);
  const composeInput = buildAnalyzeSelectionToComposePlan(normalizedInput, analysis);
  const composed = await performComposeScreenFromIntents(pluginId, composeInput);

  return {
    analysis,
    compose: composed
  };
}

function ensurePluginSession(pluginId) {
  if (!pluginSessions.has(pluginId)) {
    pluginSessions.set(pluginId, createSession(pluginId, Date.now()));
    sessionStateByPlugin.set(pluginId, SESSION_STATES.REGISTERED);
  }

  return pluginSessions.get(pluginId);
}

function pruneExpiredSessions(now = Date.now(), options = {}) {
  runtimeCounters.sessions.pruneRunsTotal += 1;
  for (const [pluginId, session] of pluginSessions.entries()) {
    const state = getSessionState(session, {
      now,
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      retentionMs: SESSION_RETENTION_MS
    });
    if (state === SESSION_STATES.OFFLINE) {
      const previousState = sessionStateByPlugin.get(pluginId) || null;
      if (previousState !== SESSION_STATES.OFFLINE) {
        broadcastRuntimeEvent(
          "session.state_changed",
          {
            pluginId,
            previousState,
            state: SESSION_STATES.OFFLINE,
            reason: "session_pruned"
          },
          { pluginId }
        );
      }
      pluginSessions.delete(pluginId);
      pendingRecoveryByPlugin.delete(pluginId);
      sessionStateByPlugin.delete(pluginId);
      runtimeCounters.sessions.prunedTotal += 1;
    }
  }
  runtimeCounters.preflight.recovery.pendingTotal = pendingRecoveryByPlugin.size;
  if (options.broadcast !== false) {
    maybeBroadcastHealthChanged("session_prune", now);
  }
}

function getSessionSnapshots({ includeStale = false, now = Date.now() } = {}) {
  const cacheKey = includeStale ? `sessions:all:${now}` : `sessions:live:${now}`;
  return getOrCreateRequestSnapshotCacheEntry(cacheKey, () => {
    pruneExpiredSessions(now, { broadcast: false });
    const snapshots = [];

    for (const session of pluginSessions.values()) {
      const snapshot = toSessionSnapshot(session, {
        now,
        activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
        retentionMs: SESSION_RETENTION_MS
      });
      if (!includeStale && snapshot.state !== SESSION_STATES.LIVE) {
        continue;
      }
      snapshots.push(snapshot);
    }

    return snapshots.sort((a, b) => {
      const aRecency = getSessionRecencyAt(a);
      const bRecency = getSessionRecencyAt(b);
      if (bRecency !== aRecency) {
        return bRecency - aRecency;
      }
      const aSeen = typeof a.lastSeenAt === "number" ? a.lastSeenAt : 0;
      const bSeen = typeof b.lastSeenAt === "number" ? b.lastSeenAt : 0;
      return bSeen - aSeen;
    });
  });
}

function getPrimaryLiveSessionSnapshot(now = Date.now()) {
  const liveSnapshots = getSessionSnapshots({ includeStale: false, now });
  const resolution = getActiveSessionResolution({ now, liveSnapshots });
  if (!resolution.primaryPluginId) {
    return null;
  }
  return (
    liveSnapshots.find((snapshot) => snapshot.pluginId === resolution.primaryPluginId) || null
  );
}

function getActiveSessionResolution({ now = Date.now(), liveSnapshots = null } = {}) {
  const resolvedLiveSnapshots = Array.isArray(liveSnapshots)
    ? liveSnapshots
    : getSessionSnapshots({ includeStale: false, now });
  return buildActiveSessionResolution(resolvedLiveSnapshots);
}

function serializePluginSession(session) {
  return toSessionSnapshot(session, {
    now: Date.now(),
    activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
    retentionMs: SESSION_RETENTION_MS
  });
}

function withSessionDefaultParent(pluginId, input = {}) {
  const session = ensurePluginSession(pluginId);
  const pluginPageId =
    typeof pluginId === "string" && pluginId.startsWith("page:")
      ? pluginId.slice("page:".length).trim() || null
      : null;
  return {
    ...input,
    defaultParentId:
      typeof input.defaultParentId === "string" && input.defaultParentId.trim()
        ? input.defaultParentId
        : session.pageId || pluginPageId
  };
}

function resolveActivePluginId(pluginId) {
  const now = Date.now();
  pruneExpiredSessions(now);
  const normalized = pluginId || "default";

  if (normalized !== "default") {
    return normalized;
  }

  const resolution = getActiveSessionResolution({ now });
  if (
    resolution.status === "default" ||
    resolution.status === "single"
  ) {
    return resolution.primaryPluginId || normalized;
  }

  if (resolution.status === "ambiguous") {
    throw new BridgeRuntimeError(
      "ERR_PLUGIN_SESSION_AMBIGUOUS",
      `Multiple active plugin sessions: ${resolution.livePluginIds.join(", ")}. Specify pluginId explicitly.`,
      {
        statusCode: 409,
        details: {
          pluginId: normalized,
          activePluginIds: resolution.livePluginIds,
          suggestedPluginId: resolution.primaryPluginId
        }
      }
    );
  }

  return normalized;
}

function jsonResponse(res, statusCode, payload) {
  if (!canWriteResponse(res)) {
    return false;
  }
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
  return true;
}

function compactDesignerComponentProperties(componentProperties) {
  if (!componentProperties || typeof componentProperties !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(componentProperties)
      .map(([key, value]) => {
        const safeKey = String(key || "").trim();
        if (!safeKey) {
          return null;
        }
        if (!value || typeof value !== "object") {
          return [safeKey, value];
        }
        const compactValue = {};
        if (typeof value.type === "string" && value.type) {
          compactValue.type = value.type;
        }
        if (value.value !== undefined && value.value !== null && value.value !== "") {
          compactValue.value = value.value;
        }
        if (
          compactValue.value === undefined &&
          value.name !== undefined &&
          value.name !== null &&
          value.name !== ""
        ) {
          compactValue.value = value.name;
        }
        if (
          compactValue.value === undefined &&
          value.id !== undefined &&
          value.id !== null &&
          value.id !== ""
        ) {
          compactValue.value = value.id;
        }
        if (
          Array.isArray(value.preferredValues) &&
          value.preferredValues.length > 0 &&
          compactValue.value === undefined
        ) {
          const firstPreferredValue = value.preferredValues[0];
          if (firstPreferredValue && typeof firstPreferredValue === "object") {
            compactValue.value =
              firstPreferredValue.value ??
              firstPreferredValue.name ??
              firstPreferredValue.id ??
              undefined;
          }
          compactValue.preferredValueCount = value.preferredValues.length;
        }
        return [safeKey, compactValue];
      })
      .filter(Boolean)
  );
}

function compactDesignerContextModel(contextModel) {
  if (!contextModel || typeof contextModel !== "object") {
    return null;
  }
  const focusedNode =
    contextModel.focusedNode && typeof contextModel.focusedNode === "object"
      ? contextModel.focusedNode
      : null;
  const designSystem =
    contextModel.designSystem && typeof contextModel.designSystem === "object"
      ? contextModel.designSystem
      : {};
  return {
    meta: contextModel.meta || null,
    target: contextModel.target || null,
    selection: contextModel.selection || null,
    focusedNode: focusedNode
      ? {
          node: focusedNode.node || null,
          geometry: focusedNode.geometry || null,
          layout: focusedNode.layout || null,
          variantProperties: focusedNode.variantProperties || {},
          componentProperties: compactDesignerComponentProperties(
            focusedNode.componentProperties
          ),
          sourceComponent: focusedNode.sourceComponent || null,
          fallbackUsed: focusedNode.fallbackUsed === true,
          truncated: focusedNode.truncated === true
        }
      : null,
    structure: contextModel.structure || null,
    designSystem: {
      assetLookup: designSystem.assetLookup || null,
      libraryHints: Array.isArray(designSystem.libraryHints)
        ? designSystem.libraryHints
        : [],
      tokenHints: Array.isArray(designSystem.tokenHints) ? designSystem.tokenHints : [],
      componentHints: Array.isArray(designSystem.componentHints)
        ? designSystem.componentHints
        : [],
      componentCandidates: Array.isArray(designSystem.componentCandidates)
        ? designSystem.componentCandidates.slice(0, 8)
        : [],
      instanceMatches: Array.isArray(designSystem.instanceMatches)
        ? designSystem.instanceMatches.slice(0, 8)
        : [],
      variableDefs: Array.isArray(designSystem.variableDefs)
        ? designSystem.variableDefs.slice(0, 12)
        : [],
      tokenSnapshot:
        designSystem.tokenSnapshot && typeof designSystem.tokenSnapshot === "object"
          ? {
              filePath: designSystem.tokenSnapshot.filePath || null,
              collectionCount: designSystem.tokenSnapshot.collectionCount || 0,
              variableCount: designSystem.tokenSnapshot.variableCount || 0,
              styleCount: designSystem.tokenSnapshot.styleCount || 0,
              collections: Array.isArray(designSystem.tokenSnapshot.collections)
                ? designSystem.tokenSnapshot.collections.slice(0, 12)
                : [],
              tokenBucketCounts:
                designSystem.tokenSnapshot.tokenBucketCounts &&
                typeof designSystem.tokenSnapshot.tokenBucketCounts === "object"
                  ? designSystem.tokenSnapshot.tokenBucketCounts
                  : {},
              sampleVariables: Array.isArray(designSystem.tokenSnapshot.sampleVariables)
                ? designSystem.tokenSnapshot.sampleVariables.slice(0, 16)
                : [],
              colorScaleGroups: Array.isArray(designSystem.tokenSnapshot.colorScaleGroups)
                ? designSystem.tokenSnapshot.colorScaleGroups.slice(0, 80)
                : []
            }
          : null,
      libraryAssetMatches: Array.isArray(designSystem.libraryAssetMatches)
        ? designSystem.libraryAssetMatches.slice(0, 8)
        : []
    },
    pageContext: contextModel.pageContext || null,
    readMeta: contextModel.readMeta || null
  };
}

function compactDesignerExecutionForInspect(execution) {
  if (!execution || typeof execution !== "object") {
    return {};
  }
  return {
    executedAt: execution.executedAt || null,
    ok: execution.ok !== false,
    summary: execution.summary || null,
    contextCoverage: execution.contextCoverage || null,
    contextWarnings: Array.isArray(execution.contextWarnings)
      ? execution.contextWarnings
      : [],
    contextModel: compactDesignerContextModel(execution.contextModel)
  };
}

async function executeDesignerInspectSelectionRequest(body = {}) {
  const pluginId = resolveActivePluginId(body.pluginId || "default");
  const message = body.message || body.request || body.prompt || body.input || "";
  const figmaContext =
    body.figmaContext && typeof body.figmaContext === "object" ? body.figmaContext : {};
  const intentEnvelope = createDesignerIntentEnvelope(
    {
      ...body,
      request: message,
      intentKindOverride: "inspect_selection"
    },
    figmaContext
  );
  const execution = await executeDesignerReadPlan(
    {
      intentEnvelope,
      runCommand: (command, args) => runDesignerReadCommand(pluginId, command, args)
    },
    {
      query: body.query || message,
      fileKey: body.fileKey || figmaContext.fileKey,
      fileKeys: body.fileKeys || figmaContext.fileKeys
    }
  );
  const designerSuggestionBundle = buildDesignerSuggestionBundle({
    intentEnvelope,
    execution
  });
  const designerActionPreviewBundle = buildDesignerActionPreviewBundle({
    intentEnvelope,
    execution,
    designerSuggestionBundle
  });
  let finalDesignerSuggestionBundle = designerSuggestionBundle;
  let codexMeta = {
    aiBackend: "codex_cli",
    codexStatus: "completed",
    fallbackUsed: false,
    fallbackReason: null
  };
  let ai = buildDesignerCodexAiPayload({
    status: "completed",
    reply: designerSuggestionBundle?.summaryText || "Codex 응답 완료"
  });

  try {
    const codexInspectResult = await runCodexInspectSelection(
      {
        request: message,
        contextModel: execution?.contextModel || intentEnvelope?.contextModel || {}
      },
      {
        env: process.env,
        cwd: process.cwd(),
        timeoutMs: resolveDesignerCodexInspectTimeoutMs(process.env)
      }
    );
    finalDesignerSuggestionBundle = buildCodexInspectSuggestionBundle(
      designerSuggestionBundle,
      codexInspectResult
    );
    ai = buildDesignerCodexAiPayload({
      status: "completed",
      reply: codexInspectResult?.summary || designerSuggestionBundle?.summaryText || "Codex 응답 완료"
    });
  } catch (error) {
    codexMeta = buildDesignerCodexFallbackMeta(error);
    finalDesignerSuggestionBundle = {
      ...designerSuggestionBundle,
      codex: {
        source: "codex_cli",
        status: "fallback",
        errorCode: error?.code || null,
        message: error instanceof Error ? error.message : String(error || "")
      }
    };
    ai = buildDesignerCodexAiPayload({
      status: "fallback",
      reply: "Codex 응답을 완성하지 못해 읽기 결과를 그대로 반환했습니다.",
      failureCode: codexMeta.fallbackReason
    });
  }

  return {
    ok: true,
    intentKind: "inspect_selection",
    pluginId,
    activeSessionResolution: getActiveSessionResolution({ now: Date.now() }),
    intentEnvelope,
    ...codexMeta,
    execution: compactDesignerExecutionForInspect(execution),
    designerSuggestionBundle: {
      ...finalDesignerSuggestionBundle,
      actionPreviewBundle: designerActionPreviewBundle
    },
    designerActionPreviewBundle,
    ai
  };
}

function canWriteResponse(res) {
  return Boolean(res) && !res.writableEnded && !res.destroyed;
}

function parseSseFilterList(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const values = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? new Set(values) : null;
}

function parseWsFilterList(raw) {
  return parseSseFilterList(raw);
}

function normalizeWsClientType(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "plugin") {
    return "plugin";
  }
  return "observer";
}

function trimRecentRuntimeEvents() {
  const limit = Math.max(0, RECENT_RUNTIME_EVENT_LIMIT);
  if (limit === 0) {
    recentRuntimeEvents.length = 0;
    return;
  }
  while (recentRuntimeEvents.length > limit) {
    recentRuntimeEvents.shift();
  }
}

function createRuntimeEventEnvelope(event, payload, pluginId = null, options = {}) {
  runtimeEventSequence += 1;
  const envelope = {
    event,
    at: new Date().toISOString(),
    sequence: runtimeEventSequence,
    pluginId: typeof pluginId === "string" ? pluginId : undefined,
    payload: payload && typeof payload === "object" ? payload : {}
  };
  if (options.record !== false) {
    recentRuntimeEvents.push(envelope);
    trimRecentRuntimeEvents();
  }
  return envelope;
}

function parseEventSequenceValue(raw) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const sequence = Math.floor(parsed);
  return sequence > 0 ? sequence : null;
}

function resolveLastEventSequence(req, url) {
  return (
    parseEventSequenceValue(req.headers["last-event-id"]) ??
    parseEventSequenceValue(url.searchParams.get("lastEventId")) ??
    parseEventSequenceValue(url.searchParams.get("last-event-id"))
  );
}

function getReplayableRuntimeEvents({ afterSequence = 0, pluginId = null, eventTypes = null } = {}) {
  return recentRuntimeEvents.filter((envelope) => {
    if (!envelope || typeof envelope.sequence !== "number") {
      return false;
    }
    if (envelope.sequence <= afterSequence) {
      return false;
    }
    if (pluginId && envelope.pluginId && envelope.pluginId !== pluginId) {
      return false;
    }
    if (eventTypes && !eventTypes.has(envelope.event)) {
      return false;
    }
    return true;
  });
}

function writeSseEventFrame(res, envelope) {
  const id = String(envelope.sequence);
  const event = String(envelope.event || "runtime.event");
  const data = JSON.stringify(envelope);
  res.write(`id: ${id}\n`);
  res.write(`event: ${event}\n`);
  res.write(`data: ${data}\n\n`);
}

function shouldDeliverRuntimeEvent(client, envelope) {
  if (!client || !envelope) {
    return false;
  }

  if (
    client.pluginId &&
    envelope.pluginId &&
    client.pluginId !== envelope.pluginId
  ) {
    return false;
  }

  if (client.eventTypes && !client.eventTypes.has(envelope.event)) {
    return false;
  }

  return true;
}

function removeSseClient(clientId) {
  const client = sseClients.get(clientId);
  if (!client) {
    return;
  }
  sseClients.delete(clientId);
  if (client.keepAliveTimer) {
    clearInterval(client.keepAliveTimer);
  }
}

function removeWsClient(clientId) {
  const client = wsClients.get(clientId);
  if (!client) {
    return;
  }
  wsClients.delete(clientId);
}

function getWsPluginPickupClients(pluginId) {
  const scopedPluginId =
    typeof pluginId === "string" && pluginId.trim() ? pluginId : null;
  if (!scopedPluginId) {
    return [];
  }

  const clients = [];
  for (const client of wsClients.values()) {
    if (!client || client.clientType !== "plugin") {
      continue;
    }
    if (client.pluginId !== scopedPluginId) {
      continue;
    }
    if (!client.socket || client.socket.destroyed || !client.socket.writable) {
      continue;
    }
    clients.push(client);
  }
  return clients;
}

function isAwaitingWsPluginAck(command, now = Date.now()) {
  if (!command || command.deliveredAt !== null) {
    return false;
  }
  if (typeof command.wsDispatchedAt !== "number") {
    return false;
  }
  if (typeof command.wsAckedAt === "number") {
    return false;
  }
  const baseTimeoutMs = Math.max(100, WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS);
  const resumeGraceMs =
    typeof command.wsResumeSyncedAt === "number" &&
    Number.isFinite(command.wsResumeSyncedAt)
      ? Math.max(0, command.wsResumeSyncedAt + Math.max(100, WS_PLUGIN_RESUME_ACK_GRACE_MS) - now)
      : 0;
  return now - command.wsDispatchedAt < Math.max(baseTimeoutMs, resumeGraceMs);
}

function resolvePollingFallbackMultiplier(type) {
  const fallbackClass = resolvePollingFallbackClass(type);
  if (fallbackClass === "critical") {
    return Number.isFinite(WS_POLLING_FALLBACK_CRITICAL_MULTIPLIER)
      ? Math.max(0.25, WS_POLLING_FALLBACK_CRITICAL_MULTIPLIER)
      : 1;
  }
  if (fallbackClass === "interactive") {
    return Number.isFinite(WS_POLLING_FALLBACK_INTERACTIVE_MULTIPLIER)
      ? Math.max(0.25, WS_POLLING_FALLBACK_INTERACTIVE_MULTIPLIER)
      : 0.7;
  }
  if (fallbackClass === "detail") {
    return Number.isFinite(WS_POLLING_FALLBACK_DETAIL_MULTIPLIER)
      ? Math.max(0.25, WS_POLLING_FALLBACK_DETAIL_MULTIPLIER)
      : 1.45;
  }
  return Number.isFinite(WS_POLLING_FALLBACK_STANDARD_MULTIPLIER)
    ? Math.max(0.25, WS_POLLING_FALLBACK_STANDARD_MULTIPLIER)
    : 1.2;
}

function resolveNearTimeoutRatio() {
  return Number.isFinite(WS_POLLING_FALLBACK_NEAR_TIMEOUT_RATIO)
    ? Math.min(0.95, Math.max(0.05, WS_POLLING_FALLBACK_NEAR_TIMEOUT_RATIO))
    : 0.65;
}

function countPendingUndeliveredCommandsForPlugin(pluginId) {
  let total = 0;
  for (const command of pendingCommands.values()) {
    if (command.pluginId === pluginId && command.deliveredAt === null) {
      total += 1;
    }
  }
  return total;
}

function summarizePendingReplayCommandsForPlugin(pluginId, now = Date.now()) {
  return Array.from(pendingCommands.values())
    .filter((command) => command.pluginId === pluginId && command.deliveredAt === null)
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((command) => ({
      commandId: command.commandId,
      pluginId: command.pluginId,
      type: command.type,
      createdAt: command.createdAt,
      wsDispatchedAt: typeof command.wsDispatchedAt === "number" ? command.wsDispatchedAt : null,
      state: isAwaitingWsPluginAck(command, now) ? "awaiting_ws_ack" : "pending_dispatch"
    }));
}

function resolveAdaptivePollingFallbackMultiplier(
  command,
  now = Date.now(),
  { pendingUndeliveredForPlugin = null } = {}
) {
  const baseMultiplier = resolvePollingFallbackMultiplier(command?.type);
  const fallbackClass = resolvePollingFallbackClass(command?.type);
  const standardMultiplier = resolvePollingFallbackMultiplier("search_nodes");
  const pressureThreshold = Number.isFinite(WS_POLLING_FALLBACK_QUEUE_PRESSURE_THRESHOLD)
    ? Math.max(1, WS_POLLING_FALLBACK_QUEUE_PRESSURE_THRESHOLD)
    : 3;
  const nearTimeoutRatio = resolveNearTimeoutRatio();
  const queuePressure =
    Number.isFinite(pendingUndeliveredForPlugin) && pendingUndeliveredForPlugin >= 0
      ? pendingUndeliveredForPlugin
      : countPendingUndeliveredCommandsForPlugin(command?.pluginId);
  const timeoutMs =
    typeof command?.timeoutMs === "number" && Number.isFinite(command.timeoutMs)
      ? command.timeoutMs
      : TOOL_TIMEOUT_MS;
  const ageMs =
    typeof command?.createdAt === "number" && Number.isFinite(command.createdAt)
      ? Math.max(0, now - command.createdAt)
      : 0;
  const nearTimeout =
    timeoutMs > 0 && ageMs >= Math.max(100, Math.floor(timeoutMs * nearTimeoutRatio));

  let adaptiveMultiplier = baseMultiplier;
  let tuningMode = "base";
  if (fallbackClass === "detail" && queuePressure >= pressureThreshold) {
    adaptiveMultiplier = Math.min(adaptiveMultiplier, standardMultiplier);
    tuningMode = "queue_pressure";
  }
  if (nearTimeout) {
    adaptiveMultiplier = Math.min(adaptiveMultiplier, 1);
    tuningMode = tuningMode === "base" ? "near_timeout" : `${tuningMode}+near_timeout`;
  }

  return {
    fallbackClass,
    adaptiveMultiplier: Number(adaptiveMultiplier.toFixed(4)),
    queuePressure,
    nearTimeout,
    tuningMode
  };
}

function shouldDelayPollingFallbackForWs(
  command,
  now = Date.now(),
  hasWsPluginClient = false,
  options = {}
) {
  if (!hasWsPluginClient) {
    return false;
  }
  if (!command || command.deliveredAt !== null) {
    return false;
  }
  if (typeof command.wsDispatchedAt !== "number") {
    return false;
  }
  if (typeof command.wsAckedAt === "number") {
    return false;
  }
  const adaptive = resolveAdaptivePollingFallbackMultiplier(command, now, options);
  const graceMs = Math.max(
    100,
    Math.floor(WS_POLLING_FALLBACK_GRACE_MS * adaptive.adaptiveMultiplier)
  );
  const timeoutBudgetMs =
    typeof command.timeoutMs === "number" && Number.isFinite(command.timeoutMs)
      ? Math.max(0, command.timeoutMs - 200)
      : Number.POSITIVE_INFINITY;
  const effectiveGraceMs = Math.min(graceMs, timeoutBudgetMs);
  if (effectiveGraceMs <= 0) {
    return false;
  }
  return now - command.wsDispatchedAt < effectiveGraceMs;
}

function markCommandDelivered(command, deliveredAt = Date.now(), reason = "unknown") {
  if (!command || command.deliveredAt !== null) {
    return false;
  }

  command.deliveredAt = deliveredAt;
  command.deliveryMode = reason;
  runtimeCounters.queue.deliveredTotal += 1;
  broadcastRuntimeEvent(
    "command.delivered",
    {
      commandId: command.commandId,
      pluginId: command.pluginId,
      type: command.type,
      delivery: reason
    },
    { pluginId: command.pluginId }
  );
  broadcastQueueUpdated("command_delivered", command.pluginId);
  return true;
}

function dispatchPendingCommandsToPluginWs(pluginId, reason = "enqueue") {
  const clients = getWsPluginPickupClients(pluginId);
  if (clients.length === 0) {
    return [];
  }

  const now = Date.now();
  const pending = Array.from(pendingCommands.values())
    .filter((command) => {
      if (command.pluginId !== pluginId || command.deliveredAt !== null) {
        return false;
      }
      if (isAwaitingWsPluginAck(command, now)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.createdAt - b.createdAt);

  if (pending.length === 0) {
    return [];
  }

  const dispatched = [];
  for (const command of pending) {
    const targetClient = clients[0];
    runtimeCounters.transport.wsDispatchAttemptedTotal += 1;
    const sent = sendWsCommandEnvelope(
      targetClient,
      "plugin.command",
      {
        pluginId: command.pluginId,
        command: {
          commandId: command.commandId,
          pluginId: command.pluginId,
          type: command.type,
          payload: command.payload,
          createdAt: command.createdAt
        },
        reason
      },
      command.pluginId
    );
    if (!sent) {
      runtimeCounters.transport.wsDispatchFailedTotal += 1;
      removeWsClient(targetClient.id);
      return dispatched;
    }
    runtimeCounters.transport.wsDispatchedTotal += 1;
    command.wsDispatchedAt = now;
    command.wsDispatchClientId = targetClient.id;
    dispatched.push({
      commandId: command.commandId,
      pluginId: command.pluginId,
      type: command.type,
      createdAt: command.createdAt,
      reason
    });
    broadcastQueueUpdated("command_ws_dispatched", command.pluginId);
  }
  return dispatched;
}

function shouldMirrorRuntimeEventToWs(eventType) {
  return (
    eventType === "health.changed" ||
    eventType.startsWith("session.") ||
    eventType === "selection.changed" ||
    eventType.startsWith("command.")
  );
}

function isCommandLifecycleEvent(eventType) {
  return typeof eventType === "string" && eventType.startsWith("command.");
}

function encodeWebSocketFrame(opcode, payloadBuffer = Buffer.alloc(0)) {
  const payloadLength = payloadBuffer.length;

  if (payloadLength <= 125) {
    const frame = Buffer.alloc(2 + payloadLength);
    frame[0] = 0x80 | (opcode & 0x0f);
    frame[1] = payloadLength;
    payloadBuffer.copy(frame, 2);
    return frame;
  }

  if (payloadLength <= 0xffff) {
    const frame = Buffer.alloc(4 + payloadLength);
    frame[0] = 0x80 | (opcode & 0x0f);
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
    payloadBuffer.copy(frame, 4);
    return frame;
  }

  const frame = Buffer.alloc(10 + payloadLength);
  frame[0] = 0x80 | (opcode & 0x0f);
  frame[1] = 127;
  frame.writeBigUInt64BE(BigInt(payloadLength), 2);
  payloadBuffer.copy(frame, 10);
  return frame;
}

function sendWsClientPayload(client, payloadObject) {
  const socket = client?.socket;
  if (!socket || socket.destroyed || !socket.writable) {
    return false;
  }

  try {
    const payload = Buffer.from(JSON.stringify(payloadObject), "utf8");
    const frame = encodeWebSocketFrame(0x1, payload);
    socket.write(frame);
    return true;
  } catch (error) {
    return false;
  }
}

function sendWsClientControlFrame(client, opcode, payloadBuffer = Buffer.alloc(0)) {
  const socket = client?.socket;
  if (!socket || socket.destroyed || !socket.writable) {
    return false;
  }
  try {
    socket.write(encodeWebSocketFrame(opcode, payloadBuffer));
    return true;
  } catch (error) {
    return false;
  }
}

function parseWsFrame(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 2) {
    return null;
  }

  const firstByte = buffer[0];
  const secondByte = buffer[1];
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) === 0x80;
  let offset = 2;
  let payloadLength = secondByte & 0x7f;

  if (payloadLength === 126) {
    if (buffer.length < offset + 2) {
      return null;
    }
    payloadLength = buffer.readUInt16BE(offset);
    offset += 2;
  } else if (payloadLength === 127) {
    if (buffer.length < offset + 8) {
      return null;
    }
    const bigLength = buffer.readBigUInt64BE(offset);
    if (bigLength > BigInt(Number.MAX_SAFE_INTEGER)) {
      return null;
    }
    payloadLength = Number(bigLength);
    offset += 8;
  }

  let maskingKey = null;
  if (masked) {
    if (buffer.length < offset + 4) {
      return null;
    }
    maskingKey = buffer.slice(offset, offset + 4);
    offset += 4;
  }

  if (buffer.length < offset + payloadLength) {
    return null;
  }

  const payload = Buffer.from(buffer.slice(offset, offset + payloadLength));
  if (masked && maskingKey) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= maskingKey[index % 4];
    }
  }

  return {
    opcode,
    payload,
    bytesConsumed: offset + payloadLength
  };
}

function buildWsCommandError(code, message, details = null) {
  return {
    code: typeof code === "string" ? code : "ERR_WS_COMMAND",
    message:
      typeof message === "string" && message.trim()
        ? message
        : "WebSocket command failed",
    details: details && typeof details === "object" ? details : null
  };
}

function resolveWsPluginId(client, requestPluginId) {
  const scopedPluginId =
    typeof client?.pluginId === "string" && client.pluginId.trim()
      ? client.pluginId
      : null;
  const requestedPluginId =
    typeof requestPluginId === "string" && requestPluginId.trim()
      ? requestPluginId.trim()
      : null;

  if (scopedPluginId && requestedPluginId && scopedPluginId !== requestedPluginId) {
    throw buildWsCommandError(
      "ERR_WS_PLUGIN_SCOPE_MISMATCH",
      "Requested pluginId does not match the websocket connection scope.",
      {
        scopedPluginId,
        requestedPluginId
      }
    );
  }

  return requestedPluginId || scopedPluginId || "default";
}

async function executeWsReadOnlyCommand(command, args, pluginId) {
  if (command === "ping") {
    return {
      ok: true,
      pongAt: new Date().toISOString()
    };
  }

  if (command === "get_selection") {
    return executePluginCommand(pluginId, "get_selection");
  }

  if (command === "get_metadata") {
    const includeJson = args?.includeJson === true;
    const metadata = await executePluginCommand(pluginId, "get_metadata", {
      targetNodeId: resolveTargetNodeId(args || {}),
      maxDepth: args?.maxDepth,
      maxNodes: args?.maxNodes,
      includeJson
    });
    if (!includeJson) {
      return metadata;
    }
    const jsonTree =
      metadata && metadata.json
        ? metadata.json
        : typeof metadata?.xml === "string"
          ? parseSelectionMetadataTree(metadata.xml)
          : null;
    return {
      ...metadata,
      json: jsonTree
    };
  }

  if (command === "get_node_details") {
    const plan = buildNodeDetailsPlan(args || {});
    try {
      return await executePluginCommand(pluginId, "get_node_details", plan);
    } catch (error) {
      return readMetadataFallbackForDetail(pluginId, plan, error);
    }
  }

  if (command === "get_component_variant_details") {
    const plan = buildComponentVariantDetailsPlan(args || {});
    try {
      return await executePluginCommand(
        pluginId,
        "get_component_variant_details",
        plan
      );
    } catch (error) {
      const fallback = await readMetadataFallbackForDetail(pluginId, plan, error);
      return {
        ...fallback,
        targetNode: fallback.node,
        componentSet: null,
        variantCount: 0,
        variants: []
      };
    }
  }

  if (command === "get_instance_details") {
    const plan = buildInstanceDetailsPlan(args || {});
    try {
      return await executePluginCommand(pluginId, "get_instance_details", plan);
    } catch (error) {
      const fallback = await readMetadataFallbackForDetail(pluginId, plan, error);
      return {
        ...fallback,
        instance: fallback.node,
        sourceComponent: null,
        sourceComponentSet: null,
        componentPropertyDefinitions: [],
        variantProperties: null,
        componentProperties: null,
        resolvedChildCount: 0
      };
    }
  }

  throw buildWsCommandError(
    "ERR_WS_UNSUPPORTED_COMMAND",
    `Unsupported websocket read command: ${command}`,
    { command }
  );
}

function sendWsCommandEnvelope(client, event, payload, pluginId = null) {
  const envelope = createRuntimeEventEnvelope(event, payload, pluginId);
  return sendWsClientPayload(client, envelope);
}

function normalizeWsCommandRequest(message) {
  if (!message || typeof message !== "object") {
    throw buildWsCommandError(
      "ERR_WS_INVALID_REQUEST",
      "Inbound websocket message must be a JSON object."
    );
  }

  const type = typeof message.type === "string" ? message.type : "";
  const event = typeof message.event === "string" ? message.event : "";
  const isCommandRequest =
    type === "ws.command.request" ||
    type === "command.request" ||
    event === "ws.command.request" ||
    event === "command.request" ||
    typeof message.command === "string";
  if (!isCommandRequest) {
    throw buildWsCommandError(
      "ERR_WS_UNSUPPORTED_MESSAGE",
      "Unsupported websocket message type."
    );
  }

  const command = String(message.command || "").trim().toLowerCase();
  if (!command) {
    throw buildWsCommandError(
      "ERR_WS_INVALID_REQUEST",
      "Missing command in websocket request."
    );
  }

  return {
    requestId:
      typeof message.requestId === "string" && message.requestId.trim()
        ? message.requestId.trim()
        : randomUUID(),
    command,
    pluginId:
      typeof message.pluginId === "string" ? message.pluginId : undefined,
    args:
      message.args && typeof message.args === "object" ? message.args : {}
  };
}

function isWsPluginAckMessage(message) {
  const type = typeof message?.type === "string" ? message.type : "";
  const event = typeof message?.event === "string" ? message.event : "";
  return (
    type === "ws.plugin.command.ack" ||
    type === "plugin.command.ack" ||
    event === "ws.plugin.command.ack" ||
    event === "plugin.command.ack"
  );
}

function isWsPluginResultMessage(message) {
  const type = typeof message?.type === "string" ? message.type : "";
  const event = typeof message?.event === "string" ? message.event : "";
  return (
    type === "ws.plugin.command.result" ||
    type === "plugin.command.result" ||
    event === "ws.plugin.command.result" ||
    event === "plugin.command.result"
  );
}

function isWsPluginSessionSyncMessage(message) {
  const type = typeof message?.type === "string" ? message.type : "";
  const event = typeof message?.event === "string" ? message.event : "";
  return (
    type === "ws.plugin.session.sync" ||
    type === "plugin.session.sync" ||
    event === "ws.plugin.session.sync" ||
    event === "plugin.session.sync"
  );
}

function isWsPluginHeartbeatMessage(message) {
  const type = typeof message?.type === "string" ? message.type : "";
  const event = typeof message?.event === "string" ? message.event : "";
  return (
    type === "ws.plugin.session.heartbeat" ||
    type === "plugin.session.heartbeat" ||
    event === "ws.plugin.session.heartbeat" ||
    event === "plugin.session.heartbeat"
  );
}

function isWsPluginSelectionMessage(message) {
  const type = typeof message?.type === "string" ? message.type : "";
  const event = typeof message?.event === "string" ? message.event : "";
  return (
    type === "ws.plugin.selection" ||
    type === "plugin.selection" ||
    event === "ws.plugin.selection" ||
    event === "plugin.selection"
  );
}

function parseWsPluginSessionPayload(message) {
  return {
    pluginId:
      typeof message?.pluginId === "string" ? message.pluginId : undefined,
    fileKey: typeof message?.fileKey === "string" ? message.fileKey : undefined,
    fileName: typeof message?.fileName === "string" ? message.fileName : undefined,
    pageId: typeof message?.pageId === "string" ? message.pageId : undefined,
    pageName: typeof message?.pageName === "string" ? message.pageName : undefined,
    selection: Array.isArray(message?.selection) ? message.selection : undefined,
    uiMetrics: message?.uiMetrics,
    resume: message?.resume === true,
    reason: typeof message?.reason === "string" ? message.reason : undefined
  };
}

function parseWsPluginCommandMessage(message) {
  const commandId =
    typeof message?.commandId === "string" && message.commandId.trim()
      ? message.commandId.trim()
      : null;
  if (!commandId) {
    throw buildWsCommandError(
      "ERR_WS_INVALID_REQUEST",
      "Missing commandId for plugin command lifecycle message."
    );
  }

  return {
    commandId,
    pluginId:
      typeof message?.pluginId === "string" ? message.pluginId : undefined,
    result: message?.result,
    error: message?.error
  };
}

async function handleWsPluginSessionSync(client, message) {
  let parsed;
  try {
    parsed = parseWsPluginSessionPayload(message);
  } catch (error) {
    const normalized = buildWsCommandError(error?.code, error?.message, error?.details);
    sendWsCommandEnvelope(
      client,
      "ws.plugin.session.error",
      {
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  let pluginId;
  try {
    pluginId = resolveWsPluginId(client, parsed.pluginId);
  } catch (error) {
    const normalized = buildWsCommandError(error?.code, error?.message, error?.details);
    sendWsCommandEnvelope(
      client,
      "ws.plugin.session.error",
      {
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  const session = ensurePluginSession(pluginId);
  const now = Date.now();
  registerSession(
    session,
    {
      pluginId,
      fileKey: parsed.fileKey,
      fileName: parsed.fileName,
      pageId: parsed.pageId,
      pageName: parsed.pageName
    },
    now
  );
  markSessionHeartbeat(session, now);
  if (Array.isArray(parsed.selection)) {
    session.lastSelection = parsed.selection;
  }
  if (parsed.uiMetrics) {
    session.uiMetrics = normalizePluginUiMetrics(parsed.uiMetrics);
  }
  if (parsed.resume === true) {
    session.lastWsResumeSyncedAt = now;
  }
  const recovery = resolveRecoveryOutcome(pluginId, session, now);
  syncSessionStateAndBroadcast(pluginId, session, "ws_session_sync", now);
  broadcastRuntimeEvent(
    parsed.resume ? "session.resumed" : "session.registered",
    {
      pluginId,
      pageId: session.pageId || null,
      pageName: session.pageName || null,
      selectionCount: Array.isArray(session.lastSelection) ? session.lastSelection.length : 0,
      pendingRecovery: recovery.pendingRecovery,
      source: "ws"
    },
    { pluginId }
  );
  maybeBroadcastHealthChanged(parsed.resume ? "ws_session_resumed" : "ws_session_registered", now);

  const replaySnapshot = summarizePendingReplayCommandsForPlugin(pluginId, now);
  for (const command of pendingCommands.values()) {
    if (
      parsed.resume === true &&
      command.pluginId === pluginId &&
      command.deliveredAt === null &&
      typeof command.wsDispatchedAt === "number" &&
      typeof command.wsAckedAt !== "number"
    ) {
      command.wsResumeSyncedAt = now;
    }
  }
  const replayedCommands = dispatchPendingCommandsToPluginWs(
    pluginId,
    parsed.resume ? "ws_session_resume" : "ws_session_sync"
  );

  sendWsCommandEnvelope(
    client,
    "ws.plugin.session.synced",
    {
      pluginId,
      accepted: true,
      resume: parsed.resume,
      reason: parsed.reason || null,
      recovery,
      session: toSessionSnapshot(session, {
        now,
        activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
        retentionMs: SESSION_RETENTION_MS
      }),
      pendingUndelivered: countPendingUndeliveredCommandsForPlugin(pluginId),
      replaySnapshot,
      replaySnapshotCount: replaySnapshot.length,
      replayedCommands,
      replayedCount: replayedCommands.length
    },
    pluginId
  );
}

async function handleWsPluginHeartbeat(client, message) {
  const parsed = parseWsPluginSessionPayload(message);
  let pluginId;
  try {
    pluginId = resolveWsPluginId(client, parsed.pluginId);
  } catch (error) {
    const normalized = buildWsCommandError(error?.code, error?.message, error?.details);
    sendWsCommandEnvelope(
      client,
      "ws.plugin.session.error",
      {
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  const session = ensurePluginSession(pluginId);
  const now = Date.now();
  markSessionHeartbeat(session, now);
  if (parsed.uiMetrics) {
    session.uiMetrics = normalizePluginUiMetrics(parsed.uiMetrics);
  }
  const recovery = resolveRecoveryOutcome(pluginId, session, now);
  syncSessionStateAndBroadcast(pluginId, session, "ws_session_heartbeat", now);
  broadcastRuntimeEvent(
    "session.heartbeat",
    {
      pluginId,
      state: recovery.state,
      pendingRecovery: recovery.pendingRecovery,
      source: "ws"
    },
    { pluginId }
  );
  maybeBroadcastHealthChanged("ws_session_heartbeat", now);
  sendWsCommandEnvelope(
    client,
    "ws.plugin.session.heartbeat.ack",
    {
      pluginId,
      accepted: true,
      recovery
    },
    pluginId
  );
}

async function handleWsPluginSelection(client, message) {
  const parsed = parseWsPluginSessionPayload(message);
  let pluginId;
  try {
    pluginId = resolveWsPluginId(client, parsed.pluginId);
  } catch (error) {
    const normalized = buildWsCommandError(error?.code, error?.message, error?.details);
    sendWsCommandEnvelope(
      client,
      "ws.plugin.selection.error",
      {
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  const session = ensurePluginSession(pluginId);
  const now = Date.now();
  markSessionHeartbeat(session, now);
  session.lastSelection = Array.isArray(parsed.selection) ? parsed.selection : [];
  syncSessionStateAndBroadcast(pluginId, session, "ws_selection_update", now);
  broadcastRuntimeEvent(
    "selection.changed",
    {
      pluginId,
      selectionCount: session.lastSelection.length,
      source: "ws"
    },
    { pluginId }
  );
  sendWsCommandEnvelope(
    client,
    "ws.plugin.selection.ack",
    {
      pluginId,
      accepted: true,
      selectionCount: session.lastSelection.length
    },
    pluginId
  );
}

async function handleWsPluginCommandAck(client, message) {
  let parsed;
  try {
    parsed = parseWsPluginCommandMessage(message);
  } catch (error) {
    const normalized = buildWsCommandError(error?.code, error?.message, error?.details);
    sendWsCommandEnvelope(
      client,
      "ws.plugin.command.error",
      {
        commandId: null,
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  let pluginId;
  try {
    pluginId = resolveWsPluginId(client, parsed.pluginId);
  } catch (error) {
    const normalized = buildWsCommandError(error?.code, error?.message, error?.details);
    sendWsCommandEnvelope(
      client,
      "ws.plugin.command.error",
      {
        commandId: parsed.commandId,
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  const command = pendingCommands.get(parsed.commandId);
  if (!command || command.pluginId !== pluginId) {
    sendWsCommandEnvelope(
      client,
      "ws.plugin.command.error",
      {
        commandId: parsed.commandId,
        pluginId,
        code: "ERR_COMMAND_NOT_FOUND",
        error: "Command not found for plugin command ack."
      },
      pluginId
    );
    return;
  }

  command.wsAckedAt = Date.now();
  runtimeCounters.transport.wsAckTotal += 1;
  markCommandDelivered(command, command.wsAckedAt, "ws_ack");

  const session = ensurePluginSession(pluginId);
  markSessionHeartbeat(session, command.wsAckedAt);
  syncSessionStateAndBroadcast(pluginId, session, "ws_command_ack", command.wsAckedAt);

  sendWsCommandEnvelope(
    client,
    "ws.plugin.command.ack",
    {
      commandId: parsed.commandId,
      pluginId,
      accepted: true
    },
    pluginId
  );
  broadcastRuntimeEvent(
    "ws.plugin.command.ack",
    {
      commandId: parsed.commandId,
      pluginId,
      accepted: true
    },
    { pluginId }
  );
  dispatchPendingCommandsToPluginWs(pluginId, "ws_ack");
}

async function handleWsPluginCommandResult(client, message) {
  let parsed;
  try {
    parsed = parseWsPluginCommandMessage(message);
  } catch (error) {
    const normalized = buildWsCommandError(error?.code, error?.message, error?.details);
    sendWsCommandEnvelope(
      client,
      "ws.plugin.command.error",
      {
        commandId: null,
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  let pluginId;
  try {
    pluginId = resolveWsPluginId(client, parsed.pluginId);
  } catch (error) {
    const normalized = buildWsCommandError(error?.code, error?.message, error?.details);
    sendWsCommandEnvelope(
      client,
      "ws.plugin.command.error",
      {
        commandId: parsed.commandId,
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  const command = pendingCommands.get(parsed.commandId);
  if (!command || command.pluginId !== pluginId) {
    sendWsCommandEnvelope(
      client,
      "ws.plugin.command.error",
      {
        commandId: parsed.commandId,
        pluginId,
        code: "ERR_COMMAND_NOT_FOUND",
        error: "Command not found for plugin command result."
      },
      pluginId
    );
    return;
  }

  const now = Date.now();
  command.wsAckedAt = now;
  runtimeCounters.transport.wsResultTotal += 1;
  markCommandDelivered(command, now, "ws_result");

  const session = ensurePluginSession(pluginId);
  markSessionHeartbeat(session, now);
  syncSessionStateAndBroadcast(pluginId, session, "ws_command_result", now);
  resolveRecoveryOutcome(pluginId, session, now);
  completeCommand(parsed.commandId, parsed.result, parsed.error);

  sendWsCommandEnvelope(
    client,
    "ws.plugin.command.result.ack",
    {
      commandId: parsed.commandId,
      pluginId,
      accepted: true
    },
    pluginId
  );
  broadcastRuntimeEvent(
    "ws.plugin.command.result",
    {
      commandId: parsed.commandId,
      pluginId,
      accepted: true
    },
    { pluginId }
  );

  dispatchPendingCommandsToPluginWs(pluginId, "ws_result_ack");
}

async function handleWsInboundTextFrame(client, text) {
  let message;
  try {
    message = JSON.parse(text);
  } catch (error) {
    sendWsCommandEnvelope(
      client,
      "ws.command.error",
      {
        requestId: null,
        command: null,
        code: "ERR_WS_INVALID_JSON",
        error: "Invalid JSON payload."
      },
      client.pluginId || null
    );
    return;
  }

  if (isWsPluginAckMessage(message)) {
    await handleWsPluginCommandAck(client, message);
    return;
  }

  if (isWsPluginResultMessage(message)) {
    await handleWsPluginCommandResult(client, message);
    return;
  }

  if (isWsPluginSessionSyncMessage(message)) {
    await handleWsPluginSessionSync(client, message);
    return;
  }

  if (isWsPluginHeartbeatMessage(message)) {
    await handleWsPluginHeartbeat(client, message);
    return;
  }

  if (isWsPluginSelectionMessage(message)) {
    await handleWsPluginSelection(client, message);
    return;
  }

  let request;
  try {
    request = normalizeWsCommandRequest(message);
  } catch (error) {
    runtimeCounters.transport.wsInboundErrorTotal += 1;
    const normalized = buildWsCommandError(
      error?.code,
      error?.message,
      error?.details
    );
    sendWsCommandEnvelope(
      client,
      "ws.command.error",
      {
        requestId: null,
        command: null,
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }
  runtimeCounters.transport.wsInboundRequestTotal += 1;

  let pluginId;
  try {
    pluginId = resolveWsPluginId(client, request.pluginId);
  } catch (error) {
    runtimeCounters.transport.wsInboundErrorTotal += 1;
    const normalized = buildWsCommandError(
      error?.code,
      error?.message,
      error?.details
    );
    sendWsCommandEnvelope(
      client,
      "ws.command.error",
      {
        requestId: request.requestId,
        command: request.command,
        code: normalized.code,
        error: normalized.message,
        details: normalized.details
      },
      client.pluginId || null
    );
    return;
  }

  if (!WS_INBOUND_READ_COMMANDS.has(request.command)) {
    runtimeCounters.transport.wsInboundErrorTotal += 1;
    sendWsCommandEnvelope(
      client,
      "ws.command.error",
      {
        requestId: request.requestId,
        command: request.command,
        pluginId,
        code: "ERR_WS_UNSUPPORTED_COMMAND",
        error: `Unsupported websocket read command: ${request.command}`
      },
      pluginId
    );
    return;
  }

  runtimeCounters.transport.wsInboundAcceptedTotal += 1;
  sendWsCommandEnvelope(
    client,
    "ws.command.ack",
    {
      requestId: request.requestId,
      command: request.command,
      pluginId,
      accepted: true
    },
    pluginId
  );

  try {
    const result = await executeWsReadOnlyCommand(
      request.command,
      request.args,
      pluginId
    );
    sendWsCommandEnvelope(
      client,
      "ws.command.result",
      {
        requestId: request.requestId,
        command: request.command,
        pluginId,
        result
      },
      pluginId
    );
    runtimeCounters.transport.wsInboundResultTotal += 1;
  } catch (error) {
    runtimeCounters.transport.wsInboundErrorTotal += 1;
    const runtimeCode =
      error instanceof BridgeRuntimeError && typeof error.code === "string"
        ? error.code
        : "ERR_WS_COMMAND_EXECUTION";
    sendWsCommandEnvelope(
      client,
      "ws.command.error",
      {
        requestId: request.requestId,
        command: request.command,
        pluginId,
        code: runtimeCode,
        error: error instanceof Error ? error.message : String(error),
        details:
          error instanceof BridgeRuntimeError ? error.details || null : null
      },
      pluginId
    );
  }
}

function broadcastRuntimeEvent(event, payload = {}, options = {}) {
  const pluginId = typeof options.pluginId === "string" ? options.pluginId : null;
  const envelope = createRuntimeEventEnvelope(event, payload, pluginId);
  for (const [clientId, client] of sseClients.entries()) {
    if (!shouldDeliverRuntimeEvent(client, envelope)) {
      continue;
    }
    try {
      writeSseEventFrame(client.res, envelope);
    } catch (error) {
      removeSseClient(clientId);
    }
  }

  if (shouldMirrorRuntimeEventToWs(envelope.event)) {
    for (const [clientId, client] of wsClients.entries()) {
      if (!shouldDeliverRuntimeEvent(client, envelope)) {
        continue;
      }
      const sent = sendWsClientPayload(client, envelope);
      if (!sent) {
        removeWsClient(clientId);
      }
    }

    if (isCommandLifecycleEvent(envelope.event) && wsClients.size > 0) {
      setTimeout(() => {
        const replayEnvelope = createRuntimeEventEnvelope(
          envelope.event,
          {
            ...(envelope.payload || {}),
            replayed: true,
            replayOfSequence: envelope.sequence
          },
          envelope.pluginId || null
        );
        for (const [clientId, client] of wsClients.entries()) {
          if (!shouldDeliverRuntimeEvent(client, replayEnvelope)) {
            continue;
          }
          const sent = sendWsClientPayload(client, replayEnvelope);
          if (!sent) {
            removeWsClient(clientId);
          }
        }
      }, Math.max(20, WS_COMMAND_MIRROR_RETRY_DELAY_MS)).unref();
    }
  }
}

function getHealthEventSnapshot(now = Date.now(), options = {}) {
  const activePlugins = [];
  const liveSnapshots = [];
  let activeSession = null;
  for (const session of pluginSessions.values()) {
    const state = getSessionState(session, {
      now,
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      retentionMs: SESSION_RETENTION_MS
    });
    if (state === SESSION_STATES.LIVE) {
      activePlugins.push(session.pluginId);
      const snapshot = toSessionSnapshot(session, {
        now,
        activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
        retentionMs: SESSION_RETENTION_MS
      });
      liveSnapshots.push(snapshot);
      if (
        !activeSession ||
        Number(snapshot.lastSeenAt || 0) > Number(activeSession.lastSeenAt || 0)
      ) {
        activeSession = snapshot;
      }
    }
  }
  activePlugins.sort();
  const activeSessionResolution = getActiveSessionResolution({ now, liveSnapshots });

  const failureSummary =
    options.failureSummary ??
    getOrCreateRequestSnapshotCacheEntry(`failure:${now}`, () => getRecentFailureSummary(now));
  const transportHealth =
    options.transportHealth ??
    getOrCreateRequestSnapshotCacheEntry(`transport:${now}`, () => getTransportHealthSnapshot(now));
  const queueDiagnostics =
    options.queueDiagnostics ??
    getOrCreateRequestSnapshotCacheEntry(`queue:${now}`, () => getQueueDiagnostics(now));
  const primaryLiveSession = options.primaryLiveSession ?? activeSession ?? null;
  return {
    currentReadHealth: failureSummary.currentReadHealth,
    recentFailedTotal: failureSummary.recentFailedTotal,
    activePluginCount: activePlugins.length,
    activePlugins,
    activePluginId: activeSession?.pluginId || null,
    activeSession,
    activeSessionResolution,
    transportHealth,
    commandReadiness: getCommandReadinessSnapshot({
      now,
      activePlugins,
      failureSummary,
      queueDiagnostics
    }),
    writeReadiness: getWriteReadinessSnapshot({
      now,
      activePlugins,
      failureSummary,
      queueDiagnostics,
      primaryLiveSession
    })
  };
}

function getCommandReadinessSnapshot({
  now = Date.now(),
  activePlugins = [],
  failureSummary,
  queueDiagnostics
} = {}) {
  const resolvedFailureSummary = failureSummary || getRecentFailureSummary(now);
  const resolvedQueueDiagnostics =
    queueDiagnostics ||
    getOrCreateRequestSnapshotCacheEntry(`queue:${now}`, () => getQueueDiagnostics(now));
  const activePluginIds = Array.isArray(activePlugins) ? activePlugins : [];
  const recoverySummary = buildActiveRecoverySummary({
    activePluginIds,
    pendingRecoveryEntries: Array.from(pendingRecoveryByPlugin.entries())
  });
  return buildCommandReadinessSnapshot({
    activePluginCount: activePluginIds.length,
    activePendingRecoveryCount: recoverySummary.activePendingRecoveryCount,
    ignoredRecoveryTotal: recoverySummary.ignoredRecoveryTotal,
    failureSummary: resolvedFailureSummary,
    queueDiagnostics: resolvedQueueDiagnostics,
    defaults: {
      toolTimeoutMs: TOOL_TIMEOUT_MS,
      nearTimeoutRatio: resolveNearTimeoutRatio(),
      wsAckGuardWindowMs: Math.max(
        WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS,
        WS_PLUGIN_RESUME_ACK_GRACE_MS,
        WS_POLLING_FALLBACK_GRACE_MS
      )
    }
  });
}

function maybeBroadcastHealthChanged(reason, now = Date.now()) {
  const snapshot = getHealthEventSnapshot(now);
  const signature = JSON.stringify(snapshot);
  if (signature === lastHealthEventSignature) {
    return;
  }
  lastHealthEventSignature = signature;
  broadcastRuntimeEvent("health.changed", {
    reason,
    ...snapshot
  });
}

function syncSessionStateAndBroadcast(pluginId, session, reason, now = Date.now()) {
  const state = getSessionState(session, {
    now,
    activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
    retentionMs: SESSION_RETENTION_MS
  });
  const previousState = sessionStateByPlugin.get(pluginId) || null;
  sessionStateByPlugin.set(pluginId, state);

  if (previousState !== state) {
    broadcastRuntimeEvent(
      "session.state_changed",
      {
        pluginId,
        previousState,
        state,
        reason
      },
      { pluginId }
    );
  }

  return state;
}

function broadcastQueueUpdated(reason, pluginId = null) {
  broadcastRuntimeEvent(
    "queue.updated",
    {
      reason,
      queue: getQueueDiagnostics(Date.now())
    },
    {
      pluginId: typeof pluginId === "string" ? pluginId : null
    }
  );
}

function resolveTargetNodeId(input = {}) {
  return input && typeof input === "object"
    ? input.targetNodeId ?? input.nodeId
    : undefined;
}

function getMetadataResultRoots(result) {
  const parsed =
    result && result.json
      ? result.json
      : result && typeof result.xml === "string"
        ? parseSelectionMetadataTree(result.xml)
        : null;
  if (!parsed) {
    return [];
  }
  if (Array.isArray(parsed.roots)) {
    return parsed.roots;
  }
  if (Array.isArray(parsed.children)) {
    return parsed.children;
  }
  return [];
}

function describeFallbackReason(error) {
  if (error instanceof BridgeRuntimeError) {
    return {
      code: error.code,
      message: error.message,
      details: error.details || null
    };
  }
  return {
    code: "ERR_DETAIL_READ_FALLBACK",
    message: error instanceof Error ? error.message : String(error),
    details: null
  };
}

async function readMetadataFallbackForDetail(pluginId, plan, error) {
  const fallbackMaxDepth = plan.includeChildren ? Math.min(plan.maxDepth, 6) : 0;
  const fallbackMaxNodes = plan.includeChildren ? Math.min(plan.maxNodes, 300) : Math.min(plan.maxNodes, 40);
  const metadata = await executePluginCommand(pluginId, "get_metadata", {
    targetNodeId: plan.targetNodeId,
    maxDepth: fallbackMaxDepth,
    maxNodes: fallbackMaxNodes,
    includeJson: true
  });
  const roots = getMetadataResultRoots(metadata);
  return {
    pluginId: metadata.pluginId || pluginId,
    fileKey: metadata.fileKey || null,
    fileName: metadata.fileName || null,
    pageId:
      metadata.pageId ||
      (metadata.json && metadata.json.pageId) ||
      null,
    pageName:
      metadata.pageName ||
      (metadata.json && metadata.json.pageName) ||
      null,
    detailLevel: plan.detailLevel,
    includeChildren: plan.includeChildren,
    maxDepth: fallbackMaxDepth,
    maxNodes: fallbackMaxNodes,
    nodeCount: metadata.nodeCount || roots.length,
    truncated: Boolean(metadata.truncated),
    source: "metadata_fallback",
    fallback: {
      used: true,
      fromCommand: "get_metadata",
      reason: describeFallbackReason(error)
    },
    node: roots[0] || null,
    metadata
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSearchNodesBackoffDelay(attemptIndex) {
  const base = Number.isFinite(SEARCH_NODES_RETRY_BASE_DELAY_MS)
    ? SEARCH_NODES_RETRY_BASE_DELAY_MS
    : 40;
  const cappedBase = Math.max(0, base);
  const maxDelay = Number.isFinite(SEARCH_NODES_RETRY_MAX_DELAY_MS)
    ? Math.max(cappedBase, SEARCH_NODES_RETRY_MAX_DELAY_MS)
    : 320;
  const exponential = cappedBase * 2 ** Math.max(0, attemptIndex - 1);
  return Math.min(maxDelay, exponential);
}

function isSearchNodesTransientDeliveryError(error) {
  if (error instanceof BridgeRuntimeError) {
    return (
      error.code === "ERR_COMMAND_EXPIRED" ||
      error.code === "ERR_COMMAND_CANCELED_STALE" ||
      error.code === "ERR_SEARCH_NODES_TIMEOUT"
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  return (
    lower.includes("timed out waiting for plugin response: search_nodes") ||
    lower.includes("command expired: search_nodes")
  );
}

function coerceSearchNodesError(error) {
  if (error instanceof BridgeRuntimeError) {
    if (error.code === "ERR_COMMAND_EXPIRED") {
      return new BridgeRuntimeError(
        "ERR_SEARCH_NODES_TIMEOUT",
        "Search nodes timed out waiting for plugin response.",
        {
          statusCode: 504,
          details: error.details || null
        }
      );
    }
    return error;
  }
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();
  if (lower.includes("no selection available")) {
    return new BridgeRuntimeError(
      "ERR_SELECTION_REQUIRED",
      "Search requires a selection or targetNodeId.",
      { statusCode: 409 }
    );
  }
  if (lower.includes("timed out")) {
    return new BridgeRuntimeError(
      "ERR_SEARCH_NODES_TIMEOUT",
      "Search nodes timed out waiting for plugin response.",
      { statusCode: 504 }
    );
  }
  return error;
}

async function executeSearchNodesWithRetry(pluginId, plan) {
  const maxAttempts = Math.max(
    1,
    Math.floor(
      Number.isFinite(SEARCH_NODES_RETRY_MAX_ATTEMPTS)
        ? SEARCH_NODES_RETRY_MAX_ATTEMPTS
        : 1
    )
  );
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      return await executePluginCommand(pluginId, "search_nodes", plan, {
        // Retry attempts should enqueue fresh commands instead of reattaching to deduped stale entries.
        disableDedupe: true
      });
    } catch (error) {
      const mappedError = coerceSearchNodesError(error);
      lastError = mappedError;
      const retryable = isSearchNodesTransientDeliveryError(mappedError);
      if (!retryable || attempt >= maxAttempts) {
        throw mappedError;
      }
      await wait(getSearchNodesBackoffDelay(attempt));
    }
  }

  throw lastError || new Error("Search nodes failed");
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

function recordRecentHandoff(payload = {}) {
  const entry = {
    handoffId: typeof payload.handoffId === "string" ? payload.handoffId : randomUUID(),
    receivedAt: new Date().toISOString(),
    status: "queued",
    claimedAt: null,
    claimedBy: null,
    completedAt: null,
    completion: null,
    source: payload.source && typeof payload.source === "object" ? payload.source : null,
    intent: payload.intent && typeof payload.intent === "object" ? payload.intent : null,
    figmaContext:
      payload.figmaContext && typeof payload.figmaContext === "object"
        ? payload.figmaContext
        : null,
    payload
  };
  recentHandoffs.unshift(entry);
  if (recentHandoffs.length > RECENT_HANDOFF_LIMIT) {
    recentHandoffs.length = RECENT_HANDOFF_LIMIT;
  }
  return entry;
}

function listRecentHandoffs({ limit } = {}) {
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 20;
  return recentHandoffs.slice(0, normalizedLimit);
}

function getRecentHandoffById(handoffId) {
  if (typeof handoffId !== "string" || !handoffId.trim()) {
    return null;
  }
  return recentHandoffs.find((entry) => entry.handoffId === handoffId.trim()) || null;
}

function getNextQueuedHandoff() {
  return recentHandoffs.find((entry) => entry.status === "queued") || null;
}

function claimRecentHandoff(handoffId, worker = {}) {
  const entry = getRecentHandoffById(handoffId);
  if (!entry) {
    return { ok: false, code: "HANDOFF_NOT_FOUND" };
  }
  if (entry.status !== "queued") {
    return {
      ok: false,
      code: "HANDOFF_NOT_AVAILABLE",
      entry
    };
  }
  entry.status = "claimed";
  entry.claimedAt = new Date().toISOString();
  entry.claimedBy = {
    workerId:
      typeof worker.workerId === "string" && worker.workerId.trim()
        ? worker.workerId.trim()
        : "local-agent",
    workerLabel:
      typeof worker.workerLabel === "string" && worker.workerLabel.trim()
        ? worker.workerLabel.trim()
        : null
  };
  return { ok: true, entry };
}

function completeRecentHandoff(handoffId, completion = {}) {
  const entry = getRecentHandoffById(handoffId);
  if (!entry) {
    return { ok: false, code: "HANDOFF_NOT_FOUND" };
  }
  entry.status = "completed";
  entry.completedAt = new Date().toISOString();
  entry.completion = {
    workerId:
      typeof completion.workerId === "string" && completion.workerId.trim()
        ? completion.workerId.trim()
        : entry.claimedBy?.workerId || "local-agent",
    summary:
      typeof completion.summary === "string" && completion.summary.trim()
        ? completion.summary.trim()
        : null,
    result:
      completion.result && typeof completion.result === "object" ? completion.result : null
  };
  return { ok: true, entry };
}

function withTimeout(promise, ms, message) {
  let timeoutId = null;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

function incrementNamedCounter(bucket, name) {
  bucket[name] = (bucket[name] || 0) + 1;
}

function getRecentTransportActivitySnapshot(now = Date.now()) {
  return buildRecentTransportActivitySnapshot({
    recentRuntimeEvents,
    now,
    windowMs: RECENT_TRANSPORT_WINDOW_MS
  });
}

function getTransportHealthSnapshot(now = Date.now()) {
  const recent = getRecentTransportActivitySnapshot(now);
  const transport = runtimeCounters.transport;
  const healthInputs = buildTransportHealthInputs({
    sseClients,
    wsClients,
    pluginSessions,
    recentRuntimeEvents,
    getSessionState,
    now,
    sessionStateOptions: {
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      retentionMs: SESSION_RETENTION_MS
    },
    liveState: SESSION_STATES.LIVE
  });
  return buildTransportHealthSnapshot({
    recent,
    transportCounters: transport,
    ...healthInputs
  });
}

function buildCommandLifecycleSummary(options = {}) {
  return queueObservability.getLifecycleSummary(options);
}

function buildCommandTimelineTail(options = {}) {
  return queueObservability.getTimelineTail(options);
}

function recordCommandLifecycle(command, status, now = Date.now(), extra = {}) {
  queueObservability.recordLifecycle(command, status, now, extra);
}

function recordCommandFailure(command, error, now = Date.now()) {
  queueObservability.recordFailure(command, error, now);
}

function getRecentFailureSummary(now = Date.now()) {
  return queueObservability.getFailureSummary(now);
}

function getRequestContext() {
  return requestContext.getStore() || {};
}

function getRequestSnapshotCache() {
  const context = getRequestContext();
  return context.snapshotCache instanceof Map ? context.snapshotCache : null;
}

function getOrCreateRequestSnapshotCacheEntry(key, factory) {
  const cache = getRequestSnapshotCache();
  if (!cache) {
    return factory();
  }
  if (cache.has(key)) {
    return cache.get(key);
  }
  const value = factory();
  cache.set(key, value);
  return value;
}

function getRuntimeObservabilitySnapshot(options = {}) {
  const now = options.now ?? Date.now();
  const failureSummary =
    options.failureSummary ??
    getOrCreateRequestSnapshotCacheEntry(`failure:${now}`, () => getRecentFailureSummary(now));
  const transportHealth =
    options.transportHealth ??
    getOrCreateRequestSnapshotCacheEntry(`transport:${now}`, () => getTransportHealthSnapshot(now));
  const lifecycleSummary =
    options.lifecycleSummary ??
    getOrCreateRequestSnapshotCacheEntry(`lifecycle-summary:${now}`, () =>
      buildCommandLifecycleSummary()
    );
  return buildRuntimeObservabilitySnapshot({
    transportHealth,
    runtimeCounters,
    pendingCommandTotal: pendingCommands.size,
    pendingResultTotal: pendingResults.size,
    pendingRecoveryTotal: pendingRecoveryByPlugin.size,
    trackedSessionTotal: pluginSessions.size,
    failureSummary,
    lifecycleSummary
  });
}

function getTransportCapabilitiesSnapshot() {
  return {
    healthEvents: true,
    sse: true,
    websocket: true,
    websocketCommandChannel: true,
    httpPollingFallback: true
  };
}

function getRuntimeFeatureFlagsSnapshot() {
  return {
    streamingFirst: true,
    healthBroadcast: true,
    eventStreamMirror: true,
    websocketCommandMirror: true,
    pollingFallback: true
  };
}

function getQueueDiagnostics(now = Date.now()) {
  return getOrCreateRequestSnapshotCacheEntry(`queue:${now}`, () => {
    const commandSnapshots = Array.from(pendingCommands.values()).map((command) => {
      const awaitingWsAck = isAwaitingWsPluginAck(command, now);
      const hasWsPluginClient = getWsPluginPickupClients(command.pluginId).length > 0;
      const session = pluginSessions.get(command.pluginId) || null;
      const sessionState = getSessionState(session, {
        now,
        activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
        retentionMs: SESSION_RETENTION_MS
      });
      const canDelayPollingFallback =
        hasWsPluginClient && sessionState === SESSION_STATES.LIVE;
      return {
        ...command,
        awaitingWsAck,
        canDelayPollingFallback
      };
    });

    return buildQueueDiagnosticsSnapshot({
      now,
      pendingCommands: commandSnapshots,
      pendingResultsTotal: pendingResults.size,
      lifecycleTail: queueObservability.getLifecycleEntries()
        .slice(-5)
        .reverse()
        .map((entry) => ({ ...entry })),
      lifecycleSummary: buildCommandLifecycleSummary(),
      commandTimelineTail: buildCommandTimelineTail({ limit: 5 }),
      runtimeQueueCounters: runtimeCounters.queue,
      defaults: {
        toolTimeoutMs: TOOL_TIMEOUT_MS,
        nearTimeoutRatio: resolveNearTimeoutRatio(),
        pollingFallbackMode: POLLING_FALLBACK_MODE,
        wsPollingFallbackGraceMs: WS_POLLING_FALLBACK_GRACE_MS,
        wsPollingFallbackQueuePressureThreshold: WS_POLLING_FALLBACK_QUEUE_PRESSURE_THRESHOLD,
        fallbackMultipliers: {
          critical: resolvePollingFallbackMultiplier("get_selection"),
          interactive: resolvePollingFallbackMultiplier("list_text_nodes"),
          standard: resolvePollingFallbackMultiplier("search_nodes"),
          detail: resolvePollingFallbackMultiplier("get_node_details")
        }
      },
      helpers: {
        isWriteCommandType,
        shouldDelayPollingFallbackForWs,
        resolvePollingFallbackClass,
        resolveAdaptivePollingFallbackMultiplier
      }
    });
  });
}

function getWriteReadinessSnapshot({
  now = Date.now(),
  activePlugins = [],
  failureSummary,
  queueDiagnostics,
  primaryLiveSession = null
} = {}) {
  const resolvedFailureSummary = failureSummary || getRecentFailureSummary(now);
  const resolvedQueueDiagnostics =
    queueDiagnostics ||
    getOrCreateRequestSnapshotCacheEntry(`queue:${now}`, () => getQueueDiagnostics(now));
  const activePluginIds = Array.isArray(activePlugins) ? activePlugins : [];
  const recoverySummary = buildActiveRecoverySummary({
    activePluginIds,
    pendingRecoveryEntries: Array.from(pendingRecoveryByPlugin.entries())
  });
  const writeReadinessInputs = buildWriteReadinessInputs({
    now,
    recentCommandLifecycles: queueObservability.getLifecycleEntries(),
    recentCommandFailures: queueObservability.getFailureEntries(),
    failureWindowMs: RECENT_FAILURE_WINDOW_MS,
    isWriteCommandType
  });
  return buildWriteReadinessSnapshot({
    now,
    activePluginCount: activePluginIds.length,
    activePendingRecoveryCount: recoverySummary.activePendingRecoveryCount,
    failureSummary: resolvedFailureSummary,
    queueDiagnostics: resolvedQueueDiagnostics,
    primaryLiveSession,
    recentWriteFailure: writeReadinessInputs.recentWriteFailure,
    lastSuccessfulWriteAt: writeReadinessInputs.lastSuccessfulWriteAt,
    defaults: {
      nearTimeoutRatio: resolveNearTimeoutRatio(),
      writePendingBacklogThresholdMs: WRITE_PENDING_BACKLOG_THRESHOLD_MS,
      writeHeartbeatGapDegradedMs: WRITE_HEARTBEAT_GAP_DEGRADED_MS,
      isBatchWriteCommandType
    }
  });
}

function getSessionDiagnostics({ now = Date.now(), staleLimit = 8 } = {}) {
  const snapshots = getSessionSnapshots({ includeStale: true, now });
  const primarySession =
    snapshots.find((snapshot) => snapshot.state === SESSION_STATES.LIVE) || null;
  const activeSessionResolution = getActiveSessionResolution({
    now,
    liveSnapshots: snapshots.filter((snapshot) => snapshot.state === SESSION_STATES.LIVE)
  });
  const summary = {
    total: snapshots.length,
    live: 0,
    registered: 0,
    stale: 0
  };

  for (const snapshot of snapshots) {
    if (snapshot.state === SESSION_STATES.LIVE) {
      summary.live += 1;
      continue;
    }
    if (snapshot.state === SESSION_STATES.REGISTERED) {
      summary.registered += 1;
      continue;
    }
    if (snapshot.state === SESSION_STATES.STALE) {
      summary.stale += 1;
    }
  }

  const staleSessions = snapshots
    .filter((snapshot) => snapshot.state !== SESSION_STATES.LIVE)
    .sort((a, b) => (b.staleMs || 0) - (a.staleMs || 0))
    .slice(0, staleLimit)
    .map((snapshot) => ({
      pluginId: snapshot.pluginId,
      state: snapshot.state,
      staleMs: snapshot.staleMs,
      lastSeenAt: snapshot.lastSeenAt,
      fileName: snapshot.fileName,
      pageName: snapshot.pageName
    }));

  const pendingRecovery = Array.from(pendingRecoveryByPlugin.entries())
    .map(([pluginId, value]) => ({
      pluginId,
      failures: value.failures,
      firstFailedAt: value.firstFailedAt,
      lastFailedAt: value.lastFailedAt,
      lastCode: value.lastCode,
      recoveryWindowMs: Math.max(0, now - value.firstFailedAt)
    }))
    .sort((a, b) => b.recoveryWindowMs - a.recoveryWindowMs);

  return {
    summary,
    primarySession,
    activeSessionResolution,
    staleSessions,
    pendingRecovery
  };
}

function getRuntimeOpsSnapshot({ now = Date.now(), staleLimit = 8 } = {}) {
  const failureSummary = getOrCreateRequestSnapshotCacheEntry(`failure:${now}`, () =>
    getRecentFailureSummary(now)
  );
  const transportHealth = getOrCreateRequestSnapshotCacheEntry(`transport:${now}`, () =>
    getTransportHealthSnapshot(now)
  );
  const pluginUiMetrics = buildPluginUiMetricsSnapshot(
    getSessionSnapshots({ includeStale: true, now })
  );
  const liveSnapshots = getSessionSnapshots({ includeStale: false, now });
  const livePluginIds = buildLivePluginIdsSnapshot(liveSnapshots);
  const queueDiagnostics = getQueueDiagnostics(now);
  const activeSessionResolution = getActiveSessionResolution({
    now,
    liveSnapshots
  });
  const primaryLiveSession = buildPrimaryLiveSessionSnapshot({
    liveSnapshots,
    activeSessionResolution
  });
  const commandReadiness = getCommandReadinessSnapshot({
    now,
    activePlugins: livePluginIds,
    failureSummary,
    queueDiagnostics
  });
  const writeReadiness = getWriteReadinessSnapshot({
    now,
    activePlugins: livePluginIds,
    failureSummary,
    queueDiagnostics,
    primaryLiveSession
  });
  return buildRuntimeOpsSnapshotResponse({
    now,
    config: {
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      retentionMs: SESSION_RETENTION_MS,
      pruneIntervalMs: SESSION_PRUNE_INTERVAL_MS,
      commandTimeoutMs: TOOL_TIMEOUT_MS
    },
    failureSummary,
    historicalFailedTotal: runtimeCounters.queue.failedTotal,
    sessionDiagnostics: getSessionDiagnostics({ now, staleLimit }),
    livePluginIds,
    activeSessionResolution,
    pluginUiMetrics,
    queueDiagnostics,
    transportHealth,
    commandReadiness,
    writeReadiness,
    observabilitySnapshot: getRuntimeObservabilitySnapshot({ now, failureSummary, transportHealth })
  });
}

function clampStaleLimit(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return 8;
  }
  return Math.max(1, Math.min(20, Math.floor(parsed)));
}

function normalizePluginUiMetrics(input) {
  if (!input || typeof input !== "object") {
    return null;
  }

  const toCount = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }
    return Math.floor(parsed);
  };

  const metrics = {
    generatedAt:
      typeof input.generatedAt === "string" && input.generatedAt.trim() ? input.generatedAt : null,
    polls: toCount(input.polls),
    commandFetches: toCount(input.commandFetches),
    pollDrivenReads: {
      runtime: toCount(input.pollDrivenReads?.runtime),
      detail: toCount(input.pollDrivenReads?.detail)
    },
    eventDrivenReads: {
      sessions: toCount(input.eventDrivenReads?.sessions),
      runtime: toCount(input.eventDrivenReads?.runtime),
      detail: toCount(input.eventDrivenReads?.detail)
    },
    transport: {
      bridgeConnected: Boolean(input.transport?.bridgeConnected),
      eventsConnected: Boolean(input.transport?.eventsConnected),
      wsCommandConnected: Boolean(input.transport?.wsCommandConnected)
    }
  };

  return metrics;
}

function shouldRunSessionPrune() {
  if (pendingCommands.size > 0 || pendingRecoveryByPlugin.size > 0) {
    return true;
  }
  return pluginSessions.size > 0;
}

function runSessionPruneTick() {
  if (!shouldRunSessionPrune()) {
    return;
  }
  pruneExpiredSessions(Date.now());
}

if (SESSION_PRUNE_INTERVAL_MS > 0) {
  setInterval(runSessionPruneTick, SESSION_PRUNE_INTERVAL_MS).unref();
}

function recordPreflightFailure(pluginId, error, now = Date.now()) {
  runtimeCounters.preflight.failuresTotal += 1;
  const code =
    error instanceof BridgeRuntimeError && typeof error.code === "string"
      ? error.code
      : "ERR_PREFLIGHT_UNKNOWN";
  incrementNamedCounter(runtimeCounters.preflight.failuresByCode, code);

  if (typeof code !== "string" || !code.startsWith("ERR_PLUGIN_SESSION_")) {
    return;
  }

  const current = pendingRecoveryByPlugin.get(pluginId) || {
    failures: 0,
    firstFailedAt: now,
    lastFailedAt: now,
    lastCode: code
  };
  current.failures += 1;
  current.lastFailedAt = now;
  current.lastCode = code;
  pendingRecoveryByPlugin.set(pluginId, current);
  runtimeCounters.preflight.recovery.pendingTotal = pendingRecoveryByPlugin.size;
}

function resolveRecoveryOutcome(pluginId, session, now = Date.now()) {
  const state = getSessionState(session, {
    now,
    activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
    retentionMs: SESSION_RETENTION_MS
  });
  const recovery = pendingRecoveryByPlugin.get(pluginId);
  if (state !== SESSION_STATES.LIVE || !recovery) {
    return {
      state,
      recovered: false,
      pendingRecovery: Boolean(recovery)
    };
  }

  pendingRecoveryByPlugin.delete(pluginId);
  runtimeCounters.preflight.recovery.recoveredTotal += 1;
  runtimeCounters.preflight.recovery.pendingTotal = pendingRecoveryByPlugin.size;
  return {
    state,
    recovered: true,
    pendingRecovery: false,
    recoveredAfterFailures: recovery.failures,
    recoveryWindowMs: Math.max(0, now - recovery.firstFailedAt),
    previousFailureCode: recovery.lastCode
  };
}

function resolveCommandError(error) {
  if (error instanceof Error) {
    return error;
  }
  if (typeof error === "string") {
    return new Error(error);
  }
  if (error && typeof error === "object") {
    const code = typeof error.code === "string" ? error.code : null;
    const message =
      typeof error.message === "string" ? error.message : "Command failed";
    if (code) {
      return new BridgeRuntimeError(code, message, {
        statusCode:
          typeof error.statusCode === "number" ? error.statusCode : 409,
        details: error.details || null
      });
    }
    return new Error(message);
  }
  return new Error("Command failed");
}

function findPendingCommandByDedupeKey(pluginId, type, dedupeKey) {
  for (const command of pendingCommands.values()) {
    if (
      command.pluginId === pluginId &&
      command.type === type &&
      command.dedupeKey === dedupeKey &&
      command.deliveredAt === null
    ) {
      return command;
    }
  }
  return null;
}

function cancelStalePendingCommands(pluginId, type, now, excludeCommandId) {
  for (const command of pendingCommands.values()) {
    if (
      command.pluginId !== pluginId ||
      command.type !== type ||
      command.commandId === excludeCommandId ||
      command.deliveredAt !== null
    ) {
      continue;
    }
    if (!canSafelyCancelStalePendingCommand(command.type)) {
      continue;
    }
    if (now - command.createdAt < STALE_PENDING_COMMAND_MS) {
      continue;
    }

    runtimeCounters.queue.canceledStaleTotal += 1;
    incrementNamedCounter(runtimeCounters.queue.canceledStaleByType, command.type);
    completeCommand(command.commandId, null, {
      code: "ERR_COMMAND_CANCELED_STALE",
      message: `Command canceled as stale pending request: ${command.type}`,
      statusCode: 409,
      details: {
        commandId: command.commandId,
        pluginId: command.pluginId,
        type: command.type,
        ageMs: Math.max(0, now - command.createdAt)
      }
    });
  }
}

function resolveCommandTimeoutMs(type, overrideTimeoutMs) {
  return resolveCommandTimeoutMsImpl(type, {
    defaultTimeoutMs: TOOL_TIMEOUT_MS,
    interactiveCommandMinTimeoutMs: INTERACTIVE_COMMAND_MIN_TIMEOUT_MS,
    interactiveCommandTimeoutBufferMs: INTERACTIVE_COMMAND_TIMEOUT_BUFFER_MS,
    interactiveCommandTimeoutMultiplier: INTERACTIVE_COMMAND_TIMEOUT_MULTIPLIER,
    overrideTimeoutMs,
    readHeavyCommandTimeoutBufferMs: READ_HEAVY_COMMAND_TIMEOUT_BUFFER_MS,
    readHeavyCommandTimeoutMultiplier: READ_HEAVY_COMMAND_TIMEOUT_MULTIPLIER,
    simpleWriteCommandMinTimeoutMs: SIMPLE_WRITE_COMMAND_MIN_TIMEOUT_MS,
    simpleWriteCommandTimeoutBufferMs: SIMPLE_WRITE_COMMAND_TIMEOUT_BUFFER_MS,
    simpleWriteCommandTimeoutMultiplier: SIMPLE_WRITE_COMMAND_TIMEOUT_MULTIPLIER,
    tokenExportChunkTimeoutMs: EXPORT_DESIGN_TOKENS_CHUNK_TIMEOUT_MS,
    writeHeavyCommandTimeoutBufferMs: WRITE_HEAVY_COMMAND_TIMEOUT_BUFFER_MS,
    writeHeavyCommandTimeoutMultiplier: WRITE_HEAVY_COMMAND_TIMEOUT_MULTIPLIER
  });
}

function resolveQueueExpiryGraceMs(type) {
  if (isInteractiveCommandType(type)) {
    return Number.isFinite(INTERACTIVE_QUEUE_EXPIRY_GRACE_MS)
      ? Math.max(0, INTERACTIVE_QUEUE_EXPIRY_GRACE_MS)
      : 250;
  }
  if (isSimpleWriteCommandType(type)) {
    return Number.isFinite(SIMPLE_WRITE_QUEUE_EXPIRY_GRACE_MS)
      ? Math.max(0, SIMPLE_WRITE_QUEUE_EXPIRY_GRACE_MS)
      : 700;
  }
  if (isReadHeavyCommandType(type)) {
    return Number.isFinite(READ_HEAVY_QUEUE_EXPIRY_GRACE_MS)
      ? Math.max(0, READ_HEAVY_QUEUE_EXPIRY_GRACE_MS)
      : 1200;
  }
  if (isWriteHeavyCommandType(type)) {
    return Number.isFinite(WRITE_HEAVY_QUEUE_EXPIRY_GRACE_MS)
      ? Math.max(0, WRITE_HEAVY_QUEUE_EXPIRY_GRACE_MS)
      : 1500;
  }
  return 0;
}

function createPendingCommand(pluginId, type, payload, options = {}) {
  const now = Date.now();
  const context = options.context || getRequestContext();
  if (context.designerWorkflowCanceled === true) {
    throw new BridgeRuntimeError(
      "ERR_COMMAND_CANCELED_WORKFLOW_TIMEOUT",
      `Command skipped because designer workflow timed out: ${type}`,
      {
        statusCode: 504,
        details: {
          pluginId,
          type
        }
      }
    );
  }
  const source = options.source || context.source || "system";
  const priority = resolveCommandPriority({
    source,
    requestedPriority: options.priority
  });
  const dedupeKey =
    options.disableDedupe || !canSafelyDedupeCommand(type)
      ? null
      : options.dedupeKey || buildCommandDedupeKey(type, payload);

  if (dedupeKey) {
    const existing = findPendingCommandByDedupeKey(pluginId, type, dedupeKey);
    if (existing) {
      runtimeCounters.queue.dedupedTotal += 1;
      return { command: existing, deduped: true };
    }
  }

  const commandId = randomUUID();
  const command = {
    commandId,
    pluginId,
    type,
    payload,
    source,
    priority,
    dedupeKey,
    timeoutMs: resolveCommandTimeoutMs(type, options.timeoutMs),
    createdAt: now,
    deliveredAt: null
  };
  const session = ensurePluginSession(pluginId);
  if (
    typeof session.lastWsResumeSyncedAt === "number" &&
    Number.isFinite(session.lastWsResumeSyncedAt) &&
    now - session.lastWsResumeSyncedAt < Math.max(100, WS_PLUGIN_RESUME_ACK_GRACE_MS)
  ) {
    command.wsResumeSyncedAt = session.lastWsResumeSyncedAt;
  }

  pendingCommands.set(commandId, command);
  if (context.designerWorkflowCommandIds instanceof Set) {
    context.designerWorkflowCommandIds.add(commandId);
  }
  if (context.httpCommandIds instanceof Set) {
    context.httpCommandIds.add(commandId);
  }
  runtimeCounters.queue.enqueuedTotal += 1;
  broadcastRuntimeEvent(
    "command.enqueued",
    {
      commandId,
      pluginId,
      type,
      source,
      priority
    },
    { pluginId }
  );
  broadcastQueueUpdated("command_enqueued", pluginId);
  dispatchPendingCommandsToPluginWs(pluginId, "command_enqueued");

  if (source !== "system" && canSafelyCancelStalePendingCommand(type)) {
    cancelStalePendingCommands(pluginId, type, now, commandId);
  }

  return { command, deduped: false };
}

function waitForResult(commandId) {
  return new Promise((resolve, reject) => {
    const resolvers = pendingResults.get(commandId) || [];
    resolvers.push({ resolve, reject });
    pendingResults.set(commandId, resolvers);
  });
}

function cancelHttpClientDisconnectedPendingCommands(context = {}, details = {}) {
  if (!(context.httpCommandIds instanceof Set) || context.httpCommandIds.size === 0) {
    return 0;
  }

  let canceledTotal = 0;
  const now = Date.now();
  const endpoint =
    typeof details.endpoint === "string" && details.endpoint.trim()
      ? details.endpoint.trim()
      : context.endpoint || null;

  for (const commandId of context.httpCommandIds) {
    const command = pendingCommands.get(commandId);
    if (!command) {
      continue;
    }
    const resolvers = pendingResults.get(commandId) || [];
    pendingCommands.delete(commandId);
    pendingResults.delete(commandId);
    canceledTotal += 1;
    runtimeCounters.queue.clientAbortedCommandTotal += 1;
    incrementNamedCounter(runtimeCounters.queue.clientAbortedCommandByType, command.type);
    recordCommandLifecycle(command, "abandoned", now, {
      failureCode: "ERR_HTTP_CLIENT_DISCONNECTED",
      failureMessage: `HTTP client disconnected before command completed: ${command.type}`,
      deliveryMode: command.deliveryMode || null
    });
    broadcastRuntimeEvent(
      "command.abandoned",
      {
        commandId: command.commandId,
        pluginId: command.pluginId,
        type: command.type,
        endpoint,
        code: "ERR_HTTP_CLIENT_DISCONNECTED",
        message: "HTTP client disconnected before command completed."
      },
      { pluginId: command.pluginId }
    );
    broadcastQueueUpdated("command_abandoned", command.pluginId);
    const error = new BridgeRuntimeError(
      "ERR_HTTP_CLIENT_DISCONNECTED",
      `HTTP client disconnected before command completed: ${command.type}`,
      {
        statusCode: 499,
        details: {
          commandId: command.commandId,
          pluginId: command.pluginId,
          type: command.type,
          endpoint
        }
      }
    );
    for (const resolver of resolvers) {
      resolver.reject(error);
    }
  }

  if (canceledTotal > 0) {
    maybeBroadcastHealthChanged("http_client_disconnected");
  }
  return canceledTotal;
}

function shouldApplyQueueExpiryGrace(command, baseTimeoutMs) {
  if (!command || command.deliveredAt !== null) {
    return false;
  }
  if (!canApplyExpiryGrace(command.type)) {
    return false;
  }
  if (command.expiryGraceApplied === true) {
    return false;
  }
  const graceWindowMs = resolveQueueExpiryGraceMs(command.type);
  if (graceWindowMs <= 0) {
    return false;
  }
  const timeoutMs =
    typeof command.timeoutMs === "number" && Number.isFinite(command.timeoutMs)
      ? command.timeoutMs
      : baseTimeoutMs;
  const ageMs = Math.max(0, Date.now() - command.createdAt);
  return ageMs >= timeoutMs;
}

function waitForResultWithAdaptiveTimeout(command, baseTimeoutMs, timeoutMessage) {
  return new Promise((resolve, reject) => {
    let timeoutId = null;
    let settled = false;

    const clearTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const scheduleTimeout = (ms) => {
      clearTimer();
      timeoutId = setTimeout(() => {
        if (settled) {
          return;
        }
        const pending = pendingCommands.get(command.commandId);
        if (shouldApplyQueueExpiryGrace(pending, baseTimeoutMs)) {
          const graceMs = resolveQueueExpiryGraceMs(pending?.type);
          pending.expiryGraceApplied = true;
          pending.timeoutMs = Math.max(
            typeof pending.timeoutMs === "number" && Number.isFinite(pending.timeoutMs)
              ? pending.timeoutMs
              : baseTimeoutMs,
            baseTimeoutMs
          ) + graceMs;
          dispatchPendingCommandsToPluginWs(pending.pluginId, "expiry_grace");
          scheduleTimeout(graceMs);
          return;
        }
        settled = true;
        reject(new Error(timeoutMessage));
      }, Math.max(1, ms));
    };

    waitForResult(command.commandId)
      .then((result) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimer();
        resolve(result);
      })
      .catch((error) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimer();
        reject(error);
      });

    scheduleTimeout(baseTimeoutMs);
  });
}

function resolveBulkBindVariablesTimeoutMs(entries = []) {
  return resolveBulkBindVariablesTimeoutMsImpl(entries, {
    defaultTimeoutMs: TOOL_TIMEOUT_MS
  });
}

async function executePluginCommandDirect(pluginId, type, payload = {}, options = {}) {
  const timeoutMs = resolveCommandTimeoutMs(type, options.timeoutMs);
  const { command } = createPendingCommand(pluginId, type, payload, {
    ...options,
    timeoutMs
  });

  if (!canApplyExpiryGrace(type)) {
    return withTimeout(
      waitForResult(command.commandId),
      timeoutMs,
      `Timed out waiting for plugin response: ${type}`
    );
  }

  return waitForResultWithAdaptiveTimeout(
    command,
    timeoutMs,
    `Timed out waiting for plugin response: ${type}`
  );
}

async function flushBindVariableCoalescer(pluginId, coalescer) {
  if (!coalescer || coalescer.flushed) {
    return;
  }

  coalescer.flushed = true;
  if (coalescer.timer) {
    clearTimeout(coalescer.timer);
    coalescer.timer = null;
  }
  bindVariableCoalescers.delete(pluginId);

  const entries = coalescer.entries.slice();
  if (entries.length === 0) {
    return;
  }

  try {
    if (entries.length === 1) {
      const singleEntry = entries[0];
      const result = await executePluginCommandDirect(
        pluginId,
        "bind_variable",
        singleEntry.payload,
        {
          ...singleEntry.options,
          disableWriteCoalescing: true
        }
      );
      singleEntry.resolve(result);
      return;
    }

    runtimeCounters.queue.writeCoalescedBatchTotal += 1;
    runtimeCounters.queue.writeCoalescedRequestTotal += entries.length;
    runtimeCounters.queue.writeCoalescedSavedCommandTotal += Math.max(0, entries.length - 1);

    const result = await executePluginCommandDirect(
      pluginId,
      "bulk_bind_variables",
      {
        bindings: entries.map((entry) => entry.payload)
      },
      {
        timeoutMs: resolveBulkBindVariablesTimeoutMs(entries),
        disableWriteCoalescing: true,
        coalescedFrom: "bind_variable",
        coalescedRequestCount: entries.length
      }
    );

    const boundItems = Array.isArray(result?.bound) ? result.bound : [];
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      entry.resolve({
        bound: boundItems[index] || null,
        coalesced: {
          source: "bind_variable",
          type: "bulk_bind_variables",
          index,
          total: entries.length
        }
      });
    }
  } catch (error) {
    for (const entry of entries) {
      entry.reject(error);
    }
  }
}

function enqueueCoalescedBindVariable(pluginId, payload, options = {}) {
  return new Promise((resolve, reject) => {
    let coalescer = bindVariableCoalescers.get(pluginId);
    if (!coalescer) {
      coalescer = {
        entries: [],
        timer: null,
        flushed: false
      };
      bindVariableCoalescers.set(pluginId, coalescer);
    }

    coalescer.entries.push({
      payload,
      options,
      resolve,
      reject
    });

    if (!coalescer.timer) {
      coalescer.timer = setTimeout(() => {
        flushBindVariableCoalescer(pluginId, coalescer).catch(() => {});
      }, Math.max(0, BIND_VARIABLE_COALESCE_WINDOW_MS));
      if (typeof coalescer.timer.unref === "function") {
        coalescer.timer.unref();
      }
    }
  });
}

async function executePluginCommand(pluginId, type, payload = {}, options = {}) {
  const resolvedPluginId = resolveActivePluginId(pluginId);
  const session = pluginSessions.get(resolvedPluginId);
  const now = Date.now();
  try {
    preflightPluginCommand(resolvedPluginId, session, {
      now,
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      retentionMs: SESSION_RETENTION_MS
    });
  } catch (error) {
    recordPreflightFailure(resolvedPluginId, error, now);
    throw error;
  }

  if (
    type === "bind_variable" &&
    options.disableWriteCoalescing !== true &&
    BIND_VARIABLE_COALESCE_WINDOW_MS > 0
  ) {
    return enqueueCoalescedBindVariable(resolvedPluginId, payload, options);
  }

  return executePluginCommandDirect(resolvedPluginId, type, payload, options);
}

function completeCommand(commandId, result, error) {
  const command = pendingCommands.get(commandId) || null;
  const resolvers = pendingResults.get(commandId);
  if (!resolvers || resolvers.length === 0) {
    return;
  }

  pendingResults.delete(commandId);
  pendingCommands.delete(commandId);

  if (error) {
    runtimeCounters.queue.failedTotal += 1;
    const resolvedError = resolveCommandError(error);
    recordCommandFailure(command, resolvedError, Date.now());
    if (command) {
      broadcastRuntimeEvent(
        "command.failed",
        {
          commandId: command.commandId,
          pluginId: command.pluginId,
          type: command.type,
          code:
            resolvedError instanceof BridgeRuntimeError
              ? resolvedError.code
              : "ERR_COMMAND_FAILED",
          message: resolvedError.message
        },
        { pluginId: command.pluginId }
      );
      broadcastQueueUpdated("command_failed", command.pluginId);
    }
    maybeBroadcastHealthChanged("command_failed");
    for (const resolver of resolvers) {
      resolver.reject(resolvedError);
    }
    return;
  }

  runtimeCounters.queue.completedTotal += 1;
  recordCommandLifecycle(command, "completed", Date.now());
  if (command) {
    broadcastRuntimeEvent(
      "command.completed",
      {
        commandId: command.commandId,
        pluginId: command.pluginId,
        type: command.type
      },
      { pluginId: command.pluginId }
    );
    broadcastQueueUpdated("command_completed", command.pluginId);
  }
  maybeBroadcastHealthChanged("command_completed");
  for (const resolver of resolvers) {
    resolver.resolve(result);
  }
}

function cleanupExpiredCommands() {
  const now = Date.now();
  for (const [commandId, command] of pendingCommands.entries()) {
    const timeoutMs =
      typeof command.timeoutMs === "number" && Number.isFinite(command.timeoutMs)
        ? command.timeoutMs
        : TOOL_TIMEOUT_MS;
    if (now - command.createdAt > timeoutMs) {
      runtimeCounters.queue.expiredTotal += 1;
      completeCommand(commandId, null, {
        code: "ERR_COMMAND_EXPIRED",
        message: `Command expired: ${command.type}`,
        statusCode: 504,
        details: {
          commandId,
          pluginId: command.pluginId,
          type: command.type,
          timeoutMs
        }
      });
    }
  }
}

setInterval(cleanupExpiredCommands, 5000).unref();

function getHttpRequestContext(req, url) {
  const base = {
    snapshotCache: new Map(),
    httpCommandIds: new Set(),
    httpClientDisconnected: false
  };
  if (url.pathname.startsWith("/api/")) {
    return {
      ...base,
      source: "user_http",
      endpoint: url.pathname
    };
  }
  return {
    ...base,
    source: "system_http",
    endpoint: url.pathname
  };
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const httpContext = getHttpRequestContext(req, url);
  let responseFinished = false;
  let disconnectHandled = false;
  const handleHttpDisconnect = () => {
    if (responseFinished || disconnectHandled) {
      return;
    }
    disconnectHandled = true;
    httpContext.httpClientDisconnected = true;
    cancelHttpClientDisconnectedPendingCommands(httpContext, {
      endpoint: url.pathname
    });
  };
  res.once("finish", () => {
    responseFinished = true;
  });
  req.once("aborted", handleHttpDisconnect);
  res.once("close", handleHttpDisconnect);
  req.socket?.once("close", handleHttpDisconnect);
  requestContext.run(httpContext, async () => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      const pluginIdQuery = url.searchParams.get("pluginId");
      const pluginId =
        typeof pluginIdQuery === "string" && pluginIdQuery.trim()
          ? pluginIdQuery.trim()
          : null;
      const eventTypes = parseSseFilterList(
        url.searchParams.get("eventTypes") || url.searchParams.get("eventType")
      );
      const lastEventSequence = resolveLastEventSequence(req, url);
      const clientId = `sse-${++sseClientSequence}`;

      res.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream; charset=utf-8",
        "X-Accel-Buffering": "no"
      });
      res.write(": connected\n\n");

      const keepAliveTimer = setInterval(() => {
        try {
          res.write(`: keepalive ${Date.now()}\n\n`);
        } catch (error) {
          removeSseClient(clientId);
        }
      }, 15000);
      keepAliveTimer.unref();

      sseClients.set(clientId, {
        id: clientId,
        res,
        pluginId,
        eventTypes,
        keepAliveTimer
      });

      if (lastEventSequence !== null) {
        const replayEvents = getReplayableRuntimeEvents({
          afterSequence: lastEventSequence,
          pluginId,
          eventTypes
        });
        for (const envelope of replayEvents) {
          writeSseEventFrame(res, envelope);
        }
      }

      const cleanup = () => {
        removeSseClient(clientId);
      };
      req.on("close", cleanup);
      req.on("aborted", cleanup);
      res.on("close", cleanup);
      res.on("error", cleanup);

      const initialEnvelope = createRuntimeEventEnvelope(
        "health.changed",
        {
          reason: "subscriber_connected",
          ...getHealthEventSnapshot(Date.now()),
          subscriberId: clientId
        },
        null,
        { record: false }
      );
      writeSseEventFrame(res, initialEnvelope);
      return;
    }

    if (await handleRouteTableRequest(stableRouteTable, req, res, url)) {
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-selection") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "get_selection"
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (await handleDesignerRoute(req, res, url)) {
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-metadata") {
      const body = await readJsonBody(req);
      const includeJson = body.includeJson === true;
      const result = await executePluginCommand(
        body.pluginId || "default",
        "get_metadata",
        {
          targetNodeId: resolveTargetNodeId(body),
          maxDepth: body.maxDepth,
          maxNodes: body.maxNodes,
          includeJson
        }
      );
      const jsonTree =
        includeJson && result
          ? result.json
            ? result.json
            : typeof result.xml === "string"
              ? parseSelectionMetadataTree(result.xml)
              : null
          : null;
      jsonResponse(res, 200, {
        ok: true,
        result: includeJson ? { ...result, json: jsonTree } : result
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-node-details") {
      const body = await readJsonBody(req);
      const plan = buildNodeDetailsPlan(body);
      const pluginId = body.pluginId || "default";
      let result = null;
      try {
        result = await executePluginCommand(pluginId, "get_node_details", plan);
      } catch (error) {
        result = await readMetadataFallbackForDetail(pluginId, plan, error);
      }
      broadcastRuntimeEvent(
        "detail.refreshed",
        {
          pluginId,
          detailType: "node",
          targetNodeId: plan.targetNodeId
        },
        { pluginId }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-component-variant-details") {
      const body = await readJsonBody(req);
      const plan = buildComponentVariantDetailsPlan(body);
      const pluginId = body.pluginId || "default";
      let result = null;
      try {
        result = await executePluginCommand(
          pluginId,
          "get_component_variant_details",
          plan
        );
      } catch (error) {
        const fallback = await readMetadataFallbackForDetail(pluginId, plan, error);
        result = {
          ...fallback,
          targetNode: fallback.node,
          componentSet: null,
          variantCount: 0,
          variants: []
        };
      }
      broadcastRuntimeEvent(
        "detail.refreshed",
        {
          pluginId,
          detailType: "component_variant",
          targetNodeId: plan.targetNodeId
        },
        { pluginId }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-instance-details") {
      const body = await readJsonBody(req);
      const plan = buildInstanceDetailsPlan(body);
      const pluginId = body.pluginId || "default";
      let result = null;
      try {
        result = await executePluginCommand(pluginId, "get_instance_details", plan);
      } catch (error) {
        const fallback = await readMetadataFallbackForDetail(pluginId, plan, error);
        result = {
          ...fallback,
          instance: fallback.node,
          sourceComponent: null,
          sourceComponentSet: null,
          componentPropertyDefinitions: [],
          variantProperties: null,
          componentProperties: null,
          resolvedChildCount: 0
        };
      }
      broadcastRuntimeEvent(
        "detail.refreshed",
        {
          pluginId,
          detailType: "instance",
          targetNodeId: plan.targetNodeId
        },
        { pluginId }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-variable-defs") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "get_variable_defs",
        {
          targetNodeId: resolveTargetNodeId(body),
          maxDepth: body.maxDepth,
          maxNodes: body.maxNodes
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/export-design-tokens") {
      const body = await readJsonBody(req);
      const result = await exportDesignTokensArtifact(body.pluginId || "default", {
        scope: body.scope || "file",
        includeAliases: body.includeAliases !== false,
        includeResolvedValues: body.includeResolvedValues !== false,
        includeStyles: body.includeStyles !== false,
        includeUsages: body.includeUsages === true,
        limit: body.limit ?? body.chunkLimit
      });
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/get-annotations") {
      const body = await readJsonBody(req);
      const plan = buildGetAnnotationsPlan(body);
      const rawResult = await executePluginCommand(
        body.pluginId || "default",
        "get_annotations",
        plan
      );
      const result = normalizeAnnotationReadResult(rawResult, {
        includeInferredComments: plan.includeInferredComments
      });
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/list-text-nodes") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "list_text_nodes",
        {
          pageId: body.pageId,
          targetNodeId: body.targetNodeId,
          scope: body.scope
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-nodes") {
      const body = await readJsonBody(req);
      const plan = buildSearchNodesPlan(body);
      const result = await executeSearchNodesWithRetry(
        body.pluginId || "default",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/snapshot-selection") {
      const body = await readJsonBody(req);
      const plan = buildSnapshotPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "snapshot_selection",
        {
          pageId: plan.pageId,
          targetNodeId: plan.targetNodeId || body.targetNodeId,
          maxDepth: plan.maxDepth,
          maxNodes: plan.maxNodes,
          placeholderInstances: plan.placeholderInstances
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/export-node") {
      const body = await readJsonBody(req);
      const plan = buildExportNodePlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "export_node",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/analyze-reference-selection") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const plan = buildAnalyzeReferenceSelectionPlan(body);
      const metadataResult = await executePluginCommand(
        pluginId,
        "get_metadata",
        {
          targetNodeId: plan.targetNodeId
        }
      );
      const result = deriveReferenceAnalysisDraft(metadataResult, plan);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/add-annotation") {
      const body = await readJsonBody(req);
      const plan = buildAddAnnotationPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "add_annotation",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-add-annotations") {
      const body = await readJsonBody(req);
      const plan = buildBulkAddAnnotationsPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bulk_add_annotations",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-library-assets") {
      const body = await readJsonBody(req);
      const plan = buildLibraryAssetSearchPlan(body);
      const result = await searchLibraryAssets(plan, {
        accessToken: process.env.FIGMA_ACCESS_TOKEN
      });
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-design-system") {
      const body = await readJsonBody(req);
      const result = await performDesignSystemSearch(body.pluginId || "default", body);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/find-or-import-component") {
      const body = await readJsonBody(req);
      const result = await performFindOrImportComponent(body.pluginId || "default", body);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reuse-or-create-component") {
      const body = await readJsonBody(req);
      const result = await performReuseOrCreateComponent(body.pluginId || "default", body);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-screen-from-design-system") {
      const body = await readJsonBody(req);
      const result = await performBuildScreenFromDesignSystem(body.pluginId || "default", body);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/compose-screen-from-intents") {
      const body = await readJsonBody(req);
      const result = await performComposeScreenFromIntents(body.pluginId || "default", body);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/validate-external-compose-input") {
      const body = await readJsonBody(req);
      const result = performValidateExternalComposeInput(body);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/analyze-selection-to-compose") {
      const body = await readJsonBody(req);
      const result = await performAnalyzeSelectionToCompose(body.pluginId || "default", body);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-finance-summary-mock") {
      const body = await readJsonBody(req);
      const result = await performBuildFinanceSummaryMock(body.pluginId || "default", withSessionDefaultParent(body.pluginId || "default", body));
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-layout") {
      const body = await readJsonBody(req);
      const result = await performBuildLayout(
        body.pluginId || "default",
        withSessionDefaultParent(body.pluginId || "default", body)
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-instance") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const plan = buildCreateInstancePlan(withSessionDefaultParent(pluginId, body));
      const result = await executePluginCommand(pluginId, "create_instance", plan);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-instances") {
      const body = await readJsonBody(req);
      const plan = buildSearchInstancesPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "search_instances",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/recreate-snapshot") {
      const body = await readJsonBody(req);
      const plan = buildReplayPlan(body.snapshot, {
        targetParentId: body.targetParentId
      });
      const result = await executePluginCommand(
        body.pluginId || "default",
        "recreate_snapshot",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/search-file-components") {
      const body = await readJsonBody(req);
      const plan = buildFileComponentSearchPlan(body);
      const result = await searchFileComponents(plan, {
        accessToken: process.env.FIGMA_ACCESS_TOKEN
      });
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/list-component-properties") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "list_component_properties",
        {
          targetNodeId: body.targetNodeId
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/update-text") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "update_text",
        {
          nodeId: body.nodeId,
          text: body.text
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/set-component-property") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "set_component_property",
        {
          nodeId: body.nodeId,
          propertyName: body.propertyName,
          value: body.value
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/set-component-properties") {
      const body = await readJsonBody(req);
      const plan = buildSetComponentPropertiesPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "set_component_properties",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/add-component-property") {
      const body = await readJsonBody(req);
      const plan = buildAddComponentPropertyPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "add_component_property",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/edit-component-property") {
      const body = await readJsonBody(req);
      const plan = buildEditComponentPropertyPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "edit_component_property",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/set-variant-properties") {
      const body = await readJsonBody(req);
      const plan = buildSetVariantPropertiesPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "set_variant_properties",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bind-variable") {
      const body = await readJsonBody(req);
      const plan = buildBindVariablePlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bind_variable",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-bind-variables") {
      const body = await readJsonBody(req);
      const plan = buildBulkBindVariablesPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bulk_bind_variables",
        plan,
        {
          timeoutMs: resolveBulkBindVariablesTimeoutMs(plan.bindings.length)
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/apply-style") {
      const body = await readJsonBody(req);
      const plan = buildApplyStylePlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "apply_style",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-component") {
      const body = await readJsonBody(req);
      const plan = buildCreateComponentPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "create_component",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-component-set") {
      const body = await readJsonBody(req);
      const plan = buildCreateComponentSetPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "create_component_set",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/preview-changes") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "preview_changes",
        {
          nodeId: body.nodeId,
          target: body.target,
          visible: body.visible,
          allowHidden: body.allowHidden,
          locked: body.locked,
          allowLocked: body.allowLocked,
          isMask: body.isMask,
          allowMask: body.allowMask,
          fillColor: body.fillColor,
          strokeColor: body.strokeColor,
          strokeWeight: body.strokeWeight,
          dropShadow: body.dropShadow,
          cornerRadius: body.cornerRadius,
          opacity: body.opacity,
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
          layoutMode: body.layoutMode,
          itemSpacing: body.itemSpacing,
          paddingLeft: body.paddingLeft,
          paddingRight: body.paddingRight,
          paddingTop: body.paddingTop,
          paddingBottom: body.paddingBottom,
          primaryAxisAlignItems: body.primaryAxisAlignItems,
          counterAxisAlignItems: body.counterAxisAlignItems,
          primaryAxisSizingMode: body.primaryAxisSizingMode,
          counterAxisSizingMode: body.counterAxisSizingMode,
          layoutGrow: body.layoutGrow,
          layoutAlign: body.layoutAlign,
          updates: body.updates
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-update-texts") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bulk_update_texts",
        {
          updates: body.updates || []
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/rename-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "rename_node",
        {
          nodeId: body.nodeId,
          name: body.name
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-rename-nodes") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bulk_rename_nodes",
        {
          updates: body.updates || []
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/update-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "update_node",
        {
          nodeId: body.nodeId,
          target: body.target,
          visible: body.visible,
          allowHidden: body.allowHidden,
          locked: body.locked,
          allowLocked: body.allowLocked,
          isMask: body.isMask,
          allowMask: body.allowMask,
          fillColor: body.fillColor,
          strokeColor: body.strokeColor,
          strokeWeight: body.strokeWeight,
          dropShadow: body.dropShadow,
          cornerRadius: body.cornerRadius,
          opacity: body.opacity,
          x: body.x,
          y: body.y,
          width: body.width,
          height: body.height,
          layoutMode: body.layoutMode,
          itemSpacing: body.itemSpacing,
          paddingLeft: body.paddingLeft,
          paddingRight: body.paddingRight,
          paddingTop: body.paddingTop,
          paddingBottom: body.paddingBottom,
          primaryAxisAlignItems: body.primaryAxisAlignItems,
          counterAxisAlignItems: body.counterAxisAlignItems,
          primaryAxisSizingMode: body.primaryAxisSizingMode,
          counterAxisSizingMode: body.counterAxisSizingMode,
          layoutGrow: body.layoutGrow,
          layoutAlign: body.layoutAlign,
          characters: body.characters,
          fontFamily: body.fontFamily,
          fontStyle: body.fontStyle,
          fontSize: body.fontSize
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-update-nodes") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "bulk_update_nodes",
        {
          updates: body.updates || []
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/create-node") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const plan = buildCreateNodePlan(withSessionDefaultParent(pluginId, body));
      const result = await executePluginCommand(
        pluginId,
        "create_node",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/bulk-create-nodes") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const plan = buildBulkCreateNodesPlan(withSessionDefaultParent(pluginId, body));
      const result = await executePluginCommand(
        pluginId,
        "bulk_create_nodes",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/import-library-component") {
      const body = await readJsonBody(req);
      const plan = buildImportLibraryComponentPlan(body);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "import_library_component",
        plan
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/duplicate-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "duplicate_node",
        {
          nodeId: body.nodeId,
          count: body.count
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/move-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "move_node",
        {
          nodeId: body.nodeId,
          parentId: body.parentId,
          index: body.index
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/move-section") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "move_section",
        {
          sectionId: body.sectionId,
          destinationParentId: body.destinationParentId,
          index: body.index
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/normalize-spacing") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "normalize_spacing",
        {
          containerId: body.containerId,
          spacing: body.spacing,
          mode: body.mode,
          recursive: body.recursive
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/apply-naming-rule") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "apply_naming_rule",
        {
          rootNodeId: body.rootNodeId,
          ruleSet: body.ruleSet,
          recursive: body.recursive,
          previewOnly: body.previewOnly
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/promote-section") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "promote_section",
        {
          sectionId: body.sectionId,
          destinationParentId: body.destinationParentId,
          index: body.index,
          normalizeSpacing: body.normalizeSpacing,
          previewOnly: body.previewOnly
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/delete-node") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "delete_node",
        {
          nodeId: body.nodeId
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/reorder-child") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "reorder_child",
        {
          nodeId: body.nodeId,
          index: body.index
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/boolean-subtract") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "boolean_subtract",
        {
          baseNodeId: body.baseNodeId,
          subtractNodeIds: body.subtractNodeIds || [],
          parentId: body.parentId,
          index: body.index,
          name: body.name
        }
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/undo-last-batch") {
      const body = await readJsonBody(req);
      const result = await executePluginCommand(
        body.pluginId || "default",
        "undo_last_batch"
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/handoffs") {
      const limitParam = Number(url.searchParams.get("limit"));
      const items = listRecentHandoffs({
        limit: Number.isFinite(limitParam) ? limitParam : undefined
      });
      jsonResponse(res, 200, {
        ok: true,
        items,
        total: recentHandoffs.length
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/handoffs/next") {
      jsonResponse(res, 200, {
        ok: true,
        handoff: getNextQueuedHandoff()
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/handoffs") {
      const body = await readJsonBody(req);
      const validation = validatePluginLocalHandoffPayload(body);
      if (!validation.ok) {
        jsonResponse(res, 400, {
          ok: false,
          error: "Invalid handoff payload",
          details: validation.errors
        });
        return;
      }

      const entry = recordRecentHandoff(body);
      const pluginId =
        typeof entry.source?.pluginSessionId === "string" && entry.source.pluginSessionId.trim()
          ? entry.source.pluginSessionId.trim()
          : null;
      broadcastRuntimeEvent(
        "handoff.created",
        {
          pluginId,
          handoffId: entry.handoffId,
          summary: entry.intent?.summary || null,
          mode: entry.intent?.mode || null,
          targetCount: Array.isArray(entry.intent?.targets) ? entry.intent.targets.length : 0,
          handoff: entry
        },
        pluginId ? { pluginId } : {}
      );
      jsonResponse(res, 202, {
        ok: true,
        handoff: {
          handoffId: entry.handoffId,
          receivedAt: entry.receivedAt,
          status: entry.status,
          summary: entry.intent?.summary || null
        },
        queue: {
          queuedHandoffs: recentHandoffs.length
        }
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/handoffs/claim") {
      const body = await readJsonBody(req);
      const outcome = claimRecentHandoff(body.handoffId, {
        workerId: body.workerId,
        workerLabel: body.workerLabel
      });
      if (!outcome.ok) {
        jsonResponse(res, outcome.code === "HANDOFF_NOT_FOUND" ? 404 : 409, {
          ok: false,
          error: outcome.code,
          handoff: outcome.entry || null
        });
        return;
      }
      const pluginId =
        typeof outcome.entry.source?.pluginSessionId === "string" &&
        outcome.entry.source.pluginSessionId.trim()
          ? outcome.entry.source.pluginSessionId.trim()
          : null;
      broadcastRuntimeEvent(
        "handoff.claimed",
        {
          pluginId,
          handoffId: outcome.entry.handoffId,
          workerId: outcome.entry.claimedBy?.workerId || null,
          summary: outcome.entry.intent?.summary || null,
          handoff: outcome.entry
        },
        pluginId ? { pluginId } : {}
      );
      jsonResponse(res, 200, {
        ok: true,
        handoff: outcome.entry
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/handoffs/complete") {
      const body = await readJsonBody(req);
      const outcome = completeRecentHandoff(body.handoffId, {
        workerId: body.workerId,
        summary: body.summary,
        result: body.result
      });
      if (!outcome.ok) {
        jsonResponse(res, 404, {
          ok: false,
          error: outcome.code
        });
        return;
      }
      const pluginId =
        typeof outcome.entry.source?.pluginSessionId === "string" &&
        outcome.entry.source.pluginSessionId.trim()
          ? outcome.entry.source.pluginSessionId.trim()
          : null;
      broadcastRuntimeEvent(
        "handoff.completed",
        {
          pluginId,
          handoffId: outcome.entry.handoffId,
          workerId: outcome.entry.completion?.workerId || null,
          summary: outcome.entry.completion?.summary || outcome.entry.intent?.summary || null,
          result: outcome.entry.completion?.result || null,
          handoff: outcome.entry
        },
        pluginId ? { pluginId } : {}
      );
      jsonResponse(res, 200, {
        ok: true,
        handoff: outcome.entry
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/plugin/register") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const session = ensurePluginSession(pluginId);
      const now = Date.now();
      registerSession(session, body, now);
      const recovery = resolveRecoveryOutcome(pluginId, session, now);
      syncSessionStateAndBroadcast(pluginId, session, "register", now);
      broadcastRuntimeEvent(
        "session.registered",
        {
          pluginId,
          state: recovery.state,
          pageId: session.pageId,
          pageName: session.pageName,
          fileKey: session.fileKey,
          fileName: session.fileName
        },
        { pluginId }
      );
      maybeBroadcastHealthChanged("session_registered", now);
      jsonResponse(res, 200, {
        ok: true,
        pluginId,
        state: recovery.state,
        recovery
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/plugin/heartbeat") {
      const pluginId = url.searchParams.get("pluginId") || "default";
      const now = Date.now();
      pruneExpiredSessions(now);
      const session = pluginSessions.get(pluginId);
      const state = getSessionState(session, {
        now,
        activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
        retentionMs: SESSION_RETENTION_MS
      });
      if (session) {
        syncSessionStateAndBroadcast(pluginId, session, "heartbeat_check", now);
      }
      jsonResponse(res, 200, {
        ok: state !== SESSION_STATES.OFFLINE,
        pluginId,
        state,
        recovery: {
          pending: pendingRecoveryByPlugin.has(pluginId)
        }
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/plugin/heartbeat") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const session = ensurePluginSession(pluginId);
      const now = Date.now();
      markSessionHeartbeat(session, now);
      session.uiMetrics = normalizePluginUiMetrics(body.uiMetrics);
      const recovery = resolveRecoveryOutcome(pluginId, session, now);
      syncSessionStateAndBroadcast(pluginId, session, "heartbeat", now);
      broadcastRuntimeEvent(
        "session.heartbeat",
        {
          pluginId,
          state: recovery.state,
          pendingRecovery: recovery.pendingRecovery
        },
        { pluginId }
      );
      maybeBroadcastHealthChanged("session_heartbeat", now);
      jsonResponse(res, 200, {
        ok: true,
        pluginId,
        state: recovery.state,
        recovery
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/plugin/selection") {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      const session = ensurePluginSession(pluginId);
      const now = Date.now();
      markSessionHeartbeat(session, now);
      syncSessionStateAndBroadcast(pluginId, session, "selection_update", now);
      session.lastSelection = body.selection || [];
      broadcastRuntimeEvent(
        "selection.changed",
        {
          pluginId,
          selectionCount: Array.isArray(session.lastSelection)
            ? session.lastSelection.length
            : 0
        },
        { pluginId }
      );
      jsonResponse(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/plugin/commands") {
      const pluginId = url.searchParams.get("pluginId") || "default";
      const session = ensurePluginSession(pluginId);
      const now = Date.now();
      markSessionHeartbeat(session, now);
      const hasWsPluginClient = getWsPluginPickupClients(pluginId).length > 0;
      const sessionState = getSessionState(session, {
        now,
        activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
        retentionMs: SESSION_RETENTION_MS
      });
      const canDelayPollingFallback =
        hasWsPluginClient && sessionState === SESSION_STATES.LIVE;
      const pendingUndeliveredForPlugin = countPendingUndeliveredCommandsForPlugin(pluginId);
      const deferredByWsGuard = Array.from(pendingCommands.values()).filter(
        (command) =>
          command.pluginId === pluginId &&
          command.deliveredAt === null &&
          !isAwaitingWsPluginAck(command, now) &&
          shouldDelayPollingFallbackForWs(command, now, canDelayPollingFallback, {
            pendingUndeliveredForPlugin
          })
      );
      const deferredByFallbackClass = deferredByWsGuard.reduce((acc, command) => {
        const fallbackClass = resolvePollingFallbackClass(command.type);
        acc[fallbackClass] = (acc[fallbackClass] || 0) + 1;
        return acc;
      }, {});
      const deferredByTuningMode = deferredByWsGuard.reduce((acc, command) => {
        const adaptive = resolveAdaptivePollingFallbackMultiplier(command, now, {
          pendingUndeliveredForPlugin
        });
        acc[adaptive.tuningMode] = (acc[adaptive.tuningMode] || 0) + 1;
        return acc;
      }, {});
      if (deferredByWsGuard.length > 0) {
        runtimeCounters.transport.pollingDeferredByWsGuardTotal += deferredByWsGuard.length;
      }

      const commands = Array.from(pendingCommands.values())
        .filter(
          (command) =>
            command.pluginId === pluginId &&
            command.deliveredAt === null &&
            !isAwaitingWsPluginAck(command, now) &&
            !shouldDelayPollingFallbackForWs(command, now, canDelayPollingFallback, {
              pendingUndeliveredForPlugin
            })
        )
        .sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return a.createdAt - b.createdAt;
        });

      const readyCapLimit = Math.max(
        1,
        Number.isFinite(POLLING_FALLBACK_READY_MAX_DELIVER_PER_TICK)
          ? Math.floor(POLLING_FALLBACK_READY_MAX_DELIVER_PER_TICK)
          : 1
      );
      const activePlugins = getSessionSnapshots({ includeStale: false, now }).map(
        (snapshot) => snapshot.pluginId
      );
      const queueDiagnostics = getQueueDiagnostics(now);
      const commandReadiness = getCommandReadinessSnapshot({
        now,
        activePlugins,
        queueDiagnostics
      });
      const shouldBlockPollingByPolicy =
        POLLING_FALLBACK_MODE === "recovery_only" &&
        hasWsPluginClient &&
        canDelayPollingFallback &&
        commandReadiness.status === "ready" &&
        commands.length > 0;
      const policyBlockReason = shouldBlockPollingByPolicy
        ? "ready_streaming_guard"
        : null;
      const deferredByPolicyBlock = shouldBlockPollingByPolicy ? commands.length : 0;
      if (deferredByPolicyBlock > 0) {
        runtimeCounters.transport.pollingDeferredByPolicyBlockTotal += deferredByPolicyBlock;
      }
      const policyEligibleCommands = shouldBlockPollingByPolicy ? [] : commands;
      const shouldApplyReadyCap =
        hasWsPluginClient &&
        canDelayPollingFallback &&
        commandReadiness.status === "ready" &&
        policyEligibleCommands.length > readyCapLimit;
      const commandsToDeliver = shouldApplyReadyCap
        ? policyEligibleCommands.slice(0, readyCapLimit)
        : policyEligibleCommands;
      const deferredByReadyCap = shouldApplyReadyCap
        ? Math.max(0, policyEligibleCommands.length - commandsToDeliver.length)
        : 0;
      if (deferredByReadyCap > 0) {
        runtimeCounters.transport.pollingDeferredByReadyCapTotal += deferredByReadyCap;
      }

      for (const command of commandsToDeliver) {
        runtimeCounters.transport.pollingDeliveredTotal += 1;
        if (typeof command.wsDispatchedAt === "number") {
          runtimeCounters.transport.pollingFallbackAfterWsDispatchTotal += 1;
        }
        markCommandDelivered(command, now, "polling");
      }

      jsonResponse(res, 200, {
        ok: true,
        commands: commandsToDeliver,
        queue: {
          deliveredCount: commandsToDeliver.length,
          deferredByWsGuard: deferredByWsGuard.length,
          deferredByPolicyBlock,
          deferredByReadyCap,
          deferredByFallbackClass: deferredByFallbackClass,
          deferredByTuningMode: deferredByTuningMode,
          oldestDeferredByWsGuardMs: deferredByWsGuard.reduce((max, command) => {
            const ageMs = Math.max(0, now - command.createdAt);
            return Math.max(max, ageMs);
          }, 0),
          pollingFallbackPolicy: {
            mode: POLLING_FALLBACK_MODE,
            baseGraceMs: Math.max(100, WS_POLLING_FALLBACK_GRACE_MS),
            queuePressureThreshold: Math.max(
              1,
              Number.isFinite(WS_POLLING_FALLBACK_QUEUE_PRESSURE_THRESHOLD)
                ? WS_POLLING_FALLBACK_QUEUE_PRESSURE_THRESHOLD
                : 3
            ),
            nearTimeoutRatio: Number(
              (
                Number.isFinite(WS_POLLING_FALLBACK_NEAR_TIMEOUT_RATIO)
                  ? Math.min(0.95, Math.max(0.05, WS_POLLING_FALLBACK_NEAR_TIMEOUT_RATIO))
                  : 0.65
              ).toFixed(2)
            ),
            multipliers: {
              critical: resolvePollingFallbackMultiplier("get_selection"),
              interactive: resolvePollingFallbackMultiplier("list_text_nodes"),
              standard: resolvePollingFallbackMultiplier("search_nodes"),
              detail: resolvePollingFallbackMultiplier("get_node_details")
            }
          },
          readyFallbackCap: {
            applied: shouldApplyReadyCap,
            limit: readyCapLimit,
            status: commandReadiness.status
          },
          pollingFallbackMode: {
            mode: POLLING_FALLBACK_MODE,
            blocked: shouldBlockPollingByPolicy,
            reason: policyBlockReason
          },
          pendingUndelivered: Array.from(pendingCommands.values()).filter(
            (command) =>
              command.pluginId === pluginId && command.deliveredAt === null
          ).length,
          lifecycleSummary: buildCommandLifecycleSummary({ pluginId }),
          commandTimelineTail: buildCommandTimelineTail({ pluginId, limit: 5 }),
          observability: getRuntimeObservabilitySnapshot({ now }).queue
        }
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/plugin/results") {
      const body = await readJsonBody(req);
      const command = pendingCommands.get(body.commandId);
      const accepted = Boolean(command);
      if (command?.pluginId) {
        const session = ensurePluginSession(command.pluginId);
        const now = Date.now();
        markSessionHeartbeat(session, now);
        syncSessionStateAndBroadcast(command.pluginId, session, "command_result", now);
        resolveRecoveryOutcome(command.pluginId, session, now);
      }
      if (accepted) {
        completeCommand(body.commandId, body.result, body.error);
      }
      jsonResponse(res, 200, {
        ok: true,
        accepted,
        commandId:
          typeof body.commandId === "string" ? body.commandId : null,
        queue: getRuntimeObservabilitySnapshot().queue
      });
      return;
    }

    jsonResponse(res, 404, {
      ok: false,
      error: `Unknown route: ${req.method} ${url.pathname}`
    });
  } catch (error) {
    if (error instanceof BridgeRuntimeError) {
      const pluginId =
        error.details && typeof error.details.pluginId === "string"
          ? error.details.pluginId
          : null;
      jsonResponse(res, error.statusCode || 400, {
        ok: false,
        code: error.code,
        error: error.message,
        details: error.details || null,
        recovery:
          pluginId && pendingRecoveryByPlugin.has(pluginId)
            ? {
                pending: true,
                failures: pendingRecoveryByPlugin.get(pluginId).failures
              }
            : { pending: false },
        observability: getRuntimeObservabilitySnapshot().preflight
      });
      return;
    }

    jsonResponse(res, 400, {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
  });
});

httpServer.on("upgrade", (req, socket, head) => {
  let url;
  try {
    url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  } catch (error) {
    socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  if (url.pathname !== "/api/ws") {
    socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const upgrade = String(req.headers.upgrade || "").toLowerCase();
  const connectionHeader = String(req.headers.connection || "").toLowerCase();
  const wsKey = req.headers["sec-websocket-key"];
  const wsVersion = String(req.headers["sec-websocket-version"] || "");
  if (
    upgrade !== "websocket" ||
    !connectionHeader.includes("upgrade") ||
    typeof wsKey !== "string" ||
    wsVersion !== "13"
  ) {
    socket.write("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
    socket.destroy();
    return;
  }

  const accept = createHash("sha1")
    .update(`${wsKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`, "utf8")
    .digest("base64");

  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n"
    ].join("\r\n")
  );

  const pluginIdQuery = url.searchParams.get("pluginId");
  const pluginId =
    typeof pluginIdQuery === "string" && pluginIdQuery.trim()
      ? pluginIdQuery.trim()
      : null;
  const eventTypes = parseWsFilterList(
    url.searchParams.get("eventTypes") || url.searchParams.get("eventType")
  );
  const clientType = normalizeWsClientType(
    url.searchParams.get("clientType") || url.searchParams.get("role")
  );

  const clientId = `ws-${++wsClientSequence}`;
  const client = {
    id: clientId,
    socket,
    pluginId,
    clientType,
    eventTypes,
    incomingBuffer: Buffer.alloc(0)
  };
  wsClients.set(clientId, client);

  const cleanup = () => {
    removeWsClient(clientId);
  };
  socket.on("close", cleanup);
  socket.on("end", cleanup);
  socket.on("error", cleanup);
  socket.on("data", (chunk) => {
    const currentClient = wsClients.get(clientId);
    if (!currentClient) {
      return;
    }
    currentClient.incomingBuffer = Buffer.concat([currentClient.incomingBuffer, chunk]);
    while (true) {
      const frame = parseWsFrame(currentClient.incomingBuffer);
      if (!frame) {
        break;
      }
      currentClient.incomingBuffer = currentClient.incomingBuffer.slice(frame.bytesConsumed);

      if (frame.opcode === 0x8) {
        sendWsClientControlFrame(currentClient, 0x8, Buffer.alloc(0));
        socket.end();
        cleanup();
        return;
      }

      if (frame.opcode === 0x9) {
        sendWsClientControlFrame(currentClient, 0x0a, frame.payload);
        continue;
      }

      if (frame.opcode === 0x1) {
        if (frame.payload.length > Math.max(1024, WS_MAX_TEXT_PAYLOAD_BYTES)) {
          sendWsCommandEnvelope(
            currentClient,
            "ws.command.error",
            {
              requestId: null,
              command: null,
              code: "ERR_WS_PAYLOAD_TOO_LARGE",
              error: "WebSocket text payload exceeds server limit.",
              details: {
                maxBytes: Math.max(1024, WS_MAX_TEXT_PAYLOAD_BYTES),
                receivedBytes: frame.payload.length
              }
            },
            currentClient.pluginId || null
          );
          continue;
        }

        const textPayload = frame.payload.toString("utf8");
        void handleWsInboundTextFrame(currentClient, textPayload);
      }
    }
  });

  if (head && head.length > 0) {
    socket.emit("data", head);
  }

  const helloEnvelope = createRuntimeEventEnvelope(
    "ws.hello",
    {
      transport: "websocket",
      protocol: "xbridge.ws.v1",
      clientId,
      pluginId,
      clientType,
      mirroredEvents: ["health.changed", "session.*", "command.*"],
      readCommands: Array.from(WS_INBOUND_READ_COMMANDS.values()).sort(),
      now: new Date().toISOString()
    },
    pluginId
  );
  sendWsClientPayload(client, helloEnvelope);
  const healthEnvelope = createRuntimeEventEnvelope(
    "health.changed",
    {
      reason: "ws_connected",
      ...getHealthEventSnapshot(Date.now()),
      clientId
    },
    pluginId
  );
  sendWsClientPayload(client, healthEnvelope);
  if (clientType === "plugin" && pluginId) {
    dispatchPendingCommandsToPluginWs(pluginId, "ws_plugin_connected");
  }
});

function listenOnAvailablePort(server, ports) {
  return new Promise((resolve, reject) => {
    const queue = [...ports];

    const tryNext = () => {
      const port = queue.shift();
      if (typeof port === "undefined") {
        reject(new Error(`Unable to bind bridge to any allowed port: ${ports.join(", ")}`));
        return;
      }

      const onError = (error) => {
        server.off("listening", onListening);
        if (error && error.code === "EADDRINUSE") {
          tryNext();
          return;
        }
        reject(error);
      };

      const onListening = () => {
        server.off("error", onError);
        activeHttpPort = port;
        resolve(port);
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, "127.0.0.1");
    };

    tryNext();
  });
}

const toolDefinitions = buildToolDefinitions();

const stableRouteHandlers = createStableRouteHandlers({
  BRIDGE_PACKAGE_NAME,
  BRIDGE_VERSION,
  FIGMA_ACCOUNT_API_OPTIONS,
  SESSION_ACTIVE_WINDOW_MS,
  buildAiDesignerSnapshot,
  buildFileCommentsPlan,
  canWriteResponse,
  clampStaleLimit,
  executePluginCommand,
  getActiveHttpPort: () => activeHttpPort,
  getActiveSessionResolution,
  getCurrentUser,
  getDesignerAiConfig,
  getFileSummary,
  getHealthEventSnapshot,
  getOrCreateRequestSnapshotCacheEntry,
  getPrimaryLiveSessionSnapshot,
  getQueueDiagnostics,
  getRecentFailureSummary,
  getRuntimeFeatureFlagsSnapshot,
  getRuntimeObservabilitySnapshot,
  getRuntimeOpsSnapshot,
  getSessionSnapshots,
  getTransportCapabilitiesSnapshot,
  getTransportHealthSnapshot,
  jsonResponse,
  listFileComments,
  listProjectFiles,
  listTeamProjects,
  performGetComposeMetrics,
  pluginSessions
});

const stableRouteTable = createRouteTable(stableRouteHandlers);

const handleDesignerRoute = createDesignerRouteHandler({
  DESIGNER_COMPARE_REQUEST_TIMEOUT_MS,
  DESIGNER_IMPROVE_REQUEST_TIMEOUT_MS,
  applyDesignerModelConfig,
  applyDesignerModelPreset,
  attachDesignerKnowledgeReferences,
  buildAiDesignerSnapshot,
  buildCodexAugmentedSuggestionBundle,
  buildDesignerActionPreviewBundle,
  buildDesignerCodexAiPayload,
  buildDesignerCodexFallbackMeta,
  buildDesignerPipelineSnapshot,
  buildDesignerSuggestionBundle,
  buildImageLayoutQualityFailureSummary,
  buildPostApplyComparisonQualityVerification,
  classifyDesignerChatError,
  confirmDesignerActionCandidateCommand,
  createDesignerIntentEnvelope,
  discoverLocalDesignerProviders,
  executeDesignerCompareReferenceAndGeneratedRequest,
  executeDesignerDebugBridgeFailureRequest,
  executeDesignerGeneratedScreenFollowUpRequest,
  executeDesignerImageAnalysisOnlyRequest,
  executeDesignerImageScreenRequest,
  executeDesignerImproveGeneratedScreenRequest,
  executeDesignerInspectSelectionRequest,
  executeDesignerReadPlan,
  getDesignerAiConfig,
  getSelectionIdsFromFigmaContext,
  isGeneratedScreenFollowUpRequest,
  isImageToScreenRequest,
  jsonResponse,
  normalizeCodexCliStatus,
  previewDesignerActionCandidateCommand,
  readJsonBody,
  resolveActivePluginId,
  runCodexDesignerSuggestion,
  runDesignerActionCandidateCommand,
  runDesignerModelConnectionProbe,
  runDesignerReadCommand,
  tryExecuteDesignerFastPath,
  validateConfiguredLocalDesignerModel,
  withDesignerWorkflowTimeout
});

const handleToolCall = createHandleToolCall({
  FIGMA_ACCOUNT_API_OPTIONS,
  buildAddAnnotationPlan,
  buildAddComponentPropertyPlan,
  buildAnalyzeReferenceSelectionPlan,
  buildApplyStylePlan,
  buildBindVariablePlan,
  buildBulkAddAnnotationsPlan,
  buildBulkBindVariablesPlan,
  buildBulkCreateNodesPlan,
  buildComponentVariantDetailsPlan,
  buildCreateComponentPlan,
  buildCreateComponentSetPlan,
  buildCreateInstancePlan,
  buildCreateNodePlan,
  buildEditComponentPropertyPlan,
  buildExportNodePlan,
  buildFileComponentSearchPlan,
  buildFileSummaryPlan,
  buildGetAnnotationsPlan,
  buildImportLibraryComponentPlan,
  buildInstanceDetailsPlan,
  buildLibraryAssetSearchPlan,
  buildNodeDetailsPlan,
  buildProjectFilesPlan,
  buildReplayPlan,
  buildSearchInstancesPlan,
  buildSearchNodesPlan,
  buildSetComponentPropertiesPlan,
  buildSetVariantPropertiesPlan,
  buildSnapshotPlan,
  buildTeamProjectsPlan,
  deriveReferenceAnalysisDraft,
  executePluginCommand,
  executeSearchNodesWithRetry,
  exportDesignTokensArtifact,
  getCurrentUser,
  getFileSummary,
  listProjectFiles,
  listTeamProjects,
  normalizeAnnotationReadResult,
  parseSelectionMetadataTree,
  performAnalyzeSelectionToCompose,
  performBuildFinanceSummaryMock,
  performBuildLayout,
  performBuildScreenFromDesignSystem,
  performComposeScreenFromIntents,
  performDesignSystemSearch,
  performFindOrImportComponent,
  performGetComposeMetrics,
  performReuseOrCreateComponent,
  performValidateExternalComposeInput,
  pluginSessions,
  readMetadataFallbackForDetail,
  resolveBulkBindVariablesTimeoutMs,
  resolveTargetNodeId,
  searchFileComponents,
  searchLibraryAssets,
  serializePluginSession,
  withSessionDefaultParent
});

function writeMessage(message) {
  const body = JSON.stringify(message);
  process.stdout.write(
    `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`
  );
}

function parseHeaders(headerText) {
  const headers = {};
  for (const line of headerText.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }
  return headers;
}

let buffer = Buffer.alloc(0);

async function handleMessage(message) {
  if (message.method === "initialize") {
    writeMessage({
      jsonrpc: "2.0",
      id: message.id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: {
          name: BRIDGE_PACKAGE_NAME,
          version: BRIDGE_VERSION
        }
      }
    });
    return;
  }

  if (message.method === "notifications/initialized") {
    return;
  }

  if (message.method === "tools/list") {
    writeMessage({
      jsonrpc: "2.0",
      id: message.id,
      result: { tools: toolDefinitions }
    });
    return;
  }

  if (message.method === "tools/call") {
    try {
      const result = await requestContext.run(
        {
          source: "user_tool",
          toolName: message.params?.name || null
        },
        () =>
          handleToolCall(
            message.params.name,
            message.params.arguments || {}
          )
      );

      writeMessage({
        jsonrpc: "2.0",
        id: message.id,
        result
      });
    } catch (error) {
      const runtimeCode =
        error instanceof BridgeRuntimeError && typeof error.code === "string"
          ? error.code
          : null;
      writeMessage({
        jsonrpc: "2.0",
        id: message.id,
        error: {
          code: -32000,
          message: error instanceof Error ? error.message : String(error),
          data: runtimeCode ? { code: runtimeCode } : undefined
        }
      });
    }
    return;
  }

  writeMessage({
    jsonrpc: "2.0",
    id: message.id,
    error: {
      code: -32601,
      message: `Unsupported method: ${message.method}`
    }
  });
}

process.stdin.on("data", async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }

    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const headers = parseHeaders(headerText);
    const contentLength = Number(headers["content-length"] || 0);
    const totalLength = headerEnd + 4 + contentLength;

    if (buffer.length < totalLength) {
      return;
    }

    const body = buffer
      .slice(headerEnd + 4, totalLength)
      .toString("utf8");
    buffer = buffer.slice(totalLength);

    let message;
    try {
      message = JSON.parse(body);
    } catch (error) {
      writeMessage({
        jsonrpc: "2.0",
        id: null,
        error: {
          code: -32700,
          message: "Invalid JSON received"
        }
      });
      continue;
    }

    await handleMessage(message);
  }
});

listenOnAvailablePort(httpServer, CANDIDATE_PORTS)
  .then((port) => {
    process.stderr.write(`[writable-mcp-bridge] listening on http://127.0.0.1:${port}\n`);
  })
  .catch((error) => {
    process.stderr.write(
      `[writable-mcp-bridge] failed to bind local HTTP bridge: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });

process.stdin.resume();
