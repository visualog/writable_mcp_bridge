export function buildCreateComponentSetPlan(input = {}) {
  const componentNodeIds = Array.isArray(input.componentNodeIds)
    ? input.componentNodeIds
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : [];

  if (componentNodeIds.length < 2) {
    throw new Error("componentNodeIds must contain at least two component node ids");
  }

  const plan = {
    componentNodeIds: Array.from(new Set(componentNodeIds))
  };

  if (plan.componentNodeIds.length < 2) {
    throw new Error("componentNodeIds must contain at least two unique component node ids");
  }

  if (typeof input.parentId === "string" && input.parentId.trim()) {
    plan.parentId = input.parentId.trim();
  }

  if (typeof input.index === "number" && Number.isFinite(input.index)) {
    plan.index = Math.trunc(input.index);
  }

  if (typeof input.name === "string" && input.name.trim()) {
    plan.name = input.name.trim();
  }

  if (typeof input.description === "string" && input.description.trim()) {
    plan.description = input.description.trim();
  }

  return plan;
}
