import test from "node:test";
import assert from "node:assert/strict";

import {
  buildActiveSessionResolution,
  buildActiveRecoverySummary,
  buildCommandLifecycleSummary,
  buildCommandLifecycleSnapshot,
  buildCommandFailureRecord,
  buildCommandFailureStateUpdate,
  buildCommandTimelineTail,
  buildCommandLifecycleStateUpdate,
  buildCommandReadinessSnapshot,
  buildLivePluginIdsSnapshot,
  buildPluginUiMetricsSnapshot,
  buildPrimaryLiveSessionSnapshot,
  buildPendingCommandAgeBuckets,
  buildQueueDiagnosticsSnapshot,
  buildRecentTransportActivitySnapshot,
  buildRecentFailureSummary,
  buildRuntimeObservabilitySnapshot,
  buildRuntimeOpsSnapshot,
  buildTransportHealthInputs,
  buildTransportHealthSnapshot,
  buildWriteReadinessSnapshot,
  buildWriteReadinessInputs,
  classifyCommandFailureCode,
  classifyReadHealth,
  classifyTransportHealth,
  createQueueObservabilityStore,
  trimCommandLifecycleEntries,
  trimRecentFailureEntries
} from "../src/server-transport-state.js";

test("buildActiveSessionResolution prefers selected live sessions over empty default", () => {
  const resolution = buildActiveSessionResolution([
    {
      pluginId: "default",
      selectionCount: 0,
      lastSeenAt: 100
    },
    {
      pluginId: "page:1",
      selectionCount: 1,
      lastSeenAt: 200
    }
  ]);

  assert.deepEqual(resolution, {
    status: "selection_context",
    summary: "default 세션에 선택 정보가 없어, 선택이 있는 live 세션을 활성 경로로 우선 선택합니다.",
    reason: "prefer_live_selection_context",
    primaryPluginId: "page:1",
    livePluginIds: ["default", "page:1"],
    requiresExplicitPluginId: false
  });
});

test("buildActiveSessionResolution marks multiple non-default live sessions ambiguous", () => {
  const resolution = buildActiveSessionResolution([
    { pluginId: "page:2", selectionCount: 0, lastSeenAt: 300 },
    { pluginId: "page:1", selectionCount: 0, lastSeenAt: 200 }
  ]);

  assert.equal(resolution.status, "ambiguous");
  assert.equal(resolution.primaryPluginId, "page:2");
  assert.deepEqual(resolution.livePluginIds, ["page:2", "page:1"]);
  assert.equal(resolution.requiresExplicitPluginId, true);
});

test("buildActiveRecoverySummary separates active and ignored recovery entries", () => {
  const summary = buildActiveRecoverySummary({
    activePluginIds: ["page:1", "page:3"],
    pendingRecoveryEntries: [
      ["page:1", { failures: [{ code: "ERR_A" }] }],
      ["page:2", { failures: [{ code: "ERR_B" }] }]
    ]
  });

  assert.equal(summary.activePendingRecoveryCount, 1);
  assert.equal(summary.ignoredRecoveryTotal, 1);
  assert.deepEqual(summary.actionablePendingRecovery, [
    {
      pluginId: "page:1",
      failures: [{ code: "ERR_A" }]
    }
  ]);
});

test("buildRuntimeObservabilitySnapshot assembles transport, queue, preflight, and session counters", () => {
  const snapshot = buildRuntimeObservabilitySnapshot({
    transportHealth: {
      grade: "healthy",
      reason: "streaming_signal"
    },
    runtimeCounters: {
      queue: {
        enqueuedTotal: 3,
        failedTotal: 1,
        expiredTotal: 0
      },
      preflight: {
        failuresTotal: 2,
        failuresByCode: {
          ERR_NO_PLUGIN_SESSION: 2
        },
        recovery: {
          pendingTotal: 99,
          recoveredTotal: 4
        }
      },
      sessions: {
        pruneRunsTotal: 5,
        prunedTotal: 1
      }
    },
    pendingCommandTotal: 7,
    pendingResultTotal: 2,
    pendingRecoveryTotal: 1,
    trackedSessionTotal: 3,
    failureSummary: {
      recentFailedTotal: 1,
      lastFailureAt: 1_000,
      lastFailureCommand: {
        commandId: "cmd-1"
      },
      currentReadHealth: "degraded",
      recentFailureWindowMs: 120_000
    },
    lifecycleSummary: {
      sampleSize: 2,
      statusCounts: {
        completed: 1,
        failed: 1
      }
    }
  });

  assert.deepEqual(snapshot.transport, {
    grade: "healthy",
    reason: "streaming_signal"
  });
  assert.equal(snapshot.queue.historicalFailedTotal, 1);
  assert.equal(snapshot.queue.pendingCommands, 7);
  assert.equal(snapshot.queue.pendingResults, 2);
  assert.equal(snapshot.queue.recentFailedTotal, 1);
  assert.equal(snapshot.queue.currentReadHealth, "degraded");
  assert.equal(snapshot.queue.lifecycleSummary.sampleSize, 2);
  assert.equal(snapshot.preflight.failuresTotal, 2);
  assert.equal(snapshot.preflight.recovery.pendingTotal, 1);
  assert.equal(snapshot.preflight.recovery.recoveredTotal, 4);
  assert.equal(snapshot.sessions.trackedTotal, 3);
});

