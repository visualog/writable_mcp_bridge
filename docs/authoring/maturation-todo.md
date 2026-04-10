# Xbridge Maturation TODO

## P0 (Now)

- [x] external analyzer compose contract 추가
- [x] compose 전용 validator API 추가 (`validate_external_compose_input`)
- [x] `compose_screen_from_intents` 입력 정규화 적용
- [x] `analyze_reference_selection` 응답에 `intentSections` 포함
- [x] `analyze_selection_to_compose` one-call 경로 추가
- [x] xlink에서 validator 연동 + auto-block 옵션 추가
- [x] `compose_screen_from_intents.validationMode` (`lenient|strict`) 추가

## P1 (Next)

- [x] `validate_external_compose_input` 결과를 compose 응답과 xlink projection에서 공통 포맷으로 노출
  - [x] 브리지 응답(`validationReport`) 공통화
  - [x] xlink projection 동기화
- [x] `referenceAnalysis` 확장 필드 계약화
  - [x] table column schema
  - [x] action groups
  - [x] card/list density signals
- [x] `resolve_component_for_pattern`를 실제 DS component key/variant 선택으로 확장
- [x] 대시보드 레퍼런스 1종 E2E 회귀 스모크 스크립트 추가

## P2 (Quality)

- [x] fragment 분석 정확도 리포트(정답셋 기반) 추가
- [x] compose 결과 품질 지표
  - [x] unresolved/blocked section count
  - [x] fallback helper count
  - [x] strict mode failure ratio
- [x] `dashboard-board`, `app-shell` preset에 DS-aware token binding 확대

## P3 (Ops)

- [x] xlink-mcp tool에 `validate_xbridge_compose` 노출
- [x] validation 실패 시 자동 재시도/재요청 규칙 추가
- [x] 운영 대시보드에 validation 통계 추가

## Acceptance (1.0 readiness)

- [ ] core tests + compose/contract tests + xlink integration tests 통과
- [ ] 브리지/코디네이터 재시작 후 런타임 smoke 재현 가능
- [ ] README 기준으로 외부 에이전트 온보딩 10분 이내 완료 가능
