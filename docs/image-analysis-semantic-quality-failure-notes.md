# 이미지 분석 화면 구성 실패 원인 및 개선 방향

## 요약

이번 실패는 이전의 `export_node timeout` 문제가 아니다. 선택한 프레임 이미지는 정상적으로 읽혔고, Codex가 화면 구성도 시도했지만, 최종 품질 검증에서 생성물이 차단되었다.

실패 메시지:

```text
이미지에서 인식한 UI 요소가 편집 가능한 Figma 레이어로 충분히 변환되지 않아 화면 구성을 중단했습니다.
인식 역할 7개 중 생성 노드 85개, 좌표 노드 38/4개, 텍스트 반영 3/7개입니다.
누락된 문구:
- "9:41, cellular, Wi-Fi, battery"
- "Competitor image collage"
- "Results table: Athletes, Time, Score, Aikos, Amp, Avg"
```

핵심은 노드 수가 부족한 것이 아니라, `roleMapJson`에 들어간 분석 역할과 `treeJson`의 편집 가능한 레이어가 의미적으로 맞지 않았다는 점이다.

## 현재 화면 관찰

첨부 이미지에서 보이는 생성 결과는 큰 구조 면에서는 참조 화면을 어느 정도 따라간다.

- iOS 상태바
- 뒤로가기와 제목이 있는 헤더
- `Weekend Warriors`, `Ends in 2d 14h` pill
- 오렌지 히어로 카드
- 원형 아바타/이미지 콜라주
- `Results` 통계 카드
- 하단 순위/progress bar 카드
- 보상 배너

하지만 품질 게이트는 다음 이유로 실패했다.

- 참조 이미지에서 인식한 주요 텍스트 중 일부가 `treeJson` 텍스트 노드에 없다고 판단했다.
- 인식된 bbox와 생성된 같은 문구의 위치가 충분히 맞지 않는다고 판단했다.
- 실제 화면 문구가 아닌 시각 설명이 텍스트 coverage 대상에 포함되었다.

## 원인 1. role label에 실제 화면 문구와 시각 설명이 섞임

누락 문구 중 다음 항목은 실제 화면에 그대로 보이는 텍스트가 아니다.

```text
Competitor image collage
Results table: Athletes, Time, Score, Aikos, Amp, Avg
```

이들은 화면 위에 표시되는 copy가 아니라, 이미지 분석 모델이 만든 시각/구조 설명에 가깝다.

문제는 이런 설명형 label이 `visible text coverage` 대상으로 들어가면, 생성 결과가 정상이어도 `treeJson`에 해당 문구가 없다는 이유로 실패한다는 점이다.

개선 방향:

- `roleMapJson`에 `label` 하나만 두지 말고 `textLabel`과 `visualLabel`을 분리한다.
- 실제 화면에 보이는 문구만 `textLabel`로 둔다.
- `Competitor image collage`, `left runner avatar`, `hero artwork` 같은 설명은 `visualLabel` 또는 `description`으로 둔다.
- `visualLabel`은 텍스트 반영률 계산에서 제외하고, bbox/shape/image placeholder 존재 여부로 검증한다.

## 원인 2. 상태바를 하나의 긴 문구로 취급함

실패 메시지의 상태바 항목:

```text
"9:41, cellular, Wi-Fi, battery"
```

참조 화면에서 실제 텍스트는 `9:41`뿐이다. `cellular`, `Wi-Fi`, `battery`는 아이콘 의미이지 화면에 그대로 표시되는 문자열이 아니다.

현재 검증은 이 묶음을 하나의 visible label처럼 다루고 있어, 생성된 상태바가 `9:41`과 아이콘 placeholder를 포함하더라도 텍스트 반영률에서 실패할 수 있다.

개선 방향:

- 상태바 role은 고정 구조로 정규화한다.
- `9:41`만 `textLabel`로 처리한다.
- `cellular`, `wifi`, `battery`는 `visualParts` 또는 `iconRoles`로 분리한다.
- 상태바 검증은 다음 조건으로 바꾼다.
  - 시간 텍스트 존재
  - 우측 아이콘/placeholder 그룹 존재
  - bbox가 상단 status bar 영역에 있음

## 원인 3. Results 테이블 구조 인식이 실제 화면과 다름

실패 메시지:

```text
Results table: Athletes, Time, Score, Aikos, Amp, Avg
```

하지만 첨부 화면에서 실제 Results 카드에 보이는 항목은 다음에 가깝다.

```text
Results
Me
Lara
Sam
Distance
Runs
Avg Pace
24.7 km
21.2 km
18.9 km
5
6
4
5:12
5:45
5:30
```

