const SUPPORTED_SNAPSHOT_NODE_TYPES = ["FRAME", "GROUP", "RECTANGLE", "TEXT", "INSTANCE"];

function normalizeFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function buildSnapshotPlan(input = {}) {
  return {
    maxDepth:
      typeof input.maxDepth === "number" && Number.isFinite(input.maxDepth)
        ? Math.max(0, Math.min(5, Math.trunc(input.maxDepth)))
        : 3,
    maxNodes:
      typeof input.maxNodes === "number" && Number.isFinite(input.maxNodes)
        ? Math.max(1, Math.min(200, Math.trunc(input.maxNodes)))
        : 50,
    placeholderInstances: input.placeholderInstances !== false
  };
}

function snapshotNode(node, state, depth, plan) {
  if (!SUPPORTED_SNAPSHOT_NODE_TYPES.includes(node.type)) {
    throw new Error(`Unsupported node type: ${node.type}`);
  }

  if (state.count >= plan.maxNodes) {
    state.truncated = true;
    return null;
  }

  state.count += 1;

  const snapshot = {
    name: node.name,
    type: node.type,
    x: normalizeFiniteNumber(node.x) || 0,
    y: normalizeFiniteNumber(node.y) || 0,
    width: normalizeFiniteNumber(node.width),
    height: normalizeFiniteNumber(node.height),
    visible: typeof node.visible === "boolean" ? node.visible : true,
    opacity: normalizeFiniteNumber(node.opacity),
    cornerRadius: normalizeFiniteNumber(node.cornerRadius),
    fillColor: typeof node.fillColor === "string" ? node.fillColor : undefined,
    characters: typeof node.characters === "string" ? node.characters : undefined,
    children: []
  };

  if (
    depth >= plan.maxDepth ||
    !Array.isArray(node.children) ||
    node.type === "INSTANCE"
  ) {
    if (Array.isArray(node.children) && node.children.length > 0) {
      state.truncated = true;
    }
    return snapshot;
  }

  for (const child of node.children) {
    const childSnapshot = snapshotNode(child, state, depth + 1, plan);
    if (childSnapshot) {
      snapshot.children.push(childSnapshot);
    }
  }

  return snapshot;
}

export function snapshotNodeTree(root, input = {}) {
  const plan = buildSnapshotPlan(input);
  const state = {
    count: 0,
    truncated: false
  };

  const snapshot = snapshotNode(root, state, 0, plan);

  return {
    snapshot,
    truncated: state.truncated,
    nodeCount: state.count
  };
}
