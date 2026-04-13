import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildNodeDetailsPlan,
  buildComponentVariantDetailsPlan,
  buildInstanceDetailsPlan
} from "../src/read-node-details.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const feedbackDir = path.resolve(__dirname, "../feedback");
const docsDir = path.resolve(__dirname, "../docs/authoring");
const scriptsDir = path.resolve(__dirname, "../scripts");

const acceptanceChecklistPath = path.join(
  feedbackDir,
  "2026-04-13-toolbar-acceptance-checklist.md"
);

const troubleshootingPath = path.join(
  docsDir,
  "search-nodes-troubleshooting.md"
);

const acceptanceScriptPath = path.join(
  scriptsDir,
  "acceptance-implementation-read-flow.sh"
);

const nodeDetailsFixture = {
  node: {
    id: "33011:2910",
    name: "pattern/toolbar",
    type: "FRAME",
    visible: true,
    layout: {
      layoutMode: "HORIZONTAL",
      itemSpacing: 8,
      paddingTop: 12,
      paddingRight: 16,
      paddingBottom: 12,
      paddingLeft: 16
    },
    children: [
      { id: "a", name: "Button/Primary", type: "INSTANCE", visible: true },
      { id: "b", name: "Spacer/Divider", type: "RECTANGLE", width: 12, visible: true },
      { id: "c", name: "Divider/Main", type: "LINE", visible: true },
      { id: "d", name: "Spacer/Divider", type: "RECTANGLE", width: 12, visible: true },
      { id: "e", name: "Button/Secondary", type: "INSTANCE", visible: true }
    ]
  }
};

const componentVariantDetailsFixture = {
  componentSet: {
    id: "1:43",
    name: "pattern/toolbar",
    type: "COMPONENT_SET",
    variantPropertyDefinitions: [{ name: "State", type: "VARIANT", variantOptions: ["default", "status", "badge", "dot"] }]
  },
  variants: [
    {
      id: "1:44",
      name: "State=default",
      visibleChildren: [{ name: "Title", type: "TEXT" }, { name: "Divider/Main", type: "LINE" }]
    },
    {
      id: "1:45",
      name: "State=status",
      visibleChildren: [{ name: "Title", type: "TEXT" }, { name: "Status/Text", type: "TEXT" }]
    },
    {
      id: "1:46",
      name: "State=badge",
      visibleChildren: [{ name: "Title", type: "TEXT" }, { name: "Badge/Count", type: "INSTANCE" }]
    },
    {
      id: "1:47",
      name: "State=dot",
      visibleChildren: [{ name: "Title", type: "TEXT" }, { name: "Dot/Unread", type: "ELLIPSE" }]
    }
  ]
};

const instanceDetailsFixture = {
  sourceComponent: {
    id: "1:44",
    name: "pattern/toolbar/State=default",
    type: "COMPONENT"
  },
  variantProperties: {
    State: "badge"
  },
  componentProperties: {
    "Status/Text#characters": { type: "TEXT", value: "23 alerts" },
    "Badge/Visible#boolean": { type: "BOOLEAN", value: true }
  }
};

