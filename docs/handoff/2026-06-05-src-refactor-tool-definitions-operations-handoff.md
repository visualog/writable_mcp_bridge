# src 순차 리팩터링 핸드오프: node operation tool definitions 분리

## task

위험도가 낮은 `src/server-tool-definitions.js`를 계속 작게 분리한다. 이번 태스크는 마지막으로 남은 node operation 계열 tool definition 11개를 constants 파일로 분리하는 작업이다.

## context

- 이전 태스크에서 core, read/detail, discovery/annotation, mutation, node/import/update, compose/layout tool definition이 constants 파일로 분리되었다.
- 이번 태스크는 그 다음 순서인 `create_instance`부터 `undo_last_batch`까지의 schema를 분리했다.
- 기능 변경과 public API 변경은 하지 않았다.
- `buildToolDefinitions()`의 반환 순서 보존 테스트를 추가했다.
- `src/server-tool-definitions.js`는 19줄이 되어 tool schema 조립 파일 역할만 남았다.

## changedFiles

- `src/constants/server-tool-definitions-operations.js`
- `src/server-tool-definitions.js`
- `tests/server-tool-definitions.test.js`
- `docs/server-refactor-extracted-files.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-operations-report.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-operations-handoff.md`

이전 태스크에서 아직 커밋되지 않은 관련 파일도 함께 남아 있다.

- `package.json`
- `src/constants/server-tool-definitions-core.js`
- `src/constants/server-tool-definitions-read.js`
- `src/constants/server-tool-definitions-discovery.js`
- `src/constants/server-tool-definitions-mutation.js`
- `src/constants/server-tool-definitions-node.js`
- `src/constants/server-tool-definitions-compose.js`
- `tests/token-export-contract.test.js`
- `docs/plans/2026-06-05-src-sequential-refactor-plan.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-core-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-read-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-discovery-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-mutation-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-node-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-compose-report.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-core-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-read-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-discovery-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-mutation-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-node-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-compose-handoff.md`

## tests

- `node --test tests/server-tool-definitions.test.js`: 통과, 8 pass
- `node --check src/server-tool-definitions.js`: 통과
- `node --check src/constants/server-tool-definitions-operations.js`: 통과
- `npm run check:all`: 통과, 645 tests, 633 pass, 12 skipped, 0 fail
- `/health`: 통과, `ok=true`, `transportHealth.grade=healthy`

## risks

- tool schema 분리 자체는 완료되었다.
- 일부 constants 파일은 300줄 이상이므로, 다음 리팩터링은 `src` 전체 500줄 이상 파일 재스캔 후 우선순위를 다시 잡는 편이 안전하다.
- source-inspection 방식의 테스트가 새 파일 위치에 묶일 수 있으므로, 추후 schema 이동 때는 관련 테스트를 먼저 확인해야 한다.
- untracked 로컬 자료(`codex/`, `capture/`, `image-gen/` 등)는 이번 리팩터링과 무관하므로 건드리지 않았다.

## nextSteps

1. `src` 폴더의 500줄 이상 js/jsx/ts/tsx 파일 목록을 다시 스캔한다.
2. 위험도 낮은 다음 후보를 하나만 고른다.
3. 새 후보도 기능 변경 없이 constants/components/hooks/utils 중 적절한 경계로 작게 분리한다.
4. 분리 후 `npm run check:all`을 실행한다.
5. 완료 후 분리 파일 문서, 리포트, 핸드오프를 한국어로 갱신한다.

## continuationPrompt

`docs/handoff/2026-06-05-src-refactor-tool-definitions-operations-handoff.md`를 읽고 다음 태스크를 진행해 주세요. `src/server-tool-definitions.js` schema 분리는 완료되었으므로, 다음에는 `src` 폴더의 500줄 이상 js/jsx/ts/tsx 파일을 다시 스캔하고 위험도 낮은 다음 후보 1개를 골라 기능 변경 없이 작은 diff로 리팩터링해 주세요. 완료 후 `npm run check:all`, 리포트, 핸드오프, 분리 파일 문서를 한국어로 갱신해 주세요.
