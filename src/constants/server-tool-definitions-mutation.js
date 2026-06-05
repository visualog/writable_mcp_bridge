import { listSupportedApplyStyleTypes } from "../apply-style.js";
import { listSupportedComponentPropertyTypes } from "../add-component-property.js";
import { listSupportedBindVariableFields } from "../bind-variable.js";
import { listSupportedCreateComponentSourceTypes } from "../create-component.js";

export function buildMutationToolDefinitions() {
  return [
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
    }
  ];
}
