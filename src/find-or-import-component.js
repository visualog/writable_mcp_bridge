const SUPPORTED_COMPONENT_ASSET_TYPES = ["COMPONENT", "COMPONENT_SET"];

function clampInteger(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizeEnumList(value, allowed) {
  if (!Array.isArray(value)) {
    return [];
  }

  const unique = [];
  for (const item of value) {
    const normalized = String(item || "").trim().toUpperCase();
    if (!normalized || allowed.indexOf(normalized) === -1 || unique.includes(normalized)) {
      continue;
    }
    unique.push(normalized);
  }
  return unique;
}

function normalizeQuery(value) {
  return String(value || "").trim();
}

function scoreMatch(match, query) {
  const loweredQuery = String(query || "").trim().toLowerCase();
  const loweredName = String(match?.name || "").trim().toLowerCase();

  let score = 0;

  if (!loweredQuery) {
    score += 1;
  } else if (loweredName === loweredQuery) {
    score += 100;
  } else if (loweredName.startsWith(loweredQuery)) {
    score += 75;
  } else if (loweredName.includes(loweredQuery)) {
    score += 50;
  }

  const assetType = String(match?.assetType || "").toUpperCase();
  if (assetType === "COMPONENT") {
    score += 10;
  }

  if (
    match?.sourceType === "LOCAL_COMPONENT" ||
    match?.sourceType === "LOCAL_COMPONENT_SET"
  ) {
    score += 5;
  }

  if (typeof match?.containingFrame?.name === "string" && loweredQuery) {
    const frameName = match.containingFrame.name.toLowerCase();
    if (frameName.includes(loweredQuery)) {
      score += 3;
    }
  }

  return score;
}

export function buildFindOrImportComponentPlan(input = {}) {
  const query = normalizeQuery(input.query);
  const parentId = String(input.parentId || "").trim();

  if (!query) {
    throw new Error("query is required");
  }

  if (!parentId) {
    throw new Error("parentId is required");
  }

  const assetTypes = normalizeEnumList(
    input.assetTypes,
    SUPPORTED_COMPONENT_ASSET_TYPES
  );

  const fileKeys = Array.isArray(input.fileKeys)
    ? input.fileKeys
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .filter((item, index, array) => array.indexOf(item) === index)
    : [];

  const plan = {
    query,
    parentId,
    fileKeys,
    maxResults: clampInteger(input.maxResults, 10, 1, 50),
    assetTypes: assetTypes.length > 0 ? assetTypes : [...SUPPORTED_COMPONENT_ASSET_TYPES],
    preferLocal: input.preferLocal !== false,
    x: typeof input.x === "number" && Number.isFinite(input.x) ? input.x : undefined,
    y: typeof input.y === "number" && Number.isFinite(input.y) ? input.y : undefined,
    index:
      typeof input.index === "number" && Number.isFinite(input.index)
        ? Math.trunc(input.index)
        : undefined
  };

  if (typeof input.targetNodeId === "string" && input.targetNodeId.trim()) {
    plan.targetNodeId = input.targetNodeId.trim();
  }

  return plan;
}

export function selectPreferredComponentMatch(matches = [], input = {}) {
  const plan =
    input && typeof input.query === "string" && typeof input.parentId === "string"
      ? buildFindOrImportComponentPlan(input)
      : {
          query: normalizeQuery(input.query),
          assetTypes:
            normalizeEnumList(input.assetTypes, SUPPORTED_COMPONENT_ASSET_TYPES).length > 0
              ? normalizeEnumList(input.assetTypes, SUPPORTED_COMPONENT_ASSET_TYPES)
              : [...SUPPORTED_COMPONENT_ASSET_TYPES],
          preferLocal: input.preferLocal !== false
        };

  const filtered = matches.filter((match) => {
    const assetType = String(match?.assetType || "COMPONENT").toUpperCase();
    return plan.assetTypes.includes(assetType);
  });

  if (filtered.length === 0) {
    return null;
  }

  const scored = filtered
    .map((match) => ({
      match,
      score: scoreMatch(match, plan.query)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftIsLocal =
        left.match?.sourceType === "LOCAL_COMPONENT" ||
        left.match?.sourceType === "LOCAL_COMPONENT_SET";
      const rightIsLocal =
        right.match?.sourceType === "LOCAL_COMPONENT" ||
        right.match?.sourceType === "LOCAL_COMPONENT_SET";

      if (plan.preferLocal && leftIsLocal !== rightIsLocal) {
        return rightIsLocal ? 1 : -1;
      }

      return String(left.match?.name || "").localeCompare(String(right.match?.name || ""));
    });

  return scored[0].match;
}
