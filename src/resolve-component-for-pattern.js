import { getIntentRegistryEntry, getPatternRegistryEntry } from "./ds-registry.js";
import { resolvePattern } from "./resolve-pattern.js";

export function resolveComponentForPattern(input = {}) {
  const intentId =
    typeof input.intent === "string" && input.intent.trim()
      ? input.intent.trim()
      : null;
  const explicitPatternId =
    typeof input.pattern === "string" && input.pattern.trim()
      ? input.pattern.trim()
      : null;

  const intentEntry = intentId ? getIntentRegistryEntry(intentId) : null;
  const patternId = explicitPatternId || intentEntry?.pattern || null;

  if (!patternId) {
    return null;
  }

  const registryEntry = getPatternRegistryEntry(patternId);
  if (!registryEntry) {
    return null;
  }

  const resolvedPattern = resolvePattern(patternId, {
    variant: input.variant,
    tone: input.tone,
    density: input.density
  });

  return {
    intent: intentId,
    pattern: patternId,
    helper: registryEntry.helper,
    registryEntry,
    resolvedPattern
  };
}
