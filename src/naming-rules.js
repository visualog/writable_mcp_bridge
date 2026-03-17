const SUPPORTED_NAMING_RULE_SETS = [
  'app-screen',
  'header-basic',
  'tab-bar-basic',
  'card-list-basic',
  'fab-basic',
  'content-screen-basic',
  'ai-chat-screen'
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

function lowerName(node) {
  return String((node && node.name) || '').toLowerCase();
}

function sectionKind(node) {
  return String((((node || {}).features || {}).sectionKind) || '');
}

function isHeaderNode(node) {
  const features = (node || {}).features || {};
  return !!features.headerLike || !!features.atTop || (
    features.layoutMode === 'HORIZONTAL' &&
    !!features.hasTextChild &&
    (features.iconChildCount || 0) >= 1
  );
}

function isActionsNode(node) {
  const features = (node || {}).features || {};
  return !!features.horizontalIcons || (features.iconChildCount || 0) >= 2;
}

function isInputNode(node) {
  const features = (node || {}).features || {};
  const kind = sectionKind(node);
  return !!features.inputLike || kind === 'input-footer' || lowerName(node).includes('input');
}

function isBodyCandidate(node, excludedIds = new Set()) {
  if (!node || excludedIds.has(node.id)) {
    return false;
  }
  const kind = sectionKind(node);
  if (kind === 'answer') {
    return true;
  }
  if (kind && kind !== 'input-footer') {
    return true;
  }
  const features = node.features || {};
  return !!features.cardLike || !!features.childCardCount || lowerName(node).includes('body');
}

function collectContentScreenBasic(root, add) {
  add(root, 'screen');
  const rootChildren = root.children || [];

  const headerNode = firstMatching(rootChildren, isHeaderNode);
  if (headerNode) {
    add(headerNode, 'screen/header');
    add(firstMatching(directTextChildren(headerNode), () => true), 'screen/header/title');
    add(firstMatching(directFrameChildren(headerNode), isActionsNode), 'screen/header/actions');
  }

  const footerNode = firstMatching(rootChildren, isInputNode);
  if (footerNode) {
    add(footerNode, 'screen/footer');
  }

  const excludedIds = new Set([headerNode && headerNode.id, footerNode && footerNode.id].filter(Boolean));
  const bodyNode = firstMatching(rootChildren, (node) => !excludedIds.has(node.id) && sectionKind(node) === "answer") || firstMatching(rootChildren, (node) => isBodyCandidate(node, excludedIds));
  if (bodyNode) {
    add(bodyNode, 'screen/body');
  }
}

function collectAiChatScreen(root, add) {
  add(root, 'screen');
  const rootChildren = root.children || [];

  const headerNode = firstMatching(rootChildren, isHeaderNode);
  if (headerNode) {
    add(headerNode, 'screen/header');
    add(firstMatching(directTextChildren(headerNode), () => true), 'screen/header/title');
    add(firstMatching(directFrameChildren(headerNode), isActionsNode), 'screen/header/actions');
  }

  const aiDefaultNode = firstMatching(rootChildren, (node) => sectionKind(node) === 'ai-default' || lowerName(node).includes('ai-default'));
  add(aiDefaultNode, 'screen/body/ai-default');

  const questionNode = firstMatching(rootChildren, (node) => sectionKind(node) === 'question' || lowerName(node).includes('question'));
  add(questionNode, 'screen/body/question');

  const answerNode = firstMatching(rootChildren, (node) => sectionKind(node) === 'answer' || lowerName(node).includes('answer'));
  add(answerNode, 'screen/body/answer');

  const referenceNode = firstMatching(rootChildren, (node) => sectionKind(node) === 'reference-list' || lowerName(node).includes('reference'));
  add(referenceNode, 'screen/body/reference-list');

  const inputNode = firstMatching(rootChildren, isInputNode);
  if (inputNode) {
    add(inputNode, 'screen/footer/input');
    add(firstMatching(directTextChildren(inputNode), () => true), 'screen/footer/input-field');
  }
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
    const actionsNode = firstMatching(directFrameChildren(root), isActionsNode);
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

  if (ruleSet === 'content-screen-basic') {
    collectContentScreenBasic(root, add);
    return proposals;
  }

  if (ruleSet === 'ai-chat-screen') {
    collectAiChatScreen(root, add);
    return proposals;
  }

  add(root, 'app-screen');

  const headerNode = firstMatching(root.children || [], isHeaderNode);
  if (headerNode) {
    add(headerNode, 'header/container');
    const titleNode = firstMatching(directTextChildren(headerNode), () => true);
    add(titleNode, 'header/title');
    const actionsNode = firstMatching(directFrameChildren(headerNode), isActionsNode);
    add(actionsNode, 'header/actions');
  }

  const inputNode = firstMatching(root.children || [], isInputNode);
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
