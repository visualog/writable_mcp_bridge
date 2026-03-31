const DEFAULT_SECTIONS = ["header", "content", "actions"];
const SUPPORTED_SECTIONS = ["header", "content", "actions"];

function clampNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function uniqueSections(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return [...DEFAULT_SECTIONS];
  }

  const seen = [];
  for (const item of value) {
    const normalized = String(item || "").trim().toLowerCase();
    if (!SUPPORTED_SECTIONS.includes(normalized) || seen.includes(normalized)) {
      continue;
    }
    seen.push(normalized);
  }

  return seen.length > 0 ? seen : [...DEFAULT_SECTIONS];
}

export function buildScreenFromDesignSystemPlan(input = {}) {
  const parentId = String(input.parentId || "").trim();
  if (!parentId) {
    throw new Error("parentId is required");
  }

  const width = clampNumber(input.width, 393, 320, 1920);
  const height = clampNumber(input.height, 852, 240, 4000);
  const sections = uniqueSections(input.sections);
  const name =
    typeof input.name === "string" && input.name.trim()
      ? input.name.trim()
      : "screen";

  const paddingX = clampNumber(input.paddingX, 24, 0, 200);
  const paddingY = clampNumber(input.paddingY, 24, 0, 200);
  const sectionGap = clampNumber(input.sectionGap, 24, 0, 200);
  const contentGap = clampNumber(input.contentGap, 16, 0, 200);

  return {
    parentId,
    name,
    width,
    height,
    x: typeof input.x === "number" && Number.isFinite(input.x) ? input.x : undefined,
    y: typeof input.y === "number" && Number.isFinite(input.y) ? input.y : undefined,
    sections,
    backgroundColor:
      typeof input.backgroundColor === "string" && input.backgroundColor.trim()
        ? input.backgroundColor.trim()
        : "#FFFFFF",
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
    contentGap
  };
}

export function buildSectionBlueprints(plan) {
  return plan.sections.map((section) => {
    if (section === "header") {
      return {
        key: "header",
        name: "header",
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
        key: "content",
        name: "content",
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

    return {
      key: "actions",
      name: "actions",
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
