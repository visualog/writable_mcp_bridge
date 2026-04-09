import { resolvePattern } from "./resolve-pattern.js";

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
  "browser-chrome",
  "sidebar-nav",
  "workspace-switcher",
  "profile-summary",
  "divider",
  "app-shell",
  "dashboard-board",
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
    const pattern = resolvePattern("status-chip", { tone: node.tone });
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
    const patternFill = pattern?.tokens?.fill;
    const patternText = pattern?.tokens?.text;
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
            fill: patternText || "#69707D"
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
              : pattern?.defaults?.fontSize || 12,
          fill: patternText || "#69707D"
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
          typeof node.gap === "number" && Number.isFinite(node.gap)
            ? node.gap
            : pattern?.defaults?.gap || 6,
        padding: node.padding || pattern?.defaults?.padding || { x: 8, y: 4 },
        align: "center",
        justify: "min",
        radius:
          typeof node.radius === "number" && Number.isFinite(node.radius)
            ? node.radius
            : pattern?.defaults?.radius || 8,
        fill: normalizeColor(node.fill, patternFill || "#F5F6FA"),
        children: chipChildren
      },
      depth
    );
  }

  if (helper === "avatar-stack") {
    const pattern = resolvePattern("avatar-stack");
    const avatars = Array.isArray(node.avatars) ? node.avatars : [];
    const size =
      typeof node.size === "number" && Number.isFinite(node.size)
        ? node.size
        : pattern?.defaults?.size || 20;
    const overlap =
      typeof node.overlap === "number" && Number.isFinite(node.overlap)
        ? Math.max(0, node.overlap)
        : pattern?.defaults?.overlap || 0;
    const compactGap =
      typeof node.gap === "number" && Number.isFinite(node.gap)
        ? node.gap
        : overlap > 0
          ? 0
          : pattern?.defaults?.gap || 4;
    const avatarPalette = Array.isArray(pattern?.tokens?.avatarFills)
      ? pattern.tokens.avatarFills
      : ["#8B80F9", "#B8B0FF", "#FF9D57", "#2AB3A6"];
    const maxVisible =
      typeof pattern?.defaults?.maxVisible === "number" && Number.isFinite(pattern.defaults.maxVisible)
        ? pattern.defaults.maxVisible
        : 4;
    const stackChildren = avatars.slice(0, maxVisible).flatMap((avatar, index) => {
      const normalizedAvatar =
        avatar && typeof avatar === "object" ? avatar : { initials: String(avatar || "") };
      const initials =
        typeof normalizedAvatar.initials === "string" && normalizedAvatar.initials.trim()
          ? normalizedAvatar.initials.trim()
          : `A${index + 1}`;
      const fill = normalizeColor(
        normalizedAvatar.fill,
        avatarPalette[index % avatarPalette.length]
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
        ...(node.showInitials === false
          ? []
          : [
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
            ])
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
            fontSize: pattern?.defaults?.moreFontSize || 12,
            fill: pattern?.tokens?.moreText || "#69707D"
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
        gap: compactGap,
        align: "center",
        justify: "min",
        children: stackChildren
      },
      depth
    );
  }

  if (helper === "progress-bar") {
    const pattern = resolvePattern("progress-bar");
    const percent =
      typeof node.value === "number" && Number.isFinite(node.value)
        ? Math.max(0, Math.min(100, node.value))
        : typeof node.percent === "number" && Number.isFinite(node.percent)
          ? Math.max(0, Math.min(100, node.percent))
          : 0;
    const trackWidth =
      typeof node.trackWidth === "number" && Number.isFinite(node.trackWidth)
        ? node.trackWidth
        : pattern?.defaults?.trackWidth || 88;
    const trackHeight =
      typeof node.trackHeight === "number" && Number.isFinite(node.trackHeight)
        ? node.trackHeight
        : pattern?.defaults?.trackHeight || 6;
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
              : pattern?.defaults?.radius || trackHeight / 2,
          fill: normalizeColor(node.trackFill, pattern?.tokens?.trackFill || "#E8E6FF"),
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
                  : pattern?.defaults?.radius || trackHeight / 2,
              fill: normalizeColor(node.barFill, pattern?.tokens?.barFill || "#6C63FF")
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
            fontSize: pattern?.defaults?.labelFontSize || 11,
            fill: pattern?.tokens?.text || "#69707D"
          },
          depth + 1
        )
      );
    }

    return normalizeNodeTree(
      {
        helper: "row",
        name: normalizeName(node.name, "progress-bar"),
        widthMode: normalizeMode(node.widthMode, pattern?.defaults?.widthMode || "hug"),
        heightMode: "hug",
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap)
            ? node.gap
            : pattern?.defaults?.gap || 8,
        align: "center",
        justify: "min",
        children: progressChildren
      },
      depth
    );
  }

  if (helper === "toolbar") {
    const pattern = resolvePattern("toolbar");
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
              : pattern?.defaults?.leftGap || 12,
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
                : pattern?.defaults?.rightGap || 10,
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
        widthMode: normalizeMode(node.widthMode, pattern?.defaults?.widthMode || "fill"),
        heightMode: pattern?.defaults?.heightMode || "hug",
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap)
            ? node.gap
            : pattern?.defaults?.gap || 16,
        padding: node.padding || pattern?.defaults?.padding || 0,
        align: "center",
        justify: rightItems.length ? pattern?.defaults?.justify || "space-between" : "min",
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
    const pattern = resolvePattern("data-table", { density: node.density });
    const baseColumns = Array.isArray(node.columns) ? node.columns : [];
    const rows = Array.isArray(node.rows) ? node.rows : [];
    const defaultColumnWidthMode = normalizeMode(node.columnWidthMode, "fill");
    const rowSelectionEnabled = node.rowSelection === true;
    const rowActionsEnabled = node.rowActions === true;
    const columns = [
      ...(rowSelectionEnabled
        ? [
            {
              label: "",
              widthMode: "hug",
              width: 18,
              actions: Array.isArray(node.selectionHeaderActions)
                ? node.selectionHeaderActions
                : []
            }
          ]
        : []),
      ...baseColumns,
      ...(rowActionsEnabled
        ? [
            {
              label:
                typeof node.rowActionsLabel === "string" ? node.rowActionsLabel : "",
              widthMode: "hug",
              width:
                typeof node.rowActionsWidth === "number" && Number.isFinite(node.rowActionsWidth)
                  ? node.rowActionsWidth
                  : 40,
              actions: Array.isArray(node.rowActionsHeader)
                ? node.rowActionsHeader
                : typeof node.rowActionsHeader === "string"
                  ? [node.rowActionsHeader]
                  : []
            }
          ]
        : [])
    ];
    const normalizeColumn = (column, index) => ({
      label:
        typeof column === "string"
          ? column
          : typeof column?.label === "string" && column.label.trim()
            ? column.label.trim()
            : `Column ${index + 1}`,
      widthMode:
        typeof column === "object" && column?.widthMode
          ? normalizeMode(column.widthMode, defaultColumnWidthMode)
          : defaultColumnWidthMode,
      width:
        typeof column === "object" && typeof column?.width === "number" && Number.isFinite(column.width)
          ? column.width
          : undefined,
      align:
        typeof column === "object" && typeof column?.align === "string" && column.align.trim()
          ? column.align.trim().toLowerCase()
          : "min",
      role:
        typeof column === "object" && typeof column?.role === "string" && column.role.trim()
          ? column.role.trim()
          : "meta"
    });
    const normalizedColumns = columns.map(normalizeColumn);
    const buildTableCell = (cell, cellIndex, rowIndex) => {
      const column = normalizedColumns[cellIndex] || {
        widthMode: defaultColumnWidthMode,
        width: undefined,
        align: "min",
        role: "meta"
      };

      if (cell && typeof cell === "object" && cell.helper) {
        return {
          ...cell,
          widthMode: cell.widthMode || column.widthMode,
          width:
            typeof cell.width === "number" && Number.isFinite(cell.width)
              ? cell.width
              : column.width
        };
      }

      if (cell && typeof cell === "object" && !Array.isArray(cell)) {
        if (cell.type === "checkbox") {
          return {
            helper: "card",
            name:
              cell.name ||
              `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-checkbox-${cellIndex + 1}`,
            widthMode: "fixed",
            heightMode: "fixed",
            width: typeof cell.size === "number" ? cell.size : 14,
            height: typeof cell.size === "number" ? cell.size : 14,
            padding: 0,
            gap: 0,
            radius: typeof cell.radius === "number" ? cell.radius : 4,
            fill: cell.checked ? normalizeColor(cell.fill, "#6C63FF") : normalizeColor(cell.fill, "#FFFFFF")
          };
        }

        if (cell.type === "action-box") {
          return {
            helper: "card",
            name:
              cell.name ||
              `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-action-box-${cellIndex + 1}`,
            widthMode: "fixed",
            heightMode: "fixed",
            width: typeof cell.size === "number" ? cell.size : 20,
            height: typeof cell.size === "number" ? cell.size : 20,
            padding: 0,
            gap: 0,
            radius: typeof cell.radius === "number" ? cell.radius : 6,
            fill: normalizeColor(cell.fill, "#2D6BFF")
          };
        }

        if (cell.type === "action-menu") {
          return {
            helper: "text",
            name:
              cell.name ||
              `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-action-menu-${cellIndex + 1}`,
            characters: typeof cell.characters === "string" ? cell.characters : "⋯",
            role: "meta",
            fontSize: typeof cell.fontSize === "number" ? cell.fontSize : 12,
            widthMode: "hug",
            fill: normalizeColor(cell.fill, "#69707D")
          };
        }

        if (cell.type === "avatars") {
          return {
            helper: "avatar-stack",
            name:
              cell.name ||
              `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-avatars-${cellIndex + 1}`,
            avatars: Array.isArray(cell.avatars) ? cell.avatars : [],
            size: typeof cell.size === "number" ? cell.size : 20,
            showInitials: cell.showInitials,
            overlap: typeof cell.overlap === "number" ? cell.overlap : 4,
            widthMode: cell.widthMode || column.widthMode,
            width:
              typeof cell.width === "number" && Number.isFinite(cell.width)
                ? cell.width
                : column.width
          };
        }

        if (Array.isArray(cell.items)) {
          return {
            helper: "row",
            name:
              cell.name ||
              `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-cell-${cellIndex + 1}`,
            widthMode: cell.widthMode || column.widthMode,
            width:
              typeof cell.width === "number" && Number.isFinite(cell.width)
                ? cell.width
                : column.width,
            gap:
              typeof cell.gap === "number" && Number.isFinite(cell.gap) ? cell.gap : 8,
            align:
              typeof cell.align === "string" && cell.align.trim()
                ? cell.align.trim()
                : "center",
            justify:
              typeof cell.justify === "string" && cell.justify.trim()
                ? cell.justify.trim()
                : "min",
            children: cell.items
          };
        }

        if (
          typeof cell.title === "string" ||
          typeof cell.subtitle === "string" ||
          typeof cell.meta === "string" ||
          typeof cell.trailing === "string"
        ) {
          return {
            helper: cell.pattern || "media-row",
            name:
              cell.name ||
              `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-cell-${cellIndex + 1}`,
            widthMode: cell.widthMode || column.widthMode,
            width:
              typeof cell.width === "number" && Number.isFinite(cell.width)
                ? cell.width
                : column.width,
            title: cell.title,
            subtitle: cell.subtitle,
            meta: cell.meta,
            trailing: cell.trailing,
            showLeading: cell.showLeading,
            leadingSize: cell.leadingSize,
            leadingFill: cell.leadingFill
          };
        }

        if (typeof cell.label === "string" || typeof cell.characters === "string") {
          return {
            helper: "text",
            name:
              cell.name ||
              `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-cell-${cellIndex + 1}`,
            characters:
              typeof cell.characters === "string"
                ? cell.characters
                : String(cell.label ?? ""),
            role: cell.role || column.role || "meta",
            fontSize:
              typeof cell.fontSize === "number" && Number.isFinite(cell.fontSize)
                ? cell.fontSize
                : 13,
            widthMode: cell.widthMode || column.widthMode,
            width:
              typeof cell.width === "number" && Number.isFinite(cell.width)
                ? cell.width
                : column.width,
            fill: cell.fill,
            fontStyle: cell.fontStyle
          };
        }
      }

      return {
        helper: "text",
        name: `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}-cell-${cellIndex + 1}`,
        characters: String(cell ?? ""),
        role: column.role || "meta",
        fontSize: 13,
        widthMode: column.widthMode,
        width: column.width
      };
    };

    const headerChildren = normalizedColumns.map((column, index) =>
      normalizeNodeTree(
        {
          helper: "row",
          name: `${normalizeName(node.name, "data-table")}-head-${index + 1}`,
          widthMode: column.widthMode,
          width: column.width,
          heightMode: "hug",
          gap: 6,
          align: "center",
          justify: "min",
          children: [
            {
              helper: "text",
              name: `${normalizeName(node.name, "data-table")}-head-label-${index + 1}`,
              characters: column.label,
              role: "meta",
              fontSize: 12,
              widthMode: "hug"
            },
            ...(Array.isArray(column.actions)
              ? column.actions.map((action, actionIndex) => ({
                  helper: "text",
                  name: `${normalizeName(node.name, "data-table")}-head-action-${index + 1}-${actionIndex + 1}`,
                  characters: typeof action === "string" ? action : String(action?.label ?? ""),
                  role: "meta",
                  fontSize: 11,
                  fill: "#B0B5C3"
                }))
              : [])
          ]
        },
        depth + 1
      )
    );

    const rowChildren = rows.map((row, rowIndex) => {
      const rawCells = Array.isArray(row?.cells) ? row.cells : Array.isArray(row) ? row : [];
      const cells = [
        ...(rowSelectionEnabled
          ? [
              {
                type: "checkbox",
                checked: row?.checked === true || row?.selected === true
              }
            ]
          : []),
        ...rawCells,
        ...(rowActionsEnabled
          ? [
              row?.actionBox
                ? {
                    type: "action-box",
                    fill: row.actionBox.fill,
                    size: row.actionBox.size
                  }
                : row?.actionMenu === false
                  ? { helper: "text", characters: "" }
                  : {
                      type: "action-menu",
                      characters:
                        typeof row?.actionMenu === "string" && row.actionMenu.trim()
                          ? row.actionMenu.trim()
                          : "⋯"
                    }
            ]
          : [])
      ];
      return {
        helper: "row",
        name:
          typeof row?.name === "string" && row.name.trim()
            ? row.name.trim()
            : `${normalizeName(node.name, "data-table")}-row-${rowIndex + 1}`,
        widthMode: "fill",
        heightMode: "hug",
        gap:
          typeof node.rowGap === "number" && Number.isFinite(node.rowGap)
            ? node.rowGap
            : pattern?.defaults?.rowGap || 12,
        align: "center",
        justify: "min",
        children: cells.map((cell, cellIndex) => buildTableCell(cell, cellIndex, rowIndex))
      };
    });

    return normalizeNodeTree(
      {
        helper: "section",
        name: normalizeName(node.name, "data-table"),
        title:
          typeof node.title === "string" && node.title.trim() ? node.title.trim() : undefined,
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap)
            ? node.gap
            : pattern?.defaults?.gap || 12,
        children: [
          (typeof node.showTopDivider === "boolean"
            ? node.showTopDivider
            : pattern?.defaults?.showTopDivider) === true
            ? {
                helper: "divider",
                name: `${normalizeName(node.name, "data-table")}-top-divider`
              }
            : null,
          {
            helper:
              typeof node.headerFill === "string" && node.headerFill.trim()
                ? "card"
                : "row",
            name: `${normalizeName(node.name, "data-table")}-header`,
            widthMode: "fill",
            heightMode: "hug",
            gap:
              typeof node.headerGap === "number" && Number.isFinite(node.headerGap)
                ? node.headerGap
                : pattern?.defaults?.headerGap || 12,
            align: "center",
            justify: "min",
            padding:
              typeof node.headerFill === "string" && node.headerFill.trim()
                ? { x: 10, y: 8 }
                : 0,
            radius:
              typeof node.headerFill === "string" && node.headerFill.trim() ? 10 : undefined,
            fill:
              typeof node.headerFill === "string" && node.headerFill.trim()
                ? node.headerFill.trim()
                : undefined,
            children: headerChildren
          },
          {
            helper: "list",
            name: `${normalizeName(node.name, "data-table")}-rows`,
            widthMode: "fill",
            gap:
              typeof node.rowsGap === "number" && Number.isFinite(node.rowsGap)
                ? node.rowsGap
                : pattern?.defaults?.rowsGap || 10,
            children: rowChildren.flatMap((row, index) => [
              {
                ...row,
                fill:
                  Array.isArray(node.rowFills) &&
                  typeof node.rowFills[index] === "string" &&
                  node.rowFills[index].trim()
                    ? node.rowFills[index].trim()
                    : undefined,
                padding:
                  Array.isArray(node.rowFills) &&
                  typeof node.rowFills[index] === "string" &&
                  node.rowFills[index].trim()
                    ? { x: 10, y: 8 }
                    : 0,
                radius:
                  Array.isArray(node.rowFills) &&
                  typeof node.rowFills[index] === "string" &&
                  node.rowFills[index].trim()
                    ? 10
                    : undefined
              },
              (typeof node.showRowDividers === "boolean"
                ? node.showRowDividers
                : pattern?.defaults?.showRowDividers) !== false &&
              index < rowChildren.length - 1
                ? {
                    helper: "divider",
                    name: `${normalizeName(node.name, "data-table")}-row-divider-${index + 1}`
                  }
                : null
            ].filter(Boolean))
          }
        ].filter(Boolean)
      },
      depth
    );
  }

  if (helper === "divider") {
    return normalizeNodeTree(
      {
        helper: "card",
        name: normalizeName(node.name, "divider"),
        widthMode: normalizeMode(node.widthMode, "fill"),
        heightMode: "fixed",
        width:
          typeof node.width === "number" && Number.isFinite(node.width)
            ? node.width
            : 100,
        height:
          typeof node.height === "number" && Number.isFinite(node.height)
            ? node.height
            : 1,
        padding: 0,
        gap: 0,
        radius: 0,
        fill: normalizeColor(node.fill, "#ECEEF5")
      },
      depth
    );
  }

  if (helper === "workspace-switcher") {
    const label =
      typeof node.label === "string" && node.label.trim()
        ? node.label.trim()
        : "Workspace";
    const badge =
      typeof node.badge === "string" && node.badge.trim() ? node.badge.trim() : "";

    return normalizeNodeTree(
      {
        helper: "card",
        name: normalizeName(node.name, "workspace-switcher"),
        widthMode: normalizeMode(node.widthMode, "fill"),
        heightMode: "hug",
        padding: node.padding || { x: 10, y: 10 },
        gap: 10,
        radius:
          typeof node.radius === "number" && Number.isFinite(node.radius)
            ? node.radius
            : 12,
        fill: normalizeColor(node.fill, "#FFFFFF"),
        children: [
          {
            helper: "row",
            name: `${normalizeName(node.name, "workspace-switcher")}-content`,
            widthMode: "fill",
            heightMode: "hug",
            align: "center",
            justify: "space-between",
            gap: 10,
            children: [
              {
                helper: "row",
                name: `${normalizeName(node.name, "workspace-switcher")}-left`,
                widthMode: "hug",
                heightMode: "hug",
                align: "center",
                gap: 8,
                children: [
                  {
                    helper: "card",
                    name: `${normalizeName(node.name, "workspace-switcher")}-icon`,
                    widthMode: "fixed",
                    heightMode: "fixed",
                    width: 20,
                    height: 20,
                    padding: 0,
                    gap: 0,
                    radius: 6,
                    fill: normalizeColor(node.iconFill, "#2D6BFF")
                  },
                  {
                    helper: "text",
                    name: `${normalizeName(node.name, "workspace-switcher")}-label`,
                    characters: label,
                    role: "meta",
                    fontSize: 13
                  },
                  badge
                    ? {
                        helper: "status-chip",
                        name: `${normalizeName(node.name, "workspace-switcher")}-badge`,
                        label: badge,
                        tone: "low",
                        padding: { x: 6, y: 2 }
                      }
                    : null
                ].filter(Boolean)
              },
              {
                helper: "text",
                name: `${normalizeName(node.name, "workspace-switcher")}-chevron`,
                characters: "⌄",
                role: "meta",
                fontSize: 12,
                fill: "#69707D"
              }
            ]
          }
        ]
      },
      depth
    );
  }

  if (helper === "profile-summary") {
    const title =
      typeof node.title === "string" && node.title.trim() ? node.title.trim() : "User";
    const subtitle =
      typeof node.subtitle === "string" && node.subtitle.trim()
        ? node.subtitle.trim()
        : "";
    const initials =
      typeof node.initials === "string" && node.initials.trim()
        ? node.initials.trim()
        : "DR";

    return normalizeNodeTree(
      {
        helper: "row",
        name: normalizeName(node.name, "profile-summary"),
        widthMode: normalizeMode(node.widthMode, "fill"),
        heightMode: "hug",
        gap: 10,
        align: "center",
        justify: "space-between",
        children: [
          {
            helper: "row",
            name: `${normalizeName(node.name, "profile-summary")}-left`,
            widthMode: "hug",
            heightMode: "hug",
            gap: 10,
            align: "center",
            children: [
              {
                helper: "card",
                name: `${normalizeName(node.name, "profile-summary")}-avatar`,
                widthMode: "fixed",
                heightMode: "fixed",
                width: 28,
                height: 28,
                padding: 0,
                gap: 0,
                radius: 14,
                fill: normalizeColor(node.avatarFill, "#E7EAF4")
              },
              {
                helper: "text",
                name: `${normalizeName(node.name, "profile-summary")}-avatar-copy`,
                characters: initials,
                role: "meta",
                fontSize: 11,
                fill: "#69707D"
              },
              {
                helper: "column",
                name: `${normalizeName(node.name, "profile-summary")}-copy`,
                widthMode: "hug",
                heightMode: "hug",
                gap: 2,
                children: [
                  {
                    helper: "text",
                    name: `${normalizeName(node.name, "profile-summary")}-title`,
                    characters: title,
                    role: "meta",
                    fontSize: 13,
                    fill: "#1A1D26"
                  },
                  subtitle
                    ? {
                        helper: "text",
                        name: `${normalizeName(node.name, "profile-summary")}-subtitle`,
                        characters: subtitle,
                        role: "meta",
                        fontSize: 11,
                        fill: "#8C91A1"
                      }
                    : null
                ].filter(Boolean)
              }
            ]
          },
          {
            helper: "text",
            name: `${normalizeName(node.name, "profile-summary")}-chevron`,
            characters: "⌄",
            role: "meta",
            fontSize: 12,
            fill: "#69707D"
          }
        ]
      },
      depth
    );
  }

  if (helper === "browser-chrome") {
    const pattern = resolvePattern("browser-chrome");
    const domain =
      typeof node.domain === "string" && node.domain.trim()
        ? node.domain.trim()
        : "skillsphere.com";
    const rightItems = Array.isArray(node.rightItems) ? node.rightItems : ["◔", "⇪", "+", "⧉"];

    return normalizeNodeTree(
      {
        helper: "toolbar",
        name: normalizeName(node.name, "browser-chrome"),
        widthMode: normalizeMode(node.widthMode, pattern?.defaults?.widthMode || "fill"),
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap)
            ? node.gap
            : pattern?.defaults?.gap || 14,
        padding: node.padding || pattern?.defaults?.padding || { x: 14, y: 10 },
        leftItems: [
          { helper: "text", name: `${normalizeName(node.name, "browser-chrome")}-traffic`, characters: "● ● ●", role: "meta", fontSize: 11, fill: pattern?.tokens?.trafficText || "#B6B8C3" },
          { helper: "text", name: `${normalizeName(node.name, "browser-chrome")}-nav`, characters: "‹ ›", role: "meta", fontSize: 14, fill: pattern?.tokens?.mutedText || "#69707D" }
        ],
        rightItems: [
          {
            helper: "card",
            name: `${normalizeName(node.name, "browser-chrome")}-address`,
            widthMode: "fill",
            heightMode: "hug",
            padding: { x: 12, y: 6 },
            gap: 8,
            radius: 10,
            fill: normalizeColor(node.addressFill, pattern?.tokens?.addressFill || "#F5F6FA"),
            children: [
              { helper: "text", name: `${normalizeName(node.name, "browser-chrome")}-lock`, characters: "◉", role: "meta", fontSize: 11, fill: pattern?.tokens?.mutedText || "#69707D" },
              { helper: "text", name: `${normalizeName(node.name, "browser-chrome")}-domain`, characters: domain, role: "meta", fontSize: 12, fill: pattern?.tokens?.mutedText || "#69707D", widthMode: "hug" }
            ]
          },
          {
            helper: "row",
            name: `${normalizeName(node.name, "browser-chrome")}-actions`,
            widthMode: "hug",
            heightMode: "hug",
            gap: pattern?.defaults?.actionsGap || 10,
            align: "center",
            justify: "min",
            children: rightItems.map((item, index) => ({
              helper: "text",
              name: `${normalizeName(node.name, "browser-chrome")}-action-${index + 1}`,
              characters: typeof item === "string" ? item : String(item?.label ?? ""),
              role: "meta",
              fontSize: 12,
              fill: pattern?.tokens?.mutedText || "#69707D"
            }))
          }
        ]
      },
      depth
    );
  }

  if (helper === "app-shell") {
    const pattern = resolvePattern("app-shell", {
      variant:
        typeof node.preset === "string" && node.preset.trim()
          ? node.preset.trim().toLowerCase()
          : undefined
    });
    const preset =
      typeof node.preset === "string" && node.preset.trim()
        ? node.preset.trim().toLowerCase()
        : null;
    const workspaceGap =
      typeof node.workspaceGap === "number" && Number.isFinite(node.workspaceGap)
        ? node.workspaceGap
        : pattern?.defaults?.workspaceGap || (preset === "desktop-dashboard" ? 20 : 16);
    const mainGap =
      typeof node.mainGap === "number" && Number.isFinite(node.mainGap)
        ? node.mainGap
        : pattern?.defaults?.mainGap || (preset === "desktop-dashboard" ? 16 : 14);
    return normalizeNodeTree(
      {
        helper: "column",
        name: normalizeName(node.name, "app-shell"),
        widthMode: normalizeMode(node.widthMode, pattern?.defaults?.widthMode || "fill"),
        heightMode: normalizeMode(node.heightMode, pattern?.defaults?.heightMode || "hug"),
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap)
            ? node.gap
            : pattern?.defaults?.gap || 16,
        padding: node.padding || pattern?.defaults?.padding || 0,
        children: [
          node.browser
            ? {
                helper: "browser-chrome",
                name: `${normalizeName(node.name, "app-shell")}-browser`,
                ...node.browser
              }
            : null,
          {
            helper: "row",
            name: `${normalizeName(node.name, "app-shell")}-workspace`,
            widthMode: "fill",
            heightMode: "hug",
            gap: workspaceGap,
            children: [
              node.sidebar
                ? {
                    helper: "card",
                    name: `${normalizeName(node.name, "app-shell")}-sidebar`,
                    widthMode:
                      typeof node.sidebar.widthMode === "string"
                        ? node.sidebar.widthMode
                        : "fixed",
                    width:
                      typeof node.sidebar.width === "number" && Number.isFinite(node.sidebar.width)
                        ? node.sidebar.width
                        : pattern?.defaults?.sidebarWidth || 248,
                    heightMode: "hug",
                    padding: node.sidebar.padding || pattern?.defaults?.sidebarPadding || 12,
                    gap:
                      typeof node.sidebar.gap === "number"
                        ? node.sidebar.gap
                        : pattern?.defaults?.sidebarGap || 16,
                    radius:
                      typeof node.sidebar.radius === "number"
                        ? node.sidebar.radius
                        : pattern?.defaults?.sidebarRadius || 16,
                    fill: normalizeColor(node.sidebar.fill, "#FFFFFF"),
                    children: [
                      {
                        helper: "sidebar-nav",
                        name: `${normalizeName(node.name, "app-shell")}-sidebar-nav`,
                        ...node.sidebar
                      }
                    ]
                  }
                : null,
              {
                helper: "column",
                name: `${normalizeName(node.name, "app-shell")}-main`,
                widthMode: "fill",
                heightMode: "hug",
                gap: mainGap,
                children: normalizeChildren(node.mainChildren)
              }
            ].filter(Boolean)
          }
        ].filter(Boolean)
      },
      depth
    );
  }

  if (helper === "dashboard-board") {
    const pattern = resolvePattern("dashboard-board");
    const boardTitle =
      typeof node.title === "string" && node.title.trim()
        ? node.title.trim()
        : pattern?.defaults?.title || "Projects";
    const tabs = Array.isArray(node.tabs) ? node.tabs : [];
    const sections = Array.isArray(node.sections) ? node.sections : [];
    const topbarRightItems = Array.isArray(node.topbarRightItems)
      ? node.topbarRightItems
      : [{ helper: "status-chip", name: `${normalizeName(node.name, "dashboard-board")}-share`, label: "Share", tone: "normal" }];

    return normalizeNodeTree(
      {
        helper: "app-shell",
        name: normalizeName(node.name, "dashboard-board"),
        preset: pattern?.defaults?.preset || "desktop-dashboard",
        browser:
          node.browser && typeof node.browser === "object"
            ? node.browser
            : {
                domain:
                  typeof node.domain === "string" && node.domain.trim()
                    ? node.domain.trim()
                    : pattern?.defaults?.domain || "skillsphere.com"
              },
        sidebar:
          node.sidebar && typeof node.sidebar === "object"
            ? node.sidebar
            : {
                width: pattern?.defaults?.sidebarWidth || 220,
                workspace: { label: "Keitoto Studio", badge: "Pro" },
                sections: [
                  {
                    title: "Projects",
                    actions: ["+", "⋯"],
                    items: [
                      { icon: "☰", label: "Dashboard", active: true },
                      { icon: "☰", label: "Inbox" },
                      { icon: "☰", label: "Teams" }
                    ]
                  }
                ],
                footerItems: [
                  { icon: "⚙", label: "Settings" },
                  { icon: "?", label: "Help Center" }
                ],
                profile: { title: "Darlene Robertson", subtitle: "darlene@gmail.com", initials: "DR" }
              },
        mainChildren: [
          {
            helper: "toolbar",
            name: `${normalizeName(node.name, "dashboard-board")}-toolbar`,
            title: boardTitle,
            rightItems: topbarRightItems
          },
          ...(tabs.length
            ? [
                {
                  helper: "tabbar",
                  name: `${normalizeName(node.name, "dashboard-board")}-tabs`,
                  tabs,
                  activeIndex:
                    typeof node.activeTabIndex === "number" && Number.isFinite(node.activeTabIndex)
                      ? node.activeTabIndex
                      : 0
                }
              ]
            : []),
          ...sections
        ]
      },
      depth
    );
  }

  if (helper === "sidebar-nav") {
    const pattern = resolvePattern("sidebar-nav");
    const sections = Array.isArray(node.sections) ? node.sections : [];
    const navChildren = [];

    if (node.workspace) {
      navChildren.push({
        helper: "workspace-switcher",
        name: `${normalizeName(node.name, "sidebar-nav")}-workspace`,
        ...node.workspace
      });
    }

    const sectionNodes = sections.flatMap((section, sectionIndex) => {
      const normalizedSection = section && typeof section === "object" ? section : {};
      const items = Array.isArray(normalizedSection.items) ? normalizedSection.items : [];
      const sectionChildren = [];

      if (typeof normalizedSection.title === "string" && normalizedSection.title.trim()) {
        sectionChildren.push({
          helper: "toolbar",
          name: `${normalizeName(node.name, "sidebar-nav")}-section-${sectionIndex + 1}-header`,
          title: normalizedSection.title.trim(),
          titleRole: "meta",
          titleFontSize: 12,
          rightItems: Array.isArray(normalizedSection.actions)
            ? normalizedSection.actions.map((action, actionIndex) => ({
                helper: "text",
                name: `${normalizeName(node.name, "sidebar-nav")}-section-${sectionIndex + 1}-action-${actionIndex + 1}`,
                characters: typeof action === "string" ? action : String(action?.label ?? ""),
                role: "meta",
                fontSize: 12,
                fill: "#69707D"
              }))
            : []
        });
      }

      sectionChildren.push({
        helper: "list",
        name: `${normalizeName(node.name, "sidebar-nav")}-section-${sectionIndex + 1}-list`,
        widthMode: "fill",
        gap:
          typeof normalizedSection.gap === "number" && Number.isFinite(normalizedSection.gap)
            ? normalizedSection.gap
            : pattern?.defaults?.sectionGap || 8,
        children: items.map((item, itemIndex) => {
          const normalizedItem = item && typeof item === "object" ? item : { label: String(item || "") };
          return {
            helper: "card",
            name:
              normalizedItem.name ||
              `${normalizeName(node.name, "sidebar-nav")}-item-${sectionIndex + 1}-${itemIndex + 1}`,
            widthMode: "fill",
            heightMode: "hug",
            padding: normalizedItem.padding || pattern?.defaults?.itemPadding || { x: 10, y: 8 },
            gap: pattern?.defaults?.itemGap || 8,
            radius:
              typeof normalizedItem.radius === "number"
                ? normalizedItem.radius
                : pattern?.defaults?.itemRadius || 10,
            fill: normalizeColor(
              normalizedItem.fill,
              normalizedItem.active
                ? pattern?.tokens?.activeFill || "#F5F6FA"
                : pattern?.tokens?.idleFill || "#FFFFFF"
            ),
            children: [
              normalizedItem.icon
                ? {
                    helper: "text",
                    name: `${normalizeName(node.name, "sidebar-nav")}-item-icon-${sectionIndex + 1}-${itemIndex + 1}`,
                    characters: normalizedItem.icon,
                    role: "meta",
                    fontSize: 12,
                    fill: normalizedItem.active
                      ? pattern?.tokens?.activeText || "#1A1D26"
                      : pattern?.tokens?.idleText || "#69707D"
                  }
                : null,
              {
                helper: "text",
                name: `${normalizeName(node.name, "sidebar-nav")}-item-label-${sectionIndex + 1}-${itemIndex + 1}`,
                characters:
                  typeof normalizedItem.label === "string" && normalizedItem.label.trim()
                    ? normalizedItem.label.trim()
                    : `Item ${itemIndex + 1}`,
                role: normalizedItem.active ? "body-strong" : "meta",
                fontSize: 13,
                fill:
                  normalizedItem.active
                    ? pattern?.tokens?.activeText || "#1A1D26"
                    : pattern?.tokens?.idleText || "#69707D",
                widthMode: "fill"
              },
              normalizedItem.trailing
                ? {
                    helper: "text",
                    name: `${normalizeName(node.name, "sidebar-nav")}-item-trailing-${sectionIndex + 1}-${itemIndex + 1}`,
                    characters: normalizedItem.trailing,
                    role: "meta",
                    fontSize: 12,
                    fill: pattern?.tokens?.trailingText || "#B0B5C3"
                  }
                : null
            ].filter(Boolean)
          };
        })
      });

      return sectionChildren;
    });

    navChildren.push(...sectionNodes);

    if (Array.isArray(node.footerItems) && node.footerItems.length) {
      navChildren.push({
        helper: "list",
        name: `${normalizeName(node.name, "sidebar-nav")}-footer-items`,
        widthMode: "fill",
        gap: pattern?.defaults?.footerGap || 8,
        children: node.footerItems.map((item, index) => ({
          helper: "card",
          name: `${normalizeName(node.name, "sidebar-nav")}-footer-item-${index + 1}`,
          widthMode: "fill",
          heightMode: "hug",
          padding: pattern?.defaults?.itemPadding || { x: 10, y: 8 },
          gap: pattern?.defaults?.itemGap || 8,
          radius: pattern?.defaults?.itemRadius || 10,
          fill: pattern?.tokens?.idleFill || "#FFFFFF",
          children: [
            item.icon
              ? {
                  helper: "text",
                  name: `${normalizeName(node.name, "sidebar-nav")}-footer-item-icon-${index + 1}`,
                  characters: item.icon,
                  role: "meta",
                  fontSize: 12,
                  fill: pattern?.tokens?.idleText || "#69707D"
                }
              : null,
            {
              helper: "text",
              name: `${normalizeName(node.name, "sidebar-nav")}-footer-item-label-${index + 1}`,
              characters: item.label || `Item ${index + 1}`,
              role: "meta",
              fontSize: 13,
              fill: pattern?.tokens?.idleText || "#69707D",
              widthMode: "fill"
            }
          ].filter(Boolean)
        }))
      });
    }

    if (node.profile) {
      navChildren.push({
        helper: "divider",
        name: `${normalizeName(node.name, "sidebar-nav")}-footer-divider`
      });
      navChildren.push({
        helper: "profile-summary",
        name: `${normalizeName(node.name, "sidebar-nav")}-profile`,
        ...node.profile
      });
    }

    return normalizeNodeTree(
      {
        helper: "column",
        name: normalizeName(node.name, "sidebar-nav"),
        widthMode: normalizeMode(node.widthMode, pattern?.defaults?.widthMode || "fill"),
        heightMode: "hug",
        gap:
          typeof node.gap === "number" && Number.isFinite(node.gap)
            ? node.gap
            : pattern?.defaults?.gap || 16,
        children: navChildren
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
