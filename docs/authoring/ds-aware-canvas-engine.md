# DS-Aware Canvas Engine

## Why This Layer Exists

현재 Xbridge는 아래를 잘한다.

- 열린 Figma 파일에 안전하게 쓰기
- 페이지/노드/selection 기반 탐색
- `build_layout`와 helper를 통한 오토레이아웃 생성
- 라이브러리 검색과 컴포넌트 import

하지만 아직 부족한 것은 `무엇을 만들어야 하는지 아는 계층`이다.

즉 지금 Xbridge는 `hands`는 있지만 `design-system-aware brain`은 약하다.

이 문서는 Xbridge 위에 `DS-aware Canvas Engine`을 올리기 위한 기준을 정의한다.

## Target Outcome

사용자는 아래처럼 요청할 수 있어야 한다.

- “이 대시보드를 우리 디자인 시스템으로 다시 만들어줘”
- “이 프로토타입을 현재 컴포넌트 라이브러리로 재구성해줘”
- “검색 결과 화면을 DS 규칙에 맞게 조립해줘”

그리고 시스템은 아래를 수행해야 한다.

1. 화면을 섹션 단위로 해석
2. 각 섹션에 맞는 DS 패턴을 선택
3. 실제 component key / variant / token binding을 결정
4. Xbridge helper 또는 low-level write command로 캔버스에 생성
5. 결과가 library-backed / auto-layout-first / token-aware 인지 검증

## Architecture

구조는 세 계층으로 나눈다.

### 1. Xbridge Core

기존 브리지 계층이다.

책임:
- 플러그인 세션 관리
- 페이지/노드 읽기
- 노드 생성/업데이트/삭제
- helper 실행
- 라이브러리 검색 및 import

대표 모듈:
- `src/server.js`
- `src/build-layout.js`
- `src/design-system-search.js`
- `src/import-library-component.js`
- `src/find-or-import-component.js`

### 2. DS Knowledge Layer

디자인 시스템 지식을 구조화한 계층이다.

책임:
- component family registry
- variant axis 정의
- semantic token mapping
- layout pattern 정의
- composition 규칙 정의

예시:
- `toolbar/search`
- `sidebar/nav-group`
- `data-table/task-board`
- `badge/status`
- `avatar/stack`

이 계층은 아래 질문에 답해야 한다.

- 어떤 component key를 써야 하는가
- 어떤 variant가 맞는가
- 어떤 텍스트 스타일과 spacing token을 써야 하는가
- exact swap이 가능한가
- compose-from-primitives가 필요한가

### 3. Canvas Composer

입력을 실제 캔버스 조립 계획으로 변환하는 계층이다.

입력 예:
- text prompt
- image / screenshot
- URL / code structure
- existing Figma frame

책임:
- screen decomposition
- pattern resolution
- DS component mapping
- helper plan generation
- validation orchestration

즉 `Canvas Composer`는 아래를 수행한다.

`intent -> section tree -> DS mapping -> Xbridge plan -> Figma canvas`

## Core Objects

### Pattern

화면에서 반복되는 역할 단위다.

예:
- `toolbar`
- `filter-bar`
- `sidebar-nav`
- `data-table`
- `metric-card`
- `status-chip`
- `search-result-row`

### Registry Entry

Pattern을 실제 디자인 시스템 컴포넌트에 매핑한 정의다.

필수 필드 예:
- `patternId`
- `componentKey` 또는 `componentSetKey`
- `variantAxes`
- `defaultVariant`
- `textBindings`
- `tokenBindings`
- `layoutPolicy`
- `composeStrategy`

### Screen Schema

Composer가 만드는 중간 표현이다.

예:
- `screen`
- `sections`
- `patterns`
- `content`
- `constraints`
- `density`
- `theme`

## Resolution Strategy

각 섹션은 반드시 아래 중 하나로 분류한다.

- `exact-swap`
- `compose-from-primitives`
- `fallback-helper`
- `blocked`

### exact-swap

디자인 시스템에 이미 대응되는 복합 컴포넌트가 있다.

예:
- status chip
- tab bar
- search input

### compose-from-primitives

복합 컴포넌트는 없지만 primitives 조합으로 안정적으로 만들 수 있다.

예:
- dashboard header
- filter toolbar
- side navigation group

### fallback-helper

DS 연결은 약하지만, Xbridge helper로 구조를 먼저 만든다.

예:
- 아직 registry가 없는 bespoke section

### blocked

아래 중 하나다.

- 적절한 component key를 찾지 못함
- import 실패
- variant가 충분하지 않음
- 규칙이 불명확함

## Validation Rules

Composer는 “그럴듯한 화면”만 만들면 안 된다.

아래를 검증해야 한다.

### Structure
- auto-layout-first
- section hierarchy 명확
- absolute positioning 최소화

### DS Connection
- library instance 여부
- local wrapper 남용 여부
- component key / variant가 registry와 일치하는지

### Tokens
- spacing/color/typography의 semantic binding 여부
- literal pixel값 남용 여부

### Readability
- section rhythm
- information density
- repeated pattern consistency

## Example Flow

입력:
- “CRM dashboard를 현재 라이브러리로 만들어줘”

흐름:
1. `Canvas Composer`가 `sidebar + toolbar + tabs + data-table + data-table` 구조로 분해
2. `DS Knowledge Layer`가 각 section에 대해 component/variant/token 추천
3. `build_layout` 또는 전용 preset helper로 screen plan 생성
4. 필요 시 `import_library_component`로 instance 확보
5. Xbridge Core가 실제 캔버스 생성
6. validation pass 실행

## Non-Goals

초기 단계에서 아래는 목표가 아니다.

- generic design AI 전부 대체
- pixel-perfect screenshot replication
- 모든 UI를 이미지 기반으로 100% 자동 해석

첫 목표는 `DS-aware reconstruction`이다.

즉 “예쁘게 따라 그리기”보다
“우리 시스템 규칙으로 안정적으로 다시 만들기”가 우선이다.

## Immediate Next Step

먼저 필요한 것은 registry다.

1. pattern taxonomy 정의
2. component key / variant registry 정의
3. `toolbar`, `sidebar-nav`, `data-table`, `status-chip`, `avatar-stack`부터 연결

그다음 `dashboard-board` 같은 preset을 registry-aware builder로 바꾸는 것이 맞다.