`Athletes`, `Time`, `Score`, `Aikos`, `Amp`는 현재 화면의 실제 표시 문구로 보기 어렵다. 즉, OCR/분석 단계에서 다른 테이블 스키마나 추론된 설명이 섞였을 가능성이 있다.

개선 방향:

- 이미지 분석 결과를 그대로 role coverage 기준으로 쓰기 전에 `visible text 후보`를 정제한다.
- 긴 설명형 label, 콜론이 포함된 구조 설명, 쉼표로 나열된 schema 설명은 visible text에서 제외한다.
- 테이블 role은 다음처럼 분리한다.

```json
{
  "role": "results_table",
  "textLabels": ["Results", "Me", "Lara", "Sam", "Distance", "Runs", "Avg Pace"],
  "visualLabel": "stats table card"
}
```

## 원인 4. 생성 화면은 시각적으로 유사하지만 semantic mapping이 부족함

첨부 화면의 구현 결과는 다음 요소를 시각적으로 포함한다.

- 오렌지 히어로 영역
- 세 개의 vertical runner lane
- 원형 아바타
- 통계 카드
- 순위 progress bar
- 보상 배너

그러나 품질 게이트는 `roleMapJson` 항목과 `treeJson` 항목의 직접 대응을 본다. 즉, 화면에 비슷한 형태가 있어도 role의 label/bbox/name이 충분히 연결되지 않으면 실패한다.

개선 방향:

- 생성 단계에서 roleMap id를 tree node에 보존한다.
- 예: `roleId`, `sourceRoleId`, `semanticRole` 필드를 tree node에 넣는다.
- 검증은 이름/텍스트 유사도만 보지 말고 role id 기반 대응을 우선한다.

## 원인 5. 프레임 viewport 기준은 반영됐지만 분석 품질 문제는 별도임

이전 개선으로 frame-like 선택은 다음 조건으로 export된다.

```js
{
  analysisScope: "clipped_frame_viewport",
  frameViewportClipped: true,
  contentsOnly: false,
  useAbsoluteBounds: false,
  scale: 0.25
}
```

이 설정은 프레임 밖으로 넘친 큰 이미지 영역을 분석하지 않도록 하는 데 필요하다.

하지만 이번 실패는 export 범위 문제가 해결된 뒤 드러난 다음 단계 문제다.

- 분석 모델이 실제 visible text와 설명형 label을 구분하지 못함
- 상태바/아이콘/아바타 같은 비텍스트 요소를 text coverage 기준에 포함함
- 테이블 구조를 실제 문구가 아니라 추론된 schema label로 기록함

## 개선 우선순위

### 1. roleMap schema 분리

현재:

```json
{
  "role": "hero_image",
  "label": "Competitor image collage"
}
```

개선:

```json
{
  "role": "hero_image",
  "textLabel": null,
  "visualLabel": "competitor image collage",
  "visibleText": false,
  "bbox": { "x": 24, "y": 130, "width": 354, "height": 170 }
}
```

### 2. visible text 정제 필터 추가

텍스트 coverage 대상에서 제외할 후보:

- 콜론 뒤에 schema 설명이 붙은 label
- 쉼표로 나열된 구조 설명
- `image`, `collage`, `avatar`, `artwork`, `table:` 같은 설명형 단어
- `cellular`, `wifi`, `battery` 같은 아이콘 의미 단어
- 실제 화면에 그대로 표시되지 않는 분석 설명

### 3. 상태바 전용 검증 로직

상태바는 다음 구조로 검증한다.

- `9:41` 시간 텍스트
- 우측 signal/wifi/battery icon group
- 상단 0~44px 영역 내 배치

`cellular`, `Wi-Fi`, `battery`를 화면 텍스트로 요구하지 않는다.

### 4. visual role 검증 추가

아바타/이미지/아이콘/그래픽은 텍스트 coverage가 아니라 visual coverage로 검증한다.

검증 기준:

- bbox 영역에 ellipse/card/image placeholder가 있음
- 크기와 위치가 role bbox와 일정 수준 이상 겹침
- 원형 아바타는 width/height가 유사함

### 5. 테이블 role을 셀 단위로 분해

`Results table: ...` 같은 설명형 label 대신, 실제 표시 텍스트를 개별 셀로 분리한다.

예:

```json
[
  { "role": "section_title", "textLabel": "Results" },
  { "role": "table_column", "textLabel": "Me" },
  { "role": "table_column", "textLabel": "Lara" },
  { "role": "table_column", "textLabel": "Sam" },
  { "role": "metric_label", "textLabel": "Distance" },
  { "role": "metric_label", "textLabel": "Runs" },
  { "role": "metric_label", "textLabel": "Avg Pace" }
]
```

