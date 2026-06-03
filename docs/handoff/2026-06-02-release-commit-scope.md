# Xbridge Release Commit Scope - 2026-06-02

## status

Release gate is ready for commit/PR preparation.

- Branch: `feature/ai-designer-hybrid-main-pr`
- Base branch: `main`
- Release readiness: `PASS`
- Latest live QA: `docs/qa/runs/designer-workflow-2026-06-02T12-53-47-274Z/results.json`
- Assistant UI snapshot: `docs/qa/runs/assistant-response-ui-2026-06-02T12-46-21-942Z/snapshot.json`
- Full regression evidence: `npm test` reported 586 tests, 574 pass, 12 skipped, 0 fail

## stage candidates

Stage these files/directories for the release readiness commit if the commit is meant to capture the Buddy/RAG Designer Workflow completion gate.

```bash
git add \
  docs/handoff/2026-06-02-xbridge-buddy-rag-designer-workflow-handoff.md \
  docs/handoff/2026-06-02-release-commit-scope.md \
  docs/handoff/2026-06-03-new-session-continuation.md \
  docs/handoff/2026-06-03-tcrei-token-efficient-resume.md \
  docs/plans/2026-06-02-xbridge-final-completion-plan.md \
  docs/qa/release-readiness-latest.md \
  docs/qa/release-readiness-latest.json \
  docs/qa/release-readiness-verification-latest.json \
  docs/qa/runs/designer-workflow-2026-06-02T12-53-47-274Z/ \
  docs/qa/runs/assistant-response-ui-2026-06-02T12-46-21-942Z/ \
  scripts/audit-designer-workflow-release-readiness.mjs \
  scripts/render-designer-assistant-ui-snapshot.mjs \
  scripts/run-figma-designer-workflow-live-qa.mjs \
  scripts/summarize-designer-workflow-qa.mjs \
  src/buddy-report-composer.js \
  src/designer-knowledge-rag.js \
  src/designer-workflow-readiness-report.js \
  src/designer-workflow-release-audit.js \
  tests/buddy-report-composer.test.js \
  tests/designer-knowledge-rag.test.js \
  tests/designer-workflow-qa-summary.test.js \
  tests/designer-workflow-readiness-report.test.js \
  tests/designer-workflow-release-audit.test.js
```

## hunk-stage candidates

Do not blindly `git add` these tracked files without reviewing hunks. They contain large pre-existing dirty diffs mixed with the release-fix hunks.

- `figma-plugin/code.js`
  - Required release hunk: `buildDropShadowEffect` must avoid nullish coalescing because the Figma plugin VM rejected `??` during plugin boot.
  - Related release hunk: manual border/drop shadow readback support used by L15.
- `tests/ui-designer-contract.test.js`
  - Required release hunk: DS01 runner contract asserts `search_nodes live component page`, `findDesignSystemComponentPage`, and `COMPONENT_SET`.
  - Related release hunk: plugin contract asserts `buildDropShadowEffect`.

Suggested review commands:

```bash
git diff -- figma-plugin/code.js
git diff -- tests/ui-designer-contract.test.js
```

## excluded from this release commit

Do not include unrelated dirty/untracked files unless a separate review says they are intentionally part of this release.

- Broad existing modified files outside the Buddy/RAG Designer Workflow release gate.
- Scratch files such as `.codex-write-check`, `.xbridge-codex-cli-enabled`, `capture/`, `codex/`, and local generated experiment folders.
- Older planning or image-analysis notes unless they are intentionally bundled into a larger documentation commit.

## verification commands

The latest verified commands were:

```bash
node --check scripts/run-figma-designer-workflow-live-qa.mjs src/designer-workflow-release-audit.js figma-plugin/code.js
node --test tests/designer-workflow-release-audit.test.js tests/designer-workflow-qa-summary.test.js tests/ui-designer-contract.test.js
npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json
```

Latest broader evidence:

```bash
npm test
```

Result recorded in readiness/handoff: 586 tests, 574 pass, 12 skipped, 0 fail.

## pass criteria

Before commit or PR:

- `docs/qa/release-readiness-latest.md` reports `Release readiness: PASS`.
- DS01 live evidence remains page-scoped via `/api/search-nodes`, not the timeout-prone full-file `search_design_system` traversal.
- RAG01 in the latest live QA has `sourceKind=document_chunk` references.
- No unrelated dirty files are staged accidentally.
