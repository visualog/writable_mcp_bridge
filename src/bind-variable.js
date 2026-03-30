const SUPPORTED_SIMPLE_BINDABLE_FIELDS = [
  "height",
  "width",
  "characters",
  "itemSpacing",
  "paddingLeft",
  "paddingRight",
  "paddingTop",
  "paddingBottom",
  "visible",
  "topLeftRadius",
  "topRightRadius",
  "bottomLeftRadius",
  "bottomRightRadius",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "counterAxisSpacing",
  "strokeWeight",
  "strokeTopWeight",
  "strokeRightWeight",
  "strokeBottomWeight",
  "strokeLeftWeight",
  "opacity",
  "gridRowGap",
  "gridColumnGap",
  "fontFamily",
  "fontSize",
  "fontStyle",
  "fontWeight",
  "letterSpacing",
  "lineHeight",
  "paragraphSpacing",
  "paragraphIndent"
];

const SUPPORTED_PAINT_BINDABLE_FIELDS = ["fills.color", "strokes.color"];

export function listSupportedBindVariableFields() {
  return [...SUPPORTED_SIMPLE_BINDABLE_FIELDS, ...SUPPORTED_PAINT_BINDABLE_FIELDS];
}

export function buildBindVariablePlan(input = {}) {
  const nodeId = String(input.nodeId || "").trim();
  const property = String(input.property || "").trim();
  const variableId =
    typeof input.variableId === "string" && input.variableId.trim()
      ? input.variableId.trim()
      : null;
  const variableKey =
    typeof input.variableKey === "string" && input.variableKey.trim()
      ? input.variableKey.trim()
      : null;
  const unbind = input.unbind === true;

  if (!nodeId) {
    throw new Error("nodeId is required");
  }

  if (!property) {
    throw new Error("property is required");
  }

  if (!listSupportedBindVariableFields().includes(property)) {
    throw new Error(`Unsupported bindable property: ${property}`);
  }

  if (!variableId && !variableKey && !unbind) {
    throw new Error("variableId, variableKey, or unbind=true is required");
  }

  if ((variableId || variableKey) && unbind) {
    throw new Error("unbind cannot be combined with variableId or variableKey");
  }

  const plan = {
    nodeId,
    property
  };

  if (variableId) {
    plan.variableId = variableId;
  }

  if (variableKey) {
    plan.variableKey = variableKey;
  }

  if (unbind) {
    plan.unbind = true;
  }

  return plan;
}