function extractToolbarAcceptanceAnswers(fixtures) {
  const toolbar = fixtures.nodeDetails.node;
  const variants = fixtures.componentVariants.variants;
  const instance = fixtures.instanceDetails;

  const dividerSpacers = (toolbar.children || [])
    .filter((child) => child.name === "Spacer/Divider" && typeof child.width === "number")
    .map((child) => child.width);
  const gapButtonsAndDividers =
    dividerSpacers.length > 0 ? Math.max(...dividerSpacers) : null;

  const visibleChildrenByVariant = variants.map((variant) => ({
    variant: variant.name,
    visibleChildren: (variant.visibleChildren || []).map((child) => child.name)
  }));

  const variantsWithStatusText = visibleChildrenByVariant
    .filter((item) => item.visibleChildren.some((name) => /status\/text/i.test(name)))
    .map((item) => item.variant);

  const variantsWithBadgeOrDot = visibleChildrenByVariant
    .filter((item) => item.visibleChildren.some((name) => /(badge|dot)\//i.test(name)))
    .map((item) => item.variant);

  return {
    rootAutoLayoutDirection: toolbar.layout?.layoutMode || null,
    rootPadding: {
      top: toolbar.layout?.paddingTop ?? null,
      right: toolbar.layout?.paddingRight ?? null,
      bottom: toolbar.layout?.paddingBottom ?? null,
      left: toolbar.layout?.paddingLeft ?? null
    },
    gapBetweenButtons: toolbar.layout?.itemSpacing ?? null,
    gapBetweenButtonsAndDividers: gapButtonsAndDividers,
    variants: variants.map((variant) => variant.name),
    visibleChildrenByVariant,
    variantsWithStatusText,
    variantsWithBadgeOrDot,
    instanceOverridesByVariant: {
      sourceComponent: instance.sourceComponent?.name || null,
      variantProperties: instance.variantProperties || {},
      componentProperties: Object.keys(instance.componentProperties || {})
    }
  };
}

test("read detail plans accept both targetNodeId and nodeId alias across all implementation endpoints", () => {
  const fromTargetNodeId = {
    node: buildNodeDetailsPlan({ targetNodeId: "10:1", detailLevel: "full", includeChildren: true }),
    variant: buildComponentVariantDetailsPlan({ targetNodeId: "10:2", includeChildren: true }),
    instance: buildInstanceDetailsPlan({
      targetNodeId: "10:3",
      includeResolvedChildren: true,
      maxDepth: 2
    })
  };

  const fromNodeIdAlias = {
    node: buildNodeDetailsPlan({ nodeId: "10:1", detailLevel: "full", includeChildren: true }),
    variant: buildComponentVariantDetailsPlan({ nodeId: "10:2", includeChildren: true }),
    instance: buildInstanceDetailsPlan({
      nodeId: "10:3",
      includeResolvedChildren: true,
      maxDepth: 2
    })
  };

  assert.deepEqual(fromNodeIdAlias.node, fromTargetNodeId.node);
  assert.deepEqual(fromNodeIdAlias.variant, fromTargetNodeId.variant);
  assert.deepEqual(fromNodeIdAlias.instance, fromTargetNodeId.instance);
});

test("real-node style fixtures answer toolbar implementation questions without coordinate inference", () => {
  const answers = extractToolbarAcceptanceAnswers({
    nodeDetails: structuredClone(nodeDetailsFixture),
    componentVariants: structuredClone(componentVariantDetailsFixture),
    instanceDetails: structuredClone(instanceDetailsFixture)
  });

  assert.equal(answers.rootAutoLayoutDirection, "HORIZONTAL");
  assert.deepEqual(answers.rootPadding, { top: 12, right: 16, bottom: 12, left: 16 });
  assert.equal(answers.gapBetweenButtons, 8);
  assert.equal(answers.gapBetweenButtonsAndDividers, 12);
  assert.deepEqual(answers.variants, ["State=default", "State=status", "State=badge", "State=dot"]);
  assert.deepEqual(answers.variantsWithStatusText, ["State=status"]);
  assert.deepEqual(answers.variantsWithBadgeOrDot, ["State=badge", "State=dot"]);
  assert.deepEqual(answers.instanceOverridesByVariant.variantProperties, { State: "badge" });
  assert.deepEqual(answers.instanceOverridesByVariant.componentProperties, [
    "Status/Text#characters",
    "Badge/Visible#boolean"
  ]);
});

test("toolbar acceptance checklist asks nine questions without coordinate inference", async () => {
  const text = await readFile(acceptanceChecklistPath, "utf8");

  assert.match(text, /without coordinate inference/i);
  assert.match(text, /pattern\/toolbar/i);
  assert.match(text, /\/api\/get-node-details/i);
  assert.match(text, /\/api\/get-component-variant-details/i);
  assert.match(text, /\/api\/get-instance-details/i);
  assert.match(text, /\"targetNodeId\"/);
  assert.match(text, /\"nodeId\"/);
  assert.match(text, /Failure Diagnostics/i);
  assert.match(text, /old process alive/i);
  assert.match(text, /wrong pluginId/i);
  assert.match(text, /node missing/i);

  const questionsSectionMatch = text.match(/## Questions([\s\S]*?)## Evidence Format/i);
  assert.ok(questionsSectionMatch);
  const questions = questionsSectionMatch[1].match(/^\d+\.\s.+$/gm) ?? [];
  assert.equal(questions.length, 9);
  assert.match(text, /What is the root auto-layout direction\?/);
  assert.match(text, /Which variants contain status text\?/);
  assert.match(text, /Which instance properties or overrides differ by variant\?/);
});

test("search_nodes troubleshooting doc documents an operational decision tree", async () => {
  const text = await readFile(troubleshootingPath, "utf8");

  assert.match(text, /Decision Tree/i);
  assert.match(text, /no active plugin session/i);
  assert.match(text, /narrow the query/i);
  assert.match(text, /lower the detail level/i);
  assert.match(text, /escalate/i);
});

test("acceptance helper script includes executable curl flow and mismatch diagnostics", async () => {
  const scriptText = await readFile(acceptanceScriptPath, "utf8");
  assert.match(scriptText, /\/api\/get-node-details/);
  assert.match(scriptText, /\/api\/get-component-variant-details/);
  assert.match(scriptText, /\/api\/get-instance-details/);
  assert.match(scriptText, /targetNodeId/);
  assert.match(scriptText, /nodeId/);
  assert.match(scriptText, /old process alive/i);
  assert.match(scriptText, /wrong pluginId/i);
  assert.match(scriptText, /node missing/i);
});
