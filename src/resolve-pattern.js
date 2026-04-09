import { getPatternRegistryEntry } from "./ds-registry.js";

function mergePatternLayers(base = {}, override = {}) {
  return {
    ...base,
    ...override,
    defaults: {
      ...(base.defaults || {}),
      ...(override.defaults || {})
    },
    tokens: {
      ...(base.tokens || {}),
      ...(override.tokens || {})
    }
  };
}

export function resolvePattern(patternId, options = {}) {
  const base = getPatternRegistryEntry(patternId);
  if (!base) {
    return null;
  }

  const requestedVariant =
    typeof options.variant === "string" && options.variant.trim()
      ? options.variant.trim().toLowerCase()
      : typeof options.tone === "string" && options.tone.trim()
        ? options.tone.trim().toLowerCase()
        : typeof options.density === "string" && options.density.trim()
          ? options.density.trim().toLowerCase()
          : null;

  if (!requestedVariant || !base.variants || !base.variants[requestedVariant]) {
    return mergePatternLayers(base, {});
  }

  return mergePatternLayers(base, base.variants[requestedVariant]);
}
