# Code To Figma Layout Mapping

## Purpose

이 문서는 코드 레이아웃 구조를 Figma auto layout 구조로 변환할 때의 기본 매핑 규칙을 정의한다.

대상은 주로 아래와 같다.

- HTML/CSS 기반 UI
- React/JSX tree
- flex 중심 레이아웃
- screen builder용 intermediate schema

핵심 목표는 "코드를 그대로 복사"하는 것이 아니라, **코드 구조를 Figma에서 수정 가능한 구조로 재해석**하는 것이다.

## Main Rule

한 줄 기준:

> 브라우저 box tree를 그대로 옮기지 말고, 의미 있는 flex structure를 Figma frame hierarchy로 정리한다.

## Core Mapping Table

| Code Concept | Figma Concept | Notes |
| --- | --- | --- |
| `display: flex` | auto layout frame | 기본 변환 대상 |
| `flex-direction: row` | horizontal auto layout | row container |
| `flex-direction: column` | vertical auto layout | stack container |
| `gap` | item spacing | child margin으로 풀지 않음 |
| `padding` | frame padding | 각 자식 위치 계산으로 대체하지 않음 |
| `align-items` | counter axis alignment | `MIN`, `CENTER`, `MAX`, `BASELINE` 후보 |
| `justify-content: flex-start` | primary axis align start | 기본 정렬 |
| `justify-content: center` | primary axis align center | 가운데 정렬 |
| `justify-content: space-between` | spacing mode or fill + aligned children | 폭 제약과 함께 해석 필요 |
| fixed width/height | fixed sizing | frame 또는 node에 고정값 적용 |
| flexible child | fill container | Figma `FILL` 대응 |
| intrinsic child | hug contents | Figma `HUG` 대응 |
| repeated list item | duplicated item frame | component candidate |
| wrapper `div` | frame only if meaningful | 의미 없는 wrapper는 제거 |
| `position: absolute` | absolute positioned child | 예외적으로만 허용 |
| `overflow: hidden` | clip content | frame clip content 대응 |
| `border-radius` | corner radius | token or style 우선 |

## Flex Conversion Rules

### Row Container

다음 패턴이면 row auto layout으로 변환한다.

- `display: flex`
- `flex-direction: row`
- 자식이 좌우로 정렬됨
- `gap` 또는 좌우 정렬이 명시됨

예:

```css
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
}
```

Figma 해석:

- horizontal auto layout frame
- padding: top/right/bottom/left
- child 정렬: center
- trailing action이 있으면 title과 action group을 분리

### Column Container

다음 패턴이면 vertical auto layout으로 변환한다.

- `display: flex`
- `flex-direction: column`
- 자식이 위아래로 쌓임
- section, list, form stack 성격

예:

```css
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
}
```

Figma 해석:

- vertical auto layout frame
- item spacing: 16
- padding: 20
- card 또는 section wrapper 후보

## Size Mapping

### Hug / Fill / Fixed

코드에서 다음과 같이 해석한다.

- content 크기에 따라 자연스럽게 줄어드는 child -> `HUG`
- 남는 공간을 채우는 child -> `FILL`
- 명시 width/height가 강한 child -> `FIXED`

실무 규칙:

- 버튼, 칩, 아이콘 버튼: 대개 `HUG`
- 본문 column, 내용 영역, input field: 자주 `FILL`
- 기기 프레임, 썸네일 박스, hero image: 자주 `FIXED`

### Min / Max

웹의 `min-width`, `max-width`, `min-height`, `max-height`는 Figma에서 완전 동일하게 대응되진 않을 수 있다.

우선순위:

1. `HUG` 또는 `FILL`로 자연스럽게 해결
2. 꼭 필요한 경우 fixed size 보정
3. 반응형 특성이 중요하면 별도 constraint 설계

## Spacing Rules

간격은 child 좌표 차이로 표현하지 않는다.

우선순위:

1. container padding
2. item spacing
3. nested stack 분리

피해야 할 방식:

- 텍스트마다 `x`, `y` 차이로 간격만 맞추는 것
- row마다 개별 absolute placement

## Wrapper Reduction Rules

웹 코드에는 불필요한 wrapper가 많을 수 있다. Figma로 옮길 때는 아래 기준으로 정리한다.

남겨야 하는 wrapper:

- padding 역할이 있는 container
- background/stroke/radius 역할이 있는 container
- row/column 정렬 책임이 있는 container
- clipping or overlay 기준이 되는 container

제거 가능한 wrapper:

- 스타일도 없고 레이아웃 역할도 없는 wrapper
- React fragment 대체 수준의 감싸기
- DOM 편의상만 존재하는 중첩 `div`

## Text Mapping

텍스트는 단순 문자열이 아니라 역할 단위로 묶는다.

예:

- title
- subtitle
- helper
- body
- meta
- trailing count

텍스트 row 또는 stack은 아래 기준으로 묶는다.

- 제목 + 설명 -> vertical stack
- 제목 + 우측 메타 -> row with nested content stack
- 여러 문단 -> body text block with width constraint

## Absolute And Overlay Rules

absolute는 예외 레이어에만 사용한다.

허용 예:

- notification badge
- floating action indicator
- status bar icon micro-placement
- screenshot-like background decoration

금지 예:

- 전체 list를 absolute row들의 모음으로 만드는 것
- header title, subtitle, actions를 각각 absolute로 놓는 것

## Repeating Pattern Conversion

리스트/카드/메뉴 행 같은 반복 구조는 아래 순서로 해석한다.

1. item template를 하나 정의
2. item 내부를 row/column으로 구조화
3. list container를 vertical auto layout으로 생성
4. 필요 시 item을 component 후보로 승격

## Screen Interpretation Flow

권장 해석 순서:

1. screen frame
2. safe content area
3. top-level section stack
4. section 내부 card/list/form block
5. item-level row/column
6. absolute 예외 요소

## Red Flags

다음이 보이면 mapping 품질이 낮다.

- 화면 대부분이 `x`, `y` 기반으로만 배치됨
- gap/padding이 아닌 좌표 차이로 구조가 만들어짐
- 반복되는 item이 전부 수동 배치됨
- title/body/meta 관계가 frame 구조로 설명되지 않음

## Practical Output Shape

최종적으로는 아래 같은 intermediate shape를 목표로 한다.

```json
{
  "type": "frame",
  "layout": "column",
  "padding": 20,
  "gap": 16,
  "children": [
    {
      "type": "frame",
      "layout": "row",
      "justify": "space-between",
      "children": [
        { "type": "text", "role": "title", "value": "새로운 문장" },
        { "type": "frame", "layout": "row", "gap": 12, "children": [] }
      ]
    }
  ]
}
```

핵심은 DOM이 아니라 **authoring-friendly recipe**를 만드는 것이다.

