# Design AI First Read Strategy Pivot

Date: 2026-04-21

## Goal

Refocus Xbridge around a design-AI-first read pipeline that:

- helps the plugin AI understand the current Figma context quickly
- avoids expensive full-file reads by default
- separates fast context reads from deeper detail reads and asset lookups
- improves design suggestion and design execution quality before local implementation work

This plan does not replace the existing read capabilities.
It changes how they should be prioritized, packaged, and consumed.

## Product Priority Shift

The immediate product priority is:

1. **design AI inside the plugin**
2. **local implementation handoff later**

That means the read stack should first optimize for:

- understanding the current user focus
- producing AI-friendly context summaries
- supporting designer-level reasoning and action selection

The bridge should not start from "read everything available."
It should start from "read the minimum that makes the current design task intelligible."

## Core Read Modes

The read strategy should be organized into three distinct modes.

### 1. Fast Context

Purpose:

- answer "what is the user currently looking at or working on?"

Scope:

- current file identity
- current page
- current selection
- nearby section or frame labels
- high-level node types
- lightweight structure and counts

Characteristics:

- low latency
- selection-first
- safe default for large files
- suitable for every chat turn

Typical design-AI uses:

- intent grounding
- current-screen understanding
- deciding whether a request targets a frame, section, component, or whole page
- generating a concise context strip in the plugin UI

### 2. Focused Detail

Purpose:

- answer "what exactly should the AI reason about or modify?"

Scope:

- detailed properties of the selected frame or node subtree
- layout structure
- spacing and sizing relationships
- text content
- component and variant usage
- annotations and relevant metadata

Characteristics:

- narrower scope, deeper inspection
- only triggered when the AI needs precision
- follows fast context rather than replacing it

Typical design-AI uses:

- layout critique
- hierarchy analysis
- component replacement suggestions
- copy and content review
- preparing safe direct-apply actions

### 3. Asset Lookup

Purpose:

- answer "what reusable assets, tokens, styles, or libraries are available for this task?"

Scope:

- variables already in use
- local components and component sets
- styles
- connected library assets
- importable design-system components

Characteristics:

- independent from node-detail depth
- should run only when the task needs design-system awareness
- supports recommendation and reuse, not just raw inspection

Typical design-AI uses:

- design-system-aligned suggestions
- component reuse decisions
- token-aware recommendations
- avoiding redundant custom design work

## Why This Separation Matters

Today, many read paths exist, but the product needs a clearer policy for when to use them.

Without that separation:

- large files cost too much to inspect on every turn
- design AI receives more raw detail than it needs
- asset searches can happen too early
- user-facing response quality becomes inconsistent

With the separation:

- fast context gives responsiveness
- focused detail gives precision
- asset lookup gives system awareness

Together, these support design AI more effectively than a single "deep read everything" path.

## Phase Plan

### Phase 1. Read Strategy Inventory

Document and classify the current read entrypoints into:

- fast context reads
- focused detail reads
- asset lookup reads

Outputs:

- source map of current read helpers and routes
- recommended default read path per design-AI request type
- explicit "do not full-scan by default" policy

Done when:

- the team can say which read mode is the default for each major design-AI task

### Phase 2. Context Summary Layer

Introduce a design-AI-facing summary layer between raw Figma data and AI reasoning.

The summary layer should convert raw reads into compact structures such as:

- current screen summary
- active section summary
- selected-node summary
- design-system usage summary
- likely problem areas or improvement opportunities

Outputs:

- consistent AI-ready context envelopes
- smaller and more readable plugin-side previews
- clearer prompt/context packaging for design AI

Done when:

- the plugin can render a useful design summary without depending on raw verbose payloads

### Phase 3. Intent-To-Read Routing

Map AI designer intents to the minimum read mode needed.

Examples:

- "make this card hierarchy clearer" -> fast context + focused detail
- "use existing button patterns here" -> fast context + asset lookup
- "restructure this section" -> fast context + focused detail + selective asset lookup

Outputs:

- request routing rules
- predictable read escalation order
- less accidental over-reading

Done when:

- a design request triggers an intentional read pattern instead of ad hoc read accumulation

### Phase 4. Chat UX Grounded In Read Modes

Make the plugin chat experience reflect the new read model.

The UI should clearly show:

- what context was read quickly
- when deeper detail was requested
- when design-system assets were consulted

This supports trust and keeps the AI behavior legible to the user.

Outputs:

- context badges or summaries in the chat shell
- clear distinction between "current context" and "looked up assets"
- better explanation of why the AI made a suggestion

Done when:

- the user can understand what the AI saw before it responded

### Phase 5. Design Execution Read Guardrails

Before direct Figma edits, require the AI flow to confirm it has enough focused detail.

This means:

- fast context alone should not trigger structural edits
- direct-apply actions should depend on confirmed detail reads
- asset-backed recommendations should verify reusable components before creation

Outputs:

- safer design actions
- fewer blind mutations
- stronger consistency with existing assets and structure

Done when:

- execution quality improves because read depth matches action risk

### Phase 6. Large File Optimization

After the above behavior is stable, optimize for heavier documents.

Guidelines:

- selection-first by default
- current-page bias over whole-file scans
- depth-limited detail reads
- lazy expansion only when needed
- asset lookup only for requests that need reuse or system alignment

Outputs:

- better responsiveness on large files
- lower timeout risk
- more predictable design-AI behavior under scale

Done when:

- the AI remains useful and responsive even in large, deeply nested files

### Phase 7. Local Implementation Re-entry

Only after the design-AI read pipeline is strong should local implementation become the next product focus again.

At that point, local handoff can benefit from:

- better context summaries
- clearer intent routing
- more structured asset information

This makes implementation handoff a downstream consumer of the design-AI read system, not the driver of it.

Done when:

- local implementation uses the same summarized context model instead of asking for a separate read strategy

## Support For Design AI Before Local Implementation

This pivot is intentionally design-first.

The read system should first help the plugin AI:

- understand what the user means
- understand what the user is pointing at
- understand what reusable assets already exist
- decide whether to suggest, inspect deeper, or act

Only after that should the system optimize for shipping the same context to a local implementation worker.

In other words:

- **design AI is the primary reader**
- **local implementation is a secondary consumer**

That priority should shape both product decisions and engineering effort.

## Acceptance Criteria

This read-strategy pivot is working when:

- most design-AI turns start with fast context instead of broad scans
- focused detail reads happen intentionally and only when needed
- asset lookup is clearly separated from structural node inspection
- plugin chat can explain what context the AI used
- direct design actions are safer because they require sufficient detail
- local implementation handoff reuses the design-AI context model instead of driving it
