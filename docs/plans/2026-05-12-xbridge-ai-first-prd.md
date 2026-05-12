# Xbridge AI-First PRD

Date: 2026-05-12
Status: Draft for execution
Audience: internal product, design, and engineering collaborators

## 1. Product Summary

Xbridge is a Figma plugin plus local bridge server that lets a user talk to a selected AI model inside Figma, have that model understand the request, read the current design context, and safely apply changes to the open file.

The long-term product is not "a bridge with some AI."
It is "an AI-native Figma working surface" where:

- the user stays inside Figma
- the selected AI model is the primary conversation and intent owner
- the bridge acts as execution, validation, and transport infrastructure
- the plugin can support both paid API models and local open-source models

This document defines the internal product direction needed to get there.

## 2. Problem

Today, the product direction is visible, but the user experience is still inconsistent.

Observed issues:

- model connection success does not reliably mean real task success
- simple text tasks can take too long or fail without clear progress visibility
- plugin responses sometimes feel bridge-driven rather than AI-driven
- local model outputs can leak implementation artifacts such as node ids
- the same request can behave differently between direct Ollama chat and Xbridge
- Figma Desktop and Figma Beta do not yet feel equally stable

The result is a trust gap.
Users want to believe they are "chatting with an AI that can work in Figma."
Instead, the product can still feel like "a bridge workflow that sometimes calls AI."

## 3. Vision

Xbridge should become the most practical way to use AI directly inside Figma for real working designers and builder-designers.

The product should make the following interaction feel natural:

1. user selects a frame, text, or area in Figma
2. user writes a request in the plugin chat
3. selected AI model interprets the request
4. bridge reads only the context needed
5. selected AI model decides the change
6. bridge validates and applies the change
7. plugin shows what happened clearly and quickly

The product should feel:

- AI-first
- fast enough for repeated everyday use
- trustworthy about what it is doing
- safe about what it changes
- flexible about model choice

## 4. Product Principles

### 4.1 Single-Model Ownership

Within a session, one selected model owns the request interpretation and output generation.
The bridge must not silently route different task types to different models.

### 4.2 AI-First, Bridge-Second

The bridge should not be the hidden author of user-facing meaning.
Its responsibilities are:

- context collection
- tool execution
- output validation
- transport recovery
- progress reporting

Its responsibility is not:

- replacing the model's semantic judgment
- silently inventing final copy or titles when the model fails

### 4.3 Selection-First Productivity

The product should optimize first for selected-target workflows because they are the fastest, safest, and most deterministic path in Figma.

Examples:

- selected text translation
- selected text rewrite
- selected labels to title variants
- selected frame hierarchy review

Unselected broad discovery flows matter, but they are secondary.

### 4.4 Clear Progress Over Silent Waiting

If a model takes 20-40 seconds, the product must still feel alive.
The plugin should always show:

- current stage
- what is being processed
- elapsed time
- why a slower step is happening

### 4.5 Validate Before Apply

The bridge should aggressively validate whether the model output is safe and correctly shaped before writing into Figma.
Validation should catch:

- wrong item counts
- node id leaks
- English left unchanged in translation flows
- meta chatter such as `/think`, markdown, or tool traces
- obvious placeholder or filler output

### 4.6 Local-Model Realism

Local models are a core part of the product strategy, not a side experiment.
The product must be designed for their constraints:

- slower generation
- weaker structured-output reliability
- more variable output formatting

This means prompts, timeouts, validation, and UX should all explicitly support local models.

## 5. Target Users

### Primary User

Designer or builder-designer working directly in Figma who wants fast AI help without switching tools.

They want:

- copy changes
- translation
- hierarchy and layout advice
- component-aware edits
- small-to-medium screen generation support

### Secondary User

Engineer or technical designer validating design changes, using local models for cost control, or linking Figma work with a local code workflow.

## 6. Core Jobs To Be Done

### Job 1: Understand the current selection

The user wants to ask:

- "What is selected?"
- "What is wrong with this layout?"
- "How is this structured?"

Success means the plugin returns a clear, human-readable explanation of the selected content and structure.

### Job 2: Modify selected text quickly

The user wants to ask:

- "Translate these labels into Korean"
- "Rewrite this copy more clearly"
- "Turn these into AI trend post titles"

Success means the selected model produces usable output and the bridge applies it without leaking ids or formatting artifacts.

### Job 3: Propose or apply design improvements

The user wants to ask:

- "Improve the hierarchy"
- "Tighten the spacing"
- "Make this match our system"

Success means the model can interpret the request, ask for more detail only when needed, and produce a safe execution path.

### Job 4: Support model choice without product fragmentation

The user wants to use:

- paid hosted APIs
- Ollama
- LM Studio
- future OpenAI-compatible local endpoints

Success means the product behaves consistently regardless of provider, with quality and speed varying by model capability but not by product logic fragmentation.

## 7. Product Scope

### In Scope for the current product phase

- AI-first plugin chat inside Figma
- provider and model selection
- local model detection
- selected text translation
- selected text rewrite
- selected text title generation
- selected frame or subtree read/inspection
- progress visibility during reads, generation, validation, and apply
- output validation before write
- Desktop and Beta support hardening

### Next Scope

- frame-level hierarchy improvement suggestions
- design-system-aware read and apply flows
- component and variable-aware edits
- safe multi-step action previews
- screen-generation flows using existing authoring helpers

