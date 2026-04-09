import { composeSectionsFromIntents } from "./compose-sections-from-intents.js";
import { deriveIntentSectionsFromReferenceAnalysis } from "./reference-analysis-to-intents.js";
import { normalizeExternalComposeInput } from "./external-analyzer-contract.js";

function clampNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, value));
}

function normalizeName(value, fallback) {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeSections(value) {
  return Array.isArray(value) ? value : [];
}

function resolveIntentSections(input = {}) {
  const explicitSections = normalizeSections(input.sections);
  if (explicitSections.length > 0) {
    return explicitSections;
  }

  const explicitIntentSections = normalizeSections(input.intentSections);
  if (explicitIntentSections.length > 0) {
    return explicitIntentSections;
  }

  const referenceIntentSections = normalizeSections(input.referenceAnalysis?.intentSections);
  if (referenceIntentSections.length > 0) {
    return referenceIntentSections;
  }

  return deriveIntentSectionsFromReferenceAnalysis(input.referenceAnalysis);
}

export function buildComposeScreenFromIntentsPlan(input = {}) {
  const normalizedInput = normalizeExternalComposeInput(input);
  const parentId = String(normalizedInput.parentId || "").trim();
  if (!parentId) {
    throw new Error("parentId is required");
  }

  const derivedSections = resolveIntentSections(normalizedInput);
  if (derivedSections.length === 0) {
    throw new Error("sections must include at least one intent entry");
  }

  const width = clampNumber(normalizedInput.width, 1440, 320, 2560);
  const height = clampNumber(normalizedInput.height, 960, 240, 4000);
  const backgroundColor =
    typeof normalizedInput.backgroundColor === "string" && normalizedInput.backgroundColor.trim()
      ? normalizedInput.backgroundColor.trim()
      : "#FFFFFF";

  const composed = composeSectionsFromIntents({
    name: normalizeName(normalizedInput.name, "intent-composed-screen"),
    width,
    height,
    backgroundColor,
    sections: derivedSections
  });

  return {
    parentId,
    name: normalizeName(normalizedInput.name, composed.name),
    width,
    height,
    x:
      typeof normalizedInput.x === "number" && Number.isFinite(normalizedInput.x)
        ? normalizedInput.x
        : undefined,
    y:
      typeof normalizedInput.y === "number" && Number.isFinite(normalizedInput.y)
        ? normalizedInput.y
        : undefined,
    backgroundColor,
    sections: derivedSections,
    referenceAnalysis: normalizedInput.referenceAnalysis,
    composition: composed.composition,
    tree: composed.root
  };
}
