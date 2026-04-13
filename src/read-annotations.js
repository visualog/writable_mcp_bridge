function normalizeTrimmedString(value) {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeProperties(properties) {
  if (!Array.isArray(properties)) {
    return [];
  }

  return properties
    .map((item) => {
      const type = normalizeTrimmedString(item?.type);
      if (!type) {
        return null;
      }
      return { type };
    })
    .filter(Boolean);
}

function normalizeAnnotation(annotation, index) {
  const label = normalizeTrimmedString(annotation?.label);
  const labelMarkdown = normalizeTrimmedString(annotation?.labelMarkdown);
  const categoryId = normalizeTrimmedString(annotation?.categoryId);
  const properties = normalizeProperties(annotation?.properties);

  const normalized = {
    source: "explicit",
    annotationIndex: index
  };

  if (label) {
    normalized.label = label;
  }
  if (labelMarkdown) {
    normalized.labelMarkdown = labelMarkdown;
  }
  if (categoryId) {
    normalized.categoryId = categoryId;
  }
  if (properties.length > 0) {
    normalized.properties = properties;
  }

  return normalized;
}

function inferCommentFromAnnotation(annotation) {
  const text = annotation.labelMarkdown || annotation.label;
  if (!text) {
    return null;
  }

  return {
    source: "inferred",
    annotationIndex: annotation.annotationIndex,
    text,
    format: annotation.labelMarkdown ? "markdown" : "plain",
    categoryId: annotation.categoryId || null
  };
}

export function buildGetAnnotationsPlan(input = {}) {
  const targetNodeId = normalizeTrimmedString(input.targetNodeId || input.nodeId);
  const includeInferredComments =
    typeof input.includeInferredComments === "boolean"
      ? input.includeInferredComments
      : true;

  const plan = { includeInferredComments };
  if (targetNodeId) {
    plan.targetNodeId = targetNodeId;
  }
  return plan;
}

export function normalizeAnnotationReadResult(raw = {}, options = {}) {
  const source = raw && raw.source === "explicit" ? "explicit" : "inferred";
  const includeInferredComments =
    typeof options.includeInferredComments === "boolean"
      ? options.includeInferredComments
      : true;
  const node = raw && typeof raw.node === "object" && raw.node ? raw.node : {};

  const normalizedNode = {
    id: normalizeTrimmedString(node.id) || null,
    name: normalizeTrimmedString(node.name) || null,
    type: normalizeTrimmedString(node.type) || null
  };

  const annotations = Array.isArray(raw?.annotations)
    ? raw.annotations.map((annotation, index) => normalizeAnnotation(annotation, index))
    : [];

  const comments = includeInferredComments
    ? annotations.map((annotation) => inferCommentFromAnnotation(annotation)).filter(Boolean)
    : [];

  return {
    source,
    targetNodeId: normalizedNode.id,
    node: normalizedNode,
    count: {
      annotations: annotations.length,
      comments: comments.length
    },
    annotations,
    comments
  };
}
