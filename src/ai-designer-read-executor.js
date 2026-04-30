function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickPrimaryTargetId(intentEnvelope = {}) {
  const contextTargetIds = normalizeArray(intentEnvelope?.contextScope?.targetIds);
  if (contextTargetIds.length > 0) {
    return normalizeString(contextTargetIds[0]);
  }

  const designerTargetIds = normalizeArray(intentEnvelope?.designerContext?.target?.ids);
  if (designerTargetIds.length > 0) {
    return normalizeString(designerTargetIds[0]);
  }

  return "";
}

function pickSearchQuery(intentEnvelope = {}, options = {}) {
  const explicit = normalizeString(options.query);
  if (explicit) {
    return explicit;
  }

  const fromGoal = normalizeString(intentEnvelope?.userGoal || intentEnvelope?.summary);
  if (fromGoal) {
    return fromGoal;
  }

  const fromTarget = normalizeString(intentEnvelope?.designerContext?.target?.label);
  return fromTarget;
}

function buildCommandArgs(command, intentEnvelope = {}, options = {}) {
  const targetNodeId = pickPrimaryTargetId(intentEnvelope);
  const query = pickSearchQuery(intentEnvelope, options);
  const fileKey = normalizeString(options.fileKey);
  const fileKeys = normalizeArray(options.fileKeys).map((value) => normalizeString(value)).filter(Boolean);

  if (command === "get_selection") {
    return { args: {} };
  }

  if (command === "get_metadata") {
    return {
      args: {
        targetNodeId: targetNodeId || undefined,
        maxDepth: 1,
        maxNodes: targetNodeId ? 36 : 48,
        includeJson: true
      }
    };
  }

  if (command === "get_node_details") {
    if (!targetNodeId) {
      return { skip: "No concrete target node is available for node detail reads." };
    }
    return {
      args: {
        targetNodeId,
        detailLevel: "layout",
        maxDepth: 2,
        maxNodes: 48
      }
    };
  }

  if (command === "get_instance_details") {
    if (!targetNodeId) {
      return { skip: "No concrete target node is available for instance detail reads." };
    }
    return {
      args: {
        targetNodeId,
        includeResolvedChildren: false,
        maxDepth: 2,
        maxNodes: 56
      }
    };
  }

  if (command === "get_component_variant_details") {
    if (!targetNodeId) {
      return { skip: "No concrete target node is available for component variant reads." };
    }
    return {
      args: {
        targetNodeId,
        maxDepth: 2,
        maxNodes: 56
      }
    };
  }

  if (command === "list_text_nodes") {
    return {
      args: {
        targetNodeId: targetNodeId || undefined,
        scope: targetNodeId ? "target" : "selection"
      }
    };
  }

  if (command === "get_annotations") {
    return {
      args: {
        targetNodeId: targetNodeId || undefined,
        includeInferredComments: true
      }
    };
  }

  if (command === "get_variable_defs") {
    return {
      args: {
        targetNodeId: targetNodeId || undefined,
        maxDepth: 2,
        maxNodes: 72
      }
    };
  }

  if (command === "search_nodes") {
    return {
      args: {
        targetNodeId: targetNodeId || undefined,
        scope: targetNodeId ? "target" : "current-page",
        query: query || undefined,
        maxResults: 12,
        detailLevel: "light"
      }
    };
  }

  if (command === "search_design_system") {
    return {
      args: {
        query,
        maxResults: 12,
        fileKeys
      }
    };
  }

  if (command === "search_instances") {
    return {
      args: {
        targetNodeId: targetNodeId || undefined,
        query: query || undefined,
        maxResults: 20,
        includeProperties: true
      }
    };
  }

  if (command === "search_file_components") {
    if (!fileKey) {
      return { skip: "No file key is available for file component search." };
    }
    return {
      args: {
        fileKey,
        query,
        maxResults: 12
      }
    };
  }

  if (command === "search_library_assets") {
    if (!fileKey) {
      return { skip: "No file key is available for library asset search." };
    }
    return {
      args: {
        fileKey,
        query,
        maxResults: 12
      }
    };
  }

  if (command === "snapshot_selection") {
    if (!targetNodeId) {
      return { skip: "No concrete target node is available for snapshots." };
    }
    return {
      args: {
        targetNodeId,
        maxDepth: 2,
        maxNodes: 48
      }
    };
  }

  return { args: {} };
}

function buildSummary(phaseResults = []) {
  const commandResults = phaseResults.flatMap((phase) => normalizeArray(phase.commandResults));
  const okCount = commandResults.filter((item) => item.status === "ok").length;
  const skippedCount = commandResults.filter((item) => item.status === "skipped").length;
  const errorCount = commandResults.filter((item) => item.status === "error").length;

  return {
    phaseCount: phaseResults.length,
    commandCount: commandResults.length,
    okCount,
    skippedCount,
    errorCount
  };
}

export async function executeDesignerReadPlan({
  intentEnvelope = {},
  runCommand
} = {}, options = {}) {
  if (typeof runCommand !== "function") {
    throw new Error("runCommand is required");
  }

  const readPlan = intentEnvelope?.readPlan;
  if (!readPlan || typeof readPlan !== "object") {
    throw new Error("intentEnvelope.readPlan is required");
  }

  const phaseResults = [];
  for (const phase of normalizeArray(readPlan.phases)) {
    const commandResults = [];

    for (const command of normalizeArray(phase.commands)) {
      const resolution = buildCommandArgs(command, intentEnvelope, options);
      if (resolution.skip) {
        commandResults.push({
          command,
          status: "skipped",
          reason: resolution.skip
        });
        continue;
      }

      try {
        const result = await runCommand(command, resolution.args || {});
        commandResults.push({
          command,
          status: "ok",
          args: resolution.args || {},
          result
        });
      } catch (error) {
        commandResults.push({
          command,
          status: "error",
          args: resolution.args || {},
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    phaseResults.push({
      phase: phase.phase,
      summary: phase.summary,
      commandResults,
      ok: commandResults.every((entry) => entry.status !== "error")
    });
  }

  return {
    executedAt: new Date().toISOString(),
    readPlan,
    phases: phaseResults,
    summary: buildSummary(phaseResults),
    ok: phaseResults.every((phase) => phase.ok)
  };
}
