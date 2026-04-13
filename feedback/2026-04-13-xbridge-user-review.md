# Writable Bridge User Review

Date: 2026-04-13

## Purpose

This document is a handoff for the agent working on `writable_mcp_bridge`.
It summarizes the bridge from the perspective of a real implementation user:

- I need to inspect a Figma design.
- I need to collect the exact layout and variant information required for coding.
- I need reliable feedback from the bridge without reverse-engineering too much from sparse output.

This review is based on actual use while implementing the toolbar in `FDS_inspector`, not on an abstract feature checklist.

## Executive Summary

The bridge can connect to a live Figma file and it is strong as a write bridge.
However, as a read bridge for implementation work, it is not yet sufficient.

Current state in one line:

`The bridge behaves like a remote command bridge, not yet like an implementation-grade design inspector.`

## What The User Can Actually Do Today

From an implementation user point of view, the current workable flow is:

1. Start the bridge server.
2. Open the Figma desktop file.
3. Run the bridge plugin and keep it open.
4. Check session health with `/health`.
5. Find the active page with `/api/pages`.
6. Read sparse structure with `/api/get-metadata`.
7. Search nodes with `/api/search-nodes`.
8. Use write APIs such as `update_node`, `create_node`, `set_variant_properties`, `bind_variable`.

This means the bridge does allow a live attachment to the current file and page.
That part works.

## What Feedback The User Actually Receives

The bridge gives mostly text and metadata feedback:

- connection health
- active plugin sessions
- page list
- selection count
- sparse XML outline
- lightweight search results
- write success/failure responses

What the user does **not** get in a direct, implementation-friendly way:

- complete auto-layout details for a target component
- exact gap and padding as structured fields in normal read flow
- component-set variant list as a structured implementation response
- variant property names and values in the same place as layout data
- instance override details in a way that is easy to map to code
- a visual preview or screenshot response from the bridge itself

## What Worked Well In Practice

The bridge was useful for:

1. Confirming that the correct file and page were connected.
2. Reading rough component structure.
3. Reading child order and approximate positions from XML.
4. Identifying component IDs like `pattern/toolbar`, `1:44`, `14:634`, `1:779`.
5. Confirming widths and child placement:
   - disconnected message width `401`
   - connected message width `310`
   - default width `384`
6. Confirming child x positions such as:
   - `56`, `72`, `264`, `280`, `328`, `344`

Without the bridge, even these confirmations would have been much harder.

## What Failed In Practice

The important failure is not "the bridge cannot read anything".
The failure is:

`The bridge does not return implementation-critical layout and variant information in a structured enough form for reliable coding.`

That created a real implementation problem:

- I could inspect sparse XML.
- I could infer child positions.
- But I could not reliably read the auto-layout contract directly.
- That forced reverse-engineering from coordinates.
- That increased the chance of coding mistakes.

Concrete symptom:

- The toolbar gap rule should have been implemented as `16px` between button-button and button-divider.
- That should not have required user correction.
- The bridge had enough information internally to support this, but the normal read flow did not expose it clearly enough.

## Root Cause

The main issue is a mismatch between write capability and read capability.

### The bridge knows more than it returns

Inside the bridge/plugin code, the system clearly understands:

- `layoutMode`
- `itemSpacing`
- `paddingLeft`
- `paddingRight`
- `paddingTop`
- `paddingBottom`
- `primaryAxisAlignItems`
- `counterAxisAlignItems`
- `layoutGrow`
- `layoutAlign`
- `variantProperties`
- `componentPropertyDefinitions`

So the bridge engine is not conceptually missing these ideas.

### But default reading is too shallow

The basic node serializer is shallow.
The normal search flow is explicitly lightweight.
The metadata flow is explicitly sparse XML.

In practice this means:

- the engine has rich structure
- the user receives a reduced read model
- the implementation user still has to infer too much

## User-Centered Assessment

If I am a developer trying to implement Figma faithfully, these are the real questions:

