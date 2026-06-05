import { composeBuddyStyleAuditReport } from "./buddy-report-composer.js";

const EXPECTED_SCALE_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function normalizeString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGroupName(value = "") {
  return normalizeString(value).replace(/\s+/g, " ").toLowerCase();
}

function parseHexColor(raw = "") {
  const text = normalizeString(raw);
  const match = text.match(/#([0-9a-f]{6})/iu);
  if (!match) {
    return null;
  }
  const hex = match[1];
  return {
    hex: `#${hex.toUpperCase()}`,
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16)
  };
}

function colorDistance(a, b) {
  if (!a || !b) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.sqrt(
    (a.red - b.red) ** 2 +
      (a.green - b.green) ** 2 +
      (a.blue - b.blue) ** 2
  );
}

function findPrimitiveCollection(collections = []) {
  return (
    normalizeArray(collections).find((collection) =>
      /(^|[\s._-])primitive|프리미티브/iu.test(normalizeString(collection?.name))
    ) || null
  );
}

function getScaleMissingSteps(group = {}) {
  const steps = normalizeArray(group.steps)
    .map((step) => Number(step))
    .filter((step) => Number.isFinite(step));
  if (steps.length < 3) {
    return [];
  }
  return EXPECTED_SCALE_STEPS.filter((step) => !steps.includes(step));
}

function findScaleIssues(tokenSnapshot = {}) {
  return normalizeArray(tokenSnapshot.colorScaleGroups)
    .map((group) => {
      const subject = normalizeString(group.group);
      const missing = getScaleMissingSteps(group);
      if (!subject || missing.length === 0) {
        return null;
      }
      return {
        type: "missing_scale_steps",
        severity: missing.length >= 5 ? "medium" : "low",
        subject,
        detail: `${subject}는 ${missing.join(", ")} 단계가 없습니다.`,
        evidence: {
          steps: normalizeArray(group.steps),
          missing
        }
      };
    })
    .filter(Boolean);
}

