export const SERVER_ROUTE_PATHS = Object.freeze({
  health: "/health",
  sessions: "/api/sessions",
  runtimeOps: "/api/runtime-ops",
  pages: "/api/pages",
  composeMetrics: "/api/compose-metrics",
  figmaMe: "/api/figma/me",
  figmaTeamProjects: "/api/figma/team-projects",
  figmaProjectFiles: "/api/figma/project-files",
  figmaFileSummary: "/api/figma/file-summary",
  figmaFileComments: "/api/figma/file-comments"
});

export function createRouteTable(handlers = {}) {
  return [
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.health,
      handler: handlers.handleHealth || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.sessions,
      handler: handlers.handleSessions || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.runtimeOps,
      handler: handlers.handleRuntimeOps || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.pages,
      handler: handlers.handlePages || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.composeMetrics,
      handler: handlers.handleComposeMetrics || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.figmaMe,
      handler: handlers.handleFigmaMe || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.figmaTeamProjects,
      handler: handlers.handleFigmaTeamProjects || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.figmaProjectFiles,
      handler: handlers.handleFigmaProjectFiles || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.figmaFileSummary,
      handler: handlers.handleFigmaFileSummary || null
    },
    {
      method: "GET",
      path: SERVER_ROUTE_PATHS.figmaFileComments,
      handler: handlers.handleFigmaFileComments || null
    }
  ];
}

export async function handleRouteTableRequest(table, req, res, url) {
  const route = table.find((entry) => entry.method === req.method && entry.path === url.pathname);
  if (!route || typeof route.handler !== "function") {
    return false;
  }

  await route.handler(req, res, url);
  return true;
}

