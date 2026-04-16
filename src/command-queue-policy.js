const USER_SOURCES = new Set(["user_http", "user_tool", "user"]);

export const COMMAND_PRIORITIES = {
  USER_TRIGGERED: 100,
  DEFAULT: 10
};

export const SAFE_QUEUE_DEDUPE_TYPES = new Set([
  "get_selection",
  "list_pages",
  "get_metadata",
  "get_variable_defs",
  "list_text_nodes",
  "search_nodes",
  "snapshot_selection",
  "search_instances",
  "list_component_properties",
  "get_node_details",
  "get_component_variant_details",
  "get_instance_details",
  "search_design_system",
  "preview_changes"
]);

export const READ_HEAVY_COMMAND_TYPES = new Set([
  "list_pages",
  "get_metadata",
  "get_node_details",
  "get_component_variant_details",
  "get_instance_details"
]);

export const CRITICAL_FALLBACK_COMMAND_TYPES = new Set([
  "get_selection",
  "list_pages",
  "get_metadata"
]);

export const DETAIL_FALLBACK_COMMAND_TYPES = new Set([
  "get_node_details",
  "get_component_variant_details",
  "get_instance_details"
]);

const POLLING_FALLBACK_POLICY_PROFILES = {
  critical: {
    graceMultiplier: 0.45,
    priorityBoost: 50
  },
  detail: {
    graceMultiplier: 0.75,
    priorityBoost: 35
  },
  standard: {
    graceMultiplier: 1.2,
    priorityBoost: 0
  },
  mutation: {
    graceMultiplier: 1.3,
    priorityBoost: -5
  }
};

function normalizeForStableJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForStableJson(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const normalized = {};
  for (const key of Object.keys(value).sort()) {
    normalized[key] = normalizeForStableJson(value[key]);
  }
  return normalized;
}

export function resolveCommandPriority({ source, requestedPriority } = {}) {
  if (Number.isFinite(requestedPriority)) {
    return requestedPriority;
  }
  if (USER_SOURCES.has(source)) {
    return COMMAND_PRIORITIES.USER_TRIGGERED;
  }
  return COMMAND_PRIORITIES.DEFAULT;
}

export function canSafelyDedupeCommand(type) {
  return SAFE_QUEUE_DEDUPE_TYPES.has(type);
}

export function canSafelyCancelStalePendingCommand(type) {
  return SAFE_QUEUE_DEDUPE_TYPES.has(type);
}

export function isReadHeavyCommandType(type) {
  return READ_HEAVY_COMMAND_TYPES.has(type);
}

export function canApplyExpiryGrace(type) {
  return isReadHeavyCommandType(type);
}

export function resolvePollingFallbackClass(type) {
  if (CRITICAL_FALLBACK_COMMAND_TYPES.has(type)) {
    return "critical";
  }
  if (DETAIL_FALLBACK_COMMAND_TYPES.has(type)) {
    return "detail";
  }
  if (SAFE_QUEUE_DEDUPE_TYPES.has(type)) {
    return "standard";
  }
  return "mutation";
}

export function resolvePollingFallbackPolicy({
  type,
  baseGraceMs,
  timeoutMs,
  basePriority
} = {}) {
  const fallbackClass = resolvePollingFallbackClass(type);
  const profile =
    POLLING_FALLBACK_POLICY_PROFILES[fallbackClass] ||
    POLLING_FALLBACK_POLICY_PROFILES.standard;
  const normalizedGraceMs = Number.isFinite(baseGraceMs)
    ? Math.max(100, Math.floor(baseGraceMs))
    : 100;
  const timeoutBudgetMs = Number.isFinite(timeoutMs)
    ? Math.max(0, Math.floor(timeoutMs) - 200)
    : Number.POSITIVE_INFINITY;
  const graceBeforeBudgetClampMs = Math.max(
    0,
    Math.floor(normalizedGraceMs * profile.graceMultiplier)
  );
  const effectiveGraceMs = Math.min(graceBeforeBudgetClampMs, timeoutBudgetMs);
  const normalizedPriority = Number.isFinite(basePriority)
    ? Math.floor(basePriority)
    : COMMAND_PRIORITIES.DEFAULT;
  const pollingPriority = normalizedPriority + profile.priorityBoost;

  return {
    fallbackClass,
    graceMultiplier: profile.graceMultiplier,
    effectiveGraceMs,
    pollingPriority
  };
}

export function buildCommandDedupeKey(type, payload = {}) {
  return `${type}:${JSON.stringify(normalizeForStableJson(payload))}`;
}
