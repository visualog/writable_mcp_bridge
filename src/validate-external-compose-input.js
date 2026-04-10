import {
  normalizeExternalComposeInput
} from "./external-analyzer-contract.js";
import { deriveIntentSectionsFromReferenceAnalysis } from "./reference-analysis-to-intents.js";

function normalizeString(value) {
  const normalized = String(value || "").trim();
  return normalized || "";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pushDroppedWarning(warnings, label, rawValue, normalizedValue) {
  const rawCount = normalizeArray(rawValue).length;
  const normalizedCount = normalizeArray(normalizedValue).length;
  const droppedCount = Math.max(0, rawCount - normalizedCount);
  if (droppedCount > 0) {
    warnings.push({
      code: "dropped_entries",
      path: label,
      message: `${label}에서 ${droppedCount}개 항목이 계약에 맞지 않아 무시되었습니다.`,
      droppedCount
    });
  }
}

function resolveIntentSections(normalizedInput) {
  const explicitSections = normalizeArray(normalizedInput.sections);
  if (explicitSections.length > 0) {
    return {
      source: "sections",
      sections: explicitSections
    };
  }

  const explicitIntentSections = normalizeArray(normalizedInput.intentSections);
  if (explicitIntentSections.length > 0) {
    return {
      source: "intentSections",
      sections: explicitIntentSections
    };
  }

  const nestedIntentSections = normalizeArray(normalizedInput.referenceAnalysis?.intentSections);
  if (nestedIntentSections.length > 0) {
    return {
      source: "referenceAnalysis.intentSections",
      sections: nestedIntentSections
    };
  }

  return {
    source: "referenceAnalysis.sections",
    sections: deriveIntentSectionsFromReferenceAnalysis(normalizedInput.referenceAnalysis)
  };
}

function buildValidationReport(errors, warnings, resolved) {
  const errorCount = normalizeArray(errors).length;
  const warningCount = normalizeArray(warnings).length;
  return {
    status: errorCount > 0 ? "fail" : warningCount > 0 ? "warn" : "pass",
    canCompose: errorCount === 0,
    errorCount,
    warningCount,
    resolvedSource: resolved?.source || "unknown",
    resolvedSectionCount: normalizeArray(resolved?.sections).length
  };
}

export function validateExternalComposeInput(input = {}) {
  const normalizedInput = normalizeExternalComposeInput(input);
  const errors = [];
  const warnings = [];

  if (!normalizeString(normalizedInput.parentId)) {
    errors.push({
      code: "missing_parent_id",
      path: "parentId",
      message: "compose 실행에는 parentId가 필요합니다."
    });
  }

  pushDroppedWarning(warnings, "sections", input.sections, normalizedInput.sections);
  pushDroppedWarning(
    warnings,
    "intentSections",
    input.intentSections,
    normalizedInput.intentSections
  );
  pushDroppedWarning(
    warnings,
    "referenceAnalysis.sections",
    input.referenceAnalysis?.sections,
    normalizedInput.referenceAnalysis?.sections
  );
  pushDroppedWarning(
    warnings,
    "referenceAnalysis.intentSections",
    input.referenceAnalysis?.intentSections,
    normalizedInput.referenceAnalysis?.intentSections
  );

  const resolved = resolveIntentSections(normalizedInput);
  if (normalizeArray(resolved.sections).length === 0) {
    errors.push({
      code: "missing_intent_sections",
      path: "sections",
      message:
        "유효한 intent section이 없습니다. sections, intentSections, referenceAnalysis.intentSections 또는 referenceAnalysis.sections 중 하나를 제공해야 합니다."
    });
  }

  if (!normalizeString(normalizedInput.name)) {
    warnings.push({
      code: "missing_name",
      path: "name",
      message: "name이 비어 있어 기본 compose 이름이 사용됩니다."
    });
  }

  if (!normalizedInput.referenceAnalysis) {
    warnings.push({
      code: "missing_reference_analysis",
      path: "referenceAnalysis",
      message: "referenceAnalysis가 없어 외부 분석 컨텍스트 없이 compose합니다."
    });
  }

  const report = buildValidationReport(errors, warnings, resolved);

  return {
    ok: errors.length === 0,
    canCompose: errors.length === 0,
    errors,
    warnings,
    report,
    normalizedInput,
    resolved: {
      source: resolved.source,
      sectionCount: normalizeArray(resolved.sections).length,
      sections: resolved.sections
    }
  };
}
