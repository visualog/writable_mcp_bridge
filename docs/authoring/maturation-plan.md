# Xbridge Maturation Plan (Beta -> 1.0)

## Goal

`writable_mcp_bridge`를 "작동하는 베타"에서 "협업 가능한 1.0"으로 올린다.

핵심 기준:
- 외부 분석기/에이전트 입력 계약 안정화
- DS-aware compose 품질 상향
- 실패/재시도/차단 운영 흐름 표준화
- 회귀 테스트와 운영 가시성 강화

## Phase 1 - Contract Hardening

목표:
- 외부 payload 계약의 단일 소스화
- compose 이전 검증을 표준 경로로 고정

완료 기준:
- `validate_external_compose_input`를 외부 에이전트 기본 경로로 사용
- `compose_screen_from_intents`에 `validationMode` 적용
- 계약 문서/예시와 실제 API 스키마 동기화

## Phase 2 - DS-aware Resolution

목표:
- semantic intent가 helper를 넘어서 실제 DS 컴포넌트 선택까지 이어지게 한다.

완료 기준:
- intent -> component key/variant resolution 경로 추가
- `status-chip`, `toolbar`, `data-table`에서 실제 DS mapping smoke 통과
- fallback 이유를 응답에 구조화

## Phase 3 - Reference Quality

목표:
- reference 분석 품질을 실무 화면 수준으로 올린다.

완료 기준:
- table/card/list/actions fragment 정밀도 개선
- 대시보드/모바일 상세 화면 2종 이상 재구성 품질 검증
- 분석 신뢰도 신호(heuristic, confidence) 표준화

## Phase 4 - Multi-agent Ops

목표:
- xlink와 결합한 준실시간 협업을 안정 운영한다.

완료 기준:
- 검증 실패 시 자동 `blocked` + 이유 기록
- mailbox/conversation에 validator 결과 표준 메시지화
- handoff 재시도 규칙과 책임 경계 문서화

## Phase 5 - Release Readiness

목표:
- 1.0 릴리즈 가능한 안정성/문서/테스트 상태 확보

완료 기준:
- end-to-end 회귀 스모크 세트 통과
- README 운영 가이드 최신화
- known limitations와 escalation 경로 명시
