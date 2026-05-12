# Xbridge AI-First Stabilization Backlog

Date: 2026-05-12
Status: Active backlog
Companion docs:

- `docs/plans/2026-05-12-xbridge-ai-first-prd.md`
- `docs/plans/2026-05-12-xbridge-ai-first-execution-roadmap.md`
- `docs/plans/2026-05-12-xbridge-ai-first-current-state-scorecard.md`

## 1. Purpose

This backlog turns the current-state scorecard into concrete execution work.

It is intentionally short-horizon and stabilization-focused.
It should answer:

- what do we fix next
- why does it matter
- what does "done" look like

## 2. Prioritization Rules

Use these rules when choosing what to do next.

1. unblock repeated real-user flows before adding new feature breadth
2. prefer fixes that improve trust in the selected-model AI-first loop
3. fix live user pain before internal polish
4. treat Beta issues as product issues, not optional cleanup
5. do not hide product problems behind silent fallback behavior

## 3. P0 - Must Stabilize Now

### P0-1. Title generation quality for selected text

Problem:

- title generation is still the weakest core text flow
- direct Ollama chat can produce better results than Xbridge

Why it matters:

- this is one of the most visible proofs of whether the product feels AI-first
- poor titles make the plugin feel less capable than using the model directly

Tasks:

- refine local title-generation prompt framing
- tune title-generation generation budget further if needed
- reduce generic filler outputs such as "관련 게시물 제목"
- verify quality on 1, 5, and 20 selected text nodes

Done when:

- repeated title-generation runs produce specific, publishable Korean titles
- live runs no longer obviously underperform direct Ollama chat for the same request shape

### P0-2. Eliminate remaining node id leakage in applied text

Problem:

- leaked node ids have already appeared in user-visible applied text

Why it matters:

- this directly breaks trust in the product
- users perceive it as the system exposing internals instead of doing the job

Tasks:

- run repeated live title-generation tests in Desktop
- run repeated live title-generation tests in Beta
- verify both line-based and JSON-shaped model outputs
- add any missing cleanup in final apply path if needed

Done when:

- no `id...` prefix appears in final applied Figma text across repeated manual runs

### P0-3. Make active model state trustworthy after restart and refresh

Problem:

- runtime model state can become confusing after server restart

Why it matters:

- if users doubt which model is active, every result becomes suspect

Tasks:

- identify current configuration persistence model
- ensure runtime effective config survives restart predictably
- clearly expose active provider/model after reconnect
- verify plugin UI refresh reflects the actual current runtime model

Done when:

- restart and reconnect do not leave the user unsure which model is active

### P0-4. Progress completion accuracy

Problem:

- earlier runs showed tasks finishing in Figma while the plugin still looked active

Why it matters:

- slow work is acceptable only if the user can trust what the plugin says is happening

Tasks:

- trace progress lifecycle from request start to apply completion
- ensure terminal states close the active progress loop
- verify retry, success, timeout, and invalid-output end states

Done when:

- completed tasks stop showing as active immediately or near-immediately
- failed tasks show explicit failure completion instead of lingering work state

## 4. P1 - High Value Stabilization

### P1-1. Desktop selected-text regression pass

Problem:

- selected-text flows have improved, but repeated trust has not yet been proven

Tasks:

- create a repeatable Desktop validation set for:
  - translation
  - rewrite
  - title generation
- test 1, 5, and 20 selected text nodes
- capture rough latency and outcome quality

Done when:

- Desktop results are repeatable enough to move key text flows toward green

### P1-2. Beta selected-text regression pass

Problem:

- Beta is still the weakest verified environment

Tasks:

- repeat the same validation set used in Desktop
- classify each failure as:
  - transport
  - settings/UI
  - model timeout
  - invalid model output
  - apply failure

Done when:

- Beta-specific failures are clearly separated and tracked instead of blended into generic instability

### P1-3. Selected-frame explanation quality

Problem:

- structural explanations have felt too operational and not descriptive enough

Tasks:

- improve explanation wording for selected frames
- make outputs describe content, structure, and likely intent
- reduce low-context operational narration

Done when:

- a selected frame explanation reads like a useful design description rather than a bridge log

### P1-4. Settings panel interaction stability

Problem:

- settings controls have previously felt fragile, especially in Beta

Tasks:

- review current interaction model for provider/model selection
- confirm every control is reliably clickable and stateful
- reduce duplicated or conflicting settings entry points if needed

Done when:

- the user can reliably inspect and change model settings without UI ambiguity

## 5. P2 - Expand After Core Trust Improves

### P2-1. Frame-level hierarchy critique

Goal:

- allow useful hierarchy critique on selected frames after text-loop trust is stronger

Done when:

- the model can explain hierarchy problems in specific user language tied to actual structure

### P2-2. Safe structural preview/apply

Goal:

- let the AI suggest structural changes with preview-first discipline

Done when:

- structural change requests clearly separate suggestion, preview, and apply

### P2-3. System-aware component and variable edits

Goal:

- move toward reusable component and token-aware authoring

Done when:

- the AI can safely use design-system-aware helpers without guessing blindly

## 6. Suggested Execution Order

Recommended near-term order:

1. P0-2 node id leakage verification and closure
2. P0-3 active model state trust after restart
3. P0-4 progress completion accuracy
4. P0-1 title generation quality tuning
5. P1-1 Desktop regression pass
6. P1-2 Beta regression pass
7. P1-4 settings panel interaction stability
8. P1-3 selected-frame explanation quality

## 7. Backlog Review Habit

When a backlog item is worked:

- update the scorecard category it affects
- record whether it moved the category toward green
- avoid calling an item done based on one successful run

The backlog should stay small.
If a task does not clearly improve the AI-first loop, it should not outrank current stabilization work.
