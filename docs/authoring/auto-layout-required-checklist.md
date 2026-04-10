# Auto Layout Required Checklist

## Purpose

이 체크리스트는 Xbridge가 생성하려는 Figma 결과물이 "무조건 오토레이아웃으로 만들어야 하는 영역"을 빠르게 점검하기 위한 문서다.

## Must Use Auto Layout

아래 요소는 기본적으로 absolute가 아니라 오토레이아웃으로 만들어야 한다.

### Screen-Level Containers

- 전체 screen body
- safe-area 내부 main content stack
- 바텀시트 본문 영역
- 모달 내부 content 영역
- form page의 section stack

### Navigation And Header

- 상단 헤더
- 툴바
- 탭 바
- segmented control
- breadcrumb row
- search bar 내부 content row

### Repeating Content

- 리스트 컨테이너
- 리스트 item
- 카드 그리드의 각 카드
- 댓글 row
- 메뉴 row
- settings row
- activity feed item

### Content Blocks

- title + description stack
- metric card
- CTA group
- tag/chip row
- badge + label row
- empty state content stack
- keyword or metadata cluster

### Input And Form

- input wrapper
- textarea wrapper
- label + helper text stack
- field group
- button row
- keyboard accessory row

## Allowed Absolute Exceptions

아래는 absolute 허용 가능 영역이다.

- 상태바 아이콘의 세밀한 위치 맞춤
- 장식용 배경 shape
- overlay badge
- drag handle 같은 독립 affordance
- clipping mask나 screenshot recreation용 예외 레이어

단, 예외 요소가 있어도 상위 컨테이너는 오토레이아웃이어야 한다.

## Review Questions

생성 전 또는 생성 후 아래를 확인한다.

- 이 블록은 항목 수가 늘어나면 자연스럽게 확장되는가?
- 이 텍스트가 두 줄이 되면 구조가 유지되는가?
- 이 간격은 child 좌표가 아니라 container spacing으로 표현됐는가?
- 이 패딩은 frame padding으로 설명 가능한가?
- 이 구조는 이후 component로 승격 가능한가?

위 질문 중 하나라도 아니오라면 오토레이아웃 전환을 먼저 검토한다.

## Conversion Hints

코드 구조에서 아래 패턴을 보면 오토레이아웃으로 변환한다.

- `display: flex`
- `flex-direction`
- `gap`
- `padding`
- `align-items`
- `justify-content`
- 반복되는 row or column wrapper

## Red Flags

아래는 품질 경고 신호다.

- 텍스트 node마다 좌표를 수동 지정함
- 리스트를 item별 absolute 배치로 생성함
- 카드 내부 제목/본문/메타를 각각 독립 배치함
- row가 많은데 `itemSpacing`이 아니라 `x`, `y` 차이로 간격을 맞춤
- 바텀시트/모달을 내부 absolute children만으로 구성함

## Working Rule

한 줄 기준:

> 반복되거나 정렬되는 UI는 먼저 오토레이아웃으로 만들고, absolute는 예외로만 허용한다.

