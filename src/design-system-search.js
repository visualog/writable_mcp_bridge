const DEFAULT_MAX_RESULTS = 30;
const HARD_MAX_RESULTS = 100;
const SUPPORTED_KINDS = ["components", "styles", "variables"];
const SUPPORTED_SOURCES = ["local-file", "library-files", "all"];

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

function normalizeEnumList(value, allowed) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = [];
  for (const item of value) {
    const normalized = String(item || "").trim().toLowerCase();
    if (!normalized || allowed.indexOf(normalized) === -1 || unique.includes(normalized)) {
      continue;
    }
    unique.push(normalized);
  }
  return unique;
}

function resolveKinds(input) {
  const normalized = normalizeEnumList(input.kinds, SUPPORTED_KINDS);
  if (normalized.length > 0) {
    return normalized;
  }

  const kinds = [];
  if (input.includeComponents !== false) {
    kinds.push("components");
  }
  if (input.includeStyles !== false) {
    kinds.push("styles");
  }
  if (input.includeVariables !== false) {
    kinds.push("variables");
  }
  return kinds;
}

function resolveSources(input) {
  const normalized = normalizeEnumList(input.sources, SUPPORTED_SOURCES);
  if (normalized.length > 0) {
    return normalized;
  }

  if (Array.isArray(input.fileKeys) && input.fileKeys.length > 0) {
    return ["all"];
  }

  return ["local-file"];
}

export function buildDesignSystemSearchPlan(input = {}) {
  const kinds = resolveKinds(input);
  const sources = resolveSources(input);

  return {
    query: normalizeQuery(input.query),
    maxResults: clampInteger(input.maxResults, DEFAULT_MAX_RESULTS, 1, HARD_MAX_RESULTS),
    kinds,
    sources,
    includeComponents: kinds.includes("components"),
    includeStyles: kinds.includes("styles"),
    includeVariables: kinds.includes("variables"),
    fileKeys: normalizeFileKeys(input.fileKeys)
  };
}

function sourceGroupForItem(item) {
  if (!item || typeof item !== "object") {
    return "unknown";
  }

  if (typeof item.sourceType === "string" && item.sourceType.startsWith("LOCAL_")) {
    return "local-file";
  }

  if (
    item.sourceType === "LIBRARY_COMPONENT" ||
    item.sourceType === "FILE_COMPONENT" ||
    item.sourceType === "LIBRARY_STYLE"
  ) {
    return "library-files";
  }

  return "unknown";
}

function sourceMatchesPlan(item, plan) {
  if (plan.sources.includes("all")) {
    return true;
  }

  const group = sourceGroupForItem(item);
  return plan.sources.includes(group);
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

      if (!sourceMatchesPlan(item, plan)) {
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
    kinds: plan.kinds,
    sources: plan.sources,
    matches: merged.slice(0, plan.maxResults),
    truncated
  };
}
