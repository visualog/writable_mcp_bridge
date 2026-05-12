# Xbridge AI-First Execution Roadmap

Date: 2026-05-12
Status: Draft for execution
Companion doc: `docs/plans/2026-05-12-xbridge-ai-first-prd.md`

## 1. Purpose

This roadmap translates the AI-first PRD into an execution order.

The goal is not to expand Xbridge in every direction at once.
The goal is to make the core AI-first loop feel reliable:

1. user selects something in Figma
2. user asks the selected model for help
3. model understands the request
4. bridge reads the right context
5. model produces usable output
6. bridge validates and applies it
7. plugin explains what happened clearly

## 2. Roadmap Principles

### 2.1 Reliability before breadth

Do not add wide new design-authoring scope before selected-text flows are trustworthy.

### 2.2 One selected model per session

Execution must preserve single-model ownership.
Do not solve instability by routing different task types to different models.

### 2.3 Progress visibility is part of the feature

Long-running local-model work is not acceptable unless the plugin clearly shows what it is doing.

### 2.4 Validation before polish

Correct output shape and safe apply matter before UI refinement.

### 2.5 Desktop and Beta both matter

Desktop can be the faster path for iteration, but Beta cannot remain an afterthought.

## 3. Phase Overview

### Phase 1

Stabilize the AI-first text loop.

### Phase 2

Make model state, execution state, and failure state trustworthy.

### Phase 3

Expand from text operations into frame-level design assistance and safe action previews.

### Phase 4

Move toward system-aware authoring and larger design-generation workflows.

## 4. Phase 1 - AI-First Text Loop Stabilization

### Objective

Make selected-text translation, rewrite, and title generation feel real, repeatable, and clearly AI-driven.

### Why this phase comes first

This is the smallest meaningful surface where users can feel whether Xbridge is truly AI-first.
If this loop is unstable, larger design actions will not be trusted.

### In scope

- selected text translation
- selected text rewrite
- selected text title generation
- single model request interpretation
- output validation before apply
- progress stages for read, generation, validation, and apply

### Workstreams

#### A. Model request and prompt shaping

- keep original user request intact when sending to the model
- use workload-aware prompt framing for translation, rewrite, and title generation
- reduce unnecessary multi-step AI calls

#### B. Structured output hardening

- standardize line-based or JSON-compatible rewrite output
- recover from minor local-model formatting drift
- block id leakage, meta chatter, and unchanged invalid output

#### C. Timeout and budget tuning

- tune local-model generation budgets by task kind and selection size
- align UI timeout and server timeout expectations
- reduce cases where the plugin fails faster than the model naturally would

#### D. Apply-path correctness

- guarantee selection-to-node mapping
- guarantee update count and node id integrity
- ensure final apply reports are accurate

### Acceptance criteria

- selected translation works consistently for 1, 5, and 20 text nodes
- selected rewrite works consistently for 1, 5, and 20 text nodes
- selected title generation no longer leaks node ids into applied text
- failures distinguish timeout, network, invalid output, and selection sync issues
- progress UI no longer leaves the user staring at a silent or misleading "working" state

### Exit signal

When a user can repeatedly modify selected text through the plugin and trust both the result and the waiting experience.

## 5. Phase 2 - Trustworthy Runtime State

### Objective

Make the plugin's model configuration, connection status, and task state understandable and believable.

### Why this phase matters

Even if the backend logic improves, the product will still feel broken if:

- current model state is unclear
- provider/model mismatch appears in the UI
- restarts silently reset configuration
- tasks fail without a clear cause

### In scope

- provider/model state consistency
- local discovery versus configured model reconciliation
- connection test clarity
- restart and refresh behavior
- Beta-safe settings interactions

### Workstreams

#### A. Configuration state integrity

- ensure configured provider/model survive plugin refresh and server restart predictably
- expose current effective model state in one trustworthy place
- remove UI duplication that causes conflicting state views

#### B. Settings UX stabilization

- use Beta-safe controls instead of fragile native select behavior where needed
- make settings interactions predictable and testable
- show when discovery and configured state diverge

#### C. Failure taxonomy and messaging

- make network, timeout, invalid output, and apply failures distinct in the UI
- separate model connection success from task execution success

#### D. Runtime observability

