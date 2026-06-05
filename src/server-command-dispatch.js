import {
  isInteractiveCommandType,
  isReadHeavyCommandType,
  isSimpleWriteCommandType,
  isWriteHeavyCommandType
} from "./command-queue-policy.js";

function finiteNumber(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

export function resolveCommandTimeoutMs(type, options = {}) {
  const config =
    typeof options === "number" ? { overrideTimeoutMs: options } : { ...options };
  const overrideTimeoutMs = config.overrideTimeoutMs;
  const defaultTimeoutMs = finiteNumber(config.defaultTimeoutMs, 30000);

  if (typeof overrideTimeoutMs === "number" && Number.isFinite(overrideTimeoutMs)) {
    return Math.max(1000, Math.floor(overrideTimeoutMs));
  }

  if (type === "export_design_tokens_chunk") {
    return Math.max(1000, Math.floor(finiteNumber(config.tokenExportChunkTimeoutMs, 120000)));
  }

  if (isInteractiveCommandType(type)) {
    const multiplier = Math.max(
      0.5,
      finiteNumber(config.interactiveCommandTimeoutMultiplier, 0.85)
    );
    const bufferMs = Math.max(0, finiteNumber(config.interactiveCommandTimeoutBufferMs, 150));
    const minTimeoutMs = Math.max(
      400,
      Math.floor(finiteNumber(config.interactiveCommandMinTimeoutMs, 700))
    );
    return Math.max(minTimeoutMs, Math.floor(defaultTimeoutMs * multiplier + bufferMs));
  }

  if (isReadHeavyCommandType(type)) {
    const multiplier = Math.max(1, finiteNumber(config.readHeavyCommandTimeoutMultiplier, 3));
    const bufferMs = Math.max(0, finiteNumber(config.readHeavyCommandTimeoutBufferMs, 400));
    return Math.max(1500, Math.floor(defaultTimeoutMs * multiplier + bufferMs));
  }

  if (isWriteHeavyCommandType(type)) {
    if (isSimpleWriteCommandType(type)) {
      const multiplier = Math.max(1, finiteNumber(config.simpleWriteCommandTimeoutMultiplier, 1.2));
      const bufferMs = Math.max(0, finiteNumber(config.simpleWriteCommandTimeoutBufferMs, 300));
      const minTimeoutMs = Math.max(
        600,
        Math.floor(finiteNumber(config.simpleWriteCommandMinTimeoutMs, 900))
      );
      return Math.max(minTimeoutMs, Math.floor(defaultTimeoutMs * multiplier + bufferMs));
    }

    const multiplier = Math.max(1, finiteNumber(config.writeHeavyCommandTimeoutMultiplier, 1.6));
    const bufferMs = Math.max(0, finiteNumber(config.writeHeavyCommandTimeoutBufferMs, 600));
    return Math.max(1500, Math.floor(defaultTimeoutMs * multiplier + bufferMs));
  }

  return defaultTimeoutMs;
}

export function resolveBulkBindVariablesTimeoutMs(entriesOrCount = [], options = {}) {
  const config =
    typeof options === "number" ? { defaultTimeoutMs: options } : { ...options };
  const defaultTimeoutMs = finiteNumber(config.defaultTimeoutMs, 30000);
  const maxTimeoutMs = Math.max(1000, finiteNumber(config.maxTimeoutMs, 120000));
  const perBindingMs = Math.max(0, finiteNumber(config.perBindingMs, 1200));
  const entries = Array.isArray(entriesOrCount) ? entriesOrCount : [];
  const bindingCount = Array.isArray(entriesOrCount)
    ? entries.length
    : Math.max(0, Math.floor(Number(entriesOrCount) || 0));

  const explicitTimeoutMs = entries.reduce((maxEntryTimeoutMs, entry) => {
    const timeoutMs = Number(entry?.options?.timeoutMs);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return maxEntryTimeoutMs;
    }
    return Math.max(maxEntryTimeoutMs, timeoutMs);
  }, 0);

  const scaledTimeoutMs = Math.max(
    defaultTimeoutMs,
    Math.min(maxTimeoutMs, defaultTimeoutMs + bindingCount * perBindingMs)
  );

  return Math.max(explicitTimeoutMs, scaledTimeoutMs);
}

