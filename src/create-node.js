const SUPPORTED_CREATE_NODE_TYPES = ['FRAME', 'TEXT', 'RECTANGLE'];

const DEFAULTS = {
  FRAME: { name: 'frame', width: 160, height: 120 },
  TEXT: { name: 'text', width: 160, height: 24, characters: 'New text' },
  RECTANGLE: { name: 'rectangle', width: 160, height: 120 }
};

export function listSupportedCreateNodeTypes() {
  return [...SUPPORTED_CREATE_NODE_TYPES];
}

function resolveCreateNodeParentId(input = {}) {
  const explicitParentId =
    typeof input.parentId === 'string' && input.parentId.trim().length
      ? input.parentId.trim()
      : null;

  if (explicitParentId) {
    return explicitParentId;
  }

  const defaultParentId =
    typeof input.defaultParentId === 'string' && input.defaultParentId.trim().length
      ? input.defaultParentId.trim()
      : null;

  if (defaultParentId) {
    return defaultParentId;
  }

  throw new Error('parentId is required when there is no registered current page');
}

export function buildCreateNodePlan(input = {}) {
  const parentId = resolveCreateNodeParentId(input);
  const nodeType = input.nodeType;

  if (!SUPPORTED_CREATE_NODE_TYPES.includes(nodeType)) {
    throw new Error(`Unsupported create node type: ${nodeType}`);
  }

  const defaults = DEFAULTS[nodeType];
  const plan = {
    parentId,
    nodeType,
    name: typeof input.name === 'string' && input.name.length ? input.name : defaults.name,
    width: typeof input.width === 'number' ? input.width : defaults.width,
    height: typeof input.height === 'number' ? input.height : defaults.height
  };

  if (typeof input.index === 'number') {
    plan.index = input.index;
  }
  if (typeof input.x === 'number') {
    plan.x = input.x;
  }
  if (typeof input.y === 'number') {
    plan.y = input.y;
  }
  if (typeof input.fillColor === 'string') {
    plan.fillColor = input.fillColor;
  }
  if (typeof input.cornerRadius === 'number') {
    plan.cornerRadius = input.cornerRadius;
  }
  if (typeof input.opacity === 'number') {
    plan.opacity = input.opacity;
  }

  if (nodeType === 'TEXT') {
    plan.characters = typeof input.characters === 'string' ? input.characters : defaults.characters;
    if (typeof input.fontFamily === 'string' && input.fontFamily.length) {
      plan.fontFamily = input.fontFamily;
    }
    if (typeof input.fontStyle === 'string' && input.fontStyle.length) {
      plan.fontStyle = input.fontStyle;
    }
    if (typeof input.fontSize === 'number') {
      plan.fontSize = input.fontSize;
    }
  }

  return plan;
}

export function buildBulkCreateNodesPlan(input = {}) {
  const nodes = Array.isArray(input.nodes) ? input.nodes : [];

  if (!nodes.length) {
    throw new Error('nodes is required');
  }

  return {
    nodes: nodes.map((node) =>
      buildCreateNodePlan({
        defaultParentId: input.defaultParentId,
        ...node
      })
    )
  };
}