### Out of Scope for now

- full autonomous redesign of arbitrary large files
- silent background model switching by task type
- polished external stakeholder showcase docs
- generalized natural-language search over the whole file as the primary workflow

## 8. User Experience Goals

### 8.1 The plugin should feel like a real AI surface

The user should feel they are talking to the selected model, not to a transport console.

### 8.2 Fast simple tasks should feel lightweight

Ideal path for small text jobs:

`selection read -> minimal context -> one model call -> validation -> apply`

### 8.3 Slow work should still feel understandable

Even when a local model is slow, the plugin should make the wait legible.

### 8.4 Failures should be actionable

Failures should be classified and explained clearly:

- network fetch failure
- model timeout
- invalid model output
- selection sync issue
- apply failure

## 9. Functional Requirements

### 9.1 Model Configuration

The product must support:

- provider selection
- model selection
- provider-aware model list
- local model discovery
- connection testing
- visible current model state

The plugin must not show mismatched provider/model information.

### 9.2 AI Request Routing

For each user request:

1. gather minimal relevant context
2. send original request to the selected model
3. let the model classify the task
4. choose execution path from that model decision
5. validate model output
6. apply if safe

### 9.3 Text Rewrite Pipeline

For translation, rewrite, and title generation:

- use the selected model as the meaning owner
- use bounded structured I/O suitable for local models
- support batching and chunking when needed
- prevent node id leakage
- reject malformed or unchanged output when inappropriate

### 9.4 Progress and Status

The plugin must expose:

- stage name
- stage detail
- elapsed time
- current target count or scope where helpful
- final outcome state

### 9.5 Transport Stability

The system must distinguish:

- bridge transport health
- model connection health
- current task execution state

Recovery paths should be explicit rather than invisible.

## 10. Non-Functional Requirements

### Reliability

- simple selected-text actions should succeed consistently across repeated runs
- Desktop and Beta behavior should converge where feasible

### Performance

- small text operations should minimize reads and model round-trips
- local-model flows should prefer one-call execution whenever possible

### Safety

- writes must only target validated nodes
- malformed outputs should not be silently applied

### Observability

The runtime should preserve enough metadata to inspect:

- selected model
- task kind
- chunk count
- retries
- failure reason
- end-to-end latency

## 11. Success Metrics

### Phase 1 metrics

- selected text translation success rate
- selected text rewrite success rate
- selected text title generation success rate
- average time to visible progress
- average end-to-end time for 1, 5, and 20 text nodes
- rate of invalid outputs blocked before apply
- rate of leaked node ids reaching final applied text

### Qualitative success signals

- users describe the plugin as "the AI in Figma"
- users trust what stage the plugin is in
- users can predict when they need to select first
- local model use feels viable, not merely possible

## 12. Known Product Risks

### Risk 1: Local model quality variance

Different local models will vary widely in structured-output reliability and copy quality.

Response:

- optimize prompt contracts
- improve validation
- expose progress clearly
- tune timeouts and budgets by workload shape

### Risk 2: Bridge remains too visible

If operational state dominates the surface, the product will still feel like a tool console.

Response:

- keep health visible but secondary
- keep conversation and action flow primary

### Risk 3: Overusing semantic fallback

If the bridge generates too much meaning when the model fails, AI-first trust erodes.

Response:

- allow structural recovery
- minimize semantic replacement
- prefer explicit failure over silent semantic substitution

### Risk 4: Beta/Desktop divergence

If Beta remains significantly less stable, users will not trust the product across environments.

Response:

- keep dedicated Beta verification in scope
- isolate transport issues from model issues clearly

## 13. Release Framing

### Current phase

Stabilization and product-boundary clarification.

Primary goal:
make selected-model AI-first text workflows reliable enough to feel real.

### Next phase

Expand from text reliability into frame-level design assistance and system-aware actions.

### Later phase

Broaden into screen generation, component authoring, variable workflows, and implementation handoff.

## 14. Decisions Locked By This PRD

The following decisions should be treated as product direction unless explicitly revised:

1. Xbridge is an AI-first Figma product, not a transport-first bridge product.
2. One selected model owns session-level request interpretation.
3. Selection-first workflows are the primary optimization target.
4. Bridge semantic fallback should be minimized; structural recovery is acceptable.
5. Local open-source models are first-class product targets.
6. Progress visibility is a product requirement, not a nice-to-have.
7. Reliable text tasks are the immediate foundation for broader design authoring.

## 15. Open Questions For Future Revision

- How much model reasoning should be shown directly versus summarized as progress?
- At what point should frame-level design edits move from suggestion-first to direct-apply by default?
- How should screen-generation flows balance AI freedom against design-system constraints?
- What is the right handoff contract between plugin AI work and local code implementation workflows?

## 16. Immediate Execution Priorities

1. stabilize selected-text translation, rewrite, and title generation
2. eliminate remaining node id leakage in applied text
3. align timeout, token budget, and progress UX with local-model reality
4. keep provider/model state trustworthy across restarts and UI refreshes
5. improve Beta verification until Desktop and Beta behavior are easier to reason about

This PRD is intentionally internal and execution-oriented.
An external-facing product brief or stakeholder PRD should be written later, once the current product phase is stable enough to describe with confidence.
