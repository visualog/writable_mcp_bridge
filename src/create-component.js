const SUPPORTED_CREATE_COMPONENT_SOURCE_TYPES = [
  "FRAME",
  "GROUP",
  "COMPONENT"
];

export function listSupportedCreateComponentSourceTypes() {
  return [...SUPPORTED_CREATE_COMPONENT_SOURCE_TYPES];
}

export function buildCreateComponentPlan(input = {}) {
  const targetNodeId = String(input.targetNodeId || "").trim();

  if (!targetNodeId) {
    throw new Error("targetNodeId is required");
  }

  const plan = {
    targetNodeId
  };

  if (typeof input.name === "string" && input.name.trim()) {
    plan.name = input.name.trim();
  }

  if (typeof input.description === "string" && input.description.trim()) {
    plan.description = input.description.trim();
  }

  return plan;
}
