import { listSupportedAnnotationPropertyTypes } from "../add-annotation.js";

export function buildDiscoveryToolDefinitions() {
  return [
    {
      name: "analyze_reference_selection",
      description: "Analyze the current reference selection into a typed section draft that can seed build_screen_from_design_system.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          targetNodeId: { type: "string" },
          includeExport: { type: "boolean" },
          includeSvg: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "add_annotation",
      description: "Add, replace, or clear Dev Mode annotations on a selected or explicit target node.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          targetNodeId: { type: "string" },
          label: { type: "string" },
          labelMarkdown: { type: "string" },
          categoryId: { type: "string" },
          properties: {
            type: "array",
            items: {
              type: "string",
              enum: listSupportedAnnotationPropertyTypes()
            }
          },
          replace: { type: "boolean" },
          clear: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "bulk_add_annotations",
      description: "Add annotations to multiple nodes in one request.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          annotations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                targetNodeId: { type: "string" },
                label: { type: "string" },
                labelMarkdown: { type: "string" },
                categoryId: { type: "string" },
                properties: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: listSupportedAnnotationPropertyTypes()
                  }
                },
                replace: { type: "boolean" },
                clear: { type: "boolean" }
              },
              additionalProperties: false
            }
          }
        },
        required: ["annotations"],
        additionalProperties: false
      }
    },
    {
      name: "search_design_system",
      description: "Search the current file's local components, styles, and variables, and optionally merge in external library/file matches.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          query: { type: "string" },
          maxResults: { type: "number" },
          kinds: {
            type: "array",
            items: {
              type: "string",
              enum: ["components", "styles", "variables"]
            }
          },
          sources: {
            type: "array",
            items: {
              type: "string",
              enum: ["local-file", "library-files", "all"]
            }
          },
          includeComponents: { type: "boolean" },
          includeStyles: { type: "boolean" },
          includeVariables: { type: "boolean" },
          fileKeys: {
            type: "array",
            items: { type: "string" }
          }
        },
        additionalProperties: false
      }
    },
    {
      name: "search_instances",
      description: "Search instance nodes under an explicit target, the current selection, or the current page.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          pageId: { type: "string" },
          targetNodeId: { type: "string" },
          query: { type: "string" },
          maxDepth: { type: "number" },
          maxResults: { type: "number" },
          includeProperties: { type: "boolean" }
        },
        additionalProperties: false
      }
    },
    {
      name: "search_library_assets",
      description: "Search published library components, component sets, and styles in a Figma library file via the REST API.",
      inputSchema: {
        type: "object",
        properties: {
          fileKey: { type: "string" },
          query: { type: "string" },
          assetTypes: {
            type: "array",
            items: {
              type: "string",
              enum: ["COMPONENT", "COMPONENT_SET", "STYLE"]
            }
          },
          maxResults: { type: "number" }
        },
        required: ["fileKey"],
        additionalProperties: false
      }
    },
    {
      name: "recreate_snapshot",
      description: "Recreate a previously captured snapshot under a target parent in the connected file.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          targetParentId: { type: "string" },
          snapshot: { type: "object" }
        },
        required: ["targetParentId", "snapshot"],
        additionalProperties: false
      }
    },
    {
      name: "search_file_components",
      description: "Search component metadata exposed by a Figma file response, useful for Community files that are not published as libraries.",
      inputSchema: {
        type: "object",
        properties: {
          fileKey: { type: "string" },
          query: { type: "string" },
          maxResults: { type: "number" }
        },
        required: ["fileKey"],
        additionalProperties: false
      }
    },
    {
      name: "list_component_properties",
      description: "Inspect component properties for a selected or explicit target node.",
      inputSchema: {
        type: "object",
        properties: {
          pluginId: { type: "string", default: "default" },
          targetNodeId: { type: "string" }
        },
        additionalProperties: false
      }
    }
  ];
}
