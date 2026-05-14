import { buildDesignerSuggestionBundle } from "../src/ai-designer-suggestions-v2.js";

const cases = [
  {
    name: "instance",
    bundle: buildDesignerSuggestionBundle({
      intentEnvelope: {
        intents: [{ kind: "inspect_selection" }],
        contextModel: {
          focusedNode: {
            node: { id: "1", name: "Primary Button", type: "INSTANCE" },
            sourceComponent: { name: "Button / Primary" },
            variantProperties: { Tone: "Primary", Size: "Large" },
            componentProperties: { Label: { type: "TEXT", value: "Continue" } }
          }
        }
      },
      execution: { summary: {} }
    })
  },
  {
    name: "layout",
    bundle: buildDesignerSuggestionBundle({
      intentEnvelope: {
        intents: [{ kind: "adjust_spacing" }],
        designerContext: {
          fastContext: { selectionSummary: "Card Frame" }
        },
        contextModel: {
          focusedNode: {
            node: { id: "2", name: "Card Frame", type: "FRAME" },
            layout: { layoutMode: "VERTICAL", itemSpacing: 16 }
          },
          structure: {
            childCount: 4,
            textNodeCount: 2,
            autoLayoutFrames: 1
          }
        }
      },
      execution: { summary: {} }
    })
  },
  {
    name: "design-system",
    bundle: buildDesignerSuggestionBundle({
      intentEnvelope: {
        intents: [{ kind: "swap_or_recommend_component" }],
        contextModel: {
          designSystem: {
            shouldLookup: true,
            componentCandidates: [
              { id: "cmp-1", name: "Card / Primary" },
              { id: "cmp-2", name: "Card / Compact" }
            ],
            variableDefs: [{ name: "color.surface.card", value: "#fff" }],
            instanceMatches: [{ id: "inst-1", name: "Revenue Card" }]
          }
        }
      },
      execution: { summary: {} }
    })
  }
];

for (const item of cases) {
  console.log(`---${item.name}---`);
  console.log(item.bundle.findings[0]?.label || "");
  console.log(item.bundle.findings[0]?.detail || "");
  console.log(item.bundle.recommendations.map((recommendation) => recommendation.title).join(" | "));
}
