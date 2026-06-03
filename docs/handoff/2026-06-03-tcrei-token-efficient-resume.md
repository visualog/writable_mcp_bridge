# TCREI Token-Efficient Resume Guide - 2026-06-03

## purpose

TCREI is a compact resume protocol for continuing Xbridge work without loading the entire previous conversation.

Use it at the start of a new session before opening broad logs, old QA runs, or long source files.

## T - Task

State one active task only.

For this continuation:

```text
Prepare the Xbridge Buddy/RAG Designer Workflow release commit or PR while preserving release readiness PASS.
```

Do not broaden the task into new feature development unless the user explicitly asks.

## C - Current State

Use current repo state as authoritative.

Required checks:

```bash
git status --short
git diff --cached --name-status
git diff -- figma-plugin/code.js tests/ui-designer-contract.test.js
```

Expected state at handoff time:

- Branch is `feature/ai-designer-hybrid-main-pr`.
- Base branch is `main`.
- 26 release-safe files are staged.
- `figma-plugin/code.js` is unstaged and mixed with large existing dirty diff.
- `tests/ui-designer-contract.test.js` is unstaged and mixed with large existing dirty diff.
- Related unrelated dirty/untracked files exist and must not be reverted or staged accidentally.

## R - References

Read only these references first:

1. `docs/handoff/2026-06-03-new-session-continuation.md`
2. `docs/handoff/2026-06-02-release-commit-scope.md`
3. `docs/handoff/2026-06-02-xbridge-buddy-rag-designer-workflow-handoff.md`
4. `docs/plans/2026-06-02-xbridge-final-completion-plan.md`

Avoid broad searches unless one of the required commands contradicts these documents.

Do not read every file under `docs/qa/runs/`. Use only:

- `docs/qa/runs/designer-workflow-2026-06-02T12-53-47-274Z/results.json`
- `docs/qa/runs/designer-workflow-2026-06-02T12-53-47-274Z/summary.md`
- `docs/qa/runs/assistant-response-ui-2026-06-02T12-46-21-942Z/snapshot.json`

## E - Evidence

Use these artifacts to decide PASS/FAIL:

- Release readiness:
  - `docs/qa/release-readiness-latest.md`
  - `docs/qa/release-readiness-latest.json`
- Verification metadata:
  - `docs/qa/release-readiness-verification-latest.json`
- Live Designer Workflow:
  - `docs/qa/runs/designer-workflow-2026-06-02T12-53-47-274Z/results.json`
- Assistant response UI:
  - `docs/qa/runs/assistant-response-ui-2026-06-02T12-46-21-942Z/snapshot.json`

Minimum verification commands:

```bash
node --check scripts/run-figma-designer-workflow-live-qa.mjs src/designer-workflow-release-audit.js figma-plugin/code.js
node --test tests/designer-workflow-release-audit.test.js tests/designer-workflow-qa-summary.test.js tests/ui-designer-contract.test.js
npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json
```

Full regression evidence already recorded:

```text
npm test: 586 tests, 574 pass, 12 skipped, 0 fail
```

Re-run full `npm test` only before commit/PR or if release-scope code hunks change.

## I - Instructions

Do:

- Preserve the existing staged set unless there is clear evidence it is wrong.
- Hunk-stage only the release-related parts of `figma-plugin/code.js` and `tests/ui-designer-contract.test.js`.
- Keep DS01 release evidence page-scoped through `/api/search-nodes`.
- Keep RAG01 evidence tied to `sourceKind=document_chunk`.
- Run targeted tests and release readiness after changing staging or release-scope files.

Do not:

- Reconstruct the full previous conversation.
- Bulk-stage all dirty files.
- Revert unrelated dirty/untracked files.
- Use old QA artifacts as current pass evidence when newer readiness artifacts contradict them.
- Run full-file `search_design_system` against the large FDS file as the DS01 release gate; it can time out.
- Commit, push, merge, or create a PR without an explicit user request.

## compact startup checklist

```bash
git status --short
git diff --cached --name-status
git diff -- figma-plugin/code.js tests/ui-designer-contract.test.js
npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json
```

Then proceed directly to hunk staging and targeted verification.
