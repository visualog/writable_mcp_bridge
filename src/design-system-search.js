const DEFAULT_MAX_RESULTS = 30;
const HARD_MAX_RESULTS = 100;

function clampInteger(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeFileKeys(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = [];
  for (const item of value) {
    const normalized = String(item || "").trim();
    if (!normalized || unique.includes(normalized)) {
      continue;
    }
    unique.push(normalized);
  }
  return unique;
}

export function buildDesignSystemSearchPlan(input = {}) {
  return {
    query: normalizeQuery(input.query),
    maxResults: clampInteger(input.maxResults, DEFAULT_MAX_RESULTS, 1, HARD_MAX_RESULTS),
    includeComponents: input.includeComponents !== false,
    includeStyles: input.includeStyles !== false,
    includeVariables: input.includeVariables !== false,
    fileKeys: normalizeFileKeys(input.fileKeys)
  };
}

function normalizeString(value) {
  return typeof value === "string" ? value : "";
}

function matchesQuery(item, loweredQuery) {
  if (!loweredQuery) {
    return true;
  }

  const haystacks = [
    item.name,
    item.description,
    item.collection,
    item.styleType,
    item.assetType,
    item.containingFrame?.name
  ];

  return haystacks.some(
    (value) =>
      typeof value === "string" && value.toLowerCase().includes(loweredQuery)
  );
}

function compareByName(left, right) {
  return normalizeString(left.name || left.id).localeCompare(
    normalizeString(right.name || right.id)
  );
}

export function mergeDesignSystemSearchResults(sources = [], input = {}) {
  const plan = buildDesignSystemSearchPlan(input);
  const loweredQuery = plan.query;
  const merged = [];
  const dedupeKeys = new Set();
  let truncated = false;

  for (const source of sources) {
    const items = Array.isArray(source?.matches) ? source.matches : [];
    for (const item of items) {
      if (!item || typeof item !== "object") {
        continue;
      }

      if (item.assetType === "VARIABLE" && !plan.includeVariables) {
        continue;
      }

      if (
        (item.assetType === "STYLE" || item.sourceType === "LOCAL_STYLE") &&
        !plan.includeStyles
      ) {
        continue;
      }

      if (
        (item.assetType === "COMPONENT" ||
          item.assetType === "COMPONENT_SET" ||
          item.sourceType === "LOCAL_COMPONENT" ||
          item.sourceType === "LOCAL_COMPONENT_SET") &&
        !plan.includeComponents
      ) {
        continue;
      }

      if (!matchesQuery(item, loweredQuery)) {
        continue;
      }

      const dedupeKey =
        item.sourceType && item.id
          ? `${item.sourceType}:${item.id}`
          : item.assetType && item.key
            ? `${item.assetType}:${item.key}`
            : `${item.assetType || "UNKNOWN"}:${item.name || ""}:${item.nodeId || ""}`;

      if (dedupeKeys.has(dedupeKey)) {
        continue;
      }

      dedupeKeys.add(dedupeKey);
      merged.push(item);
    }
  }

  merged.sort(compareByName);

  if (merged.length > plan.maxResults) {
    truncated = true;
  }

  return {
    query: plan.query,
    maxResults: plan.maxResults,
    matches: merged.slice(0, plan.maxResults),
    truncated
  };
}
