function extractRootNodeFromXml(xml) {
  const source = String(xml || "");
  const match = source.match(
    /<(frame|instance|component|componentSet|section|group|rectangle|text)\s+([^>]+)>/i
  );

  if (!match) {
    return null;
  }

  const type = String(match[1] || "").toUpperCase();
  const attrs = String(match[2] || "");
  const readAttr = (name) => {
    const attrMatch = attrs.match(new RegExp(`${name}="([^"]*)"`, "i"));
    return attrMatch ? attrMatch[1] : undefined;
  };

  const width = Number(readAttr("width"));
  const height = Number(readAttr("height"));
  return {
    type,
    id: readAttr("id"),
    name: readAttr("name"),
    width: Number.isFinite(width) ? width : undefined,
    height: Number.isFinite(height) ? height : undefined
  };
}

function buildDashboardSections() {
  return [
    { type: "navigation", name: "sidebar", headerTitle: "Trackline" },
    { type: "header", name: "topbar", headerTitle: "Dashboard" },
    {
      type: "summary-cards",
      name: "overall-tasks",
      contentTitle: "Overall Tasks",
      contentBody: "Spread across 6 projects."
    },
    {
      type: "summary-cards",
      name: "project-track",
      contentTitle: "Project Track",
      contentBody: "Project performance status"
    },
    {
      type: "summary-cards",
      name: "project-progress",
      contentTitle: "Project Progress",
      contentBody: "Overall completion rate all projects."
    },
    {
      type: "timeline",
      name: "project-timeline",
      contentTitle: "Project Timeline",
      contentBody: "Visualize your project schedule and milestones."
    },
    {
      type: "table",
      name: "project-list",
      contentTitle: "Project List",
      contentBody: "See all your projects in one place."
    },
    {
      type: "actions",
      name: "footer-actions",
      primaryActionQuery: "v2_test/button",
      primaryActionLabel: "New Task"
    }
  ];
}

function buildMobileSections() {
  return [
    { type: "header", name: "header", headerTitle: "Detail" },
    {
      type: "content",
      name: "content",
      contentTitle: "Overview",
      contentBody: "Reference-derived mobile content"
    },
    {
      type: "actions",
      name: "footer-actions",
      primaryActionQuery: "v2_test/button",
      primaryActionLabel: "Continue"
    }
  ];
}

export function buildAnalyzeReferenceSelectionPlan(input = {}) {
  const targetNodeId = String(input.targetNodeId || "").trim();
  const includeExport = input.includeExport !== false;
  const includeSvg = Boolean(input.includeSvg);

  return {
    targetNodeId: targetNodeId || undefined,
    includeExport,
    includeSvg
  };
}

export function deriveReferenceAnalysisDraft(metadataResult = {}, options = {}) {
  const root =
    extractRootNodeFromXml(metadataResult.xml) ||
    (Array.isArray(metadataResult.roots) && metadataResult.roots.length > 0
      ? metadataResult.roots[0]
      : null);

  const width = Number(root?.width) || 0;
  const height = Number(root?.height) || 0;
  const name = String(root?.name || "").trim();
  const lowerName = name.toLowerCase();
  const aspectRatio = width > 0 && height > 0 ? width / height : 0;

  let heuristic = "generic";
  let backgroundColor = "#FFFFFF";
  let sections = buildMobileSections();

  if (
    lowerName.includes("dashboard") ||
    lowerName.includes("clone") ||
    (width >= 1000 && height >= 700) ||
    aspectRatio >= 1.2
  ) {
    heuristic = "dashboard-landscape";
    backgroundColor = "#F7F8FA";
    sections = buildDashboardSections();
  } else if ((width > 0 && width <= 500) || aspectRatio > 0 && aspectRatio < 0.8) {
    heuristic = "mobile-detail";
    backgroundColor = "#FFFFFF";
    sections = buildMobileSections();
  }

  return {
    heuristic,
    confidence:
      heuristic === "dashboard-landscape" || heuristic === "mobile-detail"
        ? "medium"
        : "low",
    selection: {
      targetNodeId: root?.id,
      name,
      type: root?.type,
      width: width || undefined,
      height: height || undefined,
      fileName: metadataResult.fileName,
      pageName: metadataResult.pageName
    },
    referenceAnalysis: {
      width: width || undefined,
      height: height || undefined,
      backgroundColor,
      sections
    },
    rationale:
      heuristic === "dashboard-landscape"
        ? [
            "가로형 레이아웃과 큰 캔버스 비율을 기준으로 대시보드 패턴으로 분류했습니다.",
            "내비게이션, 상단 헤더, KPI 카드, 타임라인, 테이블, 액션 영역으로 나눴습니다."
          ]
        : [
            "세로형 또는 모바일 비율로 판단해 상세 화면 패턴 초안으로 분류했습니다.",
            "헤더, 콘텐츠, 액션 영역을 기본 구조로 사용했습니다."
          ]
  };
}
