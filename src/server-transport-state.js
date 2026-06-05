export function buildActiveSessionResolution(liveSnapshots = []) {
  const resolvedLiveSnapshots = Array.isArray(liveSnapshots) ? liveSnapshots : [];
  const livePluginIds = resolvedLiveSnapshots.map((snapshot) => snapshot.pluginId);
  const liveDefaultSession =
    resolvedLiveSnapshots.find((snapshot) => snapshot.pluginId === "default") || null;
  const liveSelectionSessions = resolvedLiveSnapshots
    .filter(
      (snapshot) =>
        snapshot.pluginId !== "default" && Number(snapshot.selectionCount || 0) > 0
    )
    .sort((left, right) => Number(right.lastSeenAt || 0) - Number(left.lastSeenAt || 0));

  if (liveDefaultSession) {
    if (
      Number(liveDefaultSession.selectionCount || 0) === 0 &&
      liveSelectionSessions.length > 0
    ) {
      return {
        status: "selection_context",
        summary:
          "default 세션에 선택 정보가 없어, 선택이 있는 live 세션을 활성 경로로 우선 선택합니다.",
        reason: "prefer_live_selection_context",
        primaryPluginId: liveSelectionSessions[0].pluginId,
        livePluginIds,
        requiresExplicitPluginId: false
      };
    }
    return {
      status: "default",
      summary: "default 세션이 활성 경로로 우선 선택됩니다.",
      reason: "default_alias",
      primaryPluginId: "default",
      livePluginIds,
      requiresExplicitPluginId: false
    };
  }

  if (livePluginIds.length === 0) {
    return {
      status: "unavailable",
      summary: "활성 live 세션이 없어 기본 경로를 선택할 수 없습니다.",
      reason: "no_live_session",
      primaryPluginId: null,
      livePluginIds,
      requiresExplicitPluginId: false
    };
  }

  if (livePluginIds.length === 1) {
    return {
      status: "single",
      summary: "단일 live 세션이 활성 경로로 선택됩니다.",
      reason: "single_live_session",
      primaryPluginId: livePluginIds[0],
      livePluginIds,
      requiresExplicitPluginId: false
    };
  }

  return {
    status: "ambiguous",
    summary: `활성 live 세션 ${livePluginIds.length}개가 동시에 있어 pluginId를 명시해야 합니다.`,
    reason: "multiple_live_sessions",
    primaryPluginId: livePluginIds[0] || null,
    livePluginIds,
    requiresExplicitPluginId: true
  };
}

export function buildActiveRecoverySummary({
  activePluginIds = [],
  pendingRecoveryEntries = []
} = {}) {
  const activeIds = new Set(Array.isArray(activePluginIds) ? activePluginIds : []);
  const entries = Array.isArray(pendingRecoveryEntries) ? pendingRecoveryEntries : [];
  const actionablePendingRecovery = entries
    .filter(([pluginId]) => activeIds.has(pluginId))
    .map(([pluginId, recovery]) => ({
      pluginId,
      ...(recovery && typeof recovery === "object" ? recovery : {})
    }));

  return {
    activePendingRecoveryCount: actionablePendingRecovery.length,
    ignoredRecoveryTotal: Math.max(0, entries.length - actionablePendingRecovery.length),
    actionablePendingRecovery
  };
}

export function buildRuntimeObservabilitySnapshot({
  transportHealth = {},
  runtimeCounters = {},
  pendingCommandTotal = 0,
  pendingResultTotal = 0,
  pendingRecoveryTotal = 0,
  trackedSessionTotal = 0,
  failureSummary = {},
  lifecycleSummary = {}
} = {}) {
  const queueCounters =
    runtimeCounters.queue && typeof runtimeCounters.queue === "object"
      ? runtimeCounters.queue
      : {};
  const preflightCounters =
    runtimeCounters.preflight && typeof runtimeCounters.preflight === "object"
      ? runtimeCounters.preflight
      : {};
  const recoveryCounters =
    preflightCounters.recovery && typeof preflightCounters.recovery === "object"
      ? preflightCounters.recovery
      : {};
  const sessionCounters =
    runtimeCounters.sessions && typeof runtimeCounters.sessions === "object"
      ? runtimeCounters.sessions
      : {};

  return {
    transport: {
      ...transportHealth
    },
    queue: {
      ...queueCounters,
      historicalFailedTotal: queueCounters.failedTotal || 0,
      pendingCommands: pendingCommandTotal,
      pendingResults: pendingResultTotal,
      recentFailedTotal: failureSummary.recentFailedTotal || 0,
      lastFailureAt: failureSummary.lastFailureAt ?? null,
      lastFailureCommand: failureSummary.lastFailureCommand ?? null,
      currentReadHealth: failureSummary.currentReadHealth || "healthy",
      recentFailureWindowMs: failureSummary.recentFailureWindowMs || 0,
      lifecycleSummary
    },
    preflight: {
      ...preflightCounters,
      recovery: {
        ...recoveryCounters,
        pendingTotal: pendingRecoveryTotal
      }
    },
    sessions: {
      ...sessionCounters,
      trackedTotal: trackedSessionTotal
    }
  };
}

export function buildRuntimeOpsSnapshot({
  now = Date.now(),
  config = {},
  failureSummary = {},
  historicalFailedTotal = 0,
  sessionDiagnostics = {},
  livePluginIds = [],
  activeSessionResolution = null,
  pluginUiMetrics = [],
  queueDiagnostics = {},
  transportHealth = {},
  commandReadiness = {},
  writeReadiness = {},
  observabilitySnapshot = {}
} = {}) {
  const activePlugins = Array.isArray(livePluginIds) ? livePluginIds : [];

  return {
    now,
    config,
    currentReadHealth: failureSummary.currentReadHealth || "healthy",
    failures: {
      recentFailedTotal: failureSummary.recentFailedTotal || 0,
      historicalFailedTotal,
      lastFailureAt: failureSummary.lastFailureAt ?? null,
      lastFailureCommand: failureSummary.lastFailureCommand ?? null,
      recentFailureWindowMs: failureSummary.recentFailureWindowMs || 0
    },
    sessions: sessionDiagnostics,
    activePlugins,
    activePluginId: activePlugins[0] || null,
    activeSessionResolution,
    pluginUiMetrics: Array.isArray(pluginUiMetrics) ? pluginUiMetrics : [],
    queue: queueDiagnostics,
    transportHealth,
    commandReadiness,
    writeReadiness,
    observability: {
      ...observabilitySnapshot,
      transportHealth
    }
  };
}

export function buildPluginUiMetricsSnapshot(sessionSnapshots = []) {
  const snapshots = Array.isArray(sessionSnapshots) ? sessionSnapshots : [];
  return snapshots
    .filter((snapshot) => snapshot?.uiMetrics)
    .map((snapshot) => ({
      pluginId: snapshot.pluginId,
      state: snapshot.state,
      staleMs: snapshot.staleMs,
      fileName: snapshot.fileName,
      pageName: snapshot.pageName,
      uiMetrics: snapshot.uiMetrics
    }));
}

export function buildPrimaryLiveSessionSnapshot({
  liveSnapshots = [],
  activeSessionResolution = null
} = {}) {
  const snapshots = Array.isArray(liveSnapshots) ? liveSnapshots : [];
  const primaryPluginId =
    activeSessionResolution && typeof activeSessionResolution.primaryPluginId === "string"
      ? activeSessionResolution.primaryPluginId
      : null;
  return (
    snapshots.find((snapshot) => snapshot.pluginId === primaryPluginId) ||
    snapshots[0] ||
    null
  );
}

export function buildLivePluginIdsSnapshot(liveSnapshots = []) {
  const snapshots = Array.isArray(liveSnapshots) ? liveSnapshots : [];
  return snapshots
    .map((snapshot) => snapshot?.pluginId)
    .filter((pluginId) => typeof pluginId === "string" && pluginId.length > 0);
}

