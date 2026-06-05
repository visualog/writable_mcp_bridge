# 이미지 분석 화면 구현 Visual Sanity 개선 리포트

## 작업 목표

`docs/image-analysis-quality-regression-notes.md`의 우선순위 제안에 맞춰 이미지 기반 화면 생성 품질 저하를 막는 개선을 진행했다.

핵심 목표는 role 보정을 더 늘리는 것이 아니라, 잘못된 분석 결과가 화면에 그대로 노출되는 경우를 먼저 감지하고 재시도 피드백으로 돌리는 것이다.

## 구현 내용

### 1. Visual sanity validator 추가

`src/codex-cli-runner.js`의 이미지 레이아웃 품질 검증에 visual sanity 검사를 추가했다.

추가된 지표:

- `visualSanityIssueCount`
- `visualSanityTooLow`
- `statusBarUnknownTextCount`
- `unknownShortTextCount`
- `iconFallbackTextCount`
- `verticalSplitLabelCount`
- `textOverlapCount`

이 지표 중 하나라도 문제가 있으면 `codex_cli_image_layout_understructured`로 거부하고, 재시도 프롬프트에 구체적인 실패 원인을 전달한다.

### 2. Status bar 영역의 잘못된 텍스트 감지

상단 status bar 영역에서 `ce`, `ba` 같은 짧은 알파벳 조각이 텍스트 노드로 생성되면 실패 처리한다.

이유:

- 원본의 wifi, cellular, battery 아이콘이 텍스트 조각으로 잘못 변환되는 문제를 막기 위함이다.
- status bar는 정확한 아이콘 구현이 어렵더라도 의미 없는 알파벳 조각이 보이면 안 된다.

### 3. 아이콘 fallback 텍스트 노출 감지

다음과 같은 분석 단어가 화면 텍스트로 노출되는 경우를 감지한다.

- `battery`
- `wifi`
- `cellular`
- `camera`
- `banner`
- `chevron`
- `toggle`
- `switch`
- `icon`
- `image`

이 단어들은 화면 텍스트가 아니라 아이콘 분석 메타데이터에 가깝다. 확실한 glyph가 없으면 작은 중립 placeholder로 처리해야 하며, 텍스트로 노출하면 품질 실패로 본다.

### 4. Text overlap 감지

생성된 text node들의 bbox가 일정 비율 이상 겹치면 실패 처리한다.

목적:

- `생활통장`, 배지, `케이뱅크 100` 같은 영역이 겹쳐 화면 계층이 무너지는 문제를 감지한다.
- 구조상 role/text coverage가 충분해도 실제 시각 결과가 깨진 경우를 잡는다.

### 5. Label 세로 쪼개짐 감지

`b`, `a`, `n`처럼 단일 알파벳이 같은 x축에 세로로 쌓여 하나의 잘못된 label처럼 보이는 경우를 감지한다.

목적:

- 쿠폰 아이콘이나 배너/아이콘 분석 단어가 세로 텍스트로 노출되는 문제를 막는다.
- 한 label은 하나의 충분한 width를 가진 text node로 구현되어야 한다.

### 6. Deterministic 보정 confidence gate 유지

이전 작업에서 추가한 role 기반 deterministic 보정은 다음 조건이 있을 때만 적용되도록 제한했다.

- `styleIntent`가 있음
- `visualStyle`이 있음
- `implementation`이 있음

즉, 단순 `role/label/bbox`만으로는 강제 보정하지 않는다. 이 제한은 잘못된 분석을 더 강하게 고정해 화면을 망가뜨리는 문제를 줄이기 위한 방어 장치다.

### 7. 재시도 피드백 강화

`visualSanityTooLow`가 true일 때 재시도 프롬프트에 다음 정보를 전달한다.

- 텍스트 겹침 개수
- status bar 알파벳 조각 개수
- 짧은 fallback 텍스트 개수
- 세로 쪼개짐 label 개수

재시도 지시도 추가했다.

