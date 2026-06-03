function normalizeString(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function severityLabel(value = "") {
  const normalized = normalizeString(value).toLowerCase();
  if (normalized === "high") return "높음";
  if (normalized === "medium") return "중간";
  if (normalized === "low") return "낮음";
  return normalizeString(value) || "확인";
}

function priorityLine(item = {}) {
  const severity = normalizeString(item.severity || item.priority || "medium").toLowerCase();
  const title = normalizeString(item.title || item.subject || "검토 필요");
  const subject = normalizeString(item.subject);
  return `- ${severity}: ${title}${subject ? ` (${subject})` : ""}`;
}

function issueLine(issue = {}, index = 0) {
  const subject = normalizeString(issue.subject || issue.title || `이슈 ${index + 1}`);
  const detail = normalizeString(issue.detail || issue.reason || issue.description);
  return `${index + 1}. [${severityLabel(issue.severity)}] ${subject}${detail ? `: ${detail}` : ""}`;
}

export function composeBuddyStyleAuditReport({
  title = "분석 결과",
  completionClaim = "",
  evidence = [],
  strengths = [],
  issues = [],
  priorities = [],
  recommendations = [],
  limits = []
} = {}) {
  const evidenceLines = normalizeArray(evidence).map((item) => normalizeString(item)).filter(Boolean);
  const strengthLines = normalizeArray(strengths).map((item) => normalizeString(item)).filter(Boolean);
  const issueLines = normalizeArray(issues).map(issueLine);
  const priorityLines = normalizeArray(priorities).map(priorityLine);
  const recommendationLines = normalizeArray(recommendations).map((item) => normalizeString(item)).filter(Boolean);
  const limitLines = normalizeArray(limits).map((item) => normalizeString(item)).filter(Boolean);

  return [
    normalizeString(title) || "분석 결과",
    normalizeString(completionClaim),
    "",
    "근거",
    ...(evidenceLines.length ? evidenceLines.map((item) => `- ${item}`) : ["- 현재 읽기 결과에서 확인 가능한 근거가 제한적입니다."]),
    "",
    "잘 구성된 부분",
    ...(strengthLines.length ? strengthLines.map((item) => `- ${item}`) : ["- 확인 가능한 장점은 추가 근거 수집 후 확정할 수 있습니다."]),
    "",
    "개선이 필요한 부분",
    ...(issueLines.length ? issueLines : ["- 현재 스냅샷 기준 주요 QA 이슈는 확인되지 않았습니다."]),
    "",
    "요약 우선순위",
    ...(priorityLines.length ? priorityLines : ["- low: 추가 개선 우선순위 없음"]),
    "",
    "다음 액션",
    ...(recommendationLines.length ? recommendationLines.map((item) => `- ${item}`) : ["- 더 좁은 대상 또는 추가 근거를 읽은 뒤 재검토하세요."]),
    "",
    ...(limitLines.length ? ["판단 제한", ...limitLines.map((item) => `- ${item}`), ""] : []),
    "응답 원칙: 확인 가능한 근거를 먼저 제시하고, 부족한 데이터는 마지막에 분리합니다."
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export const BUDDY_PROGRESS_STATES = Object.freeze({
  reading: {
    label: "읽는 중",
    userMessage: "선택 대상과 관련 Figma 데이터를 읽고 있어요.",
    actionLabel: "Read Figma frame"
  },
  analyzing: {
    label: "분석 중",
    userMessage: "읽은 데이터를 QA 규칙과 비교하고 있어요.",
    actionLabel: "Analyze evidence"
  },
  validating: {
    label: "검증 중",
    userMessage: "결과가 근거와 맞는지 확인하고 있어요.",
    actionLabel: "Validate result"
  },
  completed: {
    label: "완료",
    userMessage: "확인 가능한 근거를 기준으로 분석을 완료했습니다.",
    actionLabel: "Complete report"
  },
  partial: {
    label: "부분 완료",
    userMessage: "일부 데이터는 부족하지만, 확인 가능한 근거로 먼저 진단했습니다.",
    actionLabel: "Report partial evidence"
  },
  failed: {
    label: "실패",
    userMessage: "읽기 또는 검증 단계가 실패해 다음 조치가 필요합니다.",
    actionLabel: "Explain failure"
  }
});

export function buildBuddyProgressTimeline(states = []) {
  return normalizeArray(states)
    .map((state) => {
      const key = normalizeString(state).toLowerCase();
      const contract = BUDDY_PROGRESS_STATES[key];
      if (!contract) {
        return null;
      }
      return {
        state: key,
        ...contract
      };
    })
    .filter(Boolean);
}
