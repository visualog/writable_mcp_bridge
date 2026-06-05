# Intent Classification Goal Map

Date: 2026-05-28

## Purpose

The project goal names user-facing intents that are more specific than the older internal execution intents. The bridge still needs stable internal route names, so Xbridge now separates:

- `userIntentKind`: the goal-level intent visible to product/debug flows
- `internalIntentKind`: the existing route/execution intent used by read/build/apply code

This avoids breaking existing routing while making the user's requested workflow classification explicit.

## Current Mapping

| userIntentKind | internalIntentKind | Use |
| --- | --- | --- |
| `image_to_screen` | `generate_screen` | Analyze selected image/screenshot/frame and create editable Figma screen layers |
| `image_analysis_only` | `inspect_selection` | Read/analyze image or selection without creating a new screen |
| `improve_generated_screen` | `generate_screen` | Improve or regenerate an existing generated screen |
| `compare_reference_and_generated` | `inspect_selection` | Compare source/reference against generated output |
| `inspect_selection` | `inspect_selection` | Read selected Figma node structure/details |
| `revise_copy` | `revise_copy` | Rewrite selected text/copy |
| `apply_design_system` | `align_to_design_system` | Align selected design to tokens/components/library conventions |
| `debug_bridge_failure` | `inspect_selection` | Classify bridge/image-generation failure investigation requests |

## Implementation

Implemented in `src/ai-designer-intents.js`:

- `inferDesignerUserIntentKind`
- `mapDesignerUserIntentKindToInternal`
- `intentClassification` on the intent envelope
- `userIntentKind` on the primary intent skeleton

Existing internal read plans still receive the internal intent, so current routes remain compatible.
Goal-level user intents now also drive the internal read route when there is no explicit override. This prevents comparison requests that contain generic words like "화면" from being routed as `generate_screen`; `compare_reference_and_generated` now stays on the `inspect_selection` route and avoids generation-only snapshot reads.

`image_analysis_only` is now wired into `/api/designer/chat` as a no-build image workflow:

- selected image/frame export still runs
- Codex image analysis still produces `canvasSpec`, `roleMap`, `layoutMap`, `textStyleMap`, and semantic quality
- `performBuildLayout` is not called
- no Figma layer creation commands are queued
- response uses `intentKind:"inspect_selection"` with `intentClassification.userIntentKind:"image_analysis_only"`
- screen-generation quality gates are reported as diagnostics instead of failing the analysis-only response
- Codex image-analysis timeout is wrapped as `debug_bridge_failure` with `details.imageLayoutQuality.stage:"image_analysis_codex"` and `failureSource:"codex_cli_timeout"`

`compare_reference_and_generated` is now wired into `/api/designer/chat` before the image-to-screen branch:

- requires at least two selected nodes; the first is treated as reference and the second as generated output
- reads both nodes with bounded `get_metadata` first (`includeJson:true`, `maxDepth:6`, `maxNodes:300`) and falls back to bounded `get_node_details` only if metadata cannot be read
- compares editable TEXT layer coverage instead of relying on node counts alone
- reports `missingTexts`, `extraTexts`, `matchedTexts`, `textCoverage`, per-text `bboxDeltas`, and type distribution
- reports `visualDeltas` for first-pass visual fidelity diagnostics:
  - role count differences for non-text UI elements such as progress bars, images, controls, icons, containers, and shapes
  - missing/extra visual roles when the generated tree has fewer or more comparable UI elements than the reference
  - color deltas for matched role/name visual elements
  - geometry deltas for matched non-text visual elements whose x/y/width/height differ materially
  - root screen frames and large source/reference image layers are excluded from geometry deltas so side-by-side canvas placement and clipped screenshot backing layers do not become repair targets
  - status/navigation/browser bars are classified as `status_bar` before the broader progress/bar heuristic runs, preventing `iOS status bar` from being counted as a progress bar
  - spacing deltas for matched text pairs whose vertical gap differs materially
  - `groupDeltas` for component-like groups whose descendant text signature exists in the reference but is not preserved as a grouped structure in the generated tree
- returns deterministic comparison output without invoking Codex
- keeps this as a quality diagnostic, not a Figma mutation

