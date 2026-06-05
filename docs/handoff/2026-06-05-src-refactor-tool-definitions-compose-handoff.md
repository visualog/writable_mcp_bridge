# src 순차 리팩터링 핸드오프: compose/layout tool definitions 분리

## task

위험도가 낮은 `src/server-tool-definitions.js`를 계속 작게 분리한다. 이번 태스크는 compose/layout 계열 tool definition 7개를 constants 파일로 분리하는 작업이다.

## context

- 이전 태스크에서 core, read/detail, discovery/annotation, mutation, node/import/update tool definition이 constants 파일로 분리되었다.
- 이번 태스크는 그 다음 순서인 `build_screen_from_design_system`부터 `build_layout`까지의 schema를 분리했다.
- 기능 변경과 public API 변경은 하지 않았다.
- `buildToolDefinitions()`의 반환 순서 보존 테스트를 추가했다.
- `src/server-tool-definitions.js`는 197줄이 되어 500줄 미만 상태가 되었다.

## changedFiles

- `src/constants/server-tool-definitions-compose.js`
- `src/server-tool-definitions.js`
- `tests/server-tool-definitions.test.js`
- `docs/server-refactor-extracted-files.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-compose-report.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-compose-handoff.md`

이전 태스크에서 아직 커밋되지 않은 관련 파일도 함께 남아 있다.

- `package.json`
- `src/constants/server-tool-definitions-core.js`
- `src/constants/server-tool-definitions-read.js`
- `src/constants/server-tool-definitions-discovery.js`
- `src/constants/server-tool-definitions-mutation.js`
- `src/constants/server-tool-definitions-node.js`
- `tests/token-export-contract.test.js`
- `docs/plans/2026-06-05-src-sequential-refactor-plan.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-core-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-read-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-discovery-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-mutation-report.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-node-report.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-core-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-read-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-discovery-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-mutation-handoff.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-node-handoff.md`

## tests

- `node --test tests/server-tool-definitions.test.js`: 통과, 7 pass
- `node --check src/server-tool-definitions.js`: 통과
- `node --check src/constants/server-tool-definitions-compose.js`: 통과
- `npm run check:all`: 통과, 644 tests, 632 pass, 12 skipped, 0 fail
- `/health`: 통과, `ok=true`, `transportHealth.grade=healthy`

## risks

- `src/server-tool-definitions.js`는 500줄 미만이지만, 마지막 node operation schema가 아직 남아 있다.
- 다음 분리 때도 tool order가 MCP 클라이언트 표면이므로 순서 보존 테스트를 먼저 추가해야 한다.
- source-inspection 방식의 테스트가 있으면 새 constants 파일을 검사하도록 최소 수정해야 한다.
- untracked 로컬 자료(`codex/`, `capture/`, `image-gen/` 등)는 이번 리팩터링과 무관하므로 건드리지 않았다.

## nextSteps

1. `src/server-tool-definitions.js`의 node operation 계열 schema를 `src/constants/server-tool-definitions-operations.js` 같은 constants 파일로 분리한다.
2. 추천 범위는 `create_instance`부터 `undo_last_batch`까지다.
3. RED 테스트는 `buildToolDefinitions()`에서 compose 묶음 다음 순서가 유지되는지 확인하는 방식으로 작성한다.
4. 실제 command 실행부, dispatch, queue, websocket, polling fallback은 건드리지 않는다.
5. 분리 후 `npm run check:all`을 실행한다.
6. 완료 후 분리 파일 문서, 리포트, 핸드오프를 한국어로 갱신한다.

## continuationPrompt

`docs/handoff/2026-06-05-src-refactor-tool-definitions-compose-handoff.md`를 읽고 다음 태스크를 진행해 주세요. 다음 태스크는 `src/server-tool-definitions.js`의 node operation 계열 tool definition을 constants 파일로 작게 분리하는 것입니다. 기능 변경 없이 TDD RED/GREEN을 지키고, 완료 후 `npm run check:all`, 리포트, 핸드오프, 분리 파일 문서를 한국어로 갱신해 주세요.
