function hasChildren(node) {
  return !!node && Array.isArray(node.children) && node.children.length > 0;
}

function walk(node, parent, visitor) {
  visitor(node, parent);
  if (!hasChildren(node)) {
    return;
  }
  for (const child of node.children) {
    walk(child, node, visitor);
  }
}

function findNodeAndParent(root, targetId) {
  let match = null;
  walk(root, null, (node, parent) => {
    if (!match && node.id === targetId) {
      match = { node, parent };
    }
  });
  return match;
}

function findNode(root, targetId) {
  const match = findNodeAndParent(root, targetId);
  return match ? match.node : null;
}

export function buildPromoteSectionPlan(root, options = {}) {
  if (!root || !root.id) {
    throw new Error('Promotion root is required');
  }

  if (!options.sectionId) {
    throw new Error('sectionId is required');
  }

  const sectionMatch = findNodeAndParent(root, options.sectionId);
  if (!sectionMatch) {
    throw new Error(`Section not found: ${options.sectionId}`);
  }

  const section = sectionMatch.node;
  const sourceParent = sectionMatch.parent;
  if (!sourceParent) {
    throw new Error(`Section has no parent: ${options.sectionId}`);
  }

  const destinationParent = options.destinationParentId
    ? findNode(root, options.destinationParentId)
    : sourceParent;

  if (!destinationParent) {
    throw new Error(`Destination parent not found: ${options.destinationParentId}`);
  }

  const sourceParentId = sourceParent.id;
  const destinationParentId = destinationParent.id;
  const requestedIndex = typeof options.index === 'number' ? options.index : 0;
  const currentIndex = Array.isArray(sourceParent.children)
    ? sourceParent.children.findIndex((child) => child.id === section.id)
    : -1;
  const operation =
    sourceParentId === destinationParentId
      ? currentIndex === requestedIndex
        ? 'noop'
        : 'reorder'
      : 'move';

  const movePlan = operation === 'noop'
    ? null
    : {
        sectionId: section.id,
        destinationParentId,
        index: requestedIndex
      };

  let spacingPlan = null;
  if (options.normalizeSpacing && destinationParent.supportsAutoLayout) {
    spacingPlan = {
      containerId: destinationParentId,
      spacing: typeof options.normalizeSpacing.spacing === 'number' ? options.normalizeSpacing.spacing : 8,
      mode: options.normalizeSpacing.mode || 'both',
      recursive: Boolean(options.normalizeSpacing.recursive)
    };
  }

  return {
    section: { id: section.id, name: section.name || section.type, type: section.type },
    sourceParentId,
    destinationParentId,
    operation,
    previewOnly: options.previewOnly !== false,
    movePlan,
    spacingPlan,
    undoCoverage: {
      move: false,
      spacing: !!spacingPlan
    }
  };
}
