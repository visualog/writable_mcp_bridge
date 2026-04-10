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
  "actionGroups",
  "tableColumns",
  "tableRowPattern",
  "children"
];

const DENSITY_VALUES = new Set(["comfortable", "compact", "dense"]);
const COLUMN_ALIGN_VALUES = new Set(["min", "center", "max"]);
const ROW_PATTERN_VALUES = new Set([
  "text",
  "media-row",
  "status-chip",
  "progress-bar",
  "avatar-stack",
  "action-menu",
  "action-box"
]);

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

function normalizeDensity(value) {
  const normalized = normalizeString(value);
  if (!normalized) {
    return undefined;
  }
  const alias =
    normalized === "roomy" || normalized === "cozy" ? "comfortable" : normalized;
  return DENSITY_VALUES.has(alias) ? alias : undefined;
}

function normalizeTableColumn(column = {}, index = 0) {
  if (typeof column === "string") {
    const label = normalizeString(column);
    if (!label) {
      return null;
    }
    return {
      key: `col-${index + 1}`,
      label
    };
  }

  if (!column || typeof column !== "object") {
    return null;
  }

  const key =
    normalizeString(column.key) ||
    normalizeString(column.name) ||
    `col-${index + 1}`;
  const label =
    normalizeString(column.label) ||
    normalizeString(column.name) ||
    normalizeString(column.key) ||
    `Column ${index + 1}`;

  const normalized = { key, label };

  const width = normalizeNumber(column.width);
  if (width && width > 0) {
    normalized.width = width;
  }

  const align = normalizeString(column.align);
  if (align && COLUMN_ALIGN_VALUES.has(align)) {
    normalized.align = align;
  }

  const pattern = normalizeString(column.pattern);
  if (pattern) {
    normalized.pattern = pattern;
  }

  return normalized;
}

function normalizeTableRowPatternEntry(entry = {}) {
  if (typeof entry === "string") {
    const type = normalizeString(entry);
    if (!type || !ROW_PATTERN_VALUES.has(type)) {
      return null;
    }
    return { type };
  }

  if (!entry || typeof entry !== "object") {
    return null;
  }

  const type = normalizeString(entry.type);
  if (!type || !ROW_PATTERN_VALUES.has(type)) {
    return null;
  }

  const normalized = { type };
  for (const field of ["label", "tone", "title", "meta", "trailing"]) {
    const value = normalizeString(entry[field]);
    if (value) {
      normalized[field] = value;
    }
  }
  return normalized;
}

function normalizeAction(action = {}, index = 0) {
  const label =
    normalizeString(action.label) ||
    normalizeString(action.title) ||
    undefined;
  const intent = normalizeString(action.intent);
  if (!label && !intent) {
    return null;
  }

  const normalized = {
    key: normalizeString(action.key) || `action-${index + 1}`
  };
  if (label) {
    normalized.label = label;
  }
  if (intent) {
    normalized.intent = intent;
  }

  for (const field of ["tone", "variant"]) {
    const value = normalizeString(action[field]);
    if (value) {
      normalized[field] = value;
    }
  }

  return normalized;
}

function normalizeActionGroup(group = {}, index = 0) {
  if (!group || typeof group !== "object") {
    return null;
  }

  const key =
    normalizeString(group.key) ||
    normalizeString(group.name) ||
    `group-${index + 1}`;
  const label =
    normalizeString(group.label) ||
    normalizeString(group.title) ||
    normalizeString(group.name) ||
    key;
  const actions = normalizeArray(group.actions)
    .map((action, actionIndex) => normalizeAction(action, actionIndex))
    .filter(Boolean);

  if (actions.length === 0) {
    return null;
  }

  return {
    key,
    label,
    actions
  };
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

  const density = normalizeDensity(section.density);
  if (density) {
    normalized.density = density;
  }

  const contentDensity = normalizeDensity(section.contentDensity);
  if (contentDensity) {
    normalized.contentDensity = contentDensity;
  }

  const tableColumns = normalizeArray(section.tableColumns)
    .map((column, columnIndex) => normalizeTableColumn(column, columnIndex))
    .filter(Boolean);
  if (tableColumns.length > 0) {
    normalized.tableColumns = tableColumns;
  }

  const tableRowPattern = normalizeArray(section.tableRowPattern)
    .map((entry) => normalizeTableRowPatternEntry(entry))
    .filter(Boolean);
  if (tableRowPattern.length > 0) {
    normalized.tableRowPattern = tableRowPattern;
  }

  const actionGroups = normalizeArray(section.actionGroups)
    .map((group, groupIndex) => normalizeActionGroup(group, groupIndex))
    .filter(Boolean);
  if (actionGroups.length > 0) {
    normalized.actionGroups = actionGroups;
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

  for (const field of ["pattern", "variant", "tone", "name", "title", "domain"]) {
    const value = normalizeString(section[field]);
    if (value) {
      normalized[field] = value;
    } else {
      delete normalized[field];
    }
  }

  const density = normalizeDensity(section.density);
  if (density) {
    normalized.density = density;
  } else {
    delete normalized.density;
  }

  for (const field of [
    "leftItems",
    "rightItems",
    "columns",
    "rows",
    "sections",
    "users",
    "actionGroups",
    "tableColumns",
    "tableRowPattern",
    "children"
  ]) {
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
