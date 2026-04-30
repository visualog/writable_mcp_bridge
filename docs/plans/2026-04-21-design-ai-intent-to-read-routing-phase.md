# Design AI Intent-To-Read Routing Phase

Date: 2026-04-21

Companion note for the design-AI-first read strategy pivot.
This phase turns the broad read-mode model into request routing rules the plugin AI can follow on each turn.

## Goal

Add an intent-to-read routing layer that chooses the minimum read bundle needed for the current design request.

The routing order should stay:

1. fast context first
2. focused detail second when the task needs precision
3. asset lookup only when the task needs system awareness or reuse

## Why This Phase Exists

The pivot already defines the read modes.
What is still missing is the policy that maps user intent to those modes in a predictable way.

Without this phase:

- design requests can accumulate reads ad hoc
- the plugin AI can over-read before it understands the task
- large-file latency stays higher than it needs to be

## Routing Rules

Start every design-AI turn with fast context unless the session already has fresh equivalent context.

Escalate to focused detail when the user asks for:

- critique of layout, spacing, hierarchy, or copy inside a specific area
- structural edits to a selected frame, section, or component subtree
- direct apply actions that would be unsafe from summary context alone

Escalate to asset lookup when the user asks for:

- reuse of existing components or patterns
- design-system alignment
- token, style, or library-aware recommendations

Combine focused detail and asset lookup only when the task needs both local precision and system-aware reuse.

## Initial Intent Map

- "what am I looking at?" -> fast context
- "improve the hierarchy of this card" -> fast context + focused detail
- "tighten spacing in this section" -> fast context + focused detail
- "replace this with our existing button pattern" -> fast context + asset lookup
- "rework this hero using our design system" -> fast context + focused detail + asset lookup

## Outputs

- a small routing table from AI intent class to read bundle
- a default escalation order shared by plugin chat and direct-apply flows
- guardrails that prevent structural actions from running on fast-context-only reads

## Done When

- each major design-AI intent has a default read bundle
- the plugin can explain why it asked for deeper detail or asset data
- read behavior is more consistent across similar design requests
