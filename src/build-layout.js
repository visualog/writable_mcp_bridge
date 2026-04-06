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

const HELPER_TYPES = [
  "screen",
  "row",
  "column",
  "card",
  "section",
  "list",
  "list-item",
  "media-row",
  "search-result-row",
  "status-chip",
  "avatar-stack",
  "progress-bar",
  "toolbar",
  "tabbar",
  "data-table",
  "text"
];

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

function padTimestampPart(value) {
  return String(value).padStart(2, "0");
}

function formatGeneratedTimestamp(value) {
  const date =
    value instanceof Date
      ? value
      : typeof value === "number" || typeof value === "string"
        ? new Date(value)
        : new Date();

  if (Number.isNaN(date.getTime())) {
    return formatGeneratedTimestamp(new Date());
  }

  return [
    date.getFullYear(),
    padTimestampPart(date.getMonth() + 1),
    padTimestampPart(date.getDate())
  ].join("") +
    "-" +
    [
      padTimestampPart(date.getHours()),
      padTimestampPart(date.getMinutes()),
      padTimestampPart(date.getSeconds())
    ].join("");
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

  if (helper === "status-chip") {
    const label =
      typeof node.label === "string" && node.label.trim()
        ? node.label.trim()
        : typeof node.characters === "string" && node.characters.trim()
          ? node.characters.trim()
          : "Status";
    const tone =
      typeof node.tone === "string" && node.tone.trim()
        ? node.tone.trim().toLowerCase()
        : "neutral";
    const toneFillMap = {
      urgent: "#FFF1F1",
      danger: "#FFF1F1",
      normal: "#F1FFFA",
      success: "#F1FFFA",
      low: "#F5F6FA",
      warning: "#FFF7E8",
      neutral: "#F5F6FA"
    };
    const toneTextMap = {
      urgent: "#EB5757",
      danger: "#EB5757",
      normal: "#16B286",
      success: "#16B286",
      low: "#69707D",
      warning: "#D38B00",
      neutral: "#69707D"
    };
    const icon =
      typeof node.icon === "string" && node.icon.trim() ? node.icon.trim() : null;
    const chipChildren = [];

    if (icon) {
      chipChildren.push(
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, "status-chip")}-icon`,
            characters: icon,
            role: "meta",
            fontSize: 12,
            fill: toneTextMap[tone] || toneTextMap.neutral
          },
          depth + 1
        )
      );
    }

    chipChildren.push(
      normalizeNodeTree(
        {
          helper: "text",
          name: `${normalizeName(node.name, "status-chip")}-label`,
          characters: label,
          role: "meta",
          fontSize:
            typeof node.fontSize === "number" && Number.isFinite(node.fontSize)
              ? node.fontSize
              : 12,
          fill: toneTextMap[tone] || toneTextMap.neutral
        },
        depth + 1
      )
    );

    return normalizeNodeTree(
      {
        helper: "row",
        name: normalizeName(node.name, "status-chip"),
        widthMode: "hug",
        heightMode: "hug",
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap) ? node.gap : 6,
        padding: node.padding || { x: 8, y: 4 },
        align: "center",
        justify: "min",
        radius:
          typeof node.radius === "number" && Number.isFinite(node.radius)
            ? node.radius
            : 8,
        fill: normalizeColor(node.fill, toneFillMap[tone] || toneFillMap.neutral),
        children: chipChildren
      },
      depth
    );
  }

  if (helper === "avatar-stack") {
    const avatars = Array.isArray(node.avatars) ? node.avatars : [];
    const size =
      typeof node.size === "number" && Number.isFinite(node.size) ? node.size : 20;
    const stackChildren = avatars.slice(0, 4).flatMap((avatar, index) => {
      const normalizedAvatar =
        avatar && typeof avatar === "object" ? avatar : { initials: String(avatar || "") };
      const initials =
        typeof normalizedAvatar.initials === "string" && normalizedAvatar.initials.trim()
          ? normalizedAvatar.initials.trim()
          : `A${index + 1}`;
      const fill = normalizeColor(
        normalizedAvatar.fill,
        ["#8B80F9", "#B8B0FF", "#FF9D57", "#2AB3A6"][index % 4]
      );

      return [
        normalizeNodeTree(
          {
            helper: "card",
            name: `${normalizeName(node.name, "avatar-stack")}-avatar-${index + 1}`,
            widthMode: "fixed",
            heightMode: "fixed",
            width: size,
            height: size,
            padding: 0,
            gap: 0,
            radius: size / 2,
            fill
          },
          depth + 1
        ),
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, "avatar-stack")}-avatar-copy-${index + 1}`,
            characters: initials,
            role: "meta",
            fontSize: Math.max(10, Math.round(size * 0.45)),
            fill: "#FFFFFF"
          },
          depth + 1
        )
      ];
    });

    if (typeof node.moreLabel === "string" && node.moreLabel.trim()) {
      stackChildren.push(
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, "avatar-stack")}-more`,
            characters: node.moreLabel.trim(),
            role: "meta",
            fontSize: 12,
            fill: "#69707D"
          },
          depth + 1
        )
      );
    }

    return normalizeNodeTree(
      {
        helper: "row",
        name: normalizeName(node.name, "avatar-stack"),
        widthMode: "hug",
        heightMode: "hug",
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap) ? node.gap : 4,
        align: "center",
        justify: "min",
        children: stackChildren
      },
      depth
    );
  }

  if (helper === "progress-bar") {
    const percent =
      typeof node.value === "number" && Number.isFinite(node.value)
        ? Math.max(0, Math.min(100, node.value))
        : typeof node.percent === "number" && Number.isFinite(node.percent)
          ? Math.max(0, Math.min(100, node.percent))
          : 0;
    const trackWidth =
      typeof node.trackWidth === "number" && Number.isFinite(node.trackWidth)
        ? node.trackWidth
        : 88;
    const trackHeight =
      typeof node.trackHeight === "number" && Number.isFinite(node.trackHeight)
        ? node.trackHeight
        : 6;
    const fillWidth = Math.max(4, Math.round((trackWidth * percent) / 100));
    const showLabel = node.showLabel !== false;
    const progressChildren = [
      normalizeNodeTree(
        {
          helper: "row",
          name: `${normalizeName(node.name, "progress-bar")}-track`,
          widthMode: "fixed",
          heightMode: "fixed",
          width: trackWidth,
          height: trackHeight,
          gap: 0,
          padding: 0,
          radius:
            typeof node.radius === "number" && Number.isFinite(node.radius)
              ? node.radius
              : trackHeight / 2,
          fill: normalizeColor(node.trackFill, "#E8E6FF"),
          children: [
            {
              helper: "card",
              name: `${normalizeName(node.name, "progress-bar")}-fill`,
              widthMode: "fixed",
              heightMode: "fixed",
              width: fillWidth,
              height: trackHeight,
              padding: 0,
              gap: 0,
              radius:
                typeof node.radius === "number" && Number.isFinite(node.radius)
                  ? node.radius
                  : trackHeight / 2,
              fill: normalizeColor(node.barFill, "#6C63FF")
            }
          ]
        },
        depth + 1
      )
    ];

    if (showLabel) {
      progressChildren.push(
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, "progress-bar")}-label`,
            characters:
              typeof node.label === "string" && node.label.trim()
                ? node.label.trim()
                : `${percent}%`,
            role: "meta",
            fontSize: 11,
            fill: "#69707D"
          },
          depth + 1
        )
      );
    }

    return normalizeNodeTree(
      {
        helper: "row",
        name: normalizeName(node.name, "progress-bar"),
        widthMode: normalizeMode(node.widthMode, "hug"),
        heightMode: "hug",
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap) ? node.gap : 8,
        align: "center",
        justify: "min",
        children: progressChildren
      },
      depth
    );
  }

  if (helper === "toolbar") {
    const title =
      typeof node.title === "string" && node.title.trim() ? node.title.trim() : "";
    const leftItems = Array.isArray(node.leftItems) ? node.leftItems : [];
    const rightItems = Array.isArray(node.rightItems) ? node.rightItems : [];

    const leftChildren = [];
    if (title) {
      leftChildren.push(
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, "toolbar")}-title`,
            characters: title,
            role: node.titleRole || "body-strong",
            fontSize:
              typeof node.titleFontSize === "number" && Number.isFinite(node.titleFontSize)
                ? node.titleFontSize
                : 14
          },
          depth + 1
        )
      );
    }
    leftChildren.push(...leftItems.map((item) => normalizeNodeTree(item, depth + 1)));

    const toolbarChildren = [
      normalizeNodeTree(
        {
          helper: "row",
          name: `${normalizeName(node.name, "toolbar")}-left`,
          widthMode: title && rightItems.length ? "hug" : "fill",
          heightMode: "hug",
          gap:
            typeof node.leftGap === "number" && Number.isFinite(node.leftGap)
              ? node.leftGap
              : 12,
          align: "center",
          justify: "min",
          children: leftChildren
        },
        depth + 1
      )
    ];

    if (rightItems.length) {
      toolbarChildren.push(
        normalizeNodeTree(
          {
            helper: "row",
            name: `${normalizeName(node.name, "toolbar")}-right`,
            widthMode: "hug",
            heightMode: "hug",
            gap:
              typeof node.rightGap === "number" && Number.isFinite(node.rightGap)
                ? node.rightGap
                : 10,
            align: "center",
            justify: "min",
            children: rightItems
          },
          depth + 1
        )
      );
    }

    return normalizeNodeTree(
      {
        helper: "row",
        name: normalizeName(node.name, "toolbar"),
        widthMode: normalizeMode(node.widthMode, "fill"),
        heightMode: "hug",
        gap: typeof node.gap === "number" && Number.isFinite(node.gap) ? node.gap : 16,
        padding: node.padding || 0,
        align: "center",
        justify: rightItems.length ? "space-between" : "min",
        children: toolbarChildren
      },
      depth
    );
  }

  if (helper === "tabbar") {
    const tabs = Array.isArray(node.tabs) ? node.tabs : [];
    const activeIndex =
      typeof node.activeIndex === "number" && Number.isFinite(node.activeIndex)
        ? Math.max(0, node.activeIndex)
        : 0;
    const tabChildren = tabs.map((tab, index) => {
      const normalizedTab = tab && typeof tab === "object" ? tab : { label: String(tab || "") };
      return {
        helper: "card",
        name:
          typeof normalizedTab.name === "string" && normalizedTab.name.trim()
            ? normalizedTab.name.trim()
            : `${normalizeName(node.name, "tabbar")}-tab-${index + 1}`,
        widthMode: "hug",
        heightMode: "hug",
        padding: normalizedTab.padding || { x: 10, y: 6 },
        gap: 6,
        radius: typeof normalizedTab.radius === "number" ? normalizedTab.radius : 10,
        fill:
          normalizeColor(
            normalizedTab.fill,
            index === activeIndex ? "#F3EEFF" : "#FFFFFF"
          ),
        children: [
          normalizedTab.icon
            ? {
                helper: "text",
                name: `${normalizeName(node.name, "tabbar")}-tab-icon-${index + 1}`,
                characters: normalizedTab.icon,
                role: "meta",
                fontSize: 12,
                fill: index === activeIndex ? "#6C63FF" : "#69707D"
              }
            : null,
          {
            helper: "text",
            name: `${normalizeName(node.name, "tabbar")}-tab-label-${index + 1}`,
            characters:
              typeof normalizedTab.label === "string" && normalizedTab.label.trim()
                ? normalizedTab.label.trim()
                : `Tab ${index + 1}`,
            role: "meta",
            fontSize: 13,
            fill: index === activeIndex ? "#6C63FF" : "#69707D"
          }
        ].filter(Boolean)
      };
    });

    return normalizeNodeTree(
      {
        helper: "row",
        name: normalizeName(node.name, "tabbar"),
        widthMode: normalizeMode(node.widthMode, "fill"),
        heightMode: "hug",
        gap: typeof node.gap === "number" && Number.isFinite(node.gap) ? node.gap : 8,
        align: "center",
        justify: "min",
        children: tabChildren
      },
      depth
    );
  }

  if (helper === "data-table") {
    const columns = Array.isArray(node.columns) ? node.columns : [];
    const rows = Array.isArray(node.rows) ? node.rows : [];

    const headerChildren = columns.map((column, index) =>
      normalizeNodeTree(
        {
          helper: "text",
          name: `${normalizeName(node.name, "data-table")}-head-${index + 1}`,
          characters:
            typeof column === "string"
              ? column
              : typeof column?.label === "string" && column.label.trim()
                ? column.label.trim()
                : `Column ${index + 1}`,
          role: "meta",
          fontSize: 12,
          widthMode:
            typeof column === "object" && column?.widthMode ? column.widthMode : "fill"
        },
        depth + 1
      )
    );

    const rowChildren = rows.map((row, rowIndex) => {
      const cells = Array.isArray(row?.cells) ? row.cells : Array.isArray(row) ? row : [];
      return {
        helper: "row",
        name:
          typeof row?.name === "string" && row.name.trim()
            ? row.name.trim()
            : `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}`,
        widthMode: "fill",
        heightMode: "hug",
        gap: typeof node.rowGap === "number" && Number.isFinite(node.rowGap) ? node.rowGap : 12,
        align: "center",
        justify: "min",
        children: cells.map((cell, cellIndex) => {
          if (cell && typeof cell === "object" && cell.helper) {
            return cell;
          }

          return {
            helper: "text",
            name: `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-cell-${cellIndex + 1}`,
            characters: String(cell ?? ""),
            role: "meta",
            fontSize: 13,
            widthMode:
              typeof columns[cellIndex] === "object" && columns[cellIndex]?.widthMode
                ? columns[cellIndex].widthMode
                : "fill"
          };
        })
      };
    });

    return normalizeNodeTree(
      {
        helper: "section",
        name: normalizeName(node.name, "data-table"),
        title:
          typeof node.title === "string" && node.title.trim() ? node.title.trim() : undefined,
        gap: typeof node.gap === "number" && Number.isFinite(node.gap) ? node.gap : 12,
        children: [
          {
            helper: "row",
            name: `${normalizeName(node.name, "data-table")}-header`,
            widthMode: "fill",
            heightMode: "hug",
            gap:
              typeof node.headerGap === "number" && Number.isFinite(node.headerGap)
                ? node.headerGap
                : 12,
            align: "center",
            justify: "min",
            children: headerChildren
          },
          {
            helper: "list",
            name: `${normalizeName(node.name, "data-table")}-rows`,
            widthMode: "fill",
            gap:
              typeof node.rowsGap === "number" && Number.isFinite(node.rowsGap)
                ? node.rowsGap
                : 10,
            children: rowChildren
          }
        ]
      },
      depth
    );
  }

  if (
    helper === "list-item" ||
    helper === "media-row" ||
    helper === "search-result-row"
  ) {
    const gap =
      typeof node.gap === "number" && Number.isFinite(node.gap) ? node.gap : 12;
    const isMediaRow = helper === "media-row";
    const isSearchResultRow = helper === "search-result-row";
    const title =
      typeof node.title === "string" && node.title.trim() ? node.title.trim() : "";
    const subtitle =
      typeof node.subtitle === "string" && node.subtitle.trim() ? node.subtitle.trim() : "";
    const meta =
      typeof node.meta === "string" && node.meta.trim() ? node.meta.trim() : "";
    const trailing =
      typeof node.trailing === "string" && node.trailing.trim()
        ? node.trailing.trim()
        : isSearchResultRow
          ? ""
          : "";
    const leadingSize =
      typeof node.leadingSize === "number" && Number.isFinite(node.leadingSize)
        ? node.leadingSize
        : isMediaRow
          ? 56
          : isSearchResultRow
            ? 72
            : 44;
    const itemChildren = [];

    if (node.showLeading !== false) {
      itemChildren.push(
        normalizeNodeTree(
          {
            helper: "card",
            name: `${normalizeName(node.name, helper)}-leading`,
            widthMode: "fixed",
            heightMode: "fixed",
            width: leadingSize,
            height: leadingSize,
            padding: 0,
            gap: 0,
            radius:
              typeof node.leadingRadius === "number" && Number.isFinite(node.leadingRadius)
                ? node.leadingRadius
                : isMediaRow
                  ? 16
                  : isSearchResultRow
                    ? 12
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
            name: `${normalizeName(node.name, helper)}-title`,
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

    if (subtitle) {
      contentChildren.push(
        normalizeNodeTree(
          {
            helper: "text",
            name: `${normalizeName(node.name, helper)}-subtitle`,
            characters: subtitle,
            role: "meta",
            fontSize:
              typeof node.subtitleFontSize === "number" &&
              Number.isFinite(node.subtitleFontSize)
                ? node.subtitleFontSize
                : isSearchResultRow
                  ? 16
                  : 15
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
            name: `${normalizeName(node.name, helper)}-meta`,
            characters: meta,
            role: "meta",
            fontSize:
              typeof node.metaFontSize === "number" && Number.isFinite(node.metaFontSize)
                ? node.metaFontSize
                : isSearchResultRow
                  ? 15
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
          name: `${normalizeName(node.name, helper)}-content`,
          widthMode: "fill",
          gap: subtitle || meta ? (isSearchResultRow ? 6 : 4) : 0,
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
            name: `${normalizeName(node.name, helper)}-trailing`,
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
        name: normalizeName(node.name, helper),
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
  const generatedNamePrefix =
    typeof input.generatedNamePrefix === "string" && input.generatedNamePrefix.trim()
      ? input.generatedNamePrefix.trim()
      : null;
  const rootNameWasExplicit =
    typeof input?.tree?.name === "string" && input.tree.name.trim()
      ? true
      : typeof input?.root?.name === "string" && input.root.name.trim();

  if (!rootNameWasExplicit && generatedNamePrefix) {
    root.name = `${generatedNamePrefix}-${formatGeneratedTimestamp(input.generatedAt)}`;
  }

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
