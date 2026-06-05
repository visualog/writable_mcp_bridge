# src 순차 리팩터링 핸드오프: tool definitions core 분리

## task

위험도가 낮은 파일부터 순차적으로 리팩터링한다. 이번 태스크는 `src/server-tool-definitions.js`의 core tool definition 7개를 constants 파일로 분리하는 작업이다.

## context

- 사용자 요청: 기능 변경 금지, public API 변경 금지, `components/hooks/utils/constants` 단위 분리, 작은 diff, 완료마다 리포트와 핸드오프 저장.
- `package.json`에 `check:all`이 없어서 이번 태스크에서 `npm run check && npm test`로 추가했다.
- `server-tool-definitions.js`는 정적 schema 목록 중심이라 첫 분리 대상으로 선택했다.

## changedFiles

- `package.json`
- `src/constants/server-tool-definitions-core.js`
- `src/server-tool-definitions.js`
- `tests/server-tool-definitions.test.js`
- `docs/plans/2026-06-05-src-sequential-refactor-plan.md`
- `docs/server-refactor-extracted-files.md`
- `docs/reports/2026-06-05-src-refactor-tool-definitions-core-report.md`
- `docs/handoff/2026-06-05-src-refactor-tool-definitions-core-handoff.md`

## tests

- `node --test tests/server-tool-definitions.test.js`: 통과, 2 pass
- `node --check src/server-tool-definitions.js`: 통과
- `node --check src/constants/server-tool-definitions-core.js`: 통과
- `node --check src/server.js`: 통과
- `npm run check:all`: 통과, 639 tests, 627 pass, 12 skipped, 0 fail
- `/health`: 통과, `ok=true`, `transportHealth.grade=healthy`

## risks

- 이번 변경은 정적 tool schema 이동이라 런타임 동작 위험은 낮다.
- `npm run check:all`은 sandbox 안에서는 `listen EPERM 127.0.0.1`로 실패할 수 있다. 포트 listen이 필요한 통합 테스트가 있어 외부 실행 권한이 필요하다.
- 아직 `src/server-tool-definitions.js`는 1,803줄로 크다. 한 번에 더 많이 자르지 않고 다음 묶음도 작게 진행해야 한다.

## nextSteps

1. `src/server-tool-definitions.js`의 read/detail 계열 tool definition을 `src/constants/server-tool-definitions-read.js`로 분리한다.
2. 테스트는 기존 `buildToolDefinitions()` 순서 보존 방식으로 RED를 먼저 만든다.
3. `npm run check:all`을 실행한다. sandbox에서 `listen EPERM`이 나면 승인된 외부 실행으로 재시도한다.
4. 완료 후 `docs/server-refactor-extracted-files.md`, 리포트, 핸드오프를 다시 한국어로 갱신한다.

## continuationPrompt

`docs/handoff/2026-06-05-src-refactor-tool-definitions-core-handoff.md`를 읽고 다음 태스크를 진행해 주세요. 다음 태스크는 `src/server-tool-definitions.js`의 read/detail 계열 tool definition을 constants 파일로 분리하는 것입니다. 기능 변경 없이 TDD RED/GREEN을 지키고, 완료 후 `npm run check:all`, 리포트, 핸드오프, 분리 파일 문서를 갱신해 주세요.
