# Xbridge Final Completion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete Xbridge's Buddy/RAG Designer Workflow release gate with current live Figma evidence, assistant response UX evidence, regression evidence, and a final PASS readiness artifact.

**Architecture:** Treat release completion as an evidence pipeline: live bridge health and plugin session discovery first, then live Designer Workflow QA, then assistant UX/RAG/regression verification, then release-readiness audit. Stale artifacts must never be promoted over newer live-readiness blockers.

**Tech Stack:** Node.js ESM scripts, Xbridge HTTP/WS bridge on `127.0.0.1:3846`, local Figma plugin sessions, `node --test`, `npm run qa:*`, markdown/json QA artifacts.

**Current Execution Status:** Task 1 was completed on 2026-06-02T12:54Z after reactivating the Xbridge Figma plugin for `FDS v2.0 -테스트용` (`pluginId=page:2825:3142`). The latest live Designer Workflow artifact is `docs/qa/runs/designer-workflow-2026-06-02T12-53-47-274Z/results.json` with `casesTotal=34`, `passTotal=34`, `skipTotal=0`, `failTotal=0`. Release readiness currently reports `PASS`; continue with Task 2/Task 3 refresh and full regression verification.

---

## Task 1: Live Figma QA 완수

### Iteration 1.1: Establish Current Live Session State

**Task:** Determine whether the local bridge currently has a usable live Figma plugin session and record fresh evidence.

**Context:** `/health` currently reports server `0.5.65`, transport `standby`, `commandReadiness=unavailable`, `writeReadiness=unavailable`, and `activeSessionResolution.reason=no_live_session`. `/api/sessions` currently returns no sessions. This iteration refreshes the blocker instead of reusing stale Designer Workflow results.

**Requirements:**
- Start from `/health`.
- Use `/api/sessions` only after `/health` shows no active plugin or ambiguity.
- Do not use stale `results.json` as pass evidence.
- Preserve HTTP fallback and existing dirty files.

**Small Tasks:**
1. Run `/health` and save the important fields in the handoff/readiness notes.
2. Run `/api/sessions?includeStale=true` to confirm whether any stale session can explain the blocker.
3. Run `node scripts/run-figma-designer-workflow-live-qa.mjs` without `XBRIDGE_QA_PLUGIN_ID` to generate a fresh `live-readiness.json` when no plugin is live.
4. Re-run release readiness with the verification JSON.
5. Update this plan, `docs/qa/release-readiness-latest.md`, and the handoff with the latest artifact path and blocker.

**Verification Commands:**
```bash
curl -s http://127.0.0.1:3846/health
curl -s "http://127.0.0.1:3846/api/sessions?includeStale=true"
node scripts/run-figma-designer-workflow-live-qa.mjs
npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json
```

**Artifacts:**
- `docs/qa/runs/designer-workflow-<timestamp>/live-readiness.json`
- `docs/qa/runs/designer-workflow-<timestamp>/live-readiness.md`
- `docs/qa/release-readiness-latest.md`
- `docs/qa/release-readiness-latest.json`
- `docs/handoff/2026-06-02-xbridge-buddy-rag-designer-workflow-handoff.md`

**Pass Criteria:** The latest readiness artifact accurately reports either a live plugin session ready for QA or a current `no_live_session` blocker. Release readiness must not promote stale Designer Workflow results.

**Current Result:** Completed. Initial run produced `no_live_session`, then Figma plugin was reactivated and `/health` reported `activePluginId=page:2825:3142`, `transportHealth=healthy`, `commandReadiness=ready`, `writeReadiness=ready`.

**Next Task Trigger:** Completed. Continue to Iteration 1.2.

### Iteration 1.2: Discover Target File Pages

**Task:** Confirm the selected plugin session is attached to the intended Figma file before running mutation/readback QA.

**Context:** Multiple Figma files/apps can register with the same local bridge. Page discovery prevents reading or mutating the wrong file.

