const SUPPORTED_ANNOTATION_PROPERTY_TYPES = [
  "width",
  "height",
  "maxWidth",
  "minWidth",
  "maxHeight",
  "minHeight",
  "fills",
  "strokes",
  "effects",
  "strokeWeight",
  "cornerRadius",
  "textStyleId",
  "textAlignHorizontal",
  "fontFamily",
  "fontStyle",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "itemSpacing",
  "padding",
  "layoutMode",
  "alignItems",
  "opacity",
  "mainComponent",
  "gridRowGap",
  "gridColumnGap",
  "gridRowCount",
  "gridColumnCount",
  "gridRowAnchorIndex",
  "gridColumnAnchorIndex",
  "gridRowSpan",
  "gridColumnSpan"
];

export function listSupportedAnnotationPropertyTypes() {
  return SUPPORTED_ANNOTATION_PROPERTY_TYPES.slice();
}

export function buildAddAnnotationPlan(input = {}) {
  const targetNodeId = String(input.targetNodeId || "").trim();
  const label = String(input.label || "").trim();
  const labelMarkdown = String(input.labelMarkdown || "").trim();
  const categoryId = String(input.categoryId || "").trim();
  const clear = Boolean(input.clear);
  const replace = Boolean(input.replace);

  const properties = Array.isArray(input.properties)
    ? input.properties
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

  for (const property of properties) {
    if (!SUPPORTED_ANNOTATION_PROPERTY_TYPES.includes(property)) {
      throw new Error(
        `properties must be one of: ${SUPPORTED_ANNOTATION_PROPERTY_TYPES.join(", ")}`
      );
    }
  }

  if (!clear && !label && !labelMarkdown && properties.length === 0) {
    throw new Error("add_annotation requires label, labelMarkdown, or properties unless clear is true");
  }

  const plan = {};

  if (targetNodeId) {
    plan.targetNodeId = targetNodeId;
  }

  if (label) {
    plan.label = label;
  }

  if (labelMarkdown) {
    plan.labelMarkdown = labelMarkdown;
  }

  if (categoryId) {
    plan.categoryId = categoryId;
  }

  if (properties.length > 0) {
    plan.properties = properties;
  }

  if (clear) {
    plan.clear = true;
  }

  if (replace) {
    plan.replace = true;
  }

  return plan;
}

export function buildBulkAddAnnotationsPlan(input = {}) {
  const annotations = Array.isArray(input.annotations) ? input.annotations : [];

  if (!annotations.length) {
    throw new Error("annotations is required");
  }

  return {
    annotations: annotations.map((annotation) => buildAddAnnotationPlan(annotation))
  };
}
