function clampNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}

function resolveParentId(input = {}) {
  const explicitParentId =
    typeof input.parentId === "string" && input.parentId.trim()
      ? input.parentId.trim()
      : null;

  if (explicitParentId) {
    return explicitParentId;
  }

  const defaultParentId =
    typeof input.defaultParentId === "string" && input.defaultParentId.trim()
      ? input.defaultParentId.trim()
      : null;

  if (defaultParentId) {
    return defaultParentId;
  }

  throw new Error("parentId is required when there is no registered current page");
}

export function buildFinanceSummaryMockPlan(input = {}) {
  return {
    parentId: resolveParentId(input),
    name:
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim()
        : "finance-summary-screen",
    width: clampNumber(input.width, 652, 360, 1440),
    height: clampNumber(input.height, 1303, 640, 2400),
    x:
      typeof input.x === "number" && Number.isFinite(input.x)
        ? input.x
        : undefined,
    y:
      typeof input.y === "number" && Number.isFinite(input.y)
        ? input.y
        : undefined
  };
}