`improve_generated_screen` now has a comparison-backed planning path:

- when the request is classified as `improve_generated_screen` and at least two nodes are selected, Xbridge reads the first selected node as reference and the second as generated output
- it reuses the reference/generated comparison result
- it returns an `improvementPlan` with action candidates:
  - `create_missing_text` for visible reference text missing in the generated tree
  - `remove_hallucinated_text` for placeholder/helper text present only in the generated tree
  - `realign_text_bbox` for matched text whose generated bbox differs materially from the reference bbox
- it now also returns a `generated_screen_repair` apply action and `designerActionPreviewBundle`
- the preview exposes a high-level `generated_screen_repair` mutation candidate first, followed by lower-level debug/step candidates for `bulk_create_nodes`, `bulk_update_nodes`, and `delete_node`
- the action-candidate preview/confirm API now accepts those repair candidates:
  - `generated_screen_repair` runs missing-text creation, bbox updates, generated-only text deletion, and optional post-apply verification as one confirmed workflow
  - the repair preview now carries `visualRepairs` derived from `visualDeltas`, including missing/extra visual roles, color updates, spacing updates, and component-like group repair suggestions
  - `visualRepairs.colorUpdates` with stable `generatedNodeId` targets are promoted into executable `bulk_update_nodes` fill-color mutations inside the high-level repair workflow
  - `visualRepairs.geometryUpdates` with stable `generatedNodeId` targets are promoted into executable `bulk_update_nodes` x/y/width/height mutations only for bounded editable visual roles (`progress`, `image`, `icon`, `shape`, `control`)
  - diagnostic-only visual roles such as `status_bar`, broad containers, and large source/reference image layers remain in `visualDeltas` but are not automatically promoted into mutation candidates
  - `visualRepairs.spacingUpdates` with stable `generatedNodeId` and `targetY` values are promoted into executable `bulk_update_nodes` y-position mutations inside the high-level repair workflow
  - `bulk_create_nodes` creates deterministic TEXT node previews from missing reference text
  - `bulk_update_nodes` previews and applies bbox corrections for matched generated text nodes
  - `delete_node` previews and applies removal of generated-only placeholder/helper text nodes
- when `verifyAfterApply` is supplied to the confirm API, Xbridge re-reads the reference/generated nodes after mutation and returns:
  - `postApplyComparison`
  - `qualityVerification.improved`
  - text coverage, missing text, extra text, and material bbox delta changes
- this is still explicit confirmation oriented; it does not automatically mutate the generated Figma screen from chat alone

`image_to_screen` post-build validation now separates structural creation from visual placement quality:

- after `build_layout` returns, Xbridge re-validates the generated tree against the image analysis `roleMap`
- visible role labels must not only exist as TEXT nodes; when the reference role has a bbox, the generated text must also be near the same x/y region
- post-build text coverage cannot be relaxed below the labels already recognized during semantic analysis; if semantic analysis covered all visible labels but the built Figma tree drops some of them, the build now fails
- misplaced generated text now fails with `postBuildBboxAlignmentTooLow`, `bboxAlignedRoleLabelCount`, `requiredBboxAlignedRoleLabelCount`, and `bboxMisalignedRoleLabels`
- non-text visual roles such as progress bars, toggles, navigation bars, hero/media blocks, cards, charts, and tables must also have a corresponding positioned generated component near the reference bbox
- missing non-text roles now fail with `postBuildVisualRoleCoverageTooLow`, `visualRoleCoveredCount`, `requiredVisualRoleCount`, and `missingVisualRoleLabels`
- these checks catch recurring failure modes where recognized copy is stacked in the wrong header/body area, or where the pre-build tree had recognized text but the final Figma build drops title/list labels

## Verification

Targeted tests:

```bash
node --check src/ai-designer-intents.js
node --check src/server.js
node --check src/ai-designer-action-preview.js
node --check src/codex-cli-runner.js
node --test tests/ai-designer-action-preview.test.js
node --test tests/ai-designer-compare-reference.integration.test.js
node --test tests/ai-designer-image-analysis-timeout.integration.test.js
node --test tests/ai-designer-chat-api.integration.test.js
node --test tests/codex-cli-runner.test.js --test-name-pattern "analysis-only output"
node --test tests/ai-designer-intents.test.js tests/ai-designer-chat-api.integration.test.js --test-name-pattern "image analysis only|prioritizes image-based|keeps image implementation|goal-level image workflow"
```

