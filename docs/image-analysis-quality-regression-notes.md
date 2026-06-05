# 이미지 분석 화면 구현 품질 회귀 분석

## 배경

첨부 이미지 기준으로 세 화면을 비교했다.

1. 첫 번째 화면: 참조 이미지
2. 두 번째 화면: 이전에 구현한 화면
3. 세 번째 화면: 이번에 구현한 화면

세 번째 화면은 일부 규칙과 구현 힌트를 더 넣었지만, 실제 결과는 두 번째 화면보다 품질이 떨어졌다. 즉, 개선 규칙이 항상 시각 품질 향상으로 이어지지 않았고, 일부 경우에는 잘못된 분석 결과를 더 강하게 구현에 반영하면서 화면이 망가졌다.

## 눈에 보이는 퇴화 지점

### 1. 상단 status bar가 깨짐

- 세 번째 화면 우측 상단에 `ce`, `ba` 같은 잘못 해석된 텍스트가 노출된다.
- 원본의 wifi, cellular, battery 아이콘 구조가 텍스트 조각으로 변환된 것으로 보인다.
- 상태바는 원본을 아주 단순화하더라도 깨진 텍스트가 노출되면 안 된다.

### 2. 제목/배지 영역이 겹침

- `생활통장`, 편집 아이콘, 배지, `케이뱅크 100`의 계층이 깨졌다.
- 배지가 제목 위에 겹치거나 지나치게 가까이 붙어 보인다.
- 정보 위계가 원본보다 훨씬 불안정하다.

### 3. 쿠폰 row 아이콘 해석이 더 나빠짐

- 원본의 초록 쿠폰/뱃지 아이콘이 `b a n`처럼 세로 텍스트로 노출된다.
- 이전 화면의 카메라 아이콘도 부정확했지만, 이번 화면은 의미 없는 텍스트 조각이 보여 더 나빠졌다.
- 아이콘 분석 결과를 text fallback으로 그대로 넣는 방식이 문제다.

### 4. 토글 구현이 여전히 부정확함

- 원본 토글은 green track + white knob + `ON` 텍스트 구조다.
- 세 번째 화면에서는 `Togg` 같은 잘못된 텍스트가 노출된다.
- 토글은 텍스트/칩이 아니라 별도 구조로 고정해야 하지만, 잘못된 분석 결과가 들어오면 오히려 파손된다.

### 5. reference layer와 구현 layer가 섞여 보임

- 구현 화면이 전체적으로 흐릿하고 원본 이미지가 뒤에 깔린 듯한 느낌이 유지된다.
- reference layer는 비교용이어야 하며, 최종 구현 품질 판단을 방해하면 안 된다.

### 6. 버튼과 row 스타일이 여전히 원본과 다름

- 하단 버튼과 쿠폰 row는 여전히 회색 filled block에 가깝다.
- 원본은 흰 fill + 얇은 stroke + 적당한 radius의 outlined 형태다.
- 스타일 보정 규칙이 들어갔지만 실제 결과에서는 충분히 반영되지 않았거나, 다른 파손이 더 크게 나타났다.

## 가능성이 큰 원인

### 1. role 세분화가 실제 인식 품질보다 앞서감

`coupon_row`, `toggle_on`, `outlined_button` 같은 role을 추가했지만, 모델이 이 role을 안정적으로 분석하지 못하면 잘못된 role, label, helper가 그대로 구현에 반영된다.

특히 아이콘을 텍스트 fallback으로 처리하면서 `banner`, `battery`, `camera` 같은 단어 조각이 화면에 노출된 것으로 보인다.

### 2. deterministic 보정이 confidence 없이 적용됨

`implementation`, `visualStyle` 힌트가 있으면 보정하도록 했지만, 그 힌트 자체가 틀렸을 때 방어가 약하다.

즉, 잘못 분석된 `label`, `icon`, `helper`를 더 확신 있게 고정해버리는 문제가 생긴다.

### 3. 후보 비교 없이 최신 결과를 그대로 채택