function isRuntimeEventWithinWindow(envelope, now, windowMs) {
  if (!envelope || typeof envelope.at !== "string") {
    return false;
  }
  const at = Date.parse(envelope.at);
  if (!Number.isFinite(at)) {
    return false;
  }
  return at >= now - Math.max(0, windowMs);
}

export function buildRecentTransportActivitySnapshot({
  recentRuntimeEvents = [],
  now = Date.now(),
  windowMs = 0
} = {}) {
  const events = Array.isArray(recentRuntimeEvents) ? recentRuntimeEvents : [];
  const resolvedWindowMs = Math.max(0, Number.isFinite(windowMs) ? windowMs : 0);
  let recentWsAckTotal = 0;
  let recentWsResultTotal = 0;
  let recentFallbackTotal = 0;
  let recentDeliveredTotal = 0;

  for (const envelope of events) {
    if (!isRuntimeEventWithinWindow(envelope, now, resolvedWindowMs)) {
      continue;
    }
    if (envelope.event === "ws.command.ack" || envelope.event === "ws.plugin.command.ack") {
      recentWsAckTotal += 1;
      continue;
    }
    if (
      envelope.event === "ws.command.result" ||
      envelope.event === "ws.plugin.command.result"
    ) {
      recentWsResultTotal += 1;
      continue;
    }
    if (envelope.event === "command.delivered") {
      recentDeliveredTotal += 1;
      if (
        envelope.payload &&
        typeof envelope.payload === "object" &&
        envelope.payload.delivery === "polling"
      ) {
        recentFallbackTotal += 1;
      }
    }
  }

  const recentSignalTotal =
    recentWsAckTotal + recentWsResultTotal + recentFallbackTotal;
  const fallbackRate =
    recentSignalTotal > 0 ? recentFallbackTotal / recentSignalTotal : 0;

  return {
    windowMs: resolvedWindowMs,
    recentWsAckTotal,
    recentWsResultTotal,
    recentFallbackTotal,
    recentDeliveredTotal,
    recentSignalTotal,
    fallbackRate: Number(fallbackRate.toFixed(4))
  };
}

export function buildTransportHealthSnapshot({
  recent = {},
  transportCounters = {},
  activeSseClients = 0,
  activeWsClients = 0,
  activeLivePluginCount = 0,
  recentRuntimeEventTotal = 0
} = {}) {
  const transport = transportCounters && typeof transportCounters === "object"
    ? transportCounters
    : {};
  const activeClientTotal = activeSseClients + activeWsClients;
  const wsDispatchSuccessRate =
    transport.wsDispatchedTotal > 0
      ? transport.wsAckTotal / transport.wsDispatchedTotal
      : 0;
  const fallbackAfterWsRate =
    transport.wsDispatchedTotal > 0
      ? transport.pollingFallbackAfterWsDispatchTotal / transport.wsDispatchedTotal
      : 0;
  const recentFallbackPressure = recent.fallbackRate || 0;
  const fallbackTrend = {
    windowMs: recent.windowMs || 0,
    recentRate: Number((recent.fallbackRate || 0).toFixed(4)),
    baselineRate: Number(fallbackAfterWsRate.toFixed(4)),
    deltaRate: Number(((recent.fallbackRate || 0) - fallbackAfterWsRate).toFixed(4)),
    recentFallbackTotal: recent.recentFallbackTotal || 0,
    recentSignalTotal: recent.recentSignalTotal || 0
  };
  const hasRecentFallbackSignals = fallbackTrend.recentFallbackTotal > 0;
  const recentWsRecoverySignalTotal =
    (recent.recentWsAckTotal || 0) + (recent.recentWsResultTotal || 0);
  const hasWebsocketTransportSignals =
    activeWsClients > 0 ||
    (recent.recentWsAckTotal || 0) > 0 ||
    (recent.recentWsResultTotal || 0) > 0 ||
    (transport.wsDispatchAttemptedTotal || 0) > 0 ||
    (transport.wsDispatchedTotal || 0) > 0 ||
    (transport.wsDispatchFailedTotal || 0) > 0 ||
    (transport.wsInboundRequestTotal || 0) > 0 ||
    (transport.wsInboundAcceptedTotal || 0) > 0 ||
    (transport.wsInboundResultTotal || 0) > 0 ||
    (transport.wsInboundErrorTotal || 0) > 0;
  const isolatedFallbackRecoveredOnWs =
    activeLivePluginCount > 0 &&
    activeWsClients > 0 &&
    hasRecentFallbackSignals &&
    (recent.recentFallbackTotal || 0) === 1 &&
    recentWsRecoverySignalTotal >= 2 &&
    (transport.wsDispatchFailedTotal || 0) + (transport.wsInboundErrorTotal || 0) === 0;
  const fallbackPressureRate = hasRecentFallbackSignals
    ? hasWebsocketTransportSignals
      ? Math.max(fallbackTrend.recentRate, fallbackTrend.baselineRate)
      : 0
    : fallbackTrend.recentRate;
  const adjustedFallbackPressureRate = isolatedFallbackRecoveredOnWs
    ? Math.min(fallbackTrend.recentRate, 0.12)
    : fallbackPressureRate;
  fallbackTrend.status =
    adjustedFallbackPressureRate >= 0.4
      ? "high"
      : adjustedFallbackPressureRate > 0.15
        ? "watch"
        : "stable";
  const effectiveFallbackRate = hasWebsocketTransportSignals
    ? hasRecentFallbackSignals
      ? Math.max(recentFallbackPressure, fallbackAfterWsRate)
      : recentFallbackPressure
    : 0;
  const adjustedEffectiveFallbackRate = isolatedFallbackRecoveredOnWs
    ? Math.min(recentFallbackPressure, 0.12)
    : effectiveFallbackRate;
  const transportHealth =
    activeLivePluginCount === 0
      ? "standby"
      : classifyTransportHealth({
          recentFailedTotal:
            (transport.wsDispatchFailedTotal || 0) + (transport.wsInboundErrorTotal || 0),
          fallbackRate: adjustedEffectiveFallbackRate,
          activeClientTotal,
          recentSignalTotal: recent.recentSignalTotal || 0
        });
  const summaryByGrade = {
    healthy: "스트리밍 연결이 안정적입니다.",
    degraded: "WS 실패 또는 polling fallback이 증가했습니다.",
    unhealthy: "스트리밍 신호가 불안정합니다.",
    standby: "활성 스트리밍 신호가 아직 없습니다."
  };
  const reasonByGrade = {
    healthy: "활성 SSE/WS 클라이언트와 최근 스트림 신호가 유지되고 있습니다.",
    degraded: "fallback 비중이 높아 스트리밍 신호를 계속 살펴봐야 합니다.",
    unhealthy: "WS 실패 또는 fallback 급증으로 transport가 불안정합니다.",
    standby:
      activeLivePluginCount === 0
        ? "활성 live 플러그인 세션이 없어 transport 상태를 대기 상태로 유지합니다."
        : "아직 연결된 SSE/WS 클라이언트가 없습니다."
  };

  return {
    grade: transportHealth,
    summary: summaryByGrade[transportHealth] || summaryByGrade.standby,
    reason: reasonByGrade[transportHealth] || reasonByGrade.standby,
    activeClients: {
      sse: activeSseClients,
      ws: activeWsClients,
      total: activeClientTotal
    },
    recentRuntimeEventTotal,
    counters: {
      wsDispatchAttemptedTotal: transport.wsDispatchAttemptedTotal || 0,
      wsDispatchedTotal: transport.wsDispatchedTotal || 0,
      wsDispatchFailedTotal: transport.wsDispatchFailedTotal || 0,
      wsAckTotal: transport.wsAckTotal || 0,
      wsResultTotal: transport.wsResultTotal || 0,
      wsInboundRequestTotal: transport.wsInboundRequestTotal || 0,
      wsInboundAcceptedTotal: transport.wsInboundAcceptedTotal || 0,
      wsInboundResultTotal: transport.wsInboundResultTotal || 0,
      wsInboundErrorTotal: transport.wsInboundErrorTotal || 0,
      pollingDeliveredTotal: transport.pollingDeliveredTotal || 0,
      pollingFallbackAfterWsDispatchTotal:
        transport.pollingFallbackAfterWsDispatchTotal || 0,
      pollingDeferredByWsGuardTotal: transport.pollingDeferredByWsGuardTotal || 0,
      pollingDeferredByReadyCapTotal: transport.pollingDeferredByReadyCapTotal || 0,
      pollingDeferredByPolicyBlockTotal:
        transport.pollingDeferredByPolicyBlockTotal || 0
    },
    recent,
    fallbackRate: Number(fallbackAfterWsRate.toFixed(4)),
    fallbackPressureRate: Number(adjustedFallbackPressureRate.toFixed(4)),
    wsDispatchSuccessRate: Number(wsDispatchSuccessRate.toFixed(4)),
    fallbackIncidenceTrend: fallbackTrend,
    isolatedFallbackRecoveredOnWs
  };
}

