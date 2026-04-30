      const BRIDGE_VERSION = "0.5.62";
      const BRIDGE_ORIGINS = ["http://localhost:3846"];
      const SERVER_FEATURE_LABELS = {
        healthEvents: "상태 자동 알림",
        sse: "실시간 상태 스트림",
        websocket: "실시간 양방향 연결",
        websocketCommandChannel: "실시간 명령 채널",
        httpPollingFallback: "백업 폴링",
        streamingFirst: "실시간 우선",
        healthBroadcast: "상태 변경 즉시 반영",
        eventStreamMirror: "상태 스트림 반영",
        websocketCommandMirror: "WS 명령 반영",
        pollingFallback: "문제 시 폴링 백업"
      };
      const serverStatusEl = document.getElementById("server-status");
      const sessionStatusEl = document.getElementById("session-status");
      const runtimeStatusEl = document.getElementById("runtime-status");
      const reconnectBridgeButton = document.getElementById("reconnect-bridge");
      const reregisterSessionButton = document.getElementById("reregister-session");
      const bridgeToggleButton = document.getElementById("bridge-toggle");
      const bridgeVersionEl = document.getElementById("bridge-version");
      const streamBadgeEl = document.getElementById("stream-badge");
      const refreshSessionsButton = document.getElementById("refresh-sessions");
      const refreshOpsButton = document.getElementById("refresh-ops");
      const refreshDetailButton = document.getElementById("refresh-detail");
      const refreshRealtimeButton = document.getElementById("refresh-realtime");
      const checkWsExperimentButton = document.getElementById("check-ws-experiment");
      const sessionsListEl = document.getElementById("sessions-list");
      const opsGridEl = document.getElementById("ops-grid");
      const detailGridEl = document.getElementById("detail-grid");
      const realtimeGridEl = document.getElementById("realtime-grid");
      const actionHelpEl = document.getElementById("action-help");
      const diagnosticModalEl = document.getElementById("diagnostic-modal");
      const diagnosticModalTitleEl = document.getElementById("diagnostic-modal-title");
      const diagnosticModalSubtitleEl = document.getElementById("diagnostic-modal-subtitle");
      const diagnosticModalBodyEl = document.getElementById("diagnostic-modal-body");
      const primaryActionDescEl = document.getElementById("primary-action-desc");
      const primaryActionButton = document.getElementById("primary-action-btn");
      const quickCommandsEl = document.getElementById("quick-commands");
      const guidedStepsEl = document.getElementById("guided-steps");
      const designerContextGridEl = document.getElementById("designer-context-grid");
      const designerChatMetaEl = document.getElementById("designer-chat-meta");
      const designerMessagesEl = document.getElementById("designer-messages");
      const designerInputEl = document.getElementById("designer-input");
      const designerAddContextButton = document.getElementById("designer-add-context");
      const designerSubmitButton = document.getElementById("designer-submit");
      const designerSendButton = document.getElementById("designer-send");
      const designerHandoffButton = document.getElementById("designer-handoff");
      const designerIntentPreviewEl = document.getElementById("designer-intent-preview");
      const designerIntentMetaEl = document.getElementById("designer-intent-meta");
      const designerReadPlanPreviewEl = document.getElementById("designer-read-plan-preview");
      const designerReadPlanMetaEl = document.getElementById("designer-read-plan-meta");
      const designerSuggestionPreviewEl = document.getElementById("designer-suggestion-preview");
      const designerSuggestionMetaEl = document.getElementById("designer-suggestion-meta");
      const designerSuggestionActionsMetaEl = document.getElementById("designer-suggestion-actions-meta");
      const designerSuggestionActionsListEl = document.getElementById("designer-suggestion-actions-list");
      const designerHandoffPreviewEl = document.getElementById("designer-handoff-preview");
      const designerHandoffMetaEl = document.getElementById("designer-handoff-meta");
      const designerHandoffLogMetaEl = document.getElementById("designer-handoff-log-meta");
      const designerHandoffLogListEl = document.getElementById("designer-handoff-log-list");
      const designerRefreshHandoffsButton = document.getElementById("designer-refresh-handoffs");
      const WINDOW_SIZE_PRESETS = {
        l: { width: 520, height: 760 }
      };
      let bridgeOrigin = null;
      let pollSchedulerTimer = null;
      let bootstrapRetryTimer = null;
      let pluginId = null;
      let pluginLabel = "플러그인 세션 대기 중";
      let pendingSelection = [];
      let lastPollAt = null;
      let inFlightPoll = false;
      let readyTimer = null;
      let bridgeConnected = false;
      let sessionRegistered = false;
      let needsReconnect = false;
      let needsReregister = false;
      let autoRecoverTimer = null;
      let autoRecoverTickTimer = null;
      let autoRecoverDueAt = null;
      let autoRecoverAttempts = 0;
      let currentFileName = "연결된 파일 없음";
      let currentPageLabel = "연결된 페이지 없음";
      let currentPageId = null;
      let healthLatencyMs = null;
      let lastPollLatencyMs = null;
      let pollRequestCount = 0;
      let pollCommandFetchCount = 0;
      let pollRuntimeRefreshCount = 0;
      let pollDetailRefreshCount = 0;
      let serverHealthSnapshot = null;
      let lastSessionSyncAt = null;
      let lastPageSyncAt = null;
      let bridgeEnabled = true;
      let sessionsSnapshot = [];
      let serverErrorCode = null;
      let latestServerDiagnosticGroups = [];
      let primaryActionHandler = null;
      let primaryActionKey = null;
      let runtimeState = "idle";
      let runtimeErrorCode = null;
      let runtimeLastCommandType = "대기";
      let runtimeLastCommandId = null;
      let runtimeLastUpdatedAt = null;
      let runtimeLastMessage = "아직 실행 기록이 없습니다.";
      let runtimeGuidance = "";
      let runtimePreflightOk = true;
      const AUTO_RECOVER_DELAY_MS = 3000;
      const POLL_INTERVALS_MS = {
        active: 900,
        idle: 2200,
        standby: 6500,
        waitingSession: 1400,
        stale: 5000,
        backoffBase: 2000,
        backoffMax: 20000
      };
      const ACTIVE_POLL_GRACE_MS = 12000;
      let pollConsecutiveFailures = 0;
      let currentPollIntervalMs = POLL_INTERVALS_MS.idle;
      let lastCommandActivityAt = 0;
      let recoveryPhase = "stable";
      let recoveryInFlight = false;
      let activeWindowSize = "l";
      let runtimeOpsSnapshot = null;
      let lastRuntimeOpsSyncAt = null;
      let lastRuntimeOpsFetchAt = 0;
      let selectedNodeDetails = null;
      let selectedNodeDetailsSyncAt = null;
      let detailRequestToken = 0;
      let detailFetchInFlight = false;
      let detailLastRequestedNodeId = null;
      let eventsSource = null;
      let eventsConnected = false;
      let eventsLastAt = null;
      let eventsLastAtMs = null;
      let eventsReconnectTimer = null;
      let eventsLastSequence = null;
      let eventsRefreshDebounceTimer = null;
      let eventsRefreshPending = {
        sessions: false,
        runtimeOps: false,
        detail: false
      };
      let eventsLastError = null;
      let eventsLastEventName = null;
      let eventsTotalCount = 0;
      let eventDrivenSessionRefreshCount = 0;
      let eventDrivenRuntimeRefreshCount = 0;
      let eventDrivenDetailRefreshCount = 0;
      let eventsReconnectDueAt = null;
      let realtimeDebugTicker = null;
      let wsProbeSocket = null;
      let wsProbeTimer = null;
      let wsCommandSocket = null;
      let wsCommandReconnectTimer = null;
      let wsCommandReconnectDueAt = null;
      let wsCommandConnected = false;
      let wsCommandLastAt = null;
      let wsCommandLastAtMs = null;
      let wsCommandLastError = null;
      let wsCommandLastUrl = null;
      let wsCommandLastCommandId = null;
      let wsCommandMessageCount = 0;
      let wsCommandAckedCount = 0;
      let pluginHeartbeatTimer = null;
      let pluginHeartbeatInFlight = false;
      const commandTransportById = new Map();
      let wsExperimentState = "idle";
      let wsExperimentLastAt = null;
      let wsExperimentLastAtMs = null;
      let wsExperimentLastError = null;
      let wsExperimentLastCode = null;
      let wsExperimentLastReason = null;
      let wsExperimentLastUrl = null;
      let wsExperimentAttempts = 0;
      let wsExperimentMessageCount = 0;
      let wsExperimentHelloSeen = false;
      let wsExperimentSessionEventSeen = false;
      let wsExperimentCommandEventSeen = false;
      let wsExperimentLastMessageType = null;
      let wsExperimentFallbackRecommendation = "WS 실험 결과 전까지 SSE/HTTP 폴백 유지";
      let wsExperimentChannelMode = "unknown";
      let wsExperimentLastAckStatus = null;
      let wsExperimentLastAckAt = null;
      let wsExperimentLastResultStatus = null;
      let wsExperimentLastResultAt = null;
      let wsExperimentEnabledCommands = [];
      let wsInspectionSupportSeen = false;
      let wsInspectionLastStatus = "unknown";
      let wsInspectionLastAt = null;
      let wsInspectionLastNote = null;
      let wsInspectionReverifyHttpRecommended = true;
      let designerMessageSeeded = false;
      let latestDesignerIntentEnvelope = null;
      let latestDesignerReadExecution = null;
      let latestDesignerSuggestionBundle = null;
      let latestDesignerHandoffPayload = null;
      let latestDesignerHandoffItems = [];
      const STATUS_TREND_LIMIT = 12;
      let transportTrendSamples = [];
      let readinessTrendSamples = [];
      let routeTimelineSamples = [];
      let latencyTrendSamples = [];
      const RUNTIME_OPS_MIN_REFRESH_MS = 4000;
      const EVENT_STREAM_RECONNECT_MS = 3000;
      const EVENT_STREAM_REFRESH_DEBOUNCE_MS = 220;
      const WS_EXPERIMENT_PROBE_TIMEOUT_MS = 1800;
      const WS_COMMAND_RECONNECT_MS = 1800;
      const PLUGIN_HEARTBEAT_INTERVAL_MS = 5000;

      function escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function requestResizeWindow(sizeKey) {
        const preset = WINDOW_SIZE_PRESETS[sizeKey];
        if (!preset) {
          return;
        }
        activeWindowSize = sizeKey;
        parent.postMessage(
          {
            pluginMessage: {
              type: "resize_ui",
              width: preset.width,
              height: preset.height,
              sizeKey
            }
          },
          "*"
        );
      }

      function appendDesignerMessage(role, text) {
        if (!designerMessagesEl) {
          return;
        }
        designerMessagesEl.insertAdjacentHTML(
          "beforeend",
          `
            <div class="designer-message ${escapeHtml(role)}">
              ${escapeHtml(text)}
            </div>
          `
        );
        designerMessagesEl.scrollTop = designerMessagesEl.scrollHeight;
      }

      function normalizeDesignerString(value) {
        return String(value || "").trim();
      }

      function normalizeDesignerArray(value) {
        return Array.isArray(value) ? value : [];
      }

      function countDesignerObjectEntries(value) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return 0;
        }
        return Object.keys(value).length;
      }

      function createDesignerRequestId(prefix = "designer") {
        return `${prefix}_${Date.now().toString(36)}`;
      }

      function inferDesignerIntentKindFromPrompt(input = "") {
        const normalized = normalizeDesignerString(input).toLowerCase();
        if (!normalized) {
          return "analyze";
        }
        if (/(구현|react|vue|code|코드)/.test(normalized)) {
          return "prepare_implementation_handoff";
        }
        if (/(카피|문구|텍스트|copy)/.test(normalized)) {
          return "revise_copy";
        }
        if (/(타이포|폰트|typography)/.test(normalized)) {
          return "refine_typography";
        }
        if (/(간격|spacing|정렬|align|layout|레이아웃|재구성)/.test(normalized)) {
          return "restructure_layout";
        }
        if (/(디자인 시스템|component|컴포넌트|variant)/.test(normalized)) {
          return "align_to_design_system";
        }
        if (/(생성|만들|generate)/.test(normalized)) {
          return "generate_screen";
        }
        return "analyze";
      }

      function summarizeDesignerPrompt(input = "") {
        const normalized = normalizeDesignerString(input);
        if (!normalized) {
          return "디자인 요청 요약 없음";
        }
        if (normalized.length <= 120) {
          return normalized;
        }
        return `${normalized.slice(0, 117)}...`;
      }

      function getDesignerFollowUpLabel(key) {
        if (key === "focused_detail") {
          return "선택 노드 세부 읽기";
        }
        if (key === "asset_lookup") {
          return "디자인 시스템 자산 조회";
        }
        return key || "-";
      }

      function getDesignerReadScopeLabel(scope) {
        if (scope === "selection_first") {
          return "선택 우선";
        }
        if (scope === "frame_first") {
          return "프레임 우선";
        }
        if (scope === "page_generation") {
          return "페이지 생성";
        }
        if (scope === "page_first") {
          return "페이지 우선";
        }
        return "빠른 컨텍스트";
      }

      function getDesignerReadCommandLabel(command) {
        if (command === "get_selection") return "현재 선택 읽기";
        if (command === "get_metadata") return "구조 메타데이터 읽기";
        if (command === "get_node_details") return "노드 세부 읽기";
        if (command === "get_instance_details") return "인스턴스 세부 읽기";
        if (command === "get_component_variant_details") return "컴포넌트/variant 세부 읽기";
        if (command === "list_text_nodes") return "텍스트 노드 읽기";
        if (command === "get_annotations") return "주석 읽기";
        if (command === "search_nodes") return "노드 검색";
        if (command === "search_design_system") return "디자인 시스템 검색";
        if (command === "search_file_components") return "파일 컴포넌트 검색";
        if (command === "search_library_assets") return "라이브러리 자산 검색";
        if (command === "search_instances") return "인스턴스 검색";
        if (command === "get_variable_defs") return "변수/스타일 사용 읽기";
        if (command === "snapshot_selection") return "선택 스냅샷";
        return command || "-";
      }

      function buildUiDesignerReadPlan(intentKind, designerContext, contextScope = {}) {
        const selectionTypes = normalizeDesignerArray(designerContext?.fastContext?.selectionTypes).map((value) =>
          normalizeDesignerString(value).toUpperCase()
        );
        const assetLookup = designerContext?.assetLookup || {};
        const phases = [
          {
            phase: "fast_context",
            summary: "현재 파일, 페이지, 선택을 빠르게 읽습니다.",
            commands: ["get_selection", "get_metadata"]
          }
        ];

        const needsFocusedDetail =
          [
            "critique",
            "restructure_layout",
            "improve_hierarchy",
            "adjust_spacing",
            "refine_typography",
            "revise_copy",
            "swap_or_recommend_component",
            "adapt_variant",
            "prepare_implementation_handoff"
          ].includes(intentKind) ||
          contextScope.targetType === "current_selection";

        if (needsFocusedDetail) {
          const focusedCommands = [];
          if (selectionTypes.includes("INSTANCE")) {
            focusedCommands.push("get_instance_details");
          }
          if (
            selectionTypes.includes("COMPONENT") ||
            selectionTypes.includes("COMPONENT_SET") ||
            intentKind === "adapt_variant"
          ) {
            focusedCommands.push("get_component_variant_details");
          }
          focusedCommands.push("get_node_details");
          if (intentKind === "revise_copy" || intentKind === "refine_typography") {
            focusedCommands.push("list_text_nodes");
          }
          if (intentKind === "revise_copy" || intentKind === "prepare_implementation_handoff") {
            focusedCommands.push("get_annotations");
          }
          phases.push({
            phase: "focused_detail",
            summary: "선택된 대상의 구조와 세부 속성을 더 깊게 읽습니다.",
            commands: [...new Set(focusedCommands)]
          });
        }

        const needsAssetLookup =
          [
            "swap_or_recommend_component",
            "generate_section",
            "generate_screen",
            "adapt_variant",
            "align_to_design_system",
            "prepare_implementation_handoff"
          ].includes(intentKind) || Boolean(assetLookup.shouldLookup);

        if (needsAssetLookup) {
          const assetCommands = ["search_design_system"];
          if (
            intentKind === "align_to_design_system" ||
            intentKind === "swap_or_recommend_component"
          ) {
            assetCommands.push("search_file_components", "search_instances");
          }
          if (
            intentKind === "swap_or_recommend_component" ||
            intentKind === "adapt_variant" ||
            Number(assetLookup?.availableHints?.libraryCount || 0) > 0
          ) {
            assetCommands.push("search_library_assets");
          }
          if (
            intentKind === "align_to_design_system" ||
            Number(assetLookup?.availableHints?.tokenCount || 0) > 0
          ) {
            assetCommands.push("get_variable_defs");
          }
          phases.push({
            phase: "asset_lookup",
            summary: "기존 토큰, 컴포넌트, 라이브러리 자산을 조회합니다.",
            commands: [...new Set(assetCommands)]
          });
        }

        if (intentKind === "generate_section" || intentKind === "generate_screen") {
          phases.push({
            phase: "optional_snapshot",
            summary: "필요한 경우에만 스냅샷으로 구조 참조를 보강합니다.",
            commands: ["snapshot_selection"],
            optional: true
          });
        }

        return {
          intentKind,
          primaryPhase: phases[0]?.phase || "fast_context",
          phases,
          commands: [...new Set(phases.flatMap((phase) => phase.commands))],
          largeFileSafe: true,
          doNotFullScanByDefault: true
        };
      }

      function buildSummarizedDesignerContext(requestText = "") {
        const selection = normalizeDesignerArray(pendingSelection).map((item, index) => ({
          id: item?.id || `selection_${index}`,
          name: item?.name || `Selection ${index + 1}`,
          type: item?.type || null
        }));
        const detailPayload =
          selectedNodeDetails &&
          selection.length > 0 &&
          selectedNodeDetails.targetNodeId === selection[0]?.id
            ? selectedNodeDetails
            : null;
        const detail = detailPayload?.detail || {};
        const node = detail.node || {};
        const layout = detail.layout || {};
        const sourceComponent = detail.sourceComponent || {};
        const componentHints = [];
        const tokenHints = [];
        const libraryHints = [];
        const requestLower = normalizeDesignerString(requestText).toLowerCase();
        const detailAvailable = Boolean(detailPayload && !detailPayload.error);
        const sourceComponentHint =
          sourceComponent.name || sourceComponent.componentSetName || sourceComponent.id || sourceComponent.componentSetId || "";
        if (sourceComponentHint) {
          componentHints.push(sourceComponentHint);
        }
        if (countDesignerObjectEntries(detail.variantProperties) > 0) {
          componentHints.push("variant_properties_in_use");
        }
        const requiresAssetLookup =
          /(design system|component|variant|token|style|library|디자인 시스템|컴포넌트|토큰|스타일|라이브러리)/.test(requestLower) ||
          componentHints.length > 0 ||
          tokenHints.length > 0 ||
          libraryHints.length > 0;
        const targetType =
          selection.length > 0 ? "current_selection" : currentPageId ? "current_page" : "current_file";
        const readScope = selection.length > 0 ? "selection_first" : "page_first";
        const followUps = [];
        if (selection.length > 0) {
          followUps.push("focused_detail");
        }
        if (requiresAssetLookup) {
          followUps.push("asset_lookup");
        }
        const selectionSummary =
          selection.length > 0
            ? selection.length === 1
              ? `${selection[0].name} 선택됨`
              : `${selection.length}개 선택됨`
            : "선택 없음";
        const headline =
          selection.length > 0
            ? detailAvailable && (node.type || selection[0].type)
              ? `${selectionSummary} · ${(node.type || selection[0].type)} 기준 요약`
              : `${selectionSummary} · 선택 우선 요약`
            : `${currentPageLabel} 페이지 요약`;

        return {
          fileName: currentFileName,
          fileId: pluginId || null,
          pageId: currentPageId || null,
          pageName: currentPageLabel,
          selection,
          selectionSummary,
          libraryHints,
          tokenHints,
          componentHints,
          selectedNodeDetails: detailPayload,
          designerContext: {
            version: "1.0",
            headline,
            target: {
              type: targetType,
              label:
                selection.length > 0
                  ? selectionSummary
                  : currentPageLabel || currentFileName || "현재 컨텍스트",
              ids: selection.map((item) => item.id),
              selectionCount: selection.length
            },
            fastContext: {
              fileName: currentFileName,
              pageName: currentPageLabel,
              selectionSummary,
              selectionTypes: selection.map((item) => item.type).filter(Boolean),
              frameName: selection.length === 1 ? selection[0].name : null
            },
            focusedDetail: detailAvailable
              ? {
                  status: "available",
                  nodeType: node.type || selection[0]?.type || null,
                  layoutMode: layout.layoutMode || null,
                  itemSpacing: Number.isFinite(layout.itemSpacing) ? layout.itemSpacing : null,
                  sourceComponentName: sourceComponentHint || null,
                  variantPropertyCount: countDesignerObjectEntries(detail.variantProperties),
                  componentPropertyCount: countDesignerObjectEntries(detail.componentProperties),
                  fallbackUsed: Boolean(detailPayload?.fallbackUsed),
                  truncated: Boolean(detailPayload?.truncated)
                }
              : {
                  status: selection.length > 0 ? "pending" : "not_needed",
                  reason: selection.length > 0 ? "선택 기준 세부 정보 조회 대기" : "선택이 없어 세부 조회 생략"
                },
            assetLookup: {
              shouldLookup: requiresAssetLookup,
              availableHints: {
                libraryCount: libraryHints.length,
                tokenCount: tokenHints.length,
                componentCount: componentHints.length
              },
              hints: {
                libraries: libraryHints,
                tokens: tokenHints,
                components: componentHints
              }
            },
            readStrategy: {
              primaryMode: "fast_context",
              scope: readScope,
              reason:
                selection.length > 0
                  ? "현재 선택을 먼저 요약하고 필요한 경우에만 더 깊게 읽습니다."
                  : "선택이 없으므로 페이지 수준 요약에서 시작합니다.",
              followUps,
              deferredReads: ["full_page_scan", "multi_page_inventory"],
              largeFileSafe: true,
              doNotFullScanByDefault: true
            }
          }
        };
      }

      function getDesignerFigmaContext(requestText = "") {
        return buildSummarizedDesignerContext(requestText);
      }

      function createUiDesignerIntentEnvelope(input = "", mode = "suggest_then_apply") {
        const prompt = normalizeDesignerString(input);
        const figmaContext = getDesignerFigmaContext(prompt);
        const selectionIds = figmaContext.selection.map((item) => item.id);
        const kind = inferDesignerIntentKindFromPrompt(prompt);
        const contextScope = {
          targetType: selectionIds.length > 0 ? "current_selection" : "current_page",
          targetIds: selectionIds,
          pageId: figmaContext.pageId,
          selectionRequired: selectionIds.length > 0,
          selectionMode:
            selectionIds.length > 1 ? "multi" : selectionIds.length === 1 ? "single" : "optional"
        };
        const readPlan = buildUiDesignerReadPlan(kind, figmaContext.designerContext, contextScope);
        const intent = {
          id: `${kind}_${Date.now().toString(36)}`,
          kind,
          objective: summarizeDesignerPrompt(prompt),
          target: {
            type: selectionIds.length > 0 ? "selection" : "page",
            ids: selectionIds,
            name:
              figmaContext.selection.length === 1
                ? figmaContext.selection[0].name
                : selectionIds.length > 1
                  ? `${selectionIds.length} selected nodes`
                  : figmaContext.pageName,
            scopeNote:
              selectionIds.length > 0
                ? "Derived from current selection."
                : "No explicit selection; using page context."
          },
          changeSet: {
            summary: summarizeDesignerPrompt(prompt),
            requestedChange: prompt,
            mode
          },
          constraints: [],
          outputExpectation: {
            mode,
            shouldApplyDirectly: mode === "apply" || mode === "suggest_then_apply"
          },
          rationale: "Plugin UI preview envelope.",
          confidence: prompt ? 0.72 : 0.25,
          applyReadiness: {
            status: prompt ? "draft" : "needs_input",
            missingRequirements: prompt ? [] : ["user_request"]
          }
        };

        return {
          version: "1.0",
          requestId: createDesignerRequestId(),
          conversationId: pluginId || null,
          mode,
          summary: summarizeDesignerPrompt(prompt),
          userGoal: prompt || "디자인 요청 입력 필요",
          designerContext: figmaContext.designerContext,
          readPlan,
          contextScope,
          intents: [intent],
          assumptions:
            selectionIds.length === 0 ? ["현재 페이지 전체를 대상으로 요청했다고 가정했습니다."] : [],
          questions:
            selectionIds.length === 0
              ? ["특정 프레임이나 섹션을 선택하면 더 정확한 제안을 만들 수 있습니다."]
              : [],
          risks: prompt ? [] : ["요청 문장이 비어 있습니다."],
          explanation: "Plugin AI designer preview envelope.",
          executionPolicy: {
            requiresReview: mode !== "apply",
            allowDirectApply: mode === "apply" || mode === "suggest_then_apply"
          }
        };
      }

      function createUiPluginLocalHandoffPayload(intentEnvelope) {
        const figmaContext = getDesignerFigmaContext(intentEnvelope?.userGoal || intentEnvelope?.summary || "");
        const primaryIntent = normalizeDesignerArray(intentEnvelope?.intents)[0] || {};
        const targets = figmaContext.selection.map((node, index) => ({
          nodeId: node.id,
          nodeName: node.name,
          role: index === 0 ? "primary" : "supporting"
        }));

        return {
          version: "0.1",
          handoffId: `handoff_${Date.now().toString(36)}`,
          requestedAt: new Date().toISOString(),
          source: {
            pluginSessionId: pluginId || "plugin_session_pending",
            figmaFileKey: pluginId || "unknown_file",
            figmaFileName: currentFileName || "Unknown Figma File",
            pageId: currentPageId || "unknown_page",
            pageName: currentPageLabel || "Unknown Page"
          },
          intent: {
            mode:
              primaryIntent.kind === "prepare_implementation_handoff"
                ? "implement_selection"
                : "update_existing_code",
            summary:
              normalizeDesignerString(intentEnvelope?.summary) ||
              normalizeDesignerString(primaryIntent.objective) ||
              "Implement Figma-driven request",
            userRequest:
              normalizeDesignerString(intentEnvelope?.userGoal) ||
              normalizeDesignerString(primaryIntent?.changeSet?.requestedChange) ||
              "No user request supplied",
            targets,
            deliverables: ["responsive UI implementation"],
            constraints: normalizeDesignerArray(primaryIntent.constraints)
          },
          figmaContext: {
            selection: {
              nodeIds: targets.map((target) => target.nodeId),
              primaryNodeId: targets[0]?.nodeId || null
            },
            selectionSummary:
              targets.length > 0
                ? `${targets.length}개 선택 노드 구현 컨텍스트`
                : `${currentPageLabel} 페이지 전체 컨텍스트`,
            designSystem: {
              libraryHints: figmaContext.libraryHints,
              tokenHints: figmaContext.tokenHints,
              componentHints: figmaContext.componentHints
            },
            snapshot: {
              included: false
            }
          }
        };
      }

      function renderDesignerIntentPreview(intentEnvelope = null) {
        if (!designerIntentPreviewEl || !designerIntentMetaEl) {
          return;
        }
        if (!intentEnvelope) {
          designerIntentMetaEl.textContent = "draft";
          designerIntentPreviewEl.textContent =
            "요청을 입력하면 AI 디자이너 intent envelope가 여기에 표시됩니다.";
          renderDesignerReadPlanPreview(null);
          renderDesignerSuggestionPreview(null);
          return;
        }
        designerIntentMetaEl.textContent = intentEnvelope.mode || "draft";
        designerIntentPreviewEl.textContent = JSON.stringify(intentEnvelope, null, 2);
        renderDesignerReadPlanPreview(intentEnvelope.readPlan || null);
      }

      function renderDesignerReadPlanPreview(readPlan = null) {
        if (!designerReadPlanPreviewEl || !designerReadPlanMetaEl) {
          return;
        }
        if (!readPlan) {
          designerReadPlanMetaEl.textContent = "idle";
          designerReadPlanPreviewEl.textContent =
            "요청을 정리하면 어떤 읽기 단계가 필요한지 여기에 표시됩니다.";
          return;
        }

        const lines = [
          `intent: ${readPlan.intentKind || "-"}`,
          `primary: ${readPlan.primaryPhase || "-"}`,
          `safe: ${readPlan.largeFileSafe ? "selection-first" : "wide-scan"}`,
          ""
        ];

        normalizeDesignerArray(readPlan.phases).forEach((phase, index) => {
          lines.push(`${index + 1}. ${phase.phase}${phase.optional ? " (optional)" : ""}`);
          lines.push(`   ${phase.summary || ""}`);
          lines.push(
            `   commands: ${normalizeDesignerArray(phase.commands).map(getDesignerReadCommandLabel).join(" · ")}`
          );
        });

        designerReadPlanMetaEl.textContent = readPlan.primaryPhase || "fast_context";
        designerReadPlanPreviewEl.textContent = lines.join("\n");
      }

      function renderDesignerSuggestionPreview(bundle = null) {
        if (!designerSuggestionPreviewEl || !designerSuggestionMetaEl) {
          return;
        }
        if (!bundle) {
          designerSuggestionMetaEl.textContent = "idle";
          designerSuggestionPreviewEl.textContent =
            "읽기 실행이 끝나면 디자이너 제안 초안이 여기에 표시됩니다.";
          renderDesignerSuggestionActions(null);
          return;
        }

        const findings = normalizeDesignerArray(bundle.findings);
        const recommendations = normalizeDesignerArray(bundle.recommendations);
        const risks = normalizeDesignerArray(bundle.risks);
        const lines = [
          `headline: ${bundle.headline || "-"}`,
          `summary: ${bundle.summaryText || "-"}`,
          ""
        ];

        if (findings.length > 0) {
          lines.push("findings:");
          findings.slice(0, 3).forEach((finding, index) => {
            lines.push(`  ${index + 1}. ${finding.label || "-"}`);
            if (finding.detail) {
              lines.push(`     ${finding.detail}`);
            }
          });
          lines.push("");
        }

        if (recommendations.length > 0) {
          lines.push("recommendations:");
          recommendations.slice(0, 3).forEach((item, index) => {
            lines.push(`  ${index + 1}. ${item.title || "-"}`);
            if (item.reason) {
              lines.push(`     ${item.reason}`);
            }
          });
          lines.push("");
        }

        if (risks.length > 0) {
          lines.push("risks:");
          risks.slice(0, 2).forEach((risk, index) => {
            lines.push(`  ${index + 1}. ${risk}`);
          });
          lines.push("");
        }

        const previewSummary = bundle.actionPreviewBundle?.summary || null;
        if (previewSummary) {
          lines.push("apply preview:");
          lines.push(
            `  candidates ${previewSummary.actionCount || 0} · confirm ${previewSummary.readyTotal || 0} · blocked ${previewSummary.blockedTotal || 0}`
          );
        }

        designerSuggestionMetaEl.textContent = bundle.intentKind || "ready";
        designerSuggestionPreviewEl.textContent = lines.join("\n").trim();
        renderDesignerSuggestionActions(bundle);
      }

      function renderDesignerSuggestionActions(bundle = null) {
        if (!designerSuggestionActionsListEl || !designerSuggestionActionsMetaEl) {
          return;
        }
        if (!bundle) {
          designerSuggestionActionsMetaEl.textContent = "아직 추천 액션이 없습니다.";
          designerSuggestionActionsListEl.innerHTML = `
            <div class="designer-suggestion-action-item">
              <div class="designer-suggestion-action-title">읽기 실행 대기 중</div>
              <div class="designer-suggestion-action-meta">디자인 제안 시작 후 추천 액션 후보가 표시됩니다.</div>
            </div>
          `;
          return;
        }

        const actions = normalizeDesignerArray(bundle.applyActions);
        const actionPreviews = normalizeDesignerArray(bundle.actionPreviewBundle?.previews);
        const previewByActionId = new Map(
          actionPreviews
            .filter((preview) => preview?.actionId || preview?.id)
            .map((preview) => [preview.actionId || preview.id, preview])
        );
        if (actions.length === 0) {
          designerSuggestionActionsMetaEl.textContent = "추천 액션 없음";
          designerSuggestionActionsListEl.innerHTML = `
            <div class="designer-suggestion-action-item">
              <div class="designer-suggestion-action-title">추천 액션을 만들지 못했습니다.</div>
              <div class="designer-suggestion-action-meta">현재 컨텍스트로는 추가 확인이 더 필요합니다.</div>
            </div>
          `;
          return;
        }

        const previewSummary = bundle.actionPreviewBundle?.summary || {};
        const readyTotal = Number(previewSummary.readyTotal || 0);
        const blockedTotal = Number(previewSummary.blockedTotal || 0);
        designerSuggestionActionsMetaEl.textContent =
          `현재 ${actions.length}개 액션 후보 · 확인 후 적용 ${readyTotal} · 보류 ${blockedTotal}`;
        designerSuggestionActionsListEl.innerHTML = actions
          .map((action) => {
            const preview = previewByActionId.get(action.id) || null;
            const blockers = normalizeDesignerArray(preview?.blockers);
            const intendedEdits = normalizeDesignerArray(preview?.preview?.intendedEdits);
            const readinessLabel = preview?.readiness === "needs_confirmation"
              ? "확인 후 적용 가능"
              : preview?.readiness === "handoff_ready"
                ? "구현 요청 가능"
                : preview?.readiness === "blocked"
                  ? "보류"
                  : "제안만";
            return `
              <div class="designer-suggestion-action-item">
                <div class="designer-suggestion-action-title">${escapeHtml(action.label || action.actionType || "추천 액션")}</div>
                <div class="designer-suggestion-action-meta">
                  <div>상태: ${escapeHtml(readinessLabel)}</div>
                  <div>대상: ${escapeHtml(preview?.preview?.target || action.targetNodeId || "선택 필요")}</div>
                  <div>범위: ${escapeHtml(preview?.preview?.scope || action.actionType || "-")}</div>
                  ${intendedEdits.length > 0 ? `<div>할 일: ${escapeHtml(intendedEdits.slice(0, 2).join(" · "))}</div>` : ""}
                  ${blockers.length > 0 ? `<div>막힌 이유: ${escapeHtml(blockers.map((blocker) => blocker.label).join(" · "))}</div>` : ""}
                </div>
              </div>
            `;
          })
          .join("");
      }

      function renderDesignerHandoffPreview(payload = null) {
        if (!designerHandoffPreviewEl || !designerHandoffMetaEl) {
          return;
        }
        if (!payload) {
          designerHandoffMetaEl.textContent = "idle";
          designerHandoffPreviewEl.textContent =
            "로컬 구현 요청을 보내면 handoff payload preview가 여기에 표시됩니다.";
          return;
        }
        designerHandoffMetaEl.textContent = payload.intent?.mode || "ready";
        designerHandoffPreviewEl.textContent = JSON.stringify(payload, null, 2);
      }

      function applyDesignerHandoffState(entry, eventName = "handoff.updated") {
        if (!entry || typeof entry !== "object") {
          return;
        }
        latestDesignerHandoffPayload = entry.payload && typeof entry.payload === "object"
          ? entry.payload
          : {
              ...latestDesignerHandoffPayload,
              ...(entry.intent ? { intent: entry.intent } : {}),
              ...(entry.figmaContext ? { figmaContext: entry.figmaContext } : {}),
              handoffId: entry.handoffId || latestDesignerHandoffPayload?.handoffId,
              requestedAt: entry.receivedAt || latestDesignerHandoffPayload?.requestedAt
            };
        renderDesignerHandoffPreview(latestDesignerHandoffPayload);
        if (designerHandoffMetaEl) {
          designerHandoffMetaEl.textContent = entry.status || eventName;
        }

        if (eventName === "handoff.created") {
          appendDesignerMessage(
            "system",
            `로컬 구현 요청이 큐에 들어갔습니다. handoffId ${entry.handoffId || "-"}`
          );
          return;
        }

        if (eventName === "handoff.claimed") {
          appendDesignerMessage(
            "system",
            `로컬 구현 에이전트가 작업을 가져갔습니다. worker ${entry.claimedBy?.workerId || "-"}`
          );
          return;
        }

        if (eventName === "handoff.completed") {
          const changedFiles = Array.isArray(entry.completion?.result?.changedFiles)
            ? entry.completion.result.changedFiles.join(", ")
            : null;
          const tests = Array.isArray(entry.completion?.result?.tests)
            ? entry.completion.result.tests.join(", ")
            : null;
          const execution = entry.completion?.result?.execution || null;
          const execLabel = execution?.command
            ? ` · exec: ${execution.command}${execution.exitCode !== null && execution.exitCode !== undefined ? ` (${execution.exitCode})` : ""}`
            : "";
          appendDesignerMessage(
            "system",
            `로컬 구현 작업이 완료되었습니다. ${entry.completion?.summary || entry.intent?.summary || "결과 요약 없음"}${changedFiles ? ` · changed: ${changedFiles}` : ""}${tests ? ` · tests: ${tests}` : ""}${execLabel}`
          );
        }
      }

      function renderDesignerHandoffLog(items = []) {
        if (!designerHandoffLogListEl || !designerHandoffLogMetaEl) {
          return;
        }
        if (!Array.isArray(items) || items.length === 0) {
          designerHandoffLogMetaEl.textContent = "아직 handoff 기록이 없습니다.";
          designerHandoffLogListEl.innerHTML = `
            <div class="designer-handoff-log-item">
              <div class="designer-handoff-log-item-title">아직 로컬 구현 요청이 없습니다.</div>
            </div>
          `;
          return;
        }

        designerHandoffLogMetaEl.textContent = `최근 ${items.length}개 handoff 상태`;
        designerHandoffLogListEl.innerHTML = items
          .slice(0, 5)
          .map((item) => {
            const status = normalizeDesignerString(item?.status) || "queued";
            const summary = normalizeDesignerString(
              item?.completion?.summary || item?.intent?.summary || item?.handoffId || "Handoff"
            );
            const workerId = normalizeDesignerString(
              item?.completion?.workerId || item?.claimedBy?.workerId || ""
            );
            const stamp = normalizeDesignerString(
              item?.completedAt || item?.claimedAt || item?.receivedAt || ""
            );
            const changedFiles = Array.isArray(item?.completion?.result?.changedFiles)
              ? item.completion.result.changedFiles.slice(0, 2).join(", ")
              : "";
            const tests = Array.isArray(item?.completion?.result?.tests)
              ? item.completion.result.tests.slice(0, 2).join(", ")
              : "";
            const executionCommand = normalizeDesignerString(
              item?.completion?.result?.execution?.command || ""
            );
            const executionExitCode =
              typeof item?.completion?.result?.execution?.exitCode === "number"
                ? String(item.completion.result.execution.exitCode)
                : "";
            return `
              <div class="designer-handoff-log-item">
                <div class="designer-handoff-log-item-head">
                  <div class="designer-handoff-log-item-title">${escapeHtml(summary)}</div>
                  <div class="designer-handoff-log-item-status ${escapeHtml(status)}">${escapeHtml(status)}</div>
                </div>
                <div class="designer-handoff-log-item-meta">
                  <div>handoffId: ${escapeHtml(item?.handoffId || "-")}</div>
                  <div>worker: ${escapeHtml(workerId || "-")} · time: ${escapeHtml(stamp || "-")}</div>
                  ${changedFiles ? `<div>files: ${escapeHtml(changedFiles)}</div>` : ""}
                  ${tests ? `<div>tests: ${escapeHtml(tests)}</div>` : ""}
                  ${executionCommand ? `<div>exec: ${escapeHtml(executionCommand)}${executionExitCode ? ` (${escapeHtml(executionExitCode)})` : ""}</div>` : ""}
                </div>
              </div>
            `;
          })
          .join("");
      }

      async function refreshDesignerHandoffLog() {
        if (!bridgeOrigin || !designerHandoffLogListEl) {
          return;
        }
        try {
          const response = await fetch(`${bridgeOrigin}/api/handoffs?limit=5`);
          const result = await response.json().catch(() => null);
          if (!response.ok || result?.ok !== true) {
            throw new Error(result?.error || `HTTP ${response.status}`);
          }
          latestDesignerHandoffItems = Array.isArray(result.items) ? result.items : [];
          renderDesignerHandoffLog(latestDesignerHandoffItems);
        } catch (error) {
          designerHandoffLogMetaEl.textContent = "handoff 목록을 불러오지 못했습니다.";
          designerHandoffLogListEl.innerHTML = `
            <div class="designer-handoff-log-item">
              <div class="designer-handoff-log-item-title">목록 조회 실패</div>
              <div class="designer-handoff-log-item-meta">${escapeHtml(
                error instanceof Error ? error.message : "알 수 없는 오류"
              )}</div>
            </div>
          `;
        }
      }

      async function submitDesignerHandoffPayload(payload) {
        if (!bridgeOrigin) {
          throw new Error("브리지 서버가 아직 연결되지 않았습니다.");
        }
        const response = await fetch(`${bridgeOrigin}/api/handoffs`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) {
          const message =
            result?.error ||
            (Array.isArray(result?.details) && result.details.length > 0
              ? result.details.join(", ")
              : `HTTP ${response.status}`);
          throw new Error(message);
        }
        return result;
      }

      async function executeDesignerChatTurn(prompt, intentEnvelope, options = {}) {
        if (!bridgeOrigin) {
          throw new Error("브리지 서버가 아직 연결되지 않았습니다.");
        }
        const response = await fetch(`${bridgeOrigin}/api/designer/chat`, {
          method: "POST",
          signal: options?.signal,
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            pluginId: pluginId || "default",
            request: prompt,
            mode: intentEnvelope?.mode || "suggest_then_apply",
            figmaContext: getDesignerFigmaContext(prompt)
          })
        });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.ok) {
          throw new Error(result?.error || `HTTP ${response.status}`);
        }
        return result;
      }

      const executeDesignerReadContext = executeDesignerChatTurn;

      function formatDesignerReadExecutionSummary(execution) {
        const summary = execution?.summary || {};
        return `읽기 실행 완료 · phase ${summary.phaseCount || 0} · command ${summary.commandCount || 0} · ok ${summary.okCount || 0} · skipped ${summary.skippedCount || 0} · error ${summary.errorCount || 0}`;
      }

      function formatDesignerSuggestionSummary(bundle) {
        if (!bundle) {
          return "디자인 제안 초안을 만들지 못했습니다.";
        }
        const firstRecommendation = normalizeDesignerArray(bundle.recommendations)[0];
        return `${bundle.summaryText || bundle.headline || "디자인 제안"}${firstRecommendation?.title ? ` · 다음 제안: ${firstRecommendation.title}` : ""}`;
      }

      function formatDesignerAiSummary(ai) {
        if (!ai) {
          return "AI 응답을 받지 못했습니다.";
        }
        if (ai.status === "unconfigured") {
          return ai.response?.reply || "AI API 키가 아직 설정되지 않았습니다.";
        }
        if (ai.status !== "completed") {
          return ai.response?.reply || `AI 응답 상태: ${ai.status || "unknown"}`;
        }
        return ai.response?.reply || "AI가 디자인 응답을 생성했습니다.";
      }

      function renderDesignerShell() {
        if (designerContextGridEl) {
          const figmaContext = getDesignerFigmaContext();
          const designerContext = figmaContext.designerContext || {};
          const readStrategy = designerContext.readStrategy || {};
          const focusedDetail = designerContext.focusedDetail || {};
          const followUpSummary =
            Array.isArray(readStrategy.followUps) && readStrategy.followUps.length > 0
              ? readStrategy.followUps.map(getDesignerFollowUpLabel).join(" · ")
              : "빠른 컨텍스트만으로 시작";
          designerContextGridEl.innerHTML = `
            <div class="designer-context-card">
              <div class="designer-context-label">현재 컨텍스트</div>
              <div class="designer-context-value">${escapeHtml(designerContext.headline || currentFileName)}</div>
            </div>
            <div class="designer-context-card">
              <div class="designer-context-label">읽기 전략</div>
              <div class="designer-context-value">${escapeHtml(getDesignerReadScopeLabel(readStrategy.scope))}</div>
            </div>
            <div class="designer-context-card">
              <div class="designer-context-label">다음 읽기</div>
              <div class="designer-context-value">${escapeHtml(followUpSummary)}</div>
            </div>
            <div class="designer-context-card">
              <div class="designer-context-label">세부 상태</div>
              <div class="designer-context-value">${escapeHtml(
                focusedDetail.status === "available" ? "선택 노드 세부 정보 확보" : focusedDetail.reason || "세부 정보 대기"
              )}</div>
            </div>
          `;
        }
        if (designerChatMetaEl) {
          const mode = getOperationalModeSnapshot();
          designerChatMetaEl.textContent = `${mode.summary} · ${pluginId ? "세션 인식됨" : "세션 대기"}`;
        }
        if (!designerMessageSeeded && currentFileName !== "연결된 파일 없음") {
          appendDesignerMessage(
            "system",
            `${currentFileName} / ${currentPageLabel} 기준으로 AI 디자이너 셸이 준비되었습니다.`
          );
          designerMessageSeeded = true;
        }
      }

      function formatLatency(ms) {
        if (typeof ms !== "number" || Number.isNaN(ms)) {
          return "측정 전";
        }
        return `${ms}ms`;
      }

      function formatTimeLabel(value) {
        return value || "기록 없음";
      }

      function formatAgeLabel(timestampMs) {
        if (typeof timestampMs !== "number" || !Number.isFinite(timestampMs)) {
          return "-";
        }
        const ageMs = Math.max(0, Date.now() - timestampMs);
        if (ageMs < 1000) {
          return "방금";
        }
        if (ageMs < 60000) {
          return `${Math.round(ageMs / 1000)}초 전`;
        }
        const minutes = Math.floor(ageMs / 60000);
        const seconds = Math.round((ageMs % 60000) / 1000);
        return `${minutes}분 ${seconds}초 전`;
      }

      function getOperationalModeSnapshot() {
        const recovering =
          !bridgeEnabled ||
          recoveryPhase !== "stable" ||
          needsReconnect ||
          needsReregister ||
          Boolean(autoRecoverTimer) ||
          Boolean(wsCommandReconnectDueAt) ||
          Boolean(eventsReconnectDueAt) ||
          wsExperimentState === "probing";

        if (!bridgeEnabled) {
          return {
            key: "standby",
            label: "standby",
            tone: "paused",
            summary: "브리지가 꺼져 있습니다.",
            reason: "상단 토글을 다시 켜면 서버 연결과 세션 동기화가 재개됩니다.",
            risk: "현재는 명령 처리와 스트림 갱신이 멈춰 있습니다.",
            soak: "재개 전",
            transport: "off"
          };
        }

        if (recovering) {
          const recoveryReason =
            recoveryPhase !== "stable"
              ? recoveryPhase
              : needsReconnect
                ? "server reconnect required"
                : needsReregister
                  ? "session reregister required"
                  : wsCommandReconnectDueAt
                    ? "ws command reconnect scheduled"
                    : eventsReconnectDueAt
                      ? "sse reconnect scheduled"
                      : wsExperimentState === "probing"
                        ? "ws probe running"
                        : "recovering";
          return {
            key: "reconnecting",
            label: "reconnecting",
            tone: "reconnecting",
            summary: "연결과 세션을 다시 붙이는 중입니다.",
            reason: `복구 신호: ${recoveryReason}`,
            risk: "명령 pickup과 상세 조회가 잠깐 늦어질 수 있습니다.",
            soak: "복구 중",
            transport: "recovery"
          };
        }

        if (bridgeConnected && sessionRegistered && wsCommandConnected) {
          const wsHot =
            runtimeState === "executing" ||
            (typeof lastCommandActivityAt === "number" &&
              lastCommandActivityAt > 0 &&
              Date.now() - lastCommandActivityAt <= ACTIVE_POLL_GRACE_MS) ||
            wsCommandMessageCount > wsCommandAckedCount;
          if (wsHot) {
            return {
              key: "ws-first",
              label: "WS-first",
              tone: "ws-first",
              summary: "명령 pickup이 WebSocket 우선으로 흐르고 있습니다.",
              reason: "WS command channel이 활성이며 최근 command activity가 감지되었습니다.",
              risk: "HTTP는 비교 경로, polling은 fallback recovery로만 남습니다.",
              soak: "활성",
              transport: "ws"
            };
          }
          return {
            key: "standby",
            label: "standby",
            tone: "standby",
            summary: "브리지는 준비되어 있고 명령을 기다리는 중입니다.",
            reason: "WS command channel은 연결되어 있지만 현재 활성 명령이 없습니다.",
            risk: "대기 상태이므로 다음 명령은 즉시 WS-first로 전환됩니다.",
            soak: "대기",
            transport: "ws-idle"
          };
        }

        if (bridgeConnected && sessionRegistered) {
          return {
            key: "fallback",
            label: "fallback",
            tone: "fallback",
            summary: "스트리밍 채널이 부족해 fallback 경로가 유효합니다.",
            reason: wsCommandLastError || eventsLastError || "WS/SSE가 아직 안정적이지 않아 폴링이 대체 중입니다.",
            risk: "이 상태에서는 polling이 복구용으로 계속 사용됩니다.",
            soak: "fallback active",
            transport: "poll"
          };
        }

        if (bridgeConnected) {
          return {
            key: "standby",
            label: "standby",
            tone: "standby",
            summary: "서버는 연결되어 있고 세션만 기다리는 중입니다.",
            reason: "현재 파일 세션이 아직 등록되지 않았습니다.",
            risk: "세션이 생기기 전까지는 명령 pickup이 시작되지 않습니다.",
            soak: "session pending",
            transport: "awaiting-session"
          };
        }

        return {
          key: "fallback",
          label: "fallback",
          tone: "fallback",
          summary: "브리지 연결이 끊겨 recovery-only 상태입니다.",
          reason: serverErrorCode || "server connection not established",
          risk: "이 상태에서는 서버 재연결 또는 프로세스 확인이 필요합니다.",
          soak: "offline",
          transport: "off"
        };
      }

      function getEventStreamStateLabel() {
        if (!bridgeEnabled) {
          return "중지됨";
        }
        if (typeof EventSource === "undefined") {
          return "미지원";
        }
        if (eventsConnected) {
          return "연결됨";
        }
        return "폴백 사용 중";
      }

      function getEventStreamFallbackReason() {
        if (!bridgeEnabled) {
          return "브리지가 꺼져 있어 폴링만 동작합니다.";
        }
        if (typeof EventSource === "undefined") {
          return "현재 런타임에서 EventSource를 지원하지 않습니다.";
        }
        if (!bridgeConnected || !bridgeOrigin) {
          return "서버 연결 전 단계라 폴링 상태 확인 루틴만 유지합니다.";
        }
        if (eventsLastError) {
          return `SSE 연결 오류: ${eventsLastError}`;
        }
        if (eventsReconnectDueAt) {
          const remainMs = Math.max(0, eventsReconnectDueAt - Date.now());
          return `SSE 재연결 대기 중 (${Math.max(1, Math.ceil(remainMs / 1000))}초 후)`;
        }
        return "SSE를 사용할 수 없어 폴링 기반 상태 갱신으로 대체 중입니다.";
      }

      function getWsExperimentStateLabel() {
        if (!bridgeEnabled) {
          return "중지됨";
        }
        if (typeof WebSocket === "undefined") {
          return "미지원";
        }
        if (wsExperimentState === "probing") {
          return "확인 중";
        }
        if (wsExperimentState === "connected") {
          return "연결됨";
        }
        if (wsExperimentState === "error") {
          return "오류";
        }
        if (wsExperimentState === "closed") {
          return "닫힘";
        }
        return "대기";
      }

      function getWsExperimentFallbackReason() {
        if (!bridgeEnabled) {
          return "브리지가 꺼져 WS 실험 체크를 수행하지 않습니다.";
        }
        if (typeof WebSocket === "undefined") {
          return "현재 런타임에서 WebSocket API를 지원하지 않습니다.";
        }
        if (!bridgeConnected || !bridgeOrigin) {
          return "서버 연결 전이라 WS 실험 체크를 대기합니다.";
        }
        if (wsExperimentLastError) {
          return `최근 오류: ${wsExperimentLastError}`;
        }
        return "아직 WS 실험 체크를 실행하지 않았습니다.";
      }

      function getWsCommandStateLabel() {
        if (!bridgeEnabled) {
          return "중지됨";
        }
        if (typeof WebSocket === "undefined") {
          return "미지원";
        }
        if (wsCommandConnected) {
          return "연결됨";
        }
        if (wsCommandReconnectDueAt) {
          return "재연결 중";
        }
        if (wsCommandLastError) {
          return "폴백 사용 중";
        }
        return "대기";
      }

      function getCommandTransportLabel() {
        if (!bridgeEnabled) {
          return "중지됨";
        }
        if (wsCommandConnected) {
          return "실시간 명령(WS)";
        }
        if (bridgeConnected && pluginId) {
          return "백업 폴링 사용 중";
        }
        return "대기 중";
      }

      function updateWsFallbackRecommendation() {
        if (!bridgeEnabled) {
          wsExperimentFallbackRecommendation = "브리지가 꺼져 있어 SSE/HTTP 폴백 유지";
          return;
        }
        if (typeof WebSocket === "undefined") {
          wsExperimentFallbackRecommendation = "WebSocket 미지원 환경: SSE/HTTP 폴백 사용";
          return;
        }
        if (wsCommandConnected) {
          wsExperimentFallbackRecommendation =
            "WS command channel 활성화됨. Polling은 fallback standby로 유지";
          return;
        }
        if (wsCommandLastError) {
          wsExperimentFallbackRecommendation = `WS command fallback 중: ${wsCommandLastError}`;
          return;
        }
        if (wsExperimentState === "error") {
          wsExperimentFallbackRecommendation = "WS probe 실패: SSE/HTTP 폴백 권장";
          return;
        }
        if (wsInspectionLastStatus === "mismatch" || wsInspectionReverifyHttpRecommended) {
          wsExperimentFallbackRecommendation =
            "WS inspection parity 불확실/불일치: HTTP 재검증 및 SSE/HTTP 폴백 권장";
          return;
        }
        if (wsExperimentChannelMode === "command-enabled") {
          wsExperimentFallbackRecommendation =
            "WS command-enabled 신호 감지(실험 단계). 현재는 SSE/HTTP를 주 경로로 유지";
          return;
        }
        if (wsExperimentChannelMode === "mirror-only") {
          wsExperimentFallbackRecommendation =
            "WS mirror-only 상태. 명령 실행 경로는 SSE/HTTP 유지 권장";
          return;
        }
        if (!wsExperimentHelloSeen && wsExperimentMessageCount === 0) {
          wsExperimentFallbackRecommendation = "WS 신호 없음: SSE/HTTP 폴백 권장";
          return;
        }
        if (wsExperimentHelloSeen && !wsExperimentSessionEventSeen && !wsExperimentCommandEventSeen) {
          wsExperimentFallbackRecommendation = "hello만 확인됨: SSE/HTTP 폴백 유지 권장";
          return;
        }
        if (wsExperimentSessionEventSeen || wsExperimentCommandEventSeen) {
          wsExperimentFallbackRecommendation = "WS 이벤트 수신 확인(실험 단계). 현재는 SSE/HTTP를 주 경로로 유지";
          return;
        }
        wsExperimentFallbackRecommendation = "진단 신호 불충분: SSE/HTTP 폴백 유지";
      }

      function resolveWsChannelMode(parsed, rawType) {
        const type = typeof rawType === "string" ? rawType.toLowerCase() : "";
        const payload =
          parsed && typeof parsed.payload === "object" && parsed.payload
            ? parsed.payload
            : parsed && typeof parsed === "object"
              ? parsed
              : null;
        if (payload) {
          if (
            payload.channelMode === "command-enabled" ||
            payload.wsMode === "command-enabled" ||
            payload.commandEnabled === true ||
            payload.commandChannel === "enabled" ||
            payload.writable === true
          ) {
            return "command-enabled";
          }
          if (
            payload.channelMode === "mirror-only" ||
            payload.wsMode === "mirror-only" ||
            payload.commandEnabled === false ||
            payload.commandChannel === "mirror-only"
          ) {
            return "mirror-only";
          }
          if (
            payload.capabilities &&
            typeof payload.capabilities === "object" &&
            Object.prototype.hasOwnProperty.call(payload.capabilities, "commandSubmit")
          ) {
            return payload.capabilities.commandSubmit ? "command-enabled" : "mirror-only";
          }
        }
        if (type.includes("channel.mirror") || type.includes("mirror_only")) {
          return "mirror-only";
        }
        if (type.includes("channel.command_enabled") || type.includes("command_enabled")) {
          return "command-enabled";
        }
        return null;
      }

      function resolveWsAckStatus(parsed, rawType) {
        const type = typeof rawType === "string" ? rawType.toLowerCase() : "";
        const payload =
          parsed && typeof parsed.payload === "object" && parsed.payload
            ? parsed.payload
            : parsed && typeof parsed === "object"
              ? parsed
              : null;
        if (type.includes("ack")) {
          if (type.includes("failed") || type.includes("error") || type.includes("rejected")) {
            return "failed";
          }
          return "ok";
        }
        if (payload) {
          if (payload.ackStatus === "ok" || payload.ackStatus === "accepted") {
            return "ok";
          }
          if (
            payload.ackStatus === "failed" ||
            payload.ackStatus === "error" ||
            payload.ackStatus === "rejected"
          ) {
            return "failed";
          }
          if (payload.ack === true || payload.accepted === true) {
            return "ok";
          }
          if (payload.ack === false || payload.accepted === false) {
            return "failed";
          }
        }
        return null;
      }

      function resolveWsResultStatus(parsed, rawType) {
        const type = typeof rawType === "string" ? rawType.toLowerCase() : "";
        const payload =
          parsed && typeof parsed.payload === "object" && parsed.payload
            ? parsed.payload
            : parsed && typeof parsed === "object"
              ? parsed
              : null;
        if (type.includes("result")) {
          if (type.includes("failed") || type.includes("error")) {
            return "failed";
          }
          if (type.includes("completed") || type.includes("success")) {
            return "success";
          }
          return "received";
        }
        if (payload) {
          if (payload.resultStatus === "success" || payload.status === "success") {
            return "success";
          }
          if (
            payload.resultStatus === "failed" ||
            payload.resultStatus === "error" ||
            payload.status === "failed" ||
            payload.status === "error"
          ) {
            return "failed";
          }
          if (Object.prototype.hasOwnProperty.call(payload, "result")) {
            return "received";
          }
        }
        return null;
      }

      function normalizeCommandList(input) {
        if (!Array.isArray(input)) {
          return [];
        }
        const normalized = [];
        for (const item of input) {
          if (typeof item !== "string") {
            continue;
          }
          const value = item.trim();
          if (!value || normalized.includes(value)) {
            continue;
          }
          normalized.push(value);
        }
        return normalized;
      }

      function extractWsEnabledCommands(parsed) {
        if (!parsed || typeof parsed !== "object") {
          return [];
        }
        const payload =
          parsed.payload && typeof parsed.payload === "object"
            ? parsed.payload
            : parsed;
        const direct = normalizeCommandList(payload.enabledCommands);
        if (direct.length > 0) {
          return direct;
        }
        if (payload.capabilities && typeof payload.capabilities === "object") {
          const capabilityCommands = normalizeCommandList(payload.capabilities.enabledCommands);
          if (capabilityCommands.length > 0) {
            return capabilityCommands;
          }
          const availableCommands = normalizeCommandList(payload.capabilities.commands);
          if (availableCommands.length > 0) {
            return availableCommands;
          }
        }
        return [];
      }

      function evaluateWsInspectionSupport(enabledCommands) {
        const targets = [
          "get_metadata",
          "get_node_details",
          "get_instance_details",
          "get_component_variant_details",
          "get_annotations",
          "get_variable_defs",
          "search_nodes"
        ];
        const found = targets.filter((name) => enabledCommands.includes(name));
        return {
          supported: found.length > 0,
          found
        };
      }

      function resolveWsInspectionStatus(parsed, rawType) {
        const type = typeof rawType === "string" ? rawType.toLowerCase() : "";
        const payload =
          parsed && typeof parsed.payload === "object" && parsed.payload
            ? parsed.payload
            : parsed && typeof parsed === "object"
              ? parsed
              : null;
        if (!payload) {
          return null;
        }

        const mentionsInspection =
          type.includes("inspection") ||
          type.includes("inspect") ||
          Boolean(payload.inspection) ||
          Boolean(payload.inspectionResult) ||
          Boolean(payload.inspectionStatus);
        if (!mentionsInspection) {
          return null;
        }

        const directStatus =
          typeof payload.inspectionStatus === "string"
            ? payload.inspectionStatus.toLowerCase()
            : null;
        if (directStatus === "matched" || directStatus === "match" || directStatus === "ok") {
          return { status: "matched", note: "WS inspection matched", reverify: false };
        }
        if (
          directStatus === "mismatch" ||
          directStatus === "diverged" ||
          directStatus === "error" ||
          directStatus === "failed"
        ) {
          return { status: "mismatch", note: "WS inspection mismatch/error", reverify: true };
        }

        if (payload.httpParity === true || payload.match === true || payload.matched === true) {
          return { status: "matched", note: "WS payload reports HTTP parity", reverify: false };
        }
        if (payload.httpParity === false || payload.match === false || payload.matched === false) {
          return { status: "mismatch", note: "WS payload reports HTTP mismatch", reverify: true };
        }

        if (
          payload.inspectionResult &&
          typeof payload.inspectionResult === "object" &&
          Object.prototype.hasOwnProperty.call(payload.inspectionResult, "matched")
        ) {
          return payload.inspectionResult.matched
            ? { status: "matched", note: "inspectionResult.matched=true", reverify: false }
            : { status: "mismatch", note: "inspectionResult.matched=false", reverify: true };
        }

        return { status: "unknown", note: "inspection event seen, parity unknown", reverify: true };
      }

      function classifyWsMessageType(rawData) {
        let parsed = null;
        if (typeof rawData === "string" && rawData.trim()) {
          try {
            parsed = JSON.parse(rawData);
          } catch (error) {
            parsed = null;
          }
        }

        const eventType =
          parsed && typeof parsed === "object"
            ? parsed.event || parsed.type || parsed.kind || parsed.topic || null
            : null;
        const normalizedType =
          typeof eventType === "string" && eventType.trim() ? eventType.trim() : null;
        const lowered = normalizedType ? normalizedType.toLowerCase() : "";
        const loweredRaw =
          typeof rawData === "string" && rawData.trim() ? rawData.toLowerCase() : "";

        return {
          parsed,
          type: normalizedType,
          hello: lowered.includes("hello") || loweredRaw.includes("hello"),
          session:
            lowered.startsWith("session.") ||
            lowered.includes("session") ||
            loweredRaw.includes("session."),
          command:
            lowered.startsWith("command.") ||
            lowered.includes("command") ||
            loweredRaw.includes("command.")
        };
      }

      function clearWsProbeTimer() {
        if (wsProbeTimer) {
          clearTimeout(wsProbeTimer);
          wsProbeTimer = null;
        }
      }

      function closeWsProbeSocket() {
        clearWsProbeTimer();
        if (wsProbeSocket) {
          try {
            wsProbeSocket.close();
          } catch (error) {
            // ignore close failures
          }
          wsProbeSocket = null;
        }
      }

      function buildWsExperimentUrl() {
        if (!bridgeOrigin) {
          return null;
        }
        const httpUrl = new URL(bridgeOrigin);
        const protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
        return `${protocol}//${httpUrl.host}/api/ws`;
      }

      function buildWsCommandUrl() {
        if (!bridgeOrigin || !pluginId) {
          return null;
        }
        const baseUrl = buildWsExperimentUrl();
        if (!baseUrl) {
          return null;
        }
        const url = new URL(baseUrl);
        url.searchParams.set("pluginId", getPluginId());
        url.searchParams.set("clientType", "plugin");
        return url.toString();
      }

      function pruneCommandTransportMap() {
        if (commandTransportById.size <= 200) {
          return;
        }
        const staleIds = Array.from(commandTransportById.keys()).slice(
          0,
          commandTransportById.size - 200
        );
        staleIds.forEach((id) => {
          commandTransportById.delete(id);
        });
      }

      function clearWsCommandReconnectTimer() {
        if (wsCommandReconnectTimer) {
          clearTimeout(wsCommandReconnectTimer);
          wsCommandReconnectTimer = null;
        }
        wsCommandReconnectDueAt = null;
      }

      function closeWsCommandSocket() {
        if (wsCommandSocket) {
          try {
            wsCommandSocket.close();
          } catch (error) {
            // ignore close failures
          }
          wsCommandSocket = null;
        }
        wsCommandConnected = false;
      }

      function stopPluginHeartbeatLoop() {
        if (pluginHeartbeatTimer) {
          clearInterval(pluginHeartbeatTimer);
          pluginHeartbeatTimer = null;
        }
        pluginHeartbeatInFlight = false;
      }

      async function sendPluginHeartbeat() {
        if (!bridgeEnabled || !bridgeConnected || !pluginId || !bridgeOrigin) {
          return;
        }
        if (pluginHeartbeatInFlight) {
          return;
        }
        pluginHeartbeatInFlight = true;
        try {
          await postJson("/plugin/heartbeat", {
            pluginId: getPluginId(),
            uiMetrics: collectPluginUiMetricsSnapshot()
          });
        } catch (error) {
          wsCommandLastError = error instanceof Error ? error.message : String(error);
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
        } finally {
          pluginHeartbeatInFlight = false;
        }
      }

      function ensurePluginHeartbeatLoop() {
        if (!bridgeEnabled || !bridgeConnected || !pluginId || !wsCommandConnected) {
          stopPluginHeartbeatLoop();
          return;
        }
        if (pluginHeartbeatTimer) {
          return;
        }
        pluginHeartbeatTimer = setInterval(() => {
          void sendPluginHeartbeat();
        }, PLUGIN_HEARTBEAT_INTERVAL_MS);
        void sendPluginHeartbeat();
      }

      function sendWsPluginLifecycleMessage(type, payload) {
        if (!wsCommandSocket || wsCommandSocket.readyState !== WebSocket.OPEN) {
          return false;
        }
        try {
          wsCommandSocket.send(
            JSON.stringify({
              type,
              pluginId: getPluginId(),
              ...payload
            })
          );
          return true;
        } catch (error) {
          wsCommandLastError = error instanceof Error ? error.message : String(error);
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
          return false;
        }
      }

      function dispatchBridgeCommand(command, source = "polling") {
        if (!command || !command.commandId) {
          return;
        }
        if (commandTransportById.has(command.commandId)) {
          return;
        }
        commandTransportById.set(command.commandId, source);
        pruneCommandTransportMap();
        lastCommandActivityAt = Date.now();
        parent.postMessage(
          {
            pluginMessage: {
              type: "execute_command",
              command
            }
          },
          "*"
        );
      }

      function handleWsPluginCommandEnvelope(parsed) {
        const payload =
          parsed && typeof parsed.payload === "object" ? parsed.payload : {};
        const command =
          payload && typeof payload.command === "object" ? payload.command : null;
        if (!command || !command.commandId) {
          return;
        }
        wsCommandMessageCount += 1;
        wsCommandLastAt = new Date().toLocaleTimeString();
        wsCommandLastAtMs = Date.now();
        wsCommandLastCommandId = command.commandId;
        if (
          sendWsPluginLifecycleMessage("ws.plugin.command.ack", {
            commandId: command.commandId
          })
        ) {
          wsCommandAckedCount += 1;
        }
        dispatchBridgeCommand(command, "ws");
        updateWsFallbackRecommendation();
        renderRealtimeDebugPanel();
      }

      function scheduleWsCommandReconnect() {
        if (!bridgeEnabled || !bridgeConnected || !pluginId) {
          return;
        }
        if (wsCommandReconnectTimer) {
          return;
        }
        wsCommandReconnectDueAt = Date.now() + WS_COMMAND_RECONNECT_MS;
        wsCommandReconnectTimer = setTimeout(() => {
          wsCommandReconnectTimer = null;
          wsCommandReconnectDueAt = null;
          void ensureWsCommandChannel();
        }, WS_COMMAND_RECONNECT_MS);
        renderRealtimeDebugPanel();
      }

      async function ensureWsCommandChannel(options = {}) {
        if (!bridgeEnabled || !bridgeConnected || !pluginId || !bridgeOrigin) {
          clearWsCommandReconnectTimer();
          closeWsCommandSocket();
          stopPluginHeartbeatLoop();
          return;
        }
        if (typeof WebSocket === "undefined") {
          stopPluginHeartbeatLoop();
          return;
        }

        const wsUrl = buildWsCommandUrl();
        if (!wsUrl) {
          return;
        }

        if (
          wsCommandSocket &&
          !options.forceRestart &&
          wsCommandSocket.readyState === WebSocket.OPEN &&
          wsCommandLastUrl === wsUrl
        ) {
          return;
        }

        clearWsCommandReconnectTimer();
        closeWsCommandSocket();

        let socket = null;
        try {
          socket = new WebSocket(wsUrl);
        } catch (error) {
          wsCommandConnected = false;
          wsCommandLastError = error instanceof Error ? error.message : String(error);
          wsCommandLastUrl = wsUrl;
          stopPluginHeartbeatLoop();
          scheduleWsCommandReconnect();
          scheduleNextPoll();
          renderRealtimeDebugPanel();
          return;
        }

        wsCommandSocket = socket;
        wsCommandLastUrl = wsUrl;
        wsCommandLastError = null;

        socket.onopen = () => {
          if (wsCommandSocket !== socket) {
            return;
          }
          wsCommandConnected = true;
          wsCommandLastAt = new Date().toLocaleTimeString();
          wsCommandLastAtMs = Date.now();
          wsCommandLastError = null;
          clearWsCommandReconnectTimer();
          stopPolling();
          ensurePluginHeartbeatLoop();
          updateWsFallbackRecommendation();
          recordStatusTrendSample();
          renderRealtimeDebugPanel();
        };

        socket.onmessage = (event) => {
          if (wsCommandSocket !== socket) {
            return;
          }
          let parsed = null;
          try {
            parsed = JSON.parse(event.data);
          } catch (error) {
            return;
          }
          const type = typeof parsed?.event === "string" ? parsed.event : parsed?.type;
          if (type === "plugin.command") {
            handleWsPluginCommandEnvelope(parsed);
            return;
          }
          if (type === "ws.plugin.command.error") {
            wsCommandLastError = parsed?.payload?.error || "WS plugin command error";
            wsCommandLastAt = new Date().toLocaleTimeString();
            wsCommandLastAtMs = Date.now();
            updateWsFallbackRecommendation();
            renderRealtimeDebugPanel();
            return;
          }
          if (
            type === "ws.plugin.command.ack" ||
            type === "ws.plugin.command.result.ack"
          ) {
            wsCommandLastAt = new Date().toLocaleTimeString();
            wsCommandLastAtMs = Date.now();
            renderRealtimeDebugPanel();
          }
        };

        socket.onerror = () => {
          if (wsCommandSocket !== socket) {
            return;
          }
          wsCommandConnected = false;
          wsCommandLastError = "WS command channel error";
          stopPluginHeartbeatLoop();
          updateWsFallbackRecommendation();
          recordStatusTrendSample();
          renderRealtimeDebugPanel();
        };

        socket.onclose = () => {
          if (wsCommandSocket !== socket) {
            return;
          }
          wsCommandSocket = null;
          wsCommandConnected = false;
          wsCommandLastAt = new Date().toLocaleTimeString();
          wsCommandLastAtMs = Date.now();
          stopPluginHeartbeatLoop();
          updateWsFallbackRecommendation();
          recordStatusTrendSample();
          scheduleWsCommandReconnect();
          scheduleNextPoll();
          renderRealtimeDebugPanel();
        };
      }

      async function probeWsExperiment() {
        if (!bridgeEnabled || !bridgeConnected || !bridgeOrigin) {
          wsExperimentState = "idle";
          wsExperimentLastError = "브리지 연결 후 WS 실험 체크를 실행하세요.";
          wsExperimentLastAt = new Date().toLocaleTimeString();
          wsExperimentLastAtMs = Date.now();
          wsExperimentLastAtMs = Date.now();
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
          return;
        }
        if (typeof WebSocket === "undefined") {
          wsExperimentState = "error";
          wsExperimentLastError = "WebSocket 미지원 런타임";
          wsExperimentLastAt = new Date().toLocaleTimeString();
          wsExperimentLastAtMs = Date.now();
          wsExperimentLastAtMs = Date.now();
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
          return;
        }
        if (wsExperimentState === "probing") {
          return;
        }

        closeWsProbeSocket();

        const wsUrl = buildWsExperimentUrl();
        if (!wsUrl) {
          wsExperimentState = "error";
          wsExperimentLastError = "WS URL을 구성할 수 없습니다.";
          wsExperimentLastAt = new Date().toLocaleTimeString();
          wsExperimentLastAtMs = Date.now();
          wsExperimentLastAtMs = Date.now();
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
          return;
        }

        wsExperimentState = "probing";
        wsExperimentAttempts += 1;
        wsExperimentLastAt = new Date().toLocaleTimeString();
        wsExperimentLastAtMs = Date.now();
        wsExperimentLastAtMs = Date.now();
        wsExperimentLastUrl = wsUrl;
        wsExperimentLastError = null;
        wsExperimentLastCode = null;
        wsExperimentLastReason = null;
        wsExperimentHelloSeen = false;
        wsExperimentSessionEventSeen = false;
        wsExperimentCommandEventSeen = false;
        wsExperimentLastMessageType = null;
        wsExperimentMessageCount = 0;
        wsExperimentChannelMode = "unknown";
        wsExperimentLastAckStatus = null;
        wsExperimentLastAckAt = null;
        wsExperimentLastResultStatus = null;
        wsExperimentLastResultAt = null;
        wsExperimentEnabledCommands = [];
        wsInspectionSupportSeen = false;
        wsInspectionLastStatus = "unknown";
        wsInspectionLastAt = null;
        wsInspectionLastNote = null;
        wsInspectionReverifyHttpRecommended = true;
        wsExperimentFallbackRecommendation = "WS probe 진행 중. SSE/HTTP 폴백 유지";
        renderRealtimeDebugPanel();

        let socket = null;
        try {
          socket = new WebSocket(wsUrl);
          wsProbeSocket = socket;
        } catch (error) {
          wsExperimentState = "error";
          wsExperimentLastError = error instanceof Error ? error.message : String(error);
          wsExperimentLastAt = new Date().toLocaleTimeString();
          wsExperimentLastAtMs = Date.now();
          wsExperimentLastAtMs = Date.now();
          wsProbeSocket = null;
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
          return;
        }

        wsProbeTimer = setTimeout(() => {
          wsExperimentState = "error";
          wsExperimentLastError = "WS probe timeout";
          wsExperimentLastAt = new Date().toLocaleTimeString();
          wsExperimentLastAtMs = Date.now();
          updateWsFallbackRecommendation();
          if (wsProbeSocket === socket) {
            closeWsProbeSocket();
          }
          renderRealtimeDebugPanel();
        }, WS_EXPERIMENT_PROBE_TIMEOUT_MS);

        socket.onopen = () => {
          if (wsProbeSocket !== socket) {
            return;
          }
          wsExperimentState = "connected";
          wsExperimentLastAt = new Date().toLocaleTimeString();
          wsExperimentLastAtMs = Date.now();
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
        };

        socket.onmessage = (event) => {
          wsExperimentMessageCount += 1;
          const classified = classifyWsMessageType(event?.data);
          if (classified.hello) {
            wsExperimentHelloSeen = true;
          }
          if (classified.session) {
            wsExperimentSessionEventSeen = true;
          }
          if (classified.command) {
            wsExperimentCommandEventSeen = true;
          }
          wsExperimentLastMessageType = classified.type || "untyped";
          const resolvedMode = resolveWsChannelMode(classified.parsed, classified.type);
          if (resolvedMode) {
            wsExperimentChannelMode = resolvedMode;
          }
          const ackStatus = resolveWsAckStatus(classified.parsed, classified.type);
          if (ackStatus) {
            wsExperimentLastAckStatus = ackStatus;
            wsExperimentLastAckAt = new Date().toLocaleTimeString();
          }
          const resultStatus = resolveWsResultStatus(classified.parsed, classified.type);
          if (resultStatus) {
            wsExperimentLastResultStatus = resultStatus;
            wsExperimentLastResultAt = new Date().toLocaleTimeString();
          }
          const enabledCommands = extractWsEnabledCommands(classified.parsed);
          if (enabledCommands.length > 0) {
            wsExperimentEnabledCommands = enabledCommands;
            const inspectionSupport = evaluateWsInspectionSupport(enabledCommands);
            wsInspectionSupportSeen = inspectionSupport.supported;
            if (wsInspectionSupportSeen && wsExperimentChannelMode === "unknown") {
              wsExperimentChannelMode = "command-enabled";
            }
          }
          const inspectionStatus = resolveWsInspectionStatus(classified.parsed, classified.type);
          if (inspectionStatus) {
            wsInspectionLastStatus = inspectionStatus.status;
            wsInspectionLastAt = new Date().toLocaleTimeString();
            wsInspectionLastNote = inspectionStatus.note || null;
            wsInspectionReverifyHttpRecommended = Boolean(inspectionStatus.reverify);
          }
          wsExperimentLastAt = new Date().toLocaleTimeString();
          wsExperimentLastAtMs = Date.now();
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
          if (wsExperimentHelloSeen && (wsExperimentSessionEventSeen || wsExperimentCommandEventSeen)) {
            clearWsProbeTimer();
            try {
              socket.close(1000, "debug-probe-complete");
            } catch (error) {
              // ignore close failures
            }
          }
        };

        socket.onerror = () => {
          if (wsProbeSocket !== socket) {
            return;
          }
          wsExperimentState = "error";
          wsExperimentLastError = "WS 연결 오류";
          wsExperimentLastAt = new Date().toLocaleTimeString();
          wsExperimentLastAtMs = Date.now();
          updateWsFallbackRecommendation();
          renderRealtimeDebugPanel();
        };

        socket.onclose = (event) => {
          if (wsProbeSocket !== socket) {
            return;
          }
          clearWsProbeTimer();
          wsExperimentLastCode =
            typeof event?.code === "number" && Number.isFinite(event.code)
              ? event.code
              : null;
          wsExperimentLastReason =
            typeof event?.reason === "string" && event.reason
              ? event.reason
              : null;
          if (wsExperimentState !== "error") {
            wsExperimentState = "closed";
          }
          wsExperimentLastAt = new Date().toLocaleTimeString();
          updateWsFallbackRecommendation();
          wsProbeSocket = null;
          renderRealtimeDebugPanel();
        };
      }

      function renderRealtimeDebugPanel() {
        if (!realtimeGridEl) {
          return;
        }
        updateWsFallbackRecommendation();

        const reconnectRemainMs =
          typeof eventsReconnectDueAt === "number"
            ? Math.max(0, eventsReconnectDueAt - Date.now())
            : null;
        const pollLabel = `${getPollProfileLabel()} · ${currentPollIntervalMs}ms`;
        const streamState = getEventStreamStateLabel();
        const fallbackReason = getEventStreamFallbackReason();
        const wsState = getWsExperimentStateLabel();
        const wsReason = getWsExperimentFallbackReason();
        const wsCommandState = getWsCommandStateLabel();
        const wsCommandReconnectRemainMs =
          typeof wsCommandReconnectDueAt === "number"
            ? Math.max(0, wsCommandReconnectDueAt - Date.now())
            : null;
        const mode = getOperationalModeSnapshot();
        const enabledCommandsPreview =
          wsExperimentEnabledCommands.length > 0
            ? wsExperimentEnabledCommands.slice(0, 6).join(", ")
            : "-";
        const inspectionSupportLabel = wsInspectionSupportSeen ? "supported" : "not seen";
        const inspectionParityLabel =
          wsInspectionLastStatus === "matched"
            ? "matched"
            : wsInspectionLastStatus === "mismatch"
              ? "mismatch"
              : "unknown";
        const inspectionVerifyLabel = wsInspectionReverifyHttpRecommended
          ? "re-verify via HTTP"
          : "match signal observed";

        realtimeGridEl.innerHTML = `
          <div class="realtime-item">
            <div class="realtime-item-title">운영 모드</div>
            <div class="realtime-item-meta">
              <div>mode: ${escapeHtml(mode.label)} · tone: ${escapeHtml(mode.tone)}</div>
              <div>summary: ${escapeHtml(mode.summary)}</div>
              <div>reason: ${escapeHtml(mode.reason)}</div>
              <div>risk: ${escapeHtml(mode.risk)}</div>
            </div>
          </div>
          <div class="realtime-item">
            <div class="realtime-item-title">스트림/폴링 신호</div>
            <div class="realtime-item-meta">
              <div>stream: ${escapeHtml(streamState)}</div>
              <div>poll profile: ${escapeHtml(pollLabel)}</div>
              <div>polls: ${escapeHtml(String(pollRequestCount))} · command fetches: ${escapeHtml(String(pollCommandFetchCount))}</div>
              <div>poll-driven reads: runtime ${escapeHtml(String(pollRuntimeRefreshCount))} · detail ${escapeHtml(String(pollDetailRefreshCount))}</div>
              <div>event-driven reads: runtime ${escapeHtml(String(eventDrivenRuntimeRefreshCount))} · detail ${escapeHtml(String(eventDrivenDetailRefreshCount))} · sessions ${escapeHtml(String(eventDrivenSessionRefreshCount))}</div>
              <div>fallback reason: ${escapeHtml(fallbackReason)}</div>
              <div>reconnect ETA: ${escapeHtml(reconnectRemainMs === null ? "-" : `${Math.max(1, Math.ceil(reconnectRemainMs / 1000))}s`)}</div>
              <div>soak age: SSE ${escapeHtml(formatAgeLabel(eventsLastAtMs))} · WS ${escapeHtml(formatAgeLabel(wsCommandLastAtMs))}</div>
            </div>
          </div>
          <div class="realtime-item">
            <div class="realtime-item-title">WS 명령 채널</div>
            <div class="realtime-item-meta">
              <div>state: ${escapeHtml(wsCommandState)} · transport: ${escapeHtml(getCommandTransportLabel())}</div>
              <div>messages: ${escapeHtml(String(wsCommandMessageCount))} · acked: ${escapeHtml(String(wsCommandAckedCount))}</div>
              <div>last command: ${escapeHtml(wsCommandLastCommandId || "-")} @ ${escapeHtml(formatTimeLabel(wsCommandLastAt))}</div>
              <div>reconnect ETA: ${escapeHtml(wsCommandReconnectRemainMs === null ? "-" : `${Math.max(1, Math.ceil(wsCommandReconnectRemainMs / 1000))}s`)}</div>
              <div>reason: ${escapeHtml(wsCommandLastError || "-")}</div>
              <div>url: ${escapeHtml(wsCommandLastUrl || buildWsCommandUrl() || "-")}</div>
            </div>
          </div>
          <div class="realtime-item">
            <div class="realtime-item-title">WS 실험(placeholder)</div>
            <div class="realtime-item-meta">
              <div>state: ${escapeHtml(wsState)} · mode: ${escapeHtml(wsExperimentChannelMode)} · attempts: ${escapeHtml(String(wsExperimentAttempts))}</div>
              <div>messages: ${escapeHtml(String(wsExperimentMessageCount))}</div>
              <div>last: ${escapeHtml(formatTimeLabel(wsExperimentLastAt))} · code: ${escapeHtml(wsExperimentLastCode === null ? "-" : String(wsExperimentLastCode))}</div>
              <div>hello seen: ${escapeHtml(wsExperimentHelloSeen ? "yes" : "no")} · session.* seen: ${escapeHtml(wsExperimentSessionEventSeen ? "yes" : "no")} · command.* seen: ${escapeHtml(wsExperimentCommandEventSeen ? "yes" : "no")}</div>
              <div>ack: ${escapeHtml(wsExperimentLastAckStatus || "-")} @ ${escapeHtml(formatTimeLabel(wsExperimentLastAckAt))} · result: ${escapeHtml(wsExperimentLastResultStatus || "-")} @ ${escapeHtml(formatTimeLabel(wsExperimentLastResultAt))}</div>
              <div>enabled commands: ${escapeHtml(enabledCommandsPreview)}</div>
              <div>inspection support: ${escapeHtml(inspectionSupportLabel)} · parity: ${escapeHtml(inspectionParityLabel)} @ ${escapeHtml(formatTimeLabel(wsInspectionLastAt))}</div>
              <div>inspection note: ${escapeHtml(wsInspectionLastNote || "-")} · verify: ${escapeHtml(inspectionVerifyLabel)}</div>
              <div>last msg type: ${escapeHtml(wsExperimentLastMessageType || "-")}</div>
              <div>reason: ${escapeHtml(wsExperimentLastReason || wsReason)}</div>
              <div>recommendation: ${escapeHtml(wsExperimentFallbackRecommendation)}</div>
              <div>url: ${escapeHtml(wsExperimentLastUrl || buildWsExperimentUrl() || "-")}</div>
            </div>
          </div>
        `;
      }

      function renderEventStreamBadge() {
        if (!streamBadgeEl) {
          return;
        }
        const mode = getOperationalModeSnapshot();
        streamBadgeEl.textContent = mode.label;
        streamBadgeEl.className = "stream-badge";
        streamBadgeEl.classList.add(mode.tone);
        streamBadgeEl.title = `${mode.summary}${mode.reason ? ` · ${mode.reason}` : ""}`;
        renderRealtimeDebugPanel();
      }

      function clearEventRefreshDebounce() {
        if (eventsRefreshDebounceTimer) {
          clearTimeout(eventsRefreshDebounceTimer);
          eventsRefreshDebounceTimer = null;
        }
      }

      function clearEventReconnectTimer() {
        if (eventsReconnectTimer) {
          clearTimeout(eventsReconnectTimer);
          eventsReconnectTimer = null;
        }
        eventsReconnectDueAt = null;
      }

      function shouldUseEventStream() {
        if (!bridgeEnabled) {
          return false;
        }
        if (!bridgeOrigin) {
          return false;
        }
        if (!bridgeConnected) {
          return false;
        }
        return typeof EventSource !== "undefined";
      }

      function buildEventStreamUrl() {
        if (!bridgeOrigin) {
          return null;
        }
        const url = new URL(`${bridgeOrigin}/api/events`);
        const activePluginId = getPluginId();
        if (activePluginId) {
          url.searchParams.set("pluginId", activePluginId);
        }
        url.searchParams.set("channel", "plugin-ui");
        return url.toString();
      }

      function closeEventStream() {
        if (eventsSource) {
          eventsSource.close();
          eventsSource = null;
        }
        eventsConnected = false;
        renderEventStreamBadge();
      }

      function queueEventDrivenRefresh(next = {}) {
        eventsRefreshPending.sessions = eventsRefreshPending.sessions || Boolean(next.sessions);
        eventsRefreshPending.runtimeOps =
          eventsRefreshPending.runtimeOps || Boolean(next.runtimeOps);
        eventsRefreshPending.detail = eventsRefreshPending.detail || Boolean(next.detail);
        if (eventsRefreshDebounceTimer) {
          return;
        }
        eventsRefreshDebounceTimer = setTimeout(async () => {
          eventsRefreshDebounceTimer = null;
          const pending = { ...eventsRefreshPending };
          eventsRefreshPending = {
            sessions: false,
            runtimeOps: false,
            detail: false
          };
          if (!bridgeEnabled || !bridgeConnected) {
            return;
          }
          if (pending.sessions) {
            eventDrivenSessionRefreshCount += 1;
            await refreshSessionsList();
          }
          if (pending.runtimeOps) {
            eventDrivenRuntimeRefreshCount += 1;
            await refreshRuntimeOps();
          }
          if (pending.detail) {
            eventDrivenDetailRefreshCount += 1;
            await refreshSelectedNodeDetails({ force: true });
          }
        }, EVENT_STREAM_REFRESH_DEBOUNCE_MS);
      }

      function normalizeRealtimeEventPayload(rawMessageData, eventType) {
        let parsed = null;
        if (typeof rawMessageData === "string" && rawMessageData.trim()) {
          try {
            parsed = JSON.parse(rawMessageData);
          } catch (error) {
            parsed = null;
          }
        }

        if (parsed && typeof parsed === "object") {
          return {
            event: typeof parsed.event === "string" ? parsed.event : eventType || "message",
            payload:
              parsed.payload && typeof parsed.payload === "object"
                ? parsed.payload
                : parsed,
            sequence:
              typeof parsed.sequence === "number" && Number.isFinite(parsed.sequence)
                ? parsed.sequence
                : null,
            at: typeof parsed.at === "string" ? parsed.at : null
          };
        }

        return {
          event: eventType || "message",
          payload: null,
          sequence: null,
          at: null
        };
      }

      function processRealtimeEvent(eventName, payload = {}) {
        if (!eventName) {
          return;
        }
        if (eventName === "health.changed") {
          queueEventDrivenRefresh({ runtimeOps: true });
          return;
        }
        if (
          eventName === "session.registered" ||
          eventName === "session.heartbeat" ||
          eventName === "session.state_changed"
        ) {
          queueEventDrivenRefresh({ sessions: true, runtimeOps: true });
          return;
        }
        if (eventName === "queue.updated") {
          queueEventDrivenRefresh({ runtimeOps: true });
          return;
        }
        if (
          eventName === "command.enqueued" ||
          eventName === "command.delivered" ||
          eventName === "command.completed" ||
          eventName === "command.failed"
        ) {
          lastCommandActivityAt = Date.now();
          queueEventDrivenRefresh({ runtimeOps: true });
          return;
        }
        if (eventName === "selection.changed") {
          if (Array.isArray(payload.selection)) {
            pendingSelection = payload.selection;
          }
          queueEventDrivenRefresh({ detail: true });
          return;
        }
        if (eventName === "detail.refreshed") {
          queueEventDrivenRefresh({ detail: true });
          return;
        }
        if (
          eventName === "handoff.created" ||
          eventName === "handoff.claimed" ||
          eventName === "handoff.completed"
        ) {
          if (payload?.handoff && typeof payload.handoff === "object") {
            applyDesignerHandoffState(payload.handoff, eventName);
          }
          refreshDesignerHandoffLog();
        }
      }

      function handleRealtimeMessage(messageEvent, eventType) {
        const parsed = normalizeRealtimeEventPayload(messageEvent?.data, eventType);
        eventsTotalCount += 1;
        eventsLastEventName = parsed.event || eventType || "message";
        if (typeof parsed.sequence === "number") {
          if (typeof eventsLastSequence === "number" && parsed.sequence <= eventsLastSequence) {
            return;
          }
          eventsLastSequence = parsed.sequence;
        }
        eventsLastAt = new Date().toLocaleTimeString();
        eventsLastAtMs = Date.now();
        renderEventStreamBadge();
        processRealtimeEvent(parsed.event, parsed.payload || {});
      }

      function scheduleEventStreamReconnect() {
        if (!shouldUseEventStream()) {
          return;
        }
        if (eventsReconnectTimer) {
          return;
        }
        eventsReconnectDueAt = Date.now() + EVENT_STREAM_RECONNECT_MS;
        eventsReconnectTimer = setTimeout(() => {
          eventsReconnectTimer = null;
          eventsReconnectDueAt = null;
          ensureEventStream();
        }, EVENT_STREAM_RECONNECT_MS);
        renderRealtimeDebugPanel();
      }

      function ensureEventStream(options = {}) {
        if (!shouldUseEventStream()) {
          closeEventStream();
          clearEventReconnectTimer();
          return;
        }

        const streamUrl = buildEventStreamUrl();
        if (!streamUrl) {
          closeEventStream();
          return;
        }
        if (
          eventsSource &&
          !options.forceRestart &&
          typeof eventsSource.url === "string" &&
          eventsSource.url === streamUrl
        ) {
          return;
        }

        closeEventStream();
        clearEventReconnectTimer();
        eventsLastSequence = null;
        try {
          eventsSource = new EventSource(streamUrl);
        } catch (error) {
          eventsConnected = false;
          eventsLastError = error instanceof Error ? error.message : String(error);
          renderEventStreamBadge();
          scheduleEventStreamReconnect();
          return;
        }

        eventsSource.onopen = () => {
          eventsConnected = true;
          eventsLastError = null;
          eventsReconnectDueAt = null;
          eventsLastAt = new Date().toLocaleTimeString();
          eventsLastAtMs = Date.now();
          recordStatusTrendSample();
          renderEventStreamBadge();
        };

        eventsSource.onmessage = (event) => {
          handleRealtimeMessage(event, "message");
        };

        const knownEvents = [
          "health.changed",
          "session.registered",
          "session.heartbeat",
          "session.state_changed",
          "queue.updated",
          "command.enqueued",
          "command.delivered",
          "command.completed",
          "command.failed",
          "selection.changed",
          "detail.refreshed",
          "handoff.created",
          "handoff.claimed",
          "handoff.completed"
        ];
        knownEvents.forEach((name) => {
          eventsSource.addEventListener(name, (event) => {
            handleRealtimeMessage(event, name);
          });
        });

        eventsSource.onerror = () => {
          eventsConnected = false;
          eventsLastError = "연결이 끊겨 폴링으로 대체되었습니다.";
          recordStatusTrendSample();
          renderEventStreamBadge();
          closeEventStream();
          scheduleEventStreamReconnect();
        };

        renderEventStreamBadge();
      }

      function formatDuration(ms) {
        if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) {
          return "-";
        }
        if (ms < 1000) {
          return `${Math.round(ms)}ms`;
        }
        const seconds = ms / 1000;
        if (seconds < 60) {
          return `${seconds.toFixed(1)}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainSeconds = Math.round(seconds % 60);
        return `${minutes}m ${remainSeconds}s`;
      }

      function getPollProfile() {
        if (!bridgeEnabled || runtimeState === "paused") {
          return "stale";
        }
        if (!bridgeConnected || needsReconnect || !bridgeOrigin) {
          return "stale";
        }
        if (!sessionRegistered || needsReregister || runtimeState === "waiting_session") {
          return "waitingSession";
        }
        const commandReadiness = getLatestCommandReadiness();
        const activeSessionResolution = getLatestActiveSessionResolution();
        if (
          eventsConnected &&
          !wsCommandConnected &&
          (activeSessionResolution?.status === "single" ||
            activeSessionResolution?.status === "default") &&
          commandReadiness?.status === "ready"
        ) {
          return "standby";
        }
        const now = Date.now();
        if (
          runtimeState === "executing" ||
          (lastCommandActivityAt && now - lastCommandActivityAt <= ACTIVE_POLL_GRACE_MS)
        ) {
          return "active";
        }
        return "idle";
      }

      function getPollProfileLabel() {
        const profile = getPollProfile();
        if (profile === "active") {
          return "활성";
        }
        if (profile === "standby") {
          return "스트리밍 대기";
        }
        if (profile === "waitingSession") {
          return "세션 대기";
        }
        if (profile === "stale") {
          return "복구/유휴";
        }
        return "일반";
      }

      function getPollIntervalMs() {
        const profile = getPollProfile();
        let baseInterval = POLL_INTERVALS_MS.idle;
        if (profile === "active") {
          baseInterval = POLL_INTERVALS_MS.active;
        } else if (profile === "standby") {
          baseInterval = POLL_INTERVALS_MS.standby;
        } else if (profile === "waitingSession") {
          baseInterval = POLL_INTERVALS_MS.waitingSession;
        } else if (profile === "stale") {
          baseInterval = POLL_INTERVALS_MS.stale;
        }

        if (pollConsecutiveFailures > 0) {
          const backoff = Math.min(
            POLL_INTERVALS_MS.backoffMax,
            POLL_INTERVALS_MS.backoffBase * 2 ** (pollConsecutiveFailures - 1)
          );
          return Math.max(baseInterval, backoff);
        }

        return baseInterval;
      }

      function buildKv(entries) {
        return `
          <div class="kv">
            ${entries
              .map(
                (entry) => `
                  <div class="kv-label">${escapeHtml(entry.label)}</div>
                  <div class="kv-value">${escapeHtml(entry.value)}</div>
                `
              )
              .join("")}
          </div>
        `;
      }

      function getMetricToneFromScore(score) {
        if (!Number.isFinite(score)) {
          return "warn";
        }
        if (score >= 0.75) {
          return "good";
        }
        if (score >= 0.45) {
          return "warn";
        }
        return "danger";
      }

      function clampMetricScore(score) {
        if (!Number.isFinite(score)) {
          return 0;
        }
        return Math.max(0, Math.min(1, score));
      }

      function formatMetricPercent(score) {
        return `${Math.round(clampMetricScore(score) * 100)}%`;
      }

      function getTransportHealthScore(transportHealth) {
        const grade = transportHealth?.grade || "standby";
        if (grade === "healthy") {
          return 0.95;
        }
        if (grade === "degraded") {
          return 0.58;
        }
        if (grade === "unhealthy") {
          return 0.24;
        }
        return 0.4;
      }

      function getCommandReadinessScore(commandReadiness) {
        const status = commandReadiness?.status || "unknown";
        if (status === "ready") {
          return 0.94;
        }
        if (status === "degraded") {
          return 0.55;
        }
        if (status === "unavailable") {
          return 0.2;
        }
        return 0.4;
      }

      function getLatencyScore(ms) {
        if (!Number.isFinite(ms)) {
          return 0.4;
        }
        if (ms <= 80) {
          return 0.95;
        }
        if (ms <= 180) {
          return 0.8;
        }
        if (ms <= 400) {
          return 0.58;
        }
        return 0.28;
      }

      function getActivityStateLabel(count, connectedLabel, idleLabel) {
        return Number(count || 0) > 0 ? connectedLabel : idleLabel;
      }

      function buildMetricCard({
        title,
        value,
        caption,
        score,
        tooltip,
        chips = [],
        miniItems = []
      }) {
        const tone = getMetricToneFromScore(score);
        const chipMarkup = chips.length
          ? `
              <div class="metric-chip-row">
                ${chips
                  .map(
                    (chip) => `
                      <div class="metric-chip ${escapeHtml(chip.tone || "warn")}">${escapeHtml(chip.label)}</div>
                    `
                  )
                  .join("")}
              </div>
            `
          : "";
        const miniMarkup = miniItems.length
          ? `
              <div class="metric-mini-grid">
                ${miniItems
                  .map(
                    (item) => `
                      <div class="metric-mini" tabindex="0" data-tip="${escapeHtml(item.tip || "")}">
                        <div class="metric-mini-label">${escapeHtml(item.label)}</div>
                        <div class="metric-mini-value">${escapeHtml(item.value)}</div>
                        <div class="metric-mini-state">${escapeHtml(item.state)}</div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
          : "";
        return `
          <div class="metric-card ${tone}" tabindex="0" data-tip="${escapeHtml(tooltip)}">
            <div class="metric-kicker">${escapeHtml(title)}</div>
            <div class="metric-value">${escapeHtml(value)}</div>
            <div class="metric-caption">${escapeHtml(caption)}</div>
            <div class="metric-bar" aria-hidden="true">
              <div class="metric-bar-fill" style="width: ${formatMetricPercent(score)}"></div>
            </div>
            ${chipMarkup}
            ${miniMarkup}
          </div>
        `;
      }

      function appendTrendSample(target, sample, limit = STATUS_TREND_LIMIT) {
        if (!Array.isArray(target)) {
          return target;
        }
        target.push(sample);
        if (target.length > limit) {
          target.splice(0, target.length - limit);
        }
        return target;
      }

      function deriveRouteState(activeClients = {}) {
        if (!bridgeEnabled || !bridgeConnected) {
          return {
            tone: "danger",
            label: "오프라인",
            tip: "서버와 연결되지 않아 실시간/백업 경로 모두 대기 중입니다."
          };
        }
        if (wsCommandConnected || Number(activeClients.ws ?? 0) > 0) {
          return {
            tone: "good",
            label: "WS",
            tip: "실시간 명령 채널이 직접 명령을 처리하고 있습니다."
          };
        }
        if (eventsConnected || Number(activeClients.sse ?? 0) > 0) {
          return {
            tone: "warn",
            label: "SSE+폴링",
            tip: "상태 스트림은 연결되어 있지만, 명령은 백업 폴링이 보조합니다."
          };
        }
        return {
          tone: "idle",
          label: "대기",
          tip: "실시간 연결 신호가 없어 다음 확인을 기다리는 중입니다."
        };
      }

      function recordStatusTrendSample() {
        const transportHealth = getLatestTransportHealth();
        const commandReadiness = getLatestCommandReadiness();
        const activeClients = transportHealth?.activeClients || {};
        const recent = transportHealth?.recent || {};
        appendTrendSample(transportTrendSamples, {
          score: getTransportHealthScore(transportHealth),
          tone: getMetricToneFromScore(getTransportHealthScore(transportHealth)),
          label: formatTransportHealthGradeLabel(transportHealth?.grade || "-"),
          tip: [
            `실시간 연결 상태: ${formatTransportHealthGradeLabel(transportHealth?.grade || "-")}`,
            `상태 알림 ${String(activeClients.sse ?? 0)}개, 실시간 명령 ${String(activeClients.ws ?? 0)}개`,
            `백업 처리 ${String(recent.recentFallbackTotal ?? 0)}회`
          ].join(" · ")
        });
        appendTrendSample(readinessTrendSamples, {
          score: getCommandReadinessScore(commandReadiness),
          tone: getMetricToneFromScore(getCommandReadinessScore(commandReadiness)),
          tip: [
            `명령 준비: ${formatCommandReadinessStatusLabel(commandReadiness?.status || "-")}`,
            `이유: ${formatReadinessReasonLabel(commandReadiness?.reason || "-")}`,
            commandReadiness?.summary || "요약 없음"
          ].join(" · ")
        });
        appendTrendSample(latencyTrendSamples, {
          score: getLatencyScore(healthLatencyMs),
          tone: getMetricToneFromScore(getLatencyScore(healthLatencyMs)),
          value: formatLatency(healthLatencyMs),
          tip: `응답 속도 ${formatLatency(healthLatencyMs)} · 마지막 폴링 ${formatTimeLabel(lastPollAt)}`
        });
        const routeState = deriveRouteState(activeClients);
        appendTrendSample(routeTimelineSamples, routeState);
      }

      function buildSparkline(samples, { lowLabel = "이전", highLabel = "지금" } = {}) {
        const total = Array.isArray(samples) ? samples.length : 0;
        const latest = total > 0 ? samples[total - 1] : null;
        const dangerCount = Array.isArray(samples)
          ? samples.filter((sample) => sample.tone === "danger").length
          : 0;
        const warnCount = Array.isArray(samples)
          ? samples.filter((sample) => sample.tone === "warn").length
          : 0;
        if (!Array.isArray(samples) || samples.length === 0) {
          return `
            <div class="trend-card">
              <div class="trend-head">
                <div class="trend-title">실시간 연결 흐름</div>
                <div class="trend-meta">아직 표본이 없습니다.</div>
              </div>
              <div class="trend-summary">상태 샘플이 쌓이면 최근 연결 흐름을 분석 카드처럼 보여줍니다.</div>
            </div>
          `;
        }
        return `
          <div class="trend-card">
            <div class="trend-head">
              <div class="trend-title">실시간 연결 흐름</div>
              <div class="trend-meta">최근 ${samples.length}회 상태 반영</div>
            </div>
            <div class="trend-kpi">
              <div class="trend-value">${escapeHtml(latest?.label || "미표시")}</div>
              <div class="trend-pill ${escapeHtml(latest?.tone || "warn")}">${escapeHtml(`${dangerCount}회 불안정`)}</div>
            </div>
            <div class="trend-summary">
              최근 ${samples.length}회 중 ${dangerCount}회는 불안정, ${warnCount}회는 주의 상태였습니다.
              ${dangerCount === samples.length ? "최근 흐름 전반이 좋지 않습니다." : "조금씩 변동이 보입니다."}
            </div>
            <div class="trend-help">아래 차트는 왼쪽이 이전, 오른쪽이 최신입니다. 막대가 높을수록 연결 품질이 더 좋습니다.</div>
            <div class="trend-legend" aria-hidden="true">
              <div class="trend-legend-item good"><span class="trend-legend-dot"></span>안정</div>
              <div class="trend-legend-item warn"><span class="trend-legend-dot"></span>주의</div>
              <div class="trend-legend-item danger"><span class="trend-legend-dot"></span>불안정</div>
            </div>
            <div class="sparkline">
              ${samples
                .map(
                  (sample) => `
                    <div class="sparkline-bar ${escapeHtml(sample.tone || "warn")}" tabindex="0" aria-label="${escapeHtml(sample.tip || "")}" data-tip="${escapeHtml(sample.tip || "")}">
                      <div class="sparkline-bar-fill" style="height: ${formatMetricPercent(sample.score || 0)}"></div>
                    </div>
                  `
                )
                .join("")}
            </div>
            <div class="sparkline-labels">
              <span>${escapeHtml(lowLabel)}</span>
              <span>${escapeHtml(highLabel)}</span>
            </div>
          </div>
        `;
      }

      function buildRouteTimeline(samples) {
        const total = Array.isArray(samples) ? samples.length : 0;
        const latest = total > 0 ? samples[total - 1] : null;
        const wsCount = Array.isArray(samples)
          ? samples.filter((sample) => sample.label === "WS").length
          : 0;
        const fallbackCount = Array.isArray(samples)
          ? samples.filter((sample) => sample.label === "SSE+폴링").length
          : 0;
        if (!Array.isArray(samples) || samples.length === 0) {
          return `
            <div class="trend-card">
              <div class="trend-head">
                <div class="trend-title">명령 전달 경로</div>
                <div class="trend-meta">표시할 경로 변화가 없습니다.</div>
              </div>
              <div class="trend-summary">명령 경로 샘플이 쌓이면 현재 방식과 최근 변화를 카드처럼 보여줍니다.</div>
            </div>
          `;
        }
        return `
          <div class="trend-card">
            <div class="trend-head">
              <div class="trend-title">명령 전달 경로</div>
              <div class="trend-meta">최근 ${samples.length}개 샘플</div>
            </div>
            <div class="trend-kpi">
              <div class="trend-value">${escapeHtml(latest?.label || "미표시")}</div>
              <div class="trend-pill ${escapeHtml(latest?.tone || "idle")}">${escapeHtml(`WS ${wsCount}회`)}</div>
            </div>
            <div class="trend-summary">
              최근 ${samples.length}개 중 WS 직접 전달은 ${wsCount}회, SSE+폴링 보조 전달은 ${fallbackCount}회였습니다.
              마지막 칸이 현재 경로입니다.
            </div>
            <div class="trend-help">아래 색 블록은 왼쪽이 이전, 오른쪽이 최신입니다. 노랑이 많을수록 백업 경로 의존이 큰 상태입니다.</div>
            <div class="trend-legend" aria-hidden="true">
              <div class="trend-legend-item good"><span class="trend-legend-dot"></span>WS</div>
              <div class="trend-legend-item warn"><span class="trend-legend-dot"></span>SSE+폴링</div>
              <div class="trend-legend-item danger"><span class="trend-legend-dot"></span>오프라인</div>
              <div class="trend-legend-item idle"><span class="trend-legend-dot"></span>대기</div>
            </div>
            <div class="timeline">
              ${samples
                .map(
                  (sample) => `
                    <div class="timeline-step ${escapeHtml(sample.tone || "idle")}" tabindex="0" aria-label="${escapeHtml(sample.tip || "")}" data-tip="${escapeHtml(sample.tip || "")}"></div>
                  `
                )
                .join("")}
            </div>
            <div class="sparkline-labels">
              <span>이전</span>
              <span>${escapeHtml(samples[samples.length - 1]?.label || "지금")}</span>
            </div>
          </div>
        `;
      }

      function buildStatusTrends() {
        return `
          <div class="status-trends">
            ${buildSparkline(transportTrendSamples, { lowLabel: "이전", highLabel: "실시간 연결" })}
            ${buildRouteTimeline(routeTimelineSamples)}
          </div>
        `;
      }

      function getDiagnosticToneRank(tone) {
        if (tone === "danger") {
          return 3;
        }
        if (tone === "warn") {
          return 2;
        }
        if (tone === "good") {
          return 1;
        }
        return 0;
      }

      function getStrongestDiagnosticTone(groups) {
        const strongest = (Array.isArray(groups) ? groups : []).reduce(
          (current, group) =>
            getDiagnosticToneRank(group.tone) > getDiagnosticToneRank(current) ? group.tone : current,
          "good"
        );
        return strongest || "good";
      }

      function buildDiagnosticGlance(groups, context = {}) {
        const tone = getStrongestDiagnosticTone(groups);
        const pills = [
          {
            label: "연결",
            value: context.transportLabel || "확인 중",
            tone: context.transportTone || tone
          },
          {
            label: "명령",
            value: context.readinessLabel || "확인 중",
            tone: context.readinessTone || tone
          },
          {
            label: "응답",
            value: context.latencyLabel || "측정 전",
            tone: context.latencyTone || "warn"
          }
        ];
        return `
          <section class="diagnostic-glance ${escapeHtml(tone)}" aria-label="브리지 핵심 요약">
            <div>
              <div class="diagnostic-eyebrow">한눈에 보기</div>
              <div class="diagnostic-headline">${escapeHtml(context.headline || "브리지 상태를 확인 중입니다.")}</div>
              <div class="diagnostic-copy">${escapeHtml(context.copy || "자세한 진단은 아래 그룹 버튼에서 필요한 항목만 열어보세요.")}</div>
            </div>
            <div class="diagnostic-pill-stack" aria-label="핵심 지표">
              ${pills
                .map(
                  (pill) => `
                    <div class="diagnostic-pill ${escapeHtml(pill.tone || "warn")}">
                      <span>${escapeHtml(pill.label)}</span>
                      <strong>${escapeHtml(pill.value)}</strong>
                    </div>
                  `
                )
                .join("")}
            </div>
          </section>
        `;
      }

      function buildDiagnosticLauncher(groups) {
        if (!Array.isArray(groups) || groups.length === 0) {
          return "";
        }
        latestServerDiagnosticGroups = groups;
        return `
          <section class="diagnostic-groups" aria-label="상세 진단 그룹">
            <div class="diagnostic-groups-head">
              <div class="diagnostic-groups-title">상세 정보</div>
              <div class="diagnostic-groups-hint">필요한 그룹만 열어보세요</div>
            </div>
            <div class="diagnostic-action-grid">
              ${groups
                .map(
                  (group) => `
                    <button class="diagnostic-action" type="button" data-diagnostic-group="${escapeHtml(group.id)}">
                      <span class="diagnostic-action-top">
                        <span class="diagnostic-action-label">${escapeHtml(group.title)}</span>
                        <span class="diagnostic-action-status ${escapeHtml(group.tone || "warn")}">${escapeHtml(group.status)}</span>
                      </span>
                      <span class="diagnostic-action-summary">${escapeHtml(group.summary)}</span>
                      <span class="diagnostic-action-more">자세히 보기</span>
                    </button>
                  `
                )
                .join("")}
            </div>
          </section>
        `;
      }

      function buildServerOverview() {
        const transportHealth = getLatestTransportHealth();
        const commandReadiness = getLatestCommandReadiness();
        const mode = getOperationalModeSnapshot();
        const healthScore = getTransportHealthScore(transportHealth);
        const readinessScore = getCommandReadinessScore(commandReadiness);
        const latencyScore = getLatencyScore(healthLatencyMs);
        const activeClients = transportHealth?.activeClients || {};
        const recent = transportHealth?.recent || {};
        const fallbackCount = Number(recent.recentFallbackTotal ?? 0);
        const fallbackRate = Number.isFinite(transportHealth?.fallbackRate)
          ? `${Math.round(transportHealth.fallbackRate * 100)}%`
          : "측정 전";
        const wsConnected = Number(activeClients.ws ?? 0) > 0 || wsCommandConnected;
        const sseConnected = Number(activeClients.sse ?? 0) > 0 || eventsConnected;
        const transportTooltip = [
          `실시간 연결의 전체 품질입니다.`,
          `현재 등급: ${formatTransportHealthGradeLabel(transportHealth?.grade || "-")}`,
          `상태 알림 연결 ${String(activeClients.sse ?? 0)}개, 실시간 명령 연결 ${String(activeClients.ws ?? 0)}개를 기준으로 계산합니다.`
        ].join(" ");
        const readinessTooltip = [
          `실제 명령을 받아 처리할 준비 상태입니다.`,
          `상태가 '준비됨'이어도 세션 복구나 대기열 위험이 있으면 '주의'로 내려갈 수 있습니다.`,
          `현재 이유: ${formatReadinessReasonLabel(commandReadiness?.reason || "-")}`
        ].join(" ");
        const transportCard = buildMetricCard({
          title: "실시간 연결",
          value: formatTransportHealthGradeLabel(transportHealth?.grade || "-"),
          caption: transportHealth?.reason || "연결 신호를 수집 중입니다.",
          score: healthScore,
          tooltip: transportTooltip,
          chips: [
            {
              label: wsConnected ? "WS 연결 있음" : "WS 연결 없음",
              tone: wsConnected ? "good" : "warn"
            },
            {
              label: fallbackCount > 0 ? `백업 ${fallbackCount}회` : "백업 거의 없음",
              tone: fallbackCount > 0 ? "warn" : "good"
            }
          ],
          miniItems: [
            {
              label: "상태 알림",
              value: String(activeClients.sse ?? 0),
              state: getActivityStateLabel(activeClients.sse, "연결", "대기"),
              tip: "서버 상태 변화 알림용 SSE 연결 수입니다."
            },
            {
              label: "실시간 명령",
              value: String(activeClients.ws ?? 0),
              state: getActivityStateLabel(activeClients.ws, "연결", "없음"),
              tip: "실시간 명령을 직접 처리하는 WS 연결 수입니다."
            },
            {
              label: "백업 비율",
              value: fallbackRate,
              state: fallbackCount > 0 ? "백업 사용" : "안정",
              tip: "실시간 대신 폴링 백업이 사용된 비율입니다."
            }
          ]
        });
        const readinessCard = buildMetricCard({
          title: "명령 처리 준비",
          value: formatCommandReadinessStatusLabel(commandReadiness?.status || "-"),
          caption: commandReadiness?.summary || "명령 준비 상태를 수집 중입니다.",
          score: readinessScore,
          tooltip: readinessTooltip,
          chips: [
            {
              label: formatReadinessReasonLabel(commandReadiness?.reason || "-"),
              tone: getMetricToneFromScore(readinessScore)
            },
            {
              label: mode.label === "fallback" ? "복구 모드" : "즉시 처리 가능",
              tone: mode.label === "fallback" ? "warn" : "good"
            }
          ]
        });
        const routeCard = buildMetricCard({
          title: "명령 경로",
          value: getCommandTransportLabel(),
          caption: formatOperationalModeValue(mode),
          score: wsConnected ? 0.9 : sseConnected ? 0.58 : 0.28,
          tooltip:
            "지금 명령이 어떤 길로 전달되는지 보여줍니다. 실시간 명령(WS)이 가장 좋고, 백업 폴링은 복구용 경로입니다.",
          miniItems: [
            {
              label: "실시간 상태",
              value: getEventStreamStateLabel(),
              state: sseConnected ? "활성" : "대기",
              tip: "상태 변화 알림 스트림의 연결 상태입니다."
            },
            {
              label: "WS 명령",
              value: getWsCommandStateLabel(),
              state: wsConnected ? "우선 사용" : "백업 중",
              tip: "실시간 명령 채널의 현재 상태입니다."
            },
            {
              label: "폴링",
              value: `${getPollProfileLabel()} · ${currentPollIntervalMs}ms`,
              state: fallbackCount > 0 ? "보조 동작" : "대기",
              tip: "실시간 연결이 약할 때 명령을 백업으로 확인하는 주기입니다."
            }
          ]
        });
        const latencyCard = buildMetricCard({
          title: "응답 속도",
          value: formatLatency(healthLatencyMs),
          caption: `마지막 폴링 ${formatTimeLabel(lastPollAt)} · 폴링 지연 ${formatLatency(lastPollLatencyMs)}`,
          score: latencyScore,
          tooltip:
            "서버 health 응답 속도입니다. 낮을수록 좋습니다. 이 값이 높아지면 상태 조회나 명령 시작이 체감상 느려질 수 있습니다.",
          chips: [
            {
              label: Number.isFinite(healthLatencyMs) && healthLatencyMs <= 80 ? "빠름" : "확인 필요",
              tone:
                Number.isFinite(healthLatencyMs) && healthLatencyMs <= 80
                  ? "good"
                  : getMetricToneFromScore(latencyScore)
            },
            {
              label: `최근 연결 신호 ${formatSoakSignalValue()}`,
              tone: wsConnected || sseConnected ? "good" : "warn"
            }
          ]
        });
        const serverVersion =
          serverHealthSnapshot?.serverVersion || serverHealthSnapshot?.packageVersion || BRIDGE_VERSION;
        const packageVersion = serverHealthSnapshot?.packageVersion || BRIDGE_VERSION;
        const versionMismatch = Boolean(serverVersion && serverVersion !== BRIDGE_VERSION);
        const transportTone = getMetricToneFromScore(healthScore);
        const readinessTone = getMetricToneFromScore(readinessScore);
        const latencyTone = getMetricToneFromScore(latencyScore);
        const headline = (() => {
          if (versionMismatch) {
            return "서버는 연결됐지만 버전이 다릅니다.";
          }
          if (transportHealth?.grade === "healthy" && commandReadiness?.status === "ready") {
            return "지금 작업 가능한 상태입니다.";
          }
          if (transportHealth?.grade === "unhealthy") {
            return "연결이 불안정합니다.";
          }
          if (commandReadiness?.status && commandReadiness.status !== "ready") {
            return "연결은 있지만 명령 준비를 확인해야 합니다.";
          }
          return "브리지 상태를 확인 중입니다.";
        })();
        const glanceCopy = versionMismatch
          ? `실행 중인 서버 ${serverVersion}과 플러그인 UI ${BRIDGE_VERSION}이 다릅니다. 최신 서버로 다시 시작하면 표시가 맞춰집니다.`
          : commandReadiness?.summary ||
            transportHealth?.summary ||
            "상세 진단은 아래 버튼에서 필요한 그룹만 열어 확인할 수 있습니다.";
        const groups = [
          {
            id: "connection",
            title: "연결 상태",
            status: formatTransportHealthGradeLabel(transportHealth?.grade || "-"),
            tone: transportTone,
            summary: transportHealth?.summary || "실시간 연결 상태를 확인합니다.",
            subtitle: "SSE/WS 연결, 백업 처리, 최근 상태 변화를 한 곳에서 봅니다.",
            detailHtml: `
              ${transportCard}
              ${buildStatusTrends()}
              ${buildKv([
                { label: "상태 설명", value: transportHealth?.reason || "-" },
                { label: "상태 알림 연결", value: String(activeClients.sse ?? 0) },
                { label: "실시간 명령 연결", value: String(activeClients.ws ?? 0) },
                { label: "최근 백업 처리", value: String(recent.recentFallbackTotal ?? 0) },
                { label: "백업 비율", value: fallbackRate }
              ])}
            `
          },
          {
            id: "commands",
            title: "명령 처리",
            status: formatCommandReadinessStatusLabel(commandReadiness?.status || "-"),
            tone: readinessTone,
            summary: commandReadiness?.summary || "명령 처리 준비 상태를 확인합니다.",
            subtitle: "AI/에이전트 요청을 지금 바로 처리할 수 있는지 봅니다.",
            detailHtml: `
              <div class="status-overview">${readinessCard}${routeCard}</div>
              ${buildKv([
                { label: "준비 이유", value: formatReadinessReasonLabel(commandReadiness?.reason || "-") },
                { label: "활성 플러그인", value: String(commandReadiness?.activePluginCount ?? 0) },
                { label: "복구 대기", value: String(commandReadiness?.pendingRecoveryTotal ?? 0) },
                { label: "최근 명령 만료", value: commandReadiness?.recentExpiredCommand ? "있음" : "없음" },
                { label: "가장 오래 대기한 명령", value: formatDuration(commandReadiness?.oldestUndeliveredMs) },
                { label: "현재 명령 경로", value: getCommandTransportLabel() }
              ])}
            `
          },
          {
            id: "server",
            title: "서버/버전",
            status: versionMismatch ? "확인 필요" : "정상",
            tone: versionMismatch ? "warn" : "good",
            summary: versionMismatch
              ? `서버 ${serverVersion}과 UI ${BRIDGE_VERSION}이 다릅니다.`
              : `서버와 UI가 ${BRIDGE_VERSION}로 맞춰져 있습니다.`,
            subtitle: "현재 실행 중인 브리지 버전과 지원 기능을 확인합니다.",
            detailHtml: buildKv([
              { label: "서버 버전", value: serverVersion },
              { label: "패키지 버전", value: packageVersion },
              { label: "UI 버전", value: BRIDGE_VERSION },
              { label: "지원 연결 방식", value: formatFeatureSummary(serverHealthSnapshot?.transportCapabilities) },
              { label: "현재 동작 기능", value: formatFeatureSummary(serverHealthSnapshot?.runtimeFeatureFlags) }
            ])
          },
          {
            id: "performance",
            title: "응답 속도",
            status: formatLatency(healthLatencyMs),
            tone: latencyTone,
            summary: `서버 응답 ${formatLatency(healthLatencyMs)} · 마지막 확인 ${formatTimeLabel(lastPollAt)}`,
            subtitle: "브리지 상태 조회와 폴링 지연을 확인합니다.",
            detailHtml: `
              ${latencyCard}
              ${buildKv([
                { label: "서버 응답 시간", value: formatLatency(healthLatencyMs) },
                { label: "마지막 폴링", value: formatTimeLabel(lastPollAt) },
                { label: "폴링 지연", value: formatLatency(lastPollLatencyMs) },
                { label: "폴링 상태", value: `${getPollProfileLabel()} · ${currentPollIntervalMs}ms` },
                { label: "최근 연결 신호", value: formatSoakSignalValue() },
                { label: "현재 운영 상태", value: formatOperationalModeValue(mode) }
              ])}
            `
          }
        ];
        return `
          ${buildDiagnosticGlance(groups, {
            headline,
            copy: glanceCopy,
            transportLabel: formatTransportHealthGradeLabel(transportHealth?.grade || "-"),
            transportTone,
            readinessLabel: formatCommandReadinessStatusLabel(commandReadiness?.status || "-"),
            readinessTone,
            latencyLabel: formatLatency(healthLatencyMs),
            latencyTone
          })}
          ${buildDiagnosticLauncher(groups)}
        `;
      }

      function setServerHealthSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== "object") {
          serverHealthSnapshot = null;
          return;
        }
        serverHealthSnapshot = snapshot;
        recordStatusTrendSample();
      }

      function normalizeEnabledFeatureNames(features) {
        if (!features || typeof features !== "object") {
          return [];
        }
        return Object.entries(features)
          .filter(([, value]) => value === true)
          .map(([key]) => key);
      }

      function formatFeatureSummary(features, emptyLabel = "미표시") {
        const labels = normalizeEnabledFeatureNames(features).map(
          (name) => SERVER_FEATURE_LABELS[name] || name
        );
        return labels.length > 0 ? labels.join(" · ") : emptyLabel;
      }

      function getLatestTransportHealth() {
        return (
          runtimeOpsSnapshot?.transportHealth ||
          runtimeOpsSnapshot?.observability?.transportHealth ||
          serverHealthSnapshot?.transportHealth ||
          null
        );
      }

      function getLatestCommandReadiness() {
        return runtimeOpsSnapshot?.commandReadiness || serverHealthSnapshot?.commandReadiness || null;
      }

      function getLatestActiveSessionResolution() {
        return (
          runtimeOpsSnapshot?.activeSessionResolution ||
          runtimeOpsSnapshot?.sessions?.activeSessionResolution ||
          serverHealthSnapshot?.activeSessionResolution ||
          null
        );
      }

      function shouldDelayPollingForWsRecovery() {
        const activeSessionResolution = getLatestActiveSessionResolution();
        const commandReadiness = getLatestCommandReadiness();
        return (
          bridgeConnected &&
          eventsConnected &&
          !wsCommandConnected &&
          Boolean(wsCommandReconnectDueAt) &&
          (activeSessionResolution?.status === "single" ||
            activeSessionResolution?.status === "default") &&
          commandReadiness?.status === "ready"
        );
      }

      function formatTransportHealthSummary(transportHealth) {
        if (!transportHealth || typeof transportHealth !== "object") {
          return "미표시";
        }
        const grade = formatTransportHealthGradeLabel(String(transportHealth.grade || "standby"));
        const activeClients = transportHealth.activeClients || {};
        const recent = transportHealth.recent || {};
        const fallbackRate = Number.isFinite(transportHealth.fallbackRate)
          ? `${Math.round(transportHealth.fallbackRate * 100)}%`
          : "-";
        return [
          grade,
          `상태 알림 ${String(activeClients.sse ?? 0)}`,
          `실시간 명령 ${String(activeClients.ws ?? 0)}`,
          `명령 확인 ${String(recent.recentWsAckTotal ?? 0)}`,
          `명령 결과 ${String(recent.recentWsResultTotal ?? 0)}`,
          `백업 처리 ${String(recent.recentFallbackTotal ?? 0)}`,
          `백업 비율 ${fallbackRate}`
        ].join(" · ");
      }

      function formatTransportHealthGradeLabel(grade) {
        if (grade === "healthy") {
          return "좋음";
        }
        if (grade === "degraded") {
          return "주의";
        }
        if (grade === "unhealthy") {
          return "불안정";
        }
        if (grade === "standby") {
          return "대기";
        }
        return grade || "미표시";
      }

      function formatCommandReadinessStatusLabel(status) {
        if (status === "ready") {
          return "준비됨";
        }
        if (status === "degraded") {
          return "주의";
        }
        if (status === "unavailable") {
          return "준비 안 됨";
        }
        return status || "미표시";
      }

      function formatReadinessReasonLabel(reason) {
        const reasonMap = {
          ready: "정상",
          no_active_plugin: "활성 세션 없음",
          session_recovery_pending: "세션 복구 중",
          queue_dispatch_ack_lag: "응답 지연",
          queue_backlog_risk: "대기열 밀림",
          queue_expiry_risk: "곧 시간 초과 위험",
          recent_command_expired: "최근 명령 만료",
          recent_command_failures: "최근 명령 실패"
        };
        return reasonMap[reason] || reason || "미표시";
      }

      function formatOperationalModeValue(mode) {
        if (!mode) {
          return "미표시";
        }
        const labelMap = {
          "WS-first": "실시간 우선",
          standby: "대기",
          reconnecting: "복구 중",
          fallback: "복구 모드",
          paused: "중지"
        };
        const soakMap = {
          "재개 전": "재개 전",
          "복구 중": "복구 진행 중",
          활성: "실시간 처리 중",
          대기: "즉시 처리 가능",
          "fallback active": "백업 처리 중",
          "session pending": "세션 대기 중",
          offline: "오프라인"
        };
        return `${labelMap[mode.label] || mode.label} · ${soakMap[mode.soak] || mode.soak}`;
      }

      function formatSoakSignalValue() {
        return `실시간 ${formatAgeLabel(eventsLastAtMs)} · WS ${formatAgeLabel(wsCommandLastAtMs)}`;
      }

      function getServerHealthAssessment() {
        if (!serverHealthSnapshot) {
          return {
            klass: "warn",
            badge: "서버 확인 필요",
            summary: "서버 health 응답을 아직 확인하지 못했습니다.",
            nextAction: "브리지를 다시 확인해 최신 서버를 찾으세요."
          };
        }

        const actualVersion = serverHealthSnapshot.serverVersion || serverHealthSnapshot.packageVersion || null;
        const versionMismatch = actualVersion && actualVersion !== BRIDGE_VERSION;
        const missingCapabilities = !serverHealthSnapshot.transportCapabilities;
        const missingRuntimeFlags = !serverHealthSnapshot.runtimeFeatureFlags;
        const missingTransportHealth = !getLatestTransportHealth();

        if (versionMismatch || missingCapabilities || missingRuntimeFlags || missingTransportHealth) {
          const reasons = [];
          if (versionMismatch) {
            reasons.push(`서버 버전 ${actualVersion}이 UI ${BRIDGE_VERSION}와 다릅니다.`);
          }
          if (missingCapabilities) {
            reasons.push("transport capability 정보가 없습니다.");
          }
          if (missingRuntimeFlags) {
            reasons.push("runtime feature flag 정보가 없습니다.");
          }
          if (missingTransportHealth) {
            reasons.push("transport health 요약이 없습니다.");
          }
          return {
            klass: "warn",
            badge: "최신 서버 확인 필요",
            summary: reasons.join(" "),
            nextAction:
              "이전 서버 프로세스가 남아 있을 수 있습니다. 터미널에서 기존 xbridge를 종료한 뒤 다시 시작하세요."
          };
        }

        return {
          klass: "ok",
          badge: "최신 서버",
          summary: "최신 서버와 연결되었습니다.",
          nextAction: "서버 버전과 transport 기능을 아래 메타에서 확인할 수 있습니다."
        };
      }

      function buildServerMeta() {
        const mode = getOperationalModeSnapshot();
        const serverVersion = serverHealthSnapshot?.serverVersion || serverHealthSnapshot?.packageVersion || BRIDGE_VERSION;
        const packageVersion = serverHealthSnapshot?.packageVersion || BRIDGE_VERSION;
        const transportCapabilities = formatFeatureSummary(serverHealthSnapshot?.transportCapabilities);
        const runtimeFeatureFlags = formatFeatureSummary(serverHealthSnapshot?.runtimeFeatureFlags);
        const transportHealth = getLatestTransportHealth();
        const commandReadiness = getLatestCommandReadiness();
        const transportHealthSummary = formatTransportHealthSummary(transportHealth);
        const transportHealthGrade = formatTransportHealthGradeLabel(transportHealth?.grade || "-");
        const transportHealthReason = transportHealth?.reason || "-";
        return buildKv([
          { label: "서버 버전", value: serverVersion },
          { label: "패키지 버전", value: packageVersion },
          { label: "지원 연결 방식", value: transportCapabilities },
          { label: "현재 동작 기능", value: runtimeFeatureFlags },
          { label: "실시간 연결 상태", value: transportHealthSummary },
          { label: "연결 상태 설명", value: transportHealthReason },
          { label: "연결 상태 등급", value: transportHealthGrade },
          { label: "명령 처리 준비", value: formatCommandReadinessStatusLabel(commandReadiness?.status || "-") },
          { label: "명령 준비 상태 설명", value: commandReadiness?.summary || "-" },
          { label: "명령 준비 상태 이유", value: formatReadinessReasonLabel(commandReadiness?.reason || "-") },
          { label: "응답 시간", value: formatLatency(healthLatencyMs) },
          { label: "현재 운영 상태", value: formatOperationalModeValue(mode) },
          { label: "운영 리스크", value: mode.risk },
          { label: "실시간 상태", value: getEventStreamStateLabel() },
          { label: "명령 전달 방식", value: getCommandTransportLabel() },
          { label: "WS 명령 채널", value: getWsCommandStateLabel() },
          { label: "WS 추가 점검", value: getWsExperimentStateLabel() },
          { label: "최근 연결 신호", value: formatSoakSignalValue() },
          { label: "폴링 상태", value: `${getPollProfileLabel()} · ${currentPollIntervalMs}ms` },
          { label: "마지막 폴링", value: formatTimeLabel(lastPollAt) },
          { label: "폴링 지연", value: formatLatency(lastPollLatencyMs) }
        ]);
      }

      function buildSessionMeta() {
        return buildKv([
          { label: "파일", value: currentFileName },
          { label: "페이지", value: currentPageLabel },
          { label: "마지막 세션 갱신", value: formatTimeLabel(lastSessionSyncAt) },
          { label: "마지막 페이지 동기화", value: formatTimeLabel(lastPageSyncAt) }
        ]);
      }

      function buildRuntimeMeta() {
        return buildKv([
          { label: "상태", value: runtimeState },
          { label: "복구 단계", value: recoveryPhase },
          { label: "명령", value: runtimeLastCommandType || "대기" },
          { label: "commandId", value: runtimeLastCommandId || "-" },
          { label: "사전 점검", value: runtimePreflightOk ? "통과" : "실패" },
          { label: "마지막 갱신", value: formatTimeLabel(runtimeLastUpdatedAt) }
        ]);
      }

      function classifyServerErrorCode(message) {
        const value = String(message || "");
        if (!value) {
          return null;
        }
        const lower = value.toLowerCase();
        if (lower.includes("no writable mcp bridge health endpoint found")) {
          return "ERR_SERVER_OFF";
        }
        if (lower.includes("eaddrinuse")) {
          return "ERR_PORT_IN_USE";
        }
        if (lower.includes("failed to fetch")) {
          return "ERR_NETWORK";
        }
        if (lower.includes("timeout") || lower.includes("timed out")) {
          return "ERR_TIMEOUT";
        }
        if (lower.includes("http 4") || lower.includes("http 5")) {
          return "ERR_SERVER_UNREACHABLE";
        }
        return "ERR_UNKNOWN";
      }

      function classifyRuntimeErrorCode(message, fallbackCode) {
        if (fallbackCode) {
          return fallbackCode;
        }
        const value = String(message || "");
        if (!value) {
          return null;
        }
        const lower = value.toLowerCase();
        if (lower.includes("no selection available")) {
          return "ERR_SELECTION_REQUIRED";
        }
        if (lower.includes("node not found")) {
          return "ERR_NODE_NOT_FOUND";
        }
        if (lower.includes("unsupported command type")) {
          return "ERR_UNSUPPORTED_COMMAND";
        }
        if (lower.includes("unsupported node type")) {
          return "ERR_UNSUPPORTED_NODE_TYPE";
        }
        if (lower.includes("invalid command payload")) {
          return "ERR_PREFLIGHT_INVALID_PAYLOAD";
        }
        return "ERR_RUNTIME_UNKNOWN";
      }

      function runtimeGuidanceFromCode(code, fallbackGuidance) {
        if (fallbackGuidance) {
          return fallbackGuidance;
        }
        switch (code) {
          case "ERR_SELECTION_REQUIRED":
            return "현재 페이지에서 대상 레이어를 선택한 뒤 같은 작업을 다시 실행하세요.";
          case "ERR_NODE_NOT_FOUND":
            return "대상 노드가 바뀌었을 수 있습니다. 선택을 다시 맞추고 명령을 재실행하세요.";
          case "ERR_UNSUPPORTED_COMMAND":
            return "지원되지 않는 명령입니다. 서버/플러그인 버전을 맞춘 뒤 다시 시도하세요.";
          case "ERR_UNSUPPORTED_NODE_TYPE":
            return "현재 선택한 노드 타입에서 지원되지 않는 작업입니다.";
          case "ERR_PREFLIGHT_COMMAND_REQUIRED":
          case "ERR_PREFLIGHT_COMMAND_ID_REQUIRED":
          case "ERR_PREFLIGHT_COMMAND_TYPE_REQUIRED":
          case "ERR_PREFLIGHT_INVALID_PAYLOAD":
            return "명령 페이로드 사전 점검에 실패했습니다. 세션 재등록 후 작업을 다시 요청하세요.";
          default:
            return "명령 실행 상태를 다시 확인하고 필요하면 세션 재등록 후 재시도하세요.";
        }
      }

      function renderStatus(target, summary, klass, meta, nextAction, badgeOverride) {
        const safeSummary = escapeHtml(summary || "").replace(/\n/g, "<br />");
        const safeMeta = meta
          ? String(meta).trim().startsWith("<")
            ? String(meta)
            : escapeHtml(meta).replace(/\n/g, "<br />")
          : "";
        const safeNextAction = nextAction ? escapeHtml(nextAction).replace(/\n/g, "<br />") : "";
        const badgeText = badgeOverride || (klass === "warn" ? "확인 필요" : "정상");
        target.className = `status${klass ? ` ${klass}` : ""}`;
        target.innerHTML = `
          <div class="${klass || ""}">
            <div class="status-badge">${badgeText}</div>
            <div class="status-summary">${safeSummary}</div>
            ${safeMeta ? `<div class="status-meta">${safeMeta}</div>` : ""}
            ${safeNextAction ? `<div class="status-next">${safeNextAction}</div>` : ""}
          </div>
        `;
      }

      function refreshServerStatus() {
        const healthAssessment = getServerHealthAssessment();
        setServerStatus(
          healthAssessment.summary,
          healthAssessment.klass,
          buildServerOverview(),
          healthAssessment.nextAction,
          healthAssessment.badge
        );
      }

      function closeDiagnosticModal() {
        if (!diagnosticModalEl) {
          return;
        }
        diagnosticModalEl.hidden = true;
      }

      function openDiagnosticModal(groupId) {
        if (!diagnosticModalEl || !diagnosticModalTitleEl || !diagnosticModalSubtitleEl || !diagnosticModalBodyEl) {
          return;
        }
        const group = latestServerDiagnosticGroups.find((item) => item.id === groupId);
        if (!group) {
          return;
        }
        diagnosticModalTitleEl.textContent = group.title;
        diagnosticModalSubtitleEl.textContent = group.subtitle || group.summary || "상세 진단 정보입니다.";
        diagnosticModalBodyEl.innerHTML = group.detailHtml || "";
        diagnosticModalEl.hidden = false;
      }

      function getHiddenPanelHtml(element, fallback) {
        const html = element?.innerHTML || "";
        return html.trim() ? html : `<div class="status"><div class="status-summary">${escapeHtml(fallback)}</div></div>`;
      }

      function openBridgeUtilityModal(kind) {
        if (!diagnosticModalEl || !diagnosticModalTitleEl || !diagnosticModalSubtitleEl || !diagnosticModalBodyEl) {
          return;
        }

        const bridgeActions = `
          <div class="bridge-modal-actions">
            <button class="bridge-modal-action" type="button" data-bridge-action="reconnect">브리지 재연결</button>
            <button class="bridge-modal-action" type="button" data-bridge-action="reregister">세션 재등록</button>
            <button class="bridge-modal-action" type="button" data-bridge-action="primary">권장 작업 실행</button>
          </div>
        `;
        const designerDetailCard = (title, metaEl, bodyEl, fallback) => `
          <div class="designer-preview-card">
            <div class="designer-preview-head">
              <div class="designer-preview-title">${escapeHtml(title)}</div>
              <div class="designer-preview-meta">${escapeHtml(metaEl?.textContent?.trim() || "idle")}</div>
            </div>
            <div class="designer-preview-body">${escapeHtml(bodyEl?.textContent?.trim() || fallback)}</div>
          </div>
        `;
        const groups = {
          designer: {
            title: "AI 디자이너 작업 상세",
            subtitle: "기본 화면에서 숨긴 요청 해석, 읽기 경로, 제안 초안, 구현 요청 기록입니다.",
            body: `
              <div class="designer-preview-grid">
                ${designerDetailCard("요청 해석", designerIntentMetaEl, designerIntentPreviewEl, "아직 디자인 요청이 없습니다.")}
                ${designerDetailCard("읽기 경로", designerReadPlanMetaEl, designerReadPlanPreviewEl, "아직 읽기 경로를 만들지 않았습니다.")}
                ${designerDetailCard("제안 초안", designerSuggestionMetaEl, designerSuggestionPreviewEl, "아직 제안 초안이 없습니다.")}
                ${designerDetailCard("구현 요청", designerHandoffMetaEl, designerHandoffPreviewEl, "아직 로컬 구현 요청이 없습니다.")}
              </div>
              <section class="designer-suggestion-actions">
                <div class="designer-suggestion-actions-head">
                  <div>
                    <div class="designer-suggestion-actions-title">추천 액션</div>
                    <div class="designer-suggestion-actions-meta">${escapeHtml(designerSuggestionActionsMetaEl?.textContent?.trim() || "아직 추천 액션이 없습니다.")}</div>
                  </div>
                </div>
                <div class="designer-suggestion-actions-list">
                  ${designerSuggestionActionsListEl?.innerHTML || "<div class=\"designer-suggestion-action-item\"><div class=\"designer-suggestion-action-title\">추천 액션이 없습니다.</div></div>"}
                </div>
              </section>
              <section class="designer-handoff-log">
                <div class="designer-handoff-log-head">
                  <div>
                    <div class="designer-handoff-log-title">최근 구현 요청</div>
                    <div class="designer-handoff-log-meta">${escapeHtml(designerHandoffLogMetaEl?.textContent?.trim() || "아직 handoff 기록이 없습니다.")}</div>
                  </div>
                  <button class="designer-inline-action" type="button" data-bridge-action="refresh-handoffs">목록 새로고침</button>
                </div>
                <div class="designer-handoff-log-list">
                  ${designerHandoffLogListEl?.innerHTML || "<div class=\"designer-handoff-log-item\"><div class=\"designer-handoff-log-item-title\">handoff 목록을 아직 불러오지 못했습니다.</div></div>"}
                </div>
              </section>
            `
          },
          health: {
            title: "연결/서버 상태",
            subtitle: "서버 버전, 연결 품질, 재연결이 필요한지 확인합니다.",
            body: `
              ${getHiddenPanelHtml(serverStatusEl, "서버 상태를 아직 확인하지 못했습니다.")}
              ${getHiddenPanelHtml(sessionStatusEl, "세션 상태를 아직 확인하지 못했습니다.")}
              ${bridgeActions}
            `
          },
          commands: {
            title: "명령 처리 상태",
            subtitle: "AI 디자이너 요청을 브리지가 처리할 준비가 되었는지 확인합니다.",
            body: `
              ${getHiddenPanelHtml(runtimeStatusEl, "명령 실행 상태를 아직 확인하지 못했습니다.")}
              <section class="status">
                <div class="status-badge">권장 작업</div>
                <div class="status-summary">${escapeHtml(primaryActionDescEl?.textContent || "권장 작업을 확인 중입니다.")}</div>
                ${actionHelpEl?.innerHTML ? `<div class="status-meta">${actionHelpEl.innerHTML}</div>` : ""}
              </section>
              ${bridgeActions}
            `
          },
          selection: {
            title: "선택 노드 정보",
            subtitle: "현재 Figma에서 선택한 레이어의 읽기 결과를 확인합니다.",
            body: `
              <section class="detail-panel">
                <div class="detail-head">
                  <div class="detail-title">선택 노드 세부</div>
                  <button class="detail-refresh" type="button" data-bridge-action="refresh-detail">세부 새로고침</button>
                </div>
                <div class="detail-grid">${detailGridEl?.innerHTML || "<div class=\"detail-item\"><div class=\"detail-item-title\">선택 노드 정보를 아직 불러오지 못했습니다.</div></div>"}</div>
              </section>
            `
          },
          advanced: {
            title: "고급 진단",
            subtitle: "세션, 운영 진단, 실시간 디버그 정보입니다. 문제가 있을 때만 보면 됩니다.",
            body: `
              <section class="sessions-panel">
                <div class="sessions-head">
                  <div class="sessions-title">활성 세션</div>
                  <button class="sessions-refresh" type="button" data-bridge-action="refresh-sessions">목록 새로고침</button>
                </div>
                <div class="sessions-list">${sessionsListEl?.innerHTML || "<div class=\"session-item\"><div class=\"session-item-title\">세션 목록을 아직 불러오지 못했습니다.</div></div>"}</div>
              </section>
              <section class="ops-panel">
                <div class="ops-head">
                  <div class="ops-title">운영 진단</div>
                  <button class="ops-refresh" type="button" data-bridge-action="refresh-ops">진단 새로고침</button>
                </div>
                <div class="ops-grid">${opsGridEl?.innerHTML || "<div class=\"ops-item\"><div class=\"ops-item-title\">운영 진단을 아직 불러오지 못했습니다.</div></div>"}</div>
              </section>
              <section class="realtime-panel">
                <div class="realtime-head">
                  <div class="realtime-title">실시간 디버그</div>
                  <div class="realtime-actions">
                    <button class="realtime-refresh" type="button" data-bridge-action="refresh-realtime">스트림 재확인</button>
                    <button class="realtime-ws-check" type="button" data-bridge-action="check-ws">WS 실험 체크</button>
                  </div>
                </div>
                <div class="realtime-grid">${realtimeGridEl?.innerHTML || "<div class=\"realtime-item\"><div class=\"realtime-item-title\">실시간 상태를 아직 불러오지 못했습니다.</div></div>"}</div>
              </section>
            `
          }
        };

        const group = groups[kind];
        if (!group) {
          return;
        }
        diagnosticModalTitleEl.textContent = group.title;
        diagnosticModalSubtitleEl.textContent = group.subtitle;
        diagnosticModalBodyEl.innerHTML = group.body;
        diagnosticModalEl.hidden = false;
      }

      function runBridgeUtilityAction(action) {
        if (action === "reconnect") {
          reconnectBridgeButton?.click();
          return;
        }
        if (action === "reregister") {
          reregisterSessionButton?.click();
          return;
        }
        if (action === "primary") {
          primaryActionButton?.click();
          return;
        }
        if (action === "refresh-detail") {
          refreshDetailButton?.click();
          return;
        }
        if (action === "refresh-sessions") {
          refreshSessionsButton?.click();
          return;
        }
        if (action === "refresh-ops") {
          refreshOpsButton?.click();
          return;
        }
        if (action === "refresh-realtime") {
          refreshRealtimeButton?.click();
          return;
        }
        if (action === "check-ws") {
          checkWsExperimentButton?.click();
          return;
        }
        if (action === "refresh-handoffs") {
          refreshDesignerHandoffLog();
        }
      }

      function setServerStatus(summary, klass, meta, nextAction, badgeOverride) {
        if (klass === "warn") {
          serverErrorCode = classifyServerErrorCode(meta);
        } else {
          serverErrorCode = null;
        }
        renderStatus(serverStatusEl, summary, klass, meta, nextAction, badgeOverride);
        renderDesignerShell();
        renderPrimaryAction();
      }

      function setSessionStatus(summary, klass, meta, nextAction, badgeOverride) {
        renderStatus(sessionStatusEl, summary, klass, meta, nextAction, badgeOverride);
        renderDesignerShell();
        renderPrimaryAction();
      }

      function setRuntimeStatus(summary, klass, meta, nextAction, badgeOverride) {
        renderStatus(runtimeStatusEl, summary, klass, meta, nextAction, badgeOverride);
        renderDesignerShell();
        renderPrimaryAction();
      }

      function updateRuntimeState(nextState, options = {}) {
        runtimeState = nextState || runtimeState;
        runtimeLastUpdatedAt = new Date().toLocaleTimeString();
        if (typeof options.commandType === "string" && options.commandType.trim()) {
          runtimeLastCommandType = options.commandType.trim();
        }
        if (typeof options.commandId === "string" && options.commandId.trim()) {
          runtimeLastCommandId = options.commandId.trim();
        }
        if (typeof options.preflightOk === "boolean") {
          runtimePreflightOk = options.preflightOk;
        }
        if (typeof options.errorCode === "string" && options.errorCode.trim()) {
          runtimeErrorCode = options.errorCode.trim();
        } else if (options.clearErrorCode) {
          runtimeErrorCode = null;
        }
        if (typeof options.message === "string" && options.message.trim()) {
          runtimeLastMessage = options.message.trim();
        } else if (options.clearMessage) {
          runtimeLastMessage = "아직 실행 기록이 없습니다.";
        }
        if (typeof options.guidance === "string" && options.guidance.trim()) {
          runtimeGuidance = options.guidance.trim();
        } else if (options.clearGuidance) {
          runtimeGuidance = "";
        }

        const meta = buildRuntimeMeta();
        if (runtimeState === "executing") {
          setRuntimeStatus(
            `${runtimeLastCommandType} 명령을 실행하고 있습니다.`,
            "info",
            meta,
            "명령 실행이 길어지면 연결 상태를 확인한 뒤 세션 목록을 새로고침하세요.",
            "실행 중"
          );
          return;
        }

        if (runtimeState === "preflight_error") {
          const nextAction = runtimeGuidance || "세션 재등록 후 동일 작업을 다시 시도하세요.";
          setRuntimeStatus(
            "사전 점검에서 명령을 차단했습니다.",
            "critical",
            meta,
            nextAction,
            runtimeErrorCode || "사전 점검 실패"
          );
          return;
        }

        if (runtimeState === "error") {
          const nextAction = runtimeGuidance || "세션 상태를 확인한 뒤 명령을 다시 실행하세요.";
          setRuntimeStatus(
            "명령 실행 중 오류가 발생했습니다.",
            "critical",
            meta,
            nextAction,
            runtimeErrorCode || "실행 실패"
          );
          return;
        }

        if (runtimeState === "paused") {
          setRuntimeStatus(
            "브리지가 꺼져 있어 런타임이 일시 중지되었습니다.",
            "warn",
            meta,
            "브리지를 켜면 명령 처리와 세션 동기화가 자동으로 재개됩니다.",
            "일시 중지"
          );
          return;
        }

        if (runtimeState === "waiting_session") {
          setRuntimeStatus(
            "세션 등록 전까지 명령 실행을 대기합니다.",
            "warn",
            meta,
            "플러그인 준비 신호를 받은 뒤 세션이 등록되면 명령 처리가 시작됩니다.",
            "대기 중"
          );
          return;
        }

        if (runtimeState === "success") {
          setRuntimeStatus(
            `${runtimeLastCommandType} 명령을 완료했습니다.`,
            "ok",
            meta,
            "",
            "실행 완료"
          );
          return;
        }

        setRuntimeStatus(
          "명령 실행 대기 중입니다.",
          "ok",
          meta,
          "연결 상태가 정상일 때 브리지 명령이 들어오면 자동으로 처리됩니다.",
          "유휴"
        );
      }

      function setBridgeOrigin(origin) {
        bridgeOrigin = origin;
        updateActionButtons();
      }

      function renderBridgeToggle() {
        bridgeToggleButton.setAttribute("aria-pressed", bridgeEnabled ? "true" : "false");
        bridgeToggleButton.setAttribute(
          "aria-label",
          bridgeEnabled ? "브리지 끄기" : "브리지 켜기"
        );
        bridgeToggleButton.title = bridgeEnabled ? "브리지 끄기" : "브리지 켜기";
      }

      function updateActionButtons() {
        if (!bridgeEnabled) {
          reconnectBridgeButton.disabled = true;
          reconnectBridgeButton.hidden = false;
          reregisterSessionButton.disabled = true;
          reregisterSessionButton.hidden = false;
          refreshSessionsButton.disabled = true;
          refreshOpsButton.disabled = true;
          refreshDetailButton.disabled = true;
          checkWsExperimentButton.disabled = true;
          reconnectBridgeButton.textContent = "브리지 재연결";
          actionHelpEl.textContent =
            "브리지가 일시 중지되었습니다. 상단 토글을 켜면 서버 연결과 세션 등록을 다시 시작합니다.";
          renderPrimaryAction();
          applyPrimaryActionButtonDedupe();
          renderRealtimeDebugPanel();
          return;
        }
        reconnectBridgeButton.textContent = needsReconnect ? "서버 다시 확인" : "브리지 재연결";
        reconnectBridgeButton.disabled = !needsReconnect;
        reconnectBridgeButton.hidden = needsReconnect;
        reregisterSessionButton.disabled = !bridgeConnected;
        reregisterSessionButton.hidden = needsReregister || (bridgeConnected && !sessionRegistered);
        refreshSessionsButton.disabled = !bridgeConnected;
        refreshOpsButton.disabled = !bridgeConnected;
        refreshDetailButton.disabled = !bridgeConnected;
        checkWsExperimentButton.disabled = !bridgeConnected || typeof WebSocket === "undefined";
        if (needsReconnect) {
          actionHelpEl.textContent =
            `${serverErrorCode ? `[${serverErrorCode}] ` : ""}서버 연결이 끊긴 상태입니다. '서버 다시 확인'은 연결 상태만 재확인하며, 서버 실행 자체는 하지 않습니다.`;
          renderPrimaryAction();
          applyPrimaryActionButtonDedupe();
          renderRealtimeDebugPanel();
          return;
        }
        if (needsReregister) {
          actionHelpEl.textContent =
            "브리지는 살아 있지만 세션 등록이 끊겼을 수 있습니다. '세션 재등록'을 눌러 현재 파일 세션을 다시 연결하세요.";
          renderPrimaryAction();
          applyPrimaryActionButtonDedupe();
          renderRealtimeDebugPanel();
          return;
        }
        if (bridgeConnected) {
          actionHelpEl.textContent =
            "필요하면 언제든 '세션 재등록'을 눌러 현재 파일 메타데이터를 서버에 다시 등록할 수 있습니다.";
          renderPrimaryAction();
          applyPrimaryActionButtonDedupe();
          renderRealtimeDebugPanel();
          return;
        }
        actionHelpEl.textContent = "";
        renderPrimaryAction();
        applyPrimaryActionButtonDedupe();
        renderRealtimeDebugPanel();
      }

      function normalizePrimaryActionKey(label) {
        const normalizedLabel = typeof label === "string" ? label.toLowerCase() : "";
        if (
          normalizedLabel.includes("서버 다시 확인") ||
          normalizedLabel.includes("브리지 재연결")
        ) {
          return "reconnect";
        }
        if (normalizedLabel.includes("세션 재등록")) {
          return "reregister";
        }
        return null;
      }

      function applyPrimaryActionButtonDedupe() {
        if (!bridgeEnabled) {
          return;
        }
        if (primaryActionKey === "reconnect") {
          reconnectBridgeButton.hidden = true;
          return;
        }
        if (primaryActionKey === "reregister") {
          reregisterSessionButton.hidden = true;
        }
      }

      function setPrimaryAction(label, description, onClick, showCommands = false) {
        primaryActionButton.textContent = label;
        primaryActionButton.disabled = typeof onClick !== "function";
        primaryActionDescEl.textContent = description;
        primaryActionHandler = onClick;
        primaryActionKey = normalizePrimaryActionKey(label);
        applyPrimaryActionButtonDedupe();
        quickCommandsEl.hidden = !showCommands;
      }

      function setGuidedSteps(title, steps) {
        const safeTitle = escapeHtml(title || "다음 단계");
        const items = Array.isArray(steps) ? steps : [];
        guidedStepsEl.innerHTML = `
          <div class="guided-steps-title">${safeTitle}</div>
          ${items
            .map(
              (step, index) => `
                <div class="guided-step">
                  <div class="guided-step-index">${index + 1}.</div>
                  <div>${escapeHtml(step)}</div>
                </div>
              `
            )
            .join("")}
        `;
      }

      function renderPrimaryAction() {
        if (!bridgeEnabled) {
          setPrimaryAction(
            "브리지 켜기",
            "브리지가 꺼져 있습니다. 다시 켜면 서버 확인과 세션 동기화를 자동으로 시작합니다.",
            () => setBridgeEnabled(true),
            false
          );
          setGuidedSteps("재개 방법", [
            "상단 토글을 켭니다.",
            "서버 상태 카드가 '확인 중'에서 '정상'으로 바뀌는지 확인합니다.",
            "필요하면 '세션 재등록'을 눌러 현재 파일을 다시 연결합니다."
          ]);
          return;
        }

        if (needsReconnect) {
          const remainingMs =
            typeof autoRecoverDueAt === "number" ? Math.max(0, autoRecoverDueAt - Date.now()) : 0;
          const countdownLabel =
            autoRecoverTimer && remainingMs > 0
              ? ` 자동 재시도까지 ${Math.max(1, Math.ceil(remainingMs / 1000))}초`
              : "";
          setPrimaryAction(
            "서버 다시 확인",
            `${serverErrorCode ? `${serverErrorCode} · ` : ""}서버 프로세스를 먼저 실행한 뒤 연결을 다시 확인하세요.${countdownLabel}`,
            () => reconnectBridge(),
            true
          );
          const reconnectSteps = ["터미널에서 xbridge 서버를 실행합니다.", "'서버 다시 확인'을 눌러 연결 상태를 재확인합니다."];
          if (serverErrorCode === "ERR_PORT_IN_USE") {
            reconnectSteps.unshift("포트 점유 프로세스(PID)를 확인하고 종료합니다.");
          }
          reconnectSteps.push("서버 연결 후 '세션 재등록'으로 현재 파일 세션을 동기화합니다.");
          setGuidedSteps("서버 복구 절차", reconnectSteps);
          return;
        }

        if (needsReregister || (bridgeConnected && !sessionRegistered)) {
          setPrimaryAction(
            "세션 재등록",
            "서버는 연결되어 있습니다. 현재 파일 세션만 다시 등록하면 명령을 계속 실행할 수 있습니다.",
            () => reregisterSession(),
            false
          );
          setGuidedSteps("세션 복구 절차", [
            "현재 작업 중인 Figma 파일 탭에서 플러그인이 열려 있는지 확인합니다.",
            "'세션 재등록'을 눌러 파일/페이지 메타데이터를 다시 등록합니다.",
            "활성 세션 목록에서 현재 세션 배지가 표시되는지 확인합니다."
          ]);
          return;
        }

        if (runtimeState === "preflight_error") {
          setPrimaryAction(
            "세션 재등록",
            `${runtimeErrorCode ? `${runtimeErrorCode} · ` : ""}${runtimeLastMessage}`,
            () => reregisterSession(),
            false
          );
          setGuidedSteps("사전 점검 오류 대응", [
            runtimeGuidance || "명령 페이로드를 다시 확인합니다.",
            "'세션 재등록'으로 현재 파일 세션을 다시 연결합니다.",
            "동일 작업을 다시 실행해 런타임 상태가 '실행 완료'로 바뀌는지 확인합니다."
          ]);
          return;
        }

        if (runtimeState === "error") {
          setPrimaryAction(
            "세션 상태 재확인",
            `${runtimeErrorCode ? `${runtimeErrorCode} · ` : ""}${runtimeLastMessage}`,
            () => refreshSessionsList(),
            false
          );
          setGuidedSteps("실행 오류 대응", [
            runtimeGuidance || "오류 원인을 확인하고 같은 명령을 다시 실행합니다.",
            "활성 세션 목록에서 현재 세션이 살아 있는지 확인합니다.",
            "필요하면 '세션 재등록'으로 연결을 새로고침합니다."
          ]);
          return;
        }

        if (bridgeConnected) {
          setPrimaryAction(
            "세션 목록 새로고침",
            "현재 연결 상태는 정상입니다. 필요하면 활성 세션 목록을 최신 상태로 새로고침하세요.",
            () => refreshSessionsList(),
            false
          );
          setGuidedSteps("운영 체크", [
            "활성 세션 목록에서 현재 세션이 최상단인지 확인합니다.",
            "필요 시 '세션 재등록'으로 메타데이터를 갱신합니다.",
            "명령 처리 지연이 있으면 목록 새로고침으로 상태를 재확인합니다."
          ]);
          return;
        }

        setPrimaryAction(
          "브리지 재연결",
          "서버 상태를 다시 확인합니다.",
          () => reconnectBridge(),
          false
        );
        setGuidedSteps("기본 절차", [
          "'브리지 재연결'을 눌러 서버 응답을 확인합니다.",
          "서버가 연결되면 세션 상태가 자동으로 갱신되는지 봅니다.",
          "세션 미등록이면 '세션 재등록'으로 복구합니다."
        ]);
      }

      function formatSessionStamp(timestamp) {
        if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
          return "기록 없음";
        }
        try {
          return new Date(timestamp).toLocaleTimeString();
        } catch (error) {
          return "기록 없음";
        }
      }

      function renderSessionsList() {
        if (!sessionsListEl) {
          return;
        }

        if (!bridgeEnabled) {
          sessionsListEl.innerHTML = `
            <div class="session-item">
              <div class="session-item-title">브리지가 일시 중지되었습니다</div>
              <div class="session-item-meta">
                <div>상단 토글을 다시 켜면 세션 목록을 불러옵니다.</div>
              </div>
            </div>
          `;
          return;
        }

        if (!bridgeConnected) {
          sessionsListEl.innerHTML = `
            <div class="session-item">
              <div class="session-item-title">서버 연결 후 세션을 확인할 수 있습니다</div>
            </div>
          `;
          return;
        }

        if (!Array.isArray(sessionsSnapshot) || sessionsSnapshot.length === 0) {
          sessionsListEl.innerHTML = `
            <div class="session-item">
              <div class="session-item-title">아직 확인된 세션이 없습니다</div>
              <div class="session-item-meta">
                <div>플러그인 창이 열린 파일에서 세션 재등록을 한 번 시도해 보세요.</div>
              </div>
            </div>
          `;
          return;
        }

        sessionsListEl.innerHTML = sessionsSnapshot
          .map((session) => {
            const isCurrent = Boolean(pluginId) && session.pluginId === pluginId;
            const title = session.fileName || session.pluginId || "알 수 없는 세션";
            const pageLabel = session.pageName || session.pageId || "페이지 정보 없음";
            const selectionCount =
              typeof session.selectionCount === "number" ? session.selectionCount : 0;
            const active = session.active !== false;
            const badgeLabel = isCurrent ? "현재 세션" : active ? "활성" : "만료";

            return `
              <div class="session-item${isCurrent ? " current" : ""}">
                <div class="session-item-head">
                  <div class="session-item-title">${escapeHtml(title)}</div>
                  <div class="session-item-badge">${escapeHtml(badgeLabel)}</div>
                </div>
                <div class="session-item-meta">
                  <div>pluginId: ${escapeHtml(session.pluginId || "-")}</div>
                  <div>page: ${escapeHtml(pageLabel)}</div>
                  <div>selection: ${escapeHtml(String(selectionCount))}</div>
                  <div>last seen: ${escapeHtml(formatSessionStamp(session.lastSeenAt))}</div>
                </div>
              </div>
            `;
          })
          .join("");
      }

      async function refreshSessionsList() {
        if (!bridgeEnabled || !bridgeOrigin) {
          renderSessionsList();
          renderRuntimeOpsPanel();
          return;
        }

        try {
          const response = await fetch(`${bridgeOrigin}/api/sessions`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();
          const incoming = Array.isArray(data.sessions) ? data.sessions : [];
          const currentId = pluginId || "";
          sessionsSnapshot = incoming.sort((a, b) => {
            const aCurrent = a?.pluginId === currentId ? 1 : 0;
            const bCurrent = b?.pluginId === currentId ? 1 : 0;
            if (aCurrent !== bCurrent) {
              return bCurrent - aCurrent;
            }
            const aSeen = typeof a?.lastSeenAt === "number" ? a.lastSeenAt : 0;
            const bSeen = typeof b?.lastSeenAt === "number" ? b.lastSeenAt : 0;
            if (aSeen !== bSeen) {
              return bSeen - aSeen;
            }
            return String(a?.pluginId || "").localeCompare(String(b?.pluginId || ""));
          });
        } catch (error) {
          sessionsSnapshot = [];
          sessionsListEl.innerHTML = `
            <div class="session-item">
              <div class="session-item-title">세션 목록을 불러오지 못했습니다</div>
              <div class="session-item-meta">
                <div>${escapeHtml(error instanceof Error ? error.message : String(error))}</div>
              </div>
            </div>
          `;
          return;
        }

        renderSessionsList();
        renderRuntimeOpsPanel();
      }

      function renderRuntimeOpsPanel() {
        if (!opsGridEl) {
          return;
        }

        if (!bridgeEnabled) {
          opsGridEl.innerHTML = `
            <div class="ops-item">
              <div class="ops-item-title">브리지가 꺼져 있습니다</div>
              <div class="ops-item-meta">
                <div>상단 토글을 켜면 운영 진단이 재개됩니다.</div>
              </div>
            </div>
          `;
          return;
        }

        if (!bridgeConnected) {
          opsGridEl.innerHTML = `
            <div class="ops-item">
              <div class="ops-item-title">서버 연결 후 진단 가능</div>
              <div class="ops-item-meta">
                <div>서버 연결 상태가 정상일 때 runtime ops를 조회합니다.</div>
              </div>
            </div>
          `;
          return;
        }

        if (!runtimeOpsSnapshot) {
          opsGridEl.innerHTML = `
            <div class="ops-item">
              <div class="ops-item-title">운영 진단 조회 중...</div>
              <div class="ops-item-meta">
                <div>세션/큐 지표를 수집하고 있습니다.</div>
              </div>
            </div>
          `;
          return;
        }

        if (runtimeOpsSnapshot.error) {
          opsGridEl.innerHTML = `
            <div class="ops-item">
              <div class="ops-item-title">운영 진단 조회 실패</div>
              <div class="ops-item-meta">
                <div>${escapeHtml(runtimeOpsSnapshot.error)}</div>
                <div>마지막 시도: ${escapeHtml(formatTimeLabel(lastRuntimeOpsSyncAt))}</div>
              </div>
            </div>
          `;
          return;
        }

        const sessions = runtimeOpsSnapshot.sessions || {};
        const summary = sessions.summary || {};
        const staleSessions = Array.isArray(sessions.staleSessions) ? sessions.staleSessions : [];
        const pendingRecovery = Array.isArray(sessions.pendingRecovery)
          ? sessions.pendingRecovery
          : [];
        const activeSessionResolution =
          runtimeOpsSnapshot.activeSessionResolution ||
          sessions.activeSessionResolution ||
          serverHealthSnapshot?.activeSessionResolution ||
          null;
        const queue = runtimeOpsSnapshot.queue || {};
        const buckets = queue.ageBuckets || {};
        const byPlugin = queue.byPlugin || {};
        const deferredByWsGuard = Number(queue.deferredByWsGuard || 0);
        const oldestDeferredByWsGuardMs = Number(queue.oldestDeferredByWsGuardMs || 0);
        const deferredByFallbackClass = queue.deferredByFallbackClass || {};
        const deferredByTuningMode = queue.deferredByTuningMode || {};
        const pollingFallbackPolicy = queue.pollingFallbackPolicy || null;
        const pollingFallbackMode = queue.pollingFallbackMode || null;
        const lifecycleTail = Array.isArray(queue.lifecycleTail) ? queue.lifecycleTail : [];
        const latestLifecycle = lifecycleTail[0] || null;
        const lifecycleSummary = queue.lifecycleSummary || {};
        const commandTimelineTail = Array.isArray(queue.commandTimelineTail)
          ? queue.commandTimelineTail
          : [];
        const lifecycleTiming = lifecycleSummary.timing || {};
        const lifecycleExpired = lifecycleSummary.expired || {};
        const lifecycleStatusCounts = lifecycleSummary.statusCounts || {};
        const topPluginEntry = Object.entries(byPlugin)
          .sort((a, b) => (b[1]?.pendingTotal || 0) - (a[1]?.pendingTotal || 0))[0];
        const transportHealth =
          runtimeOpsSnapshot.transportHealth ||
          runtimeOpsSnapshot.observability?.transportHealth ||
          null;
        const commandReadiness = runtimeOpsSnapshot.commandReadiness || null;
        const mode = getOperationalModeSnapshot();
        const wsActiveClientCount = Number(transportHealth?.activeClients?.ws || 0);
        const wsGuardPolicyMode = (() => {
          if (deferredByWsGuard > 0) {
            return {
              label: "active",
              hint: "WS pickup/ack 대기 중인 명령은 polling fallback을 잠시 지연합니다."
            };
          }
          if (wsActiveClientCount > 0 && commandReadiness?.status === "ready") {
            return {
              label: "standby",
              hint: "WS 경로가 준비되어 있어 필요 시 ws-guard 지연이 즉시 적용됩니다."
            };
          }
          if (wsActiveClientCount === 0 || commandReadiness?.status === "unavailable") {
            return {
              label: "bypass",
              hint: "WS 경로가 약해 polling fallback이 즉시 허용됩니다."
            };
          }
          return {
            label: "passive",
            hint: "ws-guard 정책 신호를 수집 중입니다."
          };
        })();
        const readHeavyPolicyLabel =
          "read-heavy(list_pages/get_metadata/get_node_details/get_component_variant_details/get_instance_details): extended timeout + expiry grace";
        const defaultPolicyLabel =
          "default commands: base timeout + standard fallback recovery";

        const stalePreview = staleSessions[0]
          ? `${staleSessions[0].pluginId} · ${formatDuration(staleSessions[0].staleMs)}`
          : "없음";
        const recoveryPreview = pendingRecovery[0]
          ? `${pendingRecovery[0].pluginId} · ${pendingRecovery[0].failures}회`
          : "없음";
        const activeRoutePreview = activeSessionResolution
          ? `${activeSessionResolution.status || "-"} · ${activeSessionResolution.primaryPluginId || "-"}`
          : "미표시";
        const activeRouteReasonPreview = activeSessionResolution
          ? activeSessionResolution.summary || activeSessionResolution.reason || "미표시"
          : "미표시";
        const queueTopPreview = topPluginEntry
          ? `${topPluginEntry[0]} · pending ${topPluginEntry[1]?.pendingTotal || 0}`
          : "없음";
        const deferredByClassPreview = [
          `critical ${String(deferredByFallbackClass.critical || 0)}`,
          `standard ${String(deferredByFallbackClass.standard || 0)}`,
          `detail ${String(deferredByFallbackClass.detail || 0)}`
        ].join(" · ");
        const fallbackPolicyPreview = pollingFallbackPolicy
          ? `base ${formatDuration(pollingFallbackPolicy.baseGraceMs)} · x${String(
              pollingFallbackPolicy.multipliers?.critical ?? "-"
            )}/x${String(pollingFallbackPolicy.multipliers?.standard ?? "-")}/x${String(
              pollingFallbackPolicy.multipliers?.detail ?? "-"
            )}`
          : "미표시";
        const fallbackPolicyTuningSummary = (() => {
          if (!pollingFallbackPolicy) {
            return {
              label: "unknown · policy 미수집",
              hint: "queue.pollingFallbackPolicy가 보이면 자동/고정 튜닝 상태를 즉시 확인할 수 있습니다."
            };
          }
          const modeRaw = String(pollingFallbackPolicy.mode || "").toLowerCase();
          const multipliers = pollingFallbackPolicy.multipliers || {};
          const critical = Number(multipliers.critical);
          const standard = Number(multipliers.standard);
          const detail = Number(multipliers.detail);
          const adaptiveShape =
            Number.isFinite(critical) &&
            Number.isFinite(standard) &&
            Number.isFinite(detail) &&
            (critical !== standard || standard !== detail);
          const autoEnabled = pollingFallbackPolicy.autoTuning === true || modeRaw === "auto" || adaptiveShape;
          if (autoEnabled) {
            return {
              label: "auto · adaptive tuning",
              hint: "multiplier가 상황에 맞게 조정됩니다. deferred 급증 여부를 함께 보세요."
            };
          }
          return {
            label: "fixed · static tuning",
            hint: "고정 multiplier 모드입니다. fallback trend가 watch/high면 재조정이 필요할 수 있습니다."
          };
        })();
        const tuningModePreview = [
          `base ${String(deferredByTuningMode.base || 0)}`,
          `queue ${String(deferredByTuningMode.queue_pressure || 0)}`,
          `near-timeout ${String(deferredByTuningMode.near_timeout || 0)}`
        ].join(" · ");
        const policyGuardPreview = pollingFallbackPolicy
          ? `pressure>=${String(pollingFallbackPolicy.queuePressureThreshold ?? "-")} · near-timeout ${String(
              pollingFallbackPolicy.nearTimeoutRatio ?? "-"
            )}`
          : "미표시";
        const pollingFallbackModePreview = pollingFallbackMode
          ? `${pollingFallbackMode.mode || "-"}${pollingFallbackMode.blocked ? " · blocked" : ""}`
          : "미표시";
        const pollingFallbackBlockReasonPreview = pollingFallbackMode?.reason || "-";
        const lifecyclePreview = latestLifecycle
          ? `${latestLifecycle.status || "-"} · ${latestLifecycle.type || "-"} · ${formatDuration(latestLifecycle.ageMs)}${
              latestLifecycle.failureCode ? ` · ${latestLifecycle.failureCode}` : ""
            }`
          : "최근 lifecycle 없음";
        const lifecycleDetailPreview = latestLifecycle
          ? `delivery ${latestLifecycle.deliveryMode || "-"} · plugin ${latestLifecycle.pluginId || "-"}${
              lifecycleTail.length > 1 ? ` · +${lifecycleTail.length - 1} more` : ""
            }`
          : "queue tail 미표시";
        const lifecycleStatusPreview = `sample ${String(lifecycleSummary.sampleSize || 0)} · completed ${String(
          lifecycleStatusCounts.completed || 0
        )} · failed ${String(lifecycleStatusCounts.failed || 0)} · expired ${String(
          lifecycleStatusCounts.expired || 0
        )}`;
        const lifecycleTimingPreview = `enqueue→dispatch ${formatDuration(
          lifecycleTiming.avgEnqueueToDispatchMs
        )} · dispatch→ack ${formatDuration(lifecycleTiming.avgDispatchToAckMs)} · ack→complete ${formatDuration(
          lifecycleTiming.avgAckToCompleteMs
        )}`;
        const lifecycleExpiredPreview = lifecycleExpired.last
          ? `last expired: ${lifecycleExpired.last.type || "-"} · ${lifecycleExpired.last.failureCode || "-"} · age ${formatDuration(
              lifecycleExpired.last.ageMs
            )}`
          : `last expired: 없음 · total ${String(lifecycleExpired.total || 0)}`;
        const commandTimelinePreview =
          commandTimelineTail.length > 0
            ? (() => {
                const latestTimeline = commandTimelineTail[0] || {};
                const durations = latestTimeline.durations || {};
                return `${latestTimeline.status || "-"} · ${latestTimeline.type || "-"} · q→d ${formatDuration(
                  durations.enqueueToDispatchMs
                )} · d→ack ${formatDuration(durations.dispatchToAckMs)} · total ${formatDuration(
                  durations.enqueueToCompleteMs
                )}`;
              })()
            : "timeline 미표시";
        const transportRecentPreview = transportHealth
          ? `SSE ${transportHealth.activeClients?.sse || 0} · WS ${transportHealth.activeClients?.ws || 0} · ack ${transportHealth.recent?.recentWsAckTotal || 0} · result ${transportHealth.recent?.recentWsResultTotal || 0} · fallback ${transportHealth.recent?.recentFallbackTotal || 0}`
          : "미표시";
        const transportRatePreview = transportHealth
          ? `${Math.round((transportHealth.fallbackRate || 0) * 100)}%`
          : "-";
        const fallbackTrend = transportHealth?.fallbackIncidenceTrend || null;
        const fallbackTrendDeltaRate = Number(fallbackTrend?.deltaRate || 0);
        const fallbackTrendDirection =
          fallbackTrendDeltaRate > 0 ? "up" : fallbackTrendDeltaRate < 0 ? "down" : "flat";
        const fallbackTrendLabel =
          fallbackTrendDirection === "up"
            ? `up +${Math.round(Math.abs(fallbackTrendDeltaRate) * 100)}%p`
            : fallbackTrendDirection === "down"
              ? `down -${Math.round(Math.abs(fallbackTrendDeltaRate) * 100)}%p`
              : "flat 0%p";
        const fallbackTrendCounts = fallbackTrend
          ? `${String(fallbackTrend.recentFallbackTotal ?? 0)}/${String(fallbackTrend.recentSignalTotal ?? 0)} in ${Math.round((fallbackTrend.windowMs || 0) / 1000)}s`
          : "미표시";
        const fallbackTrendStatus = fallbackTrend?.status || "-";
        const fallbackRiskSummary = (() => {
          const status = fallbackTrend?.status || null;
          if (status === "high") {
            return {
              label: "high · polling fallback 위험",
              hint: "WS/세션 상태를 즉시 점검하고 queue backlog를 함께 확인하세요."
            };
          }
          if (status === "watch") {
            return {
              label: "watch · fallback 추세 관찰",
              hint: "fallback 비중이 상승 중일 수 있어 runtime-ops 추세를 계속 확인하세요."
            };
          }
          if (status === "stable") {
            return {
              label: "stable · 정상 범위",
              hint: "fallback 압력은 낮습니다. 현재 상태를 유지하며 모니터링하세요."
            };
          }
          return {
            label: "미표시",
            hint: "fallback trend status 수집 전입니다."
          };
        })();
        const commandReadinessRiskSummary = (() => {
          const status = commandReadiness?.status || null;
          const reason = commandReadiness?.reason || "-";
          const reasonHintMap = {
            no_active_plugin: "활성 플러그인 세션이 없습니다. 플러그인 창에서 세션 재등록을 먼저 진행하세요.",
            session_recovery_pending:
              "recovery가 남아 있습니다. pending recovery가 0으로 내려오는지 먼저 확인하세요.",
            queue_dispatch_ack_lag:
              "dispatch→ack 구간 지연이 큽니다. ws-command 채널 ack/heartbeat를 우선 점검하세요.",
            queue_backlog_risk:
              "undelivered 명령이 오래 머뭅니다. queue backlog와 fallback 지연 정책을 함께 확인하세요.",
            recent_command_expired:
              "최근 만료가 있었습니다. command timeline에서 만료 직전 병목 단계를 확인하세요.",
            recent_command_failures:
              "최근 명령 실패가 누적되었습니다. last failure code와 timeline을 함께 점검하세요.",
            ready: "준비 상태는 양호합니다. 현재 상태를 유지하며 추세만 모니터링하세요."
          };
          const reasonHint = reasonHintMap[reason] || `reason ${reason} 기준으로 queue/transport를 점검하세요.`;
          if (status === "unavailable") {
            return {
              label: "high · command path unavailable",
              hint: reasonHint
            };
          }
          if (status === "degraded") {
            return {
              label: "watch · command quality degraded",
              hint: reasonHint
            };
          }
          if (status === "ready") {
            return {
              label: "stable · command ready",
              hint: reasonHint
            };
          }
          return {
            label: "미표시",
            hint: "command readiness 수집 전입니다."
          };
        })();
        const commandReadinessBottleneckPreview = (() => {
          const stage = commandReadiness?.timingBottleneckStage;
          const duration = commandReadiness?.timingBottleneckDurationMs;
          const commandType = commandReadiness?.timingBottleneckCommandType || "-";
          if (!stage || !Number.isFinite(duration)) {
            return "bottleneck: 미표시";
          }
          const labelMap = {
            enqueue_to_dispatch: "enqueue→dispatch",
            dispatch_to_ack: "dispatch→ack",
            ack_to_complete: "ack→complete"
          };
          return `bottleneck: ${labelMap[stage] || stage} · ${formatDuration(duration)} · ${commandType}`;
        })();
        const operationalStateSummary = (() => {
          const activeClientTotal = Number(transportHealth?.activeClients?.total || 0);
          const readinessStatus = commandReadiness?.status || "unknown";
          const transportGrade = transportHealth?.grade || "standby";
          const fallbackStatus = fallbackTrend?.status || "unknown";
          const connected =
            activeClientTotal > 0 || Number(commandReadiness?.activePluginCount ?? 0) > 0;
          const commandReady = readinessStatus === "ready";
          const degraded =
            readinessStatus === "degraded" ||
            readinessStatus === "unavailable" ||
            transportGrade === "degraded" ||
            transportGrade === "unhealthy" ||
            fallbackStatus === "high";
          const fallbackPhase =
            fallbackStatus === "high" &&
            (readinessStatus === "unavailable" || transportGrade === "unhealthy")
              ? "outage"
              : fallbackStatus === "watch" || (fallbackStatus === "high" && commandReady)
                ? "recovery"
                : fallbackStatus === "stable"
                  ? "normal"
                  : "unknown";
          return {
            state: `${connected ? "connected" : "disconnected"} · ${
              commandReady ? "command-ready" : "command-not-ready"
            } · ${degraded ? "degraded" : "healthy"}`,
            fallbackPhase,
            hint:
              fallbackPhase === "outage"
                ? "fallback은 장애 징후일 수 있습니다. WS/session/queue를 즉시 점검하세요."
                : fallbackPhase === "recovery"
                  ? "fallback은 복구 경로로 동작 중입니다. stable 복귀 여부를 추적하세요."
                  : fallbackPhase === "normal"
                    ? "fallback은 정상 범위입니다."
                    : "운영 상태 수집 전입니다."
          };
        })();

        opsGridEl.innerHTML = `
          <div class="ops-item">
            <div class="ops-item-title">세션 상태 · ${escapeHtml(mode.label)}</div>
            <div class="ops-item-meta">
              <div>live ${escapeHtml(String(summary.live || 0))} · registered ${escapeHtml(String(summary.registered || 0))} · stale ${escapeHtml(String(summary.stale || 0))}</div>
              <div>active route: ${escapeHtml(activeRoutePreview)}</div>
              <div>${escapeHtml(activeRouteReasonPreview)}</div>
              <div>stale top: ${escapeHtml(stalePreview)}</div>
              <div>pending recovery: ${escapeHtml(recoveryPreview)}</div>
              <div>mode reason: ${escapeHtml(mode.reason)}</div>
              <div>마지막 갱신: ${escapeHtml(formatTimeLabel(lastRuntimeOpsSyncAt))}</div>
            </div>
          </div>
          <div class="ops-item">
            <div class="ops-item-title">큐 지연 · soak</div>
            <div class="ops-item-meta">
              <div>pending ${escapeHtml(String(queue.pendingTotal || 0))} · undelivered oldest ${escapeHtml(formatDuration(queue.oldestUndeliveredMs))}</div>
              <div>ws-guard deferred ${escapeHtml(String(deferredByWsGuard))} · oldest ${escapeHtml(formatDuration(oldestDeferredByWsGuardMs))}</div>
              <div>deferred by class: ${escapeHtml(deferredByClassPreview)}</div>
              <div>policy multiplier: ${escapeHtml(fallbackPolicyPreview)}</div>
              <div>policy tuning: ${escapeHtml(fallbackPolicyTuningSummary.label)}</div>
              <div>policy guard: ${escapeHtml(policyGuardPreview)}</div>
              <div>polling mode: ${escapeHtml(pollingFallbackModePreview)} · reason ${escapeHtml(pollingFallbackBlockReasonPreview)}</div>
              <div>deferred by policy block: ${escapeHtml(String(queue.deferredByPolicyBlock || 0))}</div>
              <div>deferred by tuning: ${escapeHtml(tuningModePreview)}</div>
              <div>fallback policy mode: ${escapeHtml(wsGuardPolicyMode.label)} (ws-guard)</div>
              <div>tuning hint: ${escapeHtml(fallbackPolicyTuningSummary.hint)}</div>
              <div>policy hint: ${escapeHtml(wsGuardPolicyMode.hint)}</div>
              <div>${escapeHtml(readHeavyPolicyLabel)}</div>
              <div>${escapeHtml(defaultPolicyLabel)}</div>
              <div>&lt;250ms ${escapeHtml(String(buckets.lt250ms || 0))} · 250-1000ms ${escapeHtml(String(buckets.ms250to1000 || 0))}</div>
              <div>1-5s ${escapeHtml(String(buckets.ms1000to5000 || 0))} · 5s+ ${escapeHtml(String(buckets.gte5000ms || 0))}</div>
              <div>recent lifecycle: ${escapeHtml(lifecyclePreview)}</div>
              <div>${escapeHtml(lifecycleDetailPreview)}</div>
              <div>lifecycle status: ${escapeHtml(lifecycleStatusPreview)}</div>
              <div>lifecycle timing: ${escapeHtml(lifecycleTimingPreview)}</div>
              <div>${escapeHtml(lifecycleExpiredPreview)}</div>
              <div>command timeline: ${escapeHtml(commandTimelinePreview)}</div>
              <div>top plugin: ${escapeHtml(queueTopPreview)}</div>
              <div>transport: ${escapeHtml(mode.transport)} · verify: ${escapeHtml(mode.soak)}</div>
            </div>
          </div>
          <div class="ops-item">
            <div class="ops-item-title">transport health</div>
            <div class="ops-item-meta">
              <div>operational state: ${escapeHtml(operationalStateSummary.state)}</div>
              <div>fallback phase: ${escapeHtml(operationalStateSummary.fallbackPhase)}</div>
              <div>grade: ${escapeHtml(transportHealth?.grade || "-")} · fallback rate: ${escapeHtml(transportRatePreview)}</div>
              <div>${escapeHtml(transportHealth?.summary || "미표시")}</div>
              <div>${escapeHtml(transportHealth?.reason || "미표시")}</div>
              <div>recent: ${escapeHtml(transportRecentPreview)}</div>
              <div>fallback status: ${escapeHtml(fallbackTrendStatus)}</div>
              <div>fallback risk: ${escapeHtml(fallbackRiskSummary.label)}</div>
              <div>fallback trend: ${escapeHtml(fallbackTrendLabel)} · ${escapeHtml(fallbackTrendCounts)}</div>
              <div>ops hint: ${escapeHtml(operationalStateSummary.hint)}</div>
            </div>
          </div>
          <div class="ops-item">
            <div class="ops-item-title">command readiness</div>
            <div class="ops-item-meta">
              <div>status: ${escapeHtml(commandReadiness?.status || "-")} · active ${escapeHtml(String(commandReadiness?.activePluginCount ?? 0))}</div>
              <div>readiness risk: ${escapeHtml(commandReadinessRiskSummary.label)}</div>
              <div>${escapeHtml(commandReadiness?.summary || "미표시")}</div>
              <div>reason: ${escapeHtml(commandReadiness?.reason || "-")} · recovery ${escapeHtml(String(commandReadiness?.pendingRecoveryTotal ?? 0))}</div>
              <div>recent expired: ${escapeHtml(commandReadiness?.recentExpiredCommand ? "yes" : "no")} · undelivered ${escapeHtml(formatDuration(commandReadiness?.oldestUndeliveredMs))}</div>
              <div>${escapeHtml(commandReadinessBottleneckPreview)}</div>
              <div>lag threshold: ${escapeHtml(formatDuration(commandReadiness?.timingLagThresholdMs))} · ${escapeHtml(commandReadiness?.timingLagThresholdSource || "-")}</div>
              <div>next check: ${escapeHtml(commandReadinessRiskSummary.hint)}</div>
            </div>
          </div>
        `;
      }

      function getSelectedNodeSummary() {
        if (!Array.isArray(pendingSelection) || pendingSelection.length === 0) {
          return null;
        }
        const primary = pendingSelection[0];
        if (!primary || typeof primary !== "object") {
          return null;
        }
        return {
          id: typeof primary.id === "string" ? primary.id : null,
          name: typeof primary.name === "string" ? primary.name : null,
          type: typeof primary.type === "string" ? primary.type : null
        };
      }

      function formatPaddingValue(layout) {
        if (!layout || typeof layout !== "object") {
          return "-";
        }
        const top = Number.isFinite(layout.paddingTop) ? layout.paddingTop : null;
        const right = Number.isFinite(layout.paddingRight) ? layout.paddingRight : null;
        const bottom = Number.isFinite(layout.paddingBottom) ? layout.paddingBottom : null;
        const left = Number.isFinite(layout.paddingLeft) ? layout.paddingLeft : null;
        if (
          top === null &&
          right === null &&
          bottom === null &&
          left === null
        ) {
          return "-";
        }
        return `T ${top ?? "-"} · R ${right ?? "-"} · B ${bottom ?? "-"} · L ${left ?? "-"}`;
      }

      function countObjectEntries(value) {
        if (!value || typeof value !== "object") {
          return 0;
        }
        return Object.keys(value).length;
      }

      function resolveDetailCoverage(detail) {
        const node = detail?.node || null;
        const layout = detail?.layout || {};
        const source = detail?.sourceComponent || null;
        const coverage = {
          layoutMode: typeof layout.layoutMode === "string" && layout.layoutMode.length > 0,
          itemSpacing: Number.isFinite(layout.itemSpacing),
          padding: ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"].some((field) =>
            Number.isFinite(layout[field])
          ),
          sizing:
            (typeof layout.primaryAxisSizingMode === "string" &&
              layout.primaryAxisSizingMode.length > 0) ||
            (typeof layout.counterAxisSizingMode === "string" &&
              layout.counterAxisSizingMode.length > 0),
          variantProperties: countObjectEntries(detail?.variantProperties) > 0,
          componentProperties: countObjectEntries(detail?.componentProperties) > 0,
          sourceComponent:
            Boolean(source?.id) || Boolean(source?.mainComponent?.id) || Boolean(node?.mainComponent?.id)
        };
        const covered = Object.values(coverage).filter(Boolean).length;
        const total = Object.keys(coverage).length;
        let status = "minimal";
        if (covered >= 6) {
          status = "complete";
        } else if (covered >= 3) {
          status = "partial";
        }
        return { coverage, covered, total, status };
      }

      function renderSelectedNodeDetailPanel() {
        if (!detailGridEl) {
          return;
        }

        if (!bridgeEnabled) {
          detailGridEl.innerHTML = `
            <div class="detail-item">
              <div class="detail-item-title">브리지가 꺼져 있습니다</div>
              <div class="detail-item-meta">
                <div>브리지를 켜면 선택 노드 세부 정보를 다시 조회합니다.</div>
              </div>
            </div>
          `;
          return;
        }

        if (!bridgeConnected) {
          detailGridEl.innerHTML = `
            <div class="detail-item">
              <div class="detail-item-title">서버 연결 후 세부 확인 가능</div>
              <div class="detail-item-meta">
                <div>브리지 연결이 복구되면 선택 노드 구현 정보를 조회합니다.</div>
              </div>
            </div>
          `;
          return;
        }

        const selected = getSelectedNodeSummary();
        if (!selected || !selected.id) {
          detailGridEl.innerHTML = `
            <div class="detail-item">
              <div class="detail-item-title">선택된 노드가 없습니다</div>
              <div class="detail-item-meta">
                <div>Figma 캔버스에서 레이어를 선택하면 layout/variant/component 세부가 표시됩니다.</div>
              </div>
            </div>
          `;
          return;
        }

        if (detailFetchInFlight && (!selectedNodeDetails || selectedNodeDetails.targetNodeId !== selected.id)) {
          detailGridEl.innerHTML = `
            <div class="detail-item">
              <div class="detail-item-title">선택 노드 세부 조회 중...</div>
              <div class="detail-item-meta">
                <div>node: ${escapeHtml(selected.name || selected.id)} (${escapeHtml(selected.type || "-")})</div>
              </div>
            </div>
          `;
          return;
        }

        if (!selectedNodeDetails || selectedNodeDetails.targetNodeId !== selected.id) {
          detailGridEl.innerHTML = `
            <div class="detail-item">
              <div class="detail-item-title">선택 노드 세부 정보 준비 중</div>
              <div class="detail-item-meta">
                <div>node: ${escapeHtml(selected.name || selected.id)} (${escapeHtml(selected.type || "-")})</div>
              </div>
            </div>
          `;
          return;
        }

        if (selectedNodeDetails.error) {
          detailGridEl.innerHTML = `
            <div class="detail-item">
              <div class="detail-item-title">선택 노드 세부 조회 실패</div>
              <div class="detail-item-meta">
                <div>${escapeHtml(selectedNodeDetails.error)}</div>
                <div>node: ${escapeHtml(selected.id)}</div>
                <div>마지막 시도: ${escapeHtml(formatTimeLabel(selectedNodeDetailsSyncAt))}</div>
              </div>
            </div>
          `;
          return;
        }

        const detail = selectedNodeDetails.detail || {};
        const node = detail.node || {};
        const layout = detail.layout || {};
        const sourceComponent = detail.sourceComponent || {};
        const variantCount = countObjectEntries(detail.variantProperties);
        const componentCount = countObjectEntries(detail.componentProperties);
        const coverage = resolveDetailCoverage(detail);
        const fallbackLabel = selectedNodeDetails.fallbackUsed
          ? `사용됨 (${selectedNodeDetails.endpointUsed || "-"})`
          : `없음 (${selectedNodeDetails.endpointUsed || "-"})`;

        detailGridEl.innerHTML = `
          <div class="detail-item">
            <div class="detail-item-title">노드 식별</div>
            <div class="detail-item-meta">
              <div>id: ${escapeHtml(node.id || selected.id)}</div>
              <div>name: ${escapeHtml(node.name || selected.name || "-")}</div>
              <div>type: ${escapeHtml(node.type || selected.type || "-")}</div>
              <div>마지막 갱신: ${escapeHtml(formatTimeLabel(selectedNodeDetailsSyncAt))}</div>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-item-title">Auto-layout / Sizing</div>
            <div class="detail-item-meta">
              <div>layoutMode: ${escapeHtml(layout.layoutMode || "-")}</div>
              <div>itemSpacing: ${escapeHtml(Number.isFinite(layout.itemSpacing) ? String(layout.itemSpacing) : "-")}</div>
              <div>padding: ${escapeHtml(formatPaddingValue(layout))}</div>
              <div>sizing: ${escapeHtml(layout.primaryAxisSizingMode || "-")} / ${escapeHtml(layout.counterAxisSizingMode || "-")}</div>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-item-title">Component / Variant</div>
            <div class="detail-item-meta">
              <div>variantProperties: ${escapeHtml(String(variantCount))}</div>
              <div>componentProperties: ${escapeHtml(String(componentCount))}</div>
              <div>source component: ${escapeHtml(sourceComponent.name || sourceComponent.id || "-")}</div>
              <div>source set: ${escapeHtml(sourceComponent.componentSetName || sourceComponent.componentSetId || "-")}</div>
            </div>
          </div>
          <div class="detail-item">
            <div class="detail-item-title">Completeness / Fallback</div>
            <div class="detail-item-meta">
              <div>completeness: ${escapeHtml(coverage.status)} (${escapeHtml(String(coverage.covered))}/${escapeHtml(String(coverage.total))})</div>
              <div>fallback: ${escapeHtml(fallbackLabel)}</div>
              <div>truncated: ${escapeHtml(String(Boolean(selectedNodeDetails.truncated)))}</div>
            </div>
          </div>
        `;
      }

      async function requestNodeDetails(path, payload) {
        const response = await fetch(`${bridgeOrigin}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (!data || data.ok !== true) {
          throw new Error("Invalid detail payload");
        }
        return data.result || {};
      }

      function normalizeSelectedNodeDetail(rawResult, endpointUsed) {
        const isInstanceResult = rawResult && typeof rawResult === "object" && rawResult.instance;
        const node = isInstanceResult
          ? rawResult.instance
          : rawResult && rawResult.node
            ? rawResult.node
            : rawResult && Array.isArray(rawResult.variants) && rawResult.variants[0]
              ? rawResult.variants[0]
              : null;
        const sourceComponent = isInstanceResult
          ? {
              id: rawResult.sourceComponent?.id || null,
              name: rawResult.sourceComponent?.name || null,
              key: rawResult.sourceComponent?.key || null,
              componentSetId: rawResult.sourceComponentSet?.id || null,
              componentSetName: rawResult.sourceComponentSet?.name || null
            }
          : {
              id: node?.mainComponent?.id || null,
              name: node?.mainComponent?.name || null,
              key: node?.mainComponent?.key || null,
              componentSetId: node?.componentSet?.id || null,
              componentSetName: node?.componentSet?.name || null
            };

        return {
          endpointUsed,
          detail: {
            node: {
              id: node?.id || null,
              name: node?.name || null,
              type: node?.type || null
            },
            layout: {
              layoutMode: node?.layoutMode || null,
              itemSpacing: Number.isFinite(node?.itemSpacing) ? node.itemSpacing : null,
              paddingTop: Number.isFinite(node?.paddingTop) ? node.paddingTop : null,
              paddingRight: Number.isFinite(node?.paddingRight) ? node.paddingRight : null,
              paddingBottom: Number.isFinite(node?.paddingBottom) ? node.paddingBottom : null,
              paddingLeft: Number.isFinite(node?.paddingLeft) ? node.paddingLeft : null,
              primaryAxisSizingMode: node?.primaryAxisSizingMode || null,
              counterAxisSizingMode: node?.counterAxisSizingMode || null
            },
            variantProperties:
              (isInstanceResult ? rawResult.variantProperties : node?.variantProperties) || {},
            componentProperties:
              (isInstanceResult ? rawResult.componentProperties : node?.componentProperties) || {},
            sourceComponent
          },
          truncated: Boolean(rawResult?.truncated)
        };
      }

      async function refreshSelectedNodeDetails(options = {}) {
        const force = Boolean(options.force);
        const selected = getSelectedNodeSummary();
        if (!bridgeEnabled || !bridgeOrigin || !bridgeConnected || !selected || !selected.id) {
          selectedNodeDetails = null;
          renderSelectedNodeDetailPanel();
          return;
        }
        if (!force && detailLastRequestedNodeId === selected.id && selectedNodeDetails) {
          renderSelectedNodeDetailPanel();
          return;
        }

        detailLastRequestedNodeId = selected.id;
        detailFetchInFlight = true;
        const requestToken = ++detailRequestToken;
        renderSelectedNodeDetailPanel();

        const payload = {
          pluginId: getPluginId(),
          targetNodeId: selected.id,
          detailLevel: "full",
          includeChildren: false,
          maxDepth: 1
        };

        const endpointCandidates = [];
        const nodeType = (selected.type || "").toUpperCase();
        if (nodeType === "INSTANCE") {
          endpointCandidates.push({
            path: "/api/get-instance-details",
            payload: {
              ...payload,
              includeResolvedChildren: false
            }
          });
        } else if (nodeType === "COMPONENT" || nodeType === "COMPONENT_SET") {
          endpointCandidates.push({
            path: "/api/get-component-variant-details",
            payload
          });
        }
        endpointCandidates.push({
          path: "/api/get-node-details",
          payload
        });

        let lastError = null;
        let selectedResult = null;
        let endpointUsed = null;
        for (const candidate of endpointCandidates) {
          try {
            const result = await requestNodeDetails(candidate.path, candidate.payload);
            selectedResult = result;
            endpointUsed = candidate.path.replace("/api/", "");
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (requestToken !== detailRequestToken) {
          return;
        }

        if (!selectedResult || !endpointUsed) {
          selectedNodeDetails = {
            targetNodeId: selected.id,
            error: lastError instanceof Error ? lastError.message : "세부 정보 조회 실패"
          };
          selectedNodeDetailsSyncAt = new Date().toLocaleTimeString();
          detailFetchInFlight = false;
          renderSelectedNodeDetailPanel();
          return;
        }

        const normalized = normalizeSelectedNodeDetail(selectedResult, endpointUsed);
        selectedNodeDetails = {
          targetNodeId: selected.id,
          ...normalized,
          fallbackUsed: endpointUsed === "get-node-details" && endpointCandidates.length > 1
        };
        selectedNodeDetailsSyncAt = new Date().toLocaleTimeString();
        detailFetchInFlight = false;
        renderSelectedNodeDetailPanel();
      }

      async function refreshRuntimeOps(options = {}) {
        const force = Boolean(options.force);
        if (!bridgeEnabled || !bridgeOrigin || !bridgeConnected) {
          runtimeOpsSnapshot = null;
          renderRuntimeOpsPanel();
          return;
        }

        const now = Date.now();
        if (!force && now - lastRuntimeOpsFetchAt < RUNTIME_OPS_MIN_REFRESH_MS) {
          return;
        }
        lastRuntimeOpsFetchAt = now;

        try {
          const response = await fetch(`${bridgeOrigin}/api/runtime-ops?staleLimit=5`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();
          runtimeOpsSnapshot = data && data.ok ? data.result || null : null;
          lastRuntimeOpsSyncAt = new Date().toLocaleTimeString();
        } catch (error) {
          runtimeOpsSnapshot = {
            error: error instanceof Error ? error.message : String(error)
          };
          lastRuntimeOpsSyncAt = new Date().toLocaleTimeString();
        }

        renderRuntimeOpsPanel();
        refreshServerStatus();
      }

      function setConnectionFlags(next = {}) {
        if (typeof next.bridgeConnected === "boolean") {
          bridgeConnected = next.bridgeConnected;
        }
        if (typeof next.sessionRegistered === "boolean") {
          sessionRegistered = next.sessionRegistered;
        }
        if (typeof next.needsReconnect === "boolean") {
          needsReconnect = next.needsReconnect;
        }
        if (typeof next.needsReregister === "boolean") {
          needsReregister = next.needsReregister;
        }
        if (!bridgeConnected) {
          closeWsProbeSocket();
          eventsLastAt = null;
          eventsLastAtMs = null;
          wsCommandLastAt = null;
          wsCommandLastAtMs = null;
          wsExperimentLastAt = null;
          wsExperimentLastAtMs = null;
          if (wsExperimentState === "probing" || wsExperimentState === "connected") {
            wsExperimentState = "idle";
            wsExperimentLastError = "브리지 연결이 끊겨 WS 실험 상태를 초기화했습니다.";
            wsExperimentLastAt = new Date().toLocaleTimeString();
            wsExperimentLastAtMs = Date.now();
            wsExperimentChannelMode = "unknown";
            wsExperimentLastAckStatus = null;
            wsExperimentLastAckAt = null;
            wsExperimentLastResultStatus = null;
            wsExperimentLastResultAt = null;
            wsExperimentHelloSeen = false;
            wsExperimentSessionEventSeen = false;
            wsExperimentCommandEventSeen = false;
            wsExperimentLastMessageType = null;
            wsExperimentEnabledCommands = [];
            wsInspectionSupportSeen = false;
            wsInspectionLastStatus = "unknown";
            wsInspectionLastAt = null;
            wsInspectionLastNote = null;
            wsInspectionReverifyHttpRecommended = true;
            updateWsFallbackRecommendation();
          }
        }
        updateActionButtons();
        renderRuntimeOpsPanel();
        renderSelectedNodeDetailPanel();
        if (bridgeConnected) {
          ensureEventStream();
          void ensureWsCommandChannel();
        } else {
          closeEventStream();
          closeWsCommandSocket();
          clearWsCommandReconnectTimer();
          stopPluginHeartbeatLoop();
        }
      }

      function clearAutoRecoverTimer() {
        if (autoRecoverTimer) {
          clearTimeout(autoRecoverTimer);
          autoRecoverTimer = null;
        }
        autoRecoverDueAt = null;
        if (autoRecoverTickTimer) {
          clearInterval(autoRecoverTickTimer);
          autoRecoverTickTimer = null;
        }
      }

      function ensureAutoRecoverTick() {
        if (autoRecoverTickTimer) {
          return;
        }
        autoRecoverTickTimer = setInterval(() => {
          if (!autoRecoverTimer || !autoRecoverDueAt) {
            clearAutoRecoverTimer();
            return;
          }
          renderPrimaryAction();
        }, 250);
      }

      function clearBootstrapRetryTimer() {
        if (bootstrapRetryTimer) {
          clearTimeout(bootstrapRetryTimer);
          bootstrapRetryTimer = null;
        }
      }

      function stopReadyHandshake() {
        if (readyTimer) {
          clearInterval(readyTimer);
          readyTimer = null;
        }
      }

      function stopPolling() {
        if (pollSchedulerTimer) {
          clearTimeout(pollSchedulerTimer);
          pollSchedulerTimer = null;
        }
      }

      function scheduleNextPoll(options = {}) {
        if (!bridgeEnabled) {
          return;
        }
        if (wsCommandConnected) {
          stopPolling();
          currentPollIntervalMs = getPollIntervalMs();
          renderRealtimeDebugPanel();
          return;
        }
        if (pollSchedulerTimer) {
          clearTimeout(pollSchedulerTimer);
        }
        if (shouldDelayPollingForWsRecovery()) {
          const delayMs = Math.max(
            POLL_INTERVALS_MS.standby,
            Math.max(250, (wsCommandReconnectDueAt || Date.now()) - Date.now())
          );
          currentPollIntervalMs = delayMs;
          pollSchedulerTimer = setTimeout(() => {
            pollSchedulerTimer = null;
            if (shouldDelayPollingForWsRecovery()) {
              scheduleNextPoll(options);
              return;
            }
            pollCommands();
          }, delayMs);
          renderRealtimeDebugPanel();
          return;
        }
        const requestedDelay = Number.isFinite(options.delayMs) ? options.delayMs : null;
        const delayMs = requestedDelay !== null ? Math.max(0, requestedDelay) : getPollIntervalMs();
        currentPollIntervalMs = delayMs;
        pollSchedulerTimer = setTimeout(() => {
          pollSchedulerTimer = null;
          pollCommands();
        }, delayMs);
      }

      function updateRecoveryPhase(nextPhase, details = {}) {
        recoveryPhase = nextPhase;
        const reason = details.reason ? String(details.reason) : "";
        const isAuto = Boolean(details.isAuto);
        if (nextPhase === "stable") {
          return;
        }
        if (nextPhase === "heartbeat_failed") {
          setBridgeOrigin(null);
          setConnectionFlags({
            bridgeConnected: false,
            sessionRegistered: false,
            needsReconnect: true,
            needsReregister: Boolean(pluginId)
          });
          setServerStatus(
            "하트비트 실패",
            "warn",
            reason || "명령 폴링 중 서버 응답이 끊겼습니다.",
            "복구 순서: 서버 재연결 → 세션 재등록",
            "복구 준비"
          );
          setSessionStatus(
            "세션 확인 대기",
            "warn",
            "서버 연결 복구 후 세션 재등록을 이어서 진행합니다.",
            "",
            "대기 중"
          );
          updateRuntimeState("waiting_session", {
            clearErrorCode: true,
            guidance: "하트비트 실패를 감지해 자동 복구 시퀀스를 시작했습니다."
          });
          renderSessionsList();
          renderRuntimeOpsPanel();
          return;
        }
        if (nextPhase === "reconnecting") {
          const label = isAuto ? "서버 자동 재연결 중..." : "서버 재연결 중...";
          setServerStatus(
            label,
            "ok",
            reason || "",
            "서버 재연결이 완료되면 세션 재등록 단계로 진행합니다.",
            "진행 중"
          );
          setSessionStatus(
            "세션 확인 대기",
            "warn",
            "재연결 후 세션 재등록을 준비 중입니다.",
            "",
            "대기 중"
          );
          return;
        }
        if (nextPhase === "reregistering") {
          setSessionStatus(
            "세션 재등록 중...",
            "ok",
            buildSessionMeta(),
            "복구 마지막 단계에서 현재 파일 세션을 다시 등록합니다.",
            "진행 중"
          );
          return;
        }
        if (nextPhase === "manual_reconnect_required") {
          setConnectionFlags({
            bridgeConnected: false,
            sessionRegistered: false,
            needsReconnect: true,
            needsReregister: Boolean(pluginId)
          });
          setServerStatus(
            "서버 연결 안 됨",
            "warn",
            reason || "서버 재연결에 실패했습니다.",
            isAuto
              ? "자동 복구가 계속 실패하면 서버 프로세스를 확인한 뒤 '서버 다시 확인'을 눌러주세요."
              : "이 버튼은 서버 실행이 아닌 연결 재확인입니다. 서버 프로세스를 먼저 실행해 주세요.",
            "서버 확인 필요"
          );
          setSessionStatus(
            "세션 확인 대기",
            "warn",
            "서버 연결이 복구되기 전에는 세션도 연결할 수 없습니다.",
            "",
            "대기 중"
          );
          return;
        }
        if (nextPhase === "manual_reregister_required") {
          setConnectionFlags({
            bridgeConnected: true,
            sessionRegistered: false,
            needsReconnect: false,
            needsReregister: true
          });
          setSessionStatus(
            "세션 연결 안 됨",
            "warn",
            reason || "세션 재등록에 실패했습니다.",
            "브리지는 연결되어 있습니다. '세션 재등록'으로 현재 파일 세션을 다시 연결하세요.",
            "세션 확인 필요"
          );
        }
      }

      function pauseBridgeUi() {
        closeEventStream();
        clearEventReconnectTimer();
        clearEventRefreshDebounce();
        closeWsProbeSocket();
        closeWsCommandSocket();
        clearWsCommandReconnectTimer();
        stopPluginHeartbeatLoop();
        setBridgeOrigin(null);
        setConnectionFlags({
          bridgeConnected: false,
          sessionRegistered: false,
          needsReconnect: false,
          needsReregister: false
        });
        setServerStatus(
          "브리지 꺼짐",
          "warn",
          "사용자가 브리지를 일시 중지했습니다.",
          "상단 토글을 다시 켜면 서버 연결과 세션 등록을 재개합니다.",
          "일시 중지"
        );
        setSessionStatus(
          "세션 일시 중지",
          "warn",
          buildSessionMeta(),
          "브리지가 꺼져 있는 동안에는 selection 동기화와 명령 수신이 멈춥니다.",
          "일시 중지"
        );
        updateRuntimeState("paused", {
          clearErrorCode: true,
          guidance: "브리지를 켜면 런타임과 세션 동기화가 자동으로 다시 시작됩니다."
        });
        selectedNodeDetails = null;
        selectedNodeDetailsSyncAt = null;
        detailLastRequestedNodeId = null;
        detailFetchInFlight = false;
        eventsLastAt = null;
        eventsLastAtMs = null;
        eventsLastEventName = null;
        eventsLastError = null;
        eventsReconnectDueAt = null;
        wsCommandConnected = false;
        wsCommandLastAt = null;
        wsCommandLastAtMs = null;
        wsCommandLastError = null;
        wsCommandLastUrl = null;
        wsCommandLastCommandId = null;
        wsCommandMessageCount = 0;
        wsCommandAckedCount = 0;
        wsExperimentState = "idle";
        wsExperimentLastAt = null;
        wsExperimentLastAtMs = null;
        wsExperimentLastError = null;
        wsExperimentLastCode = null;
        wsExperimentLastReason = null;
        wsExperimentLastUrl = null;
        wsExperimentMessageCount = 0;
        wsExperimentHelloSeen = false;
        wsExperimentSessionEventSeen = false;
        wsExperimentCommandEventSeen = false;
        wsExperimentLastMessageType = null;
        wsExperimentChannelMode = "unknown";
        wsExperimentLastAckStatus = null;
        wsExperimentLastAckAt = null;
        wsExperimentLastResultStatus = null;
        wsExperimentLastResultAt = null;
        wsExperimentEnabledCommands = [];
        wsInspectionSupportSeen = false;
        wsInspectionLastStatus = "unknown";
        wsInspectionLastAt = null;
        wsInspectionLastNote = null;
        wsInspectionReverifyHttpRecommended = true;
        commandTransportById.clear();
        updateWsFallbackRecommendation();
        renderSessionsList();
        renderRuntimeOpsPanel();
        renderSelectedNodeDetailPanel();
        renderRealtimeDebugPanel();
      }

      async function setBridgeEnabled(nextEnabled) {
        bridgeEnabled = Boolean(nextEnabled);
        renderBridgeToggle();

        if (!bridgeEnabled) {
          recoveryInFlight = false;
          updateRecoveryPhase("stable");
          stopPolling();
          stopReadyHandshake();
          closeEventStream();
          clearEventReconnectTimer();
          clearEventRefreshDebounce();
          clearAutoRecoverTimer();
          clearBootstrapRetryTimer();
          pauseBridgeUi();
          return;
        }

        setServerStatus("서버 확인 중...", "ok", "", "", "준비 중");
        setSessionStatus("세션 확인 대기", "warn", "브리지를 다시 시작하는 중입니다.", "", "대기 중");
        updateRuntimeState("waiting_session", {
          clearErrorCode: true,
          guidance: "브리지 연결 후 세션이 등록되면 명령 실행이 가능합니다."
        });
        await bootstrapBridge();
        ensureEventStream({ forceRestart: true });
      }

      function scheduleAutoRecover(reason) {
        if (!bridgeEnabled) {
          return;
        }
        if (autoRecoverTimer) {
          return;
        }

        autoRecoverDueAt = Date.now() + AUTO_RECOVER_DELAY_MS;
        ensureAutoRecoverTick();
        renderPrimaryAction();
        autoRecoverTimer = setTimeout(async () => {
          autoRecoverTimer = null;
          autoRecoverDueAt = null;
          if (autoRecoverTickTimer) {
            clearInterval(autoRecoverTickTimer);
            autoRecoverTickTimer = null;
          }
          autoRecoverAttempts += 1;
          try {
            await reconnectBridge({ isAuto: true, reason, trigger: "heartbeat_failed" });
          } catch (error) {
            // reconnectBridge handles UI state
          }
        }, AUTO_RECOVER_DELAY_MS);
      }

      function getPluginId() {
        return pluginId || "default";
      }

      function collectPluginUiMetricsSnapshot() {
        return {
          generatedAt: new Date().toISOString(),
          polls: pollRequestCount,
          commandFetches: pollCommandFetchCount,
          pollDrivenReads: {
            runtime: pollRuntimeRefreshCount,
            detail: pollDetailRefreshCount
          },
          eventDrivenReads: {
            sessions: eventDrivenSessionRefreshCount,
            runtime: eventDrivenRuntimeRefreshCount,
            detail: eventDrivenDetailRefreshCount
          },
          transport: {
            bridgeConnected,
            eventsConnected,
            wsCommandConnected
          }
        };
      }

      async function postJson(path, payload) {
        if (!bridgeOrigin) {
          throw new Error("Bridge origin is not resolved");
        }

        const response = await fetch(`${bridgeOrigin}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      }

      async function resolveBridgeOrigin() {
        for (const origin of BRIDGE_ORIGINS) {
          try {
            const startedAt = performance.now();
            const response = await fetch(`${origin}/health`);
            if (!response.ok) {
              continue;
            }

            const data = await response.json();
            if (data && data.ok && data.server === "writable-mcp-bridge") {
              healthLatencyMs = Math.round(performance.now() - startedAt);
              setServerHealthSnapshot(data);
              setBridgeOrigin(origin);
              return origin;
            }
          } catch (error) {
            // keep probing
          }
        }

        throw new Error("No writable MCP bridge health endpoint found");
      }

      function postReadyMessage() {
        parent.postMessage({ pluginMessage: { type: "ready" } }, "*");
      }

      function startReadyHandshake() {
        if (!bridgeEnabled) {
          return;
        }
        if (readyTimer) {
          return;
        }

        postReadyMessage();
        readyTimer = setInterval(() => {
          if (pluginId) {
            clearInterval(readyTimer);
            readyTimer = null;
            return;
          }
          postReadyMessage();
        }, 1000);
      }

      async function registerBridge() {
        if (!bridgeEnabled) {
          return;
        }
        await resolveBridgeOrigin();
        pollConsecutiveFailures = 0;
        startReadyHandshake();
        setConnectionFlags({
          bridgeConnected: true,
          sessionRegistered: false,
          needsReconnect: false,
          needsReregister: false
        });
        ensureEventStream({ forceRestart: true });
        await ensureWsCommandChannel({ forceRestart: true });
        refreshServerStatus();
        setSessionStatus(
          currentFileName,
          "ok",
          buildSessionMeta(),
          "세션이 등록되면 현재 파일을 대상으로 명령을 실행할 수 있습니다.",
          "세션 확인 필요"
        );
        await refreshSessionsList();
        await refreshRuntimeOps({ force: true });
        await refreshSelectedNodeDetails({ force: true });
      }

      async function registerPluginSession() {
        if (!bridgeEnabled) {
          return;
        }
        if (!bridgeOrigin || !pluginId) {
          return;
        }

        await postJson("/plugin/register", {
          pluginId,
          fileName: currentFileName,
          pageId: currentPageId,
          pageName: currentPageLabel
        });
        await publishSelection(pendingSelection);
        setConnectionFlags({
          bridgeConnected: true,
          sessionRegistered: true,
          needsReconnect: false,
          needsReregister: false
        });
        ensureEventStream({ forceRestart: true });
        await ensureWsCommandChannel({ forceRestart: true });
        recoveryInFlight = false;
        updateRecoveryPhase("stable");
        autoRecoverAttempts = 0;
        clearAutoRecoverTimer();
        refreshServerStatus();
        setSessionStatus(currentFileName, "ok", buildSessionMeta(), "", "세션 연결 정상");
        updateRuntimeState("idle", {
          clearErrorCode: true,
          guidance: "",
          message: "세션이 정상 등록되었습니다."
        });
        updateActionButtons();
        await refreshSessionsList();
        await refreshRuntimeOps({ force: true });
        await refreshSelectedNodeDetails({ force: true });
      }

      async function publishSelection(selection) {
        pendingSelection = selection || [];
        if (!bridgeEnabled) {
          return;
        }
        if (!pluginId) {
          return;
        }

        await postJson("/plugin/selection", {
          pluginId,
          selection: pendingSelection
        });
      }

      async function sendCommandResult(commandId, result, error) {
        if (!bridgeEnabled) {
          return;
        }
        const transport = commandTransportById.get(commandId);
        if (transport === "ws" && wsCommandConnected) {
          const sent = sendWsPluginLifecycleMessage("ws.plugin.command.result", {
            commandId,
            result,
            error
          });
          if (sent) {
            commandTransportById.delete(commandId);
            return;
          }
        }
        await postJson("/plugin/results", {
          commandId,
          result,
          error
        });
        commandTransportById.delete(commandId);
      }

      async function pollCommands() {
        if (!bridgeEnabled) {
          return;
        }
        if (wsCommandConnected) {
          scheduleNextPoll();
          return;
        }
        if (inFlightPoll) {
          return;
        }
        if (!bridgeOrigin) {
          scheduleNextPoll();
          return;
        }

        inFlightPoll = true;
        try {
          pollRequestCount += 1;
          const startedAt = performance.now();
          const response = await fetch(
            `${bridgeOrigin}/plugin/commands?pluginId=${encodeURIComponent(getPluginId())}`
          );
          pollCommandFetchCount += 1;
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          const data = await response.json();
          const commands = Array.isArray(data.commands) ? data.commands : [];
          lastPollAt = new Date().toLocaleTimeString();
          lastPollLatencyMs = Math.round(performance.now() - startedAt);
          pollConsecutiveFailures = 0;
          if (commands.length > 0) {
            lastCommandActivityAt = Date.now();
          }

          for (const command of commands) {
            dispatchBridgeCommand(command, "polling");
          }
          if (!eventsConnected && commands.length > 0) {
            pollRuntimeRefreshCount += 1;
            await refreshRuntimeOps();
            pollDetailRefreshCount += 1;
            await refreshSelectedNodeDetails();
          }
        } catch (error) {
          pollConsecutiveFailures += 1;
          updateRecoveryPhase("heartbeat_failed", {
            reason: error instanceof Error ? error.message : String(error)
          });
          if (pluginId) {
            scheduleAutoRecover(error instanceof Error ? error.message : String(error));
          }
        } finally {
          inFlightPoll = false;
          if (bridgeEnabled && !recoveryInFlight) {
            scheduleNextPoll();
          }
        }
      }

      function startPolling(options = {}) {
        if (!bridgeEnabled) {
          return;
        }
        if (wsCommandConnected) {
          stopPolling();
          return;
        }
        stopPolling();
        const immediate = options.immediate !== false;
        if (immediate) {
          pollCommands();
          return;
        }
        scheduleNextPoll();
      }

      async function bootstrapBridge() {
        if (!bridgeEnabled) {
          return;
        }
        try {
          clearBootstrapRetryTimer();
          await registerBridge();
          recoveryInFlight = false;
          updateRecoveryPhase("stable");
          await ensureWsCommandChannel({ forceRestart: true });
          startPolling({ immediate: false });
        } catch (error) {
          if (!bridgeEnabled) {
            return;
          }
          setBridgeOrigin(null);
          setServerStatus(
            "서버 연결 안 됨",
            "warn",
            `${error instanceof Error ? error.message : error}`,
            "플러그인에서 서버를 직접 실행할 수 없습니다. 터미널에서 xbridge 서버를 실행한 뒤 '서버 다시 확인'을 눌러주세요.",
            "서버 확인 필요"
          );
          setSessionStatus(
            "세션 확인 대기",
            "warn",
            "서버에 먼저 연결되어야 현재 파일 세션도 연결할 수 있습니다.",
            "",
            "대기 중"
          );
          updateRuntimeState("waiting_session", {
            clearErrorCode: true,
            guidance: "서버 연결 후 세션 등록이 완료되면 명령 런타임이 유휴 상태로 전환됩니다."
          });
          renderSessionsList();
          renderRuntimeOpsPanel();
          clearBootstrapRetryTimer();
          bootstrapRetryTimer = setTimeout(() => {
            bootstrapRetryTimer = null;
            bootstrapBridge();
          }, 3000);
        }
      }

      async function reconnectBridge(options = {}) {
        if (!bridgeEnabled) {
          pauseBridgeUi();
          return;
        }
        clearAutoRecoverTimer();
        const isAuto = Boolean(options.isAuto);
        const reason = options.reason
          ? `${options.reason}${isAuto ? `\n자동 시도 횟수: ${autoRecoverAttempts + 1}` : ""}`
          : isAuto
            ? `자동 시도 횟수: ${autoRecoverAttempts + 1}`
            : "";
        recoveryInFlight = true;
        updateRecoveryPhase("reconnecting", {
          reason,
          isAuto
        });
        try {
          await registerBridge();
          if (pluginId) {
            updateRecoveryPhase("reregistering", {
              reason: "서버 재연결 완료, 세션 재등록 진행",
              isAuto
            });
            await registerPluginSession();
            await ensureWsCommandChannel({ forceRestart: true });
            startPolling();
          } else {
            startReadyHandshake();
            recoveryInFlight = false;
            updateRecoveryPhase("stable");
            startPolling({ immediate: false });
            setConnectionFlags({
              bridgeConnected: true,
              sessionRegistered: false,
              needsReconnect: false,
              needsReregister: false
            });
            refreshServerStatus();
            setSessionStatus(
              currentFileName,
              "ok",
              buildSessionMeta(),
              "잠시 후에도 연결되지 않으면 '세션 재등록'을 눌러 현재 파일 세션을 다시 연결하세요.",
              "세션 확인 필요"
            );
          }
        } catch (error) {
          recoveryInFlight = false;
          updateRecoveryPhase("manual_reconnect_required", {
            reason: `${error instanceof Error ? error.message : error}${isAuto ? `\n자동 시도 횟수: ${autoRecoverAttempts}` : ""}`,
            isAuto
          });
          if (isAuto) {
            scheduleAutoRecover("자동 재연결 실패");
          }
        } finally {
          if (bridgeEnabled) {
            scheduleNextPoll();
          }
        }
      }

      async function reregisterSession() {
        if (!bridgeEnabled) {
          pauseBridgeUi();
          return;
        }
        recoveryInFlight = true;
        updateRecoveryPhase("reregistering", {
          reason: "사용자 요청으로 세션 재등록을 시작합니다.",
          isAuto: false
        });
        updateRuntimeState("waiting_session", {
          clearErrorCode: true,
          guidance: "세션 재등록이 완료되면 명령 실행이 재개됩니다."
        });
        try {
          if (!bridgeOrigin) {
            await resolveBridgeOrigin();
            setConnectionFlags({
              bridgeConnected: true,
              needsReconnect: false
            });
          }

          if (!pluginId) {
            startReadyHandshake();
            setConnectionFlags({
              sessionRegistered: false,
              needsReregister: false
            });
            setSessionStatus(
              "세션 연결 안 됨",
              "ok",
              "플러그인이 아직 자신의 세션 정보를 보내지 않았습니다.",
              "플러그인 창이 현재 Figma 파일에서 열려 있는지 확인해 주세요.",
              "세션 확인 필요"
            );
            recoveryInFlight = false;
            startPolling({ immediate: false });
            return;
          }

          await registerPluginSession();
          await ensureWsCommandChannel({ forceRestart: true });
          startPolling();
        } catch (error) {
          recoveryInFlight = false;
          updateRecoveryPhase("manual_reregister_required", {
            reason: error instanceof Error ? error.message : String(error)
          });
        } finally {
          if (bridgeEnabled) {
            scheduleNextPoll();
          }
        }
      }

      window.onmessage = async (event) => {
        const message = event.data.pluginMessage;
        if (!message) {
          return;
        }

        if (message.type === "plugin_ready") {
          const previousPluginId = pluginId;
          pluginId = message.pluginId || "default";
          currentFileName = message.fileName || "연결된 파일 없음";
          currentPageId = message.pageId || null;
          const nextPageLabel = message.pageName || pluginId;
          const nowLabel = new Date().toLocaleTimeString();
          if (currentPageLabel !== nextPageLabel) {
            lastPageSyncAt = nowLabel;
          } else if (!lastPageSyncAt) {
            lastPageSyncAt = nowLabel;
          }
          currentPageLabel = nextPageLabel;
          lastSessionSyncAt = nowLabel;
          pluginLabel = `${currentFileName} / ${currentPageLabel}`;
          if (previousPluginId !== pluginId) {
            ensureEventStream({ forceRestart: true });
            await ensureWsCommandChannel({ forceRestart: true });
          }
          setConnectionFlags({
            needsReregister: false
          });
          if (message.sessionState === "ready") {
            updateRuntimeState(message.runtimeState === "idle" ? "idle" : "waiting_session", {
              clearErrorCode: true,
              guidance: ""
            });
          }
          if (readyTimer) {
            clearInterval(readyTimer);
            readyTimer = null;
          }

          try {
            await registerPluginSession();
            await ensureWsCommandChannel({ forceRestart: true });
            startPolling();
          } catch (error) {
            setConnectionFlags({
              sessionRegistered: false,
              needsReregister: true
            });
            setSessionStatus(
              "세션 연결 안 됨",
              "warn",
              `${error instanceof Error ? error.message : error}`,
              "현재 파일 세션을 서버에 다시 등록하지 못했습니다. 잠시 후 다시 시도하거나 '세션 재등록'을 눌러주세요.",
              "세션 확인 필요"
            );
            await refreshSessionsList();
            await refreshRuntimeOps({ force: true });
            await refreshSelectedNodeDetails({ force: true });
          }
          return;
        }

        if (message.type === "runtime_state") {
          if (message.runtimeState === "executing") {
            lastCommandActivityAt = Date.now();
            updateRuntimeState("executing", {
              commandId: message.commandId,
              commandType: message.commandType,
              preflightOk: message.preflightOk !== false,
              clearErrorCode: true,
              guidance: "명령 실행 중입니다. 완료 또는 오류 상태를 기다려 주세요."
            });
          }
          return;
        }

        if (message.type === "selection_changed") {
          try {
            await publishSelection(message.selection || []);
            await refreshSelectedNodeDetails({ force: true });
          } catch (error) {
            setConnectionFlags({
              sessionRegistered: false,
              needsReregister: true
            });
            setSessionStatus(
              "세션 연결 안 됨",
              "warn",
              `${error instanceof Error ? error.message : error}\n세션 등록이 끊겼을 수 있습니다. '세션 재등록'이 필요할 수 있습니다.`,
              "현재 파일 세션 정보를 다시 등록하면 selection 동기화가 복구됩니다.",
              "세션 확인 필요"
            );
            await refreshSessionsList();
            await refreshRuntimeOps({ force: true });
            await refreshSelectedNodeDetails({ force: true });
          }
        }

        if (message.type === "command_result") {
          lastCommandActivityAt = Date.now();
          const runtimeCode = classifyRuntimeErrorCode(message.error, message.errorCode);
          const runtimeMessage = message.error
            ? String(message.error)
            : `${message.commandType || "명령"} 실행이 완료되었습니다.`;
          const guidance = runtimeGuidanceFromCode(runtimeCode, message.guidance);
          if (message.runtimeState === "preflight_error") {
            updateRuntimeState("preflight_error", {
              commandId: message.commandId,
              commandType: message.commandType,
              preflightOk: message.preflightOk === false ? false : runtimePreflightOk,
              errorCode: runtimeCode || "ERR_PREFLIGHT",
              message: runtimeMessage,
              guidance
            });
          } else if (message.error) {
            updateRuntimeState("error", {
              commandId: message.commandId,
              commandType: message.commandType,
              preflightOk: message.preflightOk !== false,
              errorCode: runtimeCode || "ERR_RUNTIME_UNKNOWN",
              message: runtimeMessage,
              guidance
            });
          } else {
            updateRuntimeState("success", {
              commandId: message.commandId,
              commandType: message.commandType,
              preflightOk: message.preflightOk !== false,
              clearErrorCode: true,
              message: runtimeMessage,
              clearGuidance: true
            });
          }

          if (!message.commandId) {
            return;
          }

          try {
            await sendCommandResult(
              message.commandId,
              message.result || null,
              message.error || null
            );
            refreshServerStatus();
            setSessionStatus(
              currentFileName,
              message.error ? "warn" : "ok",
              buildSessionMeta(),
              message.error
                ? "명령 실행 중 일부 확인이 필요합니다. 하지만 세션 연결은 유지되고 있습니다."
                : "",
              message.error ? "세션 확인 필요" : "세션 연결 정상"
            );
          } catch (error) {
            setConnectionFlags({
              sessionRegistered: false,
              needsReregister: true
            });
            updateRuntimeState("error", {
              commandId: message.commandId,
              commandType: message.commandType,
              preflightOk: message.preflightOk !== false,
              errorCode: "ERR_RESULT_REPORT_FAILED",
              message: error instanceof Error ? error.message : String(error),
              guidance: "실행 결과 보고가 실패했습니다. 세션 재등록 후 다시 시도하세요."
            });
            setSessionStatus(
              "세션 연결 안 됨",
              "warn",
              `${error instanceof Error ? error.message : error}\n브리지는 살아 있지만 현재 세션 등록이 끊겼을 수 있습니다. '세션 재등록'을 눌러주세요.`,
              "세션 등록이 다시 되면 이어서 명령을 처리할 수 있습니다.",
              "세션 확인 필요"
            );
            await refreshSessionsList();
            await refreshRuntimeOps({ force: true });
            await refreshSelectedNodeDetails({ force: true });
          }
        }
      };

      reconnectBridgeButton.onclick = () => {
        reconnectBridge();
      };

      reregisterSessionButton.onclick = () => {
        reregisterSession();
      };

      bridgeToggleButton.onclick = async () => {
        await setBridgeEnabled(!bridgeEnabled);
      };

      refreshSessionsButton.onclick = async () => {
        await refreshSessionsList();
        await refreshRuntimeOps({ force: true });
      };

      refreshOpsButton.onclick = async () => {
        await refreshRuntimeOps({ force: true });
      };

      refreshDetailButton.onclick = async () => {
        await refreshSelectedNodeDetails({ force: true });
      };

      refreshRealtimeButton.onclick = async () => {
        clearEventReconnectTimer();
        eventsLastError = null;
        ensureEventStream({ forceRestart: true });
        renderRealtimeDebugPanel();
      };

      checkWsExperimentButton.onclick = async () => {
        await probeWsExperiment();
      };

      primaryActionButton.onclick = () => {
        if (typeof primaryActionHandler === "function") {
          primaryActionHandler();
        }
      };

      document.querySelectorAll(".quick-copy").forEach((button) => {
        button.addEventListener("click", async () => {
          const value = button.getAttribute("data-copy") || "";
          try {
            await navigator.clipboard.writeText(value);
            const original = button.textContent;
            button.textContent = "복사됨";
            setTimeout(() => {
              button.textContent = original || "복사";
            }, 900);
          } catch (error) {
            const original = button.textContent;
            button.textContent = "실패";
            setTimeout(() => {
              button.textContent = original || "복사";
            }, 900);
          }
        });
      });

      document.querySelectorAll("[data-designer-prompt]").forEach((button) => {
        button.addEventListener("click", () => {
          const prompt = button.getAttribute("data-designer-prompt") || "";
          if (designerInputEl) {
            designerInputEl.value = prompt;
            designerInputEl.focus();
          }
          renderDesignerIntentPreview(createUiDesignerIntentEnvelope(prompt, "suggest_then_apply"));
        });
      });

      if (designerInputEl) {
        designerInputEl.addEventListener("input", () => {
          const prompt = designerInputEl.value.trim();
          if (!prompt) {
            renderDesignerIntentPreview(null);
            return;
          }
          renderDesignerIntentPreview(createUiDesignerIntentEnvelope(prompt, "suggest_then_apply"));
        });
      }

      let designerSubmitInFlight = false;
      let designerStopRequested = false;
      let designerRequestController = null;

      const DESIGNER_ICONS = {
        send:
          '<svg class="designer-icon designer-send-icon" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5"></path><path d="m5 12 7-7 7 7"></path></svg>',
        stop:
          '<svg class="designer-icon designer-send-icon" width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.2" ry="2.2"></rect></svg>'
      };

      function setDesignerSubmitButtonBusy(isBusy) {
        if (!designerSubmitButton) {
          return;
        }
        designerSubmitButton.setAttribute("aria-busy", isBusy ? "true" : "false");
        designerSubmitButton.setAttribute("aria-label", isBusy ? "중지" : "전송");
        designerSubmitButton.innerHTML = isBusy ? DESIGNER_ICONS.stop : DESIGNER_ICONS.send;
      }

      function shouldAutoSubmitDesignerHandoff(prompt = "", intentEnvelope = null) {
        const normalized = normalizeDesignerString(prompt).toLowerCase();
        const kind = intentEnvelope?.intents?.[0]?.kind || inferDesignerIntentKindFromPrompt(prompt);
        if (kind === "prepare_implementation_handoff") {
          return true;
        }
        return /(로컬 구현|구현 요청|handoff|코드로 구현|개발 요청)/.test(normalized);
      }

      async function submitDesignerHandoffFromIntent(intentEnvelope, selectionSummary) {
        const payload = createUiPluginLocalHandoffPayload(intentEnvelope);
        latestDesignerHandoffPayload = payload;
        renderDesignerHandoffPreview(payload);
        try {
          const result = await submitDesignerHandoffPayload(payload);
          if (designerHandoffMetaEl) {
            designerHandoffMetaEl.textContent = result?.handoff?.status || "queued";
          }
          appendDesignerMessage(
            "system",
            `로컬 구현 요청을 전송했습니다: ${currentFileName} / ${currentPageLabel} / ${selectionSummary}. handoffId ${result?.handoff?.handoffId || payload.handoffId}`
          );
          refreshDesignerHandoffLog();
        } catch (error) {
          if (designerHandoffMetaEl) {
            designerHandoffMetaEl.textContent = "submit_failed";
          }
          appendDesignerMessage(
            "system",
            `로컬 구현 요청 전송에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
          );
        }
      }

      async function runDesignerPrompt(prompt) {
        if (designerSubmitInFlight) {
          return;
        }
        const normalizedPrompt = normalizeDesignerString(prompt);
        if (!normalizedPrompt) {
          appendDesignerMessage("system", "먼저 디자인 요청을 입력해 주세요.");
          return;
        }
        designerSubmitInFlight = true;
        designerStopRequested = false;
        designerRequestController = typeof AbortController !== "undefined" ? new AbortController() : null;
        setDesignerSubmitButtonBusy(true);
        latestDesignerIntentEnvelope = createUiDesignerIntentEnvelope(normalizedPrompt, "suggest_then_apply");
        renderDesignerIntentPreview(latestDesignerIntentEnvelope);
        appendDesignerMessage("user", normalizedPrompt);
        appendDesignerMessage(
          "system",
          "요청을 작업 계획으로 정리했어요. 필요한 화면 정보를 읽고 디자인 제안을 준비하겠습니다."
        );
        if (designerReadPlanMetaEl) {
          designerReadPlanMetaEl.textContent = "running";
        }
        try {
          const result = await executeDesignerReadContext(normalizedPrompt, latestDesignerIntentEnvelope, {
            signal: designerRequestController?.signal
          });
          if (designerStopRequested) {
            return;
          }
          latestDesignerIntentEnvelope = result.intentEnvelope || latestDesignerIntentEnvelope;
          latestDesignerReadExecution = result.execution || null;
          latestDesignerSuggestionBundle = result.designerSuggestionBundle || null;
          renderDesignerIntentPreview(latestDesignerIntentEnvelope);
          renderDesignerSuggestionPreview(latestDesignerSuggestionBundle);
          if (designerReadPlanMetaEl) {
            designerReadPlanMetaEl.textContent =
              latestDesignerReadExecution?.ok ? "executed" : "partial";
          }
          appendDesignerMessage(
            "system",
            formatDesignerReadExecutionSummary(latestDesignerReadExecution)
          );
          appendDesignerMessage(
            "system",
            formatDesignerSuggestionSummary(latestDesignerSuggestionBundle)
          );
          appendDesignerMessage("system", formatDesignerAiSummary(result.ai));

          if (shouldAutoSubmitDesignerHandoff(normalizedPrompt, latestDesignerIntentEnvelope)) {
            const selectionSummary =
              Array.isArray(pendingSelection) && pendingSelection.length > 0
                ? `${pendingSelection.length}개 노드 기준`
                : "현재 페이지 기준";
            await submitDesignerHandoffFromIntent(latestDesignerIntentEnvelope, selectionSummary);
          }
        } catch (error) {
          if (error?.name === "AbortError" || designerStopRequested) {
            appendDesignerMessage("system", "요청을 중지했어요.");
            return;
          }
          if (designerReadPlanMetaEl) {
            designerReadPlanMetaEl.textContent = "failed";
          }
          renderDesignerSuggestionPreview(null);
          appendDesignerMessage(
            "system",
            `읽기 실행 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
          );
        } finally {
          designerSubmitInFlight = false;
          designerRequestController = null;
          designerStopRequested = false;
          setDesignerSubmitButtonBusy(false);
          if (designerInputEl) {
            designerInputEl.value = "";
          }
        }
      }

      if (designerSendButton) {
        designerSendButton.addEventListener("click", async () => {
          await runDesignerPrompt(designerInputEl?.value?.trim() || "");
        });
      }

      if (designerHandoffButton) {
        designerHandoffButton.addEventListener("click", async () => {
          if (!latestDesignerIntentEnvelope) {
            appendDesignerMessage("system", "먼저 디자인 요청을 보내 주세요. 제안을 만든 뒤 로컬 구현 요청으로 넘길 수 있습니다.");
            return;
          }
          const selectionSummary =
            Array.isArray(pendingSelection) && pendingSelection.length > 0
              ? `${pendingSelection.length}개 노드 기준`
              : "현재 페이지 기준";
          await submitDesignerHandoffFromIntent(latestDesignerIntentEnvelope, selectionSummary);
        });
      }

      if (designerInputEl) {
        designerInputEl.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (designerSubmitInFlight) {
              designerStopRequested = true;
              if (designerRequestController) {
                designerRequestController.abort();
              }
              return;
            }
            runDesignerPrompt(designerInputEl.value.trim());
          }
        });
      }

      if (designerSubmitButton) {
        designerSubmitButton.addEventListener("click", () => {
          if (designerSubmitInFlight) {
            designerStopRequested = true;
            if (designerRequestController) {
              designerRequestController.abort();
            }
            return;
          }
          runDesignerPrompt(designerInputEl?.value?.trim() || "");
        });
      }

      if (designerAddContextButton) {
        designerAddContextButton.addEventListener("click", () => {
          if (!designerInputEl) {
            return;
          }
          const selectionSummary =
            Array.isArray(pendingSelection) && pendingSelection.length > 0
              ? `${pendingSelection.length}개 선택`
              : "선택 없음";
          const contextLine = `[컨텍스트] 파일:${currentFileName} | 페이지:${currentPageLabel} | ${selectionSummary}`;
          const currentValue = designerInputEl.value.trim();
          designerInputEl.value = currentValue ? `${currentValue}\n${contextLine}` : `${contextLine}\n`;
          designerInputEl.focus();
          renderDesignerIntentPreview(createUiDesignerIntentEnvelope(designerInputEl.value, "suggest_then_apply"));
        });
      }

      if (designerRefreshHandoffsButton) {
        designerRefreshHandoffsButton.addEventListener("click", () => {
          refreshDesignerHandoffLog();
        });
      }

      document.addEventListener("click", (event) => {
        const bridgeUtilityTrigger = event.target.closest?.("[data-bridge-modal]");
        if (bridgeUtilityTrigger) {
          openBridgeUtilityModal(bridgeUtilityTrigger.getAttribute("data-bridge-modal"));
          return;
        }
        const bridgeUtilityAction = event.target.closest?.("[data-bridge-action]");
        if (bridgeUtilityAction) {
          runBridgeUtilityAction(bridgeUtilityAction.getAttribute("data-bridge-action"));
          return;
        }
        const diagnosticTrigger = event.target.closest?.("[data-diagnostic-group]");
        if (diagnosticTrigger) {
          openDiagnosticModal(diagnosticTrigger.getAttribute("data-diagnostic-group"));
          return;
        }
        if (event.target.closest?.("[data-diagnostic-close]")) {
          closeDiagnosticModal();
        }
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && diagnosticModalEl && !diagnosticModalEl.hidden) {
          closeDiagnosticModal();
        }
      });

      setConnectionFlags({
        bridgeConnected: false,
        sessionRegistered: false,
        needsReconnect: false,
        needsReregister: false
      });

      bridgeVersionEl.textContent = `v${BRIDGE_VERSION}`;
      renderBridgeToggle();
      renderEventStreamBadge();
      setServerStatus("서버 확인 중...", "ok", "", "", "준비 중");
      setSessionStatus("세션 확인 대기", "warn", "서버 연결이 먼저 확인되면 세션 상태도 이어서 확인합니다.", "", "대기 중");
      updateRuntimeState("waiting_session", {
        clearErrorCode: true,
        guidance: "브리지 연결과 세션 등록이 완료되면 명령 실행을 시작합니다."
      });
      renderSessionsList();
      renderRuntimeOpsPanel();
      renderSelectedNodeDetailPanel();
      renderRealtimeDebugPanel();
      renderDesignerShell();
      renderDesignerIntentPreview();
      renderDesignerHandoffPreview();
      setDesignerSubmitButtonBusy(false);
      refreshDesignerHandoffLog();
      renderPrimaryAction();
      requestResizeWindow("l");

      if (!realtimeDebugTicker) {
        realtimeDebugTicker = setInterval(() => {
          renderRealtimeDebugPanel();
        }, 1000);
      }

      bootstrapBridge();