**Requirements:**
- Use `docs/agent-recipes/inspect-pages.md` and `docs/troubleshooting/session-state.md`.
- Use explicit `pluginId` when there is more than one live session.
- Abort to Iteration 1.1 if page metadata is missing, stale, or wrong.

**Small Tasks:**
1. Pick `pluginId` from `/health.activePlugins` or `/api/sessions`.
2. Run `/api/pages?pluginId=<pluginId>`.
3. Confirm the returned pages match the intended target file.
4. Record selected `pluginId` and page evidence in the handoff.

**Verification Commands:**
```bash
curl -s "http://127.0.0.1:3846/api/pages?pluginId=<pluginId>"
```

**Artifacts:**
- Handoff entry with selected `pluginId`
- Optional saved page-discovery JSON under `docs/qa/runs/designer-workflow-<timestamp>/`

**Pass Criteria:** A target `pluginId` is selected and page discovery proves the session belongs to the intended Figma file.

**Current Result:** Completed. `/api/pages?pluginId=page:2825:3142` returned file/page evidence for `FDS v2.0 -테스트용`; DS01 page discovery found `┗ Button` (`3301:3396`) and `┗ Radio Button` (`3172:4455`).

**Next Task Trigger:** Completed. Run Iteration 1.3 with `XBRIDGE_QA_PLUGIN_ID=page:2825:3142`.

### Iteration 1.3: Run Live Designer Workflow QA

**Task:** Execute RAG01, DS01, L01-L31, and N01-N06 against the live Figma session and collect readback/capture evidence.

**Context:** Completion requires current live canvas mutation/readback evidence, not older successful artifacts.

**Requirements:**
- Run with explicit `XBRIDGE_QA_PLUGIN_ID`.
- Require non-empty readback evidence for release-required cases.
- Keep DS01 real design-system component evidence visible; if a component set is required, use `XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=true`.
- Preserve generated artifacts for release audit.

**Small Tasks:**
1. Run live QA with `XBRIDGE_QA_PLUGIN_ID=<pluginId>`.
2. Review generated `results.json`, `summary.md`, and captures.
3. Confirm required cases are present and have pass/readback evidence.
4. If a case fails, fix the smallest runner/server/composer issue and rerun the targeted check.
5. Update handoff with result path and failure/pass summary.

**Verification Commands:**
```bash
XBRIDGE_QA_PLUGIN_ID=<pluginId> node scripts/run-figma-designer-workflow-live-qa.mjs
node scripts/summarize-designer-workflow-qa.mjs --input docs/qa/runs/designer-workflow-<timestamp>/results.json --output docs/qa/runs/designer-workflow-<timestamp>/summary.md --require-release-gates
```

**Artifacts:**
- `docs/qa/runs/designer-workflow-<timestamp>/results.json`
- `docs/qa/runs/designer-workflow-<timestamp>/summary.md`
- `docs/qa/runs/designer-workflow-<timestamp>/captures/`
- Updated handoff

**Pass Criteria:** Required cases pass, required readbacks are non-empty, and RAG01 has a `sourceKind=document_chunk` knowledge reference in the latest live run.

**Current Result:** Completed. `XBRIDGE_QA_PLUGIN_ID='page:2825:3142' XBRIDGE_QA_REQUIRE_DS_COMPONENT_SET=1 node scripts/run-figma-designer-workflow-live-qa.mjs` passed 34/34 cases with zero skips. DS01 used live `/api/search-nodes` evidence on `┗ Button` and found `COMPONENT_SET` `3724:3453` / `button`; RAG01 included document_chunk references.

**Next Task Trigger:** Continue to Task 2 when live Designer Workflow QA is current and passing.

## Task 2: Buddy 수준 응답 UX/RAG 개선

### Iteration 2.1: Refresh Assistant Response UI Snapshot

**Task:** Re-render and validate the assistant response UI snapshot after the latest live QA.

**Context:** Buddy-level behavior requires visible progress, evidence references, issue/action cards, and clear partial-success/failure states.

