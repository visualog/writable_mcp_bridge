function normalizeComponentNodeId(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("componentNodeId is required");
  }

  return value.trim();
}

function normalizeVariantProperties(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("variantProperties object is required");
  }

  const entries = Object.entries(value);
  if (entries.length === 0) {
    throw new Error("variantProperties must contain at least one entry");
  }

  const normalized = {};
  for (const [key, raw] of entries) {
    const propertyName = typeof key === "string" ? key.trim() : "";
    if (!propertyName) {
      throw new Error("variant property names must be non-empty strings");
    }

    if (typeof raw !== "string" || !raw.trim()) {
      throw new Error("variant property values must be non-empty strings");
    }

    normalized[propertyName] = raw.trim();
  }

  return normalized;
}

export function buildSetVariantPropertiesPlan(input = {}) {
  return {
    componentNodeId: normalizeComponentNodeId(input.componentNodeId),
    variantProperties: normalizeVariantProperties(input.variantProperties)
  };
}
