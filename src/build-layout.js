const SCREEN_PRESETS = {
  "iphone-17-pro": {
    width: 402,
    height: 874,
    background: "#FFFFFF"
  },
  "iphone-16-pro": {
    width: 402,
    height: 874,
    background: "#FFFFFF"
  }
};

const HELPER_TYPES = ["screen", "row", "column", "card", "section", "list", "list-item", "text"];

function clampNumber(value, fallback, min, max) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, value));
}

function normalizeName(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function normalizePadding(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return {
      top: value,
      right: value,
      bottom: value,
      left: value
    };
  }

  if (!value || typeof value !== "object") {
    return {
      top: fallback,
      right: fallback,
      bottom: fallback,
      left: fallback
    };
  }

  const x = typeof value.x === "number" && Number.isFinite(value.x) ? value.x : fallback;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? value.y : fallback;

  return {
    top:
      typeof value.top === "number" && Number.isFinite(value.top) ? value.top : y,
    right:
      typeof value.right === "number" && Number.isFinite(value.right) ? value.right : x,
    bottom:
      typeof value.bottom === "number" && Number.isFinite(value.bottom) ? value.bottom : y,
    left:
      typeof value.left === "number" && Number.isFinite(value.left) ? value.left : x
  };
}

function normalizeMode(value, fallback) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (normalized === "fixed" || normalized === "fill" || normalized === "hug") {
    return normalized;
  }

  return fallback;
}

function normalizeHelperType(value, fallback = "column") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!HELPER_TYPES.includes(normalized)) {
    return fallback;
  }

  return normalized;
}

function normalizeColor(value, fallback) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return fallback;
}

function normalizeChildren(value) {
  return Array.isArray(value) ? value : [];
}

function resolveParentId(input = {}) {
  const explicitParentId =
    typeof input.parentId === "string" && input.parentId.trim()
      ? input.parentId.trim()
      : null;

  if (explicitParentId) {
    return explicitParentId;
  }

  const defaultParentId =
    typeof input.defaultParentId === "string" && input.defaultParentId.trim()
      ? input.defaultParentId.trim()
      : null;

  if (defaultParentId) {
    return defaultParentId;
  }

  throw new Error("parentId is required when there is no registered current page");
}