- record task kind, selected model, retries, chunk count, and end-to-end latency
- expose enough last-run information for debugging without opening server internals

### Acceptance criteria

- the plugin always shows the actual active provider and model
- a restart does not silently leave the user on an unexpected model
- connection test, task execution, and write success are clearly differentiated
- the settings panel is usable in both Desktop and Beta

### Exit signal

When the user can trust that the model shown in the plugin is the model actually doing the work.

## 6. Phase 3 - Frame-Level Design Assistance

### Objective

Expand from text-only reliability into safe AI help for layout, hierarchy, and structure on selected frames or subtrees.

### Why this phase comes after text stabilization

Frame-level actions require deeper reads and broader consequences.
They should only be added after the simpler text loop proves reliable.

### In scope

- explain selected frame structure in user language
- hierarchy critique
- spacing critique
- safe read-plan escalation
- action preview before apply

### Workstreams

#### A. AI-driven read routing

- let the selected model influence whether fast context, focused detail, or deeper read is needed
- reduce bridge-owned heuristic overreach

#### B. Human-readable structural explanation

- describe what the selected frame contains
- explain layout direction, nesting, and key blocks in plain language

#### C. Suggestion and preview flow

- separate "understand", "suggest", and "apply" cleanly
- allow preview-first actions for structural changes

### Acceptance criteria

- selected frame explanation reads naturally and specifically
- hierarchy and spacing requests produce coherent suggestions tied to actual structure
- structural actions do not run on shallow context when deeper reads are required

### Exit signal

When users can ask for analysis and improvement of a selected frame and feel the AI actually understands the structure.

## 7. Phase 4 - System-Aware Authoring

### Objective

Move from isolated edits into design-system-aware and component-aware authoring.

### In scope

- component-aware edits
- variable-aware edits
- reuse of existing patterns
- screen-generation flows with action previews

### Workstreams

- system-aware search and recommendation
- component and variable mutation safety
- multi-step compose flows
- screen-generation contracts based on existing authoring modules

### Acceptance criteria

- the AI can suggest or apply system-aware changes without guessing blindly
- generated screens use existing authoring helpers instead of ad hoc layout mutation
- multi-step changes remain previewable and reversible

### Exit signal

When Xbridge moves beyond copy help into credible AI-assisted design authoring.

## 8. Cross-Phase Quality Gates

These gates apply throughout the roadmap.

### Gate 1: AI-first integrity

- selected model remains the interpretation owner
- bridge does not quietly replace semantic output unless explicitly documented as recovery behavior

### Gate 2: Selection correctness

- the plugin must be modifying the intended current selection
- selection sync errors must surface early

### Gate 3: User-visible progress

- every long task has a visible stage and elapsed time
- completed tasks stop showing as active

### Gate 4: Beta parity tracking

- every major interaction must be verified on Desktop and Beta
- environment-specific bugs must be labeled as transport, UI, or model issues

## 9. What We Should Avoid

- adding major new capabilities to hide basic instability
- treating fallback-generated semantic output as success
- mixing multiple model responsibilities in one session
- prioritizing ops-heavy UI over AI task usability
- optimizing for whole-file discovery before selected-target workflows are strong

## 10. Immediate Next Tasks

These are the next practical priorities after this roadmap.

1. finish hardening selected-text title generation quality and id-leak prevention
2. make runtime configuration state survive restart and UI refresh more predictably
3. tighten progress reporting so model-generation and apply completion are always accurate
4. run repeated Desktop and Beta verification for selected-text tasks
5. produce a current-state scorecard against the PRD

## 11. Suggested Status Format

For future check-ins, use a simple internal status view:

- `green`: working and verified
- `yellow`: partially working, unstable, or environment-specific
- `red`: broken or not yet product-ready

Recommended scorecard categories:

- model configuration
- local discovery
- selected-text translation
- selected-text rewrite
- selected-text title generation
- progress visibility
- Desktop verification
- Beta verification
- frame-level read assistance
- structural preview/apply flow

## 12. Definition of Good Progress

Progress should not be measured by how many endpoints or commands exist.
It should be measured by whether a real user can:

- pick a model
- trust that it is the active model
- ask for a simple change
- understand what is happening while it runs
- get a correct result in Figma

If those five things improve, the product is moving in the right direction.
