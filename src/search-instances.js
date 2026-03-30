const DEFAULT_MAX_DEPTH = 4;
const DEFAULT_MAX_RESULTS = 100;
const HARD_MAX_DEPTH = 10;
const HARD_MAX_RESULTS = 300;

function clampInteger(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizeQuery(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function buildSearchInstancesPlan(input = {}) {
  const plan = {
    query: normalizeQuery(input.query),
    maxDepth: clampInteger(input.maxDepth, DEFAULT_MAX_DEPTH, 0, HARD_MAX_DEPTH),
    maxResults: clampInteger(input.maxResults, DEFAULT_MAX_RESULTS, 1, HARD_MAX_RESULTS),
    includeProperties: input.includeProperties !== false
  };

  if (typeof input.targetNodeId === "string" && input.targetNodeId.trim()) {
    plan.targetNodeId = input.targetNodeId.trim();
  }

  return plan;
}

export const SEARCH_INSTANCES_DEFAULTS = {
  maxDepth: DEFAULT_MAX_DEPTH,
  maxResults: DEFAULT_MAX_RESULTS
};