test("buildRuntimeOpsSnapshot assembles the runtime ops response without touching live stores", () => {
  const snapshot = buildRuntimeOpsSnapshot({
    now: 2_000,
    config: {
      activeWindowMs: 1_000,
      retentionMs: 5_000,
      pruneIntervalMs: 250,
      commandTimeoutMs: 30_000
    },
    failureSummary: {
      currentReadHealth: "degraded",
      recentFailedTotal: 2,
      lastFailureAt: 1_800,
      lastFailureCommand: {
        commandId: "cmd-fail"
      },
      recentFailureWindowMs: 120_000
    },
    historicalFailedTotal: 5,
    sessionDiagnostics: {
      summary: {
        total: 2,
        live: 1,
        registered: 0,
        stale: 1
      }
    },
    livePluginIds: ["page:1", "page:2"],
    activeSessionResolution: {
      status: "ambiguous",
      primaryPluginId: "page:1"
    },
    pluginUiMetrics: [
      {
        pluginId: "page:1",
        uiMetrics: {
          commandFetches: 3
        }
      }
    ],
    queueDiagnostics: {
      pendingTotal: 1
    },
    transportHealth: {
      grade: "healthy"
    },
    commandReadiness: {
      status: "ready"
    },
    writeReadiness: {
      status: "degraded"
    },
    observabilitySnapshot: {
      queue: {
        pendingCommands: 1
      }
    }
  });

  assert.equal(snapshot.now, 2_000);
  assert.equal(snapshot.currentReadHealth, "degraded");
  assert.equal(snapshot.failures.historicalFailedTotal, 5);
  assert.deepEqual(snapshot.activePlugins, ["page:1", "page:2"]);
  assert.equal(snapshot.activePluginId, "page:1");
  assert.equal(snapshot.sessions.summary.live, 1);
  assert.equal(snapshot.queue.pendingTotal, 1);
  assert.equal(snapshot.transportHealth.grade, "healthy");
  assert.equal(snapshot.commandReadiness.status, "ready");
  assert.equal(snapshot.writeReadiness.status, "degraded");
  assert.equal(snapshot.observability.queue.pendingCommands, 1);
  assert.equal(snapshot.observability.transportHealth.grade, "healthy");
});

test("buildPluginUiMetricsSnapshot projects only sessions with UI metrics", () => {
  const metrics = buildPluginUiMetricsSnapshot([
    {
      pluginId: "page:1",
      state: "live",
      staleMs: 10,
      fileName: "Design A",
      pageName: "Page 1",
      uiMetrics: {
        commandFetches: 3
      },
      selectionCount: 2
    },
    {
      pluginId: "page:2",
      state: "stale",
      staleMs: 500,
      fileName: "Design B",
      pageName: "Page 2",
      uiMetrics: null
    },
    {
      pluginId: "page:3",
      state: "registered",
      staleMs: 0,
      fileName: "Design C",
      pageName: "Page 3",
      uiMetrics: {
        eventDrivenReads: {
          runtime: 4
        }
      }
    }
  ]);

  assert.deepEqual(metrics, [
    {
      pluginId: "page:1",
      state: "live",
      staleMs: 10,
      fileName: "Design A",
      pageName: "Page 1",
      uiMetrics: {
        commandFetches: 3
      }
    },
    {
      pluginId: "page:3",
      state: "registered",
      staleMs: 0,
      fileName: "Design C",
      pageName: "Page 3",
      uiMetrics: {
        eventDrivenReads: {
          runtime: 4
        }
      }
    }
  ]);
});

