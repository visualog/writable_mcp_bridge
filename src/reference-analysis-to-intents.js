function normalizeSections(value) {
  return Array.isArray(value) ? value : [];
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
      return {
        key: baseName,
        name: baseName,
        intent: "data/table",
        title: contentTitle || headerTitle || "Table",
        density: "comfortable",
        columns: ["Name", "Summary"],
        rows: [
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

    return {
      key: baseName,
      name: baseName,
      intent: type === "actions" ? "screen/actions" : "content/section",
      title: contentTitle || headerTitle || baseName,
      children: buildTextCard(contentTitle, contentBody, baseName)
    };
  });
}
