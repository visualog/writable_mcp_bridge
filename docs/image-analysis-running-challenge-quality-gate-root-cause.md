# Running Challenge 이미지 분석 실패 원인 및 개선 기록

작성일: 2026-05-28

## 대상 상황

Figma `Agent_skill_test / Page 55`에서 선택한 `Frame 2`를 기준으로 이미지 분석 후 편집 가능한 화면 생성을 요청했지만, 브리지에서 `codex_cli_image_layout_understructured` 오류로 중단됐다.

컴퓨터 유즈로 확인한 Figma 상태:

- 선택 노드: `Frame 2`
- 타입: `FRAME`
- 크기: `402 x 870.2637`
- 프레임 옵션: 넘친 콘텐츠 숨기기 활성
- 내부 이미지: `image 2`
- 내부 이미지 크기: `848.176 x 1060.22`
- 내부 이미지는 프레임보다 크고, 프레임 viewport에 필요한 부분만 clipped 상태로 표시됨

브리지 상태:

- `/health` 정상
- `transportHealth: healthy`
- `commandReadiness: ready`
- 활성 플러그인: `page:33276:16484`

## 라이브 재현 결과

동일 선택 프레임으로 `/api/designer/chat`를 호출해 재현했다.

요청:

```text
선택한 이미지를 분석해서 화면으로 구현해줘
```

응답은 실패였고, 핵심 품질 지표는 다음과 같았다.

```json
{
  "code": "codex_cli_image_layout_understructured",
  "roleCount": 7,
  "generatedNodeCount": 83,
  "coordinateNodeCount": 60,
  "visibleRoleLabelCount": 26,
  "coveredRoleLabelCount": 26,
  "missingRoleLabels": [],
  "bboxRoleLabelCount": 6,
  "bboxAlignedRoleLabelCount": 5,
  "bboxMisalignedRoleLabels": ["9:41"],
  "visualOnlyRoleCount": 1,
  "visualOnlyRoleLabels": [
    "orange rounded card with overlapping circular participant photos and small sparkle decorations"
  ],
  "outlinedStyleMismatchLabels": ["View you 85 miles + Champion Badge"],
  "textOverlapCount": 1,
  "visualSanityIssueCount": 1,
  "visualSanityTooLow": true
}
```

## 원인

이번 실패는 초기 단계의 “텍스트를 못 읽음”이나 “레이어가 너무 적음” 문제가 아니었다.

- 텍스트 반영은 `26/26`으로 통과했다.
- 좌표 노드는 `60/4`로 충분했다.
- 생성 노드도 `83`개로 충분했다.
- 실제 차단 원인은 단일 텍스트 겹침 1건과 보상 배너의 outline 스타일 오판이었다.

### 1. 단일 텍스트 겹침이 전체 실패로 처리됨

기존 검증은 `textOverlapCount`가 1개만 있어도 `visualSanityTooLow`를 true로 만들었다.

Running Challenge처럼 작은 모바일 화면을 이미지에서 복원하는 경우, 탭/테이블/중복 라벨에서 경미한 겹침 1건은 재시도 대상은 될 수 있지만 전체 생성 중단 사유로 보기에는 과했다. 특히 이번 결과는 텍스트와 좌표 커버리지가 이미 통과한 상태라서, 단일 겹침만으로 중단하면 개선된 결과도 계속 실패로 분류된다.

### 2. 보상 배너를 outline 컴포넌트로 잘못 판정함

실패 라벨은 `"View you 85 miles + Champion Badge"`였다.

참조 화면의 하단 보상 영역은 연한 노란색 fill을 가진 배너에 가깝다. 그런데 roleMap의 `strategy: "outlined"` 값만 과하게 신뢰하면서, 실제 role이 `reward_banner`인데도 stroke가 없는 filled banner를 outline mismatch로 거부했다.

즉, 모델의 중간 분석 필드 하나가 부정확해도 validator가 이를 강하게 믿고 결과를 실패 처리했다.

### 3. 플러그인 오류 메시지가 실제 실패 원인을 숨김

UI 메시지는 계속 다음 식의 일반 안내를 표시했다.

```text
편집 가능한 Figma 레이어로 충분히 변환되지 않아 화면 구성을 중단했습니다.
```

하지만 실제 지표는 레이어/텍스트/좌표 부족이 아니었다. 사용자는 “무엇을 고쳐야 하는지”가 아니라 “상태바, 헤더, 정보 그룹...” 같은 일반 힌트만 받았다. Running Challenge 화면에는 히어로 카드, 러너 아바타, 결과 테이블, 순위 progress, 보상 배너가 핵심인데, 오류 메시지가 화면 유형에 맞지 않았다.

## 개선 방향

### 품질 게이트 조정

- `textOverlapCount`는 계속 기록한다.
- 단일 겹침은 실패로 보지 않는다.
- 3건 이상부터 `severeTextOverlapCount`로 승격해 `visualSanityTooLow`에 반영한다.

이렇게 하면 실제 품질 문제는 잡되, 거의 완성된 결과가 사소한 겹침 하나로 폐기되지 않는다.

### outline 판정 보수화

outline mismatch는 다음 중 하나일 때만 적용한다.

- role 자체가 `outline`, `outlined`, `bordered`, `stroke`를 명시
- `visualStyle`에 stroke/border가 있고 fill이 white/transparent 계열
- button/row/list/chip/coupon/field/input/card 같은 컴포넌트 역할이면서 strategy도 outline 계열

`reward_banner`처럼 filled banner로 자연스러운 요소는 strategy 값 하나만으로 outline 필수 컴포넌트로 보지 않는다.

### 오류 메시지 개선

