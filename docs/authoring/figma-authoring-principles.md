# Xbridge Figma Authoring Principles

## Purpose

이 문서는 Xbridge가 Figma 화면을 생성하거나 수정할 때 따라야 하는 기본 원칙을 정의한다.

목표는 아래와 같다.

- 화면을 "보이게만" 만드는 것이 아니라 나중에 수정 가능한 구조로 만든다.
- 코드 기반 레이아웃을 Figma에 옮길 때 오토레이아웃 중심 구조를 우선한다.
- primitive 조합보다 authoring quality를 우선하는 기준을 팀 안에서 일관되게 맞춘다.

## Core Direction

Xbridge는 앞으로 **absolute placement first**가 아니라 **auto-layout first** authoring을 기본 방향으로 삼는다.

즉:

- row/column 구조는 먼저 오토레이아웃으로 만든다.
- 카드, 리스트, 섹션, 폼, 바텀시트, 헤더 같은 UI 블록은 수정 가능한 container hierarchy로 만든다.
- `x`, `y`, `width`, `height`는 최후의 수단으로만 사용한다.
- absolute positioning은 장식 요소나 예외 레이어에 제한한다.

## Primary Principles

### 1. Structure Over Screenshot

Xbridge는 캡처를 닮은 화면보다 **수정 가능한 Figma 구조**를 우선한다.

좋은 생성 결과의 기준:

- 오토레이아웃 컨테이너가 명확하다.
- padding, gap, align이 컨테이너 속성으로 표현된다.
- 텍스트 길이나 항목 수가 바뀌어도 쉽게 유지보수할 수 있다.
- 반복 요소는 컴포넌트 또는 재사용 가능한 row/card 패턴으로 승격 가능하다.

### 2. Flex Maps To Auto Layout

코드에서 `display: flex`로 표현된 구조는 Figma에서 기본적으로 오토레이아웃으로 해석한다.

기본 매핑:

- `display: flex` -> auto layout
- `flex-direction: row` -> horizontal auto layout
- `flex-direction: column` -> vertical auto layout
- `gap` -> item spacing
- `padding` -> frame padding
- `align-items` -> counter axis alignment
- `justify-content` -> primary axis alignment or spacing mode

단, 브라우저의 wrapper를 그대로 복제하지 말고 Figma에서 의미 있는 container만 남긴다.

### 3. Absolute Is An Exception

다음과 같은 경우에만 absolute를 허용한다.

- 배경 장식
- 상태바 아이콘처럼 독립 위치가 필요한 작은 요소
- 겹침이 중요한 badge or floating affordance
- scroll capture를 모사하기 위한 예외 레이어

absolute를 사용할 때도:

- 부모 구조는 여전히 오토레이아웃 컨테이너여야 한다.
- absolute child를 위해 전체 화면을 absolute로 풀지 않는다.

### 4. Tokens Before Hardcoded Styling

가능하면 색상, spacing, radius, typography는 design system 토큰이나 명시적 style binding으로 만든다.

최소 기준:

- spacing은 의미 있는 scale로 반복 사용
- text style은 역할별로 일관성 유지
- 동일한 카드/행 패턴은 같은 radius, padding, gap 규칙 사용

### 5. Editability Is A Requirement

생성 결과는 사람이 Figma에서 바로 수정할 수 있어야 한다.

실무 기준 질문:

- 텍스트가 길어지면 구조가 유지되는가?
- 리스트 항목을 하나 더 복제해도 자연스러운가?
- 카드 padding을 한 곳에서 수정하기 쉬운가?
- 컴포넌트로 승격하기 좋은 구조인가?

이 질문에 "아니오"가 많다면 품질이 낮은 생성이다.

## Preferred Container Patterns

### Screen Frame

- 최상위 기기 프레임
- 보통 vertical auto layout 또는 명시적 section stack
- 배경색, page padding, safe-area 역할 분리

### Header Block

- row auto layout
- title 영역과 trailing actions 분리
- 아이콘/버튼은 hug contents 우선

### Section Block

- vertical auto layout
- section title, body, actions를 child로 관리
- 섹션 간 간격은 컨테이너 spacing으로 처리

### List Item

- row 또는 column auto layout
- leading visual / content stack / trailing metadata를 구조화
- 제목, 보조 텍스트, 액션을 absolute 없이 배치

### Card

- 내부 padding을 가진 frame
- 자식 간 gap 관리
- 상태에 따른 fill, stroke, radius만 변경 가능하도록 유지

## Anti-Patterns

아래는 피해야 한다.

- 화면 전체를 좌표 기반 primitive로만 쌓기
- gap 대신 각 자식에 개별 margin처럼 간격 넣기
- 같은 종류의 행인데 하나하나 수동으로 위치 배치하기
- wrapper가 필요 없는데 frame을 과도하게 중첩하기
- absolute child 때문에 상위 구조 전체를 absolute로 만드는 것

## Quality Bar

Xbridge로 생성한 화면은 최소한 아래를 만족해야 한다.

- 주요 UI 블록이 auto layout container다.
- 텍스트 변경에 기본 구조가 무너지지 않는다.
- spacing/padding이 node property로 설명 가능하다.
- 사람이 이어서 손으로 편집하기 쉽다.

## Practical Rule

한 줄 기준:

> "코드의 flex 구조를 읽고, Figma에서 편집 가능한 auto layout 구조로 다시 짠다."

