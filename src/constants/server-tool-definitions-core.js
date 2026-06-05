export function buildCoreToolDefinitions() {
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
    }
  ];
}
