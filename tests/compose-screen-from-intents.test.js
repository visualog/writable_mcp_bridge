import test from "node:test";
import assert from "node:assert/strict";

import { buildComposeScreenFromIntentsPlan } from "../src/compose-screen-from-intents.js";

test("buildComposeScreenFromIntentsPlan builds a build-layout-ready tree from intents", () => {
  const plan = buildComposeScreenFromIntentsPlan({
    parentId: "33023:62",
    name: "intent-dashboard",
    sections: [
      { intent: "screen/topbar", title: "Projects" },
      { intent: "data/table", columns: ["Task"], rows: [["Wireframe"]] }
    ]
  });

  assert.equal(plan.parentId, "33023:62");
  assert.equal(plan.tree.helper, "screen");
  assert.equal(plan.tree.children[0].helper, "toolbar");
  assert.equal(plan.tree.children[1].helper, "data-table");
  assert.equal(plan.composition[0].status, "exact-swap");
});

test("buildComposeScreenFromIntentsPlan preserves direct dashboard roots", () => {
  const plan = buildComposeScreenFromIntentsPlan({
    parentId: "33023:62",
    sections: [{ intent: "screen/dashboard", title: "AutomatePro" }]
  });

  assert.equal(plan.tree.helper, "dashboard-board");
  assert.equal(plan.composition[0].helper, "dashboard-board");
});

test("buildComposeScreenFromIntentsPlan requires parentId and sections", () => {
  assert.throws(() => buildComposeScreenFromIntentsPlan({ sections: [] }), /parentId is required/);
  assert.throws(
    () => buildComposeScreenFromIntentsPlan({ parentId: "33023:62" }),
    /sections must include at least one intent entry/
  );
});

test("buildComposeScreenFromIntentsPlan can derive sections from referenceAnalysis", () => {
  const plan = buildComposeScreenFromIntentsPlan({
    parentId: "33023:62",
    referenceAnalysis: {
      sections: [
        { type: "navigation", name: "sidebar", headerTitle: "Workspace" },
        { type: "table", name: "project-list", contentTitle: "Projects", contentBody: "All active work." }
      ]
    }
  });

  assert.equal(plan.sections[0].intent, "screen/sidebar");
  assert.equal(plan.sections[1].intent, "data/table");
  assert.equal(plan.tree.children[0].helper, "sidebar-nav");
  assert.equal(plan.tree.children[1].helper, "data-table");
});

test("buildComposeScreenFromIntentsPlan prefers referenceAnalysis.intentSections when present", () => {
  const plan = buildComposeScreenFromIntentsPlan({
    parentId: "33023:62",
    referenceAnalysis: {
      intentSections: [
        { intent: "screen/topbar", title: "Injected topbar" },
        { intent: "screen/actions", title: "Actions" }
      ],
      sections: [
        { type: "navigation", name: "sidebar", headerTitle: "Workspace" }
      ]
    }
  });

  assert.equal(plan.sections.length, 2);
  assert.equal(plan.sections[0].intent, "screen/topbar");
  assert.equal(plan.tree.children[0].helper, "toolbar");
});

test("buildComposeScreenFromIntentsPlan accepts top-level intentSections", () => {
  const plan = buildComposeScreenFromIntentsPlan({
    parentId: "33023:62",
    intentSections: [{ intent: "screen/topbar", title: "Direct intents" }]
  });

  assert.equal(plan.sections.length, 1);
  assert.equal(plan.sections[0].intent, "screen/topbar");
  assert.equal(plan.tree.children[0].helper, "toolbar");
});
