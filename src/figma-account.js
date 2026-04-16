function normalizeTrimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function clampInteger(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, Math.trunc(value)));
}

async function readJson(response) {
  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload.err === "string"
        ? payload.err
        : payload && typeof payload.message === "string"
          ? payload.message
          : `Figma API request failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function figmaApiRequest(path, options = {}) {
  const accessToken = normalizeTrimmed(options.accessToken);
  if (!accessToken) {
    throw new Error("FIGMA_ACCESS_TOKEN is required");
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch implementation is required");
  }

  const apiBaseUrl = String(options.apiBaseUrl || "https://api.figma.com").replace(
    /\/$/,
    ""
  );

  const response = await fetchImpl(`${apiBaseUrl}${path}`, {
    headers: {
      "X-Figma-Token": accessToken
    }
  });

  return readJson(response);
}

export function buildTeamProjectsPlan(input = {}) {
  const teamId = normalizeTrimmed(input.teamId);
  if (!teamId) {
    throw new Error("teamId is required");
  }

  return {
    teamId,
    query: normalizeTrimmed(input.query).toLowerCase(),
    maxResults: clampInteger(input.maxResults, 50, 1, 200)
  };
}

export function buildProjectFilesPlan(input = {}) {
  const projectId = normalizeTrimmed(input.projectId);
  if (!projectId) {
    throw new Error("projectId is required");
  }

  return {
    projectId,
    query: normalizeTrimmed(input.query).toLowerCase(),
    maxResults: clampInteger(input.maxResults, 100, 1, 500),
    branchData: Boolean(input.branchData)
  };
}

export function buildFileSummaryPlan(input = {}) {
  const fileKey = normalizeTrimmed(input.fileKey);
  if (!fileKey) {
    throw new Error("fileKey is required");
  }

  return {
    fileKey
  };
}

export function buildFileCommentsPlan(input = {}) {
  const fileKey = normalizeTrimmed(input.fileKey);
  if (!fileKey) {
    throw new Error("fileKey is required");
  }
  const targetNodeId = normalizeTrimmed(input.targetNodeId);

  return {
    fileKey,
    maxResults: clampInteger(input.maxResults, 100, 1, 500),
    includeResolved: input.includeResolved !== false,
    targetNodeId: targetNodeId || null
  };
}

function normalizeProject(item = {}) {
  return {
    id: item.id != null ? String(item.id) : "",
    name: item.name || ""
  };
}

function normalizeProjectFile(item = {}) {
  return {
    key: item.key || "",
    name: item.name || "",
    thumbnailUrl: item.thumbnail_url || null,
    lastModified: item.last_modified || null,
    branchKey: item.branch_key || null,
    duplicateOf: item.duplicate_of || null
  };
}

function normalizeFileComment(item = {}) {
  const createdAt =
    typeof item.created_at === "string" && item.created_at.trim()
      ? item.created_at
      : null;
  const resolvedAt =
    typeof item.resolved_at === "string" && item.resolved_at.trim()
      ? item.resolved_at
      : null;
  const user = item.user && typeof item.user === "object" ? item.user : {};
  const clientMeta = item.client_meta && typeof item.client_meta === "object"
    ? item.client_meta
    : {};
  const targetNodeId =
    typeof clientMeta.node_id === "string" && clientMeta.node_id.trim()
      ? clientMeta.node_id
      : null;
  return {
    id: item.id != null ? String(item.id) : "",
    message:
      typeof item.message === "string" ? item.message : "",
    fileKey:
      typeof item.file_key === "string" && item.file_key.trim()
        ? item.file_key
        : null,
    orderId: item.order_id != null ? String(item.order_id) : null,
    parentId: item.parent_id != null ? String(item.parent_id) : null,
    createdAt,
    resolvedAt,
    resolved: Boolean(resolvedAt),
    target: {
      nodeId: targetNodeId,
      nodeOffset: Number.isFinite(clientMeta.node_offset) ? clientMeta.node_offset : null
    },
    user: {
      id: user.id != null ? String(user.id) : null,
      handle:
        typeof user.handle === "string" && user.handle.trim()
          ? user.handle
          : null
    }
  };
}

export async function getCurrentUser(options = {}) {
  const payload = await figmaApiRequest("/v1/me", options);
  return {
    id: payload.id || "",
    handle: payload.handle || "",
    imgUrl: payload.img_url || null,
    email: payload.email || null
  };
}

export async function listTeamProjects(input = {}, options = {}) {
  const plan = buildTeamProjectsPlan(input);
  const payload = await figmaApiRequest(
    `/v1/teams/${encodeURIComponent(plan.teamId)}/projects`,
    options
  );

  const items = Array.isArray(payload.projects) ? payload.projects : [];
  const matches = [];
  let truncated = false;

  for (const item of items) {
    const normalized = normalizeProject(item);
    const queryMatch =
      !plan.query || normalized.name.toLowerCase().includes(plan.query);
    if (!queryMatch) {
      continue;
    }

    matches.push(normalized);
    if (matches.length >= plan.maxResults) {
      truncated = items.length > matches.length;
      break;
    }
  }

  return {
    teamId: plan.teamId,
    projects: matches,
    truncated
  };
}

export async function listProjectFiles(input = {}, options = {}) {
  const plan = buildProjectFilesPlan(input);
  const params = new URLSearchParams();
  if (plan.branchData) {
    params.set("branch_data", "true");
  }

  const query = params.toString();
  const payload = await figmaApiRequest(
    `/v1/projects/${encodeURIComponent(plan.projectId)}/files${query ? `?${query}` : ""}`,
    options
  );

  const items = Array.isArray(payload.files) ? payload.files : [];
  const matches = [];
  let truncated = false;

  for (const item of items) {
    const normalized = normalizeProjectFile(item);
    const queryMatch =
      !plan.query || normalized.name.toLowerCase().includes(plan.query);
    if (!queryMatch) {
      continue;
    }

    matches.push(normalized);
    if (matches.length >= plan.maxResults) {
      truncated = items.length > matches.length;
      break;
    }
  }

  return {
    projectId: plan.projectId,
    files: matches,
    truncated
  };
}

export async function getFileSummary(input = {}, options = {}) {
  const plan = buildFileSummaryPlan(input);
  const payload = await figmaApiRequest(
    `/v1/files/${encodeURIComponent(plan.fileKey)}`,
    options
  );

  return {
    fileKey: plan.fileKey,
    name: payload.name || "",
    role: payload.role || null,
    editorType: payload.editorType || null,
    lastModified: payload.lastModified || null,
    thumbnailUrl: payload.thumbnailUrl || null,
    version: payload.version || null,
    linkAccess: payload.linkAccess || null
  };
}

export async function listFileComments(input = {}, options = {}) {
  const plan = buildFileCommentsPlan(input);
  const payload = await figmaApiRequest(
    `/v1/files/${encodeURIComponent(plan.fileKey)}/comments`,
    options
  );
  const items = Array.isArray(payload.comments) ? payload.comments : [];
  const comments = [];
  let truncated = false;

  for (const item of items) {
    const normalized = normalizeFileComment(item);
    if (!plan.includeResolved && normalized.resolved) {
      continue;
    }
    if (
      plan.targetNodeId &&
      normalized.target &&
      normalized.target.nodeId !== plan.targetNodeId
    ) {
      continue;
    }
    comments.push(normalized);
    if (comments.length >= plan.maxResults) {
      truncated = items.length > comments.length;
      break;
    }
  }

  return {
    fileKey: plan.fileKey,
    includeResolved: plan.includeResolved,
    targetNodeId: plan.targetNodeId,
    comments,
    truncated
  };
}