**Requirements:**
- Snapshot must include required sections, knowledge card, issue card, action card, knowledge filter, and correctly grouped reference text.
- Use current RAG/live QA evidence where the renderer supports it.

**Small Tasks:**
1. Run the assistant UI snapshot command.
2. Inspect `snapshot.json` for required checks.
3. Inspect the generated PNG if checks fail or if layout changed.
4. Update handoff/readiness evidence paths.

**Verification Commands:**
```bash
npm run qa:assistant-ui-snapshot
```

**Artifacts:**
- `docs/qa/runs/assistant-response-ui-<timestamp>/snapshot.json`
- `docs/qa/runs/assistant-response-ui-<timestamp>/assistant-response.png`

**Pass Criteria:** Assistant UI snapshot checks pass and represent Buddy-style response structure.

**Current Result:** Completed. `npm run qa:assistant-ui-snapshot` produced `docs/qa/runs/assistant-response-ui-2026-06-02T12-46-21-942Z/snapshot.json` and `assistant-response.png`; snapshot checks passed for required sections, knowledge card, issue card, action card, knowledge filter, and reference grouping.

**Next Task Trigger:** Completed. Continue to Iteration 2.2 when snapshot gate passes.

### Iteration 2.2: Validate RAG Evidence Freshness

**Task:** Confirm RAG01 evidence is current, live, and sourced from `document_chunk`.

**Context:** Older RAG01 results are blocked while artifact freshness is blocked. Release confidence requires the latest run to carry valid knowledge references.

**Requirements:**
- Use the latest live `results.json`.
- Ensure RAG references are not empty and include `sourceKind=document_chunk`.
- If evidence is missing, fix only the RAG retrieval/reporting path required for RAG01.

**Small Tasks:**
1. Inspect latest live `results.json` for RAG01.
2. Run targeted RAG unit tests.
3. Fix RAG evidence formatting or retrieval if the live artifact lacks required references.
4. Re-run live QA or summary after fixes.

**Verification Commands:**
```bash
node --test tests/designer-knowledge-rag.test.js tests/buddy-report-composer.test.js tests/designer-workflow-qa-summary.test.js
```

**Artifacts:**
- Latest live `results.json`
- Relevant test output
- Updated handoff if any fix is made

**Pass Criteria:** RAG01 in the latest live run includes current `document_chunk` evidence and targeted RAG/composer tests pass.

**Current Result:** Completed. Latest live `RAG01` in `docs/qa/runs/designer-workflow-2026-06-02T12-53-47-274Z/results.json` passed with 4 `knowledgeReferences`, all using `sourceKind=document_chunk`.

**Next Task Trigger:** Completed. Continue to Iteration 2.3 when RAG evidence is current and passing.

### Iteration 2.3: Validate Buddy Report Contract

**Task:** Confirm the deterministic report contract still matches the Buddy-level operational contract.

**Context:** The user-facing answer must show expectation setting, read/action progress, evidence, good points, improvements, priorities, and next actions.

**Requirements:**
- Keep UI wording Korean-friendly where existing product copy is Korean.
- Do not introduce broad UI rewrites unless tests show contract drift.

**Small Tasks:**
1. Run Buddy/report contract tests.
2. Inspect failures for missing section/field regressions.
3. Patch the smallest composer or contract fixture issue if needed.
4. Re-run targeted tests.

**Verification Commands:**
```bash
node --test tests/buddy-operational-contract.test.js tests/buddy-report-composer.test.js tests/ui-designer-contract.test.js
```

**Artifacts:**
- Test output
- Updated composer/contract files only if required

**Pass Criteria:** Buddy/report/UI contract tests pass.

**Current Result:** Completed. Buddy/report/UI contract coverage is included in the targeted checks and full suite; `node --test tests/ui-designer-contract.test.js tests/search-nodes.test.js tests/designer-workflow-qa-summary.test.js tests/designer-workflow-release-audit.test.js` passed 49 tests, and `npm test` passed the full suite.

