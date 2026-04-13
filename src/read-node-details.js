const DETAIL_LEVELS = new Set(["light", "layout", "full"]);

function normalizeTrimmedString(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeRequiredNodeId(value, fieldName) {
  const nodeId = normalizeTrimmedString(value);
  if (!nodeId) {
    throw new Error(`${fieldName} is required`);
  }
  return nodeId;
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function clampInteger(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizeDetailLevel(value, fallback = "layout") {
  const normalized = normalizeTrimmedString(value);
  if (!normalized) {
    return fallback;
  }

  const lowered = normalized.toLowerCase();
  return DETAIL_LEVELS.has(lowered) ? lowered : fallback;
}

function buildBaseReadPlan(input = {}, { defaultDetailLevel = "layout" } = {}) {
  return {
    targetNodeId: normalizeRequiredNodeId(input.targetNodeId, "targetNodeId"),
    maxDepth: clampInteger(input.maxDepth, 3, 0, 8),
    includeChildren: normalizeBoolean(input.includeChildren, true),
    detailLevel: normalizeDetailLevel(input.detailLevel, defaultDetailLevel)
  };
}

export function buildNodeDetailsPlan(input = {}) {
  return buildBaseReadPlan(input, { defaultDetailLevel: "layout" });
}

export function buildComponentVariantDetailsPlan(input = {}) {
  return buildBaseReadPlan(input, { defaultDetailLevel: "full" });
}

export function buildInstanceDetailsPlan(input = {}) {
  return {
    ...buildBaseReadPlan(input, { defaultDetailLevel: "full" }),
    includeResolvedChildren: normalizeBoolean(input.includeResolvedChildren, false)
  };
}