export function createStableRouteHandlers(deps = {}) {
  const {
    BRIDGE_PACKAGE_NAME,
    BRIDGE_VERSION,
    FIGMA_ACCOUNT_API_OPTIONS,
    SESSION_ACTIVE_WINDOW_MS,
    buildAiDesignerSnapshot,
    buildFileCommentsPlan,
    canWriteResponse,
    clampStaleLimit,
    executePluginCommand,
    getActiveSessionResolution,
    getActiveHttpPort,
    getCurrentUser,
    getDesignerAiConfig,
    getFileSummary,
    getHealthEventSnapshot,
    getOrCreateRequestSnapshotCacheEntry,
    getPrimaryLiveSessionSnapshot,
    getQueueDiagnostics,
    getRecentFailureSummary,
    getRuntimeFeatureFlagsSnapshot,
    getRuntimeObservabilitySnapshot,
    getRuntimeOpsSnapshot,
    getSessionSnapshots,
    getTransportCapabilitiesSnapshot,
    getTransportHealthSnapshot,
    jsonResponse,
    listFileComments,
    listProjectFiles,
    listTeamProjects,
    performGetComposeMetrics,
    pluginSessions
  } = deps;

  async function handleHealth(req, res, url) {
    const now = Date.now();
    const failureSummary = getOrCreateRequestSnapshotCacheEntry(`failure:${now}`, () =>
      getRecentFailureSummary(now)
    );
    const transportHealth = getOrCreateRequestSnapshotCacheEntry(`transport:${now}`, () =>
      getTransportHealthSnapshot(now)
    );
    const queueDiagnostics = getOrCreateRequestSnapshotCacheEntry(`queue:${now}`, () =>
      getQueueDiagnostics(now)
    );
    const healthSnapshot = getHealthEventSnapshot(now, {
      failureSummary,
      transportHealth,
      queueDiagnostics
    });
    const activePlugins = healthSnapshot.activePlugins;
    const observability = getRuntimeObservabilitySnapshot({
      now,
      failureSummary,
      transportHealth
    });
    const designerAiConfig = getDesignerAiConfig();
    jsonResponse(res, 200, {
      ok: true,
      server: "writable-mcp-bridge",
      serverVersion: BRIDGE_VERSION,
      packageName: BRIDGE_PACKAGE_NAME,
      packageVersion: BRIDGE_VERSION,
      transportCapabilities: getTransportCapabilitiesSnapshot(),
      runtimeFeatureFlags: getRuntimeFeatureFlagsSnapshot(),
      aiDesigner: buildAiDesignerSnapshot(designerAiConfig),
      transportHealth,
      commandReadiness: healthSnapshot.commandReadiness,
      writeReadiness: healthSnapshot.writeReadiness,
      port: typeof getActiveHttpPort === "function" ? getActiveHttpPort() : deps.activeHttpPort,
      activePlugins,
      activePluginId: healthSnapshot.activePluginId,
      activeSession: healthSnapshot.activeSession,
      activeSessionResolution: healthSnapshot.activeSessionResolution,
      currentReadHealth: failureSummary.currentReadHealth,
      recentFailedTotal: failureSummary.recentFailedTotal,
      lastFailureAt: failureSummary.lastFailureAt,
      lastFailureCommand: failureSummary.lastFailureCommand,
      observability
    });
  }

  async function handleSessions(req, res, url) {
    const includeStale = url.searchParams.get("includeStale") === "true";
    const now = Date.now();
    const sessions = getSessionSnapshots({ includeStale, now });
    const primarySession = getPrimaryLiveSessionSnapshot(now);
    const activeSessionResolution = getActiveSessionResolution({ now });
    jsonResponse(res, 200, {
      ok: true,
      sessions,
      primarySession,
      activePluginId: primarySession?.pluginId || null,
      activeSessionResolution,
      includeStale,
      now,
      activeWindowMs: SESSION_ACTIVE_WINDOW_MS,
      observability: getRuntimeObservabilitySnapshot({ now })
    });
  }

  async function handleRuntimeOps(req, res, url) {
    const staleLimit = clampStaleLimit(url.searchParams.get("staleLimit"));
    const result = getRuntimeOpsSnapshot({
      now: Date.now(),
      staleLimit
    });
    jsonResponse(res, 200, { ok: true, result });
  }

  async function handlePages(req, res, url) {
    const pluginIdParam = url.searchParams.get("pluginId");
    const pluginId =
      typeof pluginIdParam === "string" && pluginIdParam.trim()
        ? pluginIdParam.trim()
        : "default";
    let connectionClosed = false;
    const markClosed = () => {
      connectionClosed = true;
    };

    req.once("close", markClosed);
    res.once("close", markClosed);
    res.once("error", markClosed);
    try {
      const result = await executePluginCommand(pluginId, "list_pages");
      if (connectionClosed || !canWriteResponse(res)) {
        return;
      }
      jsonResponse(res, 200, { ok: true, result });
    } catch (error) {
      if (connectionClosed || !canWriteResponse(res)) {
        return;
      }
      throw error;
    } finally {
      req.off("close", markClosed);
      res.off("close", markClosed);
      res.off("error", markClosed);
    }
  }

  async function handleComposeMetrics(req, res, url) {
    const result = performGetComposeMetrics();
    jsonResponse(res, 200, { ok: true, result });
  }

  async function handleFigmaMe(req, res, url) {
    const result = await getCurrentUser(FIGMA_ACCOUNT_API_OPTIONS);
    jsonResponse(res, 200, { ok: true, result });
  }

  async function handleFigmaTeamProjects(req, res, url) {
    const result = await listTeamProjects(
      {
        teamId: url.searchParams.get("teamId"),
        query: url.searchParams.get("query"),
        maxResults: url.searchParams.get("maxResults")
          ? Number(url.searchParams.get("maxResults"))
          : undefined
      },
      FIGMA_ACCOUNT_API_OPTIONS
    );
    jsonResponse(res, 200, { ok: true, result });
  }

  async function handleFigmaProjectFiles(req, res, url) {
    const result = await listProjectFiles(
      {
        projectId: url.searchParams.get("projectId"),
        query: url.searchParams.get("query"),
        maxResults: url.searchParams.get("maxResults")
          ? Number(url.searchParams.get("maxResults"))
          : undefined,
        branchData: url.searchParams.get("branchData") === "true"
      },
      FIGMA_ACCOUNT_API_OPTIONS
    );
    jsonResponse(res, 200, { ok: true, result });
  }

  async function handleFigmaFileSummary(req, res, url) {
    const result = await getFileSummary(
      {
        fileKey: url.searchParams.get("fileKey")
      },
      FIGMA_ACCOUNT_API_OPTIONS
    );
    jsonResponse(res, 200, { ok: true, result });
  }

  async function handleFigmaFileComments(req, res, url) {
    const pluginIdParam = url.searchParams.get("pluginId");
    const pluginId =
      typeof pluginIdParam === "string" && pluginIdParam.trim()
        ? pluginIdParam.trim()
        : "default";
    const session = pluginSessions.get(pluginId) || null;
    const fileKeyFromSession =
      session && typeof session.fileKey === "string" && session.fileKey.trim()
        ? session.fileKey
        : null;
    const plan = buildFileCommentsPlan({
      fileKey: url.searchParams.get("fileKey") || fileKeyFromSession,
      maxResults: url.searchParams.get("maxResults")
        ? Number(url.searchParams.get("maxResults"))
        : undefined,
      includeResolved: url.searchParams.get("includeResolved") !== "false",
      targetNodeId: url.searchParams.get("targetNodeId")
    });
    const result = await listFileComments(plan, FIGMA_ACCOUNT_API_OPTIONS);
    jsonResponse(res, 200, { ok: true, result });
  }

  return {
    handleHealth,
    handleSessions,
    handleRuntimeOps,
    handlePages,
    handleComposeMetrics,
    handleFigmaMe,
    handleFigmaTeamProjects,
    handleFigmaProjectFiles,
    handleFigmaFileSummary,
    handleFigmaFileComments
  };
}
