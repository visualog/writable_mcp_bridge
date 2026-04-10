import { getDsRegistry } from "./ds-registry.js";

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function mergeRegistry(base, override) {
  if (!isPlainObject(override)) {
    return base;
  }

  const next = {
    ...base,
    ...override,
    patterns: {
      ...(base.patterns || {})
    }
  };

  for (const [patternId, entry] of Object.entries(override.patterns || {})) {
    const existing = next.patterns[patternId] || {};
    next.patterns[patternId] = {
      ...existing,
      ...entry,
      defaults: {
        ...(existing.defaults || {}),
        ...(entry?.defaults || {})
      },
      tokens: {
        ...(existing.tokens || {}),
        ...(entry?.tokens || {})
      },
      variants: {
        ...(existing.variants || {}),
        ...(entry?.variants || {})
      }
    };
  }

  return next;
}

export function createDsRegistryLoader({ source } = {}) {
  return {
    load() {
      return mergeRegistry(getDsRegistry(), source);
    }
  };
}

export function loadDsRegistry(source) {
  return createDsRegistryLoader({ source }).load();
}
