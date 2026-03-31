const BRIDGE_URL = "http://localhost:3846";
const SESSION_PLUGIN_ID = figma.fileKey
  ? `file:${figma.fileKey}`
  : `page:${figma.currentPage.id}`;
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
const LOCAL_SEARCH_CACHE_TTL_MS = 10000;
const localSearchCache = {
  styles: null,
  variables: null,
  components: null
};
const SIMPLE_BINDABLE_FIELDS = [
  "height",
  "width",
  "characters",
  "itemSpacing",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "visible",
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "counterAxisSpacing",
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
  "opacity",
  "gridRowGap",
  "gridColumnGap",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paragraphSpacing",
  "paragraphIndent"
];
const PAINT_BINDABLE_FIELDS = ["fills.color", "strokes.color"];

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

function buildInstanceSearchMatch(node, depth, includeProperties) {
  const match = {
    id: node.id,
    name: node.name,
    type: node.type,
    depth
  };

  if (typeof node.mainComponent !== "undefined" && node.mainComponent) {
    match.mainComponent = {
      id: node.mainComponent.id,
      key: node.mainComponent.key || null,
      name: node.mainComponent.name
    };
  } else {
    match.mainComponent = null;
  }

  if (includeProperties && typeof node.componentProperties !== "undefined") {
    match.componentProperties = node.componentProperties;
  }

  return match;
}