- status bar에는 `ce`, `ba` 같은 알파벳 조각을 넣지 않는다.
- `battery`, `wifi`, `camera`, `banner` 같은 분석 단어를 화면 텍스트로 노출하지 않는다.
- 확실하지 않은 아이콘은 작은 중립 도형/기호로 처리한다.
- 텍스트끼리 겹치거나 한 label이 세로로 쪼개지면 실패로 본다.

### 8. 이전 후보 대비 회귀 감지

`figmaContext.generatedScreen.semanticQuality` 또는 `figmaContext.latestGeneratedScreen.semanticQuality`가 제공되면 새 후보와 이전 후보를 비교한다.

비교 항목:

- `coveredRoleLabelCount`
- `missingRoleLabels`
- `visualSanityIssueCount`
- `textOverlapCount`

새 후보가 이전 후보보다 visible label coverage가 낮거나, 누락 label/visual sanity/text overlap이 늘어나면 `candidateQualityRegressed`로 거부한다.

## 추가한 테스트

### Fixtures

- `tests/fixtures/mock-codex-image-layout-visual-sanity-regression.mjs`
- `tests/fixtures/mock-codex-image-layout-overlap-regression.mjs`
- `tests/fixtures/mock-codex-image-layout-candidate-regression.mjs`

### Tests

- `runCodexImageLayoutPlan rejects visual sanity regressions in status bar and icon fallback text`
- `runCodexImageLayoutPlan rejects overlapping visible text nodes`
- `runCodexImageLayoutPlan rejects a new candidate that regresses against prior semantic quality`

검증하는 항목:

- status bar 영역의 `ce`, `ba` 같은 알파벳 조각 감지
- `b/a/n` 같은 세로 쪼개짐 label 감지
- 원본 visible label에 없는 짧은 영어 조각 감지
- 주요 텍스트 bbox overlap 감지
- 이전 후보보다 visible label coverage가 떨어진 새 후보 감지

## 검증 결과

### Targeted Tests

```text
node --test tests/codex-cli-runner.test.js
tests: 39
pass: 39
fail: 0
```

### Contract / Integration Tests

```text
node --test tests/ui-designer-contract.test.js tests/ai-designer-chat-api.integration.test.js tests/token-export-contract.test.js
tests: 58
pass: 46
fail: 0
skipped: 12
```

### Syntax Checks

```text
node --check src/codex-cli-runner.js
node --check src/server.js
node --check figma-plugin/code.js
```

모두 통과했다.

### Full Test Suite

```text
npm test
tests: 488
pass: 476
fail: 0
skipped: 12
```

### Live Bridge Health

```text
GET http://127.0.0.1:3846/health
ok: true
transportHealth: healthy
commandReadiness: ready
writeReadiness: ready
activeSession: Agent_skill_test / Page 55
```

## 남은 한계와 다음 단계

이번 작업은 "나쁜 생성물을 감지하고 거부/재시도하는 것"에 초점을 맞췄다.

아직 남은 과제:

1. 실제 Figma 캔버스 렌더 결과 기반 pixel/geometry 비교
2. reference layer와 구현 layer의 시각적 혼합 방지
3. 아이콘별 안전한 placeholder/glyph 매핑 강화
4. 생성 후 deterministic 보정 결과에 대한 별도 visual sanity 재검사
5. semantic quality 기준의 이전 후보 회귀 감지는 추가했지만, 실제 렌더 스크린샷 기반 자동 후보 선택/롤백은 별도 구현 필요

## 결론

이번 개선으로 이전보다 나쁜 결과가 생성되었을 때 다음 문제들을 더 명확히 잡을 수 있다.

- status bar 깨짐
- 아이콘 분석 단어의 텍스트 노출
- 짧은 알파벳 조각 노출
- label 세로 쪼개짐
- 주요 텍스트 겹침

이제 이미지 기반 화면 생성은 단순 구조 커버리지뿐 아니라 시각 파손 여부까지 품질 게이트에 포함한다.
