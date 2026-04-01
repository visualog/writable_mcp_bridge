const SUPPORTED_EXPORT_FORMATS = ["svg", "png"];

export function listSupportedExportFormats() {
  return SUPPORTED_EXPORT_FORMATS.slice();
}

export function buildExportNodePlan(input = {}) {
  const targetNodeId = String(input.targetNodeId || "").trim();
  const format = String(input.format || "svg").trim().toLowerCase();

  if (format && !SUPPORTED_EXPORT_FORMATS.includes(format)) {
    throw new Error(
      `format must be one of: ${SUPPORTED_EXPORT_FORMATS.join(", ")}`
    );
  }

  const plan = {
    format
  };

  if (targetNodeId) {
    plan.targetNodeId = targetNodeId;
  }

  if (typeof input.scale === "number" && Number.isFinite(input.scale) && input.scale > 0) {
    plan.scale = input.scale;
  }

  if (typeof input.contentsOnly === "boolean") {
    plan.contentsOnly = input.contentsOnly;
  }

  if (typeof input.useAbsoluteBounds === "boolean") {
    plan.useAbsoluteBounds = input.useAbsoluteBounds;
  }

  if (typeof input.svgOutlineText === "boolean") {
    plan.svgOutlineText = input.svgOutlineText;
  }

  if (typeof input.svgIdAttribute === "boolean") {
    plan.svgIdAttribute = input.svgIdAttribute;
  }

  return plan;
}
