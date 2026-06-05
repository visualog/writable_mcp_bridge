import { listSupportedApplyStyleTypes } from "./apply-style.js";
import { listSupportedComponentPropertyTypes } from "./add-component-property.js";
import { listSupportedAnnotationPropertyTypes } from "./add-annotation.js";
import { listSupportedBindVariableFields } from "./bind-variable.js";
import { listSupportedCreateComponentSourceTypes } from "./create-component.js";
import { listSupportedCreateNodeTypes } from "./create-node.js";
import { listSupportedImportLibraryAssetTypes } from "./import-library-component.js";
import { listSupportedExportFormats } from "./export-node.js";

export function buildToolDefinitions() {
  return [
  {
    name: "get_active_plugins",
    description: "List the registered Figma plugin bridge sessions.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "get_selection",
    description: "Read the current Figma selection for a plugin session.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" }
      },
      additionalProperties: false
    }
  },
  {
    name: "list_pages",
    description: "List pages in the current Figma file for a plugin session.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_figma_account_profile",
    description: "Read the current Figma account profile via REST using FIGMA_ACCESS_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "list_team_projects",
    description: "List projects for a known Figma team id via REST. Requires FIGMA_ACCESS_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        teamId: { type: "string" },
        query: { type: "string" },
        maxResults: { type: "number" }
      },
      required: ["teamId"],
      additionalProperties: false
    }
  },
  {
    name: "list_project_files",
    description: "List files for a known Figma project id via REST. Requires FIGMA_ACCESS_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string" },
        query: { type: "string" },
        maxResults: { type: "number" },
        branchData: { type: "boolean" }
      },
      required: ["projectId"],
      additionalProperties: false
    }
  },
  {
    name: "get_file_summary",
    description: "Read summary metadata for a Figma file key via REST. Requires FIGMA_ACCESS_TOKEN.",
    inputSchema: {
      type: "object",
      properties: {
        fileKey: { type: "string" }
      },
      required: ["fileKey"],
      additionalProperties: false
    }
  },
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
  },
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
  },
  {
    name: "update_text",
    description: "Update a single text node's characters in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        text: { type: "string" }
      },
      required: ["nodeId", "text"],
      additionalProperties: false
    }
  },
  {
    name: "set_component_property",
    description: "Set one component property value on an instance node in the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        propertyName: { type: "string" },
        value: {
          oneOf: [{ type: "string" }, { type: "boolean" }]
        }
      },
      required: ["nodeId", "propertyName", "value"],
      additionalProperties: false
    }
  },
  {
    name: "set_component_properties",
    description: "Set multiple component property values on an instance node in one atomic update.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        properties: {
          type: "object",
          additionalProperties: {
            oneOf: [{ type: "string" }, { type: "boolean" }]
          }
        }
      },
      required: ["nodeId", "properties"],
      additionalProperties: false
    }
  },
  {
    name: "add_component_property",
    description: "Add a component property to a local component or component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        propertyName: { type: "string" },
        propertyType: {
          type: "string",
          enum: listSupportedComponentPropertyTypes()
        },
        defaultValue: {
          oneOf: [{ type: "string" }, { type: "boolean" }]
        }
      },
      required: ["targetNodeId", "propertyName", "propertyType", "defaultValue"],
      additionalProperties: false
    }
  },
  {
    name: "edit_component_property",
    description: "Rename or update the default value of a component property on a local component or component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        propertyName: { type: "string" },
        name: { type: "string" },
        defaultValue: {
          oneOf: [{ type: "string" }, { type: "boolean" }]
        }
      },
      required: ["targetNodeId", "propertyName"],
      additionalProperties: false
    }
  },
  {
    name: "set_variant_properties",
    description: "Set variant property values on a component that belongs to a local component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        componentNodeId: { type: "string" },
        variantProperties: {
          type: "object",
          additionalProperties: { type: "string" }
        }
      },
      required: ["componentNodeId", "variantProperties"],
      additionalProperties: false
    }
  },
  {
    name: "bind_variable",
    description: "Bind or unbind a Figma variable to a supported property on a node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        property: {
          type: "string",
          enum: listSupportedBindVariableFields()
        },
        variableId: { type: "string" },
        variableKey: { type: "string" },
        unbind: { type: "boolean" }
      },
      required: ["nodeId", "property"],
      additionalProperties: false
    }
  },
  {
    name: "bulk_bind_variables",
    description: "Bind or unbind multiple Figma variables in one write batch to reduce queue pressure.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        bindings: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              property: {
                type: "string",
                enum: listSupportedBindVariableFields()
              },
              variableId: { type: "string" },
              variableKey: { type: "string" },
              unbind: { type: "boolean" }
            },
            required: ["nodeId", "property"],
            additionalProperties: false
          }
        }
      },
      required: ["bindings"],
      additionalProperties: false
    }
  },
  {
    name: "apply_style",
    description: "Apply or clear a supported shared style on a node.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        styleType: {
          type: "string",
          enum: listSupportedApplyStyleTypes()
        },
        styleId: { type: "string" },
        styleKey: { type: "string" },
        clear: { type: "boolean" }
      },
      required: ["nodeId", "styleType"],
      additionalProperties: false
    }
  },
  {
    name: "create_component",
    description: "Promote an existing node in the current file into a local component.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        targetNodeId: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        supportedSourceTypes: {
          type: "array",
          items: {
            type: "string",
            enum: listSupportedCreateComponentSourceTypes()
          }
        }
      },
      required: ["targetNodeId"],
      additionalProperties: false
    }
  },
  {
    name: "create_component_set",
    description: "Combine existing local components into a component set.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        componentNodeIds: {
          type: "array",
          items: { type: "string" }
        },
        parentId: { type: "string" },
        index: { type: "number" },
        name: { type: "string" },
        description: { type: "string" }
      },
      required: ["componentNodeIds"],
      additionalProperties: false
    }
  },
  {
    name: "preview_changes",
    description: "Preview one or more node updates without mutating the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        target: { type: "string", enum: ["self", "parent"] },
        visible: { type: "boolean" },
        allowHidden: { type: "boolean" },
        locked: { type: "boolean" },
        allowLocked: { type: "boolean" },
        isMask: { type: "boolean" },
        allowMask: { type: "boolean" },
        fillColor: { type: "string" },
        strokeColor: { type: "string" },
        strokeWeight: { type: "number" },
        dropShadow: { type: "object" },
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
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              nodeId: { type: "string" },
              target: { type: "string", enum: ["self", "parent"] },
              visible: { type: "boolean" },
              allowHidden: { type: "boolean" },
              locked: { type: "boolean" },
              allowLocked: { type: "boolean" },
              isMask: { type: "boolean" },
              allowMask: { type: "boolean" },
              fillColor: { type: "string" },
              strokeColor: { type: "string" },
              strokeWeight: { type: "number" },
              dropShadow: { type: "object" },
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
              fontSize: { type: "number" }
            },
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
            properties: {
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
            },
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
            properties: {
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
            },
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
  },
  {
    name: "build_screen_from_design_system",
    description: "Create a design-system-friendly screen scaffold with auto-layout sections such as header, content, and actions.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        annotate: { type: "boolean" },
        backgroundColor: { type: "string" },
        referencePattern: {
          type: "string",
          enum: ["dashboard-analytics"]
        },
        referenceAnalysis: {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
            backgroundColor: { type: "string" },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "header",
                      "content",
                      "actions",
                      "navigation",
                      "summary-cards",
                      "timeline",
                      "list",
                      "table",
                      "form"
                    ]
                  },
                  name: { type: "string" },
                  headerQuery: { type: "string" },
                  headerTitle: { type: "string" },
                  contentTitle: { type: "string" },
                  contentBody: { type: "string" },
                  contentComponentQueries: {
                    type: "array",
                    items: { type: "string" }
                  },
                  primaryActionQuery: { type: "string" },
                  primaryActionLabel: { type: "string" }
                },
                required: ["type"],
                additionalProperties: false
              }
            }
          },
          additionalProperties: false
        },
        headerQuery: { type: "string" },
        headerTitle: { type: "string" },
        contentTitle: { type: "string" },
        contentBody: { type: "string" },
        contentComponentQueries: {
          type: "array",
          items: { type: "string" }
        },
        primaryActionQuery: { type: "string" },
        primaryActionLabel: { type: "string" },
        paddingX: { type: "number" },
        paddingY: { type: "number" },
        sectionGap: { type: "number" },
        contentGap: { type: "number" },
        sections: {
          type: "array",
          items: {
            type: "string",
            enum: [
              "header",
              "content",
              "actions",
              "navigation",
              "summary-cards",
              "timeline",
              "list",
              "table",
              "form"
            ]
          }
        },
        sectionSpecs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "header",
                  "content",
                  "actions",
                  "navigation",
                  "summary-cards",
                  "timeline",
                  "list",
                  "table",
                  "form"
                ]
              },
              name: { type: "string" },
              headerQuery: { type: "string" },
              headerTitle: { type: "string" },
              contentTitle: { type: "string" },
              contentBody: { type: "string" },
              contentComponentQueries: {
                type: "array",
                items: { type: "string" }
              },
              primaryActionQuery: { type: "string" },
              primaryActionLabel: { type: "string" }
            },
            required: ["type"],
            additionalProperties: false
          }
        }
      },
      required: ["parentId"],
      additionalProperties: false
    }
  },
  {
    name: "validate_external_compose_input",
    description:
      "Validate external analyzer payloads against the Xbridge compose contract before running compose.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        backgroundColor: { type: "string" },
        validationMode: {
          type: "string",
          enum: ["lenient", "strict"]
        },
        intentSections: {
          type: "array",
          items: { type: "object", additionalProperties: true }
        },
        referenceAnalysis: {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
            backgroundColor: { type: "string" },
            intentSections: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  name: { type: "string" },
                  headerTitle: { type: "string" },
                  contentTitle: { type: "string" },
                  contentBody: { type: "string" },
                  primaryActionLabel: { type: "string" },
                  density: { type: "string" },
                  contentDensity: { type: "string" },
                  tableColumns: {
                    type: "array",
                    items: {
                      oneOf: [
                        { type: "string" },
                        {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            label: { type: "string" },
                            width: { type: "number" },
                            align: { type: "string" },
                            pattern: { type: "string" }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  tableRowPattern: {
                    type: "array",
                    items: {
                      oneOf: [
                        { type: "string" },
                        {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            label: { type: "string" },
                            tone: { type: "string" },
                            title: { type: "string" },
                            meta: { type: "string" },
                            trailing: { type: "string" }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  actionGroups: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        label: { type: "string" },
                        actions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              key: { type: "string" },
                              label: { type: "string" },
                              intent: { type: "string" },
                              tone: { type: "string" },
                              variant: { type: "string" }
                            },
                            additionalProperties: true
                          }
                        }
                      },
                      additionalProperties: true
                    }
                  }
                },
                additionalProperties: true
              }
            }
          },
          additionalProperties: true
        },
        sections: {
          type: "array",
          items: { type: "object", additionalProperties: true }
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_compose_metrics",
    description:
      "Return compose/validation runtime metrics such as blocked sections, fallback helper count, and strict mode failure ratio.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },
  {
    name: "compose_screen_from_intents",
    description: "Compose a DS-aware screen from semantic section intents and build it through the layout engine.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        backgroundColor: { type: "string" },
        intentSections: {
          type: "array",
          items: { type: "object", additionalProperties: true }
        },
        referenceAnalysis: {
          type: "object",
          properties: {
            width: { type: "number" },
            height: { type: "number" },
            backgroundColor: { type: "string" },
            intentSections: {
              type: "array",
              items: { type: "object", additionalProperties: true }
            },
            sections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: { type: "string" },
                  name: { type: "string" },
                  headerTitle: { type: "string" },
                  contentTitle: { type: "string" },
                  contentBody: { type: "string" },
                  primaryActionLabel: { type: "string" },
                  density: { type: "string" },
                  contentDensity: { type: "string" },
                  tableColumns: {
                    type: "array",
                    items: {
                      oneOf: [
                        { type: "string" },
                        {
                          type: "object",
                          properties: {
                            key: { type: "string" },
                            label: { type: "string" },
                            width: { type: "number" },
                            align: { type: "string" },
                            pattern: { type: "string" }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  tableRowPattern: {
                    type: "array",
                    items: {
                      oneOf: [
                        { type: "string" },
                        {
                          type: "object",
                          properties: {
                            type: { type: "string" },
                            label: { type: "string" },
                            tone: { type: "string" },
                            title: { type: "string" },
                            meta: { type: "string" },
                            trailing: { type: "string" }
                          },
                          additionalProperties: true
                        }
                      ]
                    }
                  },
                  actionGroups: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        key: { type: "string" },
                        label: { type: "string" },
                        actions: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              key: { type: "string" },
                              label: { type: "string" },
                              intent: { type: "string" },
                              tone: { type: "string" },
                              variant: { type: "string" }
                            },
                            additionalProperties: true
                          }
                        }
                      },
                      additionalProperties: true
                    }
                  }
                },
                additionalProperties: true
              }
            }
          },
          additionalProperties: true
        },
        sections: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" },
              intent: { type: "string" },
              pattern: { type: "string" },
              variant: { type: "string" },
              tone: { type: "string" },
              density: { type: "string" },
              name: { type: "string" },
              title: { type: "string" },
              domain: { type: "string" },
              leftItems: { type: "array", items: { type: "object" } },
              rightItems: { type: "array", items: { type: "object" } },
              columns: { type: "array", items: {} },
              rows: { type: "array", items: {} },
              sections: { type: "array", items: { type: "object" } },
              users: { type: "array", items: { type: "object" } },
              percent: { type: "number" },
              label: { type: "string" }
            },
            additionalProperties: true
          }
        }
      },
      required: ["parentId"],
      additionalProperties: false
    }
  },
  {
    name: "analyze_selection_to_compose",
    description: "Analyze the selected or explicit reference node, derive intentSections, and immediately compose a DS-aware screen from that analysis.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        targetNodeId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" },
        backgroundColor: { type: "string" },
        includeExport: { type: "boolean" },
        includeSvg: { type: "boolean" }
      },
      required: ["parentId"],
      additionalProperties: false
    }
  },
  {
    name: "build_finance_summary_mock",
    description: "Create a mobile finance summary reference mock composed from bridge primitives in one request.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        name: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      },
      additionalProperties: false
    }
  },
  {
    name: "build_layout",
    description: "Build a Figma tree from a declarative helper schema. Supports auto-layout helpers and coordinate-based layout: \"none\" frames.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        parentId: { type: "string" },
        generatedNamePrefix: { type: "string" },
        generatedAt: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        tree: {
          type: "object",
          properties: {
            helper: {
              type: "string",
              enum: [
                "screen",
                "row",
                "column",
                "card",
                "section",
                "list",
                "list-item",
                "media-row",
                "search-result-row",
                "status-chip",
                "avatar-stack",
                "progress-bar",
                "toolbar",
                "tabbar",
                "data-table",
                "browser-chrome",
                "sidebar-nav",
                "workspace-switcher",
                "profile-summary",
                "divider",
                "app-shell",
                "dashboard-board",
                "text"
              ]
            },
            preset: { type: "string" },
            name: { type: "string" },
            layout: { type: "string" },
            widthMode: { type: "string" },
            heightMode: { type: "string" },
            width: { type: "number" },
            height: { type: "number" },
            gap: { type: "number" },
            padding: {
              oneOf: [
                { type: "number" },
                {
                  type: "object",
                  properties: {
                    x: { type: "number" },
                    y: { type: "number" },
                    top: { type: "number" },
                    right: { type: "number" },
                    bottom: { type: "number" },
                    left: { type: "number" }
                  },
                  additionalProperties: false
                }
              ]
            },
            align: { type: "string" },
            justify: { type: "string" },
            fill: { type: "string" },
            radius: { type: "number" },
            characters: { type: "string" },
            fontFamily: { type: "string" },
            fontStyle: { type: "string" },
            fontSize: { type: "number" },
            lineHeight: { type: "number" },
            children: {
              type: "array",
              items: { type: "object" }
            }
          },
          required: ["helper"],
          additionalProperties: true
        }
      },
      additionalProperties: false
    }
  },
  {
    name: "create_instance",
    description: "Create an instance from a local component or component set and insert it into a parent.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        sourceNodeId: { type: "string" },
        parentId: { type: "string" },
        name: { type: "string" },
        index: { type: "number" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["sourceNodeId"],
      additionalProperties: false
    }
  },
  {
    name: "duplicate_node",
    description: "Duplicate a node inside the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        count: { type: "number" }
      },
      required: ["nodeId"],
      additionalProperties: false
    }
  },
  {
    name: "move_node",
    description: "Move an existing node into a target parent at an optional index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        parentId: { type: "string" },
        index: { type: "number" }
      },
      required: ["nodeId", "parentId"],
      additionalProperties: false
    }
  },
  {
    name: "move_section",
    description: "Move or reorder an explicit container section into a destination parent at an optional index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        sectionId: { type: "string" },
        destinationParentId: { type: "string" },
        index: { type: "number" }
      },
      required: ["sectionId"],
      additionalProperties: false
    }
  },
  {
    name: "normalize_spacing",
    description: "Normalize auto layout gap and/or padding for an explicit container and optional descendant subtree.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        containerId: { type: "string" },
        spacing: { type: "number" },
        mode: { type: "string", enum: ["both", "gap", "padding"] },
        recursive: { type: "boolean" }
      },
      required: ["containerId"],
      additionalProperties: false
    }
  },
  {
    name: "promote_section",
    description: "Preview or apply promotion of a section-like node to a more primary position, with optional spacing normalization.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        sectionId: { type: "string" },
        destinationParentId: { type: "string" },
        index: { type: "number" },
        previewOnly: { type: "boolean" },
        normalizeSpacing: {
          type: "object",
          properties: {
            spacing: { type: "number" },
            mode: { type: "string", enum: ["both", "gap", "padding"] },
            recursive: { type: "boolean" }
          },
          additionalProperties: false
        }
      },
      required: ["sectionId"],
      additionalProperties: false
    }
  },
  {
    name: "apply_naming_rule",
    description: "Preview or apply a safe pattern-mapped rename plan for a subtree.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        rootNodeId: { type: "string" },
        ruleSet: {
          type: "string",
          enum: ["app-screen", "header-basic", "tab-bar-basic", "card-list-basic", "fab-basic", "content-screen-basic", "ai-chat-screen"]
        },
        recursive: { type: "boolean" },
        previewOnly: { type: "boolean" }
      },
      required: ["rootNodeId"],
      additionalProperties: false
    }
  },
  {
    name: "delete_node",
    description: "Delete a node from the connected Figma file.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" }
      },
      required: ["nodeId"],
      additionalProperties: false
    }
  },
  {
    name: "reorder_child",
    description: "Reorder a node within its current parent by child index.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        nodeId: { type: "string" },
        index: { type: "number" }
      },
      required: ["nodeId", "index"],
      additionalProperties: false
    }
  },
  {
    name: "boolean_subtract",
    description: "Create a Figma subtract boolean operation from a base node and one or more subtractor nodes.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" },
        baseNodeId: { type: "string" },
        subtractNodeIds: {
          type: "array",
          items: { type: "string" }
        },
        parentId: { type: "string" },
        index: { type: "number" },
        name: { type: "string" }
      },
      required: ["baseNodeId", "subtractNodeIds"],
      additionalProperties: false
    }
  },
  {
    name: "undo_last_batch",
    description: "Undo the most recent supported mutation batch in the current plugin session.",
    inputSchema: {
      type: "object",
      properties: {
        pluginId: { type: "string", default: "default" }
      },
      additionalProperties: false
    }
  }
];
}
