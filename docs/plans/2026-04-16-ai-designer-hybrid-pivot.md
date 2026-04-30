# AI Designer Hybrid Pivot

## Goal

Pivot Xbridge from a bridge-first streaming tool into a hybrid product with three clear roles:

- Figma plugin AI designer: primary design agent inside Figma
- Local coding agent: primary implementation agent in the local workspace
- Bridge: minimal transport layer for context handoff and execution status

This is not a fresh rewrite. It is a controlled re-architecture on top of the current codebase.

## Product Direction

### Figma Plugin AI Designer

The plugin should become capable of designer-level work, not just light edits.

Primary responsibilities:

- read current page, frame, and selection context
- converse with the user inside the plugin
- propose layout, hierarchy, component, and copy changes
- generate or restructure screens in Figma
- apply changes directly through plugin commands

### Local Coding Agent

The local agent should focus on implementation work.

Primary responsibilities:

- receive design context from the plugin/bridge
- implement UI in the local repo
- run tests, build, and refactor
- report implementation status and outcomes back to the user

### Bridge

The bridge should no longer act as the center of all product value.

Primary responsibilities:

- hand off Figma context to the local agent
- expose execution status and health
- keep only the transport and integration layer that is needed for implementation handoff

## File Strategy

### Keep And Reuse

These files already contain high-value capability that still fits the new direction.

- [figma-plugin/code.js](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/figma-plugin/code.js)
  plugin runtime entrypoint; keep as the base for AI-designer actions and Figma-side execution
- [figma-plugin/manifest.json](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/figma-plugin/manifest.json)
  keep and extend for the plugin-first experience
- [src/server.js](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/src/server.js)
  keep, but narrow responsibility toward context handoff and execution transport
- [src/runtime-session-state.js](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/src/runtime-session-state.js)
  session tracking still matters for plugin presence, handoff safety, and recovery
- [src/command-queue-policy.js](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/src/command-queue-policy.js)
  keep as infrastructure, but simplify if bridge responsibilities shrink
- authoring and screen-generation modules in [src](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/src)
  these are strong building blocks for an AI designer:
  - `analyze-selection-to-compose`
  - `compose-screen-from-intents`
  - `compose-sections-from-intents`
  - `build-screen-from-design-system`
  - `design-system-search`
  - `find-or-import-component`
  - `reuse-or-create-component`
  - `create-node`
  - `create-instance`
  - `apply-style`
  - `bind-variable`
  - `set-component-properties`
  - `set-variant-properties`
  - `read-node-details`
  - `read-annotations`
  - `search-instances`
  - `scene-snapshot`

### Keep But Reposition

These files remain useful, but their product role changes.

- [figma-plugin/ui.html](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/figma-plugin/ui.html)
  today it is a bridge operations panel; it should evolve into a chat-first AI designer surface
- docs under [docs/authoring](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/docs/authoring)
  keep as domain knowledge, but reframe around AI designer workflows rather than transport-first ops
- tests around node reading, screen composition, design system search, and scene snapshots
  keep as core product tests for plugin intelligence

### Deprioritize Or Shrink

These areas should no longer dominate the product.

- transport-heavy operational UI and diagnostics inside [figma-plugin/ui.html](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/figma-plugin/ui.html)
- docs centered on streaming-first operations:
  - [docs/authoring/streaming-first-ops.md](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/docs/authoring/streaming-first-ops.md)
  - [docs/authoring/streaming-first-soak-ops.md](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/docs/authoring/streaming-first-soak-ops.md)
  - [docs/authoring/realtime-channel-ops.md](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/docs/authoring/realtime-channel-ops.md)
  - [docs/authoring/websocket-command-channel-ops.md](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/docs/authoring/websocket-command-channel-ops.md)
- integration tests whose main value is transport tuning, soak behavior, or fallback policy
  these should be retained for safety, but reduced in product priority

### New Work To Add

The pivot needs new layers that do not exist yet or are only partially present.

- plugin chat interaction model
- AI request/response orchestration inside the plugin
- intent model for designer-level actions
- handoff contract from plugin design context to local coding agent
- implementation request UX
- result summary UX back into the plugin

## Recommended New Modules

Suggested new files or modules to introduce incrementally:

- `src/ai-designer-intents.js`
  normalize user chat requests into structured designer actions
- `src/ai-designer-prompts.js`
  centralize system prompts and context packaging for the plugin AI
- `src/plugin-handoff-contract.js`
  shape the minimal payload sent from plugin/bridge to the local agent
- `src/plugin-chat-session.js`
  maintain plugin-side conversation state
- `src/plugin-action-executor.js`
  map AI actions to Figma mutations and existing authoring helpers
- `tests/ai-designer-intents.test.js`
- `tests/plugin-handoff-contract.test.js`
- `tests/plugin-chat-session.test.js`

These names are proposed starting points, not mandatory final filenames.

## UI Pivot Plan

### Current

The plugin UI is still heavily optimized around:

- bridge health
- transport state
- readiness diagnostics
- fallback visibility

### Target

The plugin UI should become:

- chat-first
- context-aware
- action-oriented
- designer-readable

Proposed high-level plugin layout:

1. current file/selection context header
2. chat conversation
3. suggested actions from AI
4. apply-to-Figma controls
5. implement-in-code handoff controls
6. compact connection status, hidden by default or collapsed

## Test Strategy

### Keep As Core

- node reading and selection analysis tests
- screen composition tests
- design-system search/import tests
- snapshot and detail-read tests

### Keep As Safety Nets

- session state tests
- bridge health/preflight tests
- websocket and streaming contract tests

These remain valuable, but they become platform safety tests rather than the product center.

### Add

- plugin AI intent parsing tests
- plugin handoff contract tests
- chat session state tests
- end-to-end tests for:
  - design request -> Figma action
  - design request -> implementation handoff

## Migration Order

### Phase 1

Document and isolate the new product boundary.

- freeze current bridge-first snapshot
- add hybrid pivot documentation
- stop expanding transport UI unless it directly supports the new product

### Phase 2

Convert plugin UI from operations panel to chat-first shell.

- keep minimal health visibility
- add chat layout
- add context summary strip
- add placeholder AI action list

### Phase 3

Introduce AI designer orchestration.

- create intent model
- wire prompt/context packaging
- connect AI responses to existing authoring helpers

### Phase 4

Introduce implementation handoff.

- define plugin-to-local handoff payload
- add local agent request entrypoint
- display implementation status/result

### Phase 5

Trim transport-first surface area.

- collapse or remove nonessential diagnostics from the main plugin surface
- keep deep diagnostics only in advanced/debug mode

## Immediate Next Steps

1. reshape [figma-plugin/ui.html](/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/figma-plugin/ui.html) into a chat-first shell
2. define the plugin AI intent contract
3. define the plugin-to-local implementation handoff contract
4. keep current bridge/session infrastructure stable while reducing its user-facing prominence

## Decision Rule

When deciding whether to modify an existing file or create a new one, use this rule:

- if the file already helps the plugin read, understand, or edit Figma, reuse it
- if the file exists mainly to explain or tune bridge transport behavior, shrink or hide it
- if the file is needed to support chat, AI reasoning, or implementation handoff, create a new focused module
