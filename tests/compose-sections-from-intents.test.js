import test from "node:test";
import assert from "node:assert/strict";

import { composeSectionsFromIntents } from "../src/compose-sections-from-intents.js";

test("composeSectionsFromIntents builds a screen stack from semantic section intents", () => {
  const composed = composeSectionsFromIntents({
    name: "crm-home",
    width: 1440,
    height: 1024,
    sections: [
      {
        key: "topbar",
        intent: "screen/topbar",
        title: "Projects"
      },
      {
        key: "sidebar",
        intent: "screen/sidebar",
        title: "Workspace",
        sections: [{ title: "Favorites", items: [{ label: "Dashboard" }] }]
      },
      {
        key: "project-table",
        intent: "data/table",
        density: "compact",
        columns: ["Task", "Owner"],
        rows: [["Wireframe", "IR"]]
      }
    ]
  });

  assert.equal(composed.root.helper, "screen");
  assert.equal(composed.root.children.length, 3);
  assert.equal(composed.root.children[0].helper, "toolbar");
  assert.equal(composed.root.children[1].helper, "sidebar-nav");
  assert.equal(composed.root.children[2].helper, "data-table");
  assert.deepEqual(
    composed.composition.map((item) => item.status),
    ["exact-swap", "exact-swap", "compose-from-primitives"]
  );
  assert.equal(composed.composition[0].componentKey, "navigation/topbar");
  assert.equal(composed.composition[1].componentKey, "navigation/sidebar");
  assert.equal(composed.composition[2].componentVariant, "compact");
});

test("composeSectionsFromIntents can return a direct dashboard-board root", () => {
  const composed = composeSectionsFromIntents({
    name: "dashboard-root",
    sections: [
      {
        intent: "screen/dashboard",
        title: "AutomatePro",
        domain: "skillsphere.com",
        sections: [{ title: "In Progress" }]
      }
    ]
  });

  assert.equal(composed.root.helper, "dashboard-board");
  assert.equal(composed.composition[0].status, "compose-from-primitives");
});

test("composeSectionsFromIntents preserves blocked entries for unmapped intents", () => {
  const composed = composeSectionsFromIntents({
    sections: [
      { key: "unknown", intent: "content/hero" }
    ]
  });

  assert.equal(composed.root.helper, "screen");
  assert.equal(composed.root.children.length, 0);
  assert.equal(composed.composition[0].status, "blocked");
});
