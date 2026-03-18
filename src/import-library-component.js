const SUPPORTED_IMPORT_LIBRARY_ASSET_TYPES = ["COMPONENT", "COMPONENT_SET"];

export function listSupportedImportLibraryAssetTypes() {
  return [...SUPPORTED_IMPORT_LIBRARY_ASSET_TYPES];
}

export function buildImportLibraryComponentPlan(input = {}) {
  const key = String(input.key || "").trim();
  const parentId = String(input.parentId || "").trim();
  const assetType = String(input.assetType || "COMPONENT").trim().toUpperCase();

  if (!key) {
    throw new Error("key is required");
  }

  if (!parentId) {
    throw new Error("parentId is required");
  }

  if (!SUPPORTED_IMPORT_LIBRARY_ASSET_TYPES.includes(assetType)) {
    throw new Error(`Unsupported library asset type: ${assetType}`);
  }

  const plan = {
    key,
    parentId,
    assetType
  };

  if (typeof input.name === "string" && input.name.trim()) {
    plan.name = input.name.trim();
  }

  if (typeof input.index === "number" && Number.isFinite(input.index)) {
    plan.index = Math.trunc(input.index);
  }

  if (typeof input.x === "number" && Number.isFinite(input.x)) {
    plan.x = input.x;
  }

  if (typeof input.y === "number" && Number.isFinite(input.y)) {
    plan.y = input.y;
  }

  return plan;
}
