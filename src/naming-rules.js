const SUPPORTED_NAMING_RULE_SETS = [
  'app-screen',
  'header-basic',
  'tab-bar-basic',
  'card-list-basic',
  'fab-basic'
];

function hasChildren(node) {
  return !!node && Array.isArray(node.children) && node.children.length > 0;
}

function walkTree(node, visitor, depth = 0, parent = null) {
  visitor(node, depth, parent);
  if (!hasChildren(node)) {
    return;
  }
  for (const child of node.children) {
    walkTree(child, visitor, depth + 1, node);
  }
}

function directTextChildren(node) {
  if (!hasChildren(node)) {
    return [];
  }
  return node.children.filter((child) => child.type === 'TEXT');
}

function directFrameChildren(node) {
  if (!hasChildren(node)) {
    return [];
  }
  return node.children.filter((child) => child.type !== 'TEXT');
}

function firstMatching(nodes, predicate) {
  for (const node of nodes) {
    if (predicate(node)) {
      return node;
    }
  }
  return null;
}

function collectProposals(root, ruleSet) {
  const proposals = [];
  const add = (node, name) => {
    if (node && name) {
      proposals.push({ nodeId: node.id, name, from: node.name || node.type });
    }
  };

  if (ruleSet === 'header-basic') {
    add(root, 'header/container');
    const titleNode = firstMatching(directTextChildren(root), () => true);
    add(titleNode, 'header/title');
    const actionsNode = firstMatching(directFrameChildren(root), (node) => {
      const features = node.features || {};
      return features.horizontalIcons || (features.iconChildCount || 0) >= 2;
    });
    add(actionsNode, 'header/actions');
    return proposals;
  }

  if (ruleSet === 'card-list-basic') {
    add(root, 'card-list-basic');
    if (hasChildren(root)) {
      for (const child of root.children) {
        if ((child.features || {}).cardLike) {
          add(child, 'recent-card/item');
          const titleNode = firstMatching(directTextChildren(child), () => true);
          add(titleNode, 'recent-card/title');
        }
      }
    }
    return proposals;
  }

  if (ruleSet === 'fab-basic') {
    add(root, 'fab/trigger');
    return proposals;
  }

  if (ruleSet === 'tab-bar-basic') {
    add(root, 'tab-bar/container');
    if (hasChildren(root)) {
      let itemIndex = 0;
      for (const child of root.children) {
        if (child.type === 'TEXT') {
          continue;
        }
        itemIndex += 1;
        add(child, `tab-item/item-${itemIndex}`);
      }
    }
    return proposals;
  }

  add(root, 'app-screen');

  const headerNode = firstMatching(root.children || [], (node) => {
    const features = node.features || {};
    return !!features.headerLike || !!features.atTop || (
      features.layoutMode === 'HORIZONTAL' &&
      !!features.hasTextChild &&
      (features.iconChildCount || 0) >= 1
    );
  });
  if (headerNode) {
    add(headerNode, 'header/container');
    const titleNode = firstMatching(directTextChildren(headerNode), () => true);
    add(titleNode, 'header/title');
    const actionsNode = firstMatching(directFrameChildren(headerNode), (node) => {
      const features = node.features || {};
      return !!features.horizontalIcons || (features.iconChildCount || 0) >= 2;
    });
    add(actionsNode, 'header/actions');
  }

  const inputNode = firstMatching(root.children || [], (node) => !!(node.features || {}).inputLike);
  if (inputNode) {
    add(inputNode, 'ai-query/input');
    const fieldNode = firstMatching(directTextChildren(inputNode), () => true);
    add(fieldNode, 'ai-query/field');
  }

  const cardListNode = firstMatching(root.children || [], (node) => {
    const features = node.features || {};
    return features.sectionKind === 'card-list' || (features.childCardCount || 0) >= 1;
  });
  if (cardListNode) {
    add(cardListNode, 'card-list-basic');
    walkTree(cardListNode, (node) => {
      if ((node.features || {}).cardLike) {
        const titleNode = firstMatching(directTextChildren(node), () => true);
        add(titleNode, 'recent-card/title');
      }
    });
  }

  for (const child of root.children || []) {
    if ((child.features || {}).fabLike) {
      add(child, 'fab/trigger');
    }
  }

  return proposals;
}

export function listSupportedNamingRuleSets() {
  return [...SUPPORTED_NAMING_RULE_SETS];
}

export function buildNamingRulePlan(tree, options = {}) {
  const ruleSet = options.ruleSet || 'app-screen';
  const previewOnly = options.previewOnly !== false;
  const recursive = options.recursive !== false;

  if (!SUPPORTED_NAMING_RULE_SETS.includes(ruleSet)) {
    throw new Error(`Unsupported naming rule set: ${ruleSet}`);
  }

  if (!tree || !tree.id) {
    throw new Error('Naming rule root is required');
  }

  const proposals = collectProposals(tree, ruleSet, recursive);
  const updates = [];
  const skipped = [];
  const seenNames = new Set();

  for (const proposal of proposals) {
    if (seenNames.has(proposal.name)) {
      skipped.push({
        nodeId: proposal.nodeId,
        name: proposal.name,
        reason: `Duplicate target name: ${proposal.name}`
      });
      continue;
    }
    seenNames.add(proposal.name);
    updates.push({ nodeId: proposal.nodeId, name: proposal.name });
  }

  return {
    root: { id: tree.id, name: tree.name || tree.type, type: tree.type },
    ruleSet,
    recursive,
    previewOnly,
    matched: proposals.length,
    renamed: previewOnly ? 0 : updates.length,
    skipped,
    updates
  };
}
