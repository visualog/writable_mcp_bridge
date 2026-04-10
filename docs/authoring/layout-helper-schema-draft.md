# Layout Helper Schema Draft

## Purpose

이 문서는 Xbridge가 primitive 호출 위에 올릴 상위 helper/builder의 초안 스키마를 정의한다.

목표는 아래와 같다.

- row/column/section/card 같은 반복 구조를 더 적은 명령으로 만들기
- absolute placement 대신 semantic layout input을 받기
- 향후 `build_screen` 계열 범용 인터페이스의 기반을 마련하기

## Design Goal

helper는 Figma plugin API 전체를 노출하는 것이 아니라, **오토레이아웃 중심 authoring intent**를 받는 얇은 구조여야 한다.

즉 사용자는

- 위치 좌표 나열
- 자식마다 width/height 수동 지정

보다

- row를 만들고
- 내부 spacing/padding/alignment를 지정하고
- 텍스트와 카드와 행을 child로 넣는 방식

으로 요청해야 한다.

## Shared Concepts

모든 helper가 공통으로 받는 필드는 아래를 기준으로 한다.

### Common Fields

- `pluginId`
- `parentId`
- `name`
- `layout`
- `widthMode`
- `heightMode`
- `width`
- `height`
- `padding`
- `gap`
- `align`
- `justify`
- `fill`
- `stroke`
- `radius`
- `children`

### Size Modes

지원 후보:

- `hug`
- `fill`
- `fixed`

### Layout Modes

지원 후보:

- `row`
- `column`
- `stack`

`stack`은 겹침이 필요한 고급 케이스용 예외로 두고, 대부분은 row/column을 우선한다.

## 1. Row Helper

### Intent

가로 오토레이아웃 컨테이너 생성.

### Example

```json
{
  "pluginId": "page:33023:62",
  "parentId": "33023:62",
  "helper": "row",
  "name": "header-actions",
  "gap": 12,
  "padding": { "x": 20, "y": 16 },
  "align": "center",
  "justify": "space-between",
  "widthMode": "fill",
  "children": [
    { "helper": "text", "role": "title", "characters": "새로운 문장" },
    {
      "helper": "row",
      "name": "trailing-actions",
      "gap": 12,
      "children": [
        { "helper": "text", "role": "meta", "characters": "취소" },
        { "helper": "text", "role": "meta-strong", "characters": "완료" }
      ]
    }
  ]
}
```

### Mapping

- `helper: row` -> `layoutMode: HORIZONTAL`
- `gap` -> `itemSpacing`
- `align` -> `counterAxisAlignItems`
- `justify` -> `primaryAxisAlignItems` or spacing interpretation

## 2. Column Helper

### Intent

세로 오토레이아웃 컨테이너 생성.

### Example

```json
{
  "helper": "column",
  "name": "screen-content",
  "gap": 20,
  "padding": { "top": 24, "right": 20, "bottom": 32, "left": 20 },
  "widthMode": "fill",
  "children": []
}
```

### Typical Use

- page content
- section stack
- form stack
- list container
- card body

## 3. Card Helper

### Intent

padding, radius, fill이 이미 구조화된 card container 생성.

### Example

```json
{
  "helper": "card",
  "name": "comment-card",
  "gap": 14,
  "padding": 16,
  "radius": 18,
  "fill": "#F5F6FA",
  "widthMode": "fill",
  "children": [
    { "helper": "text", "role": "body", "characters": "문장에 대한 생각이나 의견을 적어보세요." }
  ]
}
```

### Notes

- 기본 layout은 `column`
- card variant를 나중에 semantic preset으로 확장 가능

## 4. Section Helper

### Intent

section title, body, optional actions를 가진 상위 블록 생성.

### Example

```json
{
  "helper": "section",
  "name": "recent-books-section",
  "title": "최근 읽은 문장의 책",
  "gap": 16,
  "children": [
    { "helper": "list", "name": "recent-books-list", "children": [] }
  ]
}
```

### Notes

- 내부적으로 title text + body wrapper를 조합 가능
- heading style preset과 연동 가능

## 5. Text Helper

### Intent

semantic role 기반 text node 생성.

### Example

```json
{
  "helper": "text",
  "role": "screen-title",
  "characters": "새로운 문장",
  "widthMode": "hug"
}
```

### Role Candidates

- `screen-title`
- `section-title`
- `card-title`
- `body`
- `body-muted`
- `meta`
- `meta-strong`

## 6. List Helper

### Intent

반복 item stack을 쉽게 생성.

### Example

```json
{
  "helper": "list",
  "name": "book-list",
  "gap": 18,
  "itemHelper": "row",
  "children": []
}
```

### Future Expansion

- `items` 데이터 기반 반복
- `itemTemplate` 지원
- component instance 기반 반복 생성

## 7. Screen Helper

### Intent

device frame + safe area + content stack을 한번에 생성.

### Example

```json
{
  "helper": "screen",
  "preset": "iphone-17-pro",
  "name": "new-sentence-screen",
  "background": "#FFFFFF",
  "content": {
    "helper": "column",
    "gap": 20,
    "padding": { "top": 24, "right": 20, "bottom": 32, "left": 20 },
    "children": []
  }
}
```

## Semantic Presets

중장기적으로는 아래 preset layer를 붙일 수 있다.

- `preset: screen/mobile/default`
- `preset: card/soft`
- `preset: section/default`
- `preset: row/list-item`
- `preset: text/screen-title`

즉 helper와 design system preset을 분리하는 방향이 좋다.

## Suggested API Shapes

초기 후보는 아래 두 가지다.

### Option A. Dedicated Endpoints

- `/api/create-row`
- `/api/create-column`
- `/api/create-card`
- `/api/create-section`
- `/api/build-screen`

장점:

- 단순함
- 디버깅 쉬움

단점:

- 엔드포인트 수가 많아짐

### Option B. Generic Layout Builder

- `/api/build-layout`

payload 안에 `helper` 타입을 중첩.

장점:

- 확장성 좋음
- schema-driven authoring에 적합

단점:

- planner와 validator가 필요

## Recommendation

초기에는 Option B가 더 적합하다.

이유:

- `row`, `column`, `card`, `section`, `screen`을 하나의 tree로 표현 가능
- 향후 `use_figma`-like 상위 인터페이스로 확장 쉬움
- code-to-figma intermediate schema와 연결하기 좋음

## Minimal Near-Term Scope

가장 먼저 필요한 helper는 이 네 가지다.

1. `row`
2. `column`
3. `card`
4. `screen`

이 네 가지가 있으면 모바일 UI 화면 대부분의 구조를 absolute 없이 조립할 수 있다.

## One-Line Direction

> 좌표를 찍는 요청 대신, 구조를 선언하는 요청을 받도록 브리지 입력 형태를 바꾼다.

