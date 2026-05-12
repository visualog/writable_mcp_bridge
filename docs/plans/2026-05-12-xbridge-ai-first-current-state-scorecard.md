# Xbridge AI-First Current State Scorecard

Date: 2026-05-12
Status: Working assessment
Companion docs:

- `docs/plans/2026-05-12-xbridge-ai-first-prd.md`
- `docs/plans/2026-05-12-xbridge-ai-first-execution-roadmap.md`

## 1. Purpose

This scorecard evaluates the current Xbridge state against the AI-first PRD.

It is not a release note.
It is an internal truth document meant to answer:

- what is already reliable
- what is partially working but unstable
- what is still not ready to be treated as product truth

Status colors:

- `green`: working and repeatedly verified
- `yellow`: working in part, but unstable, incomplete, or environment-sensitive
- `red`: not yet reliable enough to count as product-ready

## 2. Executive Summary

Current overall state: `yellow`

Why:

- the AI-first direction is now clear in product definition
- transport health and base plugin connectivity are strong
- provider/model selection works in principle, including local-model support
- selected-text tasks are now meaningfully functional

But:

- selected-text title generation quality is still inconsistent
- local-model runtime behavior still needs more tuning than direct Ollama chat
- provider/model state across restart and refresh is not yet fully trustworthy
- Desktop and Beta parity still requires repeated verification

Short version:
Xbridge now looks like a real AI-first product direction, but it does not yet feel fully dependable in repeated everyday use.

## 3. Scorecard

### 3.1 Product Direction Alignment

Status: `green`

Assessment:

- the product is now clearly defined as AI-first
- one selected model per session is a locked direction
- bridge responsibilities are more clearly scoped to execution, validation, and transport
- local open-source models are treated as first-class product targets

Evidence:

- AI-first PRD written
- execution roadmap written
- recent implementation choices are aligned with single-model ownership and progress visibility

Next step:

- keep future work scoped against the PRD and avoid slipping back into bridge-first behavior

### 3.2 Base Bridge Connectivity and Session Health

Status: `green`

Assessment:

- live server health is strong
- active plugin session registration is stable
- ws/sse command transport is in a healthy state in recent checks

Evidence:

- `GET /health` reports healthy transport and ready command state
- active live plugin session is visible
- bridge server can be restarted and reconnected successfully

Next step:

- maintain this as a platform baseline while product-facing issues are addressed

### 3.3 Provider and Model Configuration

Status: `yellow`

Assessment:

- provider/model selection works
- local discovery works
- connection test works
- configured model can be set to Ollama local models such as `gemma4:e4b`

But:

- server restart can temporarily fall back to default model state
- UI trust was previously weakened by mismatched provider/model views
- there is still risk that users doubt whether the shown model is the one actually running

Evidence:

- live reconfiguration to `ollama / gemma4:e4b` succeeds
- connection probe succeeds
- restart behavior showed temporary reversion to default provider/model

Next step:

- make effective runtime config persistence and refresh behavior fully trustworthy

### 3.4 Local Model Discovery

Status: `green`

Assessment:

- local provider discovery works
- Ollama models are being detected and surfaced

Evidence:

- discovery endpoint returns local Ollama state
- UI has already been adjusted to prevent local list pollution by unrelated preset models

Next step:

- keep discovery results and configured state clearly distinguishable in the UI

### 3.5 Selected-Text Translation

Status: `yellow`

Assessment:

- translation is no longer purely fragile
- output cleanup and deterministic recovery for obvious UI labels are materially better
- progress visibility has improved

But:

- local-model timing still varies significantly
- Beta behavior has shown timeout and fetch-related failures
- quality still depends heavily on model output stability

Evidence:

- translation-related tests pass
- deterministic recovery for common UI phrases was added
- repeated live tests showed some successful translations and some failures depending on environment and timing

Next step:

- run repeated Desktop and Beta validation with the same model and the same selection-size buckets

### 3.6 Selected-Text Rewrite

Status: `yellow`

Assessment:

- rewrite path is functional
- AI-first routing is more consistent than before
- bridge validation is stronger than earlier iterations

But:

- some requests still feel slower than direct model chat
- user trust remains fragile when the model is slow and output quality is average

Evidence:

- rewrite and fast-path tests pass
- selected-text workflows now use better progress staging

Next step:

- continue tightening one-call rewrite execution and reduce extra read or validation overhead where safe

### 3.7 Selected-Text Title Generation

Status: `yellow`

Assessment:

- title-generation path exists and is working better than before
- generation budget and timeout tuning have improved the path
- id cleanup has been hardened in more than one parsing stage

But:

- this is still the weakest of the three core text flows
- local-model title quality is still noticeably below direct Ollama chat in some cases
- live user feedback showed both poor title quality and repeated node id leakage before the latest hardening

Evidence:

- tests now cover JSON and line-based id leakage removal
- title-generation generation budget increased
- title-generation timeout increased
- user still reported weak title quality before the latest changes

Next step:

- verify the latest id-leak fix in live Desktop and Beta runs
- tune title-generation prompt framing further if output remains generic

