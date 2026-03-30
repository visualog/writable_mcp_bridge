const SUPPORTED_STYLE_TYPES = ["text", "effect"];

export function listSupportedApplyStyleTypes() {
  return [...SUPPORTED_STYLE_TYPES];
}

export function buildApplyStylePlan(input = {}) {
  const nodeId = String(input.nodeId || "").trim();
  const styleType = String(input.styleType || "").trim().toLowerCase();
  const styleId =
    typeof input.styleId === "string" && input.styleId.trim()
      ? input.styleId.trim()
      : null;
  const styleKey =
    typeof input.styleKey === "string" && input.styleKey.trim()
      ? input.styleKey.trim()
      : null;
  const clear = input.clear === true;

  if (!nodeId) {
    throw new Error("nodeId is required");
  }

  if (!SUPPORTED_STYLE_TYPES.includes(styleType)) {
    throw new Error(`Unsupported style type: ${styleType}`);
  }

  if (!styleId && !styleKey && !clear) {
    throw new Error("styleId, styleKey, or clear=true is required");
  }

  if ((styleId || styleKey) && clear) {
    throw new Error("clear cannot be combined with styleId or styleKey");
  }

  const plan = {
    nodeId,
    styleType
  };

  if (styleId) {
    plan.styleId = styleId;
  }

  if (styleKey) {
    plan.styleKey = styleKey;
  }

  if (clear) {
    plan.clear = true;
  }

  return plan;
}