function searchInstances(payload = {}) {
  const roots = resolveTargetRoots(payload);
  const loweredQuery =
    typeof payload.query === "string" && payload.query.trim()
      ? payload.query.trim().toLowerCase()
      : null;
  const maxDepth =
    typeof payload.maxDepth === "number" && Number.isFinite(payload.maxDepth)
      ? Math.max(0, Math.min(10, Math.trunc(payload.maxDepth)))
      : 4;
  const maxResults =
    typeof payload.maxResults === "number" && Number.isFinite(payload.maxResults)
      ? Math.max(1, Math.min(300, Math.trunc(payload.maxResults)))
      : 100;
  const includeProperties = payload.includeProperties !== false;

  const matches = [];
  let truncated = false;

  function instanceMatchesQuery(node) {
    if (!loweredQuery) {
      return true;
    }

    const haystacks = [node.name];
    if (typeof node.mainComponent !== "undefined" && node.mainComponent) {
      haystacks.push(node.mainComponent.name);
      if (node.mainComponent.key) {
        haystacks.push(node.mainComponent.key);
      }
    }

    return haystacks.some(
      (value) => typeof value === "string" && value.toLowerCase().includes(loweredQuery)
    );
  }

  function visit(node, depth) {
    if (truncated) {
      return;
    }

    if (node.type === "INSTANCE" && instanceMatchesQuery(node)) {
      matches.push(buildInstanceSearchMatch(node, depth, includeProperties));
      if (matches.length >= maxResults) {
        truncated = true;
        return;
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

  for (const root of roots) {
    visit(root, 0);
    if (truncated) {
      break;
    }
  }

  return {
    pluginId: SESSION_PLUGIN_ID,
    fileKey: figma.fileKey || null,
    fileName: figma.root && figma.root.name ? figma.root.name : null,
    roots: roots.map(serializeNode),
    matches,
    truncated
  };
}

function getSolidFillColor(node) {
  if (!("fills" in node) || !Array.isArray(node.fills)) {
    return undefined;
  }

  const firstFill = node.fills[0];
  if (!firstFill || firstFill.type !== "SOLID") {
    return undefined;
  }

  const color = firstFill.color;
  return [color.r, color.g, color.b]
    .map((value) => Math.round(value * 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function buildSnapshotConfig(payload) {
  return {
    maxDepth:
      typeof payload.maxDepth === "number" && Number.isFinite(payload.maxDepth)
        ? Math.max(0, Math.min(5, Math.trunc(payload.maxDepth)))
        : 3,
    maxNodes:
      typeof payload.maxNodes === "number" && Number.isFinite(payload.maxNodes)
        ? Math.max(1, Math.min(200, Math.trunc(payload.maxNodes)))
        : 50,
    placeholderInstances: payload.placeholderInstances !== false
  };
}

function serializeSnapshotNode(node, depth, state, config) {
  const supportedNodeTypes = [
    "FRAME",
    "GROUP",
    "RECTANGLE",
    "TEXT",
    "INSTANCE",
    "COMPONENT",
    "COMPONENT_SET"
  ];
  if (!supportedNodeTypes.includes(node.type)) {
    throw new Error(`Unsupported node type: ${node.type}`);
  }

  if (state.count >= config.maxNodes) {
    state.truncated = true;
    return null;
  }

  state.count += 1;

  const snapshot = {
    name: node.name,
    type: node.type,
    x: "x" in node && typeof node.x === "number" ? node.x : 0,
    y: "y" in node && typeof node.y === "number" ? node.y : 0,
    width: "width" in node && typeof node.width === "number" ? node.width : undefined,
    height: "height" in node && typeof node.height === "number" ? node.height : undefined,
    visible: "visible" in node ? node.visible : true,
    opacity: "opacity" in node && typeof node.opacity === "number" ? node.opacity : undefined,
    cornerRadius:
      "cornerRadius" in node && typeof node.cornerRadius === "number"
        ? node.cornerRadius
        : undefined,
    fillColor: getSolidFillColor(node),
    children: []
  };

  if (node.type === "TEXT") {
    snapshot.characters = node.characters;
  }

  if (node.type === "INSTANCE") {
    return snapshot;
  }

  if (depth >= config.maxDepth) {
    if ("children" in node && node.children.length > 0) {
      state.truncated = true;
    }
    return snapshot;
  }

  if (!("children" in node)) {
    return snapshot;
  }

  for (const child of node.children) {
    const childSnapshot = serializeSnapshotNode(child, depth + 1, state, config);
    if (childSnapshot) {
      snapshot.children.push(childSnapshot);
    }
  }

  return snapshot;
}

function snapshotSelection(payload) {
  const root =
    (payload.targetNodeId && figma.getNodeById(payload.targetNodeId)) ||
    figma.currentPage.selection[0];

  if (!root) {
    throw new Error("No selection available");
  }

  const config = buildSnapshotConfig(payload || {});
  const state = {
    count: 0,
    truncated: false
  };
  const snapshot = serializeSnapshotNode(root, 0, state, config);

  return {
    pluginId: SESSION_PLUGIN_ID,
    fileKey: figma.fileKey || null,
    fileName: figma.root && figma.root.name ? figma.root.name : null,
    root: serializeNode(root),
    snapshot,
    nodeCount: state.count,
    truncated: state.truncated
  };
}

function resolveTargetRoots(payload = {}) {
  if (payload.targetNodeId) {
    const node = figma.getNodeById(payload.targetNodeId);
    if (!node) {
      throw new Error(`Target node not found: ${payload.targetNodeId}`);
    }
    return [node];
  }

  if (figma.currentPage.selection.length > 0) {
    return figma.currentPage.selection.slice();
  }

  return [figma.currentPage];
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildMetadataConfig(payload = {}) {
  return {
    maxDepth:
      typeof payload.maxDepth === "number" && Number.isFinite(payload.maxDepth)
        ? Math.max(0, Math.min(8, Math.trunc(payload.maxDepth)))
        : 4,
    maxNodes:
      typeof payload.maxNodes === "number" && Number.isFinite(payload.maxNodes)
        ? Math.max(1, Math.min(500, Math.trunc(payload.maxNodes)))
        : 200
  };
}

function appendMetadataAttributes(node, attributes) {
  attributes.push(`id="${escapeXml(node.id)}"`);
  attributes.push(`name="${escapeXml(node.name || node.type)}"`);
  attributes.push(`type="${escapeXml(node.type)}"`);

  if ("x" in node && typeof node.x === "number") {
    attributes.push(`x="${Math.round(node.x)}"`);
  }
  if ("y" in node && typeof node.y === "number") {
    attributes.push(`y="${Math.round(node.y)}"`);
  }
  if ("width" in node && typeof node.width === "number") {
    attributes.push(`width="${Math.round(node.width)}"`);
  }
  if ("height" in node && typeof node.height === "number") {
    attributes.push(`height="${Math.round(node.height)}"`);
  }
  if ("visible" in node && node.visible === false) {
    attributes.push(`visible="false"`);
  }
}

function serializeMetadataNode(node, depth, state, config, lines, indentLevel) {
  if (state.count >= config.maxNodes) {
    state.truncated = true;
    return;
  }

  state.count += 1;

  const tagName = String(node.type || "NODE").toLowerCase();
  const attributes = [];
  appendMetadataAttributes(node, attributes);

  const children = "children" in node ? node.children : [];
  const shouldRecurse = depth < config.maxDepth && children.length > 0;

  if (!shouldRecurse) {
    if (children.length > 0) {
      state.truncated = true;
    }
    lines.push(`${"  ".repeat(indentLevel)}<${tagName} ${attributes.join(" ")} />`);
    return;
  }

  lines.push(`${"  ".repeat(indentLevel)}<${tagName} ${attributes.join(" ")}>`);
  for (const child of children) {
    serializeMetadataNode(child, depth + 1, state, config, lines, indentLevel + 1);
    if (state.count >= config.maxNodes) {
      state.truncated = true;
      break;
    }
  }
  lines.push(`${"  ".repeat(indentLevel)}</${tagName}>`);
}

function getMetadata(payload = {}) {
  const roots = resolveTargetRoots(payload);
  const config = buildMetadataConfig(payload);
  const state = {
    count: 0,
    truncated: false
  };
  const lines = [
    `<selection pageId="${escapeXml(figma.currentPage.id)}" pageName="${escapeXml(
      figma.currentPage.name
    )}" fileKey="${escapeXml(figma.fileKey || "")}" fileName="${escapeXml(
      (figma.root && figma.root.name) || ""
    )}">`
  ];

  for (const root of roots) {
    serializeMetadataNode(root, 0, state, config, lines, 1);
    if (state.count >= config.maxNodes) {
      state.truncated = true;
      break;
    }
  }

  lines.push(`</selection>`);

  return {
    pluginId: SESSION_PLUGIN_ID,
    fileKey: figma.fileKey || null,
    fileName: figma.root && figma.root.name ? figma.root.name : null,
    roots: roots.map(serializeNode),
    xml: lines.join("\n"),
    nodeCount: state.count,
    truncated: state.truncated
  };
}

function rgbaToTokenValue(color) {
  const red = Math.round(color.r * 255);
  const green = Math.round(color.g * 255);
  const blue = Math.round(color.b * 255);
  const alpha = typeof color.a === "number" ? Number(color.a.toFixed(3)) : 1;

  return {
    red,
    green,
    blue,
    alpha,
    hex: `#${[red, green, blue]
      .map((value) => value.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()}`
  };
}

function formatVariableValue(value) {
  if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if ("r" in value && "g" in value && "b" in value) {
    return rgbaToTokenValue(value);
  }

  if (value.type === "VARIABLE_ALIAS" && typeof value.id === "string") {
    return {
      type: "VARIABLE_ALIAS",
      id: value.id
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => formatVariableValue(item));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, formatVariableValue(nested)])
  );
}

function collectVariableAliases(value, propertyPath, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectVariableAliases(item, `${propertyPath}[${index}]`, output);
    });
    return output;
  }

  if (!value || typeof value !== "object") {
    return output;
  }

  if (value.type === "VARIABLE_ALIAS" && typeof value.id === "string") {
    output.push({
      variableId: value.id,
      property: propertyPath
    });
    return output;
  }

  for (const [key, nested] of Object.entries(value)) {
    const nextPath = propertyPath ? `${propertyPath}.${key}` : key;
    collectVariableAliases(nested, nextPath, output);
  }

  return output;
}

async function getVariableByIdAny(variableId) {
  if (figma.variables && typeof figma.variables.getVariableByIdAsync === "function") {
    return figma.variables.getVariableByIdAsync(variableId);
  }

  if (figma.variables && typeof figma.variables.getVariableById === "function") {
    return figma.variables.getVariableById(variableId);
  }

  return null;
}

async function getVariableByKeyAny(variableKey) {
  if (!variableKey) {
    return null;
  }

  if (figma.variables && typeof figma.variables.importVariableByKeyAsync === "function") {
    return figma.variables.importVariableByKeyAsync(variableKey);
  }

  return null;
}

async function getStyleByKeyAny(styleKey) {
  if (!styleKey) {
    return null;
  }

  if (typeof figma.importStyleByKeyAsync === "function") {
    return figma.importStyleByKeyAsync(styleKey);
  }

  return null;
}

async function getVariableCollectionByIdAny(collectionId) {
  if (!collectionId) {
    return null;
  }

  if (
    figma.variables &&
    typeof figma.variables.getVariableCollectionByIdAsync === "function"
  ) {
    return figma.variables.getVariableCollectionByIdAsync(collectionId);
  }

  if (figma.variables && typeof figma.variables.getVariableCollectionById === "function") {
    return figma.variables.getVariableCollectionById(collectionId);
  }

  return null;
}

async function describeVariableUsage(variableId, usages) {
  const variable = await getVariableByIdAny(variableId);
  if (!variable) {
    return {
      id: variableId,
      name: null,
      collection: null,
      resolvedType: null,
      valuesByMode: null,
      usages
    };
  }

  const collection = await getVariableCollectionByIdAny(variable.variableCollectionId);
  const valuesByMode = {};
  for (const [modeId, value] of Object.entries(variable.valuesByMode || {})) {
    const matchedMode =
      collection && Array.isArray(collection.modes)
        ? collection.modes.find((mode) => mode.modeId === modeId)
        : null;
    const modeName =
      matchedMode && typeof matchedMode.name === "string"
        ? matchedMode.name
        : modeId;
    valuesByMode[modeName] = formatVariableValue(value);
  }

  return {
    id: variable.id,
    key: "key" in variable ? variable.key || null : null,
    name: variable.name,
    collection: collection ? collection.name : null,
    resolvedType: variable.resolvedType || null,
    valuesByMode,
    usages
  };
}

function describeStyleUsage(styleId, usages) {
  const style = typeof figma.getStyleById === "function" ? figma.getStyleById(styleId) : null;
  if (!style) {
    return {
      id: styleId,
      key: null,
      name: null,
      styleType: null,
      usages
    };
  }

  return {
    id: style.id,
    key: "key" in style ? style.key || null : null,
    name: style.name,
    description: "description" in style ? style.description || "" : "",
    styleType: style.type,
    usages
  };
}

function resolveStyleField(styleType) {
  if (styleType === "text") {
    return "textStyleId";
  }

  if (styleType === "effect") {
    return "effectStyleId";
  }

  throw new Error(`Unsupported style type: ${styleType}`);
}

async function resolveStyleForApplication(payload) {
  if (payload.clear === true) {
    return null;
  }

  if (typeof payload.styleId === "string" && payload.styleId) {
    const style = typeof figma.getStyleById === "function"
      ? figma.getStyleById(payload.styleId)
      : null;
    if (!style) {
      throw new Error(`Style not found: ${payload.styleId}`);
    }
    return style;
  }

  if (typeof payload.styleKey === "string" && payload.styleKey) {
    const style = await getStyleByKeyAny(payload.styleKey);
    if (!style) {
      throw new Error(`Style not found for key: ${payload.styleKey}`);
    }
    return style;
  }

  throw new Error("styleId, styleKey, or clear=true is required");
}

async function applyStyle(nodeId, styleType, payload) {
  const node = figma.getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const styleField = resolveStyleField(styleType);
  if (!(styleField in node)) {
    throw new Error(`Node does not support ${styleField}: ${nodeId}`);
  }

  const style = await resolveStyleForApplication(payload);
  const previousStyleId = node[styleField] || "";

  node[styleField] = style ? style.id : "";

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type
    },
    styleType,
    action: style ? "applied" : "cleared",
    style: style ? describeStyleUsage(style.id, []) : null,
    previousStyleId: previousStyleId || null
  };
}

