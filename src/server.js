import http from "node:http";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import {
  buildApplyStylePlan,
  listSupportedApplyStyleTypes
} from "./apply-style.js";
import {
  buildAddComponentPropertyPlan,
  listSupportedComponentPropertyTypes
} from "./add-component-property.js";
import {
  buildBulkAddAnnotationsPlan,
  buildAddAnnotationPlan,
  listSupportedAnnotationPropertyTypes
} from "./add-annotation.js";
import {
  buildBindVariablePlan,
  listSupportedBindVariableFields
} from "./bind-variable.js";
import {
  buildCreateComponentPlan,
  listSupportedCreateComponentSourceTypes
} from "./create-component.js";
import { buildCreateComponentSetPlan } from "./create-component-set.js";
import { buildCreateInstancePlan } from "./create-instance.js";
import {
  buildBulkCreateNodesPlan,
  buildCreateNodePlan,
  listSupportedCreateNodeTypes
} from "./create-node.js";
import { buildFileComponentSearchPlan, searchFileComponents } from "./file-components.js";
import {
  buildFindOrImportComponentPlan,
  selectPreferredComponentMatch
} from "./find-or-import-component.js";
import {
  buildImportLibraryComponentPlan,
  listSupportedImportLibraryAssetTypes
} from "./import-library-component.js";
import {
  buildDesignSystemSearchPlan,
  mergeDesignSystemSearchResults
} from "./design-system-search.js";
import { buildEditComponentPropertyPlan } from "./edit-component-property.js";
import {
  buildExportNodePlan,
  listSupportedExportFormats
} from "./export-node.js";
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
import { parseSelectionMetadataTree } from "./metadata-tree.js";
import {
  buildFileSummaryPlan,
  buildProjectFilesPlan,
  buildTeamProjectsPlan,
  getCurrentUser,
  getFileSummary,
  listProjectFiles,
  listTeamProjects
} from "./figma-account.js";
import {
  BridgeRuntimeError,
  SESSION_STATES,
  createSession,
  getSessionState,
  markSessionHeartbeat,
  preflightPluginCommand,
  registerSession,
  toSessionSnapshot
} from "./runtime-session-state.js";
import {
  buildCommandDedupeKey,
  canSafelyCancelStalePendingCommand,
  canSafelyDedupeCommand,
  resolveCommandPriority
} from "./command-queue-policy.js";

const DEFAULT_PORT = 3846;
const REQUESTED_PORT = process.env.PORT ? Number(process.env.PORT) : null;
const CANDIDATE_PORTS = [REQUESTED_PORT || DEFAULT_PORT];
const TOOL_TIMEOUT_MS = Number(process.env.TOOL_TIMEOUT_MS || 30000);
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
const RECENT_FAILURE_HISTORY_LIMIT = Number(
  process.env.RECENT_FAILURE_HISTORY_LIMIT || 200
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
const recentCommandFailures = [];
const recentRuntimeEvents = [];
const sseClients = new Map();
const wsClients = new Map();
const sessionStateByPlugin = new Map();
let sseClientSequence = 0;
let wsClientSequence = 0;
let runtimeEventSequence = 0;
let lastHealthEventSignature = null;
const WS_COMMAND_MIRROR_RETRY_DELAY_MS = Number(
  process.env.WS_COMMAND_MIRROR_RETRY_DELAY_MS || 160
);
const WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS = Number(
  process.env.WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS || 1200
);
const WS_MAX_TEXT_PAYLOAD_BYTES = Number(
  process.env.WS_MAX_TEXT_PAYLOAD_BYTES || 65536
);
const WS_INBOUND_READ_COMMANDS = new Set([
  "ping",
  "get_selection",
  "get_metadata",
  "get_node_details",
  "get_component_variant_details",
  "get_instance_details"
]);
const requestContext = new AsyncLocalStorage();
const pendingRecoveryByPlugin = new Map();
const runtimeCounters = {
  queue: {
    enqueuedTotal: 0,
    dedupedTotal: 0,
    canceledStaleTotal: 0,
    canceledStaleByType: {},
    deliveredTotal: 0,
    completedTotal: 0,
    failedTotal: 0,
    expiredTotal: 0
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

  return {
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
  return {
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
        await executePluginCommand(pluginId, "bind_variable", {
          nodeId: node.id,
          property: "fills.color",
          variableId: item.textColorVariableId,
          variableKey: item.textColorVariableKey
        });
      }
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
      ...placement
    });

    const frameId = frameResult?.created?.id;
    if (!frameId) {
      throw new Error(`Failed to create layout frame: ${node.name}`);
    }

    const layoutMode = node.layout === "row" ? "HORIZONTAL" : "VERTICAL";
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
          node.children.length
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

  return {
    plan,
    root
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

function pruneExpiredSessions(now = Date.now()) {
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
  maybeBroadcastHealthChanged("session_prune", now);
}

function getSessionSnapshots({ includeStale = false, now = Date.now() } = {}) {
  pruneExpiredSessions(now);
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
    const aSeen = typeof a.lastSeenAt === "number" ? a.lastSeenAt : 0;
    const bSeen = typeof b.lastSeenAt === "number" ? b.lastSeenAt : 0;
    return bSeen - aSeen;
  });
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

  if (pluginSessions.has("default")) {
    return "default";
  }

  const activePluginIds = Array.from(pluginSessions.values())
    .filter((session) =>
      getSessionState(session, {
        now,
        activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
        retentionMs: SESSION_RETENTION_MS
      }) === SESSION_STATES.LIVE
    )
    .map((session) => session.pluginId);
  if (activePluginIds.length === 1) {
    return activePluginIds[0];
  }

  if (activePluginIds.length > 1) {
    throw new Error(
      `Multiple active plugin sessions: ${activePluginIds.join(", ")}. Specify pluginId explicitly.`
    );
  }

  return normalized;
}

function jsonResponse(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
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
  return now - command.wsDispatchedAt < Math.max(100, WS_PLUGIN_PICKUP_ACK_TIMEOUT_MS);
}

function markCommandDelivered(command, deliveredAt = Date.now(), reason = "unknown") {
  if (!command || command.deliveredAt !== null) {
    return false;
  }

  command.deliveredAt = deliveredAt;
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
    return;
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
    return;
  }

  for (const command of pending) {
    const targetClient = clients[0];
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
      removeWsClient(targetClient.id);
      return;
    }
    command.wsDispatchedAt = now;
    command.wsDispatchClientId = targetClient.id;
    broadcastQueueUpdated("command_ws_dispatched", command.pluginId);
  }
}

