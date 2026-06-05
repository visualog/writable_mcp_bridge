export const DESIGNER_ROUTE_PATHS = Object.freeze({
  models: "/api/designer/models",
  selectModel: "/api/designer/models/select",
  configureModel: "/api/designer/models/configure",
  discoverLocalProviders: "/api/designer/providers/discover-local",
  testModel: "/api/designer/models/test",
  readContext: "/api/designer/read-context",
  inspectSelection: "/api/designer/inspect-selection",
  chat: "/api/designer/chat",
  runActionCandidate: "/api/designer/action-candidates/run",
  previewActionCandidate: "/api/designer/action-candidates/preview",
  confirmActionCandidate: "/api/designer/action-candidates/confirm"
});

const DESIGNER_ROUTE_PATH_SET = new Set(Object.values(DESIGNER_ROUTE_PATHS));

export function listDesignerRoutePaths() {
  return [...DESIGNER_ROUTE_PATH_SET];
}

export function isDesignerRoutePath(pathname) {
  return DESIGNER_ROUTE_PATH_SET.has(pathname);
}

export function createDesignerRouteHandler(deps = {}) {
  const {
    DESIGNER_COMPARE_REQUEST_TIMEOUT_MS,
    DESIGNER_IMPROVE_REQUEST_TIMEOUT_MS,
    applyDesignerModelConfig,
    applyDesignerModelPreset,
    attachDesignerKnowledgeReferences,
    buildAiDesignerSnapshot,
    buildCodexAugmentedSuggestionBundle,
    buildDesignerActionPreviewBundle,
    buildDesignerCodexAiPayload,
    buildDesignerCodexFallbackMeta,
    buildDesignerPipelineSnapshot,
    buildDesignerSuggestionBundle,
    buildImageLayoutQualityFailureSummary,
    buildPostApplyComparisonQualityVerification,
    classifyDesignerChatError,
    confirmDesignerActionCandidateCommand,
    createDesignerIntentEnvelope,
    discoverLocalDesignerProviders,
    executeDesignerCompareReferenceAndGeneratedRequest,
    executeDesignerDebugBridgeFailureRequest,
    executeDesignerGeneratedScreenFollowUpRequest,
    executeDesignerImageAnalysisOnlyRequest,
    executeDesignerImageScreenRequest,
    executeDesignerImproveGeneratedScreenRequest,
    executeDesignerInspectSelectionRequest,
    executeDesignerReadPlan,
    getDesignerAiConfig,
    getSelectionIdsFromFigmaContext,
    isGeneratedScreenFollowUpRequest,
    isImageToScreenRequest,
    jsonResponse,
    normalizeCodexCliStatus,
    previewDesignerActionCandidateCommand,
    readJsonBody,
    resolveActivePluginId,
    runCodexDesignerSuggestion,
    runDesignerActionCandidateCommand,
    runDesignerModelConnectionProbe,
    runDesignerReadCommand,
    tryExecuteDesignerFastPath,
    validateConfiguredLocalDesignerModel,
    withDesignerWorkflowTimeout
  } = deps;

  return async function handleDesignerRoute(req, res, url) {
    if (req.method === "GET" && url.pathname === DESIGNER_ROUTE_PATHS.models) {
      const designerAiConfig = getDesignerAiConfig();
      const aiDesigner = buildAiDesignerSnapshot(designerAiConfig);
      jsonResponse(res, 200, {
        ok: true,
        current: {
          executionBackend: aiDesigner.executionBackend,
          provider: aiDesigner.provider,
          model: aiDesigner.model,
          baseUrl: aiDesigner.baseUrl,
          valid: aiDesigner.valid,
          configured: aiDesigner.configured,
          legacyConfig: aiDesigner.legacyConfig
        },
        presets: aiDesigner.modelPresets,
        providerOptions: aiDesigner.providerOptions
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.selectModel) {
      const body = await readJsonBody(req);
      const modelId = String(body.modelId || "").trim();
      try {
        const preset = applyDesignerModelPreset(modelId);
        const designerAiConfig = getDesignerAiConfig();
        jsonResponse(res, 200, {
          ok: true,
          selected: {
            id: preset.id,
            shortLabel: preset.shortLabel,
            displayLabel: preset.displayLabel,
            levelLabel: preset.levelLabel
          },
          aiDesigner: buildAiDesignerSnapshot(designerAiConfig)
        });
      } catch (error) {
        jsonResponse(res, 400, {
          ok: false,
          error: error?.message || "모델 변경에 실패했습니다.",
          code: error?.code || "model_select_failed"
        });
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.configureModel) {
      const body = await readJsonBody(req);
      try {
        await validateConfiguredLocalDesignerModel(body.provider, body.model);
        const configured = applyDesignerModelConfig({
          provider: body.provider,
          model: body.model,
          baseUrl: body.baseUrl,
          apiKey: body.apiKey
        });
        const designerAiConfig = getDesignerAiConfig();
        jsonResponse(res, 200, {
          ok: true,
          configured,
          aiDesigner: buildAiDesignerSnapshot(designerAiConfig)
        });
      } catch (error) {
        jsonResponse(res, 400, {
          ok: false,
          error: error?.message || "AI 설정 저장에 실패했습니다.",
          code: error?.code || "designer_model_configure_failed"
        });
      }
      return true;
    }

    if (req.method === "GET" && url.pathname === DESIGNER_ROUTE_PATHS.discoverLocalProviders) {
      try {
        const discovery = await discoverLocalDesignerProviders();
        jsonResponse(res, 200, {
          ok: true,
          ...discovery
        });
      } catch (error) {
        jsonResponse(res, 500, {
          ok: false,
          error: error?.message || "로컬 AI 검색에 실패했습니다.",
          code: "discover_local_ai_failed"
        });
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.testModel) {
      const body = await readJsonBody(req);
      try {
        await validateConfiguredLocalDesignerModel(body.provider, body.model);
        const ai = await runDesignerModelConnectionProbe({
          provider: body.provider,
          model: body.model,
          baseUrl: body.baseUrl,
          apiKey: body.apiKey
        });
        jsonResponse(res, 200, {
          ok: true,
          status: "completed",
          provider: ai.provider,
          model: ai.model,
          reply: ai.responseText || "연결 테스트 응답을 받았습니다.",
          usage: ai.usage || null
        });
      } catch (error) {
        jsonResponse(res, 400, {
          ok: false,
          error: error?.message || "연결 테스트에 실패했습니다.",
          code: error?.code || "designer_model_test_failed"
        });
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.readContext) {
      const body = await readJsonBody(req);
      const pluginId = resolveActivePluginId(body.pluginId || "default");
      const figmaContext =
        body.figmaContext && typeof body.figmaContext === "object" ? body.figmaContext : {};
      const intentEnvelope = createDesignerIntentEnvelope(body, figmaContext);
      const execution = await executeDesignerReadPlan(
        {
          intentEnvelope,
          runCommand: (command, args) => runDesignerReadCommand(pluginId, command, args)
        },
        {
          query: body.query || body.request || body.prompt || body.message || body.input,
          fileKey: body.fileKey || figmaContext.fileKey,
          fileKeys: body.fileKeys || figmaContext.fileKeys
        }
      );
      const designerSuggestionBundle = buildDesignerSuggestionBundle({
        intentEnvelope,
        execution
      });
      const designerActionPreviewBundle = buildDesignerActionPreviewBundle({
        intentEnvelope,
        execution,
        designerSuggestionBundle
      });

      jsonResponse(res, 200, {
        ok: true,
        intentEnvelope,
        execution,
        designerSuggestionBundle: {
          ...designerSuggestionBundle,
          actionPreviewBundle: designerActionPreviewBundle
        },
        designerActionPreviewBundle
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.inspectSelection) {
      try {
        const body = await readJsonBody(req);
        jsonResponse(res, 200, await executeDesignerInspectSelectionRequest(body));
      } catch (error) {
        const classified = classifyDesignerChatError(error);
        jsonResponse(res, classified.statusCode, {
          ok: false,
          code: classified.code === "model_timeout_or_abort" ? "inspect_read_failed" : classified.code,
          error:
            classified.code === "model_timeout_or_abort"
              ? "선택 구조 읽기 응답이 제한 시간을 넘었습니다."
              : classified.message,
          details: {
            originalMessage: error instanceof Error ? error.message : String(error)
          }
        });
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.chat) {
      const body = await readJsonBody(req);
      const pluginId = resolveActivePluginId(body.pluginId || "default");
      const message = body.message || body.request || body.prompt || body.input;
      const figmaContext =
        body.figmaContext && typeof body.figmaContext === "object" ? body.figmaContext : {};
      try {
        let intentEnvelope = createDesignerIntentEnvelope(
          {
            ...body,
            request: message
          },
          figmaContext
        );
        const userIntentKind = String(intentEnvelope?.intentClassification?.userIntentKind || "").trim();
        if (userIntentKind === "debug_bridge_failure") {
          jsonResponse(
            res,
            200,
            await executeDesignerDebugBridgeFailureRequest({
              pluginId,
              message,
              figmaContext,
              intentEnvelope
            })
          );
          return true;
        }
        if (userIntentKind === "compare_reference_and_generated") {
          jsonResponse(
            res,
            200,
            await withDesignerWorkflowTimeout(
              () => executeDesignerCompareReferenceAndGeneratedRequest({
                pluginId,
                body,
                message,
                figmaContext,
                intentEnvelope
              }),
              {
                userIntentKind,
                stage: "reference_generated_comparison",
                timeoutMs: DESIGNER_COMPARE_REQUEST_TIMEOUT_MS,
                message,
                figmaContext
              }
            )
          );
          return true;
        }
        if (userIntentKind === "improve_generated_screen" && getSelectionIdsFromFigmaContext(figmaContext).length >= 2) {
          jsonResponse(
            res,
            200,
            await withDesignerWorkflowTimeout(
              () => executeDesignerImproveGeneratedScreenRequest({
                pluginId,
                body,
                message,
                figmaContext,
                intentEnvelope
              }),
              {
                userIntentKind,
                stage: "generated_screen_improvement",
                timeoutMs: DESIGNER_IMPROVE_REQUEST_TIMEOUT_MS,
                message,
                figmaContext
              }
            )
          );
          return true;
        }
        if (userIntentKind === "image_analysis_only") {
          jsonResponse(
            res,
            200,
            await executeDesignerImageAnalysisOnlyRequest({
              pluginId,
              message,
              figmaContext,
              attachments: body.attachments,
              selectionIds:
                Array.isArray(body.selectionIds) && body.selectionIds.length > 0
                  ? body.selectionIds
                  : getSelectionIdsFromFigmaContext(figmaContext),
              intentEnvelope
            })
          );
          return true;
        }
        if (isImageToScreenRequest(message, body.attachments, figmaContext)) {
          jsonResponse(
            res,
            200,
            await executeDesignerImageScreenRequest({
              pluginId,
              message,
              figmaContext,
              attachments: body.attachments,
              selectionIds:
                Array.isArray(body.selectionIds) && body.selectionIds.length > 0
                  ? body.selectionIds
                  : getSelectionIdsFromFigmaContext(figmaContext)
            })
          );
          return true;
        }
        if (isGeneratedScreenFollowUpRequest(message, figmaContext)) {
          jsonResponse(
            res,
            200,
            await executeDesignerGeneratedScreenFollowUpRequest({
              pluginId,
              body,
              message,
              figmaContext
            })
          );
          return true;
        }
        const initialIntentKind = String(intentEnvelope?.intents?.[0]?.kind || "").trim();
        if (initialIntentKind === "inspect_selection") {
          jsonResponse(res, 200, await executeDesignerInspectSelectionRequest(body));
          return true;
        }
        const fastPathResult = await tryExecuteDesignerFastPath({
          pluginId,
          message,
          figmaContext,
          intentEnvelope
        });
        if (fastPathResult) {
          jsonResponse(res, 200, fastPathResult);
          return true;
        }
        const execution = await executeDesignerReadPlan(
          {
            intentEnvelope,
            runCommand: (command, args) => runDesignerReadCommand(pluginId, command, args)
          },
          {
            query: body.query || message,
            fileKey: body.fileKey || figmaContext.fileKey,
            fileKeys: body.fileKeys || figmaContext.fileKeys
          }
        );
        const designerSuggestionBundle = buildDesignerSuggestionBundle({
          intentEnvelope,
          execution
        });
        const designerActionPreviewBundle = buildDesignerActionPreviewBundle({
          intentEnvelope,
          execution,
          designerSuggestionBundle
        });
        const resolvedIntentKind = String(intentEnvelope?.intents?.[0]?.kind || "").trim();
        if (resolvedIntentKind === "inspect_selection") {
          jsonResponse(res, 200, await executeDesignerInspectSelectionRequest(body));
          return true;
        }
        const baseSuggestionBundle = {
          ...designerSuggestionBundle,
          actionPreviewBundle: designerActionPreviewBundle
        };
        if (resolvedIntentKind === "export_design_tokens") {
          const exportResult = execution?.phases
            ?.flatMap((phase) => phase.commandResults || [])
            ?.find((entry) => entry.command === "export_design_tokens" && entry.status === "ok")
            ?.result;
          const summaryText = exportResult?.filePath
            ? `변수 JSON 내보내기를 완료했습니다. ${exportResult.collectionCount || 0}개 컬렉션, ${exportResult.variableCount || 0}개 변수를 ${exportResult.filePath}에 저장했습니다.`
            : baseSuggestionBundle.summaryText || "변수 JSON 내보내기를 완료했습니다.";
          const ai = buildDesignerCodexAiPayload({
            status: "completed",
            reply: summaryText
          });
          jsonResponse(res, 200, {
            ok: true,
            intentKind: resolvedIntentKind,
            aiBackend: "deterministic",
            codexStatus: "skipped",
            fallbackUsed: false,
            fallbackReason: null,
            intentEnvelope,
            execution,
            designerSuggestionBundle: {
              ...baseSuggestionBundle,
              summaryText,
              actionPreviewBundle: designerActionPreviewBundle
            },
            designerActionPreviewBundle,
            ai
          });
          return true;
        }
        let ai = buildDesignerCodexAiPayload({
          status: "completed",
          reply: baseSuggestionBundle.summaryText || "Codex 응답 완료"
        });
        let codexMeta = {
          aiBackend: "codex_cli",
          codexStatus: "completed",
          fallbackUsed: false,
          fallbackReason: null
        };
        let augmentedDesignerSuggestionBundle = baseSuggestionBundle;
        const pipelineSnapshot = buildDesignerPipelineSnapshot({
          request: message,
          intentEnvelope,
          execution,
          suggestionBundle: baseSuggestionBundle,
          actionMode: "answer_or_plan"
        });
        const baseSuggestionBundleWithKnowledge = attachDesignerKnowledgeReferences(
          baseSuggestionBundle,
          pipelineSnapshot
        );
        augmentedDesignerSuggestionBundle = baseSuggestionBundleWithKnowledge;
        try {
          const codexSuggestion = await runCodexDesignerSuggestion(
            {
              request: message,
              intentKind: resolvedIntentKind,
              contextModel: execution?.contextModel || intentEnvelope?.contextModel || {},
              suggestionBundle: baseSuggestionBundleWithKnowledge,
              pipeline: pipelineSnapshot
            },
            {
              env: process.env,
              cwd: process.cwd()
            }
          );
          augmentedDesignerSuggestionBundle = buildCodexAugmentedSuggestionBundle(
            baseSuggestionBundleWithKnowledge,
            codexSuggestion
          );
          ai = buildDesignerCodexAiPayload({
            status: "completed",
            model: codexSuggestion.model,
            reply: codexSuggestion.reply
          });
        } catch (error) {
          codexMeta = buildDesignerCodexFallbackMeta(error);
          augmentedDesignerSuggestionBundle = {
            ...baseSuggestionBundleWithKnowledge,
            codex: {
              source: "codex_cli",
              status: "fallback",
              errorCode: error?.code || null,
              message: error instanceof Error ? error.message : String(error || "")
            }
          };
          ai = buildDesignerCodexAiPayload({
            status: "fallback",
            reply: "Codex 응답을 완성하지 못해 읽기 결과를 기준으로 요약했습니다.",
            failureCode: codexMeta.fallbackReason
          });
        }
        const augmentedDesignerActionPreviewBundle = buildDesignerActionPreviewBundle({
          intentEnvelope,
          execution,
          designerSuggestionBundle: augmentedDesignerSuggestionBundle
        });

        jsonResponse(res, 200, {
          ok: true,
          intentKind: resolvedIntentKind,
          ...codexMeta,
          intentEnvelope,
          execution,
          designerSuggestionBundle: {
            ...augmentedDesignerSuggestionBundle,
            actionPreviewBundle: augmentedDesignerActionPreviewBundle
          },
          designerActionPreviewBundle: augmentedDesignerActionPreviewBundle,
          ai
        });
        return true;
      } catch (error) {
        const classified = classifyDesignerChatError(error);
        jsonResponse(res, classified.statusCode, {
          ok: false,
          code: classified.code,
          error: classified.message,
          aiBackend: "codex_cli",
          codexStatus: normalizeCodexCliStatus(error?.designerMeta?.originalCode || error?.code),
          fallbackUsed: false,
          fallbackReason: error?.designerMeta?.fallbackMode || null,
          details: {
            originalMessage: error instanceof Error ? error.message : String(error),
            imageLayoutQuality: error?.details || null,
            imageLayoutQualitySummary: buildImageLayoutQualityFailureSummary(error?.details || null),
            selectedModel: {
              provider: "codex_cli",
              model: null
            },
            outputValidation: error?.designerMeta?.outputValidation || null,
            fallbackMode: error?.designerMeta?.fallbackMode || null,
            taskKind: error?.designerMeta?.taskKind || null
          }
        });
        return true;
      }
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.runActionCandidate) {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      try {
        const result = await runDesignerActionCandidateCommand(pluginId, body.candidate, {
          query: body.query,
          fileKey: body.fileKey,
          fileKeys: body.fileKeys
        });
        jsonResponse(res, 200, {
          ok: true,
          command: body?.candidate?.command || null,
          result
        });
      } catch (error) {
        jsonResponse(res, 400, {
          ok: false,
          error: error?.message || "액션 후보 실행에 실패했습니다.",
          code: error?.code || "designer_action_candidate_failed"
        });
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.previewActionCandidate) {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      try {
        const result = await previewDesignerActionCandidateCommand(pluginId, body.candidate, {
          message: body.message,
          actionLabel: body.actionLabel,
          figmaContext:
            body.figmaContext && typeof body.figmaContext === "object" ? body.figmaContext : {},
          aiConfig: getDesignerAiConfig()
        });
        jsonResponse(res, 200, {
          ok: true,
          command: body?.candidate?.command || null,
          provider: result.provider,
          model: result.model,
          preview: result.preview
        });
      } catch (error) {
        jsonResponse(res, 400, {
          ok: false,
          error: error?.message || "쓰기 미리보기를 생성하지 못했습니다.",
          code: error?.code || "designer_action_candidate_preview_failed"
        });
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === DESIGNER_ROUTE_PATHS.confirmActionCandidate) {
      const body = await readJsonBody(req);
      const pluginId = body.pluginId || "default";
      try {
        const result = await confirmDesignerActionCandidateCommand(pluginId, body.candidate, {
          preview: body.preview
        });
        const responsePayload = {
          ok: true,
          command: body?.candidate?.command || null,
          appliedUpdateCount: result.appliedUpdateCount,
          result: result.result
        };
        const verifyAfterApply =
          body.verifyAfterApply && typeof body.verifyAfterApply === "object" && !Array.isArray(body.verifyAfterApply)
            ? body.verifyAfterApply
            : null;
        const referenceNodeId = String(verifyAfterApply?.referenceNodeId || "").trim();
        const generatedNodeId = String(verifyAfterApply?.generatedNodeId || "").trim();
        if (referenceNodeId && generatedNodeId) {
          const postApplyComparisonResponse = await executeDesignerCompareReferenceAndGeneratedRequest({
            pluginId,
            body: {
              selectionIds: [referenceNodeId, generatedNodeId]
            },
            message: "confirmed generated screen repair verification",
            figmaContext: {},
            intentEnvelope: null
          });
          responsePayload.postApplyComparison = postApplyComparisonResponse.comparison;
          responsePayload.qualityVerification = buildPostApplyComparisonQualityVerification(
            body.previousComparison && typeof body.previousComparison === "object" ? body.previousComparison : {},
            postApplyComparisonResponse.comparison
          );
        }
        jsonResponse(res, 200, responsePayload);
      } catch (error) {
        jsonResponse(res, 400, {
          ok: false,
          error: error?.message || "쓰기 후보 적용에 실패했습니다.",
          code: error?.code || "designer_action_candidate_confirm_failed"
        });
      }
      return true;
    }

    return false;
  };
}
