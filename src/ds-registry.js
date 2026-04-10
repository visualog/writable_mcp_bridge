const DS_REGISTRY = {
  version: 1,
  intents: {
    "screen/topbar": {
      pattern: "toolbar"
    },
    "screen/browser": {
      pattern: "browser-chrome"
    },
    "screen/sidebar": {
      pattern: "sidebar-nav"
    },
    "screen/shell": {
      pattern: "app-shell"
    },
    "screen/dashboard": {
      pattern: "dashboard-board"
    },
    "screen/actions": {
      pattern: "section-block"
    },
    "status/priority": {
      pattern: "status-chip"
    },
    "status/progress": {
      pattern: "progress-bar"
    },
    "identity/assignees": {
      pattern: "avatar-stack"
    },
    "content/section": {
      pattern: "section-block"
    },
    "content/list": {
      pattern: "list-block"
    },
    "data/table": {
      pattern: "data-table"
    }
  },
  patterns: {
    "section-block": {
      kind: "helper",
      helper: "section",
      defaults: {
        widthMode: "fill",
        heightMode: "hug",
        gap: 12,
        padding: 0
      }
    },
    "list-block": {
      kind: "helper",
      helper: "list",
      defaults: {
        widthMode: "fill",
        heightMode: "hug",
        gap: 12,
        padding: 0
      }
    },
    "status-chip": {
      kind: "helper",
      helper: "status-chip",
      defaults: {
        gap: 6,
        padding: { x: 8, y: 4 },
        radius: 8,
        fontSize: 12,
        tone: "neutral"
      },
      tokens: {
        text: "#69707D",
        fill: "#F5F6FA"
      },
      variants: {
        urgent: {
          tokens: {
            text: "#EB5757",
            fill: "#FFF1F1"
          }
        },
        danger: {
          tokens: {
            text: "#EB5757",
            fill: "#FFF1F1"
          }
        },
        normal: {
          tokens: {
            text: "#16B286",
            fill: "#F1FFFA"
          }
        },
        success: {
          tokens: {
            text: "#16B286",
            fill: "#F1FFFA"
          }
        },
        warning: {
          tokens: {
            text: "#D38B00",
            fill: "#FFF7E8"
          }
        },
        low: {
          tokens: {
            text: "#69707D",
            fill: "#F5F6FA"
          }
        },
        neutral: {
          tokens: {
            text: "#69707D",
            fill: "#F5F6FA"
          }
        }
      }
    },
    toolbar: {
      kind: "helper",
      helper: "toolbar",
      defaults: {
        widthMode: "fill",
        heightMode: "hug",
        gap: 16,
        leftGap: 12,
        rightGap: 10,
        justify: "space-between",
        padding: 0
      }
    },
    "progress-bar": {
      kind: "helper",
      helper: "progress-bar",
      defaults: {
        widthMode: "hug",
        gap: 8,
        trackWidth: 88,
        trackHeight: 6,
        labelFontSize: 11,
        radius: 3
      },
      tokens: {
        trackFill: "#E8E6FF",
        barFill: "#6C63FF",
        text: "#69707D"
      }
    },
    "browser-chrome": {
      kind: "helper",
      helper: "browser-chrome",
      defaults: {
        widthMode: "fill",
        gap: 14,
        padding: { x: 14, y: 10 },
        actionsGap: 10
      },
      tokens: {
        addressFill: "#F5F6FA",
        mutedText: "#69707D",
        trafficText: "#B6B8C3"
      }
    },
    "sidebar-nav": {
      kind: "helper",
      helper: "sidebar-nav",
      defaults: {
        widthMode: "fill",
        gap: 16,
        sectionGap: 8,
        itemGap: 8,
        itemPadding: { x: 10, y: 8 },
        itemRadius: 10,
        footerGap: 8
      },
      tokens: {
        activeFill: "#F5F6FA",
        idleFill: "#FFFFFF",
        activeText: "#1A1D26",
        idleText: "#69707D",
        trailingText: "#B0B5C3"
      }
    },
    "avatar-stack": {
      kind: "helper",
      helper: "avatar-stack",
      defaults: {
        size: 20,
        gap: 4,
        overlap: 0,
        maxVisible: 4,
        moreFontSize: 12
      },
      tokens: {
        moreText: "#69707D",
        avatarFills: ["#8B80F9", "#B8B0FF", "#FF9D57", "#2AB3A6"]
      }
    },
    "app-shell": {
      kind: "helper",
      helper: "app-shell",
      defaults: {
        widthMode: "fill",
        heightMode: "hug",
        gap: 16,
        padding: 0,
        workspaceGap: 16,
        mainGap: 14,
        sidebarWidth: 248,
        sidebarPadding: 12,
        sidebarGap: 16,
        sidebarRadius: 16
      },
      tokens: {
        shellFill: "#F6F7FB",
        workspaceFill: "#F6F7FB",
        sidebarFill: "#FFFFFF",
        mainFill: "#FFFFFF"
      },
      variants: {
        "desktop-dashboard": {
          defaults: {
            workspaceGap: 20,
            mainGap: 16,
            sidebarWidth: 248
          }
        }
      }
    },
    "dashboard-board": {
      kind: "helper",
      helper: "dashboard-board",
      defaults: {
        title: "Projects",
        preset: "desktop-dashboard",
        domain: "skillsphere.com",
        sidebarWidth: 220
      },
      tokens: {
        shellFill: "#F6F7FB",
        workspaceFill: "#F6F7FB",
        sidebarFill: "#FFFFFF",
        mainFill: "#FFFFFF",
        toolbarFill: "#FFFFFF",
        toolbarTitleText: "#1A1D26"
      }
    },
    "data-table": {
      kind: "helper",
      helper: "data-table",
      defaults: {
        gap: 12,
        headerGap: 12,
        rowsGap: 10,
        rowGap: 12,
        showTopDivider: false,
        showRowDividers: true
      },
      variants: {
        comfortable: {
          defaults: {
            rowsGap: 10,
            rowGap: 12
          }
        },
        compact: {
          defaults: {
            rowsGap: 8,
            rowGap: 8
          }
        }
      }
    }
  }
};

export function getDsRegistry() {
  return DS_REGISTRY;
}

export function getIntentRegistryEntry(intentId) {
  if (typeof intentId !== "string" || !intentId.trim()) {
    return null;
  }

  return DS_REGISTRY.intents[intentId.trim()] || null;
}

export function getPatternRegistryEntry(patternId) {
  if (typeof patternId !== "string" || !patternId.trim()) {
    return null;
  }

  return DS_REGISTRY.patterns[patternId.trim()] || null;
}
