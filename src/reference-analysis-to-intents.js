function normalizeSections(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildTableColumns(section = {}) {
  const explicit = normalizeArray(section.tableColumns);
  if (explicit.length === 0) {
    return ["Name", "Summary"];
  }
  return explicit.map((column, index) => {
    if (typeof column === "string") {
      return column;
    }
    if (!column || typeof column !== "object") {
      return `Column ${index + 1}`;
    }
    return {
      label:
        typeof column.label === "string" && column.label.trim()
          ? column.label.trim()
          : typeof column.name === "string" && column.name.trim()
            ? column.name.trim()
            : `Column ${index + 1}`,
      width: typeof column.width === "number" && Number.isFinite(column.width) ? column.width : undefined,
      align:
        typeof column.align === "string" && column.align.trim()
          ? column.align.trim()
          : undefined
    };
  });
}

function buildRowPatternCells(section = {}, columns = []) {
  const pattern = normalizeArray(section.tableRowPattern);
  if (pattern.length === 0) {
    return null;
  }
  const base = pattern.map((entry, index) => {
    const type =
      typeof entry === "string"
        ? entry
        : typeof entry?.type === "string"
          ? entry.type
          : null;
    if (type === "media-row") {
      return {
        title: typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : "Wireframing",
        meta: typeof entry.meta === "string" && entry.meta.trim() ? entry.meta.trim() : "Dashboard page",
        pattern: "media-row",
        showLeading: false
      };
    }
    if (type === "status-chip") {
      return {
        helper: "status-chip",
        label: typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : "Normal",
        tone: typeof entry.tone === "string" && entry.tone.trim() ? entry.tone.trim() : "normal"
      };
    }
    if (type === "progress-bar") {
      return {
        helper: "progress-bar",
        percent: 62,
        showLabel: false
      };
    }
    if (type === "avatar-stack") {
      return {
        type: "avatars",
        avatars: ["IR", "HG", "TB"]
      };
    }
    if (type === "action-menu") {
      return { type: "action-menu" };
    }
    if (type === "action-box") {
      return { type: "action-box" };
    }
    const label =
      typeof entry?.label === "string" && entry.label.trim()
        ? entry.label.trim()
        : `Cell ${index + 1}`;
    return { label };
  });

  if (columns.length > base.length) {
    while (base.length < columns.length) {
      base.push({ label: "Value" });
    }
  }
  return base;
}

function buildActionGroupChildren(section = {}, fallbackName) {
  const groups = normalizeArray(section.actionGroups);
  if (groups.length === 0) {
    return null;
  }

  return groups.map((group, groupIndex) => ({
    helper: "row",
    name: `${fallbackName}-action-group-${groupIndex + 1}`,
    widthMode: "fill",
    justify: "space-between",
    align: "center",
    children: [
      {
        helper: "text",
        name: `${fallbackName}-action-group-${groupIndex + 1}-label`,
        characters:
          typeof group?.label === "string" && group.label.trim()
            ? group.label.trim()
            : `Group ${groupIndex + 1}`,
        role: "meta"
      },
      {
        helper: "text",
        name: `${fallbackName}-action-group-${groupIndex + 1}-actions`,
        characters: normalizeArray(group?.actions)
          .map((action) =>
            typeof action?.label === "string" && action.label.trim()
              ? action.label.trim()
              : typeof action?.intent === "string"
                ? action.intent
                : null
          )
          .filter(Boolean)
          .join(" · "),
        role: "meta"
      }
    ]
  }));
}

function buildTextCard(title, body, fallbackName) {
  const children = [];
  if (typeof body === "string" && body.trim()) {
    children.push({
      helper: "card",
      name: `${fallbackName}-card`,
      widthMode: "fill",
      children: [
        {
          helper: "text",
          name: `${fallbackName}-body`,
          characters: body.trim(),
          role: "meta"
        }
      ]
    });
  }

  return children;
}

export function deriveIntentSectionsFromReferenceAnalysis(referenceAnalysis = {}) {
  const sections = normalizeSections(referenceAnalysis.sections);

  return sections.map((section, index) => {
    const type = String(section?.type || "").trim().toLowerCase();
    const baseName =
      typeof section?.name === "string" && section.name.trim()
        ? section.name.trim()
        : `${type || "section"}-${index + 1}`;
    const headerTitle =
      typeof section?.headerTitle === "string" && section.headerTitle.trim()
        ? section.headerTitle.trim()
        : undefined;
    const contentTitle =
      typeof section?.contentTitle === "string" && section.contentTitle.trim()
        ? section.contentTitle.trim()
        : undefined;
    const contentBody =
      typeof section?.contentBody === "string" && section.contentBody.trim()
        ? section.contentBody.trim()
        : undefined;

    if (type === "navigation") {
      return {
        key: baseName,
        name: baseName,
        intent: "screen/sidebar",
        title: headerTitle || contentTitle || "Navigation",
        sections: contentTitle
          ? [{ title: contentTitle, items: [{ label: contentTitle }] }]
          : []
      };
    }

    if (type === "header") {
      return {
        key: baseName,
        name: baseName,
        intent: "screen/topbar",
        title: headerTitle || contentTitle || "Overview",
        rightItems:
          typeof contentBody === "string" && contentBody
            ? [
                {
                  helper: "text",
                  name: `${baseName}-meta`,
                  characters: contentBody,
                  role: "meta"
                }
              ]
            : []
      };
    }

    if (type === "table") {
      const columns = buildTableColumns(section);
      const patternCells = buildRowPatternCells(section, columns);
      return {
        key: baseName,
        name: baseName,
        intent: "data/table",
        title: contentTitle || headerTitle || "Table",
        density:
          typeof section?.density === "string" && section.density.trim()
            ? section.density.trim()
            : "comfortable",
        columns,
        rows: patternCells
          ? [{ cells: patternCells }, { cells: patternCells }]
          : [
              [contentTitle || "Item", contentBody || "Reference-derived row"],
              ["Next", "Composable placeholder"]
            ]
      };
    }

    if (type === "list") {
      return {
        key: baseName,
        name: baseName,
        intent: "content/list",
        title: contentTitle || headerTitle || "List",
        children: buildTextCard(contentTitle, contentBody, baseName)
      };
    }

    const actionChildren = type === "actions" ? buildActionGroupChildren(section, baseName) : null;

    return {
      key: baseName,
      name: baseName,
      intent: type === "actions" ? "screen/actions" : "content/section",
      title: contentTitle || headerTitle || baseName,
      children:
        actionChildren && actionChildren.length > 0
          ? actionChildren
          : buildTextCard(contentTitle, contentBody, baseName)
    };
  });
}