test("buildPrimaryLiveSessionSnapshot prefers the active resolution primary plugin", () => {
  const liveSnapshots = [
    {
      pluginId: "page:1",
      pageName: "First"
    },
    {
      pluginId: "page:2",
      pageName: "Primary"
    }
  ];

  assert.deepEqual(
    buildPrimaryLiveSessionSnapshot({
      liveSnapshots,
      activeSessionResolution: {
        primaryPluginId: "page:2"
      }
    }),
    {
      pluginId: "page:2",
      pageName: "Primary"
    }
  );
  assert.deepEqual(
    buildPrimaryLiveSessionSnapshot({
      liveSnapshots,
      activeSessionResolution: {
        primaryPluginId: "missing"
      }
    }),
    {
      pluginId: "page:1",
      pageName: "First"
    }
  );
  assert.equal(
    buildPrimaryLiveSessionSnapshot({
      liveSnapshots: [],
      activeSessionResolution: {
        primaryPluginId: "missing"
      }
    }),
    null
  );
});

test("buildLivePluginIdsSnapshot projects plugin ids from live session snapshots", () => {
  assert.deepEqual(
    buildLivePluginIdsSnapshot([
      {
        pluginId: "page:1",
        pageName: "First"
      },
      {
        pluginId: "page:2",
        pageName: "Second"
      },
      null,
      {
        pageName: "Missing plugin id"
      }
    ]),
    ["page:1", "page:2"]
  );

  assert.deepEqual(buildLivePluginIdsSnapshot(null), []);
});

test("buildRecentTransportActivitySnapshot summarizes recent websocket and fallback signals", () => {
  const now = 10_000;
  const snapshot = buildRecentTransportActivitySnapshot({
    now,
    windowMs: 1_000,
    recentRuntimeEvents: [
      {
        at: new Date(now - 100).toISOString(),
        event: "ws.command.ack"
      },
      {
        at: new Date(now - 200).toISOString(),
        event: "ws.plugin.command.result"
      },
      {
        at: new Date(now - 300).toISOString(),
        event: "command.delivered",
        payload: {
          delivery: "polling"
        }
      },
      {
        at: new Date(now - 400).toISOString(),
        event: "command.delivered",
        payload: {
          delivery: "websocket"
        }
      },
      {
        at: new Date(now - 2_000).toISOString(),
        event: "ws.command.ack"
      },
      {
        at: "not-a-date",
        event: "ws.command.result"
      }
    ]
  });

  assert.deepEqual(snapshot, {
    windowMs: 1_000,
    recentWsAckTotal: 1,
    recentWsResultTotal: 1,
    recentFallbackTotal: 1,
    recentDeliveredTotal: 2,
    recentSignalTotal: 3,
    fallbackRate: 0.3333
  });
});

test("buildTransportHealthSnapshot assembles transport grade, counters, and trend", () => {
  const snapshot = buildTransportHealthSnapshot({
    recent: {
      windowMs: 120_000,
      recentWsAckTotal: 2,
      recentWsResultTotal: 1,
      recentFallbackTotal: 0,
      recentDeliveredTotal: 3,
      recentSignalTotal: 3,
      fallbackRate: 0
    },
    transportCounters: {
      wsDispatchAttemptedTotal: 10,
      wsDispatchedTotal: 10,
      wsDispatchFailedTotal: 0,
      wsAckTotal: 9,
      wsResultTotal: 9,
      wsInboundRequestTotal: 0,
      wsInboundAcceptedTotal: 0,
      wsInboundResultTotal: 0,
      wsInboundErrorTotal: 0,
      pollingDeliveredTotal: 0,
      pollingFallbackAfterWsDispatchTotal: 0,
      pollingDeferredByWsGuardTotal: 0,
      pollingDeferredByReadyCapTotal: 0,
      pollingDeferredByPolicyBlockTotal: 0
    },
    activeSseClients: 1,
    activeWsClients: 1,
    activeLivePluginCount: 1,
    recentRuntimeEventTotal: 12
  });

  assert.equal(snapshot.grade, "healthy");
  assert.equal(snapshot.summary, "스트리밍 연결이 안정적입니다.");
  assert.deepEqual(snapshot.activeClients, {
    sse: 1,
    ws: 1,
    total: 2
  });
  assert.equal(snapshot.recentRuntimeEventTotal, 12);
  assert.equal(snapshot.fallbackRate, 0);
  assert.equal(snapshot.fallbackPressureRate, 0);
  assert.equal(snapshot.wsDispatchSuccessRate, 0.9);
  assert.deepEqual(snapshot.fallbackIncidenceTrend, {
    windowMs: 120_000,
    recentRate: 0,
    baselineRate: 0,
    deltaRate: 0,
    recentFallbackTotal: 0,
    recentSignalTotal: 3,
    status: "stable"
  });
  assert.equal(snapshot.isolatedFallbackRecoveredOnWs, false);
});