export function createHandleToolCall(deps = {}) {
  const {
    FIGMA_ACCOUNT_API_OPTIONS,
    buildAddAnnotationPlan,
    buildAddComponentPropertyPlan,
    buildAnalyzeReferenceSelectionPlan,
    buildApplyStylePlan,
    buildBindVariablePlan,
    buildBulkAddAnnotationsPlan,
    buildBulkBindVariablesPlan,
    buildBulkCreateNodesPlan,
    buildComponentVariantDetailsPlan,
    buildCreateComponentPlan,
    buildCreateComponentSetPlan,
    buildCreateInstancePlan,
    buildCreateNodePlan,
    buildEditComponentPropertyPlan,
    buildExportNodePlan,
    buildFileComponentSearchPlan,
    buildFileSummaryPlan,
    buildGetAnnotationsPlan,
    buildImportLibraryComponentPlan,
    buildInstanceDetailsPlan,
    buildLibraryAssetSearchPlan,
    buildNodeDetailsPlan,
    buildProjectFilesPlan,
    buildReplayPlan,
    buildSearchInstancesPlan,
    buildSearchNodesPlan,
    buildSetComponentPropertiesPlan,
    buildSetVariantPropertiesPlan,
    buildSnapshotPlan,
    buildTeamProjectsPlan,
    deriveReferenceAnalysisDraft,
    executePluginCommand,
    executeSearchNodesWithRetry,
    exportDesignTokensArtifact,
    getCurrentUser,
    getFileSummary,
    listProjectFiles,
    listTeamProjects,
    normalizeAnnotationReadResult,
    parseSelectionMetadataTree,
    performAnalyzeSelectionToCompose,
    performBuildFinanceSummaryMock,
    performBuildLayout,
    performBuildScreenFromDesignSystem,
    performComposeScreenFromIntents,
    performDesignSystemSearch,
    performFindOrImportComponent,
    performGetComposeMetrics,
    performReuseOrCreateComponent,
    performValidateExternalComposeInput,
    pluginSessions,
    readMetadataFallbackForDetail,
    resolveBulkBindVariablesTimeoutMs,
    resolveTargetNodeId,
    searchFileComponents,
    searchLibraryAssets,
    serializePluginSession,
    withSessionDefaultParent
  } = deps;

  async function handleToolCall(name, args) {
  const pluginId = args.pluginId || "default";

  if (name === "get_active_plugins") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            Array.from(pluginSessions.values()).map(serializePluginSession),
            null,
            2
          )
        }
      ]
    };
  }

  if (name === "get_selection") {
    const result = await executePluginCommand(pluginId, "get_selection");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_pages") {
    const result = await executePluginCommand(pluginId, "list_pages");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_figma_account_profile") {
    const result = await getCurrentUser(FIGMA_ACCOUNT_API_OPTIONS);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_team_projects") {
    const plan = buildTeamProjectsPlan(args);
    const result = await listTeamProjects(plan, FIGMA_ACCOUNT_API_OPTIONS);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_project_files") {
    const plan = buildProjectFilesPlan(args);
    const result = await listProjectFiles(plan, FIGMA_ACCOUNT_API_OPTIONS);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_file_summary") {
    const plan = buildFileSummaryPlan(args);
    const result = await getFileSummary(plan, FIGMA_ACCOUNT_API_OPTIONS);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_metadata") {
    const result = await executePluginCommand(pluginId, "get_metadata", {
      pageId: args.pageId,
      targetNodeId: resolveTargetNodeId(args),
      maxDepth: args.maxDepth,
      maxNodes: args.maxNodes,
      includeJson: args.includeJson === true
    });
    const jsonTree =
      args.includeJson && result && typeof result.xml === "string"
        ? parseSelectionMetadataTree(result.xml)
        : null;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            args.includeJson ? { ...result, json: jsonTree } : result,
            null,
            2
          )
        }
      ]
    };
  }

  if (name === "get_annotations") {
    const plan = buildGetAnnotationsPlan(args);
    const rawResult = await executePluginCommand(
      pluginId,
      "get_annotations",
      plan
    );
    const result = normalizeAnnotationReadResult(rawResult, {
      includeInferredComments: plan.includeInferredComments
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_node_details") {
    const plan = buildNodeDetailsPlan(args);
    let result = null;
    try {
      result = await executePluginCommand(pluginId, "get_node_details", plan);
    } catch (error) {
      result = await readMetadataFallbackForDetail(pluginId, plan, error);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_component_variant_details") {
    const plan = buildComponentVariantDetailsPlan(args);
    let result = null;
    try {
      result = await executePluginCommand(
        pluginId,
        "get_component_variant_details",
        plan
      );
    } catch (error) {
      const fallback = await readMetadataFallbackForDetail(pluginId, plan, error);
      result = {
        ...fallback,
        targetNode: fallback.node,
        componentSet: null,
        variantCount: 0,
        variants: []
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_instance_details") {
    const plan = buildInstanceDetailsPlan(args);
    let result = null;
    try {
      result = await executePluginCommand(pluginId, "get_instance_details", plan);
    } catch (error) {
      const fallback = await readMetadataFallbackForDetail(pluginId, plan, error);
      result = {
        ...fallback,
        instance: fallback.node,
        sourceComponent: null,
        sourceComponentSet: null,
        componentPropertyDefinitions: [],
        variantProperties: null,
        componentProperties: null,
        resolvedChildCount: 0
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_variable_defs") {
    const result = await executePluginCommand(pluginId, "get_variable_defs", {
      pageId: args.pageId,
      targetNodeId: resolveTargetNodeId(args),
      maxDepth: args.maxDepth,
      maxNodes: args.maxNodes
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "export_design_tokens") {
    const result = await exportDesignTokensArtifact(pluginId, {
      scope: args.scope || "file",
      includeAliases: args.includeAliases !== false,
      includeResolvedValues: args.includeResolvedValues !== false,
      includeStyles: args.includeStyles !== false,
      includeUsages: args.includeUsages === true,
      limit: args.limit
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_text_nodes") {
    const result = await executePluginCommand(pluginId, "list_text_nodes", {
      pageId: args.pageId,
      targetNodeId: args.targetNodeId,
      scope: args.scope
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_nodes") {
    const plan = buildSearchNodesPlan(args);
    const result = await executeSearchNodesWithRetry(pluginId, plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "snapshot_selection") {
    const plan = buildSnapshotPlan(args);
    const result = await executePluginCommand(pluginId, "snapshot_selection", {
      pageId: plan.pageId,
      targetNodeId: plan.targetNodeId || args.targetNodeId,
      maxDepth: plan.maxDepth,
      maxNodes: plan.maxNodes,
      placeholderInstances: plan.placeholderInstances
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "export_node") {
    const plan = buildExportNodePlan(args);
    const result = await executePluginCommand(pluginId, "export_node", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "add_annotation") {
    const plan = buildAddAnnotationPlan(args);
    const result = await executePluginCommand(pluginId, "add_annotation", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_add_annotations") {
    const plan = buildBulkAddAnnotationsPlan(args);
    const result = await executePluginCommand(pluginId, "bulk_add_annotations", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "analyze_reference_selection") {
    const plan = buildAnalyzeReferenceSelectionPlan(args);
    const metadataResult = await executePluginCommand(pluginId, "get_metadata", {
      targetNodeId: plan.targetNodeId
    });
    const result = deriveReferenceAnalysisDraft(metadataResult, plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_library_assets") {
    const plan = buildLibraryAssetSearchPlan(args);
    const result = await searchLibraryAssets(plan, {
      accessToken: process.env.FIGMA_ACCESS_TOKEN
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_design_system") {
    const result = await performDesignSystemSearch(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_instances") {
    const plan = buildSearchInstancesPlan(args);
    const result = await executePluginCommand(pluginId, "search_instances", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "recreate_snapshot") {
    const plan = buildReplayPlan(args.snapshot, {
      targetParentId: args.targetParentId
    });
    const result = await executePluginCommand(
      pluginId,
      "recreate_snapshot",
      plan
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "search_file_components") {
    const plan = buildFileComponentSearchPlan(args);
    const result = await searchFileComponents(plan, {
      accessToken: process.env.FIGMA_ACCESS_TOKEN
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "list_component_properties") {
    const result = await executePluginCommand(pluginId, "list_component_properties", {
      targetNodeId: args.targetNodeId
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "update_text") {
    const result = await executePluginCommand(pluginId, "update_text", {
      nodeId: args.nodeId,
      text: args.text
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "set_component_property") {
    const result = await executePluginCommand(pluginId, "set_component_property", {
      nodeId: args.nodeId,
      propertyName: args.propertyName,
      value: args.value
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "set_component_properties") {
    const plan = buildSetComponentPropertiesPlan(args);
    const result = await executePluginCommand(pluginId, "set_component_properties", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "add_component_property") {
    const plan = buildAddComponentPropertyPlan(args);
    const result = await executePluginCommand(pluginId, "add_component_property", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "edit_component_property") {
    const plan = buildEditComponentPropertyPlan(args);
    const result = await executePluginCommand(pluginId, "edit_component_property", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "set_variant_properties") {
    const plan = buildSetVariantPropertiesPlan(args);
    const result = await executePluginCommand(pluginId, "set_variant_properties", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bind_variable") {
    const plan = buildBindVariablePlan(args);
    const result = await executePluginCommand(pluginId, "bind_variable", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_bind_variables") {
    const plan = buildBulkBindVariablesPlan(args);
    const result = await executePluginCommand(pluginId, "bulk_bind_variables", plan, {
      timeoutMs: resolveBulkBindVariablesTimeoutMs(plan.bindings.length)
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "apply_style") {
    const plan = buildApplyStylePlan(args);
    const result = await executePluginCommand(pluginId, "apply_style", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_component") {
    const plan = buildCreateComponentPlan(args);
    const result = await executePluginCommand(pluginId, "create_component", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_component_set") {
    const plan = buildCreateComponentSetPlan(args);
    const result = await executePluginCommand(pluginId, "create_component_set", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_instance") {
    const plan = buildCreateInstancePlan(withSessionDefaultParent(pluginId, args));
    const result = await executePluginCommand(pluginId, "create_instance", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "preview_changes") {
    const result = await executePluginCommand(pluginId, "preview_changes", {
      nodeId: args.nodeId,
      target: args.target,
      visible: args.visible,
      allowHidden: args.allowHidden,
      locked: args.locked,
      allowLocked: args.allowLocked,
      isMask: args.isMask,
      allowMask: args.allowMask,
      fillColor: args.fillColor,
      strokeColor: args.strokeColor,
      strokeWeight: args.strokeWeight,
      dropShadow: args.dropShadow,
      cornerRadius: args.cornerRadius,
      opacity: args.opacity,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      layoutMode: args.layoutMode,
      itemSpacing: args.itemSpacing,
      paddingLeft: args.paddingLeft,
      paddingRight: args.paddingRight,
      paddingTop: args.paddingTop,
      paddingBottom: args.paddingBottom,
      primaryAxisAlignItems: args.primaryAxisAlignItems,
      counterAxisAlignItems: args.counterAxisAlignItems,
      primaryAxisSizingMode: args.primaryAxisSizingMode,
      counterAxisSizingMode: args.counterAxisSizingMode,
      layoutGrow: args.layoutGrow,
      layoutAlign: args.layoutAlign,
      characters: args.characters,
      fontFamily: args.fontFamily,
      fontStyle: args.fontStyle,
      fontSize: args.fontSize,
      lineHeight: args.lineHeight,
      textAutoResize: args.textAutoResize,
      textAlignHorizontal: args.textAlignHorizontal,
      textAlignVertical: args.textAlignVertical,
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "rename_node") {
    const result = await executePluginCommand(pluginId, "rename_node", {
      nodeId: args.nodeId,
      name: args.name
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_rename_nodes") {
    const result = await executePluginCommand(pluginId, "bulk_rename_nodes", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_update_texts") {
    const result = await executePluginCommand(pluginId, "bulk_update_texts", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "update_node") {
    const result = await executePluginCommand(pluginId, "update_node", {
      nodeId: args.nodeId,
      target: args.target,
      visible: args.visible,
      fillColor: args.fillColor,
      cornerRadius: args.cornerRadius,
      opacity: args.opacity,
      x: args.x,
      y: args.y,
      width: args.width,
      height: args.height,
      layoutMode: args.layoutMode,
      itemSpacing: args.itemSpacing,
      paddingLeft: args.paddingLeft,
      paddingRight: args.paddingRight,
      paddingTop: args.paddingTop,
      paddingBottom: args.paddingBottom,
      primaryAxisAlignItems: args.primaryAxisAlignItems,
      counterAxisAlignItems: args.counterAxisAlignItems,
      primaryAxisSizingMode: args.primaryAxisSizingMode,
      counterAxisSizingMode: args.counterAxisSizingMode,
      layoutGrow: args.layoutGrow,
      layoutAlign: args.layoutAlign,
      characters: args.characters,
      fontFamily: args.fontFamily,
      fontStyle: args.fontStyle,
      fontSize: args.fontSize,
      lineHeight: args.lineHeight,
      textAutoResize: args.textAutoResize,
      textAlignHorizontal: args.textAlignHorizontal,
      textAlignVertical: args.textAlignVertical
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_update_nodes") {
    const result = await executePluginCommand(pluginId, "bulk_update_nodes", {
      updates: args.updates
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "create_node") {
    const plan = buildCreateNodePlan(withSessionDefaultParent(pluginId, args));
    const result = await executePluginCommand(pluginId, "create_node", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "bulk_create_nodes") {
    const plan = buildBulkCreateNodesPlan(withSessionDefaultParent(pluginId, args));
    const result = await executePluginCommand(pluginId, "bulk_create_nodes", plan);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "import_library_component") {
    const plan = buildImportLibraryComponentPlan(args);
    const result = await executePluginCommand(
      pluginId,
      "import_library_component",
      plan
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "find_or_import_component") {
    const result = await performFindOrImportComponent(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "reuse_or_create_component") {
    const result = await performReuseOrCreateComponent(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "build_screen_from_design_system") {
    const result = await performBuildScreenFromDesignSystem(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "compose_screen_from_intents") {
    const result = await performComposeScreenFromIntents(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "get_compose_metrics") {
    const result = performGetComposeMetrics();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "validate_external_compose_input") {
    const result = performValidateExternalComposeInput(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "analyze_selection_to_compose") {
    const result = await performAnalyzeSelectionToCompose(pluginId, args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "build_finance_summary_mock") {
    const result = await performBuildFinanceSummaryMock(
      pluginId,
      withSessionDefaultParent(pluginId, args)
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "build_layout") {
    const result = await performBuildLayout(
      pluginId,
      withSessionDefaultParent(pluginId, args)
    );
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "duplicate_node") {
    const result = await executePluginCommand(pluginId, "duplicate_node", {
      nodeId: args.nodeId,
      count: args.count
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "move_node") {
    const result = await executePluginCommand(pluginId, "move_node", {
      nodeId: args.nodeId,
      parentId: args.parentId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "move_section") {
    const result = await executePluginCommand(pluginId, "move_section", {
      sectionId: args.sectionId,
      destinationParentId: args.destinationParentId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "normalize_spacing") {
    const result = await executePluginCommand(pluginId, "normalize_spacing", {
      containerId: args.containerId,
      spacing: args.spacing,
      mode: args.mode,
      recursive: args.recursive
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "apply_naming_rule") {
    const result = await executePluginCommand(pluginId, "apply_naming_rule", {
      rootNodeId: args.rootNodeId,
      ruleSet: args.ruleSet,
      recursive: args.recursive,
      previewOnly: args.previewOnly
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "promote_section") {
    const result = await executePluginCommand(pluginId, "promote_section", {
      sectionId: args.sectionId,
      destinationParentId: args.destinationParentId,
      index: args.index,
      normalizeSpacing: args.normalizeSpacing,
      previewOnly: args.previewOnly
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "delete_node") {
    const result = await executePluginCommand(pluginId, "delete_node", {
      nodeId: args.nodeId
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "reorder_child") {
    const result = await executePluginCommand(pluginId, "reorder_child", {
      nodeId: args.nodeId,
      index: args.index
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "boolean_subtract") {
    const result = await executePluginCommand(pluginId, "boolean_subtract", {
      baseNodeId: args.baseNodeId,
      subtractNodeIds: args.subtractNodeIds,
      parentId: args.parentId,
      index: args.index,
      name: args.name
    });
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  if (name === "undo_last_batch") {
    const result = await executePluginCommand(pluginId, "undo_last_batch");
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

  return handleToolCall;
}