Result: targeted checks passed. `tests/ai-designer-compare-reference.integration.test.js` verifies that a comparison request reads the selected reference/generated nodes and returns text coverage plus bbox deltas instead of entering image generation. It now also verifies `visualDeltas`: missing progress role detection, matched visual color delta detection, matched visual geometry delta detection, text-pair spacing delta detection, and missing component-like group detection for a reference Results card whose text exists in the generated screen but is not preserved as a grouped card structure. It also verifies that `improve_generated_screen` turns the comparison into an `improvementPlan` and a previewable `generated_screen_repair` apply action, then previews and confirms the high-level `generated_screen_repair` workflow through the bridge mutation queue. The repair preview preserves `visualRepairs` so the UI/workflow can surface visual role, color, geometry, spacing, and group repair suggestions. Stable `colorUpdates` are now executable: the high-level repair workflow includes a fill-color update for the generated visual node when `generatedNodeId` and `referenceColor` are known. Stable `geometryUpdates` are executable too: the high-level repair workflow includes x/y/width/height updates for matched non-text visual nodes when `generatedNodeId` and reference geometry are known. Stable `spacingUpdates` are also executable: the high-level repair workflow includes a y-position update for the generated text node when `generatedNodeId` and `targetY` are known. The same test verifies `verifyAfterApply`: after mutation, the bridge re-runs reference/generated comparison and reports that text coverage improved, missing/generated-only text counts dropped, and material bbox deltas dropped. It also keeps coverage for lower-level `bulk_create_nodes`, `bulk_update_nodes`, and `delete_node` repair candidates. `tests/ai-designer-action-preview.test.js` verifies that the repair action exposes the high-level workflow candidate plus lower-level command candidates. `tests/ai-designer-chat-api.integration.test.js` verifies the existing action-candidate preview/confirm API still works for Codex text and variant write plans. `tests/ai-designer-image-analysis-timeout.integration.test.js` verifies that an `image_analysis_only` Codex timeout returns HTTP 504, `code:"debug_bridge_failure"`, `codexStatus:"timeout"`, and diagnostic details for the `image_analysis_codex` stage. The codex runner analysis-only targeted run passed 48/48 because the Node test runner still evaluated the file's full active suite.

Additional post-build fidelity check: `tests/codex-cli-runner.test.js` verifies that `validateGeneratedImageBuildQuality` rejects generated image screens where visible text labels are present but placed away from their reference role bbox.
It also verifies that generated screens fail when the reference analysis includes a non-text visual role, such as a progress bar, but the generated tree omits a matching positioned component.
Live check on `2026-05-28` against selected frame `33405:337` (`Running Challenge screen`) exposed a quality gap: the response returned `ok:true` while `postBuildQuality.missingRoleLabels` still contained `November Victory`, `Berlin • 21 Oct`, `1. Lara`, `52 pts`, `3. You`, and `38 pts`. The post-build required text coverage now uses the maximum of roleMap visible labels, semantic covered labels, and semantic required labels so this class of build-drop regression is rejected.

After the stricter text-coverage change, the same live request was run again against `33405:337`. The request returned `ok:false`, `code:"codex_cli_image_layout_understructured"` before Figma build because the semantic gate caught `textWrapRiskTooHigh:true` and `componentBBoxSizeTooLow:true`. The reported details included wrap risk around `Newsletter Victory` / `Dates: 1 of 26` and component bbox mismatch around the message/results areas. This confirms the live path is no longer treating a weak image reconstruction as success, but the generated plan quality is still not sufficient for the overall project goal.

The image-layout retry prompt now carries those concrete failed labels forward. When `textWrapRiskTooHigh` or `componentBBoxSizeTooLow` is true, the retry prompt includes the specific `wrapRiskRoleLabels` and `componentBBoxMismatchLabels`, not just aggregate counts. This gives the second Codex attempt direct targets such as `Newsletter Victory`, `Dates: 1 of 26`, `Message with Newsletter Victory`, and `Results`.

