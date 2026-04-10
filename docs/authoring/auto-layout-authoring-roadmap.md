# Auto Layout First Authoring Roadmap

## Goal

Xbridge를 primitive placement 중심 브리지에서, **오토레이아웃 우선의 범용 Figma authoring 인터페이스**로 고도화한다.

장기적으로는 공식 `use_figma`처럼 한 번에 정교한 캔버스를 다룰 수 있는 방향을 목표로 한다.

## Problem Summary

현재 브리지는 아래 강점이 있다.

- 선택된 mutation을 안전하게 수행하는 세분화된 명령
- 로컬 플러그인 세션 기반의 안정적 write workflow
- create/update/delete/component/property 계열의 명시적 도구

하지만 아래 한계가 있다.

- 화면 전체를 구조적으로 생성하기엔 명령이 너무 primitive 중심
- row/column/card/section 같은 상위 레이아웃 추상화가 약함
- 결과물이 absolute placement로 흐르기 쉬움
- 코드의 flex 구조를 Figma auto layout 구조로 번역하는 계층이 없음

## Desired End State

최종적으로는 아래를 지향한다.

- 코드 또는 구조 입력을 받으면 auto layout 중심의 Figma tree 생성
- 반복 패턴을 section/list/card/header 같은 higher-level builder로 처리
- absolute placement는 예외 케이스로만 사용
- design tokens / shared styles / variables를 자연스럽게 연결
- 한 요청 안에서 구조 생성, 스타일 적용, 텍스트 배치, 컴포넌트 승격까지 이어지는 authoring flow 제공

## Workstreams

### 1. Authoring Rules And Contracts

먼저 기준 문서를 고정한다.

- Figma authoring principles
- auto layout required checklist
- code-to-figma layout mapping rules

이 단계의 산출물:

- 팀 기준 문서
- builder acceptance criteria
- 리뷰 기준

### 2. Layout Primitives Upgrade

현재 `create_node` / `update_node`만으로 직접 레이아웃을 짜는 부담을 줄인다.

추가 대상:

- row builder
- column builder
- stack builder
- card builder
- section builder
- screen frame preset

각 builder는 아래를 우선 지원한다.

- `layoutMode`
- padding
- itemSpacing
- sizing mode
- alignment
- fill / radius / stroke

### 3. Code-To-Figma Mapping Layer

코드 구조를 Figma 구조로 번역하는 계층이 필요하다.

최소 목표:

- flex container -> auto layout frame
- text block -> text nodes with semantic grouping
- repeated item tree -> duplicated list item frames

입력 후보:

- JSON layout recipe
- design token aware screen recipe
- DOM-like intermediate schema

### 4. Higher-Level Screen Builder

특정 mock builder를 넘어서 범용 screen builder로 확장한다.

예시:

- `build_screen`
- `build_section`
- `build_list`
- `build_form`

핵심은 preset이 아니라 **schema-driven authoring**이다.

### 5. Design System Binding

구조 생성 후 design system 연결을 강화한다.

- text style mapping
- color/style token binding
- component import and instance placement
- spacing/radius semantic presets

### 6. Verification Loop

생성 품질을 빠르게 검증할 수 있어야 한다.

- auto layout usage rate
- absolute node ratio
- text overflow or wrapping issues
- repeated pattern consistency

## Proposed Phases

### Phase 1. Rules First

범위:

- principles 문서
- checklist 문서
- basic layout mapping note

완료 조건:

- future screen work에 공통 기준이 생긴다.

### Phase 2. Builder Foundations

범위:

- row/column/section/card helper plan
- 기존 `create_node` 위에서 조합 가능한 helper 설계
- HTTP/MCP tool shape draft

완료 조건:

- absolute coordinates 없이 주요 블록을 생성하는 경로가 생긴다.

### Phase 3. Schema-Driven Screen Authoring

범위:

- screen recipe schema
- builder orchestration
- repeated list/card generation

완료 조건:

- mockup 하나를 schema 하나로 생성 가능

### Phase 4. Code Ingestion

범위:

- flex-like input schema
- DOM / JSX / serialized tree 해석 전략
- auto layout translation rules

완료 조건:

- 코드 구조에서 Figma auto layout tree를 만들 수 있다.

### Phase 5. `use_figma`-like General Interface

범위:

- 범용 authoring payload
- batch operation model
- richer error reporting
- reusable action planner

완료 조건:

- 복잡한 화면 authoring을 한 번의 상위 호출로 처리하는 기반 확보

## Suggested Near-Term Tasks

우선순위는 아래가 좋다.

1. authoring principles 문서 확정
2. auto layout required checklist 확정
3. code-to-figma mapping 표 초안 작성
4. `row`, `column`, `section`, `card` helper schema 설계
5. 작은 파일럿 화면 하나를 auto layout only로 재생성

## Pilot Recommendation

처음 파일럿은 아래 성격의 화면이 좋다.

- header + content stack
- list items 반복
- card 2~3종
- input or comment block 포함

즉, absolute 아이콘 예외는 있더라도 주요 구조는 모두 auto layout로 풀 수 있는 모바일 screen이 적합하다.

## Success Metrics

아래가 개선되면 방향이 맞다.

- 생성된 화면의 auto layout container 수 증가
- 수동 absolute placement 비율 감소
- Figma에서 후속 수정 시간 감소
- 카드/리스트/섹션 재사용성 향상
- code-to-figma fidelity 향상

## One-Line Direction

> Xbridge는 primitive를 찍는 도구에서, auto-layout 구조를 설계하는 authoring system으로 진화해야 한다.

