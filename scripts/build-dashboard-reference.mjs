const BASE_URL = "http://localhost:3846";
const pluginId = "page:33023:62";

const TOKENS = {
  textPrimaryVarId: "VariableID:2719:1965",
  textSecondaryVarId: "VariableID:2806:4541",
  headingH2StyleId: "S:24729b32a69f1018fc6406b42c4d5d08436312b8,",
  body2RegularStyleId: "S:77410344484558f69e3e72712d70a0ea79587abb,",
  body2MediumStyleId: "S:a4f67e1d669d5123f7e9cd3cfccfed0b5edfceb4,"
};

async function post(path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pluginId, ...body })
  });

  const json = await response.json();
  if (!json.ok) {
    throw new Error(json.error || `Request failed: ${path}`);
  }
  return json.result;
}

async function createFrame(parentId, name, width, height, fillColor, x, y) {
  const result = await post("/api/create-node", {
    parentId,
    nodeType: "FRAME",
    name,
    width,
    height,
    fillColor,
    x,
    y
  });
  return result.created.id;
}

async function updateNode(nodeId, payload) {
  await post("/api/update-node", { nodeId, ...payload });
}

async function applyTextStyle(nodeId, styleId, variableId) {
  if (styleId) {
    await post("/api/apply-style", {
      nodeId,
      styleType: "text",
      styleId
    });
  }
  if (variableId) {
    try {
      await post("/api/bind-variable", {
        nodeId,
        property: "fills.color",
        variableId
      });
    } catch (error) {
      console.warn(`Skipping text color variable bind for ${nodeId}: ${error.message}`);
    }
  }
}

async function createText(parentId, name, characters, options = {}) {
  const result = await post("/api/create-node", {
    parentId,
    nodeType: "TEXT",
    name,
    characters,
    fontFamily: "SF Compact Text",
    fontStyle: options.fontStyle || "Regular",
    fontSize: options.fontSize || 16,
    width: options.width || 240,
    height: options.height || 24
  });

  const nodeId = result.created.id;
  await applyTextStyle(nodeId, options.styleId, options.variableId);
  return nodeId;
}

async function createCard(parentId, title, subtitle, width, height) {
  const cardId = await createFrame(parentId, title, width, height, "#FFFFFF");
  await updateNode(cardId, {
    layoutMode: "VERTICAL",
    itemSpacing: 8,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 20
  });
  await createText(cardId, "title", title, {
    styleId: TOKENS.headingH2StyleId,
    variableId: TOKENS.textPrimaryVarId,
    fontStyle: "Semibold",
    fontSize: 20,
    width: width - 40,
    height: 28
  });
  await createText(cardId, "subtitle", subtitle, {
    styleId: TOKENS.body2RegularStyleId,
    variableId: TOKENS.textSecondaryVarId,
    width: width - 40,
    height: 22
  });
  return cardId;
}

async function createProgressBar(parentId, name, width, color) {
  const barWrap = await createFrame(parentId, `${name}/wrap`, width, 12, "#EEF1F5");
  await updateNode(barWrap, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 0,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 999
  });
  await createFrame(barWrap, `${name}/fill`, Math.round(width * 0.72), 12, color);
  return barWrap;
}

async function createTimelineRow(parentId, label, width, fill) {
  const row = await createFrame(parentId, label, width, 36, fill);
  await updateNode(row, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 12,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 8,
    paddingBottom: 8,
    primaryAxisAlignItems: "SPACE_BETWEEN",
    counterAxisAlignItems: "CENTER",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 12
  });
  await createText(row, "label", label, {
    styleId: TOKENS.body2MediumStyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: width - 60,
    height: 22
  });
  return row;
}

async function createTableRow(parentId, project, due, progress) {
  const row = await createFrame(parentId, project, 0, 48, "#FFFFFF");
  await updateNode(row, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 16,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 12,
    paddingBottom: 12,
    primaryAxisAlignItems: "SPACE_BETWEEN",
    counterAxisAlignItems: "CENTER",
    primaryAxisSizingMode: "AUTO",
    counterAxisSizingMode: "AUTO",
    layoutAlign: "STRETCH"
  });
  await createText(row, "project", project, {
    styleId: TOKENS.body2MediumStyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 220,
    height: 22
  });
  await createText(row, "due", due, {
    styleId: TOKENS.body2RegularStyleId,
    variableId: TOKENS.textSecondaryVarId,
    width: 120,
    height: 22
  });
  await createText(row, "progress", progress, {
    styleId: TOKENS.body2MediumStyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 60,
    height: 22
  });
  return row;
}

