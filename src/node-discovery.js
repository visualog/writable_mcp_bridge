const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_RESULTS = 50;
const HARD_MAX_DEPTH = 8;
const HARD_MAX_RESULTS = 200;
const VALID_SCOPES = new Set(['auto', 'current-page', 'selection', 'target']);
const VALID_DETAIL_LEVELS = new Set(['light', 'layout', 'full']);

function normalizeQuery(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeNodeTypes(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const unique = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      continue;
    }

    const normalized = item.trim().toUpperCase();
    if (!normalized || unique.includes(normalized)) {
      continue;
    }

    unique.push(normalized);
  }

  return unique.length ? unique : undefined;
}

function clampInteger(value, fallback, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function normalizeScope(value) {
  if (typeof value !== 'string') {
    return 'auto';
  }

  const normalized = value.trim().toLowerCase();
  return VALID_SCOPES.has(normalized) ? normalized : 'auto';
}

function normalizeDetailLevel(value) {
  if (typeof value !== 'string') {
    return 'light';
  }

  const normalized = value.trim().toLowerCase();
  return VALID_DETAIL_LEVELS.has(normalized) ? normalized : 'light';
}

export function buildSearchNodesPlan(input = {}) {
  const plan = {
    query: normalizeQuery(input.query),
    nodeTypes: normalizeNodeTypes(input.nodeTypes),
    maxDepth: clampInteger(input.maxDepth, DEFAULT_MAX_DEPTH, 0, HARD_MAX_DEPTH),
    maxResults: clampInteger(input.maxResults, DEFAULT_MAX_RESULTS, 1, HARD_MAX_RESULTS),
    includeText: Boolean(input.includeText),
    scope: normalizeScope(input.scope),
    detailLevel: normalizeDetailLevel(input.detailLevel)
  };

  if (typeof input.targetNodeId === 'string' && input.targetNodeId.trim()) {
    plan.targetNodeId = input.targetNodeId.trim();
  }

  return plan;
}

function matchesQuery(node, loweredQuery) {
  if (!loweredQuery) {
    return true;
  }

  const haystacks = [node.name];
  if (typeof node.characters === 'string') {
    haystacks.push(node.characters);
  }

  return haystacks.some(
    (value) => typeof value === 'string' && value.toLowerCase().includes(loweredQuery)
  );
}

function matchesType(node, nodeTypes) {
  if (!nodeTypes || nodeTypes.length === 0) {
    return true;
  }

  return nodeTypes.includes(node.type);
}

function buildMatch(node, depth, includeText) {
  const match = {
    id: node.id,
    name: node.name,
    type: node.type,
    depth,
    childCount: Array.isArray(node.children) ? node.children.length : 0
  };

  if (includeText && typeof node.characters === 'string') {
    match.characters = node.characters;
  }

  return match;
}

export function searchNodeTree(root, input = {}) {
  const plan = buildSearchNodesPlan(input);
  const loweredQuery = plan.query ? plan.query.toLowerCase() : null;
  const matches = [];
  let truncated = false;

  function visit(node, depth) {
    if (!node || truncated) {
      return;
    }

    if (depth > 0 && matchesQuery(node, loweredQuery) && matchesType(node, plan.nodeTypes)) {
      matches.push(buildMatch(node, depth, plan.includeText));
      if (matches.length >= plan.maxResults) {
        truncated = true;
        return;
      }
    }

    if (depth >= plan.maxDepth || !Array.isArray(node.children)) {
      return;
    }

    for (const child of node.children) {
      visit(child, depth + 1);
      if (truncated) {
        return;
      }
    }
  }

  visit(root, 0);

  return {
    root: {
      id: root.id,
      name: root.name,
      type: root.type
    },
    matches,
    truncated
  };
}
