# Writable Bridge Implementation Tasks

Date: 2026-04-13

## Goal

Turn `writable_mcp_bridge` from a bridge that is good at writing into a bridge that is also reliable for implementation-grade reading.

This task list is derived from real usage during Figma-to-code implementation work.

Related review:

- [2026-04-13-writable-bridge-user-review.md](/Users/im_018/Documents/GitHub/Project/chrome-extensions/FDS_inspector/docs/2026-04-13-writable-bridge-user-review.md)

## Priority 0

### Task 1. Add `get_node_details` read API

Problem:
- Current read flows are too sparse for exact implementation work.
- Users should not have to infer auto-layout from coordinates.

Implement:
- Add a new plugin command and HTTP endpoint named `get_node_details`.
- Accept:
  - `pluginId`
  - `targetNodeId`
  - optional `maxDepth`
  - optional `includeChildren`

Response must include at minimum:
- `id`
- `name`
- `type`
- `visible`
- `x`
- `y`
- `width`
- `height`
- `layoutMode`
- `itemSpacing`
- `paddingLeft`
- `paddingRight`
- `paddingTop`
- `paddingBottom`
- `primaryAxisAlignItems`
- `counterAxisAlignItems`
- `primaryAxisSizingMode`
- `counterAxisSizingMode`
- `layoutAlign`
- `layoutGrow`
- `cornerRadius`
- `opacity`
- `characters` for text
- `variantProperties` when present
- `componentPropertyDefinitions` when present
- `children` with the same shape when `includeChildren` is enabled

Suggested touch points:
- `figma-plugin/code.js`
- `src/server.js`

Deliverables:
- plugin command
- stdio tool exposure
- HTTP endpoint
- response schema documentation

Done when:
- a coding agent can request one node and directly read padding and gap without XML reverse-engineering

### Task 2. Add `get_component_variant_details` API

Problem:
- Component sets are readable only as sparse XML or indirect structure.
- Variant properties and per-variant visibility/layout are not implementation-friendly.

Implement:
- Add `get_component_variant_details`.
- Accept:
  - `pluginId`
  - `targetNodeId`
  - optional `includeChildren`
  - optional `maxDepth`

Response must include:
- component set id/name
- variant property definitions
- list of variants
- for each variant:
  - id
  - name
  - `variantProperties`
  - root width/height
  - root auto-layout fields
  - visible children
  - ordered child list
  - each child's layout and visibility

Suggested touch points:
- `figma-plugin/code.js`
- `src/server.js`
- tests around component-set reading

Done when:
- the toolbar component set can be queried and answers:
  - what variants exist
  - what is visible in each variant
  - what spacing/padding each variant uses

### Task 3. Add `get_instance_details` API

Problem:
- Implementation work often targets instances, not only component sets.
- Current bridge does not expose instance linkage and overrides clearly enough.

Implement:
- Add `get_instance_details`.
- Accept:
  - `pluginId`
  - `targetNodeId`
  - optional `includeResolvedChildren`

Response must include:
- instance id/name/type
- source component id
- source component set id if applicable
- current variant properties
- component properties
- overridden text/visibility/property values
- nested instance summary

Done when:
- a coding agent can inspect a toolbar button instance and know:
  - which variant it uses
  - which properties are overridden
  - which nested nodes differ from the base

## Priority 1

### Task 4. Upgrade `search_nodes` with `detailLevel`

Problem:
- `search_nodes` is intentionally lightweight, which is fine for discovery.
- It is not sufficient when a user wants to inspect implementation-critical nodes.

Implement:
- Add optional `detailLevel`:
  - `light`
  - `layout`
  - `full`

Behavior:
- `light` keeps current behavior
- `layout` adds layout and sizing fields
- `full` adds variant/component/instance context where available

Done when:
- users can stay within `search_nodes` for many common inspection tasks instead of immediately falling back to sparse XML

### Task 5. Add structured JSON alongside `get_metadata`

Problem:
- XML is useful for human scanning, but awkward for deterministic implementation.

Implement:
- Keep XML output
- Add a parallel structured JSON tree in the same response
- JSON should preserve:
  - order
  - coordinates
  - visibility
  - layout fields when available

Done when:
- `get_metadata` can serve both human inspection and machine implementation workflows

## Priority 2

### Task 6. Expose explicit inference boundaries

Problem:
- Users and agents cannot easily tell whether a returned value is explicit from Figma or inferred by the bridge.

Implement:
- Add metadata flags such as:
  - `source: "explicit" | "inferred"`
  - or field-level provenance where practical

Use especially for:
- layout values
- variant resolution
- instance linkage

Done when:
- the consumer can tell whether a field is authoritative or derived

### Task 7. Add implementation-focused documentation examples

Problem:
- Current docs explain usage, but not “exactly how to inspect a design before coding it”.

Implement:
- Add a doc section:
  - “Inspect a component for implementation”
- Include example flows for:
  - component set inspection
  - instance inspection
  - reading auto-layout
  - reading variant state

Done when:
- a new agent can follow the docs and inspect a component without trial and error

## Validation Tasks

### Task 8. Add tests for layout field extraction

Add tests that verify:
- `layoutMode`
- `itemSpacing`
- `padding*`
- align fields
- sizing mode fields

Done when:
- regressions in layout extraction are caught automatically

### Task 9. Add tests for variant extraction

Add tests that verify:
- component property definitions
- variant properties
- per-variant child visibility
- per-variant child ordering

Done when:
- variant inspection is stable enough for code generation workflows

### Task 10. Add tests for instance detail extraction

Add tests that verify:
- source component linkage
- instance overrides
- nested overrides summary

Done when:
- instance-targeted implementation reads are trustworthy

## Workflow Validation

### Task 11. Re-run the toolbar case as a bridge acceptance test

Use `pattern/toolbar` in `FDS_Inspector` as a real acceptance case.

The bridge should be able to answer all of the following without manual coordinate inference:

1. What is the root auto-layout direction?
2. What is the root padding?
3. What is the gap between buttons?
4. What is the gap between buttons and dividers?
5. What variants exist?
6. Which children are visible in each variant?
7. Which variants contain status text?
8. Which variants show badge/dot states?
9. Which instance properties or overrides differ by variant?

Done when:
- a coding agent can build the toolbar from bridge output without the human needing to manually correct layout rules like `16px gap`

Acceptance checklist:
- [Toolbar Read Acceptance Checklist](./2026-04-13-toolbar-acceptance-checklist.md)
- Use this as the canonical validation artifact for the toolbar read flow.

## Suggested Execution Order

1. Task 1: `get_node_details`
2. Task 8: layout extraction tests
3. Task 2: `get_component_variant_details`
4. Task 9: variant extraction tests
5. Task 3: `get_instance_details`
6. Task 10: instance extraction tests
7. Task 11: toolbar acceptance validation
8. Task 4: `search_nodes.detailLevel`
9. Task 5: structured JSON in `get_metadata`
10. Task 6 and Task 7

## Handoff Note

The most important product decision is this:

Do not prioritize more authoring features first.
Prioritize implementation-grade reading first.

The real user pain is not “cannot write to Figma”.
The real user pain is “connected to Figma, but still forced to guess.”
