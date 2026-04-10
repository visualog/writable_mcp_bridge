import { deriveReferenceAnalysisDraft } from "./analyze-reference-selection.js";

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeString(value) {
  return String(value || "").trim();
}

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

export function evaluateFragmentGoldenSet(cases = []) {
  const normalizedCases = normalizeArray(cases)
    .filter((item) => item && typeof item === "object")
    .map((item, index) => ({
      id: normalizeString(item.id) || `case-${index + 1}`,
      expectedHeuristic: normalizeString(item.expectedHeuristic),
      expectedSectionTypes: normalizeArray(item.expectedSectionTypes).map((type) =>
        normalizeString(type)
      ),
      expectedIntentSections: normalizeArray(item.expectedIntentSections).map((intent) =>
        normalizeString(intent)
      ),
      metadata: item.metadata || {}
    }));

  const details = normalizedCases.map((testCase) => {
    const draft = deriveReferenceAnalysisDraft(testCase.metadata);
    const actualSectionTypes = normalizeArray(draft.referenceAnalysis?.sections).map((section) =>
      normalizeString(section?.type)
    );
    const actualIntentSections = normalizeArray(draft.intentSections).map((section) =>
      normalizeString(section?.intent)
    );

    const heuristicMatch =
      !testCase.expectedHeuristic || testCase.expectedHeuristic === draft.heuristic;
    const sectionTypesMatch =
      testCase.expectedSectionTypes.length === 0 ||
      arraysEqual(testCase.expectedSectionTypes, actualSectionTypes);
    const intentSectionsMatch =
      testCase.expectedIntentSections.length === 0 ||
      arraysEqual(testCase.expectedIntentSections, actualIntentSections);

    return {
      id: testCase.id,
      heuristic: {
        expected: testCase.expectedHeuristic || null,
        actual: draft.heuristic || null,
        match: heuristicMatch
      },
      sectionTypes: {
        expected: testCase.expectedSectionTypes,
        actual: actualSectionTypes,
        match: sectionTypesMatch
      },
      intentSections: {
        expected: testCase.expectedIntentSections,
        actual: actualIntentSections,
        match: intentSectionsMatch
      },
      confidence: draft.confidence || null,
      pass: heuristicMatch && sectionTypesMatch && intentSectionsMatch
    };
  });

  const caseCount = details.length;
  const heuristicPassCount = details.filter((item) => item.heuristic.match).length;
  const sectionTypesPassCount = details.filter((item) => item.sectionTypes.match).length;
  const intentPassCount = details.filter((item) => item.intentSections.match).length;
  const fullPassCount = details.filter((item) => item.pass).length;

  const ratio = (value) => (caseCount > 0 ? Number((value / caseCount).toFixed(4)) : 0);

  return {
    summary: {
      caseCount,
      fullPassCount,
      heuristicPassCount,
      sectionTypesPassCount,
      intentPassCount,
      fullPassRatio: ratio(fullPassCount),
      heuristicPassRatio: ratio(heuristicPassCount),
      sectionTypesPassRatio: ratio(sectionTypesPassCount),
      intentPassRatio: ratio(intentPassCount)
    },
    details
  };
}
