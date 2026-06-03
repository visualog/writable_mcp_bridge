# Xbridge New Session Continuation - 2026-06-03

## purpose

Use this document to resume the Xbridge Buddy/RAG Designer Workflow release work in a new session without replaying the full prior conversation.

## current task

Maintain `Release readiness: PASS` while preparing the release commit or PR.

The next concrete task is:

1. Preserve the 26 release-safe files that are already staged.
2. Review only the release-related hunks in:
   - `figma-plugin/code.js`
   - `tests/ui-designer-contract.test.js`
3. Stage only the release-scope hunks from those two mixed dirty files.
4. Re-run targeted tests and release readiness.
5. Review the staged diff and report whether it is commit-ready.

Do not commit or push unless explicitly asked.

## previous completed work

- Live Figma QA completed with 34 total cases, 34 pass, 0 skip, 0 fail.
- RAG01 passed with 4 `knowledgeReferences`, all using `sourceKind=document_chunk`.
- DS01 passed with live page-scoped `/api/search-nodes` evidence:
  - page: `┗ Button`
  - pageId: `3301:3396`
  - match: `COMPONENT_SET` `3724:3453` / `button`
- Assistant response UI snapshot passed.
- Release readiness passed.
- Full regression evidence was recorded as `npm test`: 586 tests, 574 pass, 12 skipped, 0 fail.
- 26 release-safe files were staged. The two mixed tracked files were intentionally left unstaged.

## current state to preserve

- Repo: `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge`
- Branch: `feature/ai-designer-hybrid-main-pr`
- Base branch: `main`
- Release readiness artifact: `docs/qa/release-readiness-latest.md`
- Latest live QA artifact: `docs/qa/runs/designer-workflow-2026-06-02T12-53-47-274Z/results.json`
- Latest assistant UI artifact: `docs/qa/runs/assistant-response-ui-2026-06-02T12-46-21-942Z/snapshot.json`
- Commit scope manifest: `docs/handoff/2026-06-02-release-commit-scope.md`

Important index/worktree state:

- Keep the staged release-safe files staged.
- Keep unrelated dirty/untracked files untouched.
- `figma-plugin/code.js` and `tests/ui-designer-contract.test.js` are mixed dirty files and require hunk-level review.

## required minimal references

Read these in order:

1. `docs/handoff/2026-06-03-tcrei-token-efficient-resume.md`
2. `docs/handoff/2026-06-02-release-commit-scope.md`
3. `docs/handoff/2026-06-02-xbridge-buddy-rag-designer-workflow-handoff.md`
4. `docs/plans/2026-06-02-xbridge-final-completion-plan.md`

Do not read old QA run directories unless the current release readiness or a failing command points to a specific artifact.

## start commands

Run these before acting:

```bash
git status --short
git diff --cached --name-status
git diff -- figma-plugin/code.js tests/ui-designer-contract.test.js
npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json
```

## next-task acceptance criteria

The next task is complete only when:

- `figma-plugin/code.js` release hunks are reviewed and, if still relevant, staged without unrelated hunks.
- `tests/ui-designer-contract.test.js` release hunks are reviewed and, if still relevant, staged without unrelated hunks.
- `npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json` reports `status=pass`.
- Targeted tests covering release audit, QA summary, and UI contract pass.
- `git diff --cached --name-status` contains only intentional release-scope files.

## paste this into the new session

```md
/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge 에서 이어서 작업해줘.

먼저 긴 이전 대화를 복원하지 말고 아래 문서만 순서대로 읽어:
1. docs/handoff/2026-06-03-new-session-continuation.md
2. docs/handoff/2026-06-03-tcrei-token-efficient-resume.md
3. docs/handoff/2026-06-02-release-commit-scope.md
4. docs/handoff/2026-06-02-xbridge-buddy-rag-designer-workflow-handoff.md

목표:
- release readiness PASS 상태를 유지하면서 커밋/PR 준비를 계속한다.
- 현재 staged 된 26개 release-safe 파일은 보존한다.
- unstaged인 figma-plugin/code.js 와 tests/ui-designer-contract.test.js 는 기존 큰 dirty diff가 섞여 있으므로 hunk 단위로 release 관련 변경만 검토/stage한다.
- 관련 없는 dirty/untracked 파일은 건드리지 않는다.

시작 명령:
- git status --short
- git diff --cached --name-status
- git diff -- figma-plugin/code.js tests/ui-designer-contract.test.js
- npm run qa:release-readiness -- --verification-json docs/qa/release-readiness-verification-latest.json

다음 태스크:
1. 두 unstaged 파일에서 release scope hunk만 선별한다.
2. targeted tests와 release readiness를 재실행한다.
3. staged diff를 검토하고, 커밋 가능 상태인지 보고한다.
```
