import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDesignerContextModel,
  buildDesignerContextModelFromExecution,
  buildDesignerContextSummary
} from "../src/ai-designer-context.js";
import { createDesignerIntentEnvelope } from "../src/ai-designer-intents.js";

test("buildDesignerContextSummary uses selection-first strategy and detail follow-up", () => {
  const summary = buildDesignerContextSummary(
    {
      fileName: "Growth Dashboard",
      pageName: "Overview",
      selection: [{ id: "100:1", name: "Hero KPI", type: "FRAME" }],
      selectedNodeDetails: {
        targetNodeId: "100:1",
        detail: {
          node: { id: "100:1", name: "Hero KPI", type: "FRAME" },
          layout: { layoutMode: "VERTICAL", itemSpacing: 24 },
          variantProperties: {},
          componentProperties: {}
        }
      }
    },
    {
      request: "선택한 카드 레이아웃을 재구성해줘"
    }
  );

  assert.equal(summary.target.type, "current_selection");
  assert.equal(summary.readStrategy.scope, "selection_first");
  assert.deepEqual(summary.readStrategy.followUps, ["focused_detail"]);
  assert.equal(summary.focusedDetail.status, "available");
  assert.equal(summary.focusedDetail.layoutMode, "VERTICAL");
});

test("buildDesignerContextSummary adds asset lookup when request mentions design system", () => {
  const summary = buildDesignerContextSummary(
    {
      fileName: "Marketing Site",
      pageName: "Landing",
      componentHints: ["Button / Primary"],
      tokenHints: ["color.brand.primary"]
    },
    {
      request: "이 화면을 디자인 시스템과 컴포넌트 기준으로 정리해줘"
    }
  );

  assert.equal(summary.assetLookup.shouldLookup, true);
  assert.equal(summary.readStrategy.scope, "page_first");
  assert.ok(summary.readStrategy.followUps.includes("asset_lookup"));
  assert.equal(summary.assetLookup.availableHints.componentCount, 1);
  assert.equal(summary.assetLookup.availableHints.tokenCount, 1);
});

test("createDesignerIntentEnvelope includes summarized designer context", () => {
  const envelope = createDesignerIntentEnvelope({
    input: "선택한 화면을 카드형 대시보드로 재구성해줘",
    figmaContext: {
      fileName: "Growth Dashboard",
      pageId: "12:34",
      pageName: "Overview",
      selection: [{ id: "100:1", name: "Summary Frame", type: "FRAME" }]
    },
    mode: "suggest_then_apply"
  });

  assert.equal(envelope.designerContext.target.type, "current_selection");
  assert.equal(envelope.designerContext.fastContext.pageName, "Overview");
  assert.equal(envelope.designerContext.readStrategy.primaryMode, "fast_context");
  assert.ok(envelope.designerContext.headline.includes("선택"));
});

test("buildDesignerContextModel creates a minimal selection-first context model", () => {
  const contextModel = buildDesignerContextModel(
    {
      fileId: "file-1",
      fileName: "Growth Dashboard",
      pageId: "12:34",
      pageName: "Overview",
      selection: [{ id: "100:1", name: "Summary Frame", type: "FRAME" }],
      viewport: { width: 1280, height: 720 },
      platform: "figma"
    },
    {
      capturedAt: "2026-05-13T00:00:00.000Z"
    }
  );

  assert.equal(contextModel.meta.version, "1.0");
  assert.equal(contextModel.meta.fileName, "Growth Dashboard");
  assert.equal(contextModel.target.type, "current_selection");
  assert.equal(contextModel.target.primaryTargetId, "100:1");
  assert.equal(contextModel.selection.items.length, 1);
  assert.equal(contextModel.pageContext.pageName, "Overview");
  assert.equal(contextModel.readMeta.partial, true);
  assert.equal(contextModel.readMeta.coverage.focusedNode.status, "missing");
});

