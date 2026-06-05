import { listSupportedExportFormats } from "../export-node.js";

export function buildReadToolDefinitions() {
  return [
    {
      name: "get_metadata",
      description: "Return a sparse XML outline of the current selection, explicit target node, or current page when nothing is selected.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          nodeId: { type: "string" },
          maxDepth: { type: "number" },
          maxNodes: { type: "number" },
          includeJson: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "get_annotations",
      description: "Return node-scoped annotation data and inferred comment text for implementation inspection.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          includeInferredComments: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "get_node_details",
      description: "Return implementation-grade node details including layout semantics, optional children, and variant/component linkage.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          nodeId: { type: "string" },
          maxDepth: { type: "number" },
          maxNodes: { type: "number" },
          includeChildren: { type: "boolean" },
          detailLevel: { type: "string", enum: ["light", "layout", "full"] }
        },
        additionalProperties: false
      }
    },
    {
      name: "get_component_variant_details",
      description: "Return component set/variant details including per-variant layout and visible children.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          nodeId: { type: "string" },
          maxDepth: { type: "number" },
          maxNodes: { type: "number" },
          includeChildren: { type: "boolean" },
          detailLevel: { type: "string", enum: ["light", "layout", "full"] }
        },
        additionalProperties: false
      }
    },
    {
      name: "get_instance_details",
      description: "Return instance details, source component linkage, overrides, and optional resolved children.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          nodeId: { type: "string" },
          maxDepth: { type: "number" },
          maxNodes: { type: "number" },
          includeChildren: { type: "boolean" },
          includeResolvedChildren: { type: "boolean" },
          detailLevel: { type: "string", enum: ["light", "layout", "full"] }
        },
        additionalProperties: false
      }
    },
    {
      name: "get_variable_defs",
      description: "Return variables and styles used by the current selection, explicit target node, or current page when nothing is selected.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          nodeId: { type: "string" },
          maxDepth: { type: "number" },
          maxNodes: { type: "number" }
        },
        additionalProperties: false
      }
    },
    {
      name: "export_design_tokens",
      description: "Export the current Figma file's local variables and styles as a normalized design token snapshot.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          scope: { type: "string", enum: ["file"], default: "file" },
          includeAliases: { type: "boolean", default: true },
          includeResolvedValues: { type: "boolean", default: true },
          includeStyles: { type: "boolean", default: true },
          includeUsages: { type: "boolean", default: false }
        },
        additionalProperties: false
      }
    },
    {
      name: "list_text_nodes",
      description: "List text nodes under the current selection, a specific node, or the current page when nothing is selected.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          scope: { type: "string", enum: ["auto", "current-page", "selection", "target"] }
        },
        additionalProperties: false
      }
    },
    {
      name: "search_nodes",
      description: "Search descendants of the current selection, a specific root, or the current page when nothing is selected using lightweight metadata. Use scope to force current-page, selection, or target behavior.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          scope: { type: "string", enum: ["auto", "current-page", "selection", "target"] },
          query: { type: "string" },
          nodeTypes: {
            type: "array",
            items: { type: "string" }
          },
          maxDepth: { type: "number" },
          maxResults: { type: "number" },
          includeText: { type: "boolean" },
          detailLevel: { type: "string", enum: ["light", "layout", "full"] }
        },
        additionalProperties: false
      }
    },
    {
      name: "snapshot_selection",
      description: "Serialize the currently selected source subtree into a bounded snapshot that can be replayed in another file.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          maxDepth: { type: "number" },
          maxNodes: { type: "number" },
          placeholderInstances: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "export_node",
      description: "Export a selected or explicit target node as svg or png.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          format: {
            type: "string",
            enum: listSupportedExportFormats()
          },
          scale: { type: "number" },
          contentsOnly: { type: "boolean" },
          useAbsoluteBounds: { type: "boolean" },
          svgOutlineText: { type: "boolean" },
          svgIdAttribute: { type: "boolean" }
        },
        additionalProperties: false
      }
    }
  ];
}