test("buildTransportHealthInputs counts live transport inputs without mutating stores", () => {
  const sseClients = new Set(["sse-1", "sse-2"]);
  const wsClients = new Set(["ws-1"]);
  const pluginSessions = new Map([
    ["live-a", { pluginId: "live-a", marker: "live" }],
    ["stale-b", { pluginId: "stale-b", marker: "stale" }],
    ["live-c", { pluginId: "live-c", marker: "live" }]
  ]);
  const recentRuntimeEvents = [{ event: "a" }, { event: "b" }];
  const seen = [];

  const inputs = buildTransportHealthInputs({
    sseClients,
    wsClients,
    pluginSessions,
    recentRuntimeEvents,
    now: 1_000,
    sessionStateOptions: {
      activeWindowMs: 30_000,
      retentionMs: 120_000
    },
    getSessionState(session, options) {
      seen.push({ session, options });
      return session.marker === "live" ? "live" : "stale";
    }
  });

  assert.deepEqual(inputs, {
    activeSseClients: 2,
    activeWsClients: 1,
    activeLivePluginCount: 2,
    recentRuntimeEventTotal: 2
  });
  assert.equal(sseClients.size, 2);
  assert.equal(wsClients.size, 1);
  assert.equal(pluginSessions.size, 3);
  assert.equal(seen.length, 3);
  assert.deepEqual(seen[0].options, {
    now: 1_000,
    activeWindowMs: 30_000,
    retentionMs: 120_000
  });
});

test("classifyReadHealth and classifyTransportHealth expose stable health grades", () => {
  assert.equal(classifyReadHealth(0), "healthy");
  assert.equal(classifyReadHealth(2), "degraded");
  assert.equal(classifyReadHealth(3), "unhealthy");

  assert.equal(
    classifyTransportHealth({
      recentFailedTotal: 0,
      fallbackRate: 0,
      activeClientTotal: 1,
      recentSignalTotal: 0
    }),
    "healthy"
  );
  assert.equal(
    classifyTransportHealth({
      recentFailedTotal: 0,
      fallbackRate: 0,
      activeClientTotal: 0,
      recentSignalTotal: 0
    }),
    "standby"
  );
  assert.equal(
    classifyTransportHealth({
      recentFailedTotal: 3,
      fallbackRate: 0,
      activeClientTotal: 1,
      recentSignalTotal: 1
    }),
    "unhealthy"
  );
});

test("classifyCommandFailureCode preserves runtime error codes only for the supplied class", () => {
  class TestRuntimeError extends Error {
    constructor(code) {
      super(code);
      this.code = code;
    }
  }

  assert.equal(
    classifyCommandFailureCode(new TestRuntimeError("ERR_SEARCH_NODES_TIMEOUT"), {
      runtimeErrorClass: TestRuntimeError
    }),
    "ERR_SEARCH_NODES_TIMEOUT"
  );
  assert.equal(
    classifyCommandFailureCode({ code: "ERR_DUCK_TYPED" }, { runtimeErrorClass: TestRuntimeError }),
    "ERR_COMMAND_FAILED"
  );
  assert.equal(classifyCommandFailureCode(new Error("plain")), "ERR_COMMAND_FAILED");
});

test("trimRecentFailureEntries drops old entries and keeps the newest history window", () => {
  const entries = [
    { at: 50, code: "old" },
    { at: 90, code: "within-but-trimmed" },
    { at: 110, code: "kept-a" },
    { at: 120, code: "kept-b" },
    { at: 130, code: "kept-c" }
  ];

  const trimmed = trimRecentFailureEntries(entries, {
    now: 150,
    windowMs: 60,
    historyLimit: 3
  });

  assert.deepEqual(trimmed.map((entry) => entry.code), ["kept-a", "kept-b", "kept-c"]);
  assert.notEqual(trimmed, entries);
});

