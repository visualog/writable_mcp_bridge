export function createTokenExportArtifactName({ pluginId, startedAt }) {
  const safePluginId =
    String(pluginId || "unknown")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown";
  const stamp = new Date(startedAt).toISOString().replace(/[:.]/g, "-");
  return `xbridge-design-tokens-${safePluginId}-${stamp}.json`;
}

function sanitizeArtifactName(value, fallback = "figma-file") {
  const normalized = String(value || "")
    .trim()
    .replace(/[^a-z0-9._-]+/giu, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function buildTokenExportFilePath(fileName, deps) {
  const safeFileName = sanitizeArtifactName(fileName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return deps.joinPath(deps.exportDir, `${safeFileName}-${timestamp}.json`);
}

async function findLatestCompleteTokenArtifact(fileName, deps) {
  const safeFileName = sanitizeArtifactName(fileName);
  let entries = [];
  try {
    entries = await deps.readdir(deps.exportDir);
  } catch (error) {
    return null;
  }

  const candidates = entries
    .filter((entry) => entry.startsWith(`${safeFileName}-`) && entry.endsWith(".json"))
    .sort()
    .reverse();

  for (const entry of candidates) {
    const filePath = deps.joinPath(deps.exportDir, entry);
    try {
      const artifact = JSON.parse(await deps.readFile(filePath, "utf8"));
      const variableCount = Number(artifact?.meta?.variableCount || 0);
      const variables = Array.isArray(artifact?.variables) ? artifact.variables : [];
      if (artifact?.partial === true || variableCount <= 0 || variables.length <= 0) {
        continue;
      }
      return { filePath, artifact };
    } catch (error) {
      continue;
    }
  }

  return null;
}

function buildNormalizedTokensFromExportedVariables(variables = []) {
  const tokens = {
    colors: {},
    spacing: {},
    radius: {},
    typography: {},
    numbers: {},
    strings: {},
    booleans: {},
    other: {}
  };
  const addAlias = (bucket, key, name) => {
    if (!key || !name) {
      return;
    }
    if (!tokens[bucket][key]) {
      tokens[bucket][key] = [];
    }
    if (!tokens[bucket][key].includes(name)) {
      tokens[bucket][key].push(name);
    }
  };
  for (const variable of Array.isArray(variables) ? variables : []) {
    const values = variable?.resolvedValuesByMode || variable?.valuesByMode || {};
    const first = Object.values(values)[0];
    const type = String(variable?.resolvedType || "").toUpperCase();
    const name = String(variable?.name || "");
    let bucket = "other";
    if (type === "COLOR") {
      bucket = "colors";
    } else if (type === "STRING") {
      bucket = "strings";
    } else if (type === "BOOLEAN") {
      bucket = "booleans";
    } else if (type === "FLOAT" || type === "NUMBER") {
      bucket = /radius|radii|corner/iu.test(name)
        ? "radius"
        : /space|spacing|gap|padding|margin|inset|size|width|height/iu.test(name)
          ? "spacing"
          : "numbers";
    } else if (/font|typography|type|text|line-height|letter/iu.test(name)) {
      bucket = "typography";
    }
    const key =
      first && typeof first === "object" && typeof first.hex === "string"
        ? first.alpha === 1
          ? first.hex
          : `${first.hex}/${first.alpha}`
        : typeof first === "number" && bucket === "radius"
          ? `${first}px`
          : typeof first === "undefined"
            ? ""
            : String(typeof first === "object" ? JSON.stringify(first) : first);
    addAlias(bucket, key, name);
  }
  return tokens;
}

function summarizeTokenBuckets(tokens = {}) {
  if (!tokens || typeof tokens !== "object") {
    return {};
  }
  return Object.fromEntries(
    Object.entries(tokens).map(([key, value]) => [
      key,
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.keys(value).length
        : 0
    ])
  );
}

function summarizeTokenExportVariables(variables = [], limit = 16) {
  const colorVariables = (Array.isArray(variables) ? variables : []).filter(
    (variable) => String(variable?.resolvedType || "").toUpperCase() === "COLOR"
  );
  const priorityPatterns = [
    /dark\/black\s*alpha/iu,
    /light\/blue\/60$/iu,
    /light\/light\s*blue\/60$/iu,
    /light\/lightblue\/60$/iu
  ];
  const prioritized = [
    ...colorVariables.filter((variable) =>
      priorityPatterns.some((pattern) => pattern.test(String(variable?.name || "")))
    ),
    ...colorVariables
  ];
  const seenIds = new Set();
  return prioritized
    .filter((variable) => {
      const key = String(variable?.id || variable?.name || "");
      if (!key || seenIds.has(key)) {
        return false;
      }
      seenIds.add(key);
      return true;
    })
    .slice(0, limit)
    .map((variable) => ({
      name: variable?.name || "",
      resolvedType: variable?.resolvedType || "",
      modes: Object.fromEntries(
        Object.entries(variable?.resolvedValuesByMode || {}).map(([mode, value]) => [
          mode,
          value && typeof value === "object" && typeof value.hex === "string"
            ? value.hex
            : value
        ])
      )
    }));
}

function summarizeColorScaleGroups(variables = []) {
  const groups = new Map();
  for (const variable of Array.isArray(variables) ? variables : []) {
    if (String(variable?.resolvedType || "").toUpperCase() !== "COLOR") {
      continue;
    }
    const name = String(variable?.name || "").trim();
    const segments = name.split("/").map((segment) => segment.trim()).filter(Boolean);
    if (segments.length < 2) {
      continue;
    }
    const tail = segments[segments.length - 1];
    const groupName = segments.slice(0, -1).join("/");
    const step = Number(tail);
    const isAlpha = /alpha/iu.test(name);
    if (!groupName || (!Number.isFinite(step) && !isAlpha)) {
      continue;
    }
    if (!groups.has(groupName)) {
      groups.set(groupName, {
        group: groupName,
        steps: new Set(),
        alpha: false
      });
    }
    const group = groups.get(groupName);
    if (Number.isFinite(step)) {
      group.steps.add(step);
    }
    if (isAlpha) {
      group.alpha = true;
    }
  }

  return [...groups.values()]
    .map((group) => ({
      group: group.group,
      steps: [...group.steps].sort((a, b) => a - b),
      alpha: group.alpha
    }))
    .filter((group) => group.steps.length > 0)
    .sort((a, b) => a.group.localeCompare(b.group, "en"));
}

function summarizeTokenExportCollections(collections = []) {
  return (Array.isArray(collections) ? collections : []).slice(0, 12).map((collection) => ({
    id: collection?.id || null,
    name: collection?.name || "",
    variableCount: Number(collection?.variableCount || 0),
    modeCount: Array.isArray(collection?.modes) ? collection.modes.length : 0
  }));
}

function broadcastDesignerTaskProgress(pluginId, taskId, payload = {}, deps) {
  deps.broadcastRuntimeEvent(
    "designer.task.progress",
    {
      taskId,
      ...payload
    },
    { pluginId }
  );
}

export async function exportDesignTokensArtifact(pluginId, args = {}, deps) {
  const startedAt = deps.now();
  const taskId = deps.randomUUID();
  const warnings = [];
  const variables = [];
  const chunkLimit = Math.max(
    1,
    Math.min(
      deps.chunkMaxLimit,
      Number(args.limit || deps.chunkLimit) || 100
    )
  );
  const includeAliases = args.includeAliases === true;
  const includeResolvedValues = args.includeResolvedValues !== false;
  const includeStyles = args.includeStyles !== false;
  const includeUsages = args.includeUsages === true;

  deps.broadcastRuntimeEvent(
    "designer.task.started",
    {
      taskId,
      kind: "export_design_tokens",
      label: "변수 컬렉션 읽기"
    },
    { pluginId }
  );

  try {
    const summary = await deps.executePluginCommand(
      pluginId,
      "get_variable_collections_summary",
      {},
      { timeoutMs: deps.chunkTimeoutMs }
    );
    const collections = Array.isArray(summary?.collections) ? summary.collections : [];
    let partial = false;
    let chunkFailure = null;

    for (const collection of collections) {
      let cursor = 0;
      let done = false;
      const total = Number(collection?.variableCount || 0);
      while (!done) {
        if (deps.now() - startedAt >= deps.softBudgetMs) {
          partial = true;
          warnings.push("Export stopped at the soft time budget; artifact contains partial variables.");
          break;
        }
        let chunk = null;
        try {
          chunk = await deps.executePluginCommand(
            pluginId,
            "export_design_tokens_chunk",
            {
              collectionId: collection.id,
              cursor,
              limit: chunkLimit,
              includeAliases,
              includeResolvedValues,
              includeUsages
            },
            { timeoutMs: deps.chunkTimeoutMs }
          );
        } catch (error) {
          chunkFailure = error;
          partial = true;
          warnings.push(
            `Export stopped after a chunk read failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
          break;
        }
        variables.push.apply(variables, Array.isArray(chunk?.variables) ? chunk.variables : []);
        warnings.push.apply(warnings, Array.isArray(chunk?.warnings) ? chunk.warnings : []);
        cursor = Number(chunk?.nextCursor || cursor);
        done = chunk?.done === true || cursor >= total;
        broadcastDesignerTaskProgress(pluginId, taskId, {
          kind: "export_design_tokens",
          label: `${collection.name || collection.id} ${Math.min(cursor, total)}/${total} 처리`,
          collectionId: collection.id,
          collectionName: collection.name || null,
          processed: Math.min(cursor, total),
          total
        }, deps);
      }
      if (partial) {
        break;
      }
    }

    broadcastDesignerTaskProgress(pluginId, taskId, {
      kind: "export_design_tokens",
      label: "alias/resolved value 계산",
      processed: variables.length
    }, deps);

    const artifact = {
      pluginId,
      fileKey: summary?.fileKey || null,
      fileName: summary?.fileName || null,
      pageId: summary?.pageId || null,
      pageName: summary?.pageName || null,
      scope: args.scope || "file",
      exportedAt: new Date(startedAt).toISOString(),
      partial,
      chunkFailure: chunkFailure
        ? {
            code: chunkFailure?.code || null,
            message: chunkFailure instanceof Error ? chunkFailure.message : String(chunkFailure)
          }
        : null,
      collections,
      variables,
      styles: includeStyles ? (Array.isArray(summary?.styles) ? summary.styles : []) : undefined,
      tokens: buildNormalizedTokensFromExportedVariables(variables),
      colorScaleGroups: summarizeColorScaleGroups(variables),
      meta: {
        variableCount: variables.length,
        collectionCount: collections.length,
        styleCount: includeStyles && Array.isArray(summary?.styles) ? summary.styles.length : 0,
        includeAliases,
        includeResolvedValues,
        includeStyles,
        includeUsages,
        errorCode: chunkFailure?.code || null,
        errorMessage: chunkFailure
          ? chunkFailure instanceof Error
            ? chunkFailure.message
            : String(chunkFailure)
          : null,
        source: "local_file_variables_chunked"
      }
    };
    const filePath = buildTokenExportFilePath(summary?.fileName || summary?.fileKey || pluginId, deps);
    await deps.mkdir(deps.exportDir, { recursive: true });
    await deps.writeFile(filePath, JSON.stringify(artifact, null, 2), "utf8");
    let resultFilePath = filePath;
    let resultVariableCount = variables.length;
    let resultCollectionCount = collections.length;
    let resultMeta = artifact.meta;
    let resultCollections = summarizeTokenExportCollections(collections);
    let resultTokenBucketCounts = summarizeTokenBuckets(artifact.tokens);
    let resultSampleVariables = summarizeTokenExportVariables(variables);
    let resultColorScaleGroups = artifact.colorScaleGroups;
    if (partial && variables.length === 0) {
      const cached = await findLatestCompleteTokenArtifact(
        summary?.fileName || summary?.fileKey || pluginId,
        deps
      );
      if (cached) {
        const cachedMeta = cached.artifact?.meta || {};
        resultFilePath = cached.filePath;
        resultVariableCount = Number(cachedMeta.variableCount || cached.artifact.variables.length || 0);
        resultCollectionCount = Number(cachedMeta.collectionCount || cached.artifact.collections?.length || collections.length);
        resultMeta = {
          ...cachedMeta,
          source: "local_file_variables_chunked_cached_after_live_chunk_failure",
          liveErrorMessage: artifact.meta.errorMessage || null
        };
        resultCollections = summarizeTokenExportCollections(cached.artifact.collections);
        resultTokenBucketCounts = summarizeTokenBuckets(cached.artifact.tokens);
        resultSampleVariables = summarizeTokenExportVariables(cached.artifact.variables);
        resultColorScaleGroups =
          Array.isArray(cached.artifact.colorScaleGroups)
            ? cached.artifact.colorScaleGroups
            : summarizeColorScaleGroups(cached.artifact.variables);
        warnings.push(
          `Live token chunk read failed; reused latest complete token artifact: ${cached.filePath}`
        );
      }
    }
    const elapsedMs = deps.now() - startedAt;
    const result = {
      ok: true,
      taskId,
      filePath: resultFilePath,
      variableCount: resultVariableCount,
      collectionCount: resultCollectionCount,
      collections: resultCollections,
      tokenBucketCounts: resultTokenBucketCounts,
      sampleVariables: resultSampleVariables,
      colorScaleGroups: resultColorScaleGroups,
      elapsedMs,
      warnings,
      meta: resultMeta
    };
    broadcastDesignerTaskProgress(pluginId, taskId, {
      kind: "export_design_tokens",
      label: "JSON 파일 저장",
      filePath
    }, deps);
    deps.broadcastRuntimeEvent(
      "designer.task.completed",
      {
        taskId,
        kind: "export_design_tokens",
        label: "완료 요약 생성",
        ...result
      },
      { pluginId }
    );
    return result;
  } catch (error) {
    deps.broadcastRuntimeEvent(
      "designer.task.failed",
      {
        taskId,
        kind: "export_design_tokens",
        label: "완료 요약 생성",
        error: error instanceof Error ? error.message : String(error)
      },
      { pluginId }
    );
    throw error;
  }
}
