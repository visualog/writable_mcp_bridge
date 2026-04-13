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

export function buildCommandDedupeKey(type, payload = {}) {
  return `${type}:${JSON.stringify(normalizeForStableJson(payload))}`;
}