두 번째 결과보다 세 번째 결과가 나쁜데도 최종 화면으로 생성되었다.

현재 흐름에는 생성 후 원본과 비교하거나, 이전 후보와 품질 점수를 비교해서 더 나은 쪽을 선택하는 단계가 부족하다.

### 4. 검증 기준이 구조 중심이고 시각 파손 감지가 약함

현재 검증은 role count, bbox, text coverage, style hint 일부를 본다.

하지만 다음 같은 실제 품질 저하는 충분히 잡지 못한다.

- 텍스트 겹침
- 원본에 없는 짧은 영어 조각 노출
- status bar 파손
- 아이콘 fallback 텍스트 노출
- label 세로 쪼개짐
- toggle/button/row 내부 텍스트 overflow

## 개선 방향

### 1. 보정은 confidence 조건을 만족할 때만 적용

`visualStyle`, `implementation`이 있어도 `role`, `label`, `bbox`가 신뢰 가능한 경우에만 deterministic 보정을 적용해야 한다.

예시 조건:

- label이 원본 visible text와 일치하거나 충분히 유사함
- label이 의미 없는 1~2글자 알파벳 조각이 아님
- bbox가 화면 내 정상 범위에 있음
- role과 implementation helper가 서로 모순되지 않음
- 같은 bbox에 이미 더 적합한 노드가 없음

### 2. 아이콘은 텍스트 fallback 노출 금지

`battery`, `wifi`, `camera`, `banner` 같은 분석 단어를 그대로 `characters`로 넣으면 안 된다.

개선 방향:

- 확실한 SF Symbol fallback이 있으면 glyph 또는 안전한 대체 기호 사용
- 확실하지 않으면 작은 neutral icon placeholder로 생성
- 아이콘 분석 단어 자체는 화면 텍스트로 노출하지 않음
- status bar 영역에서는 알파벳 텍스트 조각을 금지

### 3. 생성 후 visual sanity validator 추가

생성된 tree에 대해 시각 파손을 감지해야 한다.

검사 항목:

- 텍스트 overlap
- 원본에 없는 짧은 영어 조각
- status bar 영역의 잘못된 text
- label 세로 쪼개짐
- toggle/button/row 내부 텍스트 overflow
- 원본 visible label 대비 누락/오인식
- bbox 밖으로 튀어나온 child

### 4. 이전 후보와 새 후보를 비교해서 더 좋은 결과 선택

새 생성물이 이전 결과보다 품질 점수가 나쁘면 그대로 채택하지 않아야 한다.

비교 기준:

- overlap count
- unknown text count
- bbox mismatch count
- missing visible label count
- role style mismatch count
- component structure mismatch count

새 후보가 이전 후보보다 나쁘면:

- 이전 결과 유지
- 또는 품질 피드백을 붙여 재시도
- 또는 deterministic 보정을 끄고 재시도

### 5. 보정 규칙을 강제 변환보다 실패/재시도 피드백 중심으로 이동

잘못된 분석을 deterministic하게 고치려 하면 오히려 화면이 망가질 수 있다.

따라서 다음 순서가 더 안전하다.

1. 나쁜 생성물을 정확히 감지한다.
2. 감지 결과를 재시도 프롬프트에 전달한다.
3. 명확하고 confidence 높은 경우에만 deterministic 보정을 적용한다.

## 우선순위 제안

1. visual sanity validator 추가
2. status bar 영역의 잘못된 텍스트 감지
3. 아이콘 fallback 텍스트 노출 금지
4. text overlap 및 label 세로 쪼개짐 감지
5. deterministic 보정에 confidence gate 추가
6. 이전 후보와 새 후보 품질 점수 비교

## 결론

이번 품질 저하는 규칙이 부족해서만 생긴 문제가 아니다.

더 큰 원인은 **불완전한 분석 결과를 너무 적극적으로 구현에 반영한 것**이다.

다음 개선은 role 보정을 계속 늘리는 것보다, 먼저 **나쁜 생성물을 거르는 visual sanity gate와 후보 비교/재시도 루프**를 넣는 방향이 맞다.
