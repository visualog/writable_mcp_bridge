import { buildCreateComponentPlan } from "./create-component.js";
import { buildFindOrImportComponentPlan } from "./find-or-import-component.js";

export function buildReuseOrCreateComponentPlan(input = {}) {
  const findPlan = buildFindOrImportComponentPlan(input);
  const plan = {};

  for (const [key, value] of Object.entries(findPlan)) {
    if (value !== undefined) {
      plan[key] = value;
    }
  }

  if (typeof input.targetNodeId === "string" && input.targetNodeId.trim()) {
    plan.targetNodeId = input.targetNodeId.trim();
  }

  if (typeof input.createName === "string" && input.createName.trim()) {
    plan.createName = input.createName.trim();
  }

  if (typeof input.createDescription === "string" && input.createDescription.trim()) {
    plan.createDescription = input.createDescription.trim();
  }

  return plan;
}

export function buildCreateFallbackPlan(input = {}) {
  const targetNodeId = String(input.targetNodeId || "").trim();
  if (!targetNodeId) {
    return null;
  }

  return buildCreateComponentPlan({
    targetNodeId,
    name: input.createName || input.query,
    description: input.createDescription
  });
}
