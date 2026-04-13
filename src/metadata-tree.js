function parseAttributes(attributeText) {
  const attrs = {};
  const matcher = /([A-Za-z0-9_-]+)="([^"]*)"/g;
  let match = null;

  while ((match = matcher.exec(attributeText))) {
    attrs[match[1]] = match[2];
  }

  return attrs;
}

function toNumber(value) {
  if (typeof value !== "string" || value.trim() === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildNode(tagName, attrs) {
  const node = {
    type: tagName === "selection" ? "selection" : String(attrs.type || tagName).toUpperCase(),
    tagName,
    id: attrs.id || undefined,
    name: attrs.name || undefined,
    children: []
  };

  for (const field of ["x", "y", "width", "height"]) {
    const value = toNumber(attrs[field]);
    if (typeof value === "number") {
      node[field] = value;
    }
  }

  if (attrs.visible === "false") {
    node.visible = false;
  } else if (attrs.visible === "true") {
    node.visible = true;
  }

  for (const field of ["pageId", "pageName", "fileKey", "fileName"]) {
    if (typeof attrs[field] === "string" && attrs[field].length > 0) {
      node[field] = attrs[field];
    }
  }

  return node;
}

export function parseSelectionMetadataTree(xml) {
  const source = String(xml || "");
  if (!source.trim()) {
    return null;
  }

  const tagMatcher = /<\/?[^>]+?>/g;
  const stack = [];
  let root = null;
  let match = null;

  while ((match = tagMatcher.exec(source))) {
    const tag = match[0];

    if (tag.startsWith("</")) {
      stack.pop();
      continue;
    }

    const selfClosing = tag.endsWith("/>");
    const inner = tag.slice(1, selfClosing ? -2 : -1).trim();
    const spaceIndex = inner.search(/\s/);
    const tagName =
      spaceIndex === -1 ? inner : inner.slice(0, spaceIndex).trim();
    const attrText = spaceIndex === -1 ? "" : inner.slice(spaceIndex + 1).trim();
    const attrs = parseAttributes(attrText);
    const node = buildNode(tagName, attrs);

    if (!root) {
      root = node;
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(node);
    }

    if (!selfClosing) {
      stack.push(node);
    }
  }

  return root;
}