function findAlphaNamingIssues(tokenSnapshot = {}) {
  const issues = [];
  for (const variable of normalizeArray(tokenSnapshot.sampleVariables)) {
    const name = normalizeString(variable?.name);
    if (!/dark\/black alpha/iu.test(name)) {
      continue;
    }
    const values = Object.values(variable?.modes || {});
    if (values.some((value) => /#fff|255,\s*255,\s*255/iu.test(String(value)))) {
      issues.push({
        type: "alpha_naming_mismatch",
        severity: "high",
        subject: "dark/Black alpha",
        detail: "Dark 모드의 Black alpha가 실제로는 white alpha 역할을 할 수 있습니다.",
        evidence: { name, values }
      });
      break;
    }
  }
  return issues;
}

function findSimilarFamilyIssues(tokenSnapshot = {}) {
  const samplesByName = new Map();
  for (const variable of normalizeArray(tokenSnapshot.sampleVariables)) {
    samplesByName.set(normalizeGroupName(variable?.name), variable);
  }
  const blue = samplesByName.get("light/blue/60");
  const lightBlue = samplesByName.get("light/lightblue/60") || samplesByName.get("light/light blue/60");
  const blueColor = parseHexColor(Object.values(blue?.modes || {})[0]);
  const lightBlueColor = parseHexColor(Object.values(lightBlue?.modes || {})[0]);
  const distance = colorDistance(blueColor, lightBlueColor);

  if (!Number.isFinite(distance) || distance > 18) {
    return [];
  }

  return [
    {
      type: "similar_color_family",
      severity: "high",
      subject: "Blue vs LightBlue",
      detail: `Blue와 LightBlue의 60 단계 색상 거리가 ${Math.round(distance)}로 가까워 역할 혼동 가능성이 있습니다.`,
      evidence: {
        blue: blueColor?.hex,
        lightBlue: lightBlueColor?.hex,
        distance: Math.round(distance)
      }
    }
  ];
}

function issuePriority(issue = {}) {
  const order = { high: 0, medium: 1, low: 2 };
  return order[issue.severity] ?? 3;
}

export function auditPrimitiveColorTokens(tokenSnapshot = {}) {
  const primitiveCollection = findPrimitiveCollection(tokenSnapshot.collections);
  const issues = [
    ...findScaleIssues(tokenSnapshot),
    ...findAlphaNamingIssues(tokenSnapshot),
    ...findSimilarFamilyIssues(tokenSnapshot)
  ].sort((a, b) => issuePriority(a) - issuePriority(b));

  const strengths = [];
  if (primitiveCollection) {
    strengths.push(
      `${primitiveCollection.name} 컬렉션에 ${primitiveCollection.variableCount || 0}개 변수가 구성되어 있습니다.`
    );
  }
  if (tokenSnapshot.collectionCount || tokenSnapshot.variableCount) {
    strengths.push(
      `전체 토큰 스냅샷에서 ${tokenSnapshot.collectionCount || 0}개 컬렉션, ${tokenSnapshot.variableCount || 0}개 변수를 확인했습니다.`
    );
  }
  if (tokenSnapshot.tokenBucketCounts?.colors) {
    strengths.push(`색상 bucket ${tokenSnapshot.tokenBucketCounts.colors}개를 기준으로 팔레트를 검수할 수 있습니다.`);
  }

  const priorities = issues.slice(0, 5).map((issue) => ({
    severity: issue.severity,
    subject: issue.subject,
    title:
      issue.type === "alpha_naming_mismatch"
        ? "Alpha 토큰 명칭과 실제 역할 확인"
        : issue.type === "similar_color_family"
          ? "유사 색상군 역할 분리"
          : "컬러 스케일 누락 검토",
    reason: issue.detail
  }));

  const recommendations = [
    "누락 단계가 의도적 생략인지, 실제 누락인지 디자인시스템 문서에 명시하세요.",
    "semantic/theme 토큰이 primitive 값을 일관된 방향으로 참조하는지 확인하세요.",
    "유사 색상군은 사용처와 역할을 분리하거나 색상 차이를 키우세요."
  ];

  return {
    evidence: {
      collectionCount: tokenSnapshot.collectionCount || 0,
      variableCount: tokenSnapshot.variableCount || 0,
      styleCount: tokenSnapshot.styleCount || 0,
      primitiveCollection: primitiveCollection || null,
      tokenBucketCounts: tokenSnapshot.tokenBucketCounts || {}
    },
    strengths,
    issues,
    priorities,
    recommendations
  };
}

export function buildBuddyStylePrimitiveColorReport(tokenSnapshot = {}) {
  const audit = auditPrimitiveColorTokens(tokenSnapshot);
  const primitive = audit.evidence.primitiveCollection;

  return composeBuddyStyleAuditReport({
    title: "프리미티브 컬러 팔레트 분석 결과",
    completionClaim: "토큰 스냅샷과 컬러 스케일 그룹을 기준으로 QA 검수를 진행했습니다.",
    evidence: [
      `컬렉션 ${audit.evidence.collectionCount}개, 변수 ${audit.evidence.variableCount}개, 스타일 ${audit.evidence.styleCount}개`,
      primitive ? `${primitive.name} 기준 ${primitive.variableCount || 0}개 프리미티브 변수` : "",
      audit.evidence.tokenBucketCounts?.colors ? `컬러 bucket ${audit.evidence.tokenBucketCounts.colors}개` : ""
    ].filter(Boolean),
    strengths: [
      ...audit.strengths,
      primitive ? `${primitive.name} 기준으로 ${primitive.variableCount || 0}개 프리미티브 변수를 확인했습니다.` : ""
    ].filter(Boolean),
    issues: audit.issues.slice(0, 8),
    priorities: audit.priorities,
    recommendations: audit.recommendations
  });
}
