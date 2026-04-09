import { deriveIntentSectionsFromReferenceAnalysis } from "./reference-analysis-to-intents.js";

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

function buildSidebarSections(name = "Navigation") {
  return [{ type: "navigation", name: "sidebar", headerTitle: name }];
}

function buildHeaderSections(name = "Header") {
  return [{ type: "header", name: "topbar", headerTitle: name }];
}

function buildTableSections(name = "Table") {
  return [
    {
      type: "table",
      name: "table",
      contentTitle: name,
      contentBody: "Reference-derived table content"
    }
  ];
}

function buildActionSections(label = "Continue") {
  return [
    {
      type: "actions",
      name: "footer-actions",
      primaryActionQuery: "v2_test/button",
      primaryActionLabel: label
    }
  ];
}

function inferNamedFragmentDraft({ lowerName, name }) {
  if (
    lowerName.includes("sidebar") ||
    lowerName.includes("nav") ||
    lowerName.includes("menu")
  ) {
    return {
      heuristic: "sidebar-fragment",
      confidence: "high",
      backgroundColor: "#F7F8FA",
      sections: buildSidebarSections(name || "Navigation"),
      rationale: [
        "선택 이름에 sidebar/nav/menu 키워드가 있어 내비게이션 조각으로 분류했습니다.",
        "페이지 전체가 아니라 sidebar helper로 바로 이어질 수 있게 navigation section만 구성했습니다."
      ]
    };
  }

  if (
    lowerName.includes("topbar") ||
    lowerName.includes("toolbar") ||
    lowerName === "header" ||
    lowerName.endsWith("-header") ||
    lowerName.startsWith("header-")
  ) {
    return {
      heuristic: "header-fragment",
      confidence: "high",
      backgroundColor: "#FFFFFF",
      sections: buildHeaderSections(name || "Header"),
      rationale: [
        "선택 이름에 topbar/toolbar/header 키워드가 있어 상단 헤더 조각으로 분류했습니다.",
        "toolbar helper로 직접 넘기기 쉬운 단일 header section을 만들었습니다."
      ]
    };
  }

  if (
    lowerName.includes("table") ||
    lowerName.includes("grid") ||
    lowerName.includes("list")
  ) {
    return {
      heuristic: "table-fragment",
      confidence: "medium",
      backgroundColor: "#FFFFFF",
      sections: buildTableSections(name || "Table"),
      rationale: [
        "선택 이름에 table/grid/list/board 키워드가 있어 데이터 영역 조각으로 분류했습니다.",
        "표 또는 리스트 helper로 바로 이어질 수 있는 단일 data section을 구성했습니다."
      ]
    };
  }

  if (
    lowerName.includes("action") ||
    lowerName.includes("footer") ||
    lowerName.includes("button") ||
    lowerName.includes("cta")
  ) {
    return {
      heuristic: "actions-fragment",
      confidence: "medium",
      backgroundColor: "#FFFFFF",
      sections: buildActionSections("Continue"),
      rationale: [
        "선택 이름에 action/footer/button/cta 키워드가 있어 액션 조각으로 분류했습니다.",
        "버튼/푸터 영역 helper로 이어질 수 있게 actions section만 구성했습니다."
      ]
    };
  }

  return null;
}

function inferShapeFragmentDraft({ name, width, height }) {
  if (width > 0 && width <= 280 && height >= width * 1.6) {
    return {
      heuristic: "narrow-rail-fragment",
      confidence: "low",
      backgroundColor: "#F7F8FA",
      sections: buildSidebarSections(name || "Rail"),
      rationale: [
        "폭이 좁고 세로로 긴 비율이라 사이드 레일 조각 가능성을 우선 가정했습니다.",
        "이 비율은 모바일 화면보다 내비게이션/레일 프래그먼트일 때가 많아 navigation section을 기본값으로 사용했습니다."
      ]
    };
  }

  return null;
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
  let confidence = "low";
  let backgroundColor = "#FFFFFF";
  let sections = buildMobileSections();
  let rationale = [
    "세로형 또는 모바일 비율로 판단해 상세 화면 패턴 초안으로 분류했습니다.",
    "헤더, 콘텐츠, 액션 영역을 기본 구조로 사용했습니다."
  ];

  const namedFragmentDraft = inferNamedFragmentDraft({ lowerName, name });
  if (namedFragmentDraft) {
    heuristic = namedFragmentDraft.heuristic;
    confidence = namedFragmentDraft.confidence;
    backgroundColor = namedFragmentDraft.backgroundColor;
    sections = namedFragmentDraft.sections;
    rationale = namedFragmentDraft.rationale;
  } else if (
    lowerName.includes("dashboard") ||
    lowerName.includes("clone") ||
    (width >= 1000 && height >= 700) ||
    aspectRatio >= 1.2
  ) {
    heuristic = "dashboard-landscape";
    confidence = "medium";
    backgroundColor = "#F7F8FA";
    sections = buildDashboardSections();
    rationale = [
      "가로형 레이아웃과 큰 캔버스 비율을 기준으로 대시보드 패턴으로 분류했습니다.",
      "내비게이션, 상단 헤더, KPI 카드, 타임라인, 테이블, 액션 영역으로 나눴습니다."
    ];
  } else {
    const fragmentDraft = inferShapeFragmentDraft({ name, width, height });
    if (fragmentDraft) {
      heuristic = fragmentDraft.heuristic;
      confidence = fragmentDraft.confidence;
      backgroundColor = fragmentDraft.backgroundColor;
      sections = fragmentDraft.sections;
      rationale = fragmentDraft.rationale;
    } else if ((width > 0 && width <= 500) || (aspectRatio > 0 && aspectRatio < 0.8)) {
      heuristic = "mobile-detail";
      confidence = "medium";
      backgroundColor = "#FFFFFF";
      sections = buildMobileSections();
      rationale = [
        "세로형 또는 모바일 비율로 판단해 상세 화면 패턴 초안으로 분류했습니다.",
        "헤더, 콘텐츠, 액션 영역을 기본 구조로 사용했습니다."
      ];
    }
  }

  const referenceAnalysis = {
    width: width || undefined,
    height: height || undefined,
    backgroundColor,
    sections
  };
  const intentSections = deriveIntentSectionsFromReferenceAnalysis(referenceAnalysis);

  return {
    heuristic,
    confidence,
    selection: {
      targetNodeId: root?.id,
      name,
      type: root?.type,
      width: width || undefined,
      height: height || undefined,
      fileName: metadataResult.fileName,
      pageName: metadataResult.pageName
    },
    referenceAnalysis,
    intentSections,
    rationale
  };
}
