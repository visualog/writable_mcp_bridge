# src 순차 리팩터링 핸드오프: read/detail tool definitions 분리

## task

위험도가 낮은 `src/server-tool-definitions.js`를 계속 작게 분리한다. 이번 태스크는 read/detail 계열 tool definition 11개를 constants 파일로 분리하는 작업이다.

## context

- 이전 태스크에서 core tool definition 7개가 `src/constants/server-tool-definitions-core.js`로 분리되었다.
- 이번 태스크는 그 다음 순서인 `get_metadata`부터 `export_node`까지의 read/detail schema를 분리했다.
- 기능 변경과 public API 변경은 하지 않았다.
- `buildToolDefinitions()`의 반환 순서 보존 테스트를 추가했다.

## changedFiles

- `src/constants/server-tool-definitions-read.js`
- `src/server-tool-definitions.js`
- `tests/server-tool-definitions.test.js`
- `tests/token-export-contract.test.js`
- `docs/server-refactor-extracted-files.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-read-report.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-read-handoff.md`

이전 태스크에서 아직 커밋되지 않은 관련 파일도 함께 남아 있다.

- `package.json`
- `src/constants/server-tool-definitions-core.js`
- `docs/plans/2026-06-05-src-sequential-refactor-plan.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-core-report.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-core-handoff.md`

## tests

- `node --test tests/server-tool-definitions.test.js`: 통과, 3 pass
- `node --test tests/token-export-contract.test.js`: 통과, 19 pass
- `node --check src/server-tool-definitions.js`: 통과
- `node --check src/constants/server-tool-definitions-core.js`: 통과
- `node --check src/constants/server-tool-definitions-read.js`: 통과
- `npm run check:all`: 통과, 640 tests, 628 pass, 12 skipped, 0 fail
- `/health`: 통과, `ok=true`, `transportHealth.grade=healthy`

## risks

- `tests/token-export-contract.test.js`처럼 source-inspection 방식의 테스트는 파일 분리에 민감하다. 다음 schema 분리 때도 관련 테스트가 기존 파일 본문을 직접 검사하는지 확인해야 한다.
- `src/server-tool-definitions.js`는 1,611줄로 여전히 크다.
- untracked 로컬 자료(`codex/`, `capture/`, `image-gen/` 등)는 이번 리팩터링과 무관하므로 건드리지 않았다.

## nextSteps

1. `src/server-tool-definitions.js`의 annotation/design-system/search/replay 계열 schema를 `src/constants/server-tool-definitions-design-system.js` 또는 더 적절한 constants 파일명으로 분리한다.
2. RED 테스트는 `buildToolDefinitions()`에서 read 묶음 다음 순서가 유지되는지 확인하는 방식으로 작성한다.
3. 분리 후 `tests/token-export-contract.test.js` 외에도 source-inspection 테스트가 새 위치를 기대해야 하는지 확인한다.
4. `npm run check:all`을 승인된 외부 실행으로 검증한다.
5. 완료 후 분리 파일 문서, 리포트, 핸드오프를 한국어로 갱신한다.

## continuationPrompt

`docs/handoff/2026-06-05-src-refactor-tool-definitions-read-handoff.md`를 읽고 다음 태스크를 진행해 주세요. 다음 태스크는 `src/server-tool-definitions.js`의 annotation/design-system/search/replay 계열 tool definition을 constants 파일로 작게 분리하는 것입니다. 기능 변경 없이 TDD RED/GREEN을 지키고, 완료 후 `npm run check:all`, 리포트, 핸드오프, 분리 파일 문서를 갱신해 주세요.