Understructured image-layout failures now also return `details.imageLayoutQualitySummary` alongside the raw metrics. The summary groups boolean failure flags, target labels to fix (`missing`, `wrapRisk`, `componentTooSmall`, `bboxMisaligned`, and related buckets), compact counts, retry outcome, and concrete next actions. This lets the UI show actionable guidance without re-deriving it from the raw quality object.

`coerceImageLayoutTree` now has a narrowly scoped roleMap bbox repair pass for final editable tree normalization:

- roleMap entries that contain only `role`/`label`/`bbox`, without explicit `implementation` or `visualStyle`, can still correct generated layer geometry
- single visible-label text roles can expand their matching TEXT node to the observed bbox, preventing final layers such as narrow header titles from being left at placeholder widths
- component-like roles such as rows, buttons, cards, toggles, chips, coupons, tab bars, and browser/toolbars can expand their matching container node to the observed bbox
- multi-label roles such as tables/lists are intentionally excluded from text-node bbox expansion so individual cells are not stretched to the whole group bbox
- semantic quality validation still runs on the un-repaired model candidate first; the repair pass is applied after validation for final output normalization, so bad candidates are not hidden from the understructured-layout gate

Live `image_to_screen` check against selected frame `33405:337` on `2026-05-28` generated a new editable screen rooted at `33405:544`. The request returned `ok:true`, and the semantic gate reported 24/24 visible labels covered with no bbox/wrap/component-size failures. However, readback still showed visible fidelity gaps: the generated top navigation was only 160px wide and several schedule rows remained 160px wide inside a 344px list. This means semantic success still does not prove final visual fidelity.

The follow-up `compare_reference_and_generated` request against reference `33405:337` and generated `33405:544` exposed another workflow gap: live `get_node_details` returned shallow FRAME-only payloads for both nodes, so the old comparison logic reported 0 reference texts, 0 generated texts, and a false 100% match. The comparison path now records `comparison.readQuality` and treats shallow/empty detail payloads as insufficient evidence:

- when both reference and generated detail payloads contain no comparable text and only root-level structure, `readQuality.sufficient` is `false`
- `textCoverage` becomes `0` instead of `1`
- the summary states that the node details were not read deeply enough
- the finding severity becomes `medium`
- recommendations tell the caller to re-read detailed reference/generated structure before judging fidelity

This prevents a generated screen from being treated as visually verified when the comparison stage did not actually inspect the editable child layers.

The first shallow-read fix used `get_node_details` with `includeChildren:true`, but live `detailLevel:"full"` and then `detailLevel:"layout"` reads still timed out on the Running Challenge frames. The comparison read path now uses metadata-first bounded reads:

- primary command: `get_metadata` with `targetNodeId`, `includeJson:true`, `maxDepth:6`, and `maxNodes:300`
- fallback command: `get_node_details` with `includeChildren:true`, `detailLevel:"layout"`, `maxDepth:4`, and `maxNodes:160`
- if both reads fail, comparison returns an insufficient `readQuality` payload instead of throwing away the diagnostic shape

Live check on `2026-05-28` against reference `33405:337` and generated `33405:544` now returns without timeout. The response reported `readQuality.sufficient:true`, `referenceTextCount:44`, `generatedTextCount:19`, `textCoverage:0.205`, 35 missing reference texts, 10 generated-only texts, and 9 bbox deltas. This proves the compare workflow now reads real child layers instead of reporting a false 100% match, while also showing the generated screen still falls short of the final visual-fidelity goal.

The same live check now keeps intent classification internally consistent: `intentKind:"compare_reference_and_generated"`, `intentClassification.userIntentKind:"compare_reference_and_generated"`, and `intentClassification.internalIntentKind:"inspect_selection"`. The `readPlan.intentKind` is also `inspect_selection`, so compare requests no longer look like screen-generation work inside the envelope.

The semantic quality gate also now rejects list/card/section children that collapse far below the parent width. This targets the live failure where the generated `Schedule list` was 344px wide but its repeated rows were only 160px wide. The new details are:

- `childComponentWidthTooLow`
- `shrunkenChildComponentLabels`

