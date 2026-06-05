import { listSupportedCreateNodeTypes } from "../create-node.js";
import { listSupportedImportLibraryAssetTypes } from "../import-library-component.js";

const nodeUpdateProperties = {
  nodeId: { type: "string" },
  target: { type: "string", enum: ["self", "parent"] },
  visible: { type: "boolean" },
  fillColor: { type: "string" },
  cornerRadius: { type: "number" },
  opacity: { type: "number" },
  x: { type: "number" },
  y: { type: "number" },
  width: { type: "number" },
  height: { type: "number" },
  layoutMode: {
    type: "string",
    enum: ["NONE", "HORIZONTAL", "VERTICAL"]
  },
  itemSpacing: { type: "number" },
  paddingLeft: { type: "number" },
  paddingRight: { type: "number" },
  paddingTop: { type: "number" },
  paddingBottom: { type: "number" },
  primaryAxisAlignItems: {
    type: "string",
    enum: ["MIN", "MAX", "CENTER", "SPACE_BETWEEN"]
  },
  counterAxisAlignItems: {
    type: "string",
    enum: ["MIN", "MAX", "CENTER", "BASELINE"]
  },
  primaryAxisSizingMode: {
    type: "string",
    enum: ["FIXED", "AUTO"]
  },
  counterAxisSizingMode: {
    type: "string",
    enum: ["FIXED", "AUTO"]
  },
  layoutGrow: { type: "number" },
  layoutAlign: {
    type: "string",
    enum: ["INHERIT", "STRETCH", "MIN", "CENTER", "MAX"]
  },
  characters: { type: "string" },
  fontFamily: { type: "string" },
  fontStyle: { type: "string" },
  fontSize: { type: "number" },
  lineHeight: { type: "number" }
};

const { lineHeight: omittedPreviewLineHeight, ...previewBaseUpdateProperties } = nodeUpdateProperties;

const previewUpdateProperties = {
  ...previewBaseUpdateProperties,
  allowHidden: { type: "boolean" },
  locked: { type: "boolean" },
  allowLocked: { type: "boolean" },
  isMask: { type: "boolean" },
  allowMask: { type: "boolean" },
  strokeColor: { type: "string" },
  strokeWeight: { type: "number" },
  dropShadow: { type: "object" }
};

const createNodeProperties = {
  parentId: { type: "string" },
  index: { type: "number" },
  nodeType: { type: "string", enum: listSupportedCreateNodeTypes() },
  name: { type: "string" },
  width: { type: "number" },
  height: { type: "number" },
  x: { type: "number" },
  y: { type: "number" },
  characters: { type: "string" },
  fontFamily: { type: "string" },
  fontStyle: { type: "string" },
  fontSize: { type: "number" },
  lineHeight: { type: "number" },
  fillColor: { type: "string" },
  cornerRadius: { type: "number" },
  opacity: { type: "number" },
  clipsContent: { type: "boolean" },
  isMask: { type: "boolean" },
  imageDataBase64: { type: "string" },
  imageDataUrl: { type: "string" },
  imageScaleMode: { type: "string" }
};

export function buildNodeToolDefinitions() {
  return [
    {
      name: "preview_changes",
      description: "Preview one or more node updates without mutating the connected Figma file.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          ...previewUpdateProperties,
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: previewUpdateProperties,
              required: ["nodeId"],
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "rename_node",
      description: "Rename a single node in the connected Figma file.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          nodeId: { type: "string" },
          name: { type: "string" }
        },
        required: ["nodeId", "name"],
        additionalProperties: false
      }
    },
    {
      name: "bulk_rename_nodes",
      description: "Rename multiple nodes in one request.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nodeId: { type: "string" },
                name: { type: "string" }
              },
              required: ["nodeId", "name"],
              additionalProperties: false
            }
          }
        },
        required: ["updates"],
        additionalProperties: false
      }
    },
    {
      name: "bulk_update_texts",
      description: "Update multiple text nodes in one request.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nodeId: { type: "string" },
                text: { type: "string" }
              },
              required: ["nodeId", "text"],
              additionalProperties: false
            }
          }
        },
        required: ["updates"],
        additionalProperties: false
      }
    },
    {
      name: "update_node",
      description: "Update visibility or solid fill color for a node in the connected Figma file.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          ...nodeUpdateProperties
        },
        required: ["nodeId"],
        additionalProperties: false
      }
    },
    {
      name: "bulk_update_nodes",
      description: "Update visibility or fill color for multiple nodes in one request.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          updates: {
            type: "array",
            items: {
              type: "object",
              properties: nodeUpdateProperties,
              required: ["nodeId"],
              additionalProperties: false
            }
          }
        },
        required: ["updates"],
        additionalProperties: false
      }
    },
    {
      name: "bulk_create_nodes",
      description: "Create multiple nodes in one request.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          nodes: {
            type: "array",
            items: {
              type: "object",
              properties: createNodeProperties,
              required: ["nodeType"],
              additionalProperties: false
            }
          }
        },
        required: ["nodes"],
        additionalProperties: false
      }
    },
    {
      name: "create_node",
      description: "Create and insert a new first-slice node into a target parent.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          ...createNodeProperties
        },
        required: ["nodeType"],
        additionalProperties: false
      }
    },
    {
      name: "import_library_component",
      description: "Import a published library component or component set by key and insert an instance into a target parent.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          key: { type: "string" },
          parentId: { type: "string" },
          assetType: {
            type: "string",
            enum: listSupportedImportLibraryAssetTypes()
          },
          name: { type: "string" },
          index: { type: "number" },
          x: { type: "number" },
          y: { type: "number" }
        },
        required: ["key", "parentId"],
        additionalProperties: false
      }
    },
    {
      name: "find_or_import_component",
      description: "Search for a reusable component by query. Return a local match if found, otherwise import the best matching library component into a target parent.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          query: { type: "string" },
          parentId: { type: "string" },
          maxResults: { type: "number" },
          fileKeys: {
            type: "array",
            items: { type: "string" }
          },
          assetTypes: {
            type: "array",
            items: {
              type: "string",
              enum: ["COMPONENT", "COMPONENT_SET"]
            }
          },
          preferLocal: { type: "boolean" },
          index: { type: "number" },
          x: { type: "number" },
          y: { type: "number" }
        },
        required: ["query", "parentId"],
        additionalProperties: false
      }
    },
    {
      name: "reuse_or_create_component",
      description: "Search for a reusable component by query. If none is found, promote a target node into a local component instead.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          query: { type: "string" },
          parentId: { type: "string" },
          targetNodeId: { type: "string" },
          createName: { type: "string" },
          createDescription: { type: "string" },
          maxResults: { type: "number" },
          fileKeys: {
            type: "array",
            items: { type: "string" }
          },
          assetTypes: {
            type: "array",
            items: {
              type: "string",
              enum: ["COMPONENT", "COMPONENT_SET"]
            }
          },
          preferLocal: { type: "boolean" },
          index: { type: "number" },
          x: { type: "number" },
          y: { type: "number" }
        },
        required: ["query", "parentId"],
        additionalProperties: false
      }
    }
  ];
}
