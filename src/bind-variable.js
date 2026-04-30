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

function normalizeBindVariableEntry(input = {}, { index = null } = {}) {
  const fieldLabel =
    Number.isInteger(index) && index >= 0 ? `bindings[${index}]` : "binding";
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
    throw new Error(`${fieldLabel}.nodeId is required`);
  }

  if (!property) {
    throw new Error(`${fieldLabel}.property is required`);
  }

  if (!listSupportedBindVariableFields().includes(property)) {
    throw new Error(`Unsupported bindable property: ${property}`);
  }

  if (!variableId && !variableKey && !unbind) {
    throw new Error(`${fieldLabel} requires variableId, variableKey, or unbind=true`);
  }

  if ((variableId || variableKey) && unbind) {
    throw new Error(`${fieldLabel}.unbind cannot be combined with variableId or variableKey`);
  }

  const binding = {
    nodeId,
    property
  };

  if (variableId) {
    binding.variableId = variableId;
  }

  if (variableKey) {
    binding.variableKey = variableKey;
  }

  if (unbind) {
    binding.unbind = true;
  }

  return binding;
}

export function buildBindVariablePlan(input = {}) {
  return normalizeBindVariableEntry(input);
}

export function buildBulkBindVariablesPlan(input = {}) {
  if (!Array.isArray(input.bindings) || input.bindings.length === 0) {
    throw new Error("bindings array is required");
  }

  return {
    bindings: input.bindings.map((binding, index) =>
      normalizeBindVariableEntry(binding, { index })
    )
  };
}
