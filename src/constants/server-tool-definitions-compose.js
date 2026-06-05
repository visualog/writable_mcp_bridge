const designSystemSectionTypes = [
  "header",
  "content",
  "actions",
  "navigation",
  "summary-cards",
  "timeline",
  "list",
  "table",
  "form"
];

const designSystemSectionProperties = {
  type: {
    type: "string",
    enum: designSystemSectionTypes
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
};

const designSystemReferenceAnalysisSchema = {
  type: "object",
  properties: {
    width: { type: "number" },
    height: { type: "number" },
    backgroundColor: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: designSystemSectionProperties,
        required: ["type"],
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};

const tableColumnsSchema = {
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
};

const tableRowPatternSchema = {
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
};

const actionGroupsSchema = {
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
};

const externalReferenceAnalysisSchema = {
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
          tableColumns: tableColumnsSchema,
          tableRowPattern: tableRowPatternSchema,
          actionGroups: actionGroupsSchema
        },
        additionalProperties: true
      }
    }
  },
  additionalProperties: true
};

const composeSectionItemSchema = {
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
};

const buildLayoutTreeSchema = {
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
};

export function buildComposeToolDefinitions() {
  return [
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
          referenceAnalysis: designSystemReferenceAnalysisSchema,
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
              enum: designSystemSectionTypes
            }
          },
          sectionSpecs: {
            type: "array",
            items: {
              type: "object",
              properties: designSystemSectionProperties,
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
          referenceAnalysis: externalReferenceAnalysisSchema,
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
          referenceAnalysis: externalReferenceAnalysisSchema,
          sections: {
            type: "array",
            items: composeSectionItemSchema
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
          tree: buildLayoutTreeSchema
        },
        additionalProperties: false
      }
    }
  ];
}