test("trimCommandLifecycleEntries keeps only the newest bounded lifecycle entries", () => {
  const entries = [
    { commandId: "a" },
    { commandId: "b" },
    { commandId: "c" },
    { commandId: "d" }
  ];

  assert.deepEqual(
    trimCommandLifecycleEntries(entries, { limit: 2 }).map((entry) => entry.commandId),
    ["c", "d"]
  );
  assert.deepEqual(trimCommandLifecycleEntries(entries, { limit: 0 }), [{ commandId: "d" }]);
});

test("buildCommandReadinessSnapshot reports guarded websocket ack grace as ready", () => {
  const snapshot = buildCommandReadinessSnapshot({
    activePluginCount: 1,
    activePendingRecoveryCount: 0,
    ignoredRecoveryTotal: 0,
    failureSummary: {
      currentReadHealth: "healthy",
      lastFailureCommand: null
    },
    queueDiagnostics: {
      pendingTotal: 1,
      undeliveredTotal: 1,
      awaitingWsAckTotal: 1,
      oldestAwaitingWsAckMs: 250,
      deferredByWsGuard: 0,
      oldestUndeliveredMs: 250,
      maxUndeliveredTimeoutRatio: 0.1,
      minUndeliveredTimeoutBudgetMs: 30000,
      minUndeliveredTimeRemainingMs: 29750,
      nearTimeoutRatio: 0.65,
      lifecycleSummary: {
        sampleSize: 0,
        timing: {}
      }
    },
    defaults: {
      toolTimeoutMs: 30000,
      nearTimeoutRatio: 0.65,
      wsAckGuardWindowMs: 1200
    }
  });

  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.reason, "ready_ws_ack_grace");
  assert.equal(snapshot.onlyGuardedUndeliveredPending, true);
  assert.equal(snapshot.withinGuardedWsWindow, true);
});

test("buildWriteReadinessSnapshot reports write expiry risk separately", () => {
  const snapshot = buildWriteReadinessSnapshot({
    now: 10_000,
    activePluginCount: 1,
    activePendingRecoveryCount: 0,
    failureSummary: {
      currentReadHealth: "healthy"
    },
    queueDiagnostics: {
      nearTimeoutRatio: 0.65,
      writes: {
        pendingTotal: 1,
        undeliveredTotal: 1,
        oldestPendingMs: 1_800,
        oldestUndeliveredMs: 1_800,
        maxUndeliveredTimeoutRatio: 0.7,
        minUndeliveredTimeoutBudgetMs: 2_000,
        minUndeliveredTimeRemainingMs: 200,
        byType: {
          bind_variable: 1
        }
      }
    },
    primaryLiveSession: {
      staleMs: 25,
      registeredAt: 1_000
    },
    recentWriteFailure: null,
    lastSuccessfulWriteAt: null,
    defaults: {
      nearTimeoutRatio: 0.65,
      writePendingBacklogThresholdMs: 2_000,
      writeHeartbeatGapDegradedMs: 6_000,
      isBatchWriteCommandType: () => false
    }
  });

  assert.equal(snapshot.status, "degraded");
  assert.equal(snapshot.reason, "write_queue_expiry_risk");
  assert.equal(snapshot.pendingWriteCount, 1);
  assert.deepEqual(snapshot.pendingWriteByType, { bind_variable: 1 });
});

test("buildWriteReadinessInputs selects latest write success and in-window write failure", () => {
  const inputs = buildWriteReadinessInputs({
    now: 1_000,
    recentCommandLifecycles: [
      { type: "bind_variable", status: "completed", completedAt: 100 },
      { type: "get_selection", status: "completed", completedAt: 200 },
      { type: "bulk_bind_variables", status: "completed", completedAt: 300 }
    ],
    recentCommandFailures: [
      { type: "bind_variable", at: 100, code: "ERR_OLD_WRITE" },
      { type: "get_selection", at: 950, code: "ERR_READ" },
      { type: "bulk_update_texts", at: 960, code: "ERR_RECENT_WRITE" }
    ],
    failureWindowMs: 100,
    isWriteCommandType: (type) =>
      type === "bind_variable" ||
      type === "bulk_bind_variables" ||
      type === "bulk_update_texts"
  });

  assert.equal(inputs.lastSuccessfulWriteAt, 300);
  assert.equal(inputs.recentWriteFailure.code, "ERR_RECENT_WRITE");
});

