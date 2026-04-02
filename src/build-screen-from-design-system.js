const DEFAULT_SECTIONS = ["header", "content", "actions"];
const REFERENCE_PATTERNS = {
  "dashboard-analytics": {
    width: 1440,
    height: 1024,
    backgroundColor: "#F7F8FA",
    sections: [
      {
        type: "navigation",
        name: "sidebar",
        headerTitle: "Workspace"
      },
      {
        type: "header",
        name: "topbar",
        headerTitle: "Dashboard"
      },
      {
        type: "summary-cards",
        name: "kpis",
        contentTitle: "Overall Tasks",
        contentBody: "Spread across 6 projects."
      },
      {
        type: "timeline",
        name: "project-timeline",
        contentTitle: "Project Timeline",
        contentBody: "Visualize your project schedule, key milestones, and deadlines in a chronological view."
      },
      {
        type: "table",
        name: "project-list",
        contentTitle: "Project List",
        contentBody: "See all your projects in one place organized, searchable, and easy to manage."
      },
      {
        type: "actions",
        name: "footer-actions",
        primaryActionQuery: "v2_test/button",
        primaryActionLabel: "New Task"
      }
    ]
  }
};
const SUPPORTED_SECTION_TYPES = [
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

function clampNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function normalizeStringList(value, maxItems = 8) {
  if (!Array.isArray(value) || value.length === 0) {
    return [];
  }

  const seen = [];
  for (const item of value) {
    const normalized = String(item || "").trim();
    if (!normalized || seen.includes(normalized)) {
      continue;
    }
    seen.push(normalized);
    if (seen.length >= maxItems) {
      break;
    }
  }

  return seen;
}

function resolveReferencePattern(input = {}) {
  const patternName =
    typeof input.referencePattern === "string" && input.referencePattern.trim()
      ? input.referencePattern.trim().toLowerCase()
      : "";

  if (!patternName || !REFERENCE_PATTERNS[patternName]) {
    return null;
  }

  return REFERENCE_PATTERNS[patternName];
}

function resolveReferenceAnalysis(input = {}) {
  if (!input || typeof input.referenceAnalysis !== "object" || !input.referenceAnalysis) {
    return null;
  }

  const analysis = input.referenceAnalysis;
  return {
    width:
      typeof analysis.width === "number" && Number.isFinite(analysis.width)
        ? analysis.width
        : undefined,
    height:
      typeof analysis.height === "number" && Number.isFinite(analysis.height)
        ? analysis.height
        : undefined,
    backgroundColor:
      typeof analysis.backgroundColor === "string" && analysis.backgroundColor.trim()
        ? analysis.backgroundColor.trim()
        : undefined,
    sections: Array.isArray(analysis.sections) ? analysis.sections : []
  };
}

function slugifySectionName(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function normalizeSectionSpecs(sectionSpecs, sections) {
  const hasExplicitSpecs = Array.isArray(sectionSpecs) && sectionSpecs.length > 0;
  const source = hasExplicitSpecs
    ? sectionSpecs
    : Array.isArray(sections) && sections.length > 0
      ? sections
      : DEFAULT_SECTIONS;

  const seenKeys = [];
  const seenLegacyTypes = [];
  const specs = [];

  for (const item of source) {
    const rawType =
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? item.type
          : "";
    const type = String(rawType || "").trim().toLowerCase();
    if (!SUPPORTED_SECTION_TYPES.includes(type)) {
      continue;
    }
    if (!hasExplicitSpecs && seenLegacyTypes.includes(type)) {
      continue;
    }
    if (!hasExplicitSpecs) {
      seenLegacyTypes.push(type);
    }

    const rawName =
      item && typeof item === "object" && typeof item.name === "string"
        ? item.name.trim()
        : "";
    const baseKey = slugifySectionName(rawName, type);
    let key = baseKey;
    let suffix = 2;
    while (seenKeys.includes(key)) {
      key = `${baseKey}-${suffix}`;
      suffix += 1;
    }
    seenKeys.push(key);

    const spec = {
      key,
      type,
      name: rawName || type
    };

    if (item && typeof item === "object") {
      if (typeof item.headerQuery === "string" && item.headerQuery.trim()) {
        spec.headerQuery = item.headerQuery.trim();
      }
      if (typeof item.headerTitle === "string" && item.headerTitle.trim()) {
        spec.headerTitle = item.headerTitle.trim();
      }
      if (typeof item.contentTitle === "string" && item.contentTitle.trim()) {
        spec.contentTitle = item.contentTitle.trim();
      }
      if (typeof item.contentBody === "string" && item.contentBody.trim()) {
        spec.contentBody = item.contentBody.trim();
      }
      if (typeof item.primaryActionQuery === "string" && item.primaryActionQuery.trim()) {
        spec.primaryActionQuery = item.primaryActionQuery.trim();
      }
      if (typeof item.primaryActionLabel === "string" && item.primaryActionLabel.trim()) {
        spec.primaryActionLabel = item.primaryActionLabel.trim();
      }
      spec.contentComponentQueries = normalizeStringList(item.contentComponentQueries, 6);
    } else {
      spec.contentComponentQueries = [];
    }

    specs.push(spec);
  }

  if (specs.length === 0) {
    return DEFAULT_SECTIONS.map((type) => ({
      key: type,
      type,
      name: type,
      contentComponentQueries: []
    }));
  }

  return specs;
}

export function buildScreenFromDesignSystemPlan(input = {}) {
  const parentId = String(input.parentId || "").trim();
  const targetRootId = String(input.targetRootId || "").trim();
  if (!parentId && !targetRootId) {
    throw new Error("parentId or targetRootId is required");
  }

  const referencePattern = resolveReferencePattern(input);
  const referenceAnalysis = resolveReferenceAnalysis(input);

  const width = clampNumber(
    input.width,
    referenceAnalysis && typeof referenceAnalysis.width === "number"
      ? referenceAnalysis.width
      : referencePattern
        ? referencePattern.width
        : 393,
    320,
    1920
  );
  const height = clampNumber(
    input.height,
    referenceAnalysis && typeof referenceAnalysis.height === "number"
      ? referenceAnalysis.height
      : referencePattern
        ? referencePattern.height
        : 852,
    240,
    4000
  );
  const explicitSectionSpecs =
    Array.isArray(input.sectionSpecs) && input.sectionSpecs.length > 0
      ? input.sectionSpecs
      : referenceAnalysis && referenceAnalysis.sections.length > 0
        ? referenceAnalysis.sections
        : undefined;
  const legacySections =
    explicitSectionSpecs ||
    (referencePattern ? referencePattern.sections : input.sections);
  const sectionKeyFilter = normalizeStringList(input.sectionKeys, 20);
  const sectionSpecs = normalizeSectionSpecs(explicitSectionSpecs, legacySections).filter(
    (spec) =>
      sectionKeyFilter.length === 0 ||
      sectionKeyFilter.includes(spec.key) ||
      sectionKeyFilter.includes(spec.type) ||
      sectionKeyFilter.includes(spec.name)
  );
  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim()
      : "screen";

  const paddingX = clampNumber(input.paddingX, 24, 0, 200);
  const paddingY = clampNumber(input.paddingY, 24, 0, 200);
  const sectionGap = clampNumber(input.sectionGap, 24, 0, 200);
  const contentGap = clampNumber(input.contentGap, 16, 0, 200);

  return {
    parentId: parentId || undefined,
    targetRootId: targetRootId || undefined,
    name,
    annotate: Boolean(input.annotate),
    replaceExistingSections:
      typeof input.replaceExistingSections === "boolean"
        ? input.replaceExistingSections
        : Boolean(targetRootId),
    width,
    height,
    x: typeof input.x === "number" && Number.isFinite(input.x) ? input.x : undefined,
    y: typeof input.y === "number" && Number.isFinite(input.y) ? input.y : undefined,
    sections: sectionSpecs.map((spec) => spec.type),
    sectionSpecs,
    backgroundColor:
      typeof input.backgroundColor === "string" && input.backgroundColor.trim()
        ? input.backgroundColor.trim()
        : referenceAnalysis && referenceAnalysis.backgroundColor
          ? referenceAnalysis.backgroundColor
        : referencePattern && referencePattern.backgroundColor
          ? referencePattern.backgroundColor
          : "#FFFFFF",
    headerQuery:
      typeof input.headerQuery === "string" && input.headerQuery.trim()
        ? input.headerQuery.trim()
        : undefined,
    headerTitle:
      typeof input.headerTitle === "string" && input.headerTitle.trim()
        ? input.headerTitle.trim()
        : undefined,
    contentTitle:
      typeof input.contentTitle === "string" && input.contentTitle.trim()
        ? input.contentTitle.trim()
        : undefined,
    contentBody:
      typeof input.contentBody === "string" && input.contentBody.trim()
        ? input.contentBody.trim()
        : undefined,
    contentComponentQueries: normalizeStringList(input.contentComponentQueries, 6),
    primaryActionQuery:
      typeof input.primaryActionQuery === "string" && input.primaryActionQuery.trim()
        ? input.primaryActionQuery.trim()
        : undefined,
    primaryActionLabel:
      typeof input.primaryActionLabel === "string" && input.primaryActionLabel.trim()
        ? input.primaryActionLabel.trim()
        : undefined,
    paddingX,
    paddingY,
    sectionGap,
    contentGap,
    sectionKeys: sectionKeyFilter,
    referenceAnalysis:
      referenceAnalysis && referenceAnalysis.sections.length > 0
        ? {
            width: referenceAnalysis.width,
            height: referenceAnalysis.height,
            backgroundColor: referenceAnalysis.backgroundColor,
            sections: referenceAnalysis.sections
          }
        : undefined,
    referencePattern:
      typeof input.referencePattern === "string" && input.referencePattern.trim()
        ? input.referencePattern.trim()
        : undefined
  };
}

export function buildSectionBlueprints(plan) {
  return plan.sectionSpecs.map((sectionSpec) => {
    const section = sectionSpec.type;
    if (section === "header") {
      return {
        key: sectionSpec.key,
        type: section,
        name: sectionSpec.name,
        height: 56,
        layoutMode: "HORIZONTAL",
        itemSpacing: 12,
        primaryAxisAlignItems: "SPACE_BETWEEN",
        counterAxisAlignItems: "CENTER",
        primaryAxisSizingMode: "FIXED",
        counterAxisSizingMode: "AUTO",
        layoutAlign: "STRETCH",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0
      };
    }

    if (section === "content") {
      return {
        key: sectionSpec.key,
        type: section,
        name: sectionSpec.name,
        height: 480,
        layoutMode: "VERTICAL",
        itemSpacing: plan.contentGap,
        primaryAxisAlignItems: "MIN",
        counterAxisAlignItems: "MIN",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        layoutAlign: "STRETCH",
        layoutGrow: 1,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0
      };
    }

    if (section === "navigation") {
      return {
        key: sectionSpec.key,
        type: section,
        name: sectionSpec.name,
        height: 220,
        layoutMode: "VERTICAL",
        itemSpacing: 12,
        primaryAxisAlignItems: "MIN",
        counterAxisAlignItems: "MIN",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        layoutAlign: "STRETCH",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0
      };
    }

    if (section === "summary-cards") {
      return {
        key: sectionSpec.key,
        type: section,
        name: sectionSpec.name,
        height: 240,
        layoutMode: "HORIZONTAL",
        itemSpacing: 16,
        primaryAxisAlignItems: "MIN",
        counterAxisAlignItems: "MIN",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        layoutAlign: "STRETCH",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0
      };
    }

    if (section === "timeline") {
      return {
        key: sectionSpec.key,
        type: section,
        name: sectionSpec.name,
        height: 360,
        layoutMode: "VERTICAL",
        itemSpacing: 16,
        primaryAxisAlignItems: "MIN",
        counterAxisAlignItems: "MIN",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        layoutAlign: "STRETCH",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0
      };
    }

    if (section === "list" || section === "table" || section === "form") {
      return {
        key: sectionSpec.key,
        type: section,
        name: sectionSpec.name,
        height: section === "table" ? 320 : 280,
        layoutMode: "VERTICAL",
        itemSpacing: 16,
        primaryAxisAlignItems: "MIN",
        counterAxisAlignItems: "MIN",
        primaryAxisSizingMode: "AUTO",
        counterAxisSizingMode: "AUTO",
        layoutAlign: "STRETCH",
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 0,
        paddingBottom: 0
      };
    }

    return {
      key: sectionSpec.key,
      type: section,
      name: sectionSpec.name,
      height: 52,
      layoutMode: "VERTICAL",
      itemSpacing: 12,
      primaryAxisAlignItems: "MIN",
      counterAxisAlignItems: "MIN",
      primaryAxisSizingMode: "AUTO",
      counterAxisSizingMode: "AUTO",
      layoutAlign: "STRETCH",
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0
    };
  });
}
