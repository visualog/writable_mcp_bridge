const LIBRARY_ASSET_TYPES = ["COMPONENT", "COMPONENT_SET", "STYLE"];

const LIBRARY_ENDPOINTS = {
  COMPONENT: {
    path: (fileKey) => `/v1/files/${fileKey}/components`,
    responseKey: "components"
  },
  COMPONENT_SET: {
    path: (fileKey) => `/v1/files/${fileKey}/component_sets`,
    responseKey: "component_sets"
  },
  STYLE: {
    path: (fileKey) => `/v1/files/${fileKey}/styles`,
    responseKey: "styles"
  }
};

function normalizeAssetType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return LIBRARY_ASSET_TYPES.includes(normalized) ? normalized : null;
}

export function buildLibraryAssetSearchPlan(input = {}) {
  const fileKey = String(input.fileKey || "").trim();
  if (!fileKey) {
    throw new Error("fileKey is required");
  }

  const query = String(input.query || "").trim().toLowerCase();
  const assetTypesInput = Array.isArray(input.assetTypes)
    ? input.assetTypes
    : LIBRARY_ASSET_TYPES;
  const assetTypes = [];

  for (const value of assetTypesInput) {
    const assetType = normalizeAssetType(value);
    if (assetType && !assetTypes.includes(assetType)) {
      assetTypes.push(assetType);
    }
  }

  const maxResults =
    typeof input.maxResults === "number" && Number.isFinite(input.maxResults)
      ? Math.max(1, Math.min(100, Math.trunc(input.maxResults)))
      : 30;

  return {
    fileKey,
    query,
    assetTypes: assetTypes.length > 0 ? assetTypes : [...LIBRARY_ASSET_TYPES],
    maxResults
  };
}

export function buildLibraryAssetRequests(input = {}) {
  const plan = buildLibraryAssetSearchPlan(input);

  return plan.assetTypes.map((assetType) => ({
    assetType,
    path: LIBRARY_ENDPOINTS[assetType].path(plan.fileKey),
    responseKey: LIBRARY_ENDPOINTS[assetType].responseKey
  }));
}

function normalizeLibraryAsset(assetType, item = {}) {
  return {
    assetType,
    key: item.key,
    fileKey: item.file_key,
    nodeId: item.node_id,
    styleType: item.style_type,
    name: item.name || "",
    description: item.description || "",
    containingFrame:
      item.containing_frame && typeof item.containing_frame.name === "string"
        ? { name: item.containing_frame.name }
        : null
  };
}

export function filterLibraryAssets(items = [], input = {}) {
  const assetTypesInput = Array.isArray(input.assetTypes)
    ? input.assetTypes
    : LIBRARY_ASSET_TYPES;
  const assetTypes = [];

  for (const value of assetTypesInput) {
    const assetType = normalizeAssetType(value);
    if (assetType && !assetTypes.includes(assetType)) {
      assetTypes.push(assetType);
    }
  }

  const plan = {
    fileKey: typeof input.fileKey === "string" ? input.fileKey.trim() : "",
    query: String(input.query || "").trim().toLowerCase(),
    assetTypes: assetTypes.length > 0 ? assetTypes : [...LIBRARY_ASSET_TYPES],
    maxResults:
      typeof input.maxResults === "number" && Number.isFinite(input.maxResults)
        ? Math.max(1, Math.min(100, Math.trunc(input.maxResults)))
        : 30
  };
  const matches = [];
  let truncated = false;

  for (const item of items) {
    if (!plan.assetTypes.includes(item.assetType)) {
      continue;
    }

    const haystacks = [item.name, item.description, item.containingFrame?.name];
    const queryMatch = !plan.query
      ? true
      : haystacks.some(
          (value) =>
            typeof value === "string" &&
            value.toLowerCase().includes(plan.query)
        );

    if (!queryMatch) {
      continue;
    }

    matches.push(item);
    if (matches.length >= plan.maxResults) {
      truncated = items.length > matches.length;
      break;
    }
  }

  return {
    fileKey: plan.fileKey,
    matches,
    truncated
  };
}

async function readJson(response) {
  const payload = await response.json();
  if (!response.ok) {
    const message =
      payload && typeof payload.err === "string"
        ? payload.err
        : `Figma API request failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function searchLibraryAssets(input = {}, options = {}) {
  const plan = buildLibraryAssetSearchPlan(input);
  const accessToken = String(options.accessToken || "").trim();
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

  const requests = buildLibraryAssetRequests(plan);
  const assets = [];

  for (const request of requests) {
    const response = await fetchImpl(`${apiBaseUrl}${request.path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const payload = await readJson(response);
    const items = payload?.meta?.[request.responseKey] || [];
    for (const item of items) {
      assets.push(normalizeLibraryAsset(request.assetType, item));
    }
  }

  return filterLibraryAssets(assets, plan);
}
