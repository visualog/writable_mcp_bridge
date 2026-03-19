function normalizeQuery(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeContainingFrame(containingFrame) {
  if (!containingFrame || typeof containingFrame.name !== "string") {
    return null;
  }

  return {
    name: containingFrame.name
  };
}

function normalizeFileComponent(item = {}) {
  return {
    key: item.key,
    nodeId: item.node_id,
    name: item.name || "",
    description: item.description || "",
    containingFrame: normalizeContainingFrame(item.containing_frame)
  };
}

export function buildFileComponentSearchPlan(input = {}) {
  const fileKey = String(input.fileKey || "").trim();
  if (!fileKey) {
    throw new Error("fileKey is required");
  }

  const maxResults =
    typeof input.maxResults === "number" && Number.isFinite(input.maxResults)
      ? Math.max(1, Math.min(100, Math.trunc(input.maxResults)))
      : 30;

  return {
    fileKey,
    query: normalizeQuery(input.query),
    maxResults
  };
}

export function filterFileComponents(items = [], input = {}) {
  const plan = buildFileComponentSearchPlan(input);
  const matches = [];
  let truncated = false;

  for (const item of items) {
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

export async function searchFileComponents(input = {}, options = {}) {
  const plan = buildFileComponentSearchPlan(input);
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

  const response = await fetchImpl(
    `${apiBaseUrl}/v1/files/${plan.fileKey}?depth=2`,
    {
      headers: {
        "X-Figma-Token": accessToken
      }
    }
  );
  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload && typeof payload.err === "string"
        ? payload.err
        : `Figma API request failed: HTTP ${response.status}`;
    throw new Error(message);
  }

  const components = Object.values(payload.components || {}).map(
    normalizeFileComponent
  );

  return filterFileComponents(components, plan);
}