export function buildTransportHealthInputs({
  sseClients,
  wsClients,
  pluginSessions,
  recentRuntimeEvents,
  getSessionState,
  now = Date.now(),
  sessionStateOptions = {},
  liveState = "live"
} = {}) {
  const activeSseClients =
    sseClients && typeof sseClients.size === "number" ? sseClients.size : 0;
  const activeWsClients =
    wsClients && typeof wsClients.size === "number" ? wsClients.size : 0;
  const recentRuntimeEventTotal =
    recentRuntimeEvents && typeof recentRuntimeEvents.length === "number"
      ? recentRuntimeEvents.length
      : 0;
  let activeLivePluginCount = 0;

  if (
    pluginSessions &&
    typeof pluginSessions.values === "function" &&
    typeof getSessionState === "function"
  ) {
    for (const session of pluginSessions.values()) {
      const state = getSessionState(session, {
        now,
        ...sessionStateOptions
      });
      if (state === liveState) {
        activeLivePluginCount += 1;
      }
    }
  }

  return {
    activeSseClients,
    activeWsClients,
    activeLivePluginCount,
    recentRuntimeEventTotal
  };
}

export function classifyReadHealth(recentFailedTotal) {
  if (recentFailedTotal <= 0) {
    return "healthy";
  }
  if (recentFailedTotal <= 2) {
    return "degraded";
  }
  return "unhealthy";
}

export function classifyTransportHealth({
  recentFailedTotal,
  fallbackRate,
  activeClientTotal = 0,
  recentSignalTotal = 0
}) {
  if (recentFailedTotal > 2 || fallbackRate >= 0.4) {
    return "unhealthy";
  }
  if (fallbackRate > 0.15 || recentFailedTotal > 0) {
    return "degraded";
  }
  if (activeClientTotal > 0 || recentSignalTotal > 0) {
    return "healthy";
  }
  return "standby";
}

export function classifyCommandFailureCode(error, options = {}) {
  const runtimeErrorClass = options.runtimeErrorClass;
  const isRuntimeError =
    typeof runtimeErrorClass === "function" && error instanceof runtimeErrorClass;

  if (isRuntimeError && typeof error.code === "string") {
    return error.code;
  }

  return "ERR_COMMAND_FAILED";
}

export function trimRecentFailureEntries(entries = [], options = {}) {
  const source = Array.isArray(entries) ? entries : [];
  const now = Number.isFinite(options.now) ? options.now : Date.now();
  const windowMs = Math.max(0, Number.isFinite(options.windowMs) ? options.windowMs : 0);
  const historyLimit = Math.max(
    1,
    Math.floor(Number.isFinite(options.historyLimit) ? options.historyLimit : source.length || 1)
  );
  const cutoff = now - windowMs;
  const withinWindow = source.filter((entry) => Number(entry?.at) >= cutoff);
  return withinWindow.slice(-historyLimit);
}

export function trimCommandLifecycleEntries(entries = [], options = {}) {
  const source = Array.isArray(entries) ? entries : [];
  const limit = Math.max(
    1,
    Math.floor(Number.isFinite(options.limit) ? options.limit : source.length || 1)
  );
  return source.slice(-limit);
}

function clampNearTimeoutRatio(value, fallback) {
  const resolved = Number.isFinite(value) ? value : fallback;
  return Math.min(0.95, Math.max(0.05, resolved));
}

function buildTimingBottleneck(timing = {}) {
  const candidates = [
    {
      stage: "enqueue_to_dispatch",
      durationMs: Number.isFinite(timing.avgEnqueueToDispatchMs)
        ? timing.avgEnqueueToDispatchMs
        : null
    },
    {
      stage: "dispatch_to_ack",
      durationMs: Number.isFinite(timing.avgDispatchToAckMs)
        ? timing.avgDispatchToAckMs
        : null
    },
    {
      stage: "ack_to_complete",
      durationMs: Number.isFinite(timing.avgAckToCompleteMs)
        ? timing.avgAckToCompleteMs
        : null
    }
  ].filter((entry) => Number.isFinite(entry.durationMs));

  return candidates.length > 0
    ? candidates.sort((left, right) => right.durationMs - left.durationMs)[0]
    : null;
}

function toNonNegativeDurationMs(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.round(value));
}

function getLifecycleDurationMs(startAt, endAt) {
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
    return null;
  }
  if (endAt < startAt) {
    return null;
  }
  return toNonNegativeDurationMs(endAt - startAt);
}

export function buildCommandLifecycleSnapshot(
  command,
  status,
  now = Date.now(),
  extra = {}
) {
  if (!command) {
    return {
      commandId: null,
      pluginId: null,
      type: null,
      source: null,
      priority: null,
      status,
      createdAt: null,
      deliveredAt: null,
      wsDispatchedAt: null,
      wsAckedAt: null,
      completedAt: now,
      timeoutMs: null,
      ageMs: null,
      deliveryMode: extra.deliveryMode || null,
      failureCode: extra.failureCode || null,
      failureMessage: extra.failureMessage || null
    };
  }

  return {
    commandId: command.commandId,
    pluginId: command.pluginId,
    type: command.type,
    source: command.source,
    priority: command.priority,
    status,
    createdAt: command.createdAt,
    deliveredAt: command.deliveredAt,
    wsDispatchedAt:
      typeof command.wsDispatchedAt === "number" ? command.wsDispatchedAt : null,
    wsAckedAt: typeof command.wsAckedAt === "number" ? command.wsAckedAt : null,
    completedAt: now,
    timeoutMs:
      typeof command.timeoutMs === "number" && Number.isFinite(command.timeoutMs)
        ? command.timeoutMs
        : null,
    ageMs:
      typeof command.createdAt === "number" ? Math.max(0, now - command.createdAt) : null,
    deliveryMode: extra.deliveryMode || command.deliveryMode || null,
    failureCode: extra.failureCode || null,
    failureMessage: extra.failureMessage || null
  };
}

export function buildCommandFailureRecord({
  command,
  now = Date.now(),
  failureCode = "ERR_COMMAND_FAILED",
  failureMessage = ""
} = {}) {
  const lifecycleStatus = failureCode === "ERR_COMMAND_EXPIRED" ? "expired" : "failed";
  const lifecycle = buildCommandLifecycleSnapshot(command, lifecycleStatus, now, {
    failureCode,
    failureMessage
  });

  return {
    failure: {
      at: now,
      commandId: command?.commandId || null,
      pluginId: command?.pluginId || null,
      type: command?.type || null,
      source: command?.source || null,
      code: failureCode,
      message: failureMessage,
      lifecycle
    },
    lifecycle
  };
}

