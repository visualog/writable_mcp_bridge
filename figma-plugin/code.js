const BRIDGE_URL = "http://localhost:3845";
const DEFAULT_PLUGIN_ID = "default";
const SUPPORTED_NAMING_RULE_SETS = [
  "app-screen",
  "header-basic",
  "tab-bar-basic",
  "card-list-basic",
  "fab-basic",
  "content-screen-basic",
  "ai-chat-screen"
];
let lastUndoBatch = null;

figma.showUI(__html__, { width: 360, height: 480 });

function serializeNode(node) {
  const base = {
    id: node.id,
    name: node.name,
    type: node.type
  };

  if ("visible" in node) {
    base.visible = node.visible;
  }

  if ("characters" in node) {
    base.characters = node.characters;
  }

  return base;
}

function collectTextNodes(root, output = []) {
  if (root.type === "TEXT") {
    output.push({
      id: root.id,
      name: root.name,
      characters: root.characters
    });
  }

  if ("children" in root) {
    for (const child of root.children) {
      collectTextNodes(child, output);
    }
  }

  return output;
}

function buildNodeSearchMatch(node, depth, includeText) {
  const match = {
    id: node.id,
    name: node.name,
    type: node.type,
    depth,
    childCount: "children" in node ? node.children.length : 0
  };

  if (includeText && "characters" in node) {
    match.characters = node.characters;
  }

  return match;
}

