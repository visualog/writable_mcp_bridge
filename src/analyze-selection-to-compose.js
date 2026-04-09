function normalizeName(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function buildAnalyzeSelectionToComposePlan(input = {}, analysisResult = {}) {
  const parentId = String(input.parentId || "").trim();
  if (!parentId) {
    throw new Error("parentId is required");
  }

  const targetNodeId = String(input.targetNodeId || "").trim() || undefined;
  const selectionName = String(analysisResult.selection?.name || "").trim();
  const referenceAnalysis =
    analysisResult.referenceAnalysis && typeof analysisResult.referenceAnalysis === "object"
      ? analysisResult.referenceAnalysis
      : undefined;
  const sections = Array.isArray(analysisResult.intentSections)
    ? analysisResult.intentSections
    : [];
  if (sections.length === 0) {
    throw new Error("analysis result must include intentSections");
  }

  return {
    parentId,
    targetNodeId,
    name: normalizeName(input.name, `${normalizeName(selectionName, "selection")}-composed`),
    x: normalizeNumber(input.x),
    y: normalizeNumber(input.y),
    width: normalizeNumber(input.width) ?? referenceAnalysis?.width,
    height: normalizeNumber(input.height) ?? referenceAnalysis?.height,
    backgroundColor:
      typeof input.backgroundColor === "string" && input.backgroundColor.trim()
        ? input.backgroundColor.trim()
        : referenceAnalysis?.backgroundColor,
    sections,
    referenceAnalysis
  };
}