The retry prompt names those narrow internal rows so the next layout attempt can rebuild schedule/results/message rows as full-width children rather than small left-aligned fragments.

`improve_generated_screen` repair planning now turns missing non-text visual primitives into executable creation candidates, not only advisory `visualRepairs`. The comparison stage carries `visualDeltas.missingRoleEntries`, and the repair plan derives `createVisualNodes` for bounded editable layers such as avatars, icons, progress bars, controls, and shapes. Large source/reference image layers and broad container/group frames are excluded from automatic visual creation so the repair action does not duplicate the original screenshot or create empty table/card shells. These broader structural gaps remain surfaced under `visualRepairs.groupRepairs` for a safer follow-up workflow.

Live check on `2026-05-28` against reference `33405:337` and generated `33405:544` confirmed the improved repair plan returns `createTextNodes:35`, `createVisualNodes:13`, and no longer proposes the full `Source image reference` frame as the first visual creation candidate. The first visual candidate was a bounded avatar layer (`missing-visual-Left runner avatar`, 72x72), which is a safer editable reconstruction target.

Post-apply verification now tracks visual improvement, not only text and bbox deltas. `qualityVerification.metrics` includes:

- `missingVisualRoleBefore` / `missingVisualRoleAfter` / `missingVisualRoleDelta`
- `missingVisualEntryBefore` / `missingVisualEntryAfter` / `missingVisualEntryDelta`

A confirmed repair is only considered improved when text coverage, missing/extra text, material bbox deltas, and missing visual role/entry counts do not regress, and at least one of those dimensions improves. The compare integration test now simulates creating a missing progress bar and verifies that post-apply comparison reports `missingVisualEntryDelta:-1` and `missingVisualRoleDelta:-1`.

Group fidelity now has an executable repair path for the common case where the generated screen has the right text nodes but they are not grouped like the reference. `groupDeltas.missingGroups` now includes `generatedTextNodeIds` and `generatedTextCoverage` when every text in a reference group can be found in the generated tree. `buildGeneratedScreenRepairPlanFromComparison` converts fully covered missing groups into `regroupNodes` candidates. During confirmed `generated_screen_repair`, Xbridge creates a replacement FRAME with the reference group bbox and then issues `move_node` commands to move the matching generated text nodes under that frame. This is safer than creating an empty card/table shell because it reuses existing editable children.

Partial group repair is now supported for table/control-like structures. When a missing reference group has at least two generated text matches, at least four reference text entries, and `generatedTextCoverage >= 0.4`, Xbridge creates a `regroupNodes` candidate marked `partial:true`. This is intentionally limited to `control` and `container` roles so status bars and low-confidence progress/card groups remain diagnostic-only. Live improve on `2026-05-29` for `33405:337` and `33405:544` returned `missingGroupCount:2`, `partialGroupCount:1`, and `regroupNodes:1`; the partial regroup candidate was `Results table` with `coverage:0.438` and 7 existing generated text nodes.

Partial regroup is now also part of post-apply quality verification. `qualityVerification.metrics` includes `partialGroupMatchBefore`, `partialGroupMatchAfter`, and `partialGroupMatchDelta`, and a confirmed repair is not considered improved if partial group matching regresses. The compare integration test covers a `Results table` repair where only `Results` and `Me` initially exist; after the repair creates the missing text nodes and groups the existing matches, post-apply verification reports `partialGroupMatchDelta:1` and `improved:true`.

Post-apply verification now also measures group fidelity. `qualityVerification.metrics` includes `missingGroupBefore`, `missingGroupAfter`, and `missingGroupDelta`, and the repair is only considered improved when missing group count does not regress. The compare integration test simulates a `Results card` regroup repair and verifies that the post-apply comparison reports `missingGroupDelta:-1` after the generated text nodes are moved under the newly created frame.

Comparison geometry is now normalized against the selected screen's own origin before bbox deltas are calculated. When the selected root frame does not provide a trustworthy origin, Xbridge derives a fallback origin from child geometry and uses it if the reported root bounds are inconsistent with child positions. This prevents side-by-side canvas placement from inflating `deltaX` by hundreds of pixels. Live compare on `2026-05-29` for reference `33405:337` and generated `33405:544` changed the first matched text bbox delta from a canvas-offset style `deltaX:867` to an internal-layout delta of `deltaX:-7`, `deltaY:28`.