function searchNodes(root, payload = {}) {
  const query =
    typeof payload.query === "string" && payload.query.trim()
      ? payload.query.trim().toLowerCase()
      : null;
  const nodeTypes = Array.isArray(payload.nodeTypes)
    ? payload.nodeTypes
        .filter((value) => typeof value === "string" && value.trim())
        .map((value) => value.trim().toUpperCase())
    : null;
  const maxDepth =
    typeof payload.maxDepth === "number" && Number.isFinite(payload.maxDepth)
      ? Math.max(0, Math.min(8, Math.trunc(payload.maxDepth)))
      : 2;
  const maxResults =
    typeof payload.maxResults === "number" && Number.isFinite(payload.maxResults)
      ? Math.max(1, Math.min(200, Math.trunc(payload.maxResults)))
      : 50;
  const includeText = Boolean(payload.includeText);

  const matches = [];
  let truncated = false;

  function visit(node, depth) {
    if (truncated) {
      return;
    }

    if (depth > 0) {
      const haystacks = [node.name];
      if ("characters" in node && typeof node.characters === "string") {
        haystacks.push(node.characters);
      }

      const queryMatch = !query
        ? true
        : haystacks.some(
            (value) => typeof value === "string" && value.toLowerCase().includes(query)
          );
      const typeMatch = !nodeTypes || nodeTypes.length === 0
        ? true
        : nodeTypes.includes(node.type);

      if (queryMatch && typeMatch) {
        matches.push(buildNodeSearchMatch(node, depth, includeText));
        if (matches.length >= maxResults) {
          truncated = true;
          return;
        }
      }
    }

    if (depth >= maxDepth || !("children" in node)) {
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
    root: serializeNode(root),
    matches,
    truncated
  };
}

async function loadAllFonts(textNode) {
  if (textNode.fontName !== figma.mixed) {
    await figma.loadFontAsync(textNode.fontName);
    return;
  }

  const seen = new Set();
  for (let index = 0; index < textNode.characters.length; index += 1) {
    const font = textNode.getRangeFontName(index, index + 1);
    const key = `${font.family}__${font.style}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    await figma.loadFontAsync(font);
  }
}

async function updateTextNode(nodeId, text) {
  const node = figma.getNodeById(nodeId);
  if (!node || node.type !== "TEXT") {
    throw new Error(`Text node not found: ${nodeId}`);
  }

  await loadAllFonts(node);
  node.characters = text;

  return {
    id: node.id,
    name: node.name,
    characters: node.characters
  };
}

function getTextSnapshot(nodeId) {
  const node = figma.getNodeById(nodeId);
  if (!node || node.type !== "TEXT") {
    throw new Error(`Text node not found: ${nodeId}`);
  }

  return {
    nodeId: node.id,
    text: node.characters
  };
}

function renameNode(nodeId, name) {
  const node = figma.getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  node.name = String(name);

  return {
    id: node.id,
    name: node.name,
    type: node.type
  };
}

function getNameSnapshot(nodeId) {
  const node = figma.getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  return {
    nodeId: node.id,
    name: node.name
  };
}

function normalizeComponentProperty(name, property) {
  return {
    name,
    type: property.type,
    value: property.value,
    preferredValues: Array.isArray(property.preferredValues)
      ? property.preferredValues.map((item) => ({
          type: item.type,
          key: item.key,
          name: item.name
        }))
      : undefined
  };
}

function listComponentProperties(targetNodeId) {
  const node =
    (targetNodeId && figma.getNodeById(targetNodeId)) || figma.currentPage.selection[0];

  if (!node) {
    throw new Error('No selection available');
  }

  if (!('componentProperties' in node) || !node.componentProperties) {
    throw new Error(`Node has no component properties: ${node.id}`);
  }

  const properties = Object.entries(node.componentProperties).map(([name, property]) =>
    normalizeComponentProperty(name, property)
  );

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type,
      isInstance: node.type === 'INSTANCE'
    },
    propertyCount: properties.length,
    properties
  };
}

function setComponentProperty(nodeId, propertyName, value) {
  const node = figma.getNodeById(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  if (node.type !== 'INSTANCE' || !('setProperties' in node)) {
    throw new Error(`Node does not support setProperties: ${nodeId}`);
  }

  if (!node.componentProperties || !(propertyName in node.componentProperties)) {
    throw new Error(`Component property not found: ${propertyName}`);
  }

  node.setProperties({ [propertyName]: value });

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type,
      isInstance: true
    },
    property: normalizeComponentProperty(
      propertyName,
      node.componentProperties[propertyName]
    )
  };
}

function hexToSolidPaint(hex) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) {
    throw new Error(`Unsupported fill color: ${hex}`);
  }

  return {
    type: "SOLID",
    color: {
      r: parseInt(value.slice(0, 2), 16) / 255,
      g: parseInt(value.slice(2, 4), 16) / 255,
      b: parseInt(value.slice(4, 6), 16) / 255
    }
  };
}

const AUTO_LAYOUT_FIELDS = [
  "layoutMode",
  "itemSpacing",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "primaryAxisAlignItems",
  "counterAxisAlignItems",
  "primaryAxisSizingMode",
  "counterAxisSizingMode",
  "layoutGrow",
  "layoutAlign"
];

function resolveTargetNode(nodeId, target = "self") {
  const node = figma.getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  if (target === "parent") {
    if (!node.parent) {
      throw new Error(`Node has no parent: ${nodeId}`);
    }
    return node.parent;
  }

  return node;
}

function applyAutoLayoutProperties(nodeId, node, payload) {
  for (const field of AUTO_LAYOUT_FIELDS) {
    if (!(field in payload) || typeof payload[field] === "undefined") {
      continue;
    }

    if (!(field in node)) {
      throw new Error(`Node does not support ${field}: ${nodeId}`);
    }

    node[field] = payload[field];
  }
}

function readNodePreviewState(node) {
  const state = {
    visible: "visible" in node ? node.visible : undefined,
    cornerRadius: "cornerRadius" in node ? node.cornerRadius : undefined,
    opacity: "opacity" in node ? node.opacity : undefined,
    x: "x" in node ? node.x : undefined,
    y: "y" in node ? node.y : undefined,
    width: "width" in node ? node.width : undefined,
    height: "height" in node ? node.height : undefined,
    fillColor: undefined
  };

  if (
    "fills" in node &&
    Array.isArray(node.fills) &&
    node.fills[0] &&
    node.fills[0].type === "SOLID"
  ) {
    const { r, g, b } = node.fills[0].color;
    state.fillColor = [r, g, b]
      .map((value) => Math.round(value * 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  }

  for (const field of AUTO_LAYOUT_FIELDS) {
    state[field] = field in node ? node[field] : undefined;
  }

  return state;
}

function buildPreviewForUpdate(nodeId, payload) {
  const node = resolveTargetNode(nodeId, payload.target);
  const before = readNodePreviewState(node);
  const after = Object.assign({}, before);

  if (typeof payload.visible === "boolean") {
    if (!("visible" in node)) {
      throw new Error(`Node does not support visible: ${nodeId}`);
    }
    after.visible = payload.visible;
  }

  if (payload.fillColor) {
    if (!("fills" in node)) {
      throw new Error(`Node does not support fills: ${nodeId}`);
    }
    hexToSolidPaint(payload.fillColor);
    after.fillColor = String(payload.fillColor).replace("#", "").toUpperCase();
  }

  if (typeof payload.cornerRadius === "number") {
    if (!("cornerRadius" in node)) {
      throw new Error(`Node does not support cornerRadius: ${nodeId}`);
    }
    after.cornerRadius = payload.cornerRadius;
  }

  if (typeof payload.opacity === "number") {
    if (!("opacity" in node)) {
      throw new Error(`Node does not support opacity: ${nodeId}`);
    }
    after.opacity = payload.opacity;
  }

  for (const field of ["x", "y", "width", "height"].concat(AUTO_LAYOUT_FIELDS)) {
    if (!(field in payload) || typeof payload[field] === "undefined") {
      continue;
    }

    if (!(field in node) && field !== "width" && field !== "height") {
      throw new Error(`Node does not support ${field}: ${nodeId}`);
    }

    after[field] = payload[field];
  }

  const changedFields = Object.keys(after).filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
  );

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type,
      target: payload.target || "self"
    },
    before,
    after,
    changedFields
  };
}

function previewChanges(payload) {
  const updates = Array.isArray(payload.updates)
    ? payload.updates
    : [Object.assign({}, payload, { nodeId: payload.nodeId })];

  return {
    previews: updates.map((item) => buildPreviewForUpdate(item.nodeId, item))
  };
}

function buildInversePayloadFromPreview(payload, preview) {
  const inverse = {
    nodeId: payload.nodeId,
    target: payload.target
  };

  for (const field of preview.changedFields) {
    inverse[field] = preview.before[field];
  }

  return inverse;
}

function setUndoBatch(type, steps) {
  lastUndoBatch = {
    type,
    createdAt: Date.now(),
    steps
  };
}

function clearUndoBatch() {
  lastUndoBatch = null;
}

async function applyUndoStep(step) {
  if (step.type === "update_text") {
    return updateTextNode(step.nodeId, step.text);
  }

  if (step.type === "rename_node") {
    return renameNode(step.nodeId, step.name);
  }

  if (step.type === "update_node") {
    return updateSceneNode(step.nodeId, step.payload);
  }

  throw new Error(`Unsupported undo step: ${step.type}`);
}

async function undoLastBatch() {
  if (!lastUndoBatch) {
    throw new Error("No undo batch available");
  }

  const batch = lastUndoBatch;
  const undone = [];

  for (const step of batch.steps.slice().reverse()) {
    undone.push(await applyUndoStep(step));
  }

  clearUndoBatch();

  return {
    type: batch.type,
    createdAt: batch.createdAt,
    undone
  };
}

function updateSceneNode(nodeId, payload) {
  const node = resolveTargetNode(nodeId, payload.target);

  if (typeof payload.visible === "boolean" && "visible" in node) {
    node.visible = payload.visible;
  }

  if (payload.fillColor) {
    if (!("fills" in node)) {
      throw new Error(`Node does not support fills: ${nodeId}`);
    }

    node.fills = [hexToSolidPaint(payload.fillColor)];
  }

  if (typeof payload.cornerRadius === "number") {
    if (!("cornerRadius" in node)) {
      throw new Error(`Node does not support cornerRadius: ${nodeId}`);
    }

    node.cornerRadius = payload.cornerRadius;
  }

  if (typeof payload.opacity === "number") {
    if (!("opacity" in node)) {
      throw new Error(`Node does not support opacity: ${nodeId}`);
    }

    node.opacity = payload.opacity;
  }

  if (typeof payload.x === "number" && "x" in node) {
    node.x = payload.x;
  }

  if (typeof payload.y === "number" && "y" in node) {
    node.y = payload.y;
  }

  if (
    (typeof payload.width === "number" || typeof payload.height === "number") &&
    "resize" in node
  ) {
    const width = typeof payload.width === "number" ? payload.width : node.width;
    const height =
      typeof payload.height === "number" ? payload.height : node.height;
    node.resize(width, height);
  }

  applyAutoLayoutProperties(nodeId, node, payload);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: "visible" in node ? node.visible : true,
    layoutMode: "layoutMode" in node ? node.layoutMode : undefined,
    itemSpacing: "itemSpacing" in node ? node.itemSpacing : undefined,
    cornerRadius: "cornerRadius" in node ? node.cornerRadius : undefined,
    opacity: "opacity" in node ? node.opacity : undefined
  };
}

function assertInsertParent(parentId) {
  const parent = figma.getNodeById(parentId);

  if (!parent) {
    throw new Error(`Parent not found: ${parentId}`);
  }

  if (!("appendChild" in parent) || typeof parent.appendChild !== "function") {
    throw new Error(`Node cannot contain children: ${parentId}`);
  }

  return parent;
}

function insertNodeIntoParent(parent, node, index) {
  if (typeof index === "number" && "insertChild" in parent && typeof parent.insertChild === "function") {
    const clamped = Math.max(0, Math.min(index, parent.children.length));
    parent.insertChild(clamped, node);
    return clamped;
  }

  parent.appendChild(node);
  return "children" in parent ? parent.children.indexOf(node) : undefined;
}

async function createNode(payload) {
  const parent = assertInsertParent(payload.parentId);
  let node;

  if (payload.nodeType === "FRAME") {
    node = figma.createFrame();
  } else if (payload.nodeType === "RECTANGLE") {
    node = figma.createRectangle();
  } else if (payload.nodeType === "TEXT") {
    node = figma.createText();
    await loadAllFonts(node);
    node.characters = payload.characters;
  } else {
    throw new Error(`Unsupported create node type: ${payload.nodeType}`);
  }

  node.name = payload.name;
  const childIndex = insertNodeIntoParent(parent, node, payload.index);

  updateSceneNode(node.id, {
    width: payload.width,
    height: payload.height,
    x: payload.x,
    y: payload.y,
    fillColor: payload.fillColor,
    cornerRadius: payload.cornerRadius,
    opacity: payload.opacity
  });

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId: parent.id,
    index: childIndex,
    width: "width" in node ? node.width : undefined,
    height: "height" in node ? node.height : undefined,
    characters: node.type === "TEXT" ? node.characters : undefined
  };
}

function duplicateNode(nodeId, count = 1) {
  const source = figma.getNodeById(nodeId);
  if (!source || !("clone" in source)) {
    throw new Error(`Node cannot be duplicated: ${nodeId}`);
  }

  const clones = [];
  for (let index = 0; index < count; index += 1) {
    const clone = source.clone();
    clones.push({
      id: clone.id,
      name: clone.name,
      type: clone.type,
      visible: "visible" in clone ? clone.visible : true
    });
  }

  return clones;
}

function assertMovableSectionNode(nodeId) {
  const node = figma.getNodeById(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const allowedTypes = new Set([
    "FRAME",
    "SECTION",
    "INSTANCE",
    "COMPONENT",
    "COMPONENT_SET"
  ]);

  if (!allowedTypes.has(node.type)) {
    throw new Error(`Node is not a movable section/container: ${nodeId}`);
  }

  return node;
}

function moveNode(nodeId, parentId, index) {
  const node = figma.getNodeById(nodeId);
  const parent = figma.getNodeById(parentId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  if (!parent || !("appendChild" in parent) || !("insertChild" in parent)) {
    throw new Error(`Parent cannot contain children: ${parentId}`);
  }

  if (typeof index === "number") {
    parent.insertChild(index, node);
  } else {
    parent.appendChild(node);
  }

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId: node.parent ? node.parent.id : null
  };
}

function moveSection(sectionId, destinationParentId, index) {
  const section = assertMovableSectionNode(sectionId);
  const sourceParentId = section.parent ? section.parent.id : null;
  const targetParentId = destinationParentId || sourceParentId;

  if (!targetParentId) {
    throw new Error(`Section has no movable parent: ${sectionId}`);
  }

  const result =
    sourceParentId === targetParentId && typeof index === "number"
      ? reorderChild(sectionId, index)
      : moveNode(sectionId, targetParentId, index);

  const node = figma.getNodeById(sectionId);
  const finalIndex =
    node && node.parent && "children" in node.parent
      ? node.parent.children.indexOf(node)
      : null;

  return {
    id: section.id,
    name: section.name,
    type: section.type,
    sourceParentId,
    destinationParentId: targetParentId,
    finalIndex,
    operation:
      sourceParentId === targetParentId && typeof index === "number"
        ? "reorder"
        : "move",
    result
  };
}

function isAutoLayoutContainer(node) {
  return (
    !!node &&
    "layoutMode" in node &&
    node.layoutMode !== "NONE" &&
    "itemSpacing" in node &&
    "paddingLeft" in node &&
    "paddingRight" in node &&
    "paddingTop" in node &&
    "paddingBottom" in node
  );
}

function collectAutoLayoutContainers(root, recursive) {
  const containers = [];

  if (isAutoLayoutContainer(root)) {
    containers.push(root);
  }

  if (!recursive || !("children" in root)) {
    return containers;
  }

  for (const child of root.children) {
    containers.push(...collectAutoLayoutContainers(child, true));
  }

  return containers;
}

function buildNormalizeSpacingPayload(node, spacing, mode) {
  const payload = { nodeId: node.id };

  if (mode === "both" || mode === "gap") {
    payload.itemSpacing = spacing;
  }

  if (mode === "both" || mode === "padding") {
    payload.paddingLeft = spacing;
    payload.paddingRight = spacing;
    payload.paddingTop = spacing;
    payload.paddingBottom = spacing;
  }

  return payload;
}

function normalizeSpacing(containerId, spacing = 8, mode = "both", recursive = false) {
  const root = figma.getNodeById(containerId);

  if (!root) {
    throw new Error(`Node not found: ${containerId}`);
  }

  const targets = collectAutoLayoutContainers(root, recursive);
  if (!targets.length) {
    throw new Error(`No auto layout containers found under: ${containerId}`);
  }

  const previews = [];
  const updates = [];

  for (const node of targets) {
    const payload = buildNormalizeSpacingPayload(node, spacing, mode);
    const preview = buildPreviewForUpdate(node.id, payload);
    previews.push(preview);
    updates.push(payload);
  }

  const updated = updates.map((payload) =>
    updateSceneNode(payload.nodeId, payload)
  );

  setUndoBatch(
    "normalize_spacing",
    updates.map((payload, index) => ({
      type: "update_node",
      nodeId: payload.nodeId,
      payload: buildInversePayloadFromPreview(payload, previews[index])
    }))
  );

  return {
    containerId,
    recursive,
    spacing,
    mode,
    affectedCount: updated.length,
    updated
  };
}

function buildNamingRuleTree(node, rootMetrics, depth) {
  const nextDepth = typeof depth === "number" ? depth : 0;
  const metrics = rootMetrics || {
    width: "width" in node ? node.width : 0,
    height: "height" in node ? node.height : 0
  };
  const children = "children" in node ? node.children.map((child) => buildNamingRuleTree(child, metrics, nextDepth + 1)) : [];
  const textChildren = children.filter((child) => child.type === "TEXT");
  const iconChildCount = children.filter((child) => {
    const width = typeof child.width === "number" ? child.width : 0;
    const height = typeof child.height === "number" ? child.height : 0;
    return child.type !== "TEXT" && width > 0 && height > 0 && width <= 48 && height <= 48;
  }).length;
  const childCardCount = children.filter((child) => !!(child.features && child.features.cardLike)).length;
  const width = "width" in node ? node.width : undefined;
  const height = "height" in node ? node.height : undefined;
  const y = "y" in node ? node.y : undefined;
  const cornerRadius = "cornerRadius" in node ? node.cornerRadius : undefined;

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    width,
    height,
    children,
    features: {
      layoutMode: "layoutMode" in node ? node.layoutMode : undefined,
      hasTextChild: textChildren.length > 0,
      iconChildCount,
      horizontalIcons:
        ("layoutMode" in node ? node.layoutMode : undefined) === "HORIZONTAL" && iconChildCount >= 2,
      atTop: nextDepth === 1 && typeof y === "number" && y <= Math.max(64, metrics.height * 0.2),
      inputLike:
        textChildren.length > 0 &&
        typeof width === "number" &&
        typeof height === "number" &&
        width >= metrics.width * 0.5 &&
        height >= 28 &&
        height <= 72 &&
        typeof cornerRadius === "number" &&
        cornerRadius >= 12,
      sectionKind: childCardCount >= 1 ? "card-list" : undefined,
      childCardCount,
      cardLike:
        textChildren.length > 0 &&
        typeof width === "number" &&
        typeof height === "number" &&
        width > 0 &&
        height > 0 &&
        width < metrics.width * 0.95 &&
        height >= 40,
      fabLike:
        typeof width === "number" &&
        typeof height === "number" &&
        width >= 36 &&
        width <= 88 &&
        height >= 36 &&
        height <= 88 &&
        typeof y === "number" &&
        y >= metrics.height * 0.6,
      renameBlocked: nextDepth > 0 && (node.type === "INSTANCE" || node.type === "COMPONENT" || node.type === "COMPONENT_SET")
    }
  };
}

function firstMatching(nodes, predicate) {
  for (const node of nodes || []) {
    if (predicate(node)) {
      return node;
    }
  }
  return null;
}

function directTextChildrenFromTree(node) {
  return (node.children || []).filter((child) => child.type === "TEXT");
}

function directFrameChildrenFromTree(node) {
  return (node.children || []).filter((child) => child.type !== "TEXT");
}

function lowerNodeNameFromTree(node) {
  return String((node && node.name) || "").toLowerCase();
}

function sectionKindFromTree(node) {
  const features = (node && node.features) || {};
  return String(features.sectionKind || "");
}

function isHeaderNodeFromTree(node) {
  const features = (node && node.features) || {};
  return !!features.headerLike || !!features.atTop || (
    features.layoutMode === "HORIZONTAL" &&
    !!features.hasTextChild &&
    (features.iconChildCount || 0) >= 1
  );
}

function isActionsNodeFromTree(node) {
  const features = (node && node.features) || {};
  return !!features.horizontalIcons || (features.iconChildCount || 0) >= 2;
}

function isInputNodeFromTree(node) {
  const features = (node && node.features) || {};
  const kind = sectionKindFromTree(node);
  return !!features.inputLike || kind === "input-footer" || lowerNodeNameFromTree(node).indexOf("input") !== -1;
}

function isBodyCandidateFromTree(node, excludedIds) {
  if (!node || (excludedIds && excludedIds.has(node.id))) {
    return false;
  }
  const kind = sectionKindFromTree(node);
  if (kind === "answer") {
    return true;
  }
  if (kind && kind !== "input-footer") {
    return true;
  }
  const features = node.features || {};
  return !!features.cardLike || !!features.childCardCount || lowerNodeNameFromTree(node).indexOf("body") !== -1;
}

function collectContentScreenBasicFromTree(root, add) {
  add(root, "screen");
  const rootChildren = root.children || [];
  const headerNode = firstMatching(rootChildren, isHeaderNodeFromTree);
  if (headerNode) {
    add(headerNode, "screen/header");
    add(firstMatching(directTextChildrenFromTree(headerNode), () => true), "screen/header/title");
    add(firstMatching(directFrameChildrenFromTree(headerNode), isActionsNodeFromTree), "screen/header/actions");
  }

  const footerNode = firstMatching(rootChildren, isInputNodeFromTree);
  if (footerNode) {
    add(footerNode, "screen/footer");
  }

  const excludedIds = new Set();
  if (headerNode) {
    excludedIds.add(headerNode.id);
  }
  if (footerNode) {
    excludedIds.add(footerNode.id);
  }
  const bodyNode = firstMatching(rootChildren, (node) => !excludedIds.has(node.id) && sectionKindFromTree(node) === "answer") || firstMatching(rootChildren, (node) => isBodyCandidateFromTree(node, excludedIds));
  if (bodyNode) {
    add(bodyNode, "screen/body");
  }
}

function collectAiChatScreenFromTree(root, add) {
  add(root, "screen");
  const rootChildren = root.children || [];
  const headerNode = firstMatching(rootChildren, isHeaderNodeFromTree);
  if (headerNode) {
    add(headerNode, "screen/header");
    add(firstMatching(directTextChildrenFromTree(headerNode), () => true), "screen/header/title");
    add(firstMatching(directFrameChildrenFromTree(headerNode), isActionsNodeFromTree), "screen/header/actions");
  }

  add(firstMatching(rootChildren, (node) => sectionKindFromTree(node) === "ai-default" || lowerNodeNameFromTree(node).indexOf("ai-default") !== -1), "screen/body/ai-default");
  add(firstMatching(rootChildren, (node) => sectionKindFromTree(node) === "question" || lowerNodeNameFromTree(node).indexOf("question") !== -1), "screen/body/question");
  add(firstMatching(rootChildren, (node) => sectionKindFromTree(node) === "answer" || lowerNodeNameFromTree(node).indexOf("answer") !== -1), "screen/body/answer");
  add(firstMatching(rootChildren, (node) => sectionKindFromTree(node) === "reference-list" || lowerNodeNameFromTree(node).indexOf("reference") !== -1), "screen/body/reference-list");

  const inputNode = firstMatching(rootChildren, isInputNodeFromTree);
  if (inputNode) {
    add(inputNode, "screen/footer/input");
    add(firstMatching(directTextChildrenFromTree(inputNode), () => true), "screen/footer/input-field");
  }
}

function collectNamingRuleProposals(root, ruleSet) {
  const proposals = [];
  const skipped = [];
  const add = (node, name) => {
    if (!node || !name) {
      return;
    }
    if (node.features && node.features.renameBlocked) {
      skipped.push({ nodeId: node.id, name, reason: `Blocked inside component/instance subtree: ${node.id}` });
      return;
    }
    proposals.push({ nodeId: node.id, name });
  };

  if (ruleSet === "header-basic") {
    add(root, "header/container");
    add(firstMatching(directTextChildrenFromTree(root), () => true), "header/title");
    add(firstMatching(directFrameChildrenFromTree(root), isActionsNodeFromTree), "header/actions");
    return { proposals, skipped };
  }

  if (ruleSet === "card-list-basic") {
    add(root, "card-list-basic");
    for (const child of root.children || []) {
      if ((child.features || {}).cardLike) {
        add(child, "recent-card/item");
        add(firstMatching(directTextChildrenFromTree(child), () => true), "recent-card/title");
      }
    }
    return { proposals, skipped };
  }

  if (ruleSet === "fab-basic") {
    add(root, "fab/trigger");
    return { proposals, skipped };
  }

  if (ruleSet === "tab-bar-basic") {
    add(root, "tab-bar/container");
    let itemIndex = 0;
    for (const child of root.children || []) {
      if (child.type === "TEXT") {
        continue;
      }
      itemIndex += 1;
      add(child, `tab-item/item-${itemIndex}`);
    }
    return { proposals, skipped };
  }

  if (ruleSet === "content-screen-basic") {
    collectContentScreenBasicFromTree(root, add);
    return { proposals, skipped };
  }

  if (ruleSet === "ai-chat-screen") {
    collectAiChatScreenFromTree(root, add);
    return { proposals, skipped };
  }

  add(root, "app-screen");
  const rootChildren = root.children || [];
  const headerNode = firstMatching(rootChildren, isHeaderNodeFromTree);
  if (headerNode) {
    add(headerNode, "header/container");
    add(firstMatching(directTextChildrenFromTree(headerNode), () => true), "header/title");
    add(firstMatching(directFrameChildrenFromTree(headerNode), isActionsNodeFromTree), "header/actions");
  }

  const inputNode = firstMatching(rootChildren, isInputNodeFromTree);
  if (inputNode) {
    add(inputNode, "ai-query/input");
    add(firstMatching(directTextChildrenFromTree(inputNode), () => true), "ai-query/field");
  }

  const cardListNode = firstMatching(rootChildren, (node) => {
    const features = node.features || {};
    return features.sectionKind === "card-list" || (features.childCardCount || 0) >= 1;
  });
  if (cardListNode) {
    add(cardListNode, "card-list-basic");
    const stack = [cardListNode];
    while (stack.length) {
      const current = stack.pop();
      for (const child of current.children || []) {
        stack.push(child);
        if ((child.features || {}).cardLike) {
          add(firstMatching(directTextChildrenFromTree(child), () => true), "recent-card/title");
        }
      }
    }
  }

  for (const child of rootChildren) {
    if ((child.features || {}).fabLike) {
      add(child, "fab/trigger");
    }
  }

  return { proposals, skipped };
}

function buildNamingRulePlan(rootNode, options) {
  const ruleSet = options && options.ruleSet ? options.ruleSet : "app-screen";
  const previewOnly = !options || options.previewOnly !== false;
  const recursive = !options || options.recursive !== false;

  if (SUPPORTED_NAMING_RULE_SETS.indexOf(ruleSet) === -1) {
    throw new Error(`Unsupported naming rule set: ${ruleSet}`);
  }

  const tree = buildNamingRuleTree(rootNode);
  const collected = collectNamingRuleProposals(tree, ruleSet, recursive);
  const updates = [];
  const skipped = collected.skipped.slice();
  const seenNames = new Set();

  for (const proposal of collected.proposals) {
    if (seenNames.has(proposal.name)) {
      skipped.push({ nodeId: proposal.nodeId, name: proposal.name, reason: `Duplicate target name: ${proposal.name}` });
      continue;
    }
    seenNames.add(proposal.name);
    updates.push({ nodeId: proposal.nodeId, name: proposal.name });
  }

  return {
    root: { id: rootNode.id, name: rootNode.name, type: rootNode.type },
    ruleSet,
    recursive,
    previewOnly,
    matched: collected.proposals.length,
    renamed: previewOnly ? 0 : updates.length,
    skipped,
    updates
  };
}

function applyNamingRule(rootNodeId, ruleSet, recursive, previewOnly) {
  const rootNode = figma.getNodeById(rootNodeId);
  if (!rootNode) {
    throw new Error(`Node not found: ${rootNodeId}`);
  }

  const plan = buildNamingRulePlan(rootNode, {
    ruleSet,
    recursive,
    previewOnly
  });

  if (plan.previewOnly) {
    return plan;
  }

  const snapshots = plan.updates.map((item) => getNameSnapshot(item.nodeId));
  const renamed = [];
  for (const item of plan.updates) {
    renamed.push(renameNode(item.nodeId, item.name));
  }

  setUndoBatch(
    "apply_naming_rule",
    snapshots.map((snapshot) => ({
      type: "rename_node",
      nodeId: snapshot.nodeId,
      name: snapshot.name
    }))
  );

  return Object.assign({}, plan, {
    previewOnly: false,
    renamed: renamed.length,
    renamedNodes: renamed
  });
}

function supportsAutoLayoutContainer(node) {
  return (
    !!node &&
    "layoutMode" in node &&
    node.layoutMode !== "NONE" &&
    "itemSpacing" in node
  );
}

function buildPromoteSectionPlan(sectionId, destinationParentId, index, normalizeSpacing, previewOnly) {
  const section = assertMovableSectionNode(sectionId);
  const sourceParent = section.parent;

  if (!sourceParent) {
    throw new Error(`Section has no parent: ${sectionId}`);
  }

  const destinationParent = destinationParentId
    ? figma.getNodeById(destinationParentId)
    : sourceParent;

  if (!destinationParent) {
    throw new Error(`Destination parent not found: ${destinationParentId}`);
  }

  if (!("children" in sourceParent)) {
    throw new Error(`Source parent does not expose children: ${sourceParent.id}`);
  }

  const currentIndex = sourceParent.children.indexOf(section);
  const targetIndex = typeof index === "number" ? index : 0;
  const operation =
    sourceParent.id === destinationParent.id
      ? currentIndex === targetIndex
        ? "noop"
        : "reorder"
      : "move";

  let spacingPlan = null;
  if (normalizeSpacing && supportsAutoLayoutContainer(destinationParent)) {
    spacingPlan = {
      containerId: destinationParent.id,
      spacing: typeof normalizeSpacing.spacing === "number" ? normalizeSpacing.spacing : 8,
      mode: normalizeSpacing.mode || "both",
      recursive: Boolean(normalizeSpacing.recursive)
    };
  }

  return {
    section: {
      id: section.id,
      name: section.name,
      type: section.type
    },
    sourceParentId: sourceParent.id,
    destinationParentId: destinationParent.id,
    operation,
    previewOnly: previewOnly !== false,
    movePlan:
      operation === "noop"
        ? null
        : {
            sectionId: section.id,
            destinationParentId: destinationParent.id,
            index: targetIndex
          },
    spacingPlan,
    undoCoverage: {
      move: false,
      spacing: !!spacingPlan
    }
  };
}

function promoteSection(sectionId, destinationParentId, index, normalizeSpacing, previewOnly) {
  const plan = buildPromoteSectionPlan(
    sectionId,
    destinationParentId,
    index,
    normalizeSpacing,
    previewOnly
  );

  if (plan.previewOnly) {
    return plan;
  }

  let moveResult = null;
  if (plan.movePlan) {
    moveResult = moveSection(
      plan.movePlan.sectionId,
      plan.movePlan.destinationParentId,
      plan.movePlan.index
    );
  }

  let spacingResult = null;
  if (plan.spacingPlan) {
    spacingResult = normalizeSpacing(
      plan.spacingPlan.containerId,
      plan.spacingPlan.spacing,
      plan.spacingPlan.mode,
      plan.spacingPlan.recursive
    );
  }

  return {
    section: plan.section,
    sourceParentId: plan.sourceParentId,
    destinationParentId: plan.destinationParentId,
    operation: plan.operation,
    previewOnly: false,
    movePlan: plan.movePlan,
    spacingPlan: plan.spacingPlan,
    undoCoverage: {
      move: false,
      spacing: !!spacingResult
    },
    moveResult,
    spacingResult
  };
}

function deleteNode(nodeId) {
  const node = figma.getNodeById(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  if (!("remove" in node)) {
    throw new Error(`Node cannot be removed: ${nodeId}`);
  }

  const parentId = "parent" in node && node.parent ? node.parent.id : null;
  const snapshot = {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId
  };

  node.remove();
  return snapshot;
}

function reorderChild(nodeId, index) {
  const node = figma.getNodeById(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  if (!("parent" in node) || !node.parent) {
    throw new Error(`Node has no parent: ${nodeId}`);
  }

  const parent = node.parent;
  if (!("insertChild" in parent) || !("children" in parent)) {
    throw new Error(`Parent cannot reorder children: ${parent.id}`);
  }

  const boundedIndex = Math.max(0, Math.min(index, parent.children.length - 1));
  parent.insertChild(boundedIndex, node);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    parentId: parent.id,
    index: parent.children.indexOf(node)
  };
}

async function handleCommand(command) {
  if (command.type === "get_selection") {
    return {
      selection: figma.currentPage.selection.map(serializeNode)
    };
  }

  if (command.type === "list_text_nodes") {
    const root =
      (command.payload.targetNodeId &&
        figma.getNodeById(command.payload.targetNodeId)) ||
      figma.currentPage.selection[0];

    if (!root) {
      throw new Error("No selection available");
    }

    return {
      root: serializeNode(root),
      textNodes: collectTextNodes(root)
    };
  }

  if (command.type === "search_nodes") {
    const root =
      (command.payload.targetNodeId &&
        figma.getNodeById(command.payload.targetNodeId)) ||
      figma.currentPage.selection[0];

    if (!root) {
      throw new Error("No selection available");
    }

    return searchNodes(root, command.payload);
  }

  if (command.type === "list_component_properties") {
    return listComponentProperties(command.payload.targetNodeId);
  }

  if (command.type === "set_component_property") {
    return {
      updated: setComponentProperty(
        command.payload.nodeId,
        command.payload.propertyName,
        command.payload.value
      )
    };
  }

  if (command.type === "preview_changes") {
    return previewChanges(command.payload);
  }

  if (command.type === "update_text") {
    const snapshot = getTextSnapshot(command.payload.nodeId);
    const updated = await updateTextNode(
      command.payload.nodeId,
      command.payload.text
    );
    setUndoBatch("update_text", [
      {
        type: "update_text",
        nodeId: snapshot.nodeId,
        text: snapshot.text
      }
    ]);
    return { updated };
  }

  if (command.type === "bulk_update_texts") {
    const snapshots = (command.payload.updates || []).map((item) =>
      getTextSnapshot(item.nodeId)
    );
    const updated = [];
    for (const item of command.payload.updates || []) {
      updated.push(await updateTextNode(item.nodeId, item.text));
    }
    setUndoBatch(
      "bulk_update_texts",
      snapshots.map((snapshot) => ({
        type: "update_text",
        nodeId: snapshot.nodeId,
        text: snapshot.text
      }))
    );
    return { updated };
  }

  if (command.type === "rename_node") {
    const snapshot = getNameSnapshot(command.payload.nodeId);
    const renamed = renameNode(command.payload.nodeId, command.payload.name);
    setUndoBatch("rename_node", [
      {
        type: "rename_node",
        nodeId: snapshot.nodeId,
        name: snapshot.name
      }
    ]);
    return {
      renamed
    };
  }

  if (command.type === "bulk_rename_nodes") {
    const snapshots = (command.payload.updates || []).map((item) =>
      getNameSnapshot(item.nodeId)
    );
    const renamed = [];
    for (const item of command.payload.updates || []) {
      renamed.push(renameNode(item.nodeId, item.name));
    }
    setUndoBatch(
      "bulk_rename_nodes",
      snapshots.map((snapshot) => ({
        type: "rename_node",
        nodeId: snapshot.nodeId,
        name: snapshot.name
      }))
    );
    return { renamed };
  }

  if (command.type === "update_node") {
    const preview = buildPreviewForUpdate(
      command.payload.nodeId,
      command.payload
    );
    const updated = updateSceneNode(command.payload.nodeId, command.payload);
    setUndoBatch("update_node", [
      {
        type: "update_node",
        nodeId: command.payload.nodeId,
        payload: buildInversePayloadFromPreview(command.payload, preview)
      }
    ]);
    return {
      updated
    };
  }

  if (command.type === "bulk_update_nodes") {
    const previews = (command.payload.updates || []).map((item) =>
      buildPreviewForUpdate(item.nodeId, item)
    );
    const updated = [];
    for (const item of command.payload.updates || []) {
      updated.push(updateSceneNode(item.nodeId, item));
    }
    setUndoBatch(
      "bulk_update_nodes",
      (command.payload.updates || []).map((item, index) => ({
        type: "update_node",
        nodeId: item.nodeId,
        payload: buildInversePayloadFromPreview(item, previews[index])
      }))
    );
    return { updated };
  }

  if (command.type === "create_node") {
    return {
      created: await createNode(command.payload)
    };
  }

  if (command.type === "duplicate_node") {
    return {
      duplicated: duplicateNode(
        command.payload.nodeId,
        Number(command.payload.count || 1)
      )
    };
  }

  if (command.type === "move_node") {
    return {
      moved: moveNode(
        command.payload.nodeId,
        command.payload.parentId,
        command.payload.index
      )
    };
  }

  if (command.type === "move_section") {
    return {
      moved: moveSection(
        command.payload.sectionId,
        command.payload.destinationParentId,
        command.payload.index
      )
    };
  }

  if (command.type === "normalize_spacing") {
    return normalizeSpacing(
      command.payload.containerId,
      Number(command.payload.spacing || 8),
      command.payload.mode || "both",
      Boolean(command.payload.recursive)
    );
  }

  if (command.type === "promote_section") {
    return promoteSection(
      command.payload.sectionId,
      command.payload.destinationParentId,
      command.payload.index,
      command.payload.normalizeSpacing || null,
      command.payload.previewOnly !== false
    );
  }

  if (command.type === "apply_naming_rule") {
    return applyNamingRule(
      command.payload.rootNodeId,
      command.payload.ruleSet || "app-screen",
      command.payload.recursive !== false,
      command.payload.previewOnly !== false
    );
  }

  if (command.type === "delete_node") {
    return {
      deleted: deleteNode(command.payload.nodeId)
    };
  }

  if (command.type === "reorder_child") {
    return {
      reordered: reorderChild(command.payload.nodeId, command.payload.index)
    };
  }

  if (command.type === "undo_last_batch") {
    return {
      undone: await undoLastBatch()
    };
  }

  throw new Error(`Unsupported command type: ${command.type}`);
}

function postSelectionSnapshot() {
  figma.ui.postMessage({
    type: "selection_changed",
    selection: figma.currentPage.selection.map(serializeNode)
  });
}

figma.on("selectionchange", postSelectionSnapshot);
postSelectionSnapshot();

figma.ui.onmessage = async (message) => {
  if (message.type === "execute_command") {
    try {
      const result = await handleCommand(message.command);
      figma.ui.postMessage({
        type: "command_result",
        commandId: message.command.commandId,
        result
      });
    } catch (error) {
      figma.ui.postMessage({
        type: "command_result",
        commandId: message.command.commandId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  if (message.type === "ready") {
    figma.ui.postMessage({
      type: "plugin_ready",
      pluginId: DEFAULT_PLUGIN_ID,
      bridgeUrl: BRIDGE_URL
    });
  }
};