async function summarizeVariable(variable) {
  if (!variable) {
    return null;
  }

  const collection = await getVariableCollectionByIdAny(variable.variableCollectionId);
  return {
    id: variable.id,
    key: "key" in variable ? variable.key || null : null,
    name: variable.name || null,
    collection: collection ? collection.name : null,
    resolvedType: variable.resolvedType || null
  };
}

function isSupportedBindableProperty(property) {
  return SIMPLE_BINDABLE_FIELDS.indexOf(property) !== -1 ||
    PAINT_BINDABLE_FIELDS.indexOf(property) !== -1;
}

function readCurrentBoundVariableId(node, property) {
  if (!node || !("boundVariables" in node) || !node.boundVariables) {
    return null;
  }

  const sourceProperty = property === "fills.color"
    ? "fills"
    : property === "strokes.color"
      ? "strokes"
      : property;
  const aliases = collectVariableAliases(node.boundVariables[sourceProperty], sourceProperty, []);
  return aliases.length > 0 ? aliases[0].variableId : null;
}

async function resolveVariableForBinding(payload) {
  if (payload.unbind === true) {
    return null;
  }

  if (typeof payload.variableId === "string" && payload.variableId) {
    const variable = await getVariableByIdAny(payload.variableId);
    if (!variable) {
      throw new Error(`Variable not found: ${payload.variableId}`);
    }
    return variable;
  }

  if (typeof payload.variableKey === "string" && payload.variableKey) {
    const variable = await getVariableByKeyAny(payload.variableKey);
    if (!variable) {
      throw new Error(`Variable not found for key: ${payload.variableKey}`);
    }
    return variable;
  }

  throw new Error("variableId, variableKey, or unbind=true is required");
}

function applyPaintVariableBinding(node, property, variable) {
  const paintField = property === "fills.color" ? "fills" : "strokes";

  if (!(paintField in node) || !Array.isArray(node[paintField])) {
    throw new Error(`Node does not support ${paintField}: ${node.id}`);
  }

  if (
    !figma.variables ||
    typeof figma.variables.setBoundVariableForPaint !== "function"
  ) {
    throw new Error("Figma paint variable binding API is not available");
  }

  const paints = node[paintField].slice();
  const firstSolidPaintIndex = paints.findIndex((paint) => paint && paint.type === "SOLID");

  if (firstSolidPaintIndex === -1) {
    throw new Error(`Node has no solid ${paintField} paint to bind: ${node.id}`);
  }

  paints[firstSolidPaintIndex] = figma.variables.setBoundVariableForPaint(
    paints[firstSolidPaintIndex],
    "color",
    variable
  );
  node[paintField] = paints;
}