test("buildPendingCommandAgeBuckets groups pending command ages", () => {
  const buckets = buildPendingCommandAgeBuckets(
    [
      { createdAt: 9_900 },
      { createdAt: 9_500 },
      { createdAt: 7_000 },
      { createdAt: 1_000 }
    ],
    10_000
  );

  assert.deepEqual(buckets, {
    lt250ms: 1,
    ms250to1000: 1,
    ms1000to5000: 1,
    gte5000ms: 1
  });
});

test("buildQueueDiagnosticsSnapshot summarizes pending read and write commands", () => {
  const diagnostics = buildQueueDiagnosticsSnapshot({
    now: 10_000,
    pendingCommands: [
      {
        pluginId: "page:1",
        type: "get_node_details",
        createdAt: 9_000,
        deliveredAt: null,
        timeoutMs: 30_000,
        awaitingWsAck: true,
        canDelayPollingFallback: true
      },
      {
        pluginId: "page:1",
        type: "bind_variable",
        createdAt: 8_000,
        deliveredAt: null,
        timeoutMs: 2_500,
        awaitingWsAck: false,
        canDelayPollingFallback: true
      }
    ],
    pendingResultsTotal: 1,
    lifecycleTail: [{ commandId: "cmd-2", status: "completed" }],
    lifecycleSummary: { sampleSize: 1 },
    commandTimelineTail: [{ commandId: "cmd-2", type: "bind_variable" }],
    runtimeQueueCounters: {
      writeCoalescedBatchTotal: 2,
      writeCoalescedRequestTotal: 5,
      writeCoalescedSavedCommandTotal: 3
    },
    defaults: {
      toolTimeoutMs: 30_000,
      nearTimeoutRatio: 0.65,
      pollingFallbackMode: "recovery_only",
      wsPollingFallbackGraceMs: 300,
      wsPollingFallbackQueuePressureThreshold: 3,
      fallbackMultipliers: {
        critical: 0.2,
        interactive: 0.4,
        standard: 0.8,
        detail: 1
      }
    },
    helpers: {
      isWriteCommandType: (type) => type === "bind_variable",
      shouldDelayPollingFallbackForWs: (command) => command.type === "bind_variable",
      resolvePollingFallbackClass: () => "standard",
      resolveAdaptivePollingFallbackMultiplier: () => ({ tuningMode: "base" })
    }
  });

  assert.equal(diagnostics.pendingTotal, 2);
  assert.equal(diagnostics.pendingResultsTotal, 1);
  assert.equal(diagnostics.undeliveredTotal, 2);
  assert.equal(diagnostics.awaitingWsAckTotal, 1);
  assert.equal(diagnostics.deferredByWsGuard, 1);
  assert.equal(diagnostics.writes.pendingTotal, 1);
  assert.equal(diagnostics.writes.byType.bind_variable, 1);
  assert.equal(diagnostics.byPlugin["page:1"].pendingTotal, 2);
  assert.equal(diagnostics.writeCoalescing.batchTotal, 2);
  assert.deepEqual(diagnostics.lifecycleTail, [{ commandId: "cmd-2", status: "completed" }]);
});

test("buildCommandLifecycleSummary aggregates timing and expired commands", () => {
  const summary = buildCommandLifecycleSummary([
    {
      commandId: "cmd-1",
      pluginId: "page:1",
      type: "get_node_details",
      status: "completed",
      createdAt: 100,
      wsDispatchedAt: 150,
      wsAckedAt: 170,
      completedAt: 220
    },
    {
      commandId: "cmd-2",
      pluginId: "page:1",
      type: "bind_variable",
      status: "expired",
      createdAt: 200,
      deliveredAt: 260,
      completedAt: 500,
      timeoutMs: 250,
      ageMs: 300,
      failureCode: "ERR_COMMAND_EXPIRED",
      failureMessage: "Timed out"
    },
    {
      commandId: "cmd-3",
      pluginId: "page:2",
      type: "get_selection",
      status: "failed",
      createdAt: 300,
      completedAt: 310
    }
  ], { pluginId: "page:1" });

  assert.equal(summary.sampleSize, 2);
  assert.deepEqual(summary.statusCounts, { completed: 1, expired: 1 });
  assert.equal(summary.timing.avgEnqueueToDispatchMs, 55);
  assert.equal(summary.timing.avgEnqueueToCompleteMs, 210);
  assert.equal(summary.expired.total, 1);
  assert.deepEqual(summary.expired.byType, { bind_variable: 1 });
  assert.equal(summary.expired.last.commandId, "cmd-2");
});

