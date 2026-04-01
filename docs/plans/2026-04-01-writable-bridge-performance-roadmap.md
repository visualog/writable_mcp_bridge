# Writable MCP Bridge 성능 개선 TODO

## 목표

- 큰 화면 생성 속도 개선
- 세션 복구 사용성 개선
- 디자인 시스템 재사용 workflow의 응답성 개선

## TODO

### 1. section typing + section pipeline
- [ ] `build_screen_from_design_system`에 section analysis 단계 추가
- [ ] 레퍼런스 구조를 `navigation`, `summary-cards`, `timeline`, `list`, `table`, `form`, `actions` 같은 typed section으로 매핑
- [ ] typed section별 실행 함수 분리
- [ ] 섹션별 실패가 전체 생성 실패로 번지지 않도록 가드 추가
- [ ] screen scaffold와 section enhancement를 분리

### 2. import cache
- [ ] plugin runtime에 세션별 component import cache 추가
- [ ] plugin runtime에 style import cache 추가
- [ ] plugin runtime에 variable import cache 추가
- [ ] cache hit/miss를 디버그 응답에 포함할지 검토
- [ ] 서버 재시작 시 cache 초기화 정책 정리

### 3. font load cache
- [ ] `loadFontIfNeeded(family, style)` 유틸 추가
- [ ] 텍스트 생성 경로를 공통 유틸로 통합
- [ ] 텍스트 수정 경로를 공통 유틸로 통합
- [ ] unavailable font 처리 정책 정리

### 4. 세션 자동 복구
- [ ] plugin UI에서 health 복구 시 자동 재등록 시도
- [ ] 재연결/재등록 버튼 활성 조건 재검토
- [ ] 상태 메시지에 복구 시도 횟수 또는 마지막 실패 이유 표시
- [ ] 수동 복구 버튼은 fallback으로 유지

### 5. batch mutation
- [ ] `batch_mutation` 또는 `bulk_mutation` API 설계
- [ ] create/update/move/reorder를 하나의 트랜잭션 payload로 묶는 구조 설계
- [ ] 결과 payload 최소화 옵션 추가
- [ ] 대규모 작업에서 partial failure 처리 방식 정의

### 6. polling 최적화
- [ ] idle/active/recovering 상태별 polling interval 분리
- [ ] 불필요한 health check 호출 수 줄이기
- [ ] command 진행 중일 때만 공격적 polling 사용
- [ ] timeout 이후 자동 recover 시나리오 정리

### 7. workflow 최적화
- [ ] `build_screen_from_design_system`에서 fallback 생성 우선순위 낮추기
- [ ] reusable content component 슬롯 구조 도입
- [ ] dashboard recipe를 component-first 방식으로 재작성
- [ ] reference-image 기반 구조 해석 결과를 typed section recipe로 연결

### 8. 검증 계획
- [ ] 대시보드 생성 시간을 baseline과 비교 측정
- [ ] section typing 도입 전/후 time-to-first-visible 비교
- [ ] import cache hit 시 체감 속도 비교
- [ ] 서버 재시작 후 자동 복구 동작 검증
- [ ] 복잡한 화면 3종에서 timeout 빈도 측정

## 이번 주 우선 작업

- [ ] section analysis + typed pipeline 초안 구현
- [ ] component/style/variable import cache 1차 구현
- [ ] `loadFontIfNeeded` 유틸 추가
- [ ] dashboard workflow를 typed section 단위로 재작성