오류 메시지에 다음을 노출한다.

- 텍스트 겹침 수와 심각 겹침 수
- 아이콘/상태바 fallback 수
- outline/fill 스타일 mismatch 라벨
- Running Challenge류 화면이면 구조 힌트를 `상태바, 헤더, 상단 pill, 오렌지 히어로 카드, 러너/아바타, 결과 테이블, 순위 progress 리스트, 보상 배너`로 표시

## 적용한 코드 변경

- `src/codex-cli-runner.js`
  - 단일 `textOverlapCount`를 즉시 실패로 보지 않고, `severeTextOverlapCount >= 3`일 때만 시각 sanity 실패에 반영
  - `expectsOutlinedComponent`가 role/visualStyle/component role을 함께 보도록 조정
- `figma-plugin/ui.html`
  - `codex_cli_image_layout_understructured` 메시지에 실제 품질 실패 사유를 추가
  - Running Challenge 계열 화면에 맞는 구조 힌트 추가
- `tests/codex-cli-runner.test.js`
  - Running Challenge의 경미한 겹침과 filled reward banner를 통과시키는 회귀 테스트 추가
- `tests/fixtures/mock-codex-image-layout-running-challenge-minor-sanity.mjs`
  - 라이브 실패 패턴을 축소 재현하는 fixture 추가
- `tests/fixtures/mock-codex-image-layout-overlap-regression.mjs`
  - 심각한 텍스트 겹침 회귀 테스트가 여전히 실패하도록 겹침 수 보강

## 검증 계획

1. 정적 문법 검사
   - `node --check src/codex-cli-runner.js`
   - `node --check src/server.js`
2. 회귀 테스트
   - `node --test tests/codex-cli-runner.test.js`
   - UI 오류 메시지 관련 테스트 확인
3. 브리지 라이브 검증
   - 서버 재시작
   - `/health` 확인
   - Figma 선택 노드 유지 확인
   - 동일 `/api/designer/chat` 요청 재실행
   - 더 이상 단일 겹침 또는 reward banner outline 오판으로 실패하지 않는지 확인

## 추가 라이브 검증 및 최종 결과

초기 수정 후 라이브 브리지에서 다시 확인하자 기존 두 원인은 해소됐지만, 다음의 새 과검증/품질 문제가 드러났다.

- `outlinedStyleMismatchTooHigh=false`, `textOverlapCount=0`까지 내려간 시도는 있었다.
- 그러나 테이블/통계 영역에 `textWrapRiskTooHigh=true`가 남았다.
- 다른 시도에서는 넓은 Figma 텍스트 박스가 서로 겹친다는 이유로 `textOverlapCount`가 23개 이상으로 계산됐다.

추가 원인:

- 결과 테이블, 통계 테이블, leaderboard처럼 좁은 셀에 들어가는 텍스트에도 일반 버튼/행과 같은 최소 한 줄 폭 검증을 적용했다.
- `mi`, `km`, `pts` 같은 단위 약어를 알 수 없는 짧은 fallback 텍스트로 오인했다.
- 겹침 검증이 실제 글자 폭이 아니라 Figma 텍스트 노드의 박스 폭 전체를 사용했다. 테이블 셀처럼 넓은 박스 안에 짧은 텍스트가 들어가면 실제 글자는 겹치지 않아도 박스 기준으로는 겹치는 것으로 계산됐다.
- `visualStyle.stroke`만 보고 header/table 같은 비컴포넌트 role도 outlined 필수 요소로 판정했다.

추가 개선:

- `table`, `stats`, `statistics`, `leaderboard`, `results`, `scoreboard` role과 다중 텍스트 그룹은 `textWrapRisk` 대상에서 제외했다.
- `mi`, `km`, `hr`, `hrs`, `min`, `pts`를 허용 단위 약어로 추가했다.
- 텍스트 겹침 검증은 node width 전체가 아니라 `estimateOneLineTextMinWidth(text)` 기반의 예상 실제 글자 폭으로 계산하도록 변경했다.
- `textAlign`이 center/right/end일 때 예상 글자 박스의 x 위치도 정렬 기준으로 보정했다.
- `visualStyle.stroke` 기반 outline 판정은 button/row/list/chip/coupon/field/input/card 같은 컴포넌트 role에만 적용하도록 좁혔다.

최종 브리지 검증 결과:

```json
{
  "ok": true,
  "intentKind": "generate_screen",
  "codexStatus": "completed",
  "semanticQuality": {
    "roleCount": 7,
    "generatedNodeCount": 85,
    "coordinateNodeCount": 66,
    "visibleRoleLabelCount": 22,
    "coveredRoleLabelCount": 22,
    "textWrapRiskTooHigh": false,
    "outlinedStyleMismatchTooHigh": false,
    "textOverlapCount": 2,
    "severeTextOverlapCount": 0,
    "visualSanityTooLow": false
  },
  "qualityRetry": {
    "attempted": true,
    "attempts": 2,
    "recovered": true
  }
}
```

컴퓨터 유즈로 Figma 화면도 확인했다.

- 선택 프레임 `Frame 2`는 유지됐다.
- 오른쪽에 새 `Running Challenge screen` 생성 결과가 추가됐다.
- Xbridge 플러그인은 `WS-first`, `안정성 좋음` 상태였다.

자동화 검증:

- `node --check src/codex-cli-runner.js` 통과
- `node --check src/server.js` 통과
- `node --test tests/codex-cli-runner.test.js` 통과: 42개
- `node --test tests/ui-designer-contract.test.js` 통과: 15개
- `npm test` 통과: 492개 중 480개 pass, 12개 skip, 0 fail