async function main() {
  const rootId = await createFrame("33023:62", "ref/dashboard-trackline-v2", 1440, 1120, "#F6F7FB", 6200, 120);
  await updateNode(rootId, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 24,
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 24,
    paddingBottom: 24,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 24
  });

  const sidebarId = await createFrame(rootId, "sidebar", 248, 1072, "#FFFFFF");
  await updateNode(sidebarId, {
    layoutMode: "VERTICAL",
    itemSpacing: 20,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 16,
    paddingBottom: 16,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 24
  });

  const mainId = await createFrame(rootId, "main", 1144, 1072, "#FFFFFF");
  await updateNode(mainId, {
    layoutMode: "VERTICAL",
    itemSpacing: 20,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 24
  });

  const logoRow = await createFrame(sidebarId, "brand", 216, 44, "#FFFFFF");
  await updateNode(logoRow, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 12,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED"
  });
  const brandBadge = await createFrame(logoRow, "badge", 28, 28, "#5B5CEB");
  await updateNode(brandBadge, { cornerRadius: 8 });
  await createText(logoRow, "brand-name", "Trackline.", {
    styleId: TOKENS.headingH2StyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 140,
    height: 28
  });

  const workspaceCard = await createFrame(sidebarId, "workspace", 216, 72, "#F8F9FC");
  await updateNode(workspaceCard, {
    layoutMode: "VERTICAL",
    itemSpacing: 4,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 16
  });
  await createText(workspaceCard, "label", "Aerobox Workspace", {
    styleId: TOKENS.body2RegularStyleId,
    variableId: TOKENS.textSecondaryVarId,
    width: 180,
    height: 22
  });
  await createText(workspaceCard, "value", "Project Team", {
    styleId: TOKENS.body2MediumStyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 180,
    height: 22
  });

  const searchBar = await createFrame(sidebarId, "search", 216, 44, "#F8F9FC");
  await updateNode(searchBar, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 8,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 10,
    paddingBottom: 10,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 14
  });
  await createText(searchBar, "placeholder", "Search", {
    styleId: TOKENS.body2RegularStyleId,
    variableId: TOKENS.textSecondaryVarId,
    width: 120,
    height: 22
  });

  const navGroup = await createFrame(sidebarId, "main-menu", 216, 300, "#FFFFFF");
  await updateNode(navGroup, {
    layoutMode: "VERTICAL",
    itemSpacing: 8,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 8,
    paddingBottom: 8,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "AUTO"
  });
  for (const [index, item] of ["Dashboard", "Teams", "Calendar", "Time Tracker", "My Task", "Settings"].entries()) {
    const row = await createFrame(navGroup, item, 216, 40, index === 0 ? "#F5F7FF" : "#FFFFFF");
    await updateNode(row, {
      layoutMode: "HORIZONTAL",
      itemSpacing: 10,
      paddingLeft: 14,
      paddingRight: 14,
      paddingTop: 10,
      paddingBottom: 10,
      primaryAxisAlignItems: "MIN",
      counterAxisAlignItems: "CENTER",
      primaryAxisSizingMode: "FIXED",
      counterAxisSizingMode: "FIXED",
      cornerRadius: 12
    });
    await createText(row, "label", item, {
      styleId: TOKENS.body2MediumStyleId,
      variableId: TOKENS.textPrimaryVarId,
      width: 150,
      height: 22
    });
  }

  const profileCard = await createFrame(sidebarId, "profile", 216, 72, "#F8F9FC");
  await updateNode(profileCard, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 12,
    paddingLeft: 14,
    paddingRight: 14,
    paddingTop: 14,
    paddingBottom: 14,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 16
  });
  const avatar = await createFrame(profileCard, "avatar", 36, 36, "#A8C5FF");
  await updateNode(avatar, { cornerRadius: 999 });
  const profileText = await createFrame(profileCard, "meta", 120, 36, "#F8F9FC");
  await updateNode(profileText, {
    layoutMode: "VERTICAL",
    itemSpacing: 2,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED"
  });
  await createText(profileText, "name", "Farhan", {
    styleId: TOKENS.body2MediumStyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 120,
    height: 22
  });
  await createText(profileText, "email", "farhanwork@mail.com", {
    styleId: TOKENS.body2RegularStyleId,
    variableId: TOKENS.textSecondaryVarId,
    width: 140,
    height: 20
  });

  const topBar = await createFrame(mainId, "topbar", 1104, 48, "#F8F9FC");
  await updateNode(topBar, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 12,
    paddingLeft: 18,
    paddingRight: 18,
    paddingTop: 12,
    paddingBottom: 12,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "CENTER",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 16
  });
  await createText(topBar, "crumb", "Dashboard", {
    styleId: TOKENS.body2MediumStyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 200,
    height: 22
  });

  const metricsRow = await createFrame(mainId, "metrics", 1104, 188, "#FFFFFF");
  await updateNode(metricsRow, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 16,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED"
  });

  const tasksCard = await createCard(metricsRow, "Overall Tasks", "Spread across 6 projects.", 357, 188);
  await createText(tasksCard, "value", "Tasks 23", {
    styleId: TOKENS.headingH2StyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 200,
    height: 36
  });
  await createProgressBar(tasksCard, "tasks-bar", 300, "#63A7FF");

  const trackCard = await createCard(metricsRow, "Project Track", "Project performance status", 357, 188);
  await createText(trackCard, "value", "4892 Referral", {
    styleId: TOKENS.headingH2StyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 240,
    height: 36
  });
  await createProgressBar(trackCard, "track-bar", 300, "#6DD3A3");

  const progressCard = await createCard(metricsRow, "Project Progress", "Overall completion rate all projects.", 357, 188);
  await createText(progressCard, "value", "89% Complete", {
    styleId: TOKENS.headingH2StyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 220,
    height: 36
  });
  await createProgressBar(progressCard, "progress-bar", 300, "#63A7FF");

  const timelineCard = await createFrame(mainId, "project-timeline", 1104, 310, "#FFFFFF");
  await updateNode(timelineCard, {
    layoutMode: "VERTICAL",
    itemSpacing: 14,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 20
  });
  await createText(timelineCard, "title", "Project Timeline", {
    styleId: TOKENS.headingH2StyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 300,
    height: 28
  });
  await createText(timelineCard, "subtitle", "Visualize key milestones and deadlines in one place.", {
    styleId: TOKENS.body2RegularStyleId,
    variableId: TOKENS.textSecondaryVarId,
    width: 400,
    height: 22
  });
  const timelineGrid = await createFrame(timelineCard, "rows", 1064, 196, "#FFFFFF");
  await updateNode(timelineGrid, {
    layoutMode: "VERTICAL",
    itemSpacing: 12,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED"
  });
  await createTimelineRow(timelineGrid, "Meeting Brief Project", 520, "#EEF5FF");
  await createTimelineRow(timelineGrid, "Research Analyze Content", 460, "#F6EEFF");
  await createTimelineRow(timelineGrid, "Build Website & Mobile Responsive", 760, "#EEFBF5");
  await createTimelineRow(timelineGrid, "Branding Project", 560, "#EEFBF5");

  const tableCard = await createFrame(mainId, "project-list", 1104, 386, "#FFFFFF");
  await updateNode(tableCard, {
    layoutMode: "VERTICAL",
    itemSpacing: 12,
    paddingLeft: 20,
    paddingRight: 20,
    paddingTop: 20,
    paddingBottom: 20,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 20
  });
  await createText(tableCard, "title", "Project List", {
    styleId: TOKENS.headingH2StyleId,
    variableId: TOKENS.textPrimaryVarId,
    width: 300,
    height: 28
  });
  await createText(tableCard, "subtitle", "See all your projects in one place organized and easy to manage.", {
    styleId: TOKENS.body2RegularStyleId,
    variableId: TOKENS.textSecondaryVarId,
    width: 520,
    height: 22
  });
  const tableHeader = await createFrame(tableCard, "table-header", 1064, 40, "#F8F9FC");
  await updateNode(tableHeader, {
    layoutMode: "HORIZONTAL",
    itemSpacing: 16,
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 10,
    paddingBottom: 10,
    primaryAxisAlignItems: "SPACE_BETWEEN",
    counterAxisAlignItems: "CENTER",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED",
    cornerRadius: 12
  });
  for (const label of ["Project name", "Due task", "Status", "Progress"]) {
    await createText(tableHeader, label, label, {
      styleId: TOKENS.body2RegularStyleId,
      variableId: TOKENS.textSecondaryVarId,
      width: 180,
      height: 22
    });
  }
  const tableRows = await createFrame(tableCard, "rows", 1064, 220, "#FFFFFF");
  await updateNode(tableRows, {
    layoutMode: "VERTICAL",
    itemSpacing: 8,
    primaryAxisAlignItems: "MIN",
    counterAxisAlignItems: "MIN",
    primaryAxisSizingMode: "FIXED",
    counterAxisSizingMode: "FIXED"
  });
  await createTableRow(tableRows, "Vortex", "Sept 24, 2025", "40%");
  await createTableRow(tableRows, "Branding Logo", "Sept 24, 2025", "70%");
  await createTableRow(tableRows, "Animation", "Sept 24, 2025", "65%");
  await createTableRow(tableRows, "Landing Page", "Sept 24, 2025", "80%");

  console.log(JSON.stringify({ ok: true, rootId }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
