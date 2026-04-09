export const REFERENCE_SECTION_TYPES = [
  "navigation",
  "header",
  "content",
  "actions",
  "summary-cards",
  "timeline",
  "list",
  "table",
  "form"
];

export const INTENT_SECTION_FIELDS = [
  "key",
  "intent",
  "pattern",
  "variant",
  "tone",
  "density",
  "name",
  "title",
  "domain",
  "leftItems",
  "rightItems",
  "columns",
  "rows",
  "sections",
  "users",
  "children"
];

function normalizeString(value) {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function normalizeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickAllowedFields(source = {}, allowedFields = []) {
  const output = {};
  for (const field of allowedFields) {
    if (field in source && source[field] !== undefined) {
      output[field] = source[field];
    }
  }
  return output;
}

export function normalizeReferenceAnalysisSection(section = {}, index = 0) {
  const type = normalizeString(section.type);
  if (!type) {
    return null;
  }

  const normalized = {
    type,
    name: normalizeString(section.name) || `${type}-${index + 1}`
  };

  const optionalStringFields = [
    "headerTitle",
    "contentTitle",
    "contentBody",
    "primaryActionQuery",
    "primaryActionLabel"
  ];

  for (const field of optionalStringFields) {
    const value = normalizeString(section[field]);
    if (value) {
      normalized[field] = value;
    }
  }

  return normalized;
}

export function normalizeIntentSection(section = {}, index = 0) {
  const intent = normalizeString(section.intent);
  if (!intent) {
    return null;
  }

  const normalized = pickAllowedFields(section, INTENT_SECTION_FIELDS);
  normalized.intent = intent;
  normalized.key = normalizeString(section.key) || normalizeString(section.name) || `section-${index + 1}`;

  for (const field of ["pattern", "variant", "tone", "density", "name", "title", "domain"]) {
    const value = normalizeString(section[field]);
    if (value) {
      normalized[field] = value;
    } else {
      delete normalized[field];
    }
  }

  for (const field of ["leftItems", "rightItems", "columns", "rows", "sections", "users", "children"]) {
    if (field in section) {
      normalized[field] = normalizeArray(section[field]);
    }
  }

  return normalized;
}

export function normalizeReferenceAnalysis(referenceAnalysis = {}) {
  if (!referenceAnalysis || typeof referenceAnalysis !== "object") {
    return undefined;
  }

  const sections = normalizeArray(referenceAnalysis.sections)
    .map((section, index) => normalizeReferenceAnalysisSection(section, index))
    .filter(Boolean);

  const intentSections = normalizeArray(referenceAnalysis.intentSections)
    .map((section, index) => normalizeIntentSection(section, index))
    .filter(Boolean);

  return {
    width: normalizeNumber(referenceAnalysis.width),
    height: normalizeNumber(referenceAnalysis.height),
    backgroundColor: normalizeString(referenceAnalysis.backgroundColor),
    sections,
    intentSections
  };
}

export function normalizeExternalComposeInput(input = {}) {
  const topLevelIntentSections = normalizeArray(input.intentSections)
    .map((section, index) => normalizeIntentSection(section, index))
    .filter(Boolean);

  const topLevelSections = normalizeArray(input.sections)
    .map((section, index) => normalizeIntentSection(section, index))
    .filter(Boolean);

  return {
    ...input,
    sections: topLevelSections,
    intentSections: topLevelIntentSections,
    referenceAnalysis: normalizeReferenceAnalysis(input.referenceAnalysis)
  };
}