**Next Task Trigger:** Completed. Continue to Task 3 when Task 2 gates pass.

## Task 3: Release Gate 통합과 최종 완료 판정

### Iteration 3.1: Run Targeted Release Audit Tests

**Task:** Verify the release audit logic still blocks stale evidence and passes only current complete evidence.

**Context:** The release gate must be stricter than raw script success.

**Requirements:**
- Preserve stale artifact blocking.
- Preserve explicit live-session blocker messages.
- Preserve RAG/document_chunk requirements.

**Small Tasks:**
1. Run release audit and summary tests.
2. Fix any audit regression with targeted unit coverage first.
3. Re-run targeted tests.

**Verification Commands:**
```bash
node --test tests/designer-workflow-release-audit.test.js tests/designer-workflow-readiness-report.test.js tests/designer-workflow-qa-summary.test.js
```

**Artifacts:**
- Test output
- Audit/readiness source changes only if required

**Pass Criteria:** Targeted release audit tests pass.

**Current Result:** Completed. Targeted release/audit checks passed; `tests/designer-workflow-release-audit.test.js` includes coverage for ignoring older `no_live_session` readiness only when current health has a live session.

**Next Task Trigger:** Completed. Continue to Iteration 3.2 when targeted gate tests pass.

### Iteration 3.2: Run Full Regression Suite

**Task:** Confirm the broad Xbridge regression suite still passes after live QA and any fixes.

**Context:** The handoff now reports the latest full suite as `586 tests, 574 pass, 12 skipped, 0 fail`.

**Requirements:**
- Run `npm test`.
- Record exact pass/fail/skip counts in readiness/handoff.
- Do not hide skipped tests as failures or passes.

**Small Tasks:**
1. Run `npm test`.
2. If it fails, isolate the smallest failing test group and fix only relevant code.
3. Re-run failing group, then full suite.
4. Update verification JSON if the suite passes.

**Verification Commands:**
```bash
npm test
```

**Artifacts:**
- Test output summary
- `docs/qa/release-readiness-verification-latest.json`
- Updated handoff

**Pass Criteria:** Full regression suite passes with no failing tests.

**Current Result:** Completed. `npm test` passed with 586 tests, 574 pass, 12 skipped, 0 fail.

**Next Task Trigger:** Completed. Continue to Iteration 3.3 when full regression suite passes.

### Iteration 3.3: Produce Final Release Readiness PASS

**Task:** Run the final release-readiness audit and confirm `Release readiness: PASS`.

**Context:** This is the final completion gate. It must consume current health, sessions, live Designer Workflow results, assistant UI snapshot, RAG evidence, and regression verification.

**Requirements:**
- Run against current server state.
- Use latest live artifacts.
- Do not override blockers manually.
- Update final handoff with task/context/changedFiles/tests/risks/nextSteps.

**Small Tasks:**
1. Run release readiness with verification JSON.
2. Inspect `docs/qa/release-readiness-latest.md`.
3. If status is not PASS, use the gate table to choose the next smallest iteration.
4. If PASS, update handoff and create an xlog/devlog candidate if requested.

**Verification Commands:**
```bash
npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json
sed -n '1,220p' docs/qa/release-readiness-latest.md
```

**Artifacts:**
- `docs/qa/release-readiness-latest.md`
- `docs/qa/release-readiness-latest.json`
- `docs/handoff/2026-06-02-xbridge-buddy-rag-designer-workflow-handoff.md`

**Pass Criteria:** `docs/qa/release-readiness-latest.md` reports `Release readiness: PASS` with live session, live Designer Workflow, assistant UX, RAG, and regression gates all passing.

**Current Result:** Completed. `npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json` returned `ok=true`, `status=pass`, `reason=release_ready`; `docs/qa/release-readiness-latest.md` reports `Release readiness: PASS`.

**Next Task Trigger:** Completion. If PASS is blocked by no live session in a future run, return to Task 1. If blocked by stale or failing evidence, return to the exact iteration named by the failing gate.