Visual geometry deltas now apply the same principle to non-text UI elements. The comparison excludes the selected root frames and large `Source image reference` / reference screenshot backing layers from visual geometry repair candidates, so canvas placement and clipped viewport image layers do not create false `update_visual_bbox` actions. Status/browser/navigation bars are classified as `status_bar` before the broader `bar`/progress heuristic and are reported as non-actionable diagnostics instead of executable geometry deltas.

Post-apply comparison exposed another bbox regression source: clipped/backing layers and nested parent-local children were polluting root-origin fallback. After a live `generated_screen_repair` confirm, text coverage improved to `1.0`, missing/extra text dropped to `0`, and missing visual entries dropped from `17` to `3`, but material bbox deltas incorrectly rose to `24` because generated descendants with local `y:-26` shifted the whole comparable coordinate system. Root origin fallback now derives from direct children only and skips `Source image reference` backing layers; nested local child geometry no longer changes the selected screen origin. Re-running live compare on `2026-05-29` for `33405:337` and `33405:544` returned `textCoverage:1`, `missingTextCount:0`, `extraTextCount:0`, and `materialBboxDeltaCount:1`.

Follow-up repair also exposed two group-repair correctness issues. First, live `bulk_create_nodes` returns created nodes as `created.created`, while the deterministic repair code only handled the test-only `created` array shape. This prevented `move_node` from running after group frame creation. The result parser now accepts both shapes. Second, `updateNodeBboxes` was generated for every matched text, including zero-delta and sub-threshold deltas; it now includes only material bbox differences over 8px so regroup repair does not rewrite stable text geometry.

Duplicate visible labels are now matched by geometry rather than by the first text node with the same content. This prevents obvious cross-group reuse when labels like `Results` or `1 km` appear in both a results table and a progress card. Live compare after the fix on `2026-05-29` returned `textCoverage:1`, `missingTextCount:0`, `extraTextCount:0`, `materialBboxDeltaCount:0`, and `missingVisualEntries:1`. The remaining unresolved group gap is duplicate-count aware repair: exact group matching still requires creating or preserving separate TEXT nodes for duplicate labels that appear in multiple component-like groups. Current live state still reports `missingGroupCount:2`; the next repair step should create group-scoped duplicate text nodes instead of moving the only existing copy between groups.

Duplicate-count aware repair now creates group-scoped duplicate TEXT nodes. If two regroup candidates would otherwise claim the same generated text node, the first group keeps the existing node and the later group receives a newly created duplicate at the reference text bbox. This applies both to repeated labels inside one group and shared labels across groups. The repair preview preserves `regroupTargetIndex` so confirm can move each created duplicate into the intended group frame after `bulk_create_nodes`, and the confirm parser now accepts the plugin's real `created.created` result shape. The compare tests cover both repeated labels within a progress card and a shared `Results` label across table/progress groups. Live repair on `2026-05-29` first reduced `missingGroupCount` from `2` to `1`; after visual-order group signature matching and duplicate-scoped text repair were applied, final live compare returned `textCoverage:1`, `missingTextCount:0`, `extraTextCount:0`, `materialBboxDeltaCount:0`, `missingGroupCount:0`, `partialGroupCount:0`, and `missingVisualEntries:1`.

Final visual-entry repair was verified live on `2026-05-29` against reference `33405:337` and generated screen `33405:544`. The improve workflow produced a single safe `generated_screen_repair` candidate for `missing-visual-Left runner avatar` with a 72x72 editable frame at the reference bbox. Preview returned `commandCount:1` with no text creation, bbox updates, deletes, or regroup operations. Confirming the candidate applied one update and post-apply verification reported `improved:true`, `missingVisualEntryDelta:-1`, and the final comparison returned `textCoverage:1`, `missingTextCount:0`, `extraTextCount:0`, `materialBboxDeltaCount:0`, `missingGroupCount:0`, `partialGroupCount:0`, and `missingVisualEntries:0`. This proves the current deterministic compare/improve loop can close the previously visible Running Challenge gaps in the active Figma session, though photographic avatar fidelity is still represented as an editable placeholder rather than the original raster content.

