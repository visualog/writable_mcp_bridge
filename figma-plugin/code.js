const BRIDGE_URL = "http://localhost:3845";
const DEFAULT_PLUGIN_ID = "default";

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
    const updated = await updateTextNode(
      command.payload.nodeId,
      command.payload.text
    );
    return { updated };
  }

  if (command.type === "bulk_update_texts") {
    const updated = [];
    for (const item of command.payload.updates || []) {
      updated.push(await updateTextNode(item.nodeId, item.text));
    }
    return { updated };
  }

  if (command.type === "rename_node") {
    return {
      renamed: renameNode(command.payload.nodeId, command.payload.name)
    };
  }

  if (command.type === "bulk_rename_nodes") {
    const renamed = [];
    for (const item of command.payload.updates || []) {
      renamed.push(renameNode(item.nodeId, item.name));
    }
    return { renamed };
  }

  if (command.type === "update_node") {
    return {
      updated: updateSceneNode(command.payload.nodeId, command.payload)
    };
  }

  if (command.type === "bulk_update_nodes") {
    const updated = [];
    for (const item of command.payload.updates || []) {
      updated.push(updateSceneNode(item.nodeId, item));
    }
    return { updated };
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
