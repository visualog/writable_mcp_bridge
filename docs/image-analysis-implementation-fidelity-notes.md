# 이미지 분석 기반 화면 구현 Fidelity 개선 정리

## 배경

최근 생성된 화면은 이전보다 조금씩 나아지고 있지만, 여전히 원본 화면을 잘못 해석하거나 구현 방식이 부족한 부분이 보인다.

특히 문제는 생성 후 검증만의 문제가 아니다. 그보다 앞단에서 이미지 분석 결과가 UI 요소의 의미, 시각 스타일, Figma 구현 방식을 충분히 구조화하지 못하고 있다.

현재 흐름은 대체로 "이미지에서 보이는 요소를 나열하고 Figma 레이어로 만든다"에 가깝다. 앞으로는 "이미지에서 보이는 요소를 Figma로 구현 가능한 컴포넌트 설계로 변환한다"에 가까워져야 한다.

## 현재 구현 화면에서 보이는 문제

### 1. 텍스트는 인식하지만 텍스트 박스와 계층을 잘못 잡음

- `생활통장`은 원본에서 명확한 한 줄 제목인데, 구현본에서는 폭이 부족하거나 위치가 불안정해 보인다.
- `계좌구분`, `적용금리`, `개설일` 같은 정보 그룹은 원본에서 좌측 label + 우측 value의 작은 정보 테이블 구조다.
- 구현본은 이 정보 그룹의 밀도, 정렬, 행간이 원본보다 약하다.
- 상단 `관리` 타이틀, 상태바, 본문 제목 간 위계도 원본보다 흐리다.

### 2. 컴포넌트 타입 해석이 여전히 부정확함

- 쿠폰 행은 원본에서 `outlined row/card`에 가깝다.
- 구현본은 여전히 연한 filled pill/card처럼 보인다.
- 하단 버튼 2개도 원본은 흰 배경 + 얇은 stroke 버튼인데, 구현본은 회색 filled 버튼처럼 보인다.
- 즉, "이건 버튼이다", "이건 행이다"까지는 어느 정도 인식하지만, `outlined`, `filled`, `bordered`, `plain` 같은 시각 타입까지 정확히 잡지 못하고 있다.

### 3. 토글 구현이 잘못됨

- 원본 토글은 우측에 붙은 green track + white knob + `ON` 텍스트 구조다.
- 구현본에서는 토글이 흐리고, 일부가 잘리거나 `ON`만 희미하게 남은 것처럼 보인다.
- 토글은 단순 텍스트나 칩이 아니라 별도 `toggle_on` 컴포넌트로 분석되어야 한다.

### 4. 아이콘 해석이 잘못됨

- 원본 쿠폰 아이콘은 초록색 작은 쿠폰/뱃지 형태에 가깝다.
- 구현본은 카메라 아이콘처럼 보여 의미가 달라졌다.
- 뒤로가기, 연필, chevron, 하단 툴바 아이콘도 텍스트 fallback 수준이라 원본 의미와 형태가 약하다.
- 아이콘은 단순 장식이 아니라 `semantic icon role`로 분리해야 한다.

### 5. reference layer와 구현 layer가 섞여 보임

- 구현 화면이 전체적으로 흐릿하고 원본 이미지가 뒤에 깔린 듯하다.
- 비교용 reference는 별도 위치 또는 낮은 opacity로 두어야 한다.
- 최종 구현 화면의 시각 품질 판단에 reference layer가 방해되지 않게 해야 한다.

### 6. 섹션 구분과 배경 band 해석이 약함

- 원본에는 쿠폰 행 아래에 명확한 연회색 separator band가 있다.
- 구현본은 이 구분이 약하거나 흐릿해서 화면의 섹션 구조가 덜 읽힌다.
- `section_separator`를 명시적인 role로 분석해야 한다.

### 7. 전체 화면 크기와 안전영역이 다름

- 구현 프레임은 `404 x 872`로 보이고, 원본 모바일 프레임과 비율 및 내부 여백이 다르다.
- status bar, browser toolbar, home indicator까지 포함한 캔버스 규격을 먼저 고정해야 한다.
- 원본이 웹뷰/브라우저 chrome을 포함한 모바일 화면인지, 순수 앱 화면인지도 분석 단계에서 분리해야 한다.