export function buildCommandLifecycleStateUpdate({
  recentCommandLifecycles = [],
  command,
  status,
  now = Date.now(),
  extra = {},
  lifecycleLimit
} = {}) {
  const lifecycle = buildCommandLifecycleSnapshot(command, status, now, extra);
  return {
    lifecycle,
    recentCommandLifecycles: trimCommandLifecycleEntries(
      [...(Array.isArray(recentCommandLifecycles) ? recentCommandLifecycles : []), lifecycle],
      { limit: lifecycleLimit }
    )
  };
}

export function buildCommandFailureStateUpdate({
  recentCommandFailures = [],
  recentCommandLifecycles = [],
  command,
  error,
  now = Date.now(),
  runtimeErrorClass,
  failureWindowMs,
  failureHistoryLimit,
  lifecycleLimit
} = {}) {
  const failureCode = classifyCommandFailureCode(error, { runtimeErrorClass });
  const failureMessage = error instanceof Error ? error.message : String(error);
  const record = buildCommandFailureRecord({
    command,
    now,
    failureCode,
    failureMessage
  });
  return {
    record,
    recentCommandFailures: trimRecentFailureEntries(
      [...(Array.isArray(recentCommandFailures) ? recentCommandFailures : []), record.failure],
      {
        now,
        windowMs: failureWindowMs,
        historyLimit: failureHistoryLimit
      }
    ),
    recentCommandLifecycles: trimCommandLifecycleEntries(
      [...(Array.isArray(recentCommandLifecycles) ? recentCommandLifecycles : []), record.lifecycle],
      { limit: lifecycleLimit }
    )
  };
}

export function createQueueObservabilityStore(options = {}) {
  let recentCommandFailures = [];
  let recentCommandLifecycles = [];

  const getLifecycleLimit = () => options.lifecycleLimit;
  const getFailureWindowMs = () => options.failureWindowMs;
  const getFailureHistoryLimit = () => options.failureHistoryLimit;

  return {
    recordLifecycle(command, status, now = Date.now(), extra = {}) {
      const update = buildCommandLifecycleStateUpdate({
        recentCommandLifecycles,
        command,
        status,
        now,
        extra,
        lifecycleLimit: getLifecycleLimit()
      });
      recentCommandLifecycles = update.recentCommandLifecycles;
      return update.lifecycle;
    },

    recordFailure(command, error, now = Date.now()) {
      const update = buildCommandFailureStateUpdate({
        recentCommandFailures,
        recentCommandLifecycles,
        command,
        error,
        now,
        runtimeErrorClass: options.runtimeErrorClass,
        failureWindowMs: getFailureWindowMs(),
        failureHistoryLimit: getFailureHistoryLimit(),
        lifecycleLimit: getLifecycleLimit()
      });
      recentCommandFailures = update.recentCommandFailures;
      recentCommandLifecycles = update.recentCommandLifecycles;
      return update.record;
    },

    trimFailures(now = Date.now()) {
      recentCommandFailures = trimRecentFailureEntries(recentCommandFailures, {
        now,
        windowMs: getFailureWindowMs(),
        historyLimit: getFailureHistoryLimit()
      });
      return recentCommandFailures.slice();
    },

    getLifecycleEntries() {
      return recentCommandLifecycles.map((entry) => ({ ...entry }));
    },

    getFailureEntries() {
      return recentCommandFailures.map((entry) => ({ ...entry }));
    },

    getLifecycleSummary(summaryOptions = {}) {
      return buildCommandLifecycleSummary(recentCommandLifecycles, summaryOptions);
    },

    getTimelineTail(tailOptions = {}) {
      return buildCommandTimelineTail(recentCommandLifecycles, tailOptions);
    },

    getFailureSummary(now = Date.now()) {
      this.trimFailures(now);
      return buildRecentFailureSummary({
        now,
        recentFailureWindowMs: getFailureWindowMs(),
        recentCommandFailures,
        recentCommandLifecycles
      });
    }
  };
}

export function buildCommandLifecycleSummary(lifecycleEntries = [], options = {}) {
  const pluginId = typeof options.pluginId === "string" ? options.pluginId : null;
  const entries = (Array.isArray(lifecycleEntries) ? lifecycleEntries : []).filter((entry) =>
    pluginId ? entry.pluginId === pluginId : true
  );
  const statusCounts = {};
  const expiredByType = {};
  let expiredTotal = 0;
  let lastExpired = null;
  let enqueueToDispatchTotal = 0;
  let enqueueToDispatchCount = 0;
  let dispatchToAckTotal = 0;
  let dispatchToAckCount = 0;
  let ackToCompleteTotal = 0;
  let ackToCompleteCount = 0;
  let enqueueToCompleteTotal = 0;
  let enqueueToCompleteCount = 0;

  for (const entry of entries) {
    const status = entry?.status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;

    const createdAt = Number.isFinite(entry?.createdAt) ? entry.createdAt : null;
    const dispatchAt = Number.isFinite(entry?.deliveredAt) ? entry.deliveredAt : null;
    const wsDispatchAt = Number.isFinite(entry?.wsDispatchedAt) ? entry.wsDispatchedAt : null;
    const wsAckAt = Number.isFinite(entry?.wsAckedAt) ? entry.wsAckedAt : null;
    const completedAt = Number.isFinite(entry?.completedAt) ? entry.completedAt : null;
    const effectiveDispatchAt = dispatchAt ?? wsDispatchAt;

    const enqueueToDispatchMs = getLifecycleDurationMs(createdAt, effectiveDispatchAt);
    if (Number.isFinite(enqueueToDispatchMs)) {
      enqueueToDispatchTotal += enqueueToDispatchMs;
      enqueueToDispatchCount += 1;
    }

    const dispatchToAckMs = getLifecycleDurationMs(wsDispatchAt ?? effectiveDispatchAt, wsAckAt);
    if (Number.isFinite(dispatchToAckMs)) {
      dispatchToAckTotal += dispatchToAckMs;
      dispatchToAckCount += 1;
    }

    const ackToCompleteMs = getLifecycleDurationMs(wsAckAt, completedAt);
    if (Number.isFinite(ackToCompleteMs)) {
      ackToCompleteTotal += ackToCompleteMs;
      ackToCompleteCount += 1;
    }

    const enqueueToCompleteMs = getLifecycleDurationMs(createdAt, completedAt);
    if (Number.isFinite(enqueueToCompleteMs)) {
      enqueueToCompleteTotal += enqueueToCompleteMs;
      enqueueToCompleteCount += 1;
    }

    if (status === "expired") {
      expiredTotal += 1;
      const type = typeof entry?.type === "string" ? entry.type : "unknown";
      expiredByType[type] = (expiredByType[type] || 0) + 1;
      if (!lastExpired || (entry?.completedAt || 0) > (lastExpired.completedAt || 0)) {
        lastExpired = {
          commandId: entry?.commandId || null,
          pluginId: entry?.pluginId || null,
          type: entry?.type || null,
          timeoutMs:
            Number.isFinite(entry?.timeoutMs) && entry.timeoutMs >= 0
              ? Math.round(entry.timeoutMs)
              : null,
          ageMs: Number.isFinite(entry?.ageMs) && entry.ageMs >= 0 ? Math.round(entry.ageMs) : null,
          failureCode: entry?.failureCode || null,
          failureMessage: entry?.failureMessage || null,
          createdAt,
          deliveredAt: dispatchAt,
          wsDispatchedAt: wsDispatchAt,
          wsAckedAt: wsAckAt,
          completedAt
        };
      }
    }
  }

  const toAverage = (total, count) =>
    count > 0 ? toNonNegativeDurationMs(total / count) : null;

  return {
    sampleSize: entries.length,
    statusCounts,
    timing: {
      avgEnqueueToDispatchMs: toAverage(enqueueToDispatchTotal, enqueueToDispatchCount),
      avgDispatchToAckMs: toAverage(dispatchToAckTotal, dispatchToAckCount),
      avgAckToCompleteMs: toAverage(ackToCompleteTotal, ackToCompleteCount),
      avgEnqueueToCompleteMs: toAverage(enqueueToCompleteTotal, enqueueToCompleteCount)
    },
    expired: {
      total: expiredTotal,
      byType: expiredByType,
      last: lastExpired
    }
  };
}