The improve response now also exposes executable repair commands through a top-level `actionCandidates` compatibility field. The canonical UI structure remains `designerActionPreviewBundle.previews[].bridgeCommandCandidates`, but callers that only inspect `actionCandidates` no longer miss deterministic repairs. Empty lower-level debug candidates are filtered out, so an avatar-only repair exposes the single high-level `generated_screen_repair` candidate instead of unusable empty `bulk_create_nodes`, `bulk_update_nodes`, or `delete_node` candidates.

Lower-level repair candidates now mirror the high-level repair creation scope. The `bulk_create_nodes` candidate for `generated_screen_repair` includes missing text nodes, missing visual nodes, and regroup frame nodes instead of only `createTextNodes`. This keeps manual/debug application paths aligned with the deterministic repair workflow and prevents visual fixes such as avatars, icons, progress bars, or replacement group frames from disappearing when a client chooses the lower-level create candidate.

`debug_bridge_failure` now has a deterministic `/api/designer/chat` path. When a user pastes an image-analysis or screen-construction failure message, the bridge does not run new Figma commands. It classifies the failure stage/source from the text and returns `bridgeFailureDiagnosis` with parsed signals, counts, missing quoted labels, selected-node context, and next actions. Covered stages include selected image export timeout, Codex image-analysis timeout, semantic layer-conversion understructure, text mapping gaps, and post-build bbox alignment mismatch. This makes failure analysis a distinct intent rather than an accidental `inspect_selection` fallback.

Failure diagnosis now also detects clipped viewport reference context. If the failure text or user note says the reference image/layer is larger than the selected frame and hidden by frame clipping/overflow, the diagnosis adds `clipped_viewport_reference` plus `metrics.clippedViewportReferenceLikely:true`. This keeps the retry guidance focused on visible viewport pixels and root-frame coordinate normalization instead of treating the full hidden child image bounds as the source canvas.

Reference/generated comparison and generated-screen improvement are now bounded at the chat workflow level. If Figma readback or repair planning does not finish inside `XBRIDGE_DESIGNER_COMPARE_REQUEST_TIMEOUT_MS` or `XBRIDGE_DESIGNER_IMPROVE_REQUEST_TIMEOUT_MS`, the API returns HTTP 504 with `code:"debug_bridge_failure"` and `failureSource:"designer_chat_workflow_timeout"` instead of leaving the user waiting indefinitely. This preserves the split between transport success, generation success, and quality verification success.

When that workflow timeout fires, commands created inside the timed workflow are canceled from the bridge queue with `ERR_COMMAND_CANCELED_WORKFLOW_TIMEOUT`. The important behavior is that a timed-out compare/improve request does not leave stale `get_metadata` / detail read commands behind for the next request to pick up.

Live compare verification on `2026-05-29` for `33405:337` and `33405:544` completed through WS without fallback and left `pendingCommands:0`. The response returned `textCoverage:1`, no missing/extra text, and `materialBboxDeltaCount:0`. Raw matched `bboxDeltas` are still returned for debugging, but summary/finding text now reports only material bbox deltas so exact/near-exact matches do not inflate the perceived repair workload.

Visual role comparison now separates actionable role defects from layer decomposition drift. Generic `text`/`container` count differences and cases where the generated screen has more fragments of a role already present in the reference are reported in `visualDeltas.roleCountDeltas` with `actionable:false`, not as `missingRoles`/`extraRoles`. The live Running Challenge compare now reports empty `missingRoles` and `extraRoles` while retaining non-actionable count drift for `text`, `container`, `control`, and `progress`.

Geometry comparison follows the same split. `visualDeltas.geometryDeltas` now contains only executable editable-role deltas, while non-executable roles such as `status_bar` are reported under `visualDeltas.geometryDiagnostics` with `actionable:false`. Live Running Challenge compare now returns `geometryDeltas:[]` and a status-bar entry in `geometryDiagnostics`, so system chrome coordinate mismatches remain explainable without appearing as repair work.

