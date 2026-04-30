# AI Designer Intent Contract

## Purpose

This contract defines how the plugin AI designer should interpret user requests and convert them into structured, designer-level intents.

The goal is not to capture low-level Figma mutations directly. The goal is to normalize user language into a stable intermediate contract that:

- preserves design intent
- is readable by humans
- is executable by plugin-side orchestration
- can be reviewed before applying changes
- can later support implementation handoff to the local coding agent

This document is the source-of-truth draft for plugin-side intent modeling during the hybrid pivot.

## Design Principles

The AI designer contract should follow these rules.

1. Interpret requests at the design level first.
2. Separate user goal from execution details.
3. Prefer explicit structure over free-form action strings.
4. Support partial certainty and follow-up questions when context is missing.
5. Distinguish between propose-only work and apply-in-Figma work.
6. Preserve enough rationale to explain why a change was suggested.
7. Keep the contract stable even if the execution layer changes.

## Intent Lifecycle

The plugin AI designer should process requests through this sequence.

1. Read conversation context, file context, and selection context.
2. Infer the primary design goal.
3. Convert the goal into one or more structured intents.
4. Attach assumptions, missing information, and confidence.
5. Generate a proposed action plan.
6. Either:
   - return suggestions for review, or
   - return executable intents for plugin-side application

## Top-Level Contract Shape

Every parsed designer request should normalize into this top-level shape.

```md
DesignerIntentEnvelope
- version
- requestId
- conversationId
- mode
- summary
- userGoal
- contextScope
- intents[]
- assumptions[]
- questions[]
- risks[]
- explanation
- executionPolicy
```

## Field Definitions

### `version`

Contract version string.

Example:

```json
"1.0"
```

### `requestId`

Unique identifier for this parsed request.

### `conversationId`

Optional plugin chat session identifier.

### `mode`

How the AI should behave for this request.

Allowed values:

- `suggest`
- `apply`
- `handoff`
- `suggest_then_apply`

Meaning:

- `suggest`: produce designer recommendations only
- `apply`: prepare changes for direct Figma execution
- `handoff`: prepare output mainly for local implementation follow-up
- `suggest_then_apply`: present a plan first, then allow apply flow

### `summary`

Short human-readable summary of the interpreted request.

Example:

```json
"Refine the selected pricing section to improve hierarchy and CTA emphasis."
```

### `userGoal`

Plain-language restatement of what the user is trying to accomplish.

This should stay user-centered, not system-centered.

### `contextScope`

Declares where the request applies.

```md
ContextScope
- targetType
- targetIds[]
- pageId
- selectionRequired
- selectionMode
```

Allowed `targetType` examples:

- `current_selection`
- `current_frame`
- `current_page`
- `named_section`
- `generated_screen`
- `component_set`

Allowed `selectionMode` examples:

- `single`
- `multi`
- `optional`
- `none`

## Intent Array

The core of the contract is `intents[]`.

Each item should represent one coherent designer-level action.

```md
DesignerIntent
- id
- kind
- objective
- target
- changeSet
- constraints
- outputExpectation
- rationale
- confidence
- applyReadiness
```

### `id`

Stable per-intent identifier inside the envelope.

### `kind`

Primary design action category.

Recommended starter set:

- `analyze`
- `critique`
- `restructure_layout`
- `improve_hierarchy`
- `adjust_spacing`
- `refine_typography`
- `revise_copy`
- `swap_or_recommend_component`
- `generate_section`
- `generate_screen`
- `adapt_variant`
- `align_to_design_system`
- `prepare_implementation_handoff`

### `objective`

One-sentence statement of what success looks like for this intent.

Example:

```json
"Make the hero section easier to scan and increase CTA prominence without changing the core message."
```

### `target`

Target description for the specific intent.

```md
IntentTarget
- type
- ids[]
- name
- scopeNote
```

Examples of `type`:

- `frame`
- `section`
- `group`
- `component_instance`
- `text_block`
- `selection`
- `page`

### `changeSet`

Structured design changes the AI wants to make.

```md
ChangeSet
- layoutChanges[]
- hierarchyChanges[]
- componentChanges[]
- copyChanges[]
- styleChanges[]
- contentChanges[]
```

This should stay at design-decision level, not raw node-operation level.

Good example:

```json
{
  "layoutChanges": [
    "Convert the feature list from a long vertical stack into a 3-column card grid."
  ],
  "hierarchyChanges": [
    "Increase contrast between section title, supporting copy, and feature labels."
  ],
  "componentChanges": [
    "Replace local button styling with the primary CTA component from the design system."
  ]
}
```

Avoid:

```json
{
  "rawMutation": "set x=120 and width=344"
}
```