test("buildCommandTimelineTail returns newest lifecycle entries with durations", () => {
  const tail = buildCommandTimelineTail(
    [
      {
        commandId: "cmd-1",
        pluginId: "page:1",
        type: "get_selection",
        status: "completed",
        createdAt: 100,
        deliveredAt: 130,
        completedAt: 160
      },
      {
        commandId: "cmd-2",
        pluginId: "page:1",
        type: "get_node_details",
        status: "completed",
        createdAt: 200,
        wsDispatchedAt: 240,
        wsAckedAt: 260,
        completedAt: 300
      },
      {
        commandId: "cmd-3",
        pluginId: "page:2",
        type: "search_nodes",
        status: "failed",
        createdAt: 300,
        completedAt: 350
      }
    ],
    { pluginId: "page:1", limit: 1 }
  );

  assert.equal(tail.length, 1);
  assert.equal(tail[0].commandId, "cmd-2");
  assert.equal(tail[0].timestamps.dispatchedAt, 240);
  assert.equal(tail[0].durations.enqueueToDispatchMs, 40);
  assert.equal(tail[0].durations.dispatchToAckMs, 20);
  assert.equal(tail[0].durations.ackToCompleteMs, 40);
  assert.equal(tail[0].durations.enqueueToCompleteMs, 100);
});

test("buildRecentFailureSummary ignores failures recovered by a later successful lifecycle", () => {
  const summary = buildRecentFailureSummary({
    now: 10_000,
    recentFailureWindowMs: 5_000,
    recentCommandFailures: [
      {
        at: 7_000,
        commandId: "failed-before-recovery",
        pluginId: "page:1",
        type: "get_node_details",
        source: "http",
        code: "ERR_COMMAND_EXPIRED",
        message: "expired"
      },
      {
        at: 9_500,
        commandId: "failed-after-recovery",
        pluginId: "page:1",
        type: "search_nodes",
        source: "http",
        code: "ERR_SEARCH_NODES_TIMEOUT",
        message: "timeout"
      }
    ],
    recentCommandLifecycles: [
      {
        commandId: "success",
        pluginId: "page:1",
        type: "get_selection",
        status: "completed",
        completedAt: 8_000
      }
    ]
  });

  assert.equal(summary.recentFailedTotal, 1);
  assert.equal(summary.currentReadHealth, "degraded");
  assert.equal(summary.lastFailureAt, 9_500);
  assert.equal(summary.lastFailureCommand.commandId, "failed-after-recovery");
  assert.equal(summary.recoveredAfterAt, 8_000);
  assert.deepEqual(summary.recoveredAfterCommand, {
    commandId: "success",
    pluginId: "page:1",
    type: "get_selection",
    completedAt: 8_000
  });
});

test("buildCommandLifecycleSnapshot captures command timing and failure metadata", () => {
  const snapshot = buildCommandLifecycleSnapshot(
    {
      commandId: "cmd-1",
      pluginId: "page:1",
      type: "get_node_details",
      source: "http",
      priority: 2,
      createdAt: 1_000,
      deliveredAt: null,
      wsDispatchedAt: 1_050,
      wsAckedAt: 1_080,
      timeoutMs: 30_000,
      deliveryMode: "ws"
    },
    "failed",
    1_200,
    {
      failureCode: "ERR_COMMAND_FAILED",
      failureMessage: "boom"
    }
  );

  assert.deepEqual(snapshot, {
    commandId: "cmd-1",
    pluginId: "page:1",
    type: "get_node_details",
    source: "http",
    priority: 2,
    status: "failed",
    createdAt: 1_000,
    deliveredAt: null,
    wsDispatchedAt: 1_050,
    wsAckedAt: 1_080,
    completedAt: 1_200,
    timeoutMs: 30_000,
    ageMs: 200,
    deliveryMode: "ws",
    failureCode: "ERR_COMMAND_FAILED",
    failureMessage: "boom"
  });
});