export function buildCommandTimelineTail(lifecycleEntries = [], options = {}) {
  const pluginId = typeof options.pluginId === "string" ? options.pluginId : null;
  const limit = Number.isFinite(options.limit) ? Math.max(1, Math.floor(options.limit)) : 5;
  const entries = (Array.isArray(lifecycleEntries) ? lifecycleEntries : [])
    .filter((entry) => (pluginId ? entry.pluginId === pluginId : true))
    .slice(-limit)
    .reverse();

  return entries.map((entry) => {
    const createdAt = Number.isFinite(entry?.createdAt) ? entry.createdAt : null;
    const deliveredAt = Number.isFinite(entry?.deliveredAt) ? entry.deliveredAt : null;
    const wsDispatchedAt = Number.isFinite(entry?.wsDispatchedAt) ? entry.wsDispatchedAt : null;
    const wsAckedAt = Number.isFinite(entry?.wsAckedAt) ? entry.wsAckedAt : null;
    const completedAt = Number.isFinite(entry?.completedAt) ? entry.completedAt : null;
    const effectiveDispatchAt = deliveredAt ?? wsDispatchedAt;

    return {
      commandId: entry?.commandId || null,
      pluginId: entry?.pluginId || null,
      type: entry?.type || null,
      status: entry?.status || "unknown",
      deliveryMode: entry?.deliveryMode || null,
      failureCode: entry?.failureCode || null,
      failureMessage: entry?.failureMessage || null,
      timestamps: {
        enqueuedAt: createdAt,
        dispatchedAt: effectiveDispatchAt,
        wsDispatchedAt,
        wsAckedAt,
        completedAt
      },
      durations: {
        enqueueToDispatchMs: getLifecycleDurationMs(createdAt, effectiveDispatchAt),
        dispatchToAckMs: getLifecycleDurationMs(wsDispatchedAt ?? effectiveDispatchAt, wsAckedAt),
        ackToCompleteMs: getLifecycleDurationMs(wsAckedAt, completedAt),
        enqueueToCompleteMs: getLifecycleDurationMs(createdAt, completedAt)
      }
    };
  });
}

export function buildRecentFailureSummary({
  now = Date.now(),
  recentFailureWindowMs = 120000,
  recentCommandFailures = [],
  recentCommandLifecycles = []
} = {}) {
  const failureWindowMs = Math.max(0, recentFailureWindowMs);
  const lastSuccessfulLifecycle =
    (Array.isArray(recentCommandLifecycles) ? recentCommandLifecycles : [])
      .slice()
      .reverse()
      .find(
        (entry) =>
          entry?.status === "completed" &&
          Number.isFinite(entry?.completedAt) &&
          now - entry.completedAt <= failureWindowMs
      ) || null;
  const recoveredAfterAt = Number.isFinite(lastSuccessfulLifecycle?.completedAt)
    ? lastSuccessfulLifecycle.completedAt
    : null;
  const effectiveFailures = (Array.isArray(recentCommandFailures)
    ? recentCommandFailures
    : []
  ).filter((entry) => {
    if (!Number.isFinite(recoveredAfterAt)) {
      return true;
    }
    return Number(entry?.at || 0) > recoveredAfterAt;
  });
  const recentFailedTotal = effectiveFailures.length;
  const lastFailure =
    recentFailedTotal > 0 ? effectiveFailures[recentFailedTotal - 1] : null;

  return {
    recentFailedTotal,
    lastFailureAt: lastFailure ? lastFailure.at : null,
    lastFailureCommand: lastFailure
      ? {
          commandId: lastFailure.commandId,
          pluginId: lastFailure.pluginId,
          type: lastFailure.type,
          source: lastFailure.source,
          code: lastFailure.code,
          message: lastFailure.message,
          lifecycle: lastFailure.lifecycle || null
        }
      : null,
    currentReadHealth: classifyReadHealth(recentFailedTotal),
    recentFailureWindowMs: failureWindowMs,
    recoveredAfterAt,
    recoveredAfterCommand: lastSuccessfulLifecycle
      ? {
          commandId: lastSuccessfulLifecycle.commandId || null,
          pluginId: lastSuccessfulLifecycle.pluginId || null,
          type: lastSuccessfulLifecycle.type || null,
          completedAt: lastSuccessfulLifecycle.completedAt || null
        }
      : null
  };
}

export function buildPendingCommandAgeBuckets(pendingCommands = [], now = Date.now()) {
  const buckets = {
    lt250ms: 0,
    ms250to1000: 0,
    ms1000to5000: 0,
    gte5000ms: 0
  };

  for (const command of pendingCommands) {
    const ageMs = Math.max(0, now - Number(command?.createdAt || 0));
    if (ageMs < 250) {
      buckets.lt250ms += 1;
      continue;
    }
    if (ageMs < 1000) {
      buckets.ms250to1000 += 1;
      continue;
    }
    if (ageMs < 5000) {
      buckets.ms1000to5000 += 1;
      continue;
    }
    buckets.gte5000ms += 1;
  }

  return buckets;
}