### 3.8 Node ID Leakage Prevention

Status: `yellow`

Assessment:

- protection is now much stronger than before
- cleanup happens in parsing and validation paths

But:

- this area has already regressed more than once
- live behavior must be treated as unproven until repeated manual checks confirm no further leakage

Evidence:

- automated tests now cover line-based and JSON-based leak removal
- previous live screenshots showed leaked ids in applied text

Next step:

- repeat live title-generation tests and explicitly confirm that no `id...` prefix reaches applied Figma text

### 3.9 Progress Visibility

Status: `yellow`

Assessment:

- progress UX is materially better than before
- the plugin now shows stage-based activity instead of only abstract waiting states

But:

- stage timing still needs to stay aligned with real completion
- some earlier runs completed work in Figma while the UI still showed "working"

Evidence:

- stage-based progress plan added
- elapsed-time framing and stage detail improved
- prior user feedback showed stale in-progress perception

Next step:

- verify that progress terminates promptly on actual success, failure, or retry exhaustion

### 3.10 Failure Classification

Status: `green`

Assessment:

- the product now has clearer failure categories
- user-facing messages distinguish several important classes of failure

Evidence:

- explicit distinction exists for network failure, timeout, invalid model output, and selection issues
- test coverage exists around invalid model output and timeout-style cases

Next step:

- keep this taxonomy stable and propagate it into more runtime summaries

### 3.11 Desktop Verification

Status: `yellow`

Assessment:

- Desktop has shown meaningful successful cases
- this remains the more stable environment for iterative validation

But:

- there are still slow or inconsistent runs in local-model paths
- trust is not yet high enough to call the experience consistently product-ready

Evidence:

- several selected-text tasks succeeded in Desktop tests
- repeated tasks still showed latency concerns and mixed quality

Next step:

- continue repeated regression passes on 1, 5, and 20 node text operations

### 3.12 Beta Verification

Status: `red`

Assessment:

- Beta remains the least trustworthy environment in current testing
- read or rewrite failures still occur more often than acceptable
- settings interactions and fetch behavior have previously shown instability

Evidence:

- prior Beta tests showed `fetch failed`, timeout-like failures, and fragile settings interaction
- Beta was explicitly called out by the user as continuing to fail when Desktop sometimes succeeded

Next step:

- treat Beta parity as an active stabilization project, not a cleanup item

### 3.13 Frame-Level Read Explanation

Status: `yellow`

Assessment:

- the product has the building blocks for better structural explanation
- request routing and read planning are improving

But:

- user feedback showed that explanations were previously too operational and not descriptive enough
- the current experience still needs stronger human-readable summarization of what is selected and how it is structured

Evidence:

- existing read-plan and suggestion infrastructure exists
- user explicitly asked for more understandable progress and structural explanation

Next step:

- improve selected-frame explanation content so it describes structure, content, and intent in user language

### 3.14 Frame-Level Safe Apply and Preview

Status: `yellow`

Assessment:

- preview/apply infrastructure exists
- safe execution direction is credible

But:

- this is not yet the product's most trusted surface
- structural changes still need more consistent read depth and preview discipline

Evidence:

- action preview and confirm flows are implemented and tested
- broader user trust is still centered on whether simple text tasks work reliably

Next step:

- do not expand this aggressively before text-loop trust is stronger

## 4. Current Top Risks

### Risk 1: Local model trust gap versus direct Ollama chat

The user sees better output quality and more natural waiting behavior in direct Ollama chat than in Xbridge.

Impact:

- undermines confidence in the plugin product
- makes bridge execution feel worse than raw model use

Immediate response:

- continue tuning title-generation prompts and budgets
- keep progress visibility improving
- reduce unnecessary execution-path overhead

### Risk 2: Configuration trust after restart

If restart or refresh can make the active runtime model unclear, users will question every result.

Impact:

- damages confidence even when tasks succeed

Immediate response:

- make effective runtime config state explicit and persistent

### Risk 3: Beta instability remains too visible

If Beta continues to fail while Desktop works, the product feels inconsistent and fragile.

Impact:

- slows adoption
- complicates debugging

Immediate response:

- keep Beta-specific verification and issue labeling as a tracked workstream

## 5. Immediate Priorities

Ordered by current importance:

1. verify the latest title-generation and id-leak fixes in live Figma runs
2. make restart and refresh model state trustworthy
3. tighten progress completion accuracy
4. continue repeated Desktop/Beta test passes for selected-text flows
5. improve selected-frame explanation quality so progress and structure feel human-readable

## 6. Summary

The project is no longer directionless.
It now has:

- a defined AI-first product stance
- a clear execution roadmap
- a measurable current-state view

The strongest parts today are:

- product direction clarity
- base bridge connectivity
- local-model support foundations
- failure classification

The weakest parts today are:

- title-generation quality consistency
- restart-time configuration trust
- Beta stability
- repeated user confidence in live plugin behavior

Overall judgment:
Xbridge is moving from experimental bridge behavior toward a real AI-first Figma product, but it is still in the stabilization phase rather than the dependable product phase.