async function bindVariable(nodeId, property, payload) {
  const node = figma.getNodeById(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  if (!isSupportedBindableProperty(property)) {
    throw new Error(`Unsupported bindable property: ${property}`);
  }

  const variable = await resolveVariableForBinding(payload);
  const previousVariableId = readCurrentBoundVariableId(node, property);

  if (PAINT_BINDABLE_FIELDS.indexOf(property) !== -1) {
    applyPaintVariableBinding(node, property, variable);
  } else {
    if (!("setBoundVariable" in node) || typeof node.setBoundVariable !== "function") {
      throw new Error(`Node does not support variable binding: ${nodeId}`);
    }

    node.setBoundVariable(property, variable);
  }

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type
    },
    property,
    action: variable ? "bound" : "unbound",
    variable: await summarizeVariable(variable),
    previousVariableId
  };
}

function collectSceneNodes(root, output = []) {
  output.push(root);
  if ("children" in root && Array.isArray(root.children)) {
    for (const child of root.children) {
      collectSceneNodes(child, output);
    }
  }
  return output;
}

function normalizeAssetMatch(item) {
  const normalized = Object.assign({}, item);
  normalized.name = item.name || "";
  normalized.description = item.description || "";
  normalized.containingFrame =
    item.containingFrame && typeof item.containingFrame.name === "string"
      ? { name: item.containingFrame.name }
      : null;
  return normalized;
}

function normalizeSearchQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function assetMatchesQuery(item, loweredQuery) {
  if (!loweredQuery) {
    return true;
  }

  const haystacks = [
    item.name,
    item.description,
    item.collection,
    item.styleType,
    item.assetType,
    item.containingFrame && item.containingFrame.name
  ];

  for (const value of haystacks) {
    if (typeof value === "string" && value.toLowerCase().includes(loweredQuery)) {
      return true;
    }
  }

  return false;
}

function readCachedLocalAssets(key) {
  const cached = localSearchCache[key];
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.createdAt > LOCAL_SEARCH_CACHE_TTL_MS) {
    localSearchCache[key] = null;
    return null;
  }

  return cached.items;
}

function writeCachedLocalAssets(key, items) {
  localSearchCache[key] = {
    createdAt: Date.now(),
    items
  };
  return items;
}

function getComponentContainingFrame(node) {
  let current = node.parent;
  while (current) {
    if (current.type === "FRAME" || current.type === "SECTION" || current.type === "COMPONENT_SET") {
      return { name: current.name };
    }
    current = current.parent;
  }
  return null;
}

function getLocalStyleMatches(loweredQuery, maxResults) {
  const cached = readCachedLocalAssets("styles");
  if (cached) {
    return cached.filter((item) => assetMatchesQuery(item, loweredQuery)).slice(0, maxResults);
  }

  const styles = [];
  const sources = [];
  if (typeof figma.getLocalPaintStyles === "function") {
    sources.push.apply(sources, figma.getLocalPaintStyles());
  }
  if (typeof figma.getLocalTextStyles === "function") {
    sources.push.apply(sources, figma.getLocalTextStyles());
  }
  if (typeof figma.getLocalEffectStyles === "function") {
    sources.push.apply(sources, figma.getLocalEffectStyles());
  }
  if (typeof figma.getLocalGridStyles === "function") {
    sources.push.apply(sources, figma.getLocalGridStyles());
  }

  for (const style of sources) {
    styles.push(normalizeAssetMatch({
      sourceType: "LOCAL_STYLE",
      assetType: "STYLE",
      id: style.id,
      key: "key" in style ? style.key || null : null,
      styleType: style.type || null,
      name: style.name || "",
      description: "description" in style ? style.description || "" : ""
    }));
  }

  writeCachedLocalAssets("styles", styles);
  return styles.filter((item) => assetMatchesQuery(item, loweredQuery)).slice(0, maxResults);
}

async function getLocalVariableMatches(loweredQuery, maxResults) {
  if (!figma.variables) {
    return [];
  }

  const cached = readCachedLocalAssets("variables");
  if (cached) {
    return cached.filter((item) => assetMatchesQuery(item, loweredQuery)).slice(0, maxResults);
  }

  let variables = [];

  if (typeof figma.variables.getLocalVariablesAsync === "function") {
    variables = await figma.variables.getLocalVariablesAsync();
  } else if (typeof figma.variables.getLocalVariables === "function") {
    variables = figma.variables.getLocalVariables();
  }

  const items = variables.map((variable) =>
    normalizeAssetMatch({
      sourceType: "LOCAL_VARIABLE",
      assetType: "VARIABLE",
      id: variable.id,
      key: "key" in variable ? variable.key || null : null,
      name: variable.name || "",
      description: "",
      collection: variable.variableCollectionId || null,
      resolvedType: variable.resolvedType || null
    })
  );

  writeCachedLocalAssets("variables", items);
  return items.filter((item) => assetMatchesQuery(item, loweredQuery)).slice(0, maxResults);
}

function getLocalComponentMatches(loweredQuery, maxResults) {
  const cached = readCachedLocalAssets("components");
  if (cached) {
    return cached.filter((item) => assetMatchesQuery(item, loweredQuery)).slice(0, maxResults);
  }

  const nodes = collectSceneNodes(figma.root, []);
  const matches = [];

  for (const node of nodes) {
    if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
      continue;
    }

    matches.push(
      normalizeAssetMatch({
        sourceType: node.type === "COMPONENT" ? "LOCAL_COMPONENT" : "LOCAL_COMPONENT_SET",
        assetType: node.type,
        id: node.id,
        key: "key" in node ? node.key || null : null,
        nodeId: node.id,
        name: node.name || "",
        description: "description" in node ? node.description || "" : "",
        containingFrame: getComponentContainingFrame(node)
      })
    );
  }

  writeCachedLocalAssets("components", matches);
  return matches.filter((item) => assetMatchesQuery(item, loweredQuery)).slice(0, maxResults);
}