function shouldMirrorRuntimeEventToWs(eventType) {
  return (
    eventType === "health.changed" ||
    eventType.startsWith("session.") ||
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

  let request;
  try {
    request = normalizeWsCommandRequest(message);
  } catch (error) {
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

  let pluginId;
  try {
    pluginId = resolveWsPluginId(client, request.pluginId);
  } catch (error) {
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
  } catch (error) {
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

function getHealthEventSnapshot(now = Date.now()) {
  const activePlugins = [];
  for (const session of pluginSessions.values()) {
    const state = getSessionState(session, {
      now,
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      retentionMs: SESSION_RETENTION_MS
    });
    if (state === SESSION_STATES.LIVE) {
      activePlugins.push(session.pluginId);
    }
  }
  activePlugins.sort();

  const failureSummary = getRecentFailureSummary(now);
  return {
    currentReadHealth: failureSummary.currentReadHealth,
    recentFailedTotal: failureSummary.recentFailedTotal,
    activePluginCount: activePlugins.length,
    activePlugins
  };
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
  const metadata = await executePluginCommand(pluginId, "get_metadata", {
    targetNodeId: plan.targetNodeId,
    maxDepth: plan.includeChildren ? plan.maxDepth : 0,
    maxNodes: plan.maxNodes,
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
    maxDepth: plan.maxDepth,
    maxNodes: plan.maxNodes,
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

function trimRecentFailures(now = Date.now()) {
  const cutoff = now - Math.max(0, RECENT_FAILURE_WINDOW_MS);
  while (
    recentCommandFailures.length > 0 &&
    recentCommandFailures[0].at < cutoff
  ) {
    recentCommandFailures.shift();
  }
  while (recentCommandFailures.length > Math.max(1, RECENT_FAILURE_HISTORY_LIMIT)) {
    recentCommandFailures.shift();
  }
}

function classifyReadHealth(recentFailedTotal) {
  if (recentFailedTotal <= 0) {
    return "healthy";
  }
  if (recentFailedTotal <= 2) {
    return "degraded";
  }
  return "unhealthy";
}

function getFailureCode(error) {
  if (error instanceof BridgeRuntimeError && typeof error.code === "string") {
    return error.code;
  }
  return "ERR_COMMAND_FAILED";
}

function recordCommandFailure(command, error, now = Date.now()) {
  recentCommandFailures.push({
    at: now,
    commandId: command?.commandId || null,
    pluginId: command?.pluginId || null,
    type: command?.type || null,
    source: command?.source || null,
    code: getFailureCode(error),
    message: error instanceof Error ? error.message : String(error)
  });
  trimRecentFailures(now);
}

function getRecentFailureSummary(now = Date.now()) {
  trimRecentFailures(now);
  const recentFailedTotal = recentCommandFailures.length;
  const lastFailure =
    recentFailedTotal > 0 ? recentCommandFailures[recentFailedTotal - 1] : null;
  return {
    recentFailedTotal,
    lastFailureAt: lastFailure ? lastFailure.at : null,
    lastFailureCommand: lastFailure
      ? {
          commandId: lastFailure.commandId,
          pluginId: lastFailure.pluginId,
          type: lastFailure.type,
          source: lastFailure.source,
          code: lastFailure.code,
          message: lastFailure.message
        }
      : null,
    currentReadHealth: classifyReadHealth(recentFailedTotal),
    recentFailureWindowMs: Math.max(0, RECENT_FAILURE_WINDOW_MS)
  };
}

function getRequestContext() {
  return requestContext.getStore() || {};
}

function getRuntimeObservabilitySnapshot() {
  const failureSummary = getRecentFailureSummary(Date.now());
  return {
    transport: {
      sseClients: sseClients.size,
      wsClients: wsClients.size,
      recentRuntimeEventTotal: recentRuntimeEvents.length
    },
    queue: {
      ...runtimeCounters.queue,
      historicalFailedTotal: runtimeCounters.queue.failedTotal,
      pendingCommands: pendingCommands.size,
      pendingResults: pendingResults.size,
      recentFailedTotal: failureSummary.recentFailedTotal,
      lastFailureAt: failureSummary.lastFailureAt,
      lastFailureCommand: failureSummary.lastFailureCommand,
      currentReadHealth: failureSummary.currentReadHealth,
      recentFailureWindowMs: failureSummary.recentFailureWindowMs
    },
    preflight: {
      ...runtimeCounters.preflight,
      recovery: {
        ...runtimeCounters.preflight.recovery,
        pendingTotal: pendingRecoveryByPlugin.size
      }
    },
    sessions: {
      ...runtimeCounters.sessions,
      trackedTotal: pluginSessions.size
    }
  };
}

function getPendingCommandAgeBuckets(now = Date.now()) {
  const buckets = {
    lt250ms: 0,
    ms250to1000: 0,
    ms1000to5000: 0,
    gte5000ms: 0
  };

  for (const command of pendingCommands.values()) {
    const ageMs = Math.max(0, now - command.createdAt);
    if (ageMs < 250) {
      buckets.lt250ms += 1;
      continue;
    }
    if (ageMs < 1000) {
      buckets.ms250to1000 += 1;
      continue;
    }
    if (ageMs < 5000) {
      buckets.ms1000to5000 += 1;
      continue;
    }
    buckets.gte5000ms += 1;
  }

  return buckets;
}

function getQueueDiagnostics(now = Date.now()) {
  const byPlugin = {};
  let oldestPendingMs = 0;
  let oldestUndeliveredMs = 0;

  for (const command of pendingCommands.values()) {
    const ageMs = Math.max(0, now - command.createdAt);
    oldestPendingMs = Math.max(oldestPendingMs, ageMs);
    if (command.deliveredAt === null) {
      oldestUndeliveredMs = Math.max(oldestUndeliveredMs, ageMs);
    }

    if (!byPlugin[command.pluginId]) {
      byPlugin[command.pluginId] = {
        pendingTotal: 0,
        undeliveredTotal: 0,
        oldestPendingMs: 0
      };
    }
    byPlugin[command.pluginId].pendingTotal += 1;
    byPlugin[command.pluginId].oldestPendingMs = Math.max(
      byPlugin[command.pluginId].oldestPendingMs,
      ageMs
    );
    if (command.deliveredAt === null) {
      byPlugin[command.pluginId].undeliveredTotal += 1;
    }
  }

  return {
    pendingTotal: pendingCommands.size,
    pendingResultsTotal: pendingResults.size,
    oldestPendingMs,
    oldestUndeliveredMs,
    ageBuckets: getPendingCommandAgeBuckets(now),
    byPlugin
  };
}

function getSessionDiagnostics({ now = Date.now(), staleLimit = 8 } = {}) {
  const snapshots = getSessionSnapshots({ includeStale: true, now });
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
    staleSessions,
    pendingRecovery
  };
}

function getRuntimeOpsSnapshot({ now = Date.now(), staleLimit = 8 } = {}) {
  const failureSummary = getRecentFailureSummary(now);
  return {
    now,
    config: {
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      retentionMs: SESSION_RETENTION_MS,
      pruneIntervalMs: SESSION_PRUNE_INTERVAL_MS,
      commandTimeoutMs: TOOL_TIMEOUT_MS
    },
    currentReadHealth: failureSummary.currentReadHealth,
    failures: {
      recentFailedTotal: failureSummary.recentFailedTotal,
      historicalFailedTotal: runtimeCounters.queue.failedTotal,
      lastFailureAt: failureSummary.lastFailureAt,
      lastFailureCommand: failureSummary.lastFailureCommand,
      recentFailureWindowMs: failureSummary.recentFailureWindowMs
    },
    sessions: getSessionDiagnostics({ now, staleLimit }),
    queue: getQueueDiagnostics(now),
    observability: getRuntimeObservabilitySnapshot()
  };
}

function clampStaleLimit(rawValue) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) {
    return 8;
  }
  return Math.max(1, Math.min(20, Math.floor(parsed)));
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

function createPendingCommand(pluginId, type, payload, options = {}) {
  const now = Date.now();
  const context = options.context || getRequestContext();
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
    createdAt: now,
    deliveredAt: null
  };

  pendingCommands.set(commandId, command);
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
  const { command } = createPendingCommand(resolvedPluginId, type, payload, options);

  return withTimeout(
    waitForResult(command.commandId),
    TOOL_TIMEOUT_MS,
    `Timed out waiting for plugin response: ${type}`
  );
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
    if (now - command.createdAt > TOOL_TIMEOUT_MS) {
      runtimeCounters.queue.expiredTotal += 1;
      completeCommand(commandId, null, {
        code: "ERR_COMMAND_EXPIRED",
        message: `Command expired: ${command.type}`,
        statusCode: 504,
        details: {
          commandId,
          pluginId: command.pluginId,
          type: command.type
        }
      });
    }
  }
}

setInterval(cleanupExpiredCommands, 5000).unref();

function getHttpRequestContext(req, url) {
  if (url.pathname.startsWith("/api/")) {
    return {
      source: "user_http",
      endpoint: url.pathname
    };
  }
  return {
    source: "system_http",
    endpoint: url.pathname
  };
}

const httpServer = http.createServer((req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  requestContext.run(getHttpRequestContext(req, url), async () => {
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

    if (req.method === "GET" && url.pathname === "/health") {
      const now = Date.now();
      const activePlugins = getSessionSnapshots({ includeStale: false, now }).map(
        (session) => session.pluginId
      );
      const failureSummary = getRecentFailureSummary(now);
      jsonResponse(res, 200, {
        ok: true,
        server: "writable-mcp-bridge",
        port: activeHttpPort,
        activePlugins,
        currentReadHealth: failureSummary.currentReadHealth,
        recentFailedTotal: failureSummary.recentFailedTotal,
        lastFailureAt: failureSummary.lastFailureAt,
        lastFailureCommand: failureSummary.lastFailureCommand,
        observability: getRuntimeObservabilitySnapshot()
      });
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
          targetNodeId: body.targetNodeId,
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
          fillColor: body.fillColor,
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
          fillColor: body.fillColor,
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

    if (req.method === "GET" && url.pathname === "/api/sessions") {
      const includeStale = url.searchParams.get("includeStale") === "true";
      const now = Date.now();
      const sessions = getSessionSnapshots({ includeStale, now });
      jsonResponse(res, 200, {
        ok: true,
        sessions,
        includeStale,
        now,
        activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
        observability: getRuntimeObservabilitySnapshot()
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/compose-metrics") {
      const result = performGetComposeMetrics();
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/runtime-ops") {
      const staleLimit = clampStaleLimit(url.searchParams.get("staleLimit"));
      const result = getRuntimeOpsSnapshot({
        now: Date.now(),
        staleLimit
      });
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/pages") {
      const pluginIdParam = url.searchParams.get("pluginId");
      const pluginId =
        typeof pluginIdParam === "string" && pluginIdParam.trim()
          ? pluginIdParam.trim()
          : "default";
      let connectionClosed = false;
      const markClosed = () => {
        connectionClosed = true;
      };

      req.once("close", markClosed);
      res.once("close", markClosed);
      res.once("error", markClosed);
      try {
        const result = await executePluginCommand(pluginId, "list_pages");
        if (connectionClosed || !canWriteResponse(res)) {
          return;
        }
        jsonResponse(res, 200, { ok: true, result });
      } catch (error) {
        if (connectionClosed || !canWriteResponse(res)) {
          return;
        }
        throw error;
      } finally {
        req.off("close", markClosed);
        res.off("close", markClosed);
        res.off("error", markClosed);
      }
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/figma/me") {
      const result = await getCurrentUser(FIGMA_ACCOUNT_API_OPTIONS);
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/figma/team-projects") {
      const result = await listTeamProjects(
        {
          teamId: url.searchParams.get("teamId"),
          query: url.searchParams.get("query"),
          maxResults: url.searchParams.get("maxResults")
            ? Number(url.searchParams.get("maxResults"))
            : undefined
        },
        FIGMA_ACCOUNT_API_OPTIONS
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/figma/project-files") {
      const result = await listProjectFiles(
        {
          projectId: url.searchParams.get("projectId"),
          query: url.searchParams.get("query"),
          maxResults: url.searchParams.get("maxResults")
            ? Number(url.searchParams.get("maxResults"))
            : undefined,
          branchData: url.searchParams.get("branchData") === "true"
        },
        FIGMA_ACCOUNT_API_OPTIONS
      );
      jsonResponse(res, 200, { ok: true, result });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/figma/file-summary") {
      const result = await getFileSummary(
        {
          fileKey: url.searchParams.get("fileKey")
        },
        FIGMA_ACCOUNT_API_OPTIONS
      );
      jsonResponse(res, 200, { ok: true, result });
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

      const commands = Array.from(pendingCommands.values())
        .filter(
          (command) =>
            command.pluginId === pluginId &&
            command.deliveredAt === null &&
            !isAwaitingWsPluginAck(command, now)
        )
        .sort((a, b) => {
          if (b.priority !== a.priority) {
            return b.priority - a.priority;
          }
          return a.createdAt - b.createdAt;
        });

      for (const command of commands) {
        markCommandDelivered(command, now, "polling");
      }

      jsonResponse(res, 200, {
        ok: true,
        commands,
        queue: {
          deliveredCount: commands.length,
          pendingUndelivered: Array.from(pendingCommands.values()).filter(
            (command) =>
              command.pluginId === pluginId && command.deliveredAt === null
          ).length,
          observability: getRuntimeObservabilitySnapshot().queue
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

const toolDefinitions = [
  {
    name: "get_active_plugins",
    description: "List the registered Figma plugin bridge sessions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "get_selection",
    description: "Read the current Figma selection for a plugin session.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" }
      },
      additionalProperties: false
    }
  },
  {
    name: "list_pages",
    description: "List pages in the current Figma file for a plugin session.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_figma_account_profile",
    description: "Read the current Figma account profile via REST using FIGMA_ACCESS_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "list_team_projects",
    description: "List projects for a known Figma team id via REST. Requires FIGMA_ACCESS_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string" },
        query: { type: "string" },
        maxResults: { type: "number" }
      },
      required: ["teamId"],
      additionalProperties: false
    }
  },
  {
    name: "list_project_files",
    description: "List files for a known Figma project id via REST. Requires FIGMA_ACCESS_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        query: { type: "string" },
        maxResults: { type: "number" },
        branchData: { type: "boolean" }
      },
      required: ["projectId"],
      additionalProperties: false
    }
  },
  {
    name: "get_file_summary",
    description: "Read summary metadata for a Figma file key via REST. Requires FIGMA_ACCESS_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" }
      },
      required: ["fileKey"],
      additionalProperties: false
    }
  },
  {
    name: "get_metadata",
    description: "Return a sparse XML outline of the current selection, explicit target node, or current page when nothing is selected.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        nodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" },
        includeJson: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_annotations",
    description: "Return node-scoped annotation data and inferred comment text for implementation inspection.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        includeInferredComments: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_node_details",
    description: "Return implementation-grade node details including layout semantics, optional children, and variant/component linkage.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        nodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" },
        includeChildren: { type: "boolean" },
        detailLevel: { type: "string", enum: ["light", "layout", "full"] }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_component_variant_details",
    description: "Return component set/variant details including per-variant layout and visible children.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        nodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" },
        includeChildren: { type: "boolean" },
        detailLevel: { type: "string", enum: ["light", "layout", "full"] }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_instance_details",
    description: "Return instance details, source component linkage, overrides, and optional resolved children.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        nodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" },
        includeChildren: { type: "boolean" },
        includeResolvedChildren: { type: "boolean" },
        detailLevel: { type: "string", enum: ["light", "layout", "full"] }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_variable_defs",
    description: "Return variables and styles used by the current selection, explicit target node, or current page when nothing is selected.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        nodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" }
      },
      additionalProperties: false
    }
  },
  {
    name: "list_text_nodes",
    description: "List text nodes under the current selection, a specific node, or the current page when nothing is selected.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        scope: { type: "string", enum: ["auto", "current-page", "selection", "target"] }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_nodes",
    description: "Search descendants of the current selection, a specific root, or the current page when nothing is selected using lightweight metadata. Use scope to force current-page, selection, or target behavior.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        scope: { type: "string", enum: ["auto", "current-page", "selection", "target"] },
        query: { type: "string" },
        nodeTypes: {
          type: "array",
          items: { type: "string" }
        },
        maxDepth: { type: "number" },
        maxResults: { type: "number" },
        includeText: { type: "boolean" },
        detailLevel: { type: "string", enum: ["light", "layout", "full"] }
      },
      additionalProperties: false
    }
  },
  {
    name: "snapshot_selection",
    description: "Serialize the currently selected source subtree into a bounded snapshot that can be replayed in another file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        maxDepth: { type: "number" },
        maxNodes: { type: "number" },
        placeholderInstances: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "export_node",
    description: "Export a selected or explicit target node as svg or png.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        format: {
          type: "string",
          enum: listSupportedExportFormats()
        },
        scale: { type: "number" },
        contentsOnly: { type: "boolean" },
        useAbsoluteBounds: { type: "boolean" },
        svgOutlineText: { type: "boolean" },
        svgIdAttribute: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "analyze_reference_selection",
    description: "Analyze the current reference selection into a typed section draft that can seed build_screen_from_design_system.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        includeExport: { type: "boolean" },
        includeSvg: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "add_annotation",
    description: "Add, replace, or clear Dev Mode annotations on a selected or explicit target node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        label: { type: "string" },
        labelMarkdown: { type: "string" },
        categoryId: { type: "string" },
        properties: {
          type: "array",
          items: {
            type: "string",
            enum: listSupportedAnnotationPropertyTypes()
          }
        },
        replace: { type: "boolean" },
        clear: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "bulk_add_annotations",
    description: "Add annotations to multiple nodes in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        annotations: {
          type: "array",
          items: {
            type: "object",
            properties: {
              targetNodeId: { type: "string" },
              label: { type: "string" },
              labelMarkdown: { type: "string" },
              categoryId: { type: "string" },
              properties: {
                type: "array",
                items: {
                  type: "string",
                  enum: listSupportedAnnotationPropertyTypes()
                }
              },
              replace: { type: "boolean" },
              clear: { type: "boolean" }
            },
            additionalProperties: false
          }
        }
      },
      required: ["annotations"],
      additionalProperties: false
    }
  },
  {
    name: "search_design_system",
    description: "Search the current file's local components, styles, and variables, and optionally merge in external library/file matches.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        query: { type: "string" },
        maxResults: { type: "number" },
        kinds: {
          type: "array",
          items: {
            type: "string",
            enum: ["components", "styles", "variables"]
          }
        },
        sources: {
          type: "array",
          items: {
            type: "string",
            enum: ["local-file", "library-files", "all"]
          }
        },
        includeComponents: { type: "boolean" },
        includeStyles: { type: "boolean" },
        includeVariables: { type: "boolean" },
        fileKeys: {
          type: "array",
          items: { type: "string" }
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_instances",
    description: "Search instance nodes under an explicit target, the current selection, or the current page.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        query: { type: "string" },
        maxDepth: { type: "number" },
        maxResults: { type: "number" },
        includeProperties: { type: "boolean" }
      },
      additionalProperties: false
    }
  },
  {
    name: "search_library_assets",
    description: "Search published library components, component sets, and styles in a Figma library file via the REST API.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" },
        query: { type: "string" },
        assetTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["COMPONENT", "COMPONENT_SET", "STYLE"]
          }
        },
        maxResults: { type: "number" }
      },
      required: ["fileKey"],
      additionalProperties: false
    }
  },
  {
    name: "recreate_snapshot",
    description: "Recreate a previously captured snapshot under a target parent in the connected file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetParentId: { type: "string" },
        snapshot: { type: "object" }
      },
      required: ["targetParentId", "snapshot"],
      additionalProperties: false
    }
  },
  {
    name: "search_file_components",
    description: "Search component metadata exposed by a Figma file response, useful for Community files that are not published as libraries.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" },
        query: { type: "string" },
        maxResults: { type: "number" }
      },
      required: ["fileKey"],
      additionalProperties: false
    }
  },
  {
    name: "list_component_properties",
    description: "Inspect component properties for a selected or explicit target node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "update_text",
    description: "Update a single text node's characters in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        text: { type: "string" }
      },
      required: ["nodeId", "text"],
      additionalProperties: false
    }
  },
  {
    name: "set_component_property",
    description: "Set one component property value on an instance node in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        propertyName: { type: "string" },
        value: {
          oneOf: [{ type: "string" }, { type: "boolean" }]
        }
      },
      required: ["nodeId", "propertyName", "value"],
      additionalProperties: false
    }
  },
  {
    name: "set_component_properties",
    description: "Set multiple component property values on an instance node in one atomic update.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        properties: {
          type: "object",
          additionalProperties: {
            oneOf: [{ type: "string" }, { type: "boolean" }]
          }
        }
      },
      required: ["nodeId", "properties"],
      additionalProperties: false
    }
  },
  {
    name: "add_component_property",
    description: "Add a component property to a local component or component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        propertyName: { type: "string" },
        propertyType: {
          type: "string",
          enum: listSupportedComponentPropertyTypes()
        },
        defaultValue: {
          oneOf: [{ type: "string" }, { type: "boolean" }]
        }
      },
      required: ["targetNodeId", "propertyName", "propertyType", "defaultValue"],
      additionalProperties: false
    }
  },
  {
    name: "edit_component_property",
    description: "Rename or update the default value of a component property on a local component or component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        propertyName: { type: "string" },
        name: { type: "string" },
        defaultValue: {
          oneOf: [{ type: "string" }, { type: "boolean" }]
        }
      },
      required: ["targetNodeId", "propertyName"],
      additionalProperties: false
    }
  },
  {
    name: "set_variant_properties",
    description: "Set variant property values on a component that belongs to a local component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        componentNodeId: { type: "string" },
        variantProperties: {
          type: "object",
          additionalProperties: { type: "string" }
        }
      },
      required: ["componentNodeId", "variantProperties"],
      additionalProperties: false
    }
  },
  {
    name: "bind_variable",
    description: "Bind or unbind a Figma variable to a supported property on a node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        property: {
          type: "string",
          enum: listSupportedBindVariableFields()
        },
        variableId: { type: "string" },
        variableKey: { type: "string" },
        unbind: { type: "boolean" }
      },
      required: ["nodeId", "property"],
      additionalProperties: false
    }
  },
  {
    name: "apply_style",
    description: "Apply or clear a supported shared style on a node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        styleType: {
          type: "string",
          enum: listSupportedApplyStyleTypes()
        },
        styleId: { type: "string" },
        styleKey: { type: "string" },
        clear: { type: "boolean" }
      },
      required: ["nodeId", "styleType"],
      additionalProperties: false
    }
  },
  {
    name: "create_component",
    description: "Promote an existing node in the current file into a local component.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        supportedSourceTypes: {
          type: "array",
          items: {
            type: "string",
            enum: listSupportedCreateComponentSourceTypes()
          }
        }
      },
      required: ["targetNodeId"],
      additionalProperties: false
    }
  },
  {
    name: "create_component_set",
    description: "Combine existing local components into a component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        componentNodeIds: {
          type: "array",
          items: { type: "string" }
        },
        parentId: { type: "string" },
        index: { type: "number" },
        name: { type: "string" },
        description: { type: "string" }
      },
      required: ["componentNodeIds"],
      additionalProperties: false
    }
  },
  {
    name: "preview_changes",
    description: "Preview one or more node updates without mutating the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        target: { type: "string", enum: ["self", "parent"] },
        visible: { type: "boolean" },
        fillColor: { type: "string" },
        cornerRadius: { type: "number" },
        opacity: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        layoutMode: {
          type: "string",
          enum: ["NONE", "HORIZONTAL", "VERTICAL"]
        },
        itemSpacing: { type: "number" },
        paddingLeft: { type: "number" },
        paddingRight: { type: "number" },
        paddingTop: { type: "number" },
        paddingBottom: { type: "number" },
        primaryAxisAlignItems: {
          type: "string",
          enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
        },
        counterAxisAlignItems: {
          type: "string",
          enum: ["MIN", "MAX", "CENTER", "BASELINE"]
        },
        primaryAxisSizingMode: {
          type: "string",
          enum: ["FIXED", "AUTO"]
        },
        counterAxisSizingMode: {
          type: "string",
          enum: ["FIXED", "AUTO"]
        },
        layoutGrow: { type: "number" },
        layoutAlign: {
          type: "string",
          enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
        },
        characters: { type: "string" },
        fontFamily: { type: "string" },
        fontStyle: { type: "string" },
        fontSize: { type: "number" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              target: { type: "string", enum: ["self", "parent"] },
              visible: { type: "boolean" },
              fillColor: { type: "string" },
              cornerRadius: { type: "number" },
              opacity: { type: "number" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              layoutMode: {
                type: "string",
                enum: ["NONE", "HORIZONTAL", "VERTICAL"]
              },
              itemSpacing: { type: "number" },
              paddingLeft: { type: "number" },
              paddingRight: { type: "number" },
              paddingTop: { type: "number" },
              paddingBottom: { type: "number" },
              primaryAxisAlignItems: {
                type: "string",
                enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
              },
              counterAxisAlignItems: {
                type: "string",
                enum: ["MIN", "MAX", "CENTER", "BASELINE"]
              },
              primaryAxisSizingMode: {
                type: "string",
                enum: ["FIXED", "AUTO"]
              },
              counterAxisSizingMode: {
                type: "string",
                enum: ["FIXED", "AUTO"]
              },
              layoutGrow: { type: "number" },
              layoutAlign: {
                type: "string",
                enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
              },
              characters: { type: "string" },
              fontFamily: { type: "string" },
              fontStyle: { type: "string" },
              fontSize: { type: "number" }
            },
            required: ["nodeId"],
            additionalProperties: false
          }
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "rename_node",
    description: "Rename a single node in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        name: { type: "string" }
      },
      required: ["nodeId", "name"],
      additionalProperties: false
    }
  },
  {
    name: "bulk_rename_nodes",
    description: "Rename multiple nodes in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              name: { type: "string" }
            },
            required: ["nodeId", "name"],
            additionalProperties: false
          }
        }
      },
      required: ["updates"],
      additionalProperties: false
    }
  },
  {
    name: "bulk_update_texts",
    description: "Update multiple text nodes in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              text: { type: "string" }
            },
            required: ["nodeId", "text"],
            additionalProperties: false
          }
        }
      },
      required: ["updates"],
      additionalProperties: false
    }
  },
  {
    name: "update_node",
    description: "Update visibility or solid fill color for a node in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        target: { type: "string", enum: ["self", "parent"] },
        visible: { type: "boolean" },
        fillColor: { type: "string" },
        cornerRadius: { type: "number" },
        opacity: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        layoutMode: {
          type: "string",
          enum: ["NONE", "HORIZONTAL", "VERTICAL"]
        },
        itemSpacing: { type: "number" },
        paddingLeft: { type: "number" },
        paddingRight: { type: "number" },
        paddingTop: { type: "number" },
        paddingBottom: { type: "number" },
        primaryAxisAlignItems: {
          type: "string",
          enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
        },
        counterAxisAlignItems: {
          type: "string",
          enum: ["MIN", "MAX", "CENTER", "BASELINE"]
        },
        primaryAxisSizingMode: {
          type: "string",
          enum: ["FIXED", "AUTO"]
        },
        counterAxisSizingMode: {
          type: "string",
          enum: ["FIXED", "AUTO"]
        },
        layoutGrow: { type: "number" },
        layoutAlign: {
          type: "string",
          enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
        },
        characters: { type: "string" },
        fontFamily: { type: "string" },
        fontStyle: { type: "string" },
        fontSize: { type: "number" }
      },
      required: ["nodeId"],
      additionalProperties: false
    }
  },
  {
    name: "bulk_update_nodes",
    description: "Update visibility or fill color for multiple nodes in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              target: { type: "string", enum: ["self", "parent"] },
              visible: { type: "boolean" },
              fillColor: { type: "string" },
              cornerRadius: { type: "number" },
              opacity: { type: "number" },
              x: { type: "number" },
              y: { type: "number" },
              width: { type: "number" },
              height: { type: "number" },
              layoutMode: {
                type: "string",
                enum: ["NONE", "HORIZONTAL", "VERTICAL"]
              },
              itemSpacing: { type: "number" },
              paddingLeft: { type: "number" },
              paddingRight: { type: "number" },
              paddingTop: { type: "number" },
              paddingBottom: { type: "number" },
              primaryAxisAlignItems: {
                type: "string",
                enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
              },
              counterAxisAlignItems: {
                type: "string",
                enum: ["MIN", "MAX", "CENTER", "BASELINE"]
              },
              primaryAxisSizingMode: {
                type: "string",
                enum: ["FIXED", "AUTO"]
              },
              counterAxisSizingMode: {
                type: "string",
                enum: ["FIXED", "AUTO"]
              },
              layoutGrow: { type: "number" },
              layoutAlign: {
                type: "string",
                enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
              },
              characters: { type: "string" },
              fontFamily: { type: "string" },
              fontStyle: { type: "string" },
              fontSize: { type: "number" }
            },
            required: ["nodeId"],
            additionalProperties: false
          }
        }
      },
      required: ["updates"],
      additionalProperties: false
    }
  },
  {
    name: "bulk_create_nodes",
    description: "Create multiple nodes in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              parentId: { type: "string" },
              index: { type: "number" },
              nodeType: { type: "string", enum: listSupportedCreateNodeTypes() },
              name: { type: "string" },
              width: { type: "number" },
              height: { type: "number" },
              x: { type: "number" },
              y: { type: "number" },
              characters: { type: "string" },
              fontFamily: { type: "string" },
              fontStyle: { type: "string" },
              fontSize: { type: "number" },
              fillColor: { type: "string" },
              cornerRadius: { type: "number" },
              opacity: { type: "number" }
            },
            required: ["nodeType"],
            additionalProperties: false
          }
        }
      },
      required: ["nodes"],
      additionalProperties: false
    }
  },
  {
    name: "create_node",
    description: "Create and insert a new first-slice node into a target parent.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        index: { type: "number" },
        nodeType: { type: "string", enum: listSupportedCreateNodeTypes() },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        characters: { type: "string" },
        fontFamily: { type: "string" },
        fontStyle: { type: "string" },
        fontSize: { type: "number" },
        fillColor: { type: "string" },
        cornerRadius: { type: "number" },
        opacity: { type: "number" }
      },
      required: ["nodeType"],
      additionalProperties: false
    }
  },
  {
    name: "import_library_component",
    description: "Import a published library component or component set by key and insert an instance into a target parent.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        key: { type: "string" },
        parentId: { type: "string" },
        assetType: {
          type: "string",
          enum: listSupportedImportLibraryAssetTypes()
        },
        name: { type: "string" },
        index: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["key", "parentId"],
      additionalProperties: false
    }
  },
  {
    name: "find_or_import_component",
    description: "Search for a reusable component by query. Return a local match if found, otherwise import the best matching library component into a target parent.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        query: { type: "string" },
        parentId: { type: "string" },
        maxResults: { type: "number" },
        fileKeys: {
          type: "array",
          items: { type: "string" }
        },
        assetTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["COMPONENT", "COMPONENT_SET"]
          }
        },
        preferLocal: { type: "boolean" },
        index: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["query", "parentId"],
      additionalProperties: false
    }
  },
  {
    name: "reuse_or_create_component",
    description: "Search for a reusable component by query. If none is found, promote a target node into a local component instead.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        query: { type: "string" },
        parentId: { type: "string" },
        targetNodeId: { type: "string" },
        createName: { type: "string" },
        createDescription: { type: "string" },
        maxResults: { type: "number" },
        fileKeys: {
          type: "array",
          items: { type: "string" }
        },
        assetTypes: {
          type: "array",
          items: {
            type: "string",
            enum: ["COMPONENT", "COMPONENT_SET"]
          }
        },
        preferLocal: { type: "boolean" },
        index: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["query", "parentId"],
      additionalProperties: false
    }
  },
  {
    name: "build_screen_from_design_system",
    description: "Create a design-system-friendly screen scaffold with auto-layout sections such as header, content, and actions.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        annotate: { type: "boolean" },
        backgroundColor: { type: "string" },
        referencePattern: {
          type: "string",
          enum: ["dashboard-analytics"]
        },
        referenceAnalysis: {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
            backgroundColor: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "header",
                      "content",
                      "actions",
                      "navigation",
                      "summary-cards",
                      "timeline",
                      "list",
                      "table",
                      "form"
                    ]
                  },
                  name: { type: "string" },
                  headerQuery: { type: "string" },
                  headerTitle: { type: "string" },
                  contentTitle: { type: "string" },
                  contentBody: { type: "string" },
                  contentComponentQueries: {
                    type: "array",
                    items: { type: "string" }
                  },
                  primaryActionQuery: { type: "string" },
                  primaryActionLabel: { type: "string" }
                },
                required: ["type"],
                additionalProperties: false
              }
            }
          },
          additionalProperties: false
        },
        headerQuery: { type: "string" },
        headerTitle: { type: "string" },
        contentTitle: { type: "string" },
        contentBody: { type: "string" },
        contentComponentQueries: {
          type: "array",
          items: { type: "string" }
        },
        primaryActionQuery: { type: "string" },
        primaryActionLabel: { type: "string" },
        paddingX: { type: "number" },
        paddingY: { type: "number" },
        sectionGap: { type: "number" },
        contentGap: { type: "number" },
        sections: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "header",
              "content",
              "actions",
              "navigation",
              "summary-cards",
              "timeline",
              "list",
              "table",
              "form"
            ]
          }
        },
        sectionSpecs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "header",
                  "content",
                  "actions",
                  "navigation",
                  "summary-cards",
                  "timeline",
                  "list",
                  "table",
                  "form"
                ]
              },
              name: { type: "string" },
              headerQuery: { type: "string" },
              headerTitle: { type: "string" },
              contentTitle: { type: "string" },
              contentBody: { type: "string" },
              contentComponentQueries: {
                type: "array",
                items: { type: "string" }
              },
              primaryActionQuery: { type: "string" },
              primaryActionLabel: { type: "string" }
            },
            required: ["type"],
            additionalProperties: false
          }
        }
      },
      required: ["parentId"],
      additionalProperties: false
    }
  },
  {
    name: "validate_external_compose_input",
    description:
      "Validate external analyzer payloads against the Xbridge compose contract before running compose.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        backgroundColor: { type: "string" },
        validationMode: {
          type: "string",
          enum: ["lenient", "strict"]
        },
        intentSections: {
          type: "array",
          items: { type: "object", additionalProperties: true }
        },
        referenceAnalysis: {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
            backgroundColor: { type: "string" },
            intentSections: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  name: { type: "string" },
                  headerTitle: { type: "string" },
                  contentTitle: { type: "string" },
                  contentBody: { type: "string" },
                  primaryActionLabel: { type: "string" },
                  density: { type: "string" },
                  contentDensity: { type: "string" },
                  tableColumns: {
                    type: "array",
                    items: {
                      oneOf: [
                        { type: "string" },
                        {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            label: { type: "string" },
                            width: { type: "number" },
                            align: { type: "string" },
                            pattern: { type: "string" }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  tableRowPattern: {
                    type: "array",
                    items: {
                      oneOf: [
                        { type: "string" },
                        {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            label: { type: "string" },
                            tone: { type: "string" },
                            title: { type: "string" },
                            meta: { type: "string" },
                            trailing: { type: "string" }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  actionGroups: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        label: { type: "string" },
                        actions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              key: { type: "string" },
                              label: { type: "string" },
                              intent: { type: "string" },
                              tone: { type: "string" },
                              variant: { type: "string" }
                            },
                            additionalProperties: true
                          }
                        }
                      },
                      additionalProperties: true
                    }
                  }
                },
                additionalProperties: true
              }
            }
          },
          additionalProperties: true
        },
        sections: {
          type: "array",
          items: { type: "object", additionalProperties: true }
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_compose_metrics",
    description:
      "Return compose/validation runtime metrics such as blocked sections, fallback helper count, and strict mode failure ratio.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "compose_screen_from_intents",
    description: "Compose a DS-aware screen from semantic section intents and build it through the layout engine.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        backgroundColor: { type: "string" },
        intentSections: {
          type: "array",
          items: { type: "object", additionalProperties: true }
        },
        referenceAnalysis: {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
            backgroundColor: { type: "string" },
            intentSections: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  name: { type: "string" },
                  headerTitle: { type: "string" },
                  contentTitle: { type: "string" },
                  contentBody: { type: "string" },
                  primaryActionLabel: { type: "string" },
                  density: { type: "string" },
                  contentDensity: { type: "string" },
                  tableColumns: {
                    type: "array",
                    items: {
                      oneOf: [
                        { type: "string" },
                        {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            label: { type: "string" },
                            width: { type: "number" },
                            align: { type: "string" },
                            pattern: { type: "string" }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  tableRowPattern: {
                    type: "array",
                    items: {
                      oneOf: [
                        { type: "string" },
                        {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            label: { type: "string" },
                            tone: { type: "string" },
                            title: { type: "string" },
                            meta: { type: "string" },
                            trailing: { type: "string" }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  actionGroups: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        label: { type: "string" },
                        actions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              key: { type: "string" },
                              label: { type: "string" },
                              intent: { type: "string" },
                              tone: { type: "string" },
                              variant: { type: "string" }
                            },
                            additionalProperties: true
                          }
                        }
                      },
                      additionalProperties: true
                    }
                  }
                },
                additionalProperties: true
              }
            }
          },
          additionalProperties: true
        },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              intent: { type: "string" },
              pattern: { type: "string" },
              variant: { type: "string" },
              tone: { type: "string" },
              density: { type: "string" },
              name: { type: "string" },
              title: { type: "string" },
              domain: { type: "string" },
              leftItems: { type: "array", items: { type: "object" } },
              rightItems: { type: "array", items: { type: "object" } },
              columns: { type: "array", items: {} },
              rows: { type: "array", items: {} },
              sections: { type: "array", items: { type: "object" } },
              users: { type: "array", items: { type: "object" } },
              percent: { type: "number" },
              label: { type: "string" }
            },
            additionalProperties: true
          }
        }
      },
      required: ["parentId"],
      additionalProperties: false
    }
  },
  {
    name: "analyze_selection_to_compose",
    description: "Analyze the selected or explicit reference node, derive intentSections, and immediately compose a DS-aware screen from that analysis.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        targetNodeId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        backgroundColor: { type: "string" },
        includeExport: { type: "boolean" },
        includeSvg: { type: "boolean" }
      },
      required: ["parentId"],
      additionalProperties: false
    }
  },
  {
    name: "build_finance_summary_mock",
    description: "Create a mobile finance summary reference mock composed from bridge primitives in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      },
      additionalProperties: false
    }
  },
  {
    name: "build_layout",
    description: "Build an auto-layout-first Figma tree from a declarative helper schema.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        generatedNamePrefix: { type: "string" },
        generatedAt: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        tree: {
          type: "object",
          properties: {
            helper: {
              type: "string",
              enum: [
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
              ]
            },
            preset: { type: "string" },
            name: { type: "string" },
            layout: { type: "string" },
            widthMode: { type: "string" },
            heightMode: { type: "string" },
            width: { type: "number" },
            height: { type: "number" },
            gap: { type: "number" },
            padding: {
              oneOf: [
                { type: "number" },
                {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    top: { type: "number" },
                    right: { type: "number" },
                    bottom: { type: "number" },
                    left: { type: "number" }
                  },
                  additionalProperties: false
                }
              ]
            },
            align: { type: "string" },
            justify: { type: "string" },
            fill: { type: "string" },
            radius: { type: "number" },
            characters: { type: "string" },
            fontFamily: { type: "string" },
            fontStyle: { type: "string" },
            fontSize: { type: "number" },
            children: {
              type: "array",
              items: { type: "object" }
            }
          },
          required: ["helper"],
          additionalProperties: true
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "create_instance",
    description: "Create an instance from a local component or component set and insert it into a parent.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        sourceNodeId: { type: "string" },
        parentId: { type: "string" },
        name: { type: "string" },
        index: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["sourceNodeId"],
      additionalProperties: false
    }
  },
  {
    name: "duplicate_node",
    description: "Duplicate a node inside the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        count: { type: "number" }
      },
      required: ["nodeId"],
      additionalProperties: false
    }
  },
  {
    name: "move_node",
    description: "Move an existing node into a target parent at an optional index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        parentId: { type: "string" },
        index: { type: "number" }
      },
      required: ["nodeId", "parentId"],
      additionalProperties: false
    }
  },
  {
    name: "move_section",
    description: "Move or reorder an explicit container section into a destination parent at an optional index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        sectionId: { type: "string" },
        destinationParentId: { type: "string" },
        index: { type: "number" }
      },
      required: ["sectionId"],
      additionalProperties: false
    }
  },
  {
    name: "normalize_spacing",
    description: "Normalize auto layout gap and/or padding for an explicit container and optional descendant subtree.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        containerId: { type: "string" },
        spacing: { type: "number" },
        mode: { type: "string", enum: ["both", "gap", "padding"] },
        recursive: { type: "boolean" }
      },
      required: ["containerId"],
      additionalProperties: false
    }
  },
  {
    name: "promote_section",
    description: "Preview or apply promotion of a section-like node to a more primary position, with optional spacing normalization.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        sectionId: { type: "string" },
        destinationParentId: { type: "string" },
        index: { type: "number" },
        previewOnly: { type: "boolean" },
        normalizeSpacing: {
          type: "object",
          properties: {
            spacing: { type: "number" },
            mode: { type: "string", enum: ["both", "gap", "padding"] },
            recursive: { type: "boolean" }
          },
          additionalProperties: false
        }
      },
      required: ["sectionId"],
      additionalProperties: false
    }
  },
  {
    name: "apply_naming_rule",
    description: "Preview or apply a safe pattern-mapped rename plan for a subtree.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        rootNodeId: { type: "string" },
        ruleSet: {
          type: "string",
          enum: ["app-screen", "header-basic", "tab-bar-basic", "card-list-basic", "fab-basic", "content-screen-basic", "ai-chat-screen"]
        },
        recursive: { type: "boolean" },
        previewOnly: { type: "boolean" }
      },
      required: ["rootNodeId"],
      additionalProperties: false
    }
  },
  {
    name: "delete_node",
    description: "Delete a node from the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" }
      },
      required: ["nodeId"],
      additionalProperties: false
    }
  },
  {
    name: "reorder_child",
    description: "Reorder a node within its current parent by child index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        index: { type: "number" }
      },
      required: ["nodeId", "index"],
      additionalProperties: false
    }
  },
  {
    name: "boolean_subtract",
    description: "Create a Figma subtract boolean operation from a base node and one or more subtractor nodes.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        baseNodeId: { type: "string" },
        subtractNodeIds: {
          type: "array",
          items: { type: "string" }
        },
        parentId: { type: "string" },
        index: { type: "number" },
        name: { type: "string" }
      },
      required: ["baseNodeId", "subtractNodeIds"],
      additionalProperties: false
    }
  },
  {
    name: "undo_last_batch",
    description: "Undo the most recent supported mutation batch in the current plugin session.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" }
      },
      additionalProperties: false
    }
  }
];