export function buildQueueDiagnosticsSnapshot({
  now = Date.now(),
  pendingCommands = [],
  pendingResultsTotal = 0,
  lifecycleTail = [],
  lifecycleSummary = {},
  commandTimelineTail = [],
  runtimeQueueCounters = {},
  defaults = {},
  helpers = {}
} = {}) {
  const commands = Array.isArray(pendingCommands) ? pendingCommands : [];
  const isWriteCommandType =
    typeof helpers.isWriteCommandType === "function" ? helpers.isWriteCommandType : () => false;
  const shouldDelayPollingFallbackForWs =
    typeof helpers.shouldDelayPollingFallbackForWs === "function"
      ? helpers.shouldDelayPollingFallbackForWs
      : () => false;
  const resolvePollingFallbackClass =
    typeof helpers.resolvePollingFallbackClass === "function"
      ? helpers.resolvePollingFallbackClass
      : () => "standard";
  const resolveAdaptivePollingFallbackMultiplier =
    typeof helpers.resolveAdaptivePollingFallbackMultiplier === "function"
      ? helpers.resolveAdaptivePollingFallbackMultiplier
      : () => ({ tuningMode: "base" });

  const byPlugin = {};
  const writeByType = {};
  let oldestPendingMs = 0;
  let oldestUndeliveredMs = 0;
  let undeliveredTotal = 0;
  let maxUndeliveredTimeoutRatio = 0;
  let minUndeliveredTimeoutBudgetMs = Number.POSITIVE_INFINITY;
  let minUndeliveredTimeRemainingMs = Number.POSITIVE_INFINITY;
  let pendingWriteTotal = 0;
  let undeliveredWriteTotal = 0;
  let oldestPendingWriteMs = 0;
  let oldestUndeliveredWriteMs = 0;
  let maxUndeliveredWriteTimeoutRatio = 0;
  let minUndeliveredWriteTimeoutBudgetMs = Number.POSITIVE_INFINITY;
  let minUndeliveredWriteTimeRemainingMs = Number.POSITIVE_INFINITY;
  let awaitingWsAckTotal = 0;
  let oldestAwaitingWsAckMs = 0;
  let deferredByWsGuard = 0;
  let oldestDeferredByWsGuardMs = 0;
  const deferredByFallbackClass = {};
  const deferredByTuningMode = {};
  const defaultTimeoutMs = Math.max(1, defaults.toolTimeoutMs || 30000);

  for (const command of commands) {
    const ageMs = Math.max(0, now - Number(command?.createdAt || 0));
    oldestPendingMs = Math.max(oldestPendingMs, ageMs);
    const type = command?.type;
    const pluginId = command?.pluginId;
    const isWrite = isWriteCommandType(type);
    const awaitingWsAck = Boolean(command?.awaitingWsAck);

    if (command?.deliveredAt === null) {
      undeliveredTotal += 1;
      oldestUndeliveredMs = Math.max(oldestUndeliveredMs, ageMs);
      const timeoutMs =
        typeof command?.timeoutMs === "number" && Number.isFinite(command.timeoutMs)
          ? Math.max(1, command.timeoutMs)
          : defaultTimeoutMs;
      maxUndeliveredTimeoutRatio = Math.max(maxUndeliveredTimeoutRatio, ageMs / timeoutMs);
      minUndeliveredTimeoutBudgetMs = Math.min(minUndeliveredTimeoutBudgetMs, timeoutMs);
      minUndeliveredTimeRemainingMs = Math.min(
        minUndeliveredTimeRemainingMs,
        Math.max(0, timeoutMs - ageMs)
      );
      if (isWrite) {
        undeliveredWriteTotal += 1;
        oldestUndeliveredWriteMs = Math.max(oldestUndeliveredWriteMs, ageMs);
        maxUndeliveredWriteTimeoutRatio = Math.max(
          maxUndeliveredWriteTimeoutRatio,
          ageMs / timeoutMs
        );
        minUndeliveredWriteTimeoutBudgetMs = Math.min(
          minUndeliveredWriteTimeoutBudgetMs,
          timeoutMs
        );
        minUndeliveredWriteTimeRemainingMs = Math.min(
          minUndeliveredWriteTimeRemainingMs,
          Math.max(0, timeoutMs - ageMs)
        );
      }
      if (awaitingWsAck) {
        awaitingWsAckTotal += 1;
        oldestAwaitingWsAckMs = Math.max(oldestAwaitingWsAckMs, ageMs);
      }
    }

    if (isWrite) {
      pendingWriteTotal += 1;
      oldestPendingWriteMs = Math.max(oldestPendingWriteMs, ageMs);
      writeByType[type] = (writeByType[type] || 0) + 1;
    }

    if (
      command?.deliveredAt === null &&
      !awaitingWsAck &&
      shouldDelayPollingFallbackForWs(command, now, Boolean(command?.canDelayPollingFallback))
    ) {
      deferredByWsGuard += 1;
      oldestDeferredByWsGuardMs = Math.max(oldestDeferredByWsGuardMs, ageMs);
      const fallbackClass = resolvePollingFallbackClass(type);
      deferredByFallbackClass[fallbackClass] = (deferredByFallbackClass[fallbackClass] || 0) + 1;
      const adaptive = resolveAdaptivePollingFallbackMultiplier(command, now);
      const tuningMode = adaptive?.tuningMode || "base";
      deferredByTuningMode[tuningMode] = (deferredByTuningMode[tuningMode] || 0) + 1;
    }

    if (!byPlugin[pluginId]) {
      byPlugin[pluginId] = {
        pendingTotal: 0,
        undeliveredTotal: 0,
        oldestPendingMs: 0
      };
    }
    byPlugin[pluginId].pendingTotal += 1;
    byPlugin[pluginId].oldestPendingMs = Math.max(byPlugin[pluginId].oldestPendingMs, ageMs);
    if (command?.deliveredAt === null) {
      byPlugin[pluginId].undeliveredTotal += 1;
    }
  }

  const nearTimeoutRatio = Number.isFinite(defaults.nearTimeoutRatio)
    ? Number(defaults.nearTimeoutRatio.toFixed(2))
    : 0.65;

  return {
    pendingTotal: commands.length,
    pendingResultsTotal,
    undeliveredTotal,
    oldestPendingMs,
    oldestUndeliveredMs,
    maxUndeliveredTimeoutRatio: Number(maxUndeliveredTimeoutRatio.toFixed(4)),
    minUndeliveredTimeoutBudgetMs: Number.isFinite(minUndeliveredTimeoutBudgetMs)
      ? minUndeliveredTimeoutBudgetMs
      : null,
    minUndeliveredTimeRemainingMs: Number.isFinite(minUndeliveredTimeRemainingMs)
      ? minUndeliveredTimeRemainingMs
      : null,
    awaitingWsAckTotal,
    oldestAwaitingWsAckMs,
    nearTimeoutRatio,
    deferredByWsGuard,
    oldestDeferredByWsGuardMs,
    deferredByFallbackClass,
    deferredByTuningMode,
    ageBuckets: buildPendingCommandAgeBuckets(commands, now),
    writes: {
      pendingTotal: pendingWriteTotal,
      undeliveredTotal: undeliveredWriteTotal,
      oldestPendingMs: oldestPendingWriteMs,
      oldestUndeliveredMs: oldestUndeliveredWriteMs,
      maxUndeliveredTimeoutRatio: Number(maxUndeliveredWriteTimeoutRatio.toFixed(4)),
      minUndeliveredTimeoutBudgetMs: Number.isFinite(minUndeliveredWriteTimeoutBudgetMs)
        ? minUndeliveredWriteTimeoutBudgetMs
        : null,
      minUndeliveredTimeRemainingMs: Number.isFinite(minUndeliveredWriteTimeRemainingMs)
        ? minUndeliveredWriteTimeRemainingMs
        : null,
      byType: writeByType
    },
    byPlugin,
    pollingFallbackPolicy: {
      mode: defaults.pollingFallbackMode || "recovery_only",
      baseGraceMs: Math.max(100, defaults.wsPollingFallbackGraceMs || 100),
      queuePressureThreshold: Math.max(
        1,
        Number.isFinite(defaults.wsPollingFallbackQueuePressureThreshold)
          ? defaults.wsPollingFallbackQueuePressureThreshold
          : 3
      ),
      nearTimeoutRatio,
      multipliers: {
        critical: defaults.fallbackMultipliers?.critical ?? 1,
        interactive: defaults.fallbackMultipliers?.interactive ?? 1,
        standard: defaults.fallbackMultipliers?.standard ?? 1,
        detail: defaults.fallbackMultipliers?.detail ?? 1
      }
    },
    writeCoalescing: {
      batchTotal: runtimeQueueCounters.writeCoalescedBatchTotal || 0,
      requestTotal: runtimeQueueCounters.writeCoalescedRequestTotal || 0,
      savedCommandTotal: runtimeQueueCounters.writeCoalescedSavedCommandTotal || 0
    },
    lifecycleTail: Array.isArray(lifecycleTail) ? lifecycleTail : [],
    lifecycleSummary,
    commandTimelineTail: Array.isArray(commandTimelineTail) ? commandTimelineTail : []
  };
}

