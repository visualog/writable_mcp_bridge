import test from "node:test";
import assert from "node:assert/strict";

import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";
import {
  createPluginLocalHandoffPayload,
  validatePluginLocalHandoffPayload
} from "../src/plugin-handoff-contract.js";

test("createPluginLocalHandoffPayload builds minimum payload from plugin and figma context", () => {
  const intentEnvelope = createDesignerIntentEnvelope({
    input: "이 선택 화면을 React 섹션으로 구현해줘",
    figmaContext: {
      pageId: "12:45",
      pageName: "Landing",
      selection: [{ id: "144:900", name: "Hero / Default" }]
    },
    mode: "handoff"
  });

  const payload = createPluginLocalHandoffPayload({
    pluginContext: {
      pluginSessionId: "plugin_abc123",
      figmaFileKey: "ABCD1234",
      figmaFileName: "Marketing Site",
      pageId: "12:45",
      pageName: "Landing"
    },
    figmaContext: {
      pageName: "Landing",
      selection: [{ id: "144:900", name: "Hero / Default" }],
      libraryHints: ["Button"],
      tokenHints: ["space.24"]
    },
    intentEnvelope
  });

  assert.equal(payload.version, "0.1");
  assert.equal(payload.source.figmaFileName, "Marketing Site");
  assert.equal(payload.intent.targets[0].nodeId, "144:900");
  assert.equal(payload.figmaContext.selection.primaryNodeId, "144:900");
});

test("validatePluginLocalHandoffPayload reports missing required fields", () => {
  const result = validatePluginLocalHandoffPayload({});
  assert.equal(result.ok, false);
  assert.equal(result.errors.includes("version is required"), true);
  assert.equal(result.errors.includes("figmaContext is required"), true);
});