async function searchDesignSystem(payload = {}) {
  const loweredQuery = normalizeSearchQuery(payload.query);
  const includeComponents = payload.includeComponents !== false;
  const includeStyles = payload.includeStyles !== false;
  const includeVariables = payload.includeVariables !== false;
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const includeLocalSource =
    sources.length === 0 ||
    sources.indexOf("all") !== -1 ||
    sources.indexOf("local-file") !== -1;
  const maxResults =
    typeof payload.maxResults === "number" && Number.isFinite(payload.maxResults)
      ? Math.max(1, Math.min(100, Math.trunc(payload.maxResults)))
      : 30;
  const localLimit = Math.max(maxResults * 2, maxResults);

  if (!includeLocalSource) {
    return {
      pluginId: SESSION_PLUGIN_ID,
      fileKey: figma.fileKey || null,
      fileName: figma.root && figma.root.name ? figma.root.name : null,
      matches: [],
      truncated: false
    };
  }

  const matches = [];

  if (includeComponents) {
    matches.push.apply(matches, getLocalComponentMatches(loweredQuery, localLimit));
  }

  if (includeStyles) {
    matches.push.apply(matches, getLocalStyleMatches(loweredQuery, localLimit));
  }

  if (includeVariables) {
    matches.push.apply(matches, await getLocalVariableMatches(loweredQuery, localLimit));
  }

  return {
    pluginId: SESSION_PLUGIN_ID,
    fileKey: figma.fileKey || null,
    fileName: figma.root && figma.root.name ? figma.root.name : null,
    matches: matches.slice(0, Math.max(maxResults * 3, maxResults)),
    truncated: matches.length > Math.max(maxResults * 3, maxResults)
  };
}

async function getVariableDefs(payload = {}) {
  const roots = resolveTargetRoots(payload);
  const config = buildMetadataConfig(payload);
  const variableUsageMap = new Map();
  const styleUsageMap = new Map();
  const state = {
    count: 0,
    truncated: false
  };
  const STYLE_FIELDS = [
    ["fillStyleId", "fillStyle"],
    ["strokeStyleId", "strokeStyle"],
    ["effectStyleId", "effectStyle"],
    ["gridStyleId", "gridStyle"],
    ["textStyleId", "textStyle"]
  ];

  function visit(node, depth) {
    if (state.count >= config.maxNodes) {
      state.truncated = true;
      return;
    }

    state.count += 1;

    if ("boundVariables" in node && node.boundVariables) {
      for (const [property, value] of Object.entries(node.boundVariables)) {
        const aliases = collectVariableAliases(value, property);
        for (const alias of aliases) {
          if (!variableUsageMap.has(alias.variableId)) {
            variableUsageMap.set(alias.variableId, []);
          }
          variableUsageMap.get(alias.variableId).push({
            nodeId: node.id,
            nodeName: node.name,
            property: alias.property
          });
        }
      }
    }

    for (const [field, property] of STYLE_FIELDS) {
      if (!(field in node) || typeof node[field] !== "string" || !node[field]) {
        continue;
      }
      if (!styleUsageMap.has(node[field])) {
        styleUsageMap.set(node[field], []);
      }
      styleUsageMap.get(node[field]).push({
        nodeId: node.id,
        nodeName: node.name,
        property
      });
    }

    if (depth >= config.maxDepth || !("children" in node)) {
      if ("children" in node && node.children.length > 0) {
        state.truncated = true;
      }
      return;
    }

    for (const child of node.children) {
      visit(child, depth + 1);
      if (state.count >= config.maxNodes) {
        state.truncated = true;
        break;
      }
    }
  }

  roots.forEach((root) => visit(root, 0));

  const variables = [];
  for (const [variableId, usages] of variableUsageMap.entries()) {
    variables.push(await describeVariableUsage(variableId, usages));
  }

  const styles = [];
  for (const [styleId, usages] of styleUsageMap.entries()) {
    styles.push(describeStyleUsage(styleId, usages));
  }

  variables.sort((left, right) => String(left.name || left.id).localeCompare(String(right.name || right.id)));
  styles.sort((left, right) => String(left.name || left.id).localeCompare(String(right.name || right.id)));

  return {
    pluginId: SESSION_PLUGIN_ID,
    fileKey: figma.fileKey || null,
    fileName: figma.root && figma.root.name ? figma.root.name : null,
    roots: roots.map(serializeNode),
    variableCount: variables.length,
    styleCount: styles.length,
    nodeCount: state.count,
    truncated: state.truncated,
    variables,
    styles
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

function resolveFontName(payload, textNode) {
  const currentFont =
    textNode && textNode.type === "TEXT" && textNode.fontName !== figma.mixed
      ? textNode.fontName
      : { family: "Inter", style: "Regular" };

  const family =
    typeof payload.fontFamily === "string" && payload.fontFamily.trim()
      ? payload.fontFamily.trim()
      : currentFont.family;
  const style =
    typeof payload.fontStyle === "string" && payload.fontStyle.trim()
      ? payload.fontStyle.trim()
      : currentFont.style;

  return { family, style };
}

async function applyTextProperties(node, payload) {
  if (!node || node.type !== "TEXT") {
    return;
  }

  const shouldChangeFont =
    typeof payload.fontFamily === "string" ||
    typeof payload.fontStyle === "string";

  if (shouldChangeFont) {
    const fontName = resolveFontName(payload, node);
    await figma.loadFontAsync(fontName);
    node.fontName = fontName;
  } else {
    await loadAllFonts(node);
  }

  if (typeof payload.fontSize === "number") {
    node.fontSize = payload.fontSize;
  }

  if (typeof payload.characters === "string") {
    node.characters = payload.characters;
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

function normalizeComponentPropertyDefinition(name, definition) {
  const normalized = {
    name,
    type: definition.type,
    defaultValue: definition.defaultValue
  };

  if (definition.variantOptions) {
    normalized.variantOptions = [...definition.variantOptions];
  }

  if (definition.preferredValues) {
    normalized.preferredValues = definition.preferredValues.map((item) => ({
      type: item.type,
      key: item.key,
      name: item.name
    }));
  }

  return normalized;
}

function listComponentPropertyDefinitions(node) {
  if (!node || !("componentPropertyDefinitions" in node) || !node.componentPropertyDefinitions) {
    return [];
  }

  return Object.entries(node.componentPropertyDefinitions).map(([name, definition]) =>
    normalizeComponentPropertyDefinition(name, definition)
  );
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

function waitForNextTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function readComponentPropertiesAfterUpdate(nodeId) {
  await waitForNextTick();
  return listComponentProperties(nodeId);
}

async function setComponentProperty(nodeId, propertyName, value) {
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

  const resolved = await readComponentPropertiesAfterUpdate(nodeId);

  return {
    node: resolved.node,
    requestedProperty: {
      name: propertyName,
      value
    },
    property:
      resolved.properties.find((item) => item.name === propertyName) || null,
    propertyCount: resolved.propertyCount,
    properties: resolved.properties
  };
}

async function setComponentProperties(nodeId, properties) {
  const node = figma.getNodeById(nodeId);

  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  if (node.type !== 'INSTANCE' || !('setProperties' in node)) {
    throw new Error(`Node does not support setProperties: ${nodeId}`);
  }

  const updates = {};
  for (const [propertyName, value] of Object.entries(properties || {})) {
    if (!node.componentProperties || !(propertyName in node.componentProperties)) {
      throw new Error(`Component property not found: ${propertyName}`);
    }
    updates[propertyName] = value;
  }

  node.setProperties(updates);
  const resolved = await readComponentPropertiesAfterUpdate(nodeId);

  return {
    node: resolved.node,
    requestedProperties: updates,
    propertyCount: resolved.propertyCount,
    properties: resolved.properties
  };
}

function addComponentProperty(payload) {
  const node =
    (payload.targetNodeId && figma.getNodeById(payload.targetNodeId)) ||
    figma.currentPage.selection[0];

  if (!node) {
    throw new Error("No selection available");
  }

  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
    throw new Error(`Node does not support addComponentProperty: ${node.id}`);
  }

  node.addComponentProperty(
    payload.propertyName,
    payload.propertyType,
    payload.defaultValue
  );

  const definitions = listComponentPropertyDefinitions(node);
  const definition =
    definitions.find((item) => item.name === payload.propertyName) || null;

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type
    },
    createdPropertyName: payload.propertyName,
    definition,
    propertyCount: definitions.length,
    definitions
  };
}

function editComponentProperty(payload) {
  const node =
    (payload.targetNodeId && figma.getNodeById(payload.targetNodeId)) ||
    figma.currentPage.selection[0];

  if (!node) {
    throw new Error("No selection available");
  }

  if (node.type !== "COMPONENT" && node.type !== "COMPONENT_SET") {
    throw new Error(`Node does not support editComponentProperty: ${node.id}`);
  }

  if (!node.componentPropertyDefinitions || !(payload.propertyName in node.componentPropertyDefinitions)) {
    throw new Error(`Component property definition not found: ${payload.propertyName}`);
  }

  const existing = node.componentPropertyDefinitions[payload.propertyName];
  if (existing.type === "VARIANT" && typeof payload.defaultValue !== "undefined") {
    throw new Error("VARIANT component properties do not support defaultValue edits");
  }

  const nextValue = {};
  if (typeof payload.name !== "undefined") {
    nextValue.name = payload.name;
  }
  if (typeof payload.defaultValue !== "undefined") {
    nextValue.defaultValue = payload.defaultValue;
  }

  const resolvedPropertyName = node.editComponentProperty(payload.propertyName, nextValue);
  const definitions = listComponentPropertyDefinitions(node);
  const definition =
    definitions.find((item) => item.name === resolvedPropertyName) || null;

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type
    },
    requestedPropertyName: payload.propertyName,
    resolvedPropertyName,
    definition,
    propertyCount: definitions.length,
    definitions
  };
}