Live improve verification on the same Running Challenge pair now returns no unnecessary mutation candidates when the generated screen is already within the deterministic quality threshold: `improvementPlan.actionCount:0`, empty `repairPlan` arrays, empty `designerActionPreviewBundle.previews`, and `actionCandidates:[]`. This verifies that diagnostic-only role/count/geometry drift does not leak into repair actions.

Reference/generated comparison now includes layout sanity checks under `comparison.visualDeltas.layoutSanity`. The generated screen sanity report counts visible text overlaps and offscreen text/visual entries against the selected root frame bounds. Comparison recommendations now call out offscreen/overlap cleanup, and post-apply quality verification includes `layoutIssueBefore`, `layoutIssueAfter`, and `layoutIssueDelta`; a repair is not marked improved if it introduces additional layout sanity issues.

`improve_generated_screen` now promotes safe layout sanity overlap fixes into executable repair plans. When an overlapped generated text node also has a matched reference text bbox, `repairPlan.updateNodeBboxes` restores that node to the reference x/y/width/height and records `reason:"layout_sanity_text_overlap"`. The same entries are surfaced under `visualRepairs.layoutSanityUpdates`, so UI/debug clients can explain that the bbox update is driven by overlap cleanup rather than only text comparison drift.

Layout sanity quality verification now measures generated-only regressions rather than raw generated issue totals. `comparison.visualDeltas.layoutSanity` includes `issueDelta` and `excessGeneratedIssueCount`; post-apply verification uses the excess count so overlap patterns that are also present in the reference do not falsely block a repair. This matters for clipped/imported reference frames that may contain repeated local-coordinate fragments while still being visually acceptable in the reference viewport.

Post-apply quality verification now treats a decrease in partial group matches as acceptable when exact missing group count improves. This avoids marking a successful exact regroup repair as `not_improved` merely because the previous partial match disappeared after the group became closer to the reference structure.

The improve workflow now separates visual geometry diagnostics from executable visual geometry repairs. `comparison.visualDeltas.geometryDeltas` contains only bounded editable roles (`progress`, `image`, `icon`, `shape`, `control`) that can be promoted into `visualRepairs.geometryUpdates`; non-executable roles such as `status_bar` move to `comparison.visualDeltas.geometryDiagnostics` with `actionable:false`. This keeps chrome/header coordinate mismatches explainable without making them look like repair candidates.

Text comparison now filters synthetic helper labels before missing/extra text and repair creation are computed. Labels such as `Signal bar 1`, `Battery fill`, `Left avatar image block`, `Hero bottom shade`, and single icon glyphs such as `›` or `↯` are treated as visual helper descriptions, not visible copy. Text matching also normalizes common unit spacing (`24.7km` vs `24.7 km`) so harmless OCR/layout spacing differences do not create false missing/extra text pairs. Live improve on `2026-05-29` returned `referenceTextCount:24`, `generatedTextCount:17`, `missingTextCount:16`, `extraTextCount:9`, `createTextNodes:16`, and no helper text in `helperMissingTexts`, `helperExtraTexts`, or `helperCreateTexts`.

Live check against the active Figma session was attempted after restarting the bridge:

- `GET /health`: healthy, active plugin `page:33276:16484`
- request: `선택한 이미지를 분석만 하고 화면 구현은 하지마`
- previous result before this fix: `codex_cli_timeout`

The timeout happened in the Codex image-analysis job before an analysis result could be returned. The server now classifies this condition as a bridge failure diagnosis instead of leaving the user with only the raw Codex timeout. Live success for returning a complete analysis result is still not proven.

## Remaining Work

The mapping is still partially connected to execution. The next step is to make each remaining user-facing intent execute a distinct workflow:

- strengthen `compare_reference_and_generated`: expand visual role inference and move group matching beyond exact descendant text signatures toward layout/role similarity scoring
- strengthen `improve_generated_screen`: continue turning safe `visualRepairs` suggestions into executable mutations, while keeping role/count diagnostics separate from mutations that would create broad containers or duplicate source screenshots
- `debug_bridge_failure`: broaden pasted-log parsing as new failure signatures appear, and connect diagnosis items to one-click retry prompts when safe
- run the fixed `image_analysis_only` timeout path against the active Figma session to confirm the live response now returns the new diagnosis payload
