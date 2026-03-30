function normalizeNodeId(value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("nodeId is required");
  }

  return value.trim();
}

function normalizePropertyValue(value) {
  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  throw new Error("component property values must be strings or booleans");
}

export function buildSetComponentPropertiesPlan(input = {}) {
  const nodeId = normalizeNodeId(input.nodeId);

  if (!input.properties || typeof input.properties !== "object" || Array.isArray(input.properties)) {
    throw new Error("properties object is required");
  }

  const entries = Object.entries(input.properties);
  if (entries.length === 0) {
    throw new Error("properties must contain at least one entry");
  }

  const properties = {};
  for (const [key, value] of entries) {
    const normalizedKey = typeof key === "string" ? key.trim() : "";
    if (!normalizedKey) {
      throw new Error("property names must be non-empty strings");
    }
    properties[normalizedKey] = normalizePropertyValue(value);
  }

  return {
    nodeId,
    properties
  };
}