function buildVariantComponentName(componentSet, variantProperties) {
  const orderedNames = [];

  if (componentSet && componentSet.componentPropertyDefinitions) {
    for (const [name, definition] of Object.entries(componentSet.componentPropertyDefinitions)) {
      if (definition.type === "VARIANT") {
        orderedNames.push(name);
      }
    }
  }

  for (const name of Object.keys(variantProperties)) {
    if (!orderedNames.includes(name)) {
      orderedNames.push(name);
    }
  }

  return orderedNames
    .filter((name) => typeof variantProperties[name] === "string" && variantProperties[name])
    .map((name) => `${name}=${variantProperties[name]}`)
    .join(", ");
}

function setVariantProperties(payload) {
  const node =
    (payload.componentNodeId && figma.getNodeById(payload.componentNodeId)) ||
    figma.currentPage.selection[0];

  if (!node) {
    throw new Error("No selection available");
  }

  if (node.type !== "COMPONENT") {
    throw new Error(`Node is not a component: ${node.id}`);
  }

  if (!node.parent || node.parent.type !== "COMPONENT_SET") {
    throw new Error(`Component is not inside a component set: ${node.id}`);
  }

  const current = node.variantProperties || {};
  const next = { ...current, ...payload.variantProperties };
  node.name = buildVariantComponentName(node.parent, next);

  return {
    node: {
      id: node.id,
      name: node.name,
      type: node.type
    },
    componentSet: {
      id: node.parent.id,
      name: node.parent.name,
      type: node.parent.type
    },
    requestedVariantProperties: payload.variantProperties,
    variantProperties: node.variantProperties || next
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

  if (step.type === "bind_variable") {
    return bindVariable(step.nodeId, step.property, {
      variableId: step.variableId,
      unbind: step.unbind
    });
  }

  if (step.type === "apply_style") {
    return applyStyle(step.nodeId, step.styleType, {
      styleId: step.styleId,
      clear: step.clear
    });
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

async function updateSceneNode(nodeId, payload) {
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
  await applyTextProperties(node, payload);

  return {
    id: node.id,
    name: node.name,
    type: node.type,
    visible: "visible" in node ? node.visible : true,
    layoutMode: "layoutMode" in node ? node.layoutMode : undefined,
    itemSpacing: "itemSpacing" in node ? node.itemSpacing : undefined,
    cornerRadius: "cornerRadius" in node ? node.cornerRadius : undefined,
    opacity: "opacity" in node ? node.opacity : undefined,
    characters: node.type === "TEXT" ? node.characters : undefined
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

async function importLibraryComponent(payload) {
  const parent = assertInsertParent(payload.parentId);
  let sourceComponent = null;

  if (payload.assetType === "COMPONENT_SET") {
    const componentSet = await figma.importComponentSetByKeyAsync(payload.key);
    sourceComponent = componentSet && componentSet.defaultVariant
      ? componentSet.defaultVariant
      : null;
  } else {
    sourceComponent = await figma.importComponentByKeyAsync(payload.key);
  }

  if (!sourceComponent || typeof sourceComponent.createInstance !== "function") {
    throw new Error(`Imported asset cannot create an instance: ${payload.key}`);
  }

  const instance = sourceComponent.createInstance();
  if (payload.name) {
    instance.name = payload.name;
  }

  const childIndex = insertNodeIntoParent(parent, instance, payload.index);

  await updateSceneNode(instance.id, {
    x: payload.x,
    y: payload.y
  });

  return {
    id: instance.id,
    name: instance.name,
    type: instance.type,
    parentId: parent.id,
    index: childIndex,
    assetType: payload.assetType,
    sourceComponentId: sourceComponent.id,
    width: "width" in instance ? instance.width : undefined,
    height: "height" in instance ? instance.height : undefined
  };
}

async function createNodeFromReplayPlan(nodePlan, parent, created) {
  let node;

  if (nodePlan.targetNodeType === "FRAME") {
    node = figma.createFrame();
  } else if (nodePlan.targetNodeType === "RECTANGLE") {
    node = figma.createRectangle();
  } else if (nodePlan.targetNodeType === "TEXT") {
    node = figma.createText();
    await loadAllFonts(node);
    node.characters = typeof nodePlan.characters === "string" ? nodePlan.characters : "";
  } else {
    throw new Error(`Unsupported replay node type: ${nodePlan.targetNodeType}`);
  }

  node.name = nodePlan.name;
  insertNodeIntoParent(parent, node);

  await updateSceneNode(node.id, {
    x: nodePlan.x,
    y: nodePlan.y,
    width: nodePlan.width,
    height: nodePlan.height,
    fillColor: nodePlan.fillColor,
    cornerRadius: nodePlan.cornerRadius,
    opacity: nodePlan.opacity,
    visible: nodePlan.visible
  });

  created.push({
    id: node.id,
    name: node.name,
    type: node.type,
    parentId: parent.id,
    sourceType: nodePlan.sourceType,
    placeholderFor: nodePlan.placeholderFor
  });

  for (const child of nodePlan.children || []) {
    await createNodeFromReplayPlan(child, node, created);
  }

  return node;
}

async function recreateSnapshot(plan) {
  const parent = assertInsertParent(plan.targetParentId);
  const created = [];
  const rootNode = await createNodeFromReplayPlan(plan.root, parent, created);

  return {
    targetParentId: parent.id,
    root: {
      id: rootNode.id,
      name: rootNode.name,
      type: rootNode.type
    },
    createdCount: created.length,
    created
  };
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
    await applyTextProperties(node, payload);
  } else {
    throw new Error(`Unsupported create node type: ${payload.nodeType}`);
  }

  node.name = payload.name;
  const childIndex = insertNodeIntoParent(parent, node, payload.index);

  await updateSceneNode(node.id, {
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

function describeComponentNode(node) {
  return {
    id: node.id,
    key: node.key || null,
    name: node.name,
    type: node.type,
    parentId: node.parent ? node.parent.id : null,
    x: "x" in node ? node.x : undefined,
    y: "y" in node ? node.y : undefined,
    width: "width" in node ? node.width : undefined,
    height: "height" in node ? node.height : undefined,
    description: "description" in node ? node.description : undefined
  };
}

function createComponent(payload) {
  const node =
    (payload.targetNodeId && figma.getNodeById(payload.targetNodeId)) ||
    figma.currentPage.selection[0];

  if (!node) {
    throw new Error("No target node available");
  }

  if (!node.parent || node.parent.type === "INSTANCE") {
    throw new Error(`Node cannot be promoted from its current parent: ${node.id}`);
  }

  if (node.type === "INSTANCE" || node.type === "COMPONENT_SET") {
    throw new Error(`Unsupported node type for create_component: ${node.type}`);
  }

  const componentNode = node.type === "COMPONENT"
    ? node
    : figma.createComponentFromNode(node);

  if (payload.name) {
    componentNode.name = payload.name;
  }

  if (typeof payload.description === "string" && "description" in componentNode) {
    componentNode.description = payload.description;
  }

  return {
    component: describeComponentNode(componentNode),
    sourceNodeId: node.id,
    promoted: node.type !== "COMPONENT"
  };
}

function resolveCreateComponentSetParent(components, payload) {
  if (payload.parentId) {
    return assertInsertParent(payload.parentId);
  }

  const parent = components[0] && components[0].parent;
  if (!parent || !("appendChild" in parent) || typeof parent.appendChild !== "function") {
    throw new Error("Unable to resolve a valid parent for create_component_set");
  }

  for (const component of components) {
    if (!component.parent || component.parent.id !== parent.id) {
      throw new Error(
        "All component nodes must share the same parent unless parentId is provided"
      );
    }
  }

  return parent;
}

function createComponentSet(payload) {
  const components = (payload.componentNodeIds || []).map((nodeId) => {
    const node = figma.getNodeById(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    if (node.type !== "COMPONENT") {
      throw new Error(`Node is not a component: ${nodeId}`);
    }
    return node;
  });

  if (components.length < 2) {
    throw new Error("create_component_set requires at least two components");
  }

  const parent = resolveCreateComponentSetParent(components, payload);
  const componentSet = figma.combineAsVariants(components, parent);

  if (typeof payload.index === "number" && "insertChild" in parent) {
    const clamped = Math.max(0, Math.min(payload.index, parent.children.length - 1));
    parent.insertChild(clamped, componentSet);
  }

  if (payload.name) {
    componentSet.name = payload.name;
  }

  if (typeof payload.description === "string" && "description" in componentSet) {
    componentSet.description = payload.description;
  }

  return {
    componentSet: describeComponentNode(componentSet),
    componentCount: components.length,
    componentIds: components.map((component) => component.id)
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
    containers.push.apply(containers, collectAutoLayoutContainers(child, true));
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

async function normalizeSpacing(containerId, spacing = 8, mode = "both", recursive = false) {
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

  const updated = [];
  for (const payload of updates) {
    updated.push(await updateSceneNode(payload.nodeId, payload));
  }

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

async function promoteSection(sectionId, destinationParentId, index, normalizeSpacing, previewOnly) {
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
    spacingResult = await normalizeSpacing(
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

function createBooleanSubtract(baseNodeId, subtractNodeIds, parentId, index, name) {
  const baseNode = figma.getNodeById(baseNodeId);
  if (!baseNode) {
    throw new Error(`Base node not found: ${baseNodeId}`);
  }

  if (!Array.isArray(subtractNodeIds) || subtractNodeIds.length === 0) {
    throw new Error("subtractNodeIds must contain at least one node id");
  }

  const subtractNodes = subtractNodeIds.map((nodeId) => {
    const node = figma.getNodeById(nodeId);
    if (!node) {
      throw new Error(`Subtract node not found: ${nodeId}`);
    }
    return node;
  });

  const nodes = [baseNode].concat(subtractNodes);
  const inferredParent = baseNode.parent;
  const parent = parentId ? figma.getNodeById(parentId) : inferredParent;

  if (!parent || !("appendChild" in parent) || !("insertChild" in parent)) {
    throw new Error(`Parent cannot contain boolean result: ${parentId || "inferred parent"}`);
  }

  for (const node of nodes) {
    if (!node.parent || node.parent.id !== parent.id) {
      throw new Error(`All boolean source nodes must share the same parent: ${node.id}`);
    }
  }

  const targetIndex =
    typeof index === "number"
      ? index
      : ("children" in parent ? parent.children.indexOf(baseNode) : undefined);
  const booleanNode = figma.subtract(nodes, parent, targetIndex);

  if (typeof name === "string" && name.trim()) {
    booleanNode.name = name.trim();
  }

  return {
    id: booleanNode.id,
    name: booleanNode.name,
    type: booleanNode.type,
    parentId: booleanNode.parent ? booleanNode.parent.id : null,
    index:
      booleanNode.parent && "children" in booleanNode.parent
        ? booleanNode.parent.children.indexOf(booleanNode)
        : null,
    sourceNodeIds: [baseNodeId].concat(subtractNodeIds)
  };
}

async function handleCommand(command) {
  if (command.type === "get_selection") {
    return {
      selection: figma.currentPage.selection.map(serializeNode)
    };
  }

  if (command.type === "get_metadata") {
    return getMetadata(command.payload || {});
  }

  if (command.type === "get_variable_defs") {
    return await getVariableDefs(command.payload || {});
  }

  if (command.type === "search_design_system") {
    return await searchDesignSystem(command.payload || {});
  }

  if (command.type === "search_instances") {
    return searchInstances(command.payload || {});
  }

  if (command.type === "snapshot_selection") {
    return snapshotSelection(command.payload || {});
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
      updated: await setComponentProperty(
        command.payload.nodeId,
        command.payload.propertyName,
        command.payload.value
      )
    };
  }

  if (command.type === "set_component_properties") {
    return {
      updated: await setComponentProperties(
        command.payload.nodeId,
        command.payload.properties
      )
    };
  }

  if (command.type === "add_component_property") {
    return {
      created: addComponentProperty(command.payload)
    };
  }

  if (command.type === "edit_component_property") {
    return {
      updated: editComponentProperty(command.payload)
    };
  }

  if (command.type === "set_variant_properties") {
    return {
      updated: setVariantProperties(command.payload)
    };
  }

  if (command.type === "bind_variable") {
    const previousVariableId = readCurrentBoundVariableId(
      figma.getNodeById(command.payload.nodeId),
      command.payload.property
    );
    const bound = await bindVariable(
      command.payload.nodeId,
      command.payload.property,
      command.payload
    );
    setUndoBatch("bind_variable", [
      previousVariableId
        ? {
            type: "bind_variable",
            nodeId: command.payload.nodeId,
            property: command.payload.property,
            variableId: previousVariableId
          }
        : {
            type: "bind_variable",
            nodeId: command.payload.nodeId,
            property: command.payload.property,
            unbind: true
          }
    ]);
    return {
      bound
    };
  }

  if (command.type === "apply_style") {
    const node = figma.getNodeById(command.payload.nodeId);
    const styleField = resolveStyleField(command.payload.styleType);
    const previousStyleId = node && styleField in node ? node[styleField] : "";
    const applied = await applyStyle(
      command.payload.nodeId,
      command.payload.styleType,
      command.payload
    );
    setUndoBatch("apply_style", [
      previousStyleId
        ? {
            type: "apply_style",
            nodeId: command.payload.nodeId,
            styleType: command.payload.styleType,
            styleId: previousStyleId
          }
        : {
            type: "apply_style",
            nodeId: command.payload.nodeId,
            styleType: command.payload.styleType,
            clear: true
          }
    ]);
    return {
      applied
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
    const updated = await updateSceneNode(command.payload.nodeId, command.payload);
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
      updated.push(await updateSceneNode(item.nodeId, item));
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

  if (command.type === "create_component") {
    return {
      created: createComponent(command.payload)
    };
  }

  if (command.type === "create_component_set") {
    return {
      created: createComponentSet(command.payload)
    };
  }

  if (command.type === "import_library_component") {
    return {
      imported: await importLibraryComponent(command.payload)
    };
  }

  if (command.type === "recreate_snapshot") {
    return {
      recreated: await recreateSnapshot(command.payload)
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
    return await normalizeSpacing(
      command.payload.containerId,
      Number(command.payload.spacing || 8),
      command.payload.mode || "both",
      Boolean(command.payload.recursive)
    );
  }

  if (command.type === "promote_section") {
    return await promoteSection(
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

  if (command.type === "boolean_subtract") {
    return {
      booleanResult: createBooleanSubtract(
        command.payload.baseNodeId,
        command.payload.subtractNodeIds || [],
        command.payload.parentId,
        command.payload.index,
        command.payload.name
      )
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
      pluginId: SESSION_PLUGIN_ID,
      bridgeUrl: BRIDGE_URL,
      fileKey: figma.fileKey || null,
      fileName: figma.root && figma.root.name ? figma.root.name : null
    });
  }
};
