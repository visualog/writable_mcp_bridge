export function buildCreateInstancePlan(input = {}) {
  const sourceNodeId = String(input.sourceNodeId || "").trim();
  const explicitParentId = String(input.parentId || "").trim();
  const defaultParentId = String(input.defaultParentId || "").trim();
  const parentId = explicitParentId || defaultParentId;

  if (!sourceNodeId) {
    throw new Error("sourceNodeId is required");
  }

  if (!parentId) {
    throw new Error("parentId is required when there is no registered current page");
  }

  const plan = {
    sourceNodeId,
    parentId
  };

  if (typeof input.name === "string" && input.name.trim()) {
    plan.name = input.name.trim();
  }
  if (typeof input.index === "number" && Number.isFinite(input.index)) {
    plan.index = Math.trunc(input.index);
  }
  if (typeof input.x === "number" && Number.isFinite(input.x)) {
    plan.x = input.x;
  }
  if (typeof input.y === "number" && Number.isFinite(input.y)) {
    plan.y = input.y;
  }

  return plan;
}