### `constraints`

Design boundaries that must not be violated.

```md
Constraints
- preserveContent
- preserveStructure
- preserveDesignSystem
- preserveBrandTone
- accessibilityTargets[]
- implementationConstraints[]
- custom[]
```

Examples:

- preserve existing copy meaning
- stay within current section width
- use existing component library only
- keep mobile-first layout logic
- maintain AA contrast

### `outputExpectation`

What artifact the AI is expected to produce.

Allowed values:

- `analysis`
- `recommended_changes`
- `figma_mutation_plan`
- `new_section`
- `new_screen`
- `design_system_alignment_plan`
- `implementation_handoff_brief`

### `rationale`

Short explanation of why this intent is the right move.

This should be understandable by a designer reviewing the suggestion.

### `confidence`

Normalized confidence level.

Allowed values:

- `high`
- `medium`
- `low`

### `applyReadiness`

Whether the plugin can safely act on this intent immediately.

Allowed values:

- `ready`
- `needs_confirmation`
- `needs_missing_context`
- `analysis_only`

## Assumptions

`assumptions[]` captures inferred facts that may affect correctness.

Examples:

- "The selected frame is the primary desktop hero."
- "The user wants visual refinement, not a full rewrite."
- "The design system contains a valid primary CTA component."

This array is important because designer requests are often underspecified.

## Questions

`questions[]` captures missing information that should block or shape execution.

Each question should include:

```md
DesignerQuestion
- id
- prompt
- reason
- blocking
```

Examples:

- "Should the redesign stay within the current layout footprint?"
- "Do you want copy rewritten or layout only?"
- "Should this be optimized for desktop, mobile, or both?"

Use `blocking: true` when safe execution should pause until answered.

## Risks

`risks[]` captures change risk or ambiguity.

Examples:

- "Current selection mixes local layers and component instances."
- "No matching design-system component was found for the requested pattern."
- "Requested layout change may conflict with existing mobile constraints."

## Explanation

`explanation` is a concise user-facing interpretation of what the AI plans to do and why.

It is intended for chat display and review, not just for internal execution.

## Execution Policy

The envelope should declare how execution is expected to proceed.

```md
ExecutionPolicy
- previewRequired
- allowBatchApply
- requiresSelectionSnapshot
- requiresDesignSystemLookup
- requiresCopyRewriteApproval
- canHandoffToLocalAgent
```

This keeps orchestration decisions separate from the design intents themselves.

## Canonical Intent Families

The plugin AI designer should support these core intent families.

### 1. Analysis And Critique

Purpose:

- understand a screen
- identify problems
- explain opportunities

Examples:

- "What feels off in this onboarding flow?"
- "Review this dashboard like a senior product designer."

Typical kinds:

- `analyze`
- `critique`

### 2. Refinement

Purpose:

- improve an existing design without replacing it

Examples:

- "Tighten the spacing."
- "Make the hierarchy clearer."
- "Improve CTA visibility."

Typical kinds:

- `improve_hierarchy`
- `adjust_spacing`
- `refine_typography`
- `revise_copy`

### 3. Restructure

Purpose:

- meaningfully reorganize layout or information architecture

Examples:

- "Turn this into a card-based section."
- "Split this dense panel into clearer groups."

Typical kinds:

- `restructure_layout`
- `generate_section`

### 4. Generation

Purpose:

- create new design output from a prompt or partial context

Examples:

- "Create a settings screen for this product."
- "Add a pricing comparison section below this hero."

Typical kinds:

- `generate_section`
- `generate_screen`

### 5. Design-System Alignment

Purpose:

- bring work into system consistency

Examples:

- "Replace ad hoc buttons with system components."
- "Normalize spacing and typography to the design system."

Typical kinds:

- `align_to_design_system`
- `swap_or_recommend_component`
- `adapt_variant`

### 6. Implementation Preparation

Purpose:

- prepare design output so a local coding agent can implement it cleanly

Examples:

- "Prepare this screen for engineering handoff."
- "Summarize what changed so implementation can begin."

Typical kinds:

- `prepare_implementation_handoff`

## Intent Granularity Rules

The AI should avoid both extremes:

- one intent that is too vague
- dozens of intents that are too low-level

Recommended rule:

- one intent per meaningful designer action
- combine tightly related changes
- split changes when they affect different goals, targets, or approval needs

Good split:

1. improve hierarchy in hero
2. replace CTA component
3. rewrite supporting copy

Bad split:

1. change title font size
2. change title color
3. move CTA 12px right

## Contract Examples

### Example A: Refinement Request

User request:

```text
이 화면 너무 답답해 보여. 정리해줘.
```