test("buildDesignerContextModelFromExecution aggregates focused detail and design-system data", () => {
  const intentEnvelope = createDesignerIntentEnvelope({
    request: "선택한 버튼을 디자인 시스템 기준으로 정리해줘",
    figmaContext: {
      fileId: "file-1",
      fileName: "Marketing Site",
      pageId: "1:2",
      pageName: "Landing",
      selection: [{ id: "100:1", name: "CTA Button", type: "INSTANCE" }],
      viewport: { width: 1440, height: 900 },
      platform: "figma"
    }
  });

  const execution = {
    executedAt: "2026-05-13T01:23:45.000Z",
    phases: [
      {
        phase: "fast_context",
        commandResults: [
          { command: "get_selection", status: "ok", result: { nodes: [{ id: "100:1", name: "CTA Button", type: "INSTANCE" }] } },
          {
            command: "get_metadata",
            status: "ok",
            result: {
              xml:
                '<selection id="100:1" name="CTA Button" type="INSTANCE"><frame id="200:1" name="Button Row" type="FRAME"><text id="300:1" name="Label" type="TEXT" /></frame></selection>'
            }
          }
        ]
      },
      {
        phase: "focused_detail",
        commandResults: [
          {
            command: "get_instance_details",
            status: "ok",
            result: {
              targetNodeId: "100:1",
              detail: {
                node: { id: "100:1", name: "CTA Button", type: "INSTANCE" },
                layout: { layoutMode: "HORIZONTAL", itemSpacing: 12 },
                sourceComponent: { id: "comp-1", name: "Button / Primary", componentSetName: "Button" },
                componentProperties: { Size: { type: "VARIANT", value: "Large" } }
              },
              fallbackUsed: false,
              truncated: false
            }
          },
          {
            command: "get_component_variant_details",
            status: "ok",
            result: {
              targetNodeId: "100:1",
              detail: {
                variantProperties: { Size: "Large", Tone: "Primary" }
              }
            }
          },
          {
            command: "get_node_details",
            status: "ok",
            result: {
              targetNodeId: "100:1",
              detail: {
                node: { id: "100:1", name: "CTA Button", type: "INSTANCE", childCount: 1 },
                layout: { layoutMode: "HORIZONTAL", itemSpacing: 12 },
                geometry: { width: 120, height: 44 }
              },
              fallbackUsed: false,
              truncated: false
            }
          }
        ]
      },
      {
        phase: "asset_lookup",
        commandResults: [
          {
            command: "get_variable_defs",
            status: "ok",
            result: {
              variables: [
                { name: "color.brand.primary", value: "#3366FF" }
              ]
            }
          },
          {
            command: "search_design_system",
            status: "ok",
            result: {
              matches: [{ name: "Button / Primary", type: "COMPONENT" }]
            }
          },
          {
            command: "search_instances",
            status: "ok",
            result: {
              matches: [{ id: "500:1", name: "CTA Button", type: "INSTANCE" }]
            }
          }
        ]
      }
    ]
  };

  const { contextModel, contextCoverage, contextWarnings } = buildDesignerContextModelFromExecution({
    intentEnvelope,
    execution
  });

  assert.equal(contextModel.focusedNode.layout.layoutMode, "HORIZONTAL");
  assert.equal(contextModel.focusedNode.variantProperties.Size, "Large");
  assert.equal(contextModel.focusedNode.sourceComponent.name, "Button / Primary");
  assert.equal(contextModel.structure.textNodeCount, 1);
  assert.equal(contextModel.structure.childTypes.includes("FRAME"), true);
  assert.equal(contextModel.designSystem.variableDefs.length, 1);
  assert.equal(contextModel.designSystem.componentCandidates.length, 1);
  assert.equal(contextModel.designSystem.instanceMatches.length, 1);
  assert.equal(contextCoverage.focusedNode.status, "available");
  assert.equal(contextCoverage.designSystem.status, "available");
  assert.deepEqual(contextWarnings, []);
});

test("buildDesignerContextModelFromExecution accepts direct plugin detail payloads and updates live selection ids", () => {
  const intentEnvelope = createDesignerIntentEnvelope({
    request: "선택한 버튼 인스턴스의 variant와 override를 설명해줘",
    figmaContext: {
      fileName: "Agent_skill_test",
      pageName: "Page 55",
      selection: [{ id: "10:1", name: "Button", type: "INSTANCE" }]
    }
  });

  const execution = {
    executedAt: "2026-05-15T07:27:18.944Z",
    phases: [
      {
        phase: "fast_context",
        commandResults: [
          {
            command: "get_selection",
            status: "ok",
            result: {
              selection: [{ id: "33333:341", name: "button", type: "INSTANCE" }]
            }
          },
          {
            command: "get_metadata",
            status: "ok",
            result: {
              roots: [{ id: "33333:341", name: "button", type: "INSTANCE" }],
              json: {
                type: "selection",
                roots: [
                  {
                    id: "33333:341",
                    name: "button",
                    type: "INSTANCE",
                    children: [{ id: "I33333:341;1:1", name: "Frame", type: "FRAME" }]
                  }
                ]
              }
            }
          }
        ]
      },
      {
        phase: "focused_detail",
        commandResults: [
          {
            command: "get_instance_details",
            status: "ok",
            result: {
              targetNodeId: "33333:341",
              node: { id: "33333:341", name: "button", type: "INSTANCE" },
              layout: { layoutMode: "HORIZONTAL", itemSpacing: 12 },
              sourceComponent: { id: "comp-1", name: "Button / Primary", componentSetName: "Button" },
              componentProperties: { Label: { type: "TEXT", value: "Button" } },
              variantProperties: { Size: "Large", Tone: "Primary" }
            }
          },
          {
            command: "get_node_details",
            status: "ok",
            result: {
              targetNodeId: "33333:341",
              node: { id: "33333:341", name: "button", type: "INSTANCE", childCount: 1 },
              layout: { layoutMode: "HORIZONTAL", itemSpacing: 12 },
              geometry: { width: 126, height: 40 }
            }
          }
        ]
      }
    ]
  };

  const { contextModel, contextCoverage } = buildDesignerContextModelFromExecution({
    intentEnvelope,
    execution
  });

  assert.equal(contextModel.target.primaryTargetId, "33333:341");
  assert.equal(contextModel.selection.items[0].id, "33333:341");
  assert.equal(contextModel.focusedNode.node.id, "33333:341");
  assert.equal(contextModel.focusedNode.variantProperties.Size, "Large");
  assert.equal(contextModel.focusedNode.sourceComponent.name, "Button / Primary");
  assert.equal(contextCoverage.focusedNode.status, "available");
});
