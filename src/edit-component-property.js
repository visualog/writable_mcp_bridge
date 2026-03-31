function normalizeTargetNodeId(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("targetNodeId is required");
  }

  return value.trim();
}

function normalizePropertyName(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("propertyName is required");
  }

  return value.trim();
}

function normalizeNewName(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeDefaultValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      throw new Error("defaultValue strings must be non-empty");
    }
    return trimmed;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "undefined") {
    return undefined;
  }

  throw new Error("defaultValue must be a string or boolean");
}

export function buildEditComponentPropertyPlan(input = {}) {
  const targetNodeId = normalizeTargetNodeId(input.targetNodeId);
  const propertyName = normalizePropertyName(input.propertyName);
  const name = normalizeNewName(input.name);
  const defaultValue = normalizeDefaultValue(input.defaultValue);

  if (typeof name === "undefined" && typeof defaultValue === "undefined") {
    throw new Error("name or defaultValue is required");
  }

  const plan = {
    targetNodeId,
    propertyName
  };

  if (typeof name !== "undefined") {
    plan.name = name;
  }

  if (typeof defaultValue !== "undefined") {
    plan.defaultValue = defaultValue;
  }

  return plan;
}