export function buildCommandReadinessSnapshot({
  activePluginCount = 0,
  activePendingRecoveryCount = 0,
  ignoredRecoveryTotal = 0,
  failureSummary = {},
  queueDiagnostics = {},
  defaults = {}
} = {}) {
  const toolTimeoutMs = Math.max(1, defaults.toolTimeoutMs || 30000);
  const lastFailureCode = failureSummary.lastFailureCommand?.code || null;
  const recentExpiredCommand = lastFailureCode === "ERR_COMMAND_EXPIRED";
  const minUndeliveredTimeoutBudgetMs = Number.isFinite(
    queueDiagnostics?.minUndeliveredTimeoutBudgetMs
  )
    ? Math.max(1, Math.round(queueDiagnostics.minUndeliveredTimeoutBudgetMs))
    : toolTimeoutMs;
  const queueBacklogThresholdMs = Math.max(
    600,
    Math.floor(Math.min(toolTimeoutMs, minUndeliveredTimeoutBudgetMs) * 0.6)
  );
  const baseTimingLagThresholdMs = Math.max(
    250,
    Math.floor(Math.min(toolTimeoutMs, minUndeliveredTimeoutBudgetMs) * 0.2)
  );
  const oldestUndeliveredMs = Number(queueDiagnostics?.oldestUndeliveredMs || 0);
  const undeliveredTotal = Number(queueDiagnostics?.undeliveredTotal || 0);
  const awaitingWsAckTotal = Number(queueDiagnostics?.awaitingWsAckTotal || 0);
  const oldestAwaitingWsAckMs = Number(queueDiagnostics?.oldestAwaitingWsAckMs || 0);
  const deferredByWsGuard = Number(queueDiagnostics?.deferredByWsGuard || 0);
  const maxUndeliveredTimeoutRatio = Number(queueDiagnostics?.maxUndeliveredTimeoutRatio || 0);
  const minUndeliveredTimeRemainingMs = Number.isFinite(
    queueDiagnostics?.minUndeliveredTimeRemainingMs
  )
    ? Math.max(0, Math.round(queueDiagnostics.minUndeliveredTimeRemainingMs))
    : null;
  const nearTimeoutRatio = clampNearTimeoutRatio(
    queueDiagnostics?.nearTimeoutRatio,
    defaults.nearTimeoutRatio || 0.65
  );
  const lifecycleSummary = queueDiagnostics?.lifecycleSummary || {};
  const lifecycleTiming = lifecycleSummary.timing || {};
  const avgEnqueueToDispatchMs = Number.isFinite(lifecycleTiming.avgEnqueueToDispatchMs)
    ? lifecycleTiming.avgEnqueueToDispatchMs
    : null;
  const lifecycleSampleSize = Number(lifecycleSummary.sampleSize || 0);
  const adaptiveTimingLagCandidateMs =
    Number.isFinite(avgEnqueueToDispatchMs) && lifecycleSampleSize >= 2
      ? Math.max(300, Math.round(avgEnqueueToDispatchMs * 1.4))
      : null;
  const timingLagThresholdMs = Number.isFinite(adaptiveTimingLagCandidateMs)
    ? Math.max(
        300,
        Math.min(
          Math.max(baseTimingLagThresholdMs, adaptiveTimingLagCandidateMs),
          queueBacklogThresholdMs
        )
      )
    : baseTimingLagThresholdMs;
  const timingLagThresholdSource = Number.isFinite(adaptiveTimingLagCandidateMs)
    ? "adaptive_from_enqueue_dispatch"
    : "base_timeout_ratio";
  const wsAckGuardWindowMs = Math.max(100, defaults.wsAckGuardWindowMs || 1200);
  const timingBottleneck = buildTimingBottleneck(lifecycleTiming);
  const timingBottleneckStage = timingBottleneck?.stage || null;
  const timingBottleneckDurationMs = timingBottleneck
    ? Math.max(0, Math.round(timingBottleneck.durationMs))
    : null;
  const hasQueueBacklogRisk =
    Number(queueDiagnostics?.pendingTotal || 0) > 0 &&
    oldestUndeliveredMs >= queueBacklogThresholdMs;
  const hasQueueExpiryRisk =
    Number(queueDiagnostics?.pendingTotal || 0) > 0 &&
    maxUndeliveredTimeoutRatio >= nearTimeoutRatio &&
    minUndeliveredTimeRemainingMs !== null &&
    minUndeliveredTimeRemainingMs < 500;
  const hasDispatchAckLagRisk =
    Number(queueDiagnostics?.pendingTotal || 0) > 0 &&
    timingBottleneckStage === "dispatch_to_ack" &&
    Number.isFinite(timingBottleneckDurationMs) &&
    timingBottleneckDurationMs >= timingLagThresholdMs;
  const latestTimelineEntry = Array.isArray(queueDiagnostics?.commandTimelineTail)
    ? queueDiagnostics.commandTimelineTail[0] || null
    : null;
  const timingBottleneckCommandType = latestTimelineEntry?.type || null;
  const guardedUndeliveredTotal = awaitingWsAckTotal + deferredByWsGuard;
  const onlyGuardedUndeliveredPending =
    undeliveredTotal > 0 && guardedUndeliveredTotal >= undeliveredTotal;
  const withinGuardedWsWindow =
    onlyGuardedUndeliveredPending &&
    oldestUndeliveredMs <= wsAckGuardWindowMs &&
    maxUndeliveredTimeoutRatio < nearTimeoutRatio;
  const readinessDetails = {
    activePluginCount,
    pendingRecoveryTotal: activePendingRecoveryCount,
    ignoredRecoveryTotal,
    recentExpiredCommand,
    lastFailureCode,
    undeliveredTotal,
    awaitingWsAckTotal,
    oldestAwaitingWsAckMs,
    deferredByWsGuard,
    guardedUndeliveredTotal,
    onlyGuardedUndeliveredPending,
    withinGuardedWsWindow,
    oldestUndeliveredMs,
    maxUndeliveredTimeoutRatio,
    minUndeliveredTimeRemainingMs,
    minUndeliveredTimeoutBudgetMs,
    nearTimeoutRatio,
    wsAckGuardWindowMs,
    queueBacklogThresholdMs,
    baseTimingLagThresholdMs,
    timingLagThresholdMs,
    timingLagThresholdSource,
    timingBottleneckStage,
    timingBottleneckDurationMs,
    timingBottleneckCommandType
  };

  if (activePluginCount === 0) {
    return {
      status: "unavailable",
      summary: "활성 플러그인 세션이 없어 명령을 받을 준비가 되지 않았습니다.",
      reason: "no_active_plugin",
      ...readinessDetails
    };
  }

  if (activePendingRecoveryCount > 0) {
    return {
      status: "degraded",
      summary: "세션 recovery가 남아 있어 명령 응답이 불안정할 수 있습니다.",
      reason: "session_recovery_pending",
      ...readinessDetails
    };
  }

  if (withinGuardedWsWindow) {
    return {
      status: "ready",
      summary: "WS ack grace 안에서 명령이 정상 대기 중입니다.",
      reason: "ready_ws_ack_grace",
      ...readinessDetails
    };
  }

  if (hasDispatchAckLagRisk) {
    return {
      status: "degraded",
      summary:
        "WS dispatch 이후 ack 구간이 길어 command-ready와 실제 응답 간극이 커질 수 있습니다.",
      reason: "queue_dispatch_ack_lag",
      ...readinessDetails
    };
  }

  if (hasQueueExpiryRisk) {
    return {
      status: "degraded",
      summary: "대기 중인 명령이 각 timeout 예산에 가까워져 polling fallback 전환이 필요할 수 있습니다.",
      reason: "queue_expiry_risk",
      ...readinessDetails
    };
  }

  if (hasQueueBacklogRisk) {
    return {
      status: "degraded",
      summary: "대기 중인 명령이 오래 머물러 있어 곧 timeout 또는 expire 위험이 있습니다.",
      reason: "queue_backlog_risk",
      ...readinessDetails
    };
  }

  if (recentExpiredCommand) {
    return {
      status: "degraded",
      summary: "최근 명령 만료가 있어 현재 read command 준비 상태를 확인해야 합니다.",
      reason: "recent_command_expired",
      ...readinessDetails
    };
  }

  if (failureSummary.currentReadHealth !== "healthy") {
    return {
      status: "degraded",
      summary: "최근 명령 실패가 있어 현재 read command 품질이 저하될 수 있습니다.",
      reason: "recent_command_failures",
      ...readinessDetails
    };
  }

  return {
    status: "ready",
    summary: "활성 세션이 있고 최근 read command 실패 신호가 없습니다.",
    reason: "ready",
    ...readinessDetails
  };
}

