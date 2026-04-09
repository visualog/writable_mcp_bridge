import { resolveComponentForPattern } from "./resolve-component-for-pattern.js";

function normalizeName(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildHelperNode(section = {}, fallbackName) {
  const resolved = resolveComponentForPattern(section);
  if (!resolved) {
    return {
      status: "blocked",
      reason: "No registry mapping found for section intent or pattern.",
      resolved: null,
      node: null
    };
  }

  const helper = resolved.helper;
  const name = normalizeName(section.name, fallbackName);

  if (helper === "toolbar") {
    return {
      status: "exact-swap",
      reason: "Mapped semantic topbar intent directly to toolbar helper.",
      resolved,
      node: {
        helper: "toolbar",
        name,
        title: section.title,
        titleRole: section.titleRole,
        leftItems: normalizeArray(section.leftItems),
        rightItems: normalizeArray(section.rightItems)
      }
    };
  }

  if (helper === "sidebar-nav") {
    return {
      status: "exact-swap",
      reason: "Mapped semantic sidebar intent directly to sidebar-nav helper.",
      resolved,
      node: {
        helper: "sidebar-nav",
        name,
        title: section.title,
        workspace: section.workspace,
        sections: normalizeArray(section.sections),
        footerItems: normalizeArray(section.footerItems),
        profile: section.profile
      }
    };
  }

  if (helper === "data-table") {
    return {
      status: "compose-from-primitives",
      reason: "Mapped table intent to data-table helper with registry-backed density defaults.",
      resolved,
      node: {
        helper: "data-table",
        name,
        title: section.title,
        density: section.density,
        rowSelection: section.rowSelection,
        rowActions: section.rowActions,
        rowActionsHeader: section.rowActionsHeader,
        columns: normalizeArray(section.columns),
        rows: normalizeArray(section.rows)
      }
    };
  }

  if (helper === "section") {
    return {
      status: "fallback-helper",
      reason: "Mapped content intent to a generic section helper.",
      resolved,
      node: {
        helper: "section",
        name,
        title: section.title,
        children: normalizeArray(section.children)
      }
    };
  }

  if (helper === "list") {
    return {
      status: "fallback-helper",
      reason: "Mapped content intent to a generic list helper.",
      resolved,
      node: {
        helper: "list",
        name,
        title: section.title,
        children: normalizeArray(section.children)
      }
    };
  }

  if (helper === "status-chip") {
    return {
      status: "exact-swap",
      reason: "Mapped status intent directly to status-chip helper.",
      resolved,
      node: {
        helper: "status-chip",
        name,
        label: section.label,
        tone: section.tone || section.variant
      }
    };
  }

  if (helper === "progress-bar") {
    return {
      status: "exact-swap",
      reason: "Mapped progress intent directly to progress-bar helper.",
      resolved,
      node: {
        helper: "progress-bar",
        name,
        percent: section.percent,
        label: section.label,
        showLabel: section.showLabel
      }
    };
  }

  if (helper === "avatar-stack") {
    return {
      status: "exact-swap",
      reason: "Mapped assignee intent directly to avatar-stack helper.",
      resolved,
      node: {
        helper: "avatar-stack",
        name,
        users: normalizeArray(section.users),
        overlap: section.overlap,
        showInitials: section.showInitials
      }
    };
  }

  if (helper === "browser-chrome") {
    return {
      status: "exact-swap",
      reason: "Mapped browser shell intent directly to browser-chrome helper.",
      resolved,
      node: {
        helper: "browser-chrome",
        name,
        domain: section.domain,
        leftActions: normalizeArray(section.leftActions),
        rightActions: normalizeArray(section.rightActions)
      }
    };
  }

  if (helper === "app-shell") {
    return {
      status: "compose-from-primitives",
      reason: "Mapped shell intent to app-shell helper.",
      resolved,
      node: {
        helper: "app-shell",
        name,
        preset: section.preset,
        browser: section.browser,
        sidebar: section.sidebar,
        content: normalizeArray(section.content)
      }
    };
  }

  if (helper === "dashboard-board") {
    return {
      status: "compose-from-primitives",
      reason: "Mapped dashboard intent to dashboard-board preset.",
      resolved,
      node: {
        helper: "dashboard-board",
        name,
        title: section.title,
        preset: section.preset,
        domain: section.domain,
        sidebar: section.sidebar,
        toolbar: section.toolbar,
        tabs: section.tabs,
        sections: normalizeArray(section.sections)
      }
    };
  }

  return {
    status: "fallback-helper",
    reason: "Resolved a helper mapping but no specialized section composer branch exists yet.",
    resolved,
    node: {
      helper,
      name,
      ...section
    }
  };
}

export function composeSectionsFromIntents(input = {}) {
  const screenName = normalizeName(input.name, "intent-composed-screen");
  const sections = normalizeArray(input.sections);

  if (sections.length === 1) {
    const single = buildHelperNode(sections[0], `${screenName}-section-1`);
    if (single.node && ["dashboard-board", "app-shell"].includes(single.node.helper)) {
      return {
        name: screenName,
        width: typeof input.width === "number" ? input.width : undefined,
        height: typeof input.height === "number" ? input.height : undefined,
        composition: [
          {
            key: "root",
            intent: sections[0].intent || null,
            pattern: single.resolved?.pattern || null,
            helper: single.resolved?.helper || single.node.helper,
            status: single.status,
            reason: single.reason
          }
        ],
        root: single.node
      };
    }
  }

  const composition = [];
  const children = sections
    .map((section, index) => {
      const result = buildHelperNode(section, `${screenName}-section-${index + 1}`);
      composition.push({
        key: normalizeName(section.key, `section-${index + 1}`),
        intent: section.intent || null,
        pattern: result.resolved?.pattern || null,
        helper: result.resolved?.helper || null,
        status: result.status,
        reason: result.reason
      });
      return result.node;
    })
    .filter(Boolean);

  return {
    name: screenName,
    width: typeof input.width === "number" ? input.width : undefined,
    height: typeof input.height === "number" ? input.height : undefined,
    composition,
    root: {
      helper: "screen",
      name: screenName,
      width: typeof input.width === "number" ? input.width : 1440,
      height: typeof input.height === "number" ? input.height : 960,
      backgroundColor:
        typeof input.backgroundColor === "string" && input.backgroundColor.trim()
          ? input.backgroundColor.trim()
          : "#FFFFFF",
      children
    }
  };
}