Normalized envelope:

```json
{
  "version": "1.0",
  "mode": "suggest_then_apply",
  "summary": "Refine the selected screen to improve clarity and reduce visual density.",
  "userGoal": "Make the current screen feel less crowded and easier to scan.",
  "contextScope": {
    "targetType": "current_selection",
    "selectionRequired": true,
    "selectionMode": "single"
  },
  "intents": [
    {
      "id": "intent-1",
      "kind": "restructure_layout",
      "objective": "Reduce visual crowding by grouping related content and simplifying section rhythm.",
      "target": {
        "type": "selection"
      },
      "changeSet": {
        "layoutChanges": [
          "Increase separation between major content groups.",
          "Break dense clusters into clearer vertical sections."
        ],
        "hierarchyChanges": [
          "Make section titles and supporting text easier to distinguish."
        ]
      },
      "constraints": {
        "preserveDesignSystem": true,
        "preserveBrandTone": true
      },
      "outputExpectation": "recommended_changes",
      "rationale": "The current composition appears dense and lacks clear grouping.",
      "confidence": "medium",
      "applyReadiness": "needs_confirmation"
    }
  ],
  "assumptions": [
    "The user wants a refinement of the existing design, not a full redesign."
  ],
  "questions": [],
  "risks": [],
  "explanation": "I will reorganize spacing and hierarchy to make the selected screen easier to scan while keeping the existing visual direction.",
  "executionPolicy": {
    "previewRequired": true,
    "allowBatchApply": true,
    "requiresSelectionSnapshot": true,
    "requiresDesignSystemLookup": true,
    "requiresCopyRewriteApproval": false,
    "canHandoffToLocalAgent": false
  }
}
```

### Example B: Generation Request

User request:

```text
이 제품에 맞는 pricing section 하나 만들어줘.
```

Normalized envelope:

```json
{
  "version": "1.0",
  "mode": "apply",
  "summary": "Generate a pricing section aligned with the current product context.",
  "userGoal": "Add a pricing section that fits the product and current design language.",
  "contextScope": {
    "targetType": "generated_screen",
    "selectionRequired": false,
    "selectionMode": "optional"
  },
  "intents": [
    {
      "id": "intent-1",
      "kind": "generate_section",
      "objective": "Create a pricing section with clear plan comparison and a primary CTA.",
      "target": {
        "type": "page"
      },
      "changeSet": {
        "layoutChanges": [
          "Create a multi-plan pricing comparison layout."
        ],
        "componentChanges": [
          "Use system card and button patterns where available."
        ],
        "contentChanges": [
          "Include plan name, price, core features, and CTA."
        ]
      },
      "constraints": {
        "preserveDesignSystem": true,
        "accessibilityTargets": [
          "clear CTA hierarchy",
          "readable price emphasis"
        ]
      },
      "outputExpectation": "new_section",
      "rationale": "The user requested a new pricing section rather than critique of an existing one.",
      "confidence": "medium",
      "applyReadiness": "ready"
    }
  ],
  "assumptions": [
    "The current file provides enough visual language to infer a matching section style."
  ],
  "questions": [
    {
      "id": "q-1",
      "prompt": "How many pricing tiers should be included if not inferred from existing product context?",
      "reason": "Pricing structure affects section layout and copy.",
      "blocking": false
    }
  ],
  "risks": [],
  "explanation": "I will generate a pricing section that follows the file's current design language and uses reusable patterns where possible.",
  "executionPolicy": {
    "previewRequired": false,
    "allowBatchApply": true,
    "requiresSelectionSnapshot": false,
    "requiresDesignSystemLookup": true,
    "requiresCopyRewriteApproval": true,
    "canHandoffToLocalAgent": true
  }
}
```

## Non-Goals

This contract should not directly encode:

- raw canvas coordinates as the main design language
- plugin transport state
- websocket or polling concerns
- low-level mutation batches
- local-repo implementation details

Those belong to lower execution layers or the separate implementation handoff contract.

## Open Questions

This draft still leaves several decisions open.

1. Should copy changes be modeled as a separate first-class intent family?
2. Should the contract support explicit desktop/mobile variants in one envelope?
3. Should intent targets allow semantic labels like `hero`, `pricing`, `testimonial` even before node resolution?
4. Should there be a formal distinction between critique-only and propose-edit intents beyond `mode`?
5. How much of this envelope should be persisted in plugin chat history?

## Recommended Next Steps

1. Implement a parser module that maps chat requests into this envelope.
2. Add tests for the canonical intent families.
3. Define the plugin action executor contract that consumes `DesignerIntent`.
4. Define the local implementation handoff contract as a sibling document.