### 6. 재시도 프롬프트 개선

현재 재시도 문구는 이전 계좌 화면에 가까운 구조를 예시로 든다.

```text
상태바, 헤더, 정보 그룹, 토글, 버튼, 하단바
```

Running Challenge 화면에는 다음 구조가 더 적합하다.

```text
상태바, 헤더, 상단 pill 그룹, 오렌지 히어로 카드, 러너 lane, 원형 아바타, 결과 통계 테이블, 순위 progress 리스트, 보상 배너를 각각 별도 레이어로 구성하고 좌표로 배치
```

개선 방향:

- 화면 유형별 재시도 힌트를 동적으로 만든다.
- roleMap에 `progress`, `results`, `avatar`, `challenge`, `badge`가 있으면 fitness/challenge 화면용 힌트를 사용한다.

## 다음 작업 제안

우선순위대로 진행하면 다음 순서가 적합하다.

1. `roleMapJson` normalize 단계에서 `label`을 `textLabel/visualLabel`로 분류
2. `visibleRoleLabelCount`와 `coveredRoleLabelCount` 계산에서 visual-only label 제외
3. 상태바 icon word를 text coverage에서 제외하고 visual part로 검증
4. `Results table: ...` 같은 schema 설명 label 필터링
5. Running Challenge 화면 전용 fixture 추가
6. 재시도 프롬프트를 화면 역할 기반으로 동적 생성

## 반영 완료

다음 항목을 코드에 반영했다.

- `normalizeImageRoleMapEntry`에서 `textLabel`, `textLabels`, `visualLabel`, `visibleText`를 정규화한다.
- `Competitor image collage`, `avatar`, `artwork`, `image` 계열 설명형 label은 visual-only role로 분류한다.
- `9:41, cellular, Wi-Fi, battery` 같은 상태바 composite label은 `9:41`만 text coverage 대상으로 사용한다.
- `cellular`, `wifi`, `battery` 같은 icon 의미 단어는 text coverage에서 제외한다.
- `Results table: Athletes, Time, Score, Aikos, Amp, Avg` 같은 schema 설명 label은 visual-only로 분류한다.
- semantic quality의 `visibleRoleLabelCount`, `coveredRoleLabelCount`, `missingRoleLabels`, bbox alignment, wrap risk 계산은 visible text label만 대상으로 삼는다.
- visual-only role은 `visualOnlyRoleCount`, `visualOnlyRoleLabels`로 별도 리포팅한다.
- 상태바 composite role은 전체 status bar bbox가 넓어도 시간 텍스트 width 기준으로 wrap risk를 잘못 내지 않도록 제외했다.
- 이미지 분석 프롬프트에 `textLabel/textLabels/visualLabel/visibleText` 분리 규칙을 추가했다.

추가한 회귀 테스트:

```text
runCodexImageLayoutPlan excludes visual-only analysis labels from text coverage
```

이 테스트는 다음 실패 문구들이 더 이상 `missingRoleLabels`로 잡히지 않는지 확인한다.

```text
Competitor image collage
Results table: Athletes, Time, Score, Aikos, Amp, Avg
9:41, cellular, Wi-Fi, battery
```

검증 결과:

```text
node --check src/codex-cli-runner.js
=> pass

node --check src/server.js
=> pass

node --test tests/codex-cli-runner.test.js
=> 41 pass, 0 fail

node --test tests/ai-designer-chat-api.integration.test.js tests/ui-designer-contract.test.js
=> 30 pass, 12 skipped, 0 fail

npm test
=> 491 tests
=> 479 pass
=> 12 skipped
=> 0 fail
```

## 결론

이번 실패는 export 범위 문제는 아니다. 선택 프레임의 clipped viewport는 정상적으로 분석 흐름에 들어갔지만, 분석 결과의 role label 품질과 검증 기준이 맞지 않아 중단되었다.

가장 큰 개선점은 실제 화면에 보이는 텍스트와 시각 요소 설명을 분리하는 것이다. `Competitor image collage`, `Results table: ...`, `cellular/Wi-Fi/battery` 같은 항목을 텍스트 반영률의 필수 문구로 보면 정상적인 구현도 실패한다.

따라서 다음 개선은 생성 모델을 더 강하게 재시도시키는 것보다, roleMap 정규화와 semantic quality 검증 기준을 먼저 고치는 방향이 맞다.