## 분석 단계에서 개선해야 할 점

현재 분석 결과가 단순히 `role`, `label`, `bbox` 정도라면 부족하다. 각 요소에 대해 다음 정보가 함께 나와야 한다.

```json
{
  "role": "outlined_button",
  "label": "내 자산 연결 해제",
  "bbox": {
    "x": 24,
    "y": 520,
    "width": 342,
    "height": 44
  },
  "visualStyle": {
    "fill": "#FFFFFF",
    "stroke": "#E5E5E5",
    "radius": 6,
    "textAlign": "center"
  },
  "implementation": {
    "helper": "button",
    "layout": "none",
    "children": ["text"]
  }
}
```

즉, 분석 단계에서 바로 **이 요소를 Figma에서 어떤 helper/노드 조합으로 만들지**까지 결정해야 한다.

## 구현 방식에서 개선해야 할 점

### 1. role을 더 세분화

현재처럼 `button`, `row`, `chip` 수준으로는 부족하다. 다음처럼 구현 가능한 단위로 나눠야 한다.

- `outlined_button`
- `filled_button`
- `plain_row`
- `coupon_row`
- `toggle_on`
- `toggle_off`
- `section_separator`
- `browser_toolbar`
- `info_table`
- `info_label`
- `info_value`
- `header_nav`
- `system_status_bar`

### 2. role별 생성 규칙 고정

| Role | 생성 규칙 |
| --- | --- |
| `outlined_button` | white fill, light stroke, centered text, radius 4~8 |
| `filled_button` | filled background, no stroke unless observed |
| `coupon_row` | white fill, stroke, left icon, label, right chevron |
| `toggle_on` | green track, white knob, optional ON text, right aligned |
| `section_separator` | full-width light gray band |
| `info_table` | compact 2-column label/value rows |
| `browser_toolbar` | fixed bottom toolbar with icon buttons |

### 3. 분석 결과에 styleIntent 추가

각 요소에 `styleIntent`를 추가해 구현 의도를 명시해야 한다.

예시:

- `outlined`
- `filled`
- `text_only`
- `separator`
- `interactive_control`
- `icon_button`
- `data_pair`

### 4. 생성 후 validator에서 role별 검사

생성된 tree를 다시 검사해서 다음을 확인해야 한다.

- label 줄바꿈 여부
- bbox 위치/크기 차이
- role별 fill/stroke/radius 일치
- 토글/버튼/행의 자식 구조 일치
- 아이콘 role과 실제 아이콘 형태 일치
- reference layer와 구현 layer 혼동 여부
- 앱 화면과 브라우저 chrome 영역 분리 여부

### 5. 실패 시 자동 보정

일부 문제는 Codex 재시도보다 deterministic 보정이 더 적합하다.

예:

- `outlined_button`인데 fill이 `#F3F4F7`이면 white fill + stroke로 수정
- text width가 좁아 줄바꿈 위험이면 bbox width로 확장
- `toggle_on`이 chip/text로 생성되면 track/knob 구조로 재작성
- `coupon_row`가 단일 text/card로 생성되면 icon + label + chevron 구조로 재작성
- `section_separator`가 누락되면 bbox 기준 full-width band 추가

## 우선 개선 순서

1. 분석 schema에 `visualStyle`, `implementation`, `styleIntent` 추가
2. role taxonomy를 `button` 수준에서 `outlined_button`, `coupon_row`, `toggle_on` 수준으로 세분화
3. role별 Figma node 생성 규칙 추가
4. 생성 후 validator에서 role별 스타일, 구조, bbox 검사
5. 실패 항목은 Codex 재시도뿐 아니라 deterministic 보정도 일부 적용

## 결론

현재는 요소 인식과 텍스트 커버리지는 조금씩 나아지고 있다. 하지만 원본 화면을 충실히 구현하려면 분석 결과가 단순 요소 목록이 아니라 **Figma 구현 설계서**에 가까워져야 한다.

다음 단계의 핵심은 다음 두 가지다.

1. 분석 단계에서 **무엇을 만들지**뿐 아니라 **어떻게 만들지**까지 구조화한다.
2. 생성 후 validator에서 role별 구현 품질을 검사하고, 일부 명확한 문제는 deterministic 보정으로 바로 고친다.