async function handleToolCall(name, args) {
  const pluginId = args.pluginId || "default";

  if (name === "get_active_plugins") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            Array.from(pluginSessions.values()).map(serializePluginSession),
            null,
            2
          )
        }
      ]
    };
  }

  if (name === "get_selection") {
    const result = await executePluginCommand(pluginId, "get_selection");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_pages") {
    const result = await executePluginCommand(pluginId, "list_pages");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_figma_account_profile") {
    const result = await getCurrentUser(FIGMA_ACCOUNT_API_OPTIONS);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_team_projects") {
    const plan = buildTeamProjectsPlan(args);
    const result = await listTeamProjects(plan, FIGMA_ACCOUNT_API_OPTIONS);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_project_files") {
    const plan = buildProjectFilesPlan(args);
    const result = await listProjectFiles(plan, FIGMA_ACCOUNT_API_OPTIONS);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_file_summary") {
    const plan = buildFileSummaryPlan(args);
    const result = await getFileSummary(plan, FIGMA_ACCOUNT_API_OPTIONS);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_metadata") {
    const result = await executePluginCommand(pluginId, "get_metadata", {
      targetNodeId: resolveTargetNodeId(args),
      maxDepth: args.maxDepth,
      maxNodes: args.maxNodes,
      includeJson: args.includeJson === true
    });
    const jsonTree =
      args.includeJson && result && typeof result.xml === "string"
        ? parseSelectionMetadataTree(result.xml)
        : null;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            args.includeJson ? { ...result, json: jsonTree } : result,
            null,
            2
          )
        }
      ]
    };
  }

  if (name === "get_annotations") {
    const plan = buildGetAnnotationsPlan(args);
    const rawResult = await executePluginCommand(
      pluginId,
      "get_annotations",
      plan
    );
    const result = normalizeAnnotationReadResult(rawResult, {
      includeInferredComments: plan.includeInferredComments
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_node_details") {
    const plan = buildNodeDetailsPlan(args);
    let result = null;
    try {
      result = await executePluginCommand(pluginId, "get_node_details", plan);
    } catch (error) {
      result = await readMetadataFallbackForDetail(pluginId, plan, error);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_component_variant_details") {
    const plan = buildComponentVariantDetailsPlan(args);
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
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_instance_details") {
    const plan = buildInstanceDetailsPlan(args);
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
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_variable_defs") {
    const result = await executePluginCommand(pluginId, "get_variable_defs", {
      targetNodeId: resolveTargetNodeId(args),
      maxDepth: args.maxDepth,
      maxNodes: args.maxNodes
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_text_nodes") {
    const result = await executePluginCommand(pluginId, "list_text_nodes", {
      targetNodeId: args.targetNodeId,
      scope: args.scope
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_nodes") {
    const plan = buildSearchNodesPlan(args);
    const result = await executeSearchNodesWithRetry(pluginId, plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "snapshot_selection") {
    const plan = buildSnapshotPlan(args);
    const result = await executePluginCommand(pluginId, "snapshot_selection", {
      targetNodeId: args.targetNodeId,
      maxDepth: plan.maxDepth,
      maxNodes: plan.maxNodes,
      placeholderInstances: plan.placeholderInstances
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "export_node") {
    const plan = buildExportNodePlan(args);
    const result = await executePluginCommand(pluginId, "export_node", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "add_annotation") {
    const plan = buildAddAnnotationPlan(args);
    const result = await executePluginCommand(pluginId, "add_annotation", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_add_annotations") {
    const plan = buildBulkAddAnnotationsPlan(args);
    const result = await executePluginCommand(pluginId, "bulk_add_annotations", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "analyze_reference_selection") {
    const plan = buildAnalyzeReferenceSelectionPlan(args);
    const metadataResult = await executePluginCommand(pluginId, "get_metadata", {
      targetNodeId: plan.targetNodeId
    });
    const result = deriveReferenceAnalysisDraft(metadataResult, plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_library_assets") {
    const plan = buildLibraryAssetSearchPlan(args);
    const result = await searchLibraryAssets(plan, {
      accessToken: process.env.FIGMA_ACCESS_TOKEN
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_design_system") {
    const result = await performDesignSystemSearch(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_instances") {
    const plan = buildSearchInstancesPlan(args);
    const result = await executePluginCommand(pluginId, "search_instances", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "recreate_snapshot") {
    const plan = buildReplayPlan(args.snapshot, {
      targetParentId: args.targetParentId
    });
    const result = await executePluginCommand(
      pluginId,
      "recreate_snapshot",
      plan
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_file_components") {
    const plan = buildFileComponentSearchPlan(args);
    const result = await searchFileComponents(plan, {
      accessToken: process.env.FIGMA_ACCESS_TOKEN
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_component_properties") {
    const result = await executePluginCommand(pluginId, "list_component_properties", {
      targetNodeId: args.targetNodeId
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "update_text") {
    const result = await executePluginCommand(pluginId, "update_text", {
      nodeId: args.nodeId,
      text: args.text
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "set_component_property") {
    const result = await executePluginCommand(pluginId, "set_component_property", {
      nodeId: args.nodeId,
      propertyName: args.propertyName,
      value: args.value
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "set_component_properties") {
    const plan = buildSetComponentPropertiesPlan(args);
    const result = await executePluginCommand(pluginId, "set_component_properties", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "add_component_property") {
    const plan = buildAddComponentPropertyPlan(args);
    const result = await executePluginCommand(pluginId, "add_component_property", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "edit_component_property") {
    const plan = buildEditComponentPropertyPlan(args);
    const result = await executePluginCommand(pluginId, "edit_component_property", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "set_variant_properties") {
    const plan = buildSetVariantPropertiesPlan(args);
    const result = await executePluginCommand(pluginId, "set_variant_properties", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bind_variable") {
    const plan = buildBindVariablePlan(args);
    const result = await executePluginCommand(pluginId, "bind_variable", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "apply_style") {
    const plan = buildApplyStylePlan(args);
    const result = await executePluginCommand(pluginId, "apply_style", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_component") {
    const plan = buildCreateComponentPlan(args);
    const result = await executePluginCommand(pluginId, "create_component", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_component_set") {
    const plan = buildCreateComponentSetPlan(args);
    const result = await executePluginCommand(pluginId, "create_component_set", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_instance") {
    const plan = buildCreateInstancePlan(withSessionDefaultParent(pluginId, args));
    const result = await executePluginCommand(pluginId, "create_instance", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "preview_changes") {
    const result = await executePluginCommand(pluginId, "preview_changes", {
      nodeId: args.nodeId,
      target: args.target,
      visible: args.visible,
      fillColor: args.fillColor,
      cornerRadius: args.cornerRadius,
      opacity: args.opacity,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      layoutMode: args.layoutMode,
      itemSpacing: args.itemSpacing,
      paddingLeft: args.paddingLeft,
      paddingRight: args.paddingRight,
      paddingTop: args.paddingTop,
      paddingBottom: args.paddingBottom,
      primaryAxisAlignItems: args.primaryAxisAlignItems,
      counterAxisAlignItems: args.counterAxisAlignItems,
      primaryAxisSizingMode: args.primaryAxisSizingMode,
      counterAxisSizingMode: args.counterAxisSizingMode,
      layoutGrow: args.layoutGrow,
      layoutAlign: args.layoutAlign,
      characters: args.characters,
      fontFamily: args.fontFamily,
      fontStyle: args.fontStyle,
      fontSize: args.fontSize,
      textAutoResize: args.textAutoResize,
      textAlignHorizontal: args.textAlignHorizontal,
      textAlignVertical: args.textAlignVertical,
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "rename_node") {
    const result = await executePluginCommand(pluginId, "rename_node", {
      nodeId: args.nodeId,
      name: args.name
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_rename_nodes") {
    const result = await executePluginCommand(pluginId, "bulk_rename_nodes", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_update_texts") {
    const result = await executePluginCommand(pluginId, "bulk_update_texts", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "update_node") {
    const result = await executePluginCommand(pluginId, "update_node", {
      nodeId: args.nodeId,
      target: args.target,
      visible: args.visible,
      fillColor: args.fillColor,
      cornerRadius: args.cornerRadius,
      opacity: args.opacity,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      layoutMode: args.layoutMode,
      itemSpacing: args.itemSpacing,
      paddingLeft: args.paddingLeft,
      paddingRight: args.paddingRight,
      paddingTop: args.paddingTop,
      paddingBottom: args.paddingBottom,
      primaryAxisAlignItems: args.primaryAxisAlignItems,
      counterAxisAlignItems: args.counterAxisAlignItems,
      primaryAxisSizingMode: args.primaryAxisSizingMode,
      counterAxisSizingMode: args.counterAxisSizingMode,
      layoutGrow: args.layoutGrow,
      layoutAlign: args.layoutAlign,
      characters: args.characters,
      fontFamily: args.fontFamily,
      fontStyle: args.fontStyle,
      fontSize: args.fontSize,
      textAutoResize: args.textAutoResize,
      textAlignHorizontal: args.textAlignHorizontal,
      textAlignVertical: args.textAlignVertical
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_update_nodes") {
    const result = await executePluginCommand(pluginId, "bulk_update_nodes", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_node") {
    const plan = buildCreateNodePlan(withSessionDefaultParent(pluginId, args));
    const result = await executePluginCommand(pluginId, "create_node", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_create_nodes") {
    const plan = buildBulkCreateNodesPlan(withSessionDefaultParent(pluginId, args));
    const result = await executePluginCommand(pluginId, "bulk_create_nodes", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "import_library_component") {
    const plan = buildImportLibraryComponentPlan(args);
    const result = await executePluginCommand(
      pluginId,
      "import_library_component",
      plan
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "find_or_import_component") {
    const result = await performFindOrImportComponent(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "reuse_or_create_component") {
    const result = await performReuseOrCreateComponent(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "build_screen_from_design_system") {
    const result = await performBuildScreenFromDesignSystem(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "compose_screen_from_intents") {
    const result = await performComposeScreenFromIntents(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_compose_metrics") {
    const result = performGetComposeMetrics();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "validate_external_compose_input") {
    const result = performValidateExternalComposeInput(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "analyze_selection_to_compose") {
    const result = await performAnalyzeSelectionToCompose(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "build_finance_summary_mock") {
    const result = await performBuildFinanceSummaryMock(
      pluginId,
      withSessionDefaultParent(pluginId, args)
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "build_layout") {
    const result = await performBuildLayout(
      pluginId,
      withSessionDefaultParent(pluginId, args)
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "duplicate_node") {
    const result = await executePluginCommand(pluginId, "duplicate_node", {
      nodeId: args.nodeId,
      count: args.count
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "move_node") {
    const result = await executePluginCommand(pluginId, "move_node", {
      nodeId: args.nodeId,
      parentId: args.parentId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "move_section") {
    const result = await executePluginCommand(pluginId, "move_section", {
      sectionId: args.sectionId,
      destinationParentId: args.destinationParentId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "normalize_spacing") {
    const result = await executePluginCommand(pluginId, "normalize_spacing", {
      containerId: args.containerId,
      spacing: args.spacing,
      mode: args.mode,
      recursive: args.recursive
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "apply_naming_rule") {
    const result = await executePluginCommand(pluginId, "apply_naming_rule", {
      rootNodeId: args.rootNodeId,
      ruleSet: args.ruleSet,
      recursive: args.recursive,
      previewOnly: args.previewOnly
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "promote_section") {
    const result = await executePluginCommand(pluginId, "promote_section", {
      sectionId: args.sectionId,
      destinationParentId: args.destinationParentId,
      index: args.index,
      normalizeSpacing: args.normalizeSpacing,
      previewOnly: args.previewOnly
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "delete_node") {
    const result = await executePluginCommand(pluginId, "delete_node", {
      nodeId: args.nodeId
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "reorder_child") {
    const result = await executePluginCommand(pluginId, "reorder_child", {
      nodeId: args.nodeId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "boolean_subtract") {
    const result = await executePluginCommand(pluginId, "boolean_subtract", {
      baseNodeId: args.baseNodeId,
      subtractNodeIds: args.subtractNodeIds,
      parentId: args.parentId,
      index: args.index,
      name: args.name
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "undo_last_batch") {
    const result = await executePluginCommand(pluginId, "undo_last_batch");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

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
          name: "figma-writable-mcp-prototype",
          version: "0.3.0"
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