export function buildWriteReadinessInputs({
  now = Date.now(),
  recentCommandLifecycles = [],
  recentCommandFailures = [],
  failureWindowMs = 0,
  isWriteCommandType = () => false
} = {}) {
  const lifecycleEntries = Array.isArray(recentCommandLifecycles)
    ? recentCommandLifecycles
    : [];
  const failureEntries = Array.isArray(recentCommandFailures)
    ? recentCommandFailures
    : [];
  const lastSuccessfulWriteLifecycle =
    lifecycleEntries
      .slice()
      .reverse()
      .find((entry) => entry?.status === "completed" && isWriteCommandType(entry?.type)) || null;
  const lastSuccessfulWriteAt = Number.isFinite(lastSuccessfulWriteLifecycle?.completedAt)
    ? lastSuccessfulWriteLifecycle.completedAt
    : null;
  const recentWriteFailure =
    failureEntries
      .slice()
      .reverse()
      .find(
        (entry) =>
          isWriteCommandType(entry?.type) &&
          Number.isFinite(entry?.at) &&
          now - entry.at <= Math.max(0, failureWindowMs)
      ) || null;

  return {
    lastSuccessfulWriteAt,
    lastSuccessfulWriteLifecycle,
    recentWriteFailure
  };
}

export function buildWriteReadinessSnapshot({
  now = Date.now(),
  activePluginCount = 0,
  activePendingRecoveryCount = 0,
  failureSummary = {},
  queueDiagnostics = {},
  primaryLiveSession = null,
  recentWriteFailure = null,
  lastSuccessfulWriteAt = null,
  defaults = {}
} = {}) {
  const writes = queueDiagnostics?.writes || {};
  const pendingWriteCount = Number(writes.pendingTotal || 0);
  const undeliveredWriteCount = Number(writes.undeliveredTotal || 0);
  const pendingWriteByType = writes.byType || {};
  const oldestPendingWriteMs = Number(writes.oldestPendingMs || 0);
  const oldestUndeliveredWriteMs = Number(writes.oldestUndeliveredMs || 0);
  const maxUndeliveredWriteTimeoutRatio = Number(writes.maxUndeliveredTimeoutRatio || 0);
  const minUndeliveredWriteTimeoutBudgetMs = Number.isFinite(writes.minUndeliveredTimeoutBudgetMs)
    ? Math.max(1, Math.round(writes.minUndeliveredTimeoutBudgetMs))
    : null;
  const minUndeliveredWriteTimeRemainingMs = Number.isFinite(writes.minUndeliveredTimeRemainingMs)
    ? Math.max(0, Math.round(writes.minUndeliveredTimeRemainingMs))
    : null;
  const nearTimeoutRatio = clampNearTimeoutRatio(
    queueDiagnostics?.nearTimeoutRatio,
    defaults.nearTimeoutRatio || 0.65
  );
  const lastHeartbeatGapMs = Number.isFinite(primaryLiveSession?.staleMs)
    ? Math.max(0, Math.round(primaryLiveSession.staleMs))
    : null;
  const activeLiveSessionAgeMs =
    primaryLiveSession && Number.isFinite(primaryLiveSession.registeredAt)
      ? Math.max(0, Math.round(now - primaryLiveSession.registeredAt))
      : null;
  const recoveredFromRecentWriteFailure =
    Boolean(recentWriteFailure) &&
    Number.isFinite(lastSuccessfulWriteAt) &&
    lastSuccessfulWriteAt > recentWriteFailure.at;
  const recentWriteExpired =
    !recoveredFromRecentWriteFailure && recentWriteFailure?.code === "ERR_COMMAND_EXPIRED";
  const isBatchWriteCommandType =
    typeof defaults.isBatchWriteCommandType === "function"
      ? defaults.isBatchWriteCommandType
      : () => false;
  const onlyBatchWritesPending =
    pendingWriteCount > 0 &&
    Object.keys(pendingWriteByType).every((type) => isBatchWriteCommandType(type));
  const writePendingBacklogThresholdMs = Math.max(
    1,
    defaults.writePendingBacklogThresholdMs || 2000
  );
  const writeBacklogThresholdMs =
    Number.isFinite(minUndeliveredWriteTimeoutBudgetMs) && minUndeliveredWriteTimeoutBudgetMs > 0
      ? Math.max(
          onlyBatchWritesPending ? 1000 : 750,
          Math.min(
            writePendingBacklogThresholdMs,
            Math.floor(
              minUndeliveredWriteTimeoutBudgetMs * (onlyBatchWritesPending ? 0.65 : 0.55)
            )
          )
        )
      : writePendingBacklogThresholdMs;

  const readinessDetails = {
    activePluginCount,
    pendingRecoveryTotal: activePendingRecoveryCount,
    pendingWriteCount,
    undeliveredWriteCount,
    oldestPendingWriteMs,
    oldestUndeliveredWriteMs,
    maxUndeliveredWriteTimeoutRatio,
    minUndeliveredWriteTimeoutBudgetMs,
    minUndeliveredWriteTimeRemainingMs,
    nearTimeoutRatio,
    writeBacklogThresholdMs,
    onlyBatchWritesPending,
    lastSuccessfulWriteAt,
    lastFailedWriteAt: recentWriteFailure?.at || null,
    lastFailedWriteCode: recentWriteFailure?.code || null,
    recentWriteFailureRecovered: recoveredFromRecentWriteFailure,
    lastHeartbeatGapMs,
    activeLiveSessionAgeMs,
    pendingWriteByType,
    currentReadHealth: failureSummary.currentReadHealth
  };

  if (activePluginCount === 0) {
    return {
      status: "unavailable",
      summary: "활성 플러그인 세션이 없어 write 명령을 보낼 준비가 되지 않았습니다.",
      reason: "no_active_plugin",
      ...readinessDetails
    };
  }

  if (activePendingRecoveryCount > 0) {
    return {
      status: "degraded",
      summary: "세션 recovery가 남아 있어 write 명령 응답이 끊기거나 지연될 수 있습니다.",
      reason: "session_recovery_pending",
      ...readinessDetails
    };
  }

  if (
    pendingWriteCount > 0 &&
    undeliveredWriteCount > 0 &&
    maxUndeliveredWriteTimeoutRatio >= nearTimeoutRatio
  ) {
    return {
      status: "degraded",
      summary: "대기 중인 write 명령이 timeout 예산에 가까워져 bind/update 작업이 만료될 수 있습니다.",
      reason: "write_queue_expiry_risk",
      ...readinessDetails
    };
  }

  if (
    pendingWriteCount > 0 &&
    undeliveredWriteCount > 0 &&
    oldestUndeliveredWriteMs >= writeBacklogThresholdMs
  ) {
    return {
      status: "degraded",
      summary: "대기 중인 write 명령이 오래 머물러 있어 mutation queue 병목 가능성이 큽니다.",
      reason: "write_queue_backlog_risk",
      ...readinessDetails
    };
  }

  if (recentWriteExpired) {
    return {
      status: "degraded",
      summary: "최근 write 명령이 expire되어 대량 bind/update 작업을 바로 재시도하기엔 위험합니다.",
      reason: "recent_write_expired",
      ...readinessDetails
    };
  }

  if (recentWriteFailure && !recoveredFromRecentWriteFailure) {
    return {
      status: "degraded",
      summary: "최근 write 명령 실패가 있어 쓰기 경로를 다시 점검해야 합니다.",
      reason: "recent_write_failures",
      ...readinessDetails
    };
  }

  if (
    Number.isFinite(lastHeartbeatGapMs) &&
    lastHeartbeatGapMs >= Math.max(1, defaults.writeHeartbeatGapDegradedMs || 6000)
  ) {
    return {
      status: "degraded",
      summary: "세션 heartbeat 간격이 길어 write 도중 stale 전환 위험이 있습니다.",
      reason: "heartbeat_gap_risk",
      ...readinessDetails
    };
  }

  return {
    status: "ready",
    summary: "활성 세션과 최근 write 성공 기록이 있어 mutation 작업을 받을 준비가 되었습니다.",
    reason: "ready",
    ...readinessDetails
  };
}