test("buildCommandFailureRecord maps expired failures to expired lifecycle status", () => {
  const record = buildCommandFailureRecord({
    command: {
      commandId: "cmd-expired",
      pluginId: "page:1",
      type: "search_nodes",
      source: "http",
      createdAt: 1_000,
      deliveredAt: null,
      timeoutMs: 500
    },
    now: 1_700,
    failureCode: "ERR_COMMAND_EXPIRED",
    failureMessage: "expired"
  });

  assert.equal(record.failure.code, "ERR_COMMAND_EXPIRED");
  assert.equal(record.failure.commandId, "cmd-expired");
  assert.equal(record.lifecycle.status, "expired");
  assert.equal(record.lifecycle.ageMs, 700);
  assert.equal(record.lifecycle.failureMessage, "expired");
});

test("buildCommandLifecycleStateUpdate appends lifecycle snapshots and trims to limit", () => {
  const update = buildCommandLifecycleStateUpdate({
    recentCommandLifecycles: [
      { commandId: "old-a" },
      { commandId: "old-b" }
    ],
    command: {
      commandId: "cmd-new",
      pluginId: "page:1",
      type: "get_selection",
      source: "http",
      createdAt: 1_000
    },
    status: "completed",
    now: 1_100,
    lifecycleLimit: 2
  });

  assert.deepEqual(
    update.recentCommandLifecycles.map((entry) => entry.commandId),
    ["old-b", "cmd-new"]
  );
  assert.equal(update.lifecycle.commandId, "cmd-new");
  assert.equal(update.lifecycle.ageMs, 100);
});

test("buildCommandFailureStateUpdate appends failure and lifecycle entries with window trimming", () => {
  class TestRuntimeError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  const update = buildCommandFailureStateUpdate({
    recentCommandFailures: [
      { at: 50, commandId: "old-failure", code: "ERR_OLD" },
      { at: 120, commandId: "recent-failure", code: "ERR_RECENT" }
    ],
    recentCommandLifecycles: [{ commandId: "old-life" }],
    command: {
      commandId: "cmd-expired",
      pluginId: "page:1",
      type: "search_nodes",
      source: "http",
      createdAt: 100,
      timeoutMs: 50
    },
    error: new TestRuntimeError("ERR_COMMAND_EXPIRED", "expired"),
    now: 170,
    runtimeErrorClass: TestRuntimeError,
    failureWindowMs: 80,
    failureHistoryLimit: 2,
    lifecycleLimit: 2
  });

  assert.deepEqual(
    update.recentCommandFailures.map((entry) => entry.commandId),
    ["recent-failure", "cmd-expired"]
  );
  assert.deepEqual(
    update.recentCommandLifecycles.map((entry) => entry.commandId),
    ["old-life", "cmd-expired"]
  );
  assert.equal(update.record.failure.code, "ERR_COMMAND_EXPIRED");
  assert.equal(update.record.lifecycle.status, "expired");
  assert.equal(update.record.lifecycle.failureMessage, "expired");
});

test("createQueueObservabilityStore owns lifecycle and failure history behind methods", () => {
  class TestRuntimeError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  }

  const store = createQueueObservabilityStore({
    lifecycleLimit: 2,
    failureWindowMs: 100,
    failureHistoryLimit: 2,
    runtimeErrorClass: TestRuntimeError
  });

  store.recordLifecycle({ commandId: "old", type: "get_selection", createdAt: 10 }, "completed", 20);
  store.recordLifecycle({ commandId: "ok", type: "get_selection", createdAt: 30 }, "completed", 40);
  store.recordFailure(
    { commandId: "fail", type: "search_nodes", createdAt: 50 },
    new TestRuntimeError("ERR_COMMAND_EXPIRED", "expired"),
    160
  );

  assert.deepEqual(
    store.getLifecycleEntries().map((entry) => entry.commandId),
    ["ok", "fail"]
  );
  assert.deepEqual(
    store.getFailureEntries().map((entry) => entry.commandId),
    ["fail"]
  );
  assert.equal(store.getFailureSummary(160).lastFailureCommand.commandId, "fail");
  assert.equal(store.getLifecycleSummary().statusCounts.completed, 1);
  assert.equal(store.getLifecycleSummary().statusCounts.expired, 1);
});
