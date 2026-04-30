const DESIGNER_READ_ROUTE_VERSION = "1.0";

function normalizeString(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function createPhase(phase, summary, commands = [], options = {}) {
  return {
    phase,
    summary,
    commands,
    required: options.required !== false,
    reason: options.reason || summary
  };
}

function buildFocusedDetailCommands(intentKind, designerContext = {}) {
  const commands = ["get_node_details"];
  const targetType = normalizeString(designerContext?.target?.type);
  const selectionTypes = normalizeArray(designerContext?.fastContext?.selectionTypes).map((value) =>
    normalizeString(value).toUpperCase()
  );
  const focusedDetail = designerContext?.focusedDetail || {};

  if (
    selectionTypes.includes("INSTANCE") ||
    normalizeString(focusedDetail?.sourceComponentName)
  ) {
    commands.unshift("get_instance_details");
  }

  if (
    selectionTypes.includes("COMPONENT") ||
    selectionTypes.includes("COMPONENT_SET") ||
    intentKind === "adapt_variant"
  ) {
    commands.unshift("get_component_variant_details");
  }

  if (intentKind === "revise_copy" || intentKind === "refine_typography") {
    commands.push("list_text_nodes");
  }

  if (intentKind === "revise_copy" || intentKind === "prepare_implementation_handoff") {
    commands.push("get_annotations");
  }

  if (targetType === "current_page" && !selectionTypes.length) {
    commands.push("search_nodes");
  }

  return [...new Set(commands)];
}

function buildAssetLookupCommands(intentKind, designerContext = {}) {
  const commands = ["search_design_system"];
  const hintCounts = designerContext?.assetLookup?.availableHints || {};

  if (intentKind === "align_to_design_system" || intentKind === "swap_or_recommend_component") {
    commands.push("search_file_components");
  }

  if (
    intentKind === "swap_or_recommend_component" ||
    intentKind === "adapt_variant" ||
    (Number(hintCounts.libraryCount) || 0) > 0
  ) {
    commands.push("search_library_assets");
  }

  if (
    intentKind === "swap_or_recommend_component" ||
    intentKind === "align_to_design_system"
  ) {
    commands.push("search_instances");
  }

  if ((Number(hintCounts.tokenCount) || 0) > 0 || intentKind === "align_to_design_system") {
    commands.push("get_variable_defs");
  }

  return [...new Set(commands)];
}

function shouldIncludeFocusedDetail(intentKind, designerContext = {}, contextScope = {}) {
  const explicitKinds = new Set([
    "critique",
    "restructure_layout",
    "improve_hierarchy",
    "adjust_spacing",
    "refine_typography",
    "revise_copy",
    "swap_or_recommend_component",
    "adapt_variant",
    "prepare_implementation_handoff"
  ]);

  if (explicitKinds.has(intentKind)) {
    return true;
  }

  if ((designerContext?.target?.selectionCount || 0) > 0) {
    return true;
  }

  return normalizeString(contextScope?.targetType) === "current_selection";
}

function shouldIncludeAssetLookup(intentKind, designerContext = {}) {
  const explicitKinds = new Set([
    "swap_or_recommend_component",
    "generate_section",
    "generate_screen",
    "adapt_variant",
    "align_to_design_system",
    "prepare_implementation_handoff"
  ]);

  if (explicitKinds.has(intentKind)) {
    return true;
  }

  return Boolean(designerContext?.assetLookup?.shouldLookup);
}

function buildHeadline(intentKind, phases = []) {
  const phaseLabels = phases.map((phase) => phase.phase.replace(/_/g, " "));
  return `${intentKind} -> ${phaseLabels.join(" -> ")}`;
}

export function buildDesignerReadRoute({
  intentKind = "analyze",
  designerContext = {},
  contextScope = {}
} = {}) {
  const phases = [];

  phases.push(
    createPhase(
      "fast_context",
      "Start with the current file, page, selection, and a bounded structure summary.",
      ["get_selection", "get_metadata"],
      {
        reason:
          "Every design-AI turn should begin with a lightweight, selection-first read before escalating."
      }
    )
  );

  if (shouldIncludeFocusedDetail(intentKind, designerContext, contextScope)) {
    phases.push(
      createPhase(
        "focused_detail",
        "Inspect the chosen node or frame more deeply before making precise design judgments.",
        buildFocusedDetailCommands(intentKind, designerContext),
        {
          reason:
            "This request needs structural precision such as layout semantics, instance overrides, component details, or text content."
        }
      )
    );
  }

  if (shouldIncludeAssetLookup(intentKind, designerContext)) {
    phases.push(
      createPhase(
        "asset_lookup",
        "Look up reusable tokens, components, and library assets only after the target is understood.",
        buildAssetLookupCommands(intentKind, designerContext),
        {
          reason:
            "This request benefits from design-system awareness or candidate reusable assets."
        }
      )
    );
  }

  if (intentKind === "generate_section" || intentKind === "generate_screen") {
    phases.push(
      createPhase(
        "optional_snapshot",
        "Take a compact subtree snapshot only if the AI needs a denser structural reference.",
        ["snapshot_selection"],
        {
          required: false,
          reason:
            "Snapshots are useful for deeper reasoning, but they should stay optional to preserve responsiveness."
        }
      )
    );
  }

  return {
    version: DESIGNER_READ_ROUTE_VERSION,
    intentKind,
    headline: buildHeadline(intentKind, phases),
    primaryPhase: phases[0]?.phase || "fast_context",
    phases,
    commands: [...new Set(phases.flatMap((phase) => phase.commands))],
    largeFileSafe: true,
    doNotFullScanByDefault: true,
    rationale:
      "Route reads from fast context to deeper detail and then outward to assets, rather than accumulating every possible read up front."
  };
}

export { DESIGNER_READ_ROUTE_VERSION };
