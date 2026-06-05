export function buildOperationToolDefinitions() {
  return [
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