1. Can I attach to the right file and page?
2. Can I inspect the exact component I care about?
3. Can I read its variant states?
4. Can I read its auto-layout settings directly?
5. Can I read padding and gap directly?
6. Can I read child visibility and per-variant structure directly?
7. Can I trust the bridge output enough to code from it without guessing?

Current answers:

1. Yes
2. Partly yes
3. Partly
4. Not well enough in the normal read flow
5. Not well enough in the normal read flow
6. Partly through sparse XML, but not ergonomically
7. No, not for pixel-accurate implementation

## Scorecard

This is not a code quality score. It is a user-task score for actual design implementation.

- Connection/session model: 8/10
- Write operations: 8/10
- Basic node discovery: 7/10
- Implementation-grade inspection: 4/10
- End-to-end "read design and code it correctly" usability: 4/10

## Why This Matters

The current bridge can make an agent look more capable than it really is.

From the outside, it appears that:

- the agent is connected to Figma
- the agent can inspect the file
- the agent should therefore be able to implement the design faithfully

But in practice, because the read model is sparse:

- the agent often has to infer layout from coordinates
- the agent may miss explicit auto-layout semantics
- the agent may misread spacing or variant behavior
- the user ends up correcting things that should have been collected directly

This creates a trust problem, not just a tooling problem.

## Highest Priority Gaps

### 1. Missing implementation-grade node details API

Need a read API that returns, for a target node:

- id
- name
- type
- visible
- width
- height
- x
- y
- layoutMode
- itemSpacing
- paddingLeft
- paddingRight
- paddingTop
- paddingBottom
- primaryAxisAlignItems
- counterAxisAlignItems
- primaryAxisSizingMode
- counterAxisSizingMode
- layoutAlign
- layoutGrow
- variantProperties
- componentPropertyDefinitions
- instance source / component set linkage
- child list with the same rich structure

Suggested name:

- `get_node_details`

### 2. Missing component-set variant inspection API

Need a dedicated API for component sets:

- component set id and name
- variant property names
- full variant list
- each variant's resolved property values
- each variant's layout contract
- each variant's visible children
- each variant's child order

Suggested name:

- `get_component_variant_details`

### 3. Missing instance inspection API

Need a stable way to inspect an instance as a coding target:

- which component or variant it points to
- which properties are overridden
- which nested instances are overridden
- which text or visibility values differ from the base

Suggested name:

- `get_instance_details`

## UX Improvements For Real Users

Even before adding major new APIs, the bridge would become much more usable if:

1. `search_nodes` optionally supported a `detailLevel`
   - `light`
   - `layout`
   - `full`

2. `get_metadata` optionally emitted structured JSON alongside XML
   - XML is good for humans
   - JSON is better for implementation agents

3. responses clearly labeled when data is inferred vs explicit

4. there was a one-shot "implementation inspect" flow
   - target node in
   - implementation-ready JSON out

## Recommended Next Step

The next bridge task should **not** be more generic write features.

The next bridge task should be:

`Build an implementation-grade read API for exact Figma-to-code inspection.`

Recommended order:

1. Add `get_node_details`
2. Add `get_component_variant_details`
3. Add `get_instance_details`
4. Add tests for auto-layout fields, variant fields, and child visibility
5. Re-run the toolbar inspection workflow against `pattern/toolbar`

## Acceptance Criteria For The Bridge Agent

The bridge improvement should be considered successful when a coding agent can inspect `pattern/toolbar` and answer these without manual coordinate inference:

1. What is the root auto-layout direction?
2. What is the toolbar padding?
3. What is the gap between button and divider?
4. What variants exist?
5. Which children are visible in each variant?
6. Which button is active in each variant?
7. Which variants show badge or dot indicators?
8. Which instance properties or overrides are involved?

If the bridge can answer these as structured data, the implementation user experience changes completely.

## Final Assessment

The bridge is useful and real.
It is not fake connectivity.
It does help with live file attachment and authoring.

But from the perspective of a developer trying to implement a Figma design faithfully, it is currently incomplete.

The main gap is not access.
The main gap is read fidelity and read ergonomics.

That is the work that should be prioritized next.
