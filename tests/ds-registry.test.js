import test from "node:test";
import assert from "node:assert/strict";

import { getDsRegistry, getIntentRegistryEntry, getPatternRegistryEntry } from "../src/ds-registry.js";
import { loadDsRegistry } from "../src/ds-registry-loader.js";
import { resolveComponentForPattern } from "../src/resolve-component-for-pattern.js";
import { resolvePattern } from "../src/resolve-pattern.js";

test("getDsRegistry exposes initial helper patterns", () => {
  const registry = getDsRegistry();

  assert.equal(registry.version, 1);
  assert.ok(registry.patterns["status-chip"]);
  assert.ok(registry.patterns["section-block"]);
  assert.ok(registry.patterns["list-block"]);
  assert.ok(registry.patterns.toolbar);
  assert.ok(registry.patterns["progress-bar"]);
  assert.ok(registry.patterns["browser-chrome"]);
  assert.ok(registry.patterns["sidebar-nav"]);
  assert.ok(registry.patterns["avatar-stack"]);
  assert.ok(registry.patterns["app-shell"]);
  assert.ok(registry.patterns["dashboard-board"]);
  assert.ok(registry.patterns["data-table"]);
});

test("getPatternRegistryEntry returns pattern entries by id", () => {
  const entry = getPatternRegistryEntry("status-chip");

  assert.equal(entry.helper, "status-chip");
  assert.equal(entry.defaults.gap, 6);
});

test("getIntentRegistryEntry returns pattern mapping for semantic intents", () => {
  const entry = getIntentRegistryEntry("screen/topbar");

  assert.equal(entry.pattern, "toolbar");
});

test("getIntentRegistryEntry returns generic content section mappings", () => {
  assert.equal(getIntentRegistryEntry("content/section").pattern, "section-block");
  assert.equal(getIntentRegistryEntry("content/list").pattern, "list-block");
});

test("resolvePattern merges status-chip urgent variant tokens", () => {
  const resolved = resolvePattern("status-chip", { tone: "urgent" });

  assert.equal(resolved.tokens.fill, "#FFF1F1");
  assert.equal(resolved.tokens.text, "#EB5757");
  assert.equal(resolved.defaults.radius, 8);
});

test("resolvePattern merges data-table compact defaults", () => {
  const resolved = resolvePattern("data-table", { density: "compact" });

  assert.equal(resolved.defaults.rowGap, 8);
  assert.equal(resolved.defaults.rowsGap, 8);
  assert.equal(resolved.defaults.showRowDividers, true);
});

test("loadDsRegistry merges external pattern overrides", () => {
  const loaded = loadDsRegistry({
    patterns: {
      toolbar: {
        defaults: {
          gap: 20
        }
      }
    }
  });

  assert.equal(loaded.patterns.toolbar.defaults.gap, 20);
  assert.equal(loaded.patterns["status-chip"].defaults.gap, 6);
});

test("resolveComponentForPattern resolves helper from intent and variant inputs", () => {
  const resolved = resolveComponentForPattern({
    intent: "status/priority",
    tone: "urgent"
  });

  assert.equal(resolved.pattern, "status-chip");
  assert.equal(resolved.helper, "status-chip");
  assert.equal(resolved.componentCandidate.componentKey, "feedback/status_chip");
  assert.equal(resolved.componentCandidate.variant, "urgent");
  assert.equal(resolved.resolvedPattern.tokens.fill, "#FFF1F1");
});

test("resolveComponentForPattern prefers explicit pattern over intent", () => {
  const resolved = resolveComponentForPattern({
    intent: "screen/topbar",
    pattern: "browser-chrome"
  });

  assert.equal(resolved.pattern, "browser-chrome");
  assert.equal(resolved.helper, "browser-chrome");
  assert.equal(resolved.componentCandidate.componentKey, "shell/browser_chrome");
});
