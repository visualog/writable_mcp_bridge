# DS-Aware Canvas Roadmap

## Stage 1. Registry Foundation

목표:
- 디자인 시스템 지식을 코드가 읽을 수 있는 구조로 만든다.

작업:
- pattern taxonomy 정의
- component registry 스키마 정의
- variant axis 표현 정의
- token binding 표현 정의

우선 pattern:
- `toolbar`
- `sidebar-nav`
- `tabbar`
- `data-table`
- `status-chip`
- `avatar-stack`
- `progress-bar`

완료 기준:
- helper가 아니라 registry entry만 보고 어떤 component family를 쓸지 판단 가능

## Stage 2. Helper-Registry Binding

목표:
- 현재 helper를 DS-aware helper로 승격

작업:
- `toolbar` -> registry-aware
- `sidebar-nav` -> registry-aware
- `data-table` -> registry-aware
- `status-chip` -> registry-aware
- `avatar-stack` -> registry-aware

완료 기준:
- helper 호출 시 literal style보다 registry 기반 선택이 우선

## Stage 3. Section Composer

목표:
- 화면을 section tree로 분해하고 helper plan으로 변환

작업:
- `screen schema` 정의
- `section -> pattern` mapping 로직 추가
- `exact-swap / compose-from-primitives / fallback-helper / blocked` 판단 추가
- `composeSectionsFromIntents()` 같은 최소 조합기 추가

완료 기준:
- 프롬프트 또는 코드 구조를 받아 section별 실행 계획 생성 가능

## Stage 4. Reference Reconstruction

목표:
- 이미지/프로토타입/코드 기반 화면을 DS 방식으로 재구성

작업:
- reference decomposition 규칙
- layout intent 추출
- primitive 복제가 아니라 DS reconstruction 경로 추가

완료 기준:
- “이 화면을 우리 디자인 시스템으로 다시 만들어줘” 요청을 안정적으로 처리

## Stage 5. Validation Loop

목표:
- 결과가 실제로 DS-aware한지 검증

작업:
- library instance check
- token binding check
- local wrapper 감지
- auto-layout usage check

완료 기준:
- 결과 보고서에 `Swapped / Composed / Blocked`를 명확히 구분

## Stage 6. High-Level Presets

목표:
- 실무형 화면을 더 짧은 스키마로 만들기

후보 preset:
- `crm-dashboard`
- `project-board`
- `task-table-board`
- `settings-panel`
- `search-results-screen`

완료 기준:
- reference 화면 1개를 helper + registry 기반으로 재현 가능

## Recommended Build Order

1. registry schema
2. registry-backed `status-chip`
3. registry-backed `toolbar`
4. registry-backed `data-table`
5. `dashboard-board`를 registry-aware preset으로 승격
6. validation report 추가

## First Concrete Deliverable

첫 구현물은 아래가 적절하다.

- `docs/authoring/ds-registry-schema.md`
- `src/ds-registry.js`
- `src/resolve-pattern.js`
- `toolbar`, `status-chip`, `data-table` 3개를 registry-aware helper로 연결

이 단계가 끝나면 Xbridge는 단순 writable bridge에서 `DS-aware authoring system`으로 넘어가기 시작한다.
