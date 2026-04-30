# Design AI Suggestion Builder Phase

Date: 2026-04-21

Short follow-on note for the design-AI read routing and read execution work.
This phase starts after `executeDesignerReadPlan` finishes and turns read results into designer-facing reasoning and suggestions.

## Goal

Add a suggestion-builder layer that converts executed read output into:

- a compact diagnosis of the current design situation
- 1 to 3 ranked suggestions with clear reasoning
- explicit evidence tied to fast context, focused detail, and asset lookup results

## Why This Phase Exists

Read execution tells us what was inspected.
The next product step is deciding what the AI should say or recommend because of that data.

Without this phase:

- the plugin can return raw read payloads without a usable design judgment
- similar requests can produce inconsistent suggestion quality
- users cannot easily see why a suggestion was made

## Builder Rules

Start from the executed phase results, not from raw prompt text alone.

The suggestion builder should:

- summarize the target, key issue, and likely opportunity
- prefer evidence-backed suggestions over broad generic advice
- separate observation, recommendation, and confidence
- include design-system-aware options only when asset lookup actually ran
- avoid direct-apply recommendations when required detail reads failed

## Outputs

- `designSummary`: short diagnosis of the selected area or page
- `suggestions`: ranked list with title, rationale, evidence, and expected outcome
- `nextAction`: whether the AI should stay in suggest mode, ask for confirmation, or prepare apply/handoff

## Done When

- the same read result produces stable suggestion structure across similar turns
- the plugin can explain which read evidence supports each recommendation
- suggestion quality improves without requiring deeper reads on every request
