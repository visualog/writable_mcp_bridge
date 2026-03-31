const SUPPORTED_COMPONENT_PROPERTY_TYPES = ["BOOLEAN", "TEXT", "VARIANT"];

export function listSupportedComponentPropertyTypes() {
  return [...SUPPORTED_COMPONENT_PROPERTY_TYPES];
}

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

function normalizePropertyType(value) {
  const type = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!SUPPORTED_COMPONENT_PROPERTY_TYPES.includes(type)) {
    throw new Error(
      `propertyType must be one of: ${SUPPORTED_COMPONENT_PROPERTY_TYPES.join(", ")}`
    );
  }

  return type;
}

function normalizeDefaultValue(propertyType, value) {
  if (propertyType === "BOOLEAN") {
    if (typeof value !== "boolean") {
      throw new Error("BOOLEAN component properties require a boolean defaultValue");
    }
    return value;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${propertyType} component properties require a string defaultValue`);
  }

  return value.trim();
}

export function buildAddComponentPropertyPlan(input = {}) {
  const targetNodeId = normalizeTargetNodeId(input.targetNodeId);
  const propertyName = normalizePropertyName(input.propertyName);
  const propertyType = normalizePropertyType(input.propertyType);
  const defaultValue = normalizeDefaultValue(propertyType, input.defaultValue);

  return {
    targetNodeId,
    propertyName,
    propertyType,
    defaultValue
  };
}