function normalizeNodeTree(node = {}, depth = 0) {
  const helper = normalizeHelperType(node.helper, depth === 0 ? "screen" : "column");
  const preset =
    helper === "screen" && typeof node.preset === "string"
      ? SCREEN_PRESETS[node.preset.trim().toLowerCase()] || null
      : null;

  if (helper === "text") {
    const normalizedRole =
      typeof node.role === "string" && node.role.trim()
        ? node.role.trim().toLowerCase()
        : null;
    const defaultFontSize =
      normalizedRole === "screen-title"
        ? 28
        : normalizedRole === "section-title"
          ? 20
          : normalizedRole === "meta-strong"
            ? 18
            : normalizedRole === "meta"
              ? 16
              : undefined;

    return {
      helper,
      name: normalizeName(node.name, "text"),
      characters:
        typeof node.characters === "string" && node.characters.length
          ? node.characters
          : "New text",
      widthMode: normalizeMode(node.widthMode, "hug"),
      heightMode: normalizeMode(node.heightMode, "hug"),
      width:
        typeof node.width === "number" && Number.isFinite(node.width)
          ? node.width
          : 160,
      height:
        typeof node.height === "number" && Number.isFinite(node.height)
          ? node.height
          : 24,
      fill: normalizeColor(node.fill, undefined),
      fontFamily:
        typeof node.fontFamily === "string" && node.fontFamily.trim()
          ? node.fontFamily.trim()
          : undefined,
      fontStyle:
        typeof node.fontStyle === "string" && node.fontStyle.trim()
          ? node.fontStyle.trim()
          : undefined,
      fontSize:
        typeof node.fontSize === "number" && Number.isFinite(node.fontSize)
          ? node.fontSize
          : defaultFontSize,
      role: normalizedRole || undefined,
      children: []
    };
  }

  if (helper === "list-item") {
    const gap =
      typeof node.gap === "number" && Number.isFinite(node.gap) ? node.gap : 12;
    const title =
      typeof node.title === "string" && node.title.trim() ? node.title.trim() : "";
    const meta =
      typeof node.meta === "string" && node.meta.trim() ? node.meta.trim() : "";
    const trailing =
      typeof node.trailing === "string" && node.trailing.trim() ? node.trailing.trim() : "";
    const leadingSize =
      typeof node.leadingSize === "number" && Number.isFinite(node.leadingSize)
        ? node.leadingSize
        : 44;
    const itemChildren = [];

    if (node.showLeading !== false) {
      itemChildren.push(
        normalizeNodeTree(
          {
            helper: "card",
            name: `${normalizeName(node.name, "list-item")}-leading`,
            widthMode: "fixed",
            heightMode: "fixed",
            width: leadingSize,
            height: leadingSize,
            padding: 0,
            gap: 0,
            radius:
              typeof node.leadingRadius === "number" && Number.isFinite(node.leadingRadius)
                ? node.leadingRadius
                : 12,
            fill: normalizeColor(node.leadingFill, "#EDEFF6")
          },
          depth + 1
        )
      );
    }

    const contentChildren = [];
    if (title) {
      contentChildren.push(
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, "list-item")}-title`,
            characters: title,
            role: "body-strong",
            fontSize:
              typeof node.titleFontSize === "number" && Number.isFinite(node.titleFontSize)
                ? node.titleFontSize
                : 18
          },
          depth + 1
        )
      );
    }

    if (meta) {
      contentChildren.push(
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, "list-item")}-meta`,
            characters: meta,
            role: "meta",
            fontSize:
              typeof node.metaFontSize === "number" && Number.isFinite(node.metaFontSize)
                ? node.metaFontSize
                : 14
          },
          depth + 1
        )
      );
    }

    itemChildren.push(
      normalizeNodeTree(
        {
          helper: "column",
          name: `${normalizeName(node.name, "list-item")}-content`,
          widthMode: "fill",
          gap: meta ? 4 : 0,
          children: contentChildren
        },
        depth + 1
      )
    );

    if (trailing) {
      itemChildren.push(
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, "list-item")}-trailing`,
            characters: trailing,
            role: "meta-strong",
            fontSize:
              typeof node.trailingFontSize === "number" && Number.isFinite(node.trailingFontSize)
                ? node.trailingFontSize
                : 16
          },
          depth + 1
        )
      );
    }

    return normalizeNodeTree(
      {
        helper: "row",
        name: normalizeName(node.name, "list-item"),
        widthMode: normalizeMode(node.widthMode, "fill"),
        heightMode: normalizeMode(node.heightMode, "hug"),
        gap,
        align:
          typeof node.align === "string" && node.align.trim()
            ? node.align.trim()
            : "center",
        justify:
          trailing
            ? typeof node.justify === "string" && node.justify.trim()
              ? node.justify.trim()
              : "space-between"
            : typeof node.justify === "string" && node.justify.trim()
              ? node.justify.trim()
              : "min",
        children: itemChildren
      },
      depth
    );
  }

  const effectiveHelper = helper === "section" || helper === "list" ? "column" : helper;
  const defaultWidthMode = helper === "screen" ? "fixed" : "hug";
  const defaultHeightMode = helper === "screen" ? "fixed" : "hug";
  const defaultPadding =
    helper === "card" ? 16 : helper === "section" ? 0 : helper === "screen" ? 0 : 0;
  const defaultGap =
    helper === "card" ? 12 : helper === "row" ? 12 : helper === "list" ? 12 : 16;
  const helperDefaultWidth =
    helper === "card"
      ? 220
      : helper === "row"
        ? 160
        : helper === "section" || helper === "list" || helper === "column"
          ? 180
          : 320;
  const helperDefaultHeight =
    helper === "card"
      ? 88
      : helper === "row"
        ? 44
        : helper === "section" || helper === "list" || helper === "column"
          ? 96
          : 120;

  const normalizedChildren = normalizeChildren(node.children).map((child) =>
    normalizeNodeTree(child, depth + 1)
  );

  if (helper === "section" && typeof node.title === "string" && node.title.trim()) {
    normalizedChildren.unshift(
      normalizeNodeTree(
        {
          helper: "text",
          name: `${normalizeName(node.name, "section")}-title`,
          characters: node.title.trim(),
          role: "section-title",
          fontSize:
            typeof node.titleFontSize === "number" && Number.isFinite(node.titleFontSize)
              ? node.titleFontSize
              : 20
        },
        depth + 1
      )
    );
  }

  return {
    helper,
    preset:
      helper === "screen" && typeof node.preset === "string" && node.preset.trim()
        ? node.preset.trim()
        : undefined,
    name: normalizeName(node.name, helper),
    layout: effectiveHelper === "row" ? "row" : "column",
    widthMode: normalizeMode(node.widthMode, defaultWidthMode),
    heightMode: normalizeMode(node.heightMode, defaultHeightMode),
    width: clampNumber(node.width, preset?.width || helperDefaultWidth, 1, 4000),
    height: clampNumber(node.height, preset?.height || helperDefaultHeight, 1, 4000),
    padding: normalizePadding(node.padding, defaultPadding),
    gap: clampNumber(node.gap, defaultGap, 0, 400),
    align:
      typeof node.align === "string" && node.align.trim()
        ? node.align.trim().toLowerCase()
        : "min",
    justify:
      typeof node.justify === "string" && node.justify.trim()
        ? node.justify.trim().toLowerCase()
        : "min",
    role:
      typeof node.role === "string" && node.role.trim()
        ? node.role.trim().toLowerCase()
        : undefined,
    fill: normalizeColor(
      node.fill,
      helper === "card" ? "#F5F6FA" : preset?.background || "#FFFFFF"
    ),
    radius:
      typeof node.radius === "number" && Number.isFinite(node.radius)
        ? node.radius
        : helper === "card"
          ? 18
          : undefined,
    children: normalizedChildren
  };
}

export function buildLayoutPlan(input = {}) {
  const parentId = resolveParentId(input);
  const root = normalizeNodeTree(input.tree || input.root || {}, 0);

  return {
    parentId,
    x:
      typeof input.x === "number" && Number.isFinite(input.x)
        ? input.x
        : undefined,
    y:
      typeof input.y === "number" && Number.isFinite(input.y)
        ? input.y
        : undefined,
    root
  };
}
