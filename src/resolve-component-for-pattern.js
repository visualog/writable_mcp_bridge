import { getIntentRegistryEntry, getPatternRegistryEntry } from "./ds-registry.js";
import { resolvePattern } from "./resolve-pattern.js";

const PATTERN_COMPONENT_CANDIDATES = {
  toolbar: { componentKey: "navigation/topbar", defaultVariant: "default" },
  "browser-chrome": { componentKey: "shell/browser_chrome", defaultVariant: "desktop" },
  "sidebar-nav": { componentKey: "navigation/sidebar", defaultVariant: "default" },
  "data-table": { componentKey: "data/table", defaultVariant: "comfortable" },
  "status-chip": { componentKey: "feedback/status_chip", defaultVariant: "neutral" },
  "progress-bar": { componentKey: "feedback/progress_bar", defaultVariant: "default" },
  "avatar-stack": { componentKey: "identity/avatar_stack", defaultVariant: "default" },
  "section-block": { componentKey: "layout/section", defaultVariant: "default" },
  "list-block": { componentKey: "layout/list_section", defaultVariant: "default" },
  "app-shell": { componentKey: "shell/app_shell", defaultVariant: "desktop-dashboard" },
  "dashboard-board": { componentKey: "shell/dashboard_board", defaultVariant: "default" }
};

function resolveComponentCandidate(patternId, input = {}) {
  const base = PATTERN_COMPONENT_CANDIDATES[patternId];
  if (!base) {
    return null;
  }

  const explicitVariant =
    typeof input.variant === "string" && input.variant.trim()
      ? input.variant.trim()
      : null;
  const toneVariant =
    typeof input.tone === "string" && input.tone.trim() ? input.tone.trim() : null;
  const densityVariant =
    typeof input.density === "string" && input.density.trim()
      ? input.density.trim()
      : null;

  const resolvedVariant =
    explicitVariant || densityVariant || toneVariant || base.defaultVariant;

  return {
    componentKey: base.componentKey,
    variant: resolvedVariant
  };
}

export function resolveComponentForPattern(input = {}) {
  const intentId =
    typeof input.intent === "string" && input.intent.trim()
      ? input.intent.trim()
      : null;
  const explicitPatternId =
    typeof input.pattern === "string" && input.pattern.trim()
      ? input.pattern.trim()
      : null;

  const intentEntry = intentId ? getIntentRegistryEntry(intentId) : null;
  const patternId = explicitPatternId || intentEntry?.pattern || null;

  if (!patternId) {
    return null;
  }

  const registryEntry = getPatternRegistryEntry(patternId);
  if (!registryEntry) {
    return null;
  }

  const resolvedPattern = resolvePattern(patternId, {
    variant: input.variant,
    tone: input.tone,
    density: input.density
  });
  const componentCandidate = resolveComponentCandidate(patternId, input);

  return {
    intent: intentId,
    pattern: patternId,
    helper: registryEntry.helper,
    componentCandidate,
    registryEntry,
    resolvedPattern
  };
}
