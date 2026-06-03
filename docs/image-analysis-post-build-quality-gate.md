# Image Analysis Post-Build Quality Gate

Date: 2026-05-28

## Context

The image-to-Figma flow could previously return `ok:true` even when the generated screen was visibly incomplete. The pre-build semantic gate checked the Codex layout tree before `build_layout`, but some defects only appeared in or survived into the final build plan:

- status/icon fallback words such as `cellularbars`
- generated helper labels such as `0%` from progress defaults
- visible text not observed in the image role map
- text coverage that passed before build but disappeared from the final build plan

This meant the system could report generation success while the actual Figma screen still contained obvious visual or structural failures.

## Change Applied

Added `validateGeneratedImageBuildQuality` in `src/codex-cli-runner.js`.

The new validation reads the final `buildResult.plan.root` tree and checks:

- visible role labels from `roleMap` are still present after build
- post-build visual sanity issues
- icon fallback text, including concatenated forms like `cellularbars`
- unobserved generated progress labels such as `0%`
- unobserved visible text for diagnostics

`executeDesignerImageScreenRequest` in `src/server.js` now runs this check after `performBuildLayout`. If the post-build quality is too low, the API throws `codex_cli_image_layout_understructured` instead of returning `ok:true`.

## Tests

Added unit coverage in `tests/codex-cli-runner.test.js`:

- rejects post-build icon fallback and helper labels
- passes clean post-build text coverage

Verification run:

```bash
node --check src/codex-cli-runner.js
node --check src/server.js
node --test tests/codex-cli-runner.test.js
```

Result: all targeted checks passed. `tests/codex-cli-runner.test.js` passed 47/47.

## Live Bridge Result

After restarting the local bridge, `/health` was healthy with active Figma session:

- `serverVersion`: `0.5.65`
- `activePluginId`: `page:33276:16484`
- `fileName`: `Agent_skill_test`
- `pageName`: `Page 55`

Live request against selected frame `33392:3971998`:

```bash
curl -s --max-time 480 \
  -H 'Content-Type: application/json' \
  --data '{"pluginId":"page:33276:16484","message":"선택한 이미지를 분석해서 화면으로 구현해줘","figmaContext":{"fileName":"Agent_skill_test","pageName":"Page 55","selection":[{"id":"33392:3971998","name":"Frame 2","type":"FRAME"}]}}' \
  http://127.0.0.1:3846/api/designer/chat
```

Result: `ok:false`, `code:"codex_cli_image_layout_understructured"`.

The request failed before the post-build gate because the pre-build semantic quality gate detected component bbox mismatch:

- `roleCount`: 7
- `generatedNodeCount`: 59
- `coordinateNodeCount`: 58
- `coveredRoleLabelCount`: 25/25
- `componentBBoxSizeTooLow`: true
- mismatch labels included progress/result rows such as `Progress`, `You`, `110 pts`, `Sam`, `103 pts`, `Lara`, `70 pts`

This is the correct direction: the flow no longer treats text/count success as sufficient when component sizing and layout fidelity are weak.

## Remaining Gaps

This change does not complete the project goal. It only adds one necessary gate.

Still needed:

- first-class intent names for `image_to_screen`, `image_analysis_only`, `improve_generated_screen`, `compare_reference_and_generated`, and `debug_bridge_failure`
- visual comparison between the source export and generated Figma result
- OCR/reference text truth source instead of relying only on Codex `roleMap`
- stronger handling for progress bars so build helpers do not introduce default visual language
- screenshot-based regression comparison for previous generated screen vs new candidate
- structured improvement loop that reads the generated node tree and issues targeted repairs

## Next Recommended Work

1. Add a post-generation readback step that reads the created Figma node tree by `buildResult.root.id`.
2. Compare readback text and bbox with the role map and source viewport.
3. Add an explicit repair path for failed post-build quality instead of only returning failure.
4. Add intent aliases so external API/UI can expose the user-facing intent names directly.
