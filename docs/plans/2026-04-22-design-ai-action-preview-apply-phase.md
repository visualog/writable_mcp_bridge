# Design AI Action Preview/Apply Phase

Date: 2026-04-22

Short follow-on note for the design-AI suggestion builder work.
This phase starts after the suggestion builder produces ranked recommendations and candidate apply actions.

## Goal

Add an action preview/apply layer that converts a chosen suggestion into:

- a compact preview of the exact change scope
- explicit confirmation and safety requirements
- a clear next step: apply in Figma, stay in suggest mode, or hand off for implementation

## Why This Phase Exists

The suggestion builder can explain what should change.
The next product step is showing what the plugin is about to do and making that apply path safe and legible.

Without this phase:

- candidate apply actions can feel opaque or overconfident
- users cannot easily confirm scope before mutation
- direct Figma apply and implementation handoff can drift apart

## Preview/Apply Rules

Start from the selected suggestion and its supporting read evidence, not from a new freeform guess.

The action preview/apply layer should:

- generate a readable preview with target, intended edits, affected scope, and expected outcome
- require fresh focused detail before structural or multi-node apply actions
- prefer preview-first behavior for edits that touch several nodes or system assets
- surface blockers when selection precision, asset lookup, or confirmation is missing
- keep direct Figma apply separate from implementation handoff, even when both follow the same diagnosis
- return whether the next step is confirm apply, narrow the scope, stay in suggest mode, or prepare handoff

## Outputs

- `actionPreview`: concise summary of the exact change plan
- `applyReadiness`: status, blockers, and required confirmation level
- `applyMode`: whether the plugin should `figma_apply`, `suggest_only`, or `implementation_handoff`
- `executionRequest`: normalized payload for an existing authoring command path or handoff contract

## Done When

- users can see what will change before the plugin mutates Figma
- apply requests fail closed when required detail or confirmation is missing
- the same suggestion leads to a stable preview/apply decision across similar turns
