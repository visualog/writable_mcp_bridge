# Xbridge Release Log

## 0.5.19 - 2026-04-16
- live primary session이 존재할 때 stale `default` 또는 non-live recovery debt가 active 경로를 과도하게 degrade시키지 않도록 session resolution/readiness 판정을 정교화
- session snapshot 정렬을 heartbeat/seen/registered recency 기준으로 보정해 실제 live 세션이 active plugin으로 더 일관되게 선택되도록 개선
- 명시적 grace 설정이 없을 때 WS pickup ack timeout 이후 polling fallback이 과도하게 지연되지 않도록 기본 fallback grace를 보수적으로 조정

## 0.5.18 - 2026-04-15
- `validate-streaming-first` 스크립트를 polling policy 인지형으로 조정해 `recovery_only` 모드에서 fallback polling 검증을 자동 skip하고 false fail을 완화
- soak 표준 프로필에서 초기 1회 false fail을 유발하던 “fallback pickup 미관측” 케이스를 정책 모드 기준으로 분리해 운영 안정성 점검 신뢰도 개선
- file comment API에 `targetNodeId` 필터를 추가해 일반 comment thread를 노드 기준으로 바로 좁혀 조회 가능
- authoring 문서와 OpenAPI 초안을 최신 streaming-first observability 필드(`commandReadiness`, `activeSessionResolution`, `fallbackIncidenceTrend`, polling fallback policy 계열) 기준으로 정렬해 운영 해석 비용을 낮춤

## 0.5.17 - 2026-04-15
- polling fallback 정책 모드(`POLLING_FALLBACK_MODE=legacy|recovery_only`)를 추가하고 `recovery_only` 기본값에서 ready+live WS 구간의 polling 전달을 정책적으로 차단
- `/plugin/commands` queue 응답에 `pollingFallbackMode(mode/blocked/reason)`·`deferredByPolicyBlock`을 노출해 “왜 polling이 멈췄는지”를 즉시 파악 가능
- transport counters에 `pollingDeferredByPolicyBlockTotal`을 추가하고, 통합 테스트에 recovery-only 차단/복구(backlog risk) 시나리오를 추가

## 0.5.16 - 2026-04-15
- `/plugin/commands`에 `readyFallbackCap` 정책을 추가해 command readiness가 `ready`이고 WS plugin client가 live일 때 polling fallback 전달량을 tick당 제한
- transport counters에 `pollingDeferredByReadyCapTotal`을 추가해 ready 구간 polling 억제량을 `/health`에서 추적 가능
- Figma REST 기반 일반 코멘트 스레드 조회 API `GET /api/figma/file-comments`를 추가해 annotations 외 comment thread 읽기 경로를 제공

## 0.5.15 - 2026-04-15
- `commandReadiness.timingLagThresholdMs`를 고정값에서 adaptive 임계치로 보정해 최근 `enqueue→dispatch` 기준이 높을 때 dispatch→ack lag 오탐을 완화
- readiness에 `baseTimingLagThresholdMs`, `timingLagThresholdSource`를 추가해 현재 임계치가 기본값인지 적응값인지 운영자가 즉시 확인 가능
- plugin runtime readiness 카드에 lag threshold 라인을 추가해 bottleneck 해석과 next-check 액션을 함께 판단 가능

## 0.5.14 - 2026-04-15
- `commandReadiness`에 timing bottleneck 필드(`timingBottleneckStage`, `timingBottleneckDurationMs`, `timingBottleneckCommandType`, `timingLagThresholdMs`)를 추가해 health와 실제 명령 응답 지연 간극을 명시적으로 노출
- dispatch→ack 평균 지연이 임계치 이상이고 queue가 쌓인 경우 readiness reason을 `queue_dispatch_ack_lag`로 분리해 운영자가 recovery와 WS ack 병목을 구분 가능
- plugin runtime 카드의 readiness 힌트를 reason별로 구체화하고 bottleneck 1줄을 추가해 “connected vs command-ready” 해석을 더 빠르게 지원

## 0.5.13 - 2026-04-15
- queue 관측에 `commandTimelineTail`(enqueue/dispatch/ack/complete 시각과 단계별 duration)을 추가해 `ERR_COMMAND_EXPIRED` 전후 구간 분석을 빠르게 지원
- `/plugin/commands` 응답에도 plugin 범위 `queue.commandTimelineTail`을 노출해 현장 세션에서 만료 직전 지연 단계를 바로 확인 가능
- plugin UI에서 primary action과 보조 action 버튼이 동일할 때(예: 서버 다시 확인/세션 재등록) 중복 노출되지 않도록 dedupe 처리

## 0.5.12 - 2026-04-15
- runtime queue에 `lifecycleSummary(status/timing/expired)`를 추가해 enqueue→dispatch→ack→complete 지연과 최근 만료 사유를 한 번에 확인 가능
- `/plugin/commands` 응답에도 plugin 단위 `queue.lifecycleSummary`를 노출해 `ERR_COMMAND_EXPIRED` 원인 추적을 빠르게 지원
- plugin runtime 패널(큐 지연 카드)에 lifecycle status/timing/last expired 라인을 추가하고 통합 테스트에 lifecycle summary 계약 검증을 포함

## 0.5.11 - 2026-04-15
- polling fallback guard에 `queue_pressure`·`near_timeout` 자동 튜닝을 추가해 detail 경로 지연 과도화를 완화하면서 timeout 보호를 유지
- queue 관측에 `deferredByTuningMode`와 policy guard(`queuePressureThreshold`, `nearTimeoutRatio`)를 추가해 튜닝 발동 이유를 즉시 확인 가능
- websocket 통합 테스트에 queue pressure 보호 케이스를 추가해 detail fallback 과지연 회귀를 방지

## 0.5.10 - 2026-04-15
- command type별 polling fallback guard에 `queue pressure`·`near-timeout` 자동 튜닝을 추가해 detail 경로의 과도한 지연을 완화
- `/plugin/commands`·runtime queue에 `deferredByTuningMode`, `pollingFallbackPolicy(queuePressureThreshold/nearTimeoutRatio)`를 노출해 정책 발동 원인 가시성 강화
- websocket 통합 테스트에 queue pressure 환경의 detail fallback 보호 검증을 추가해 회귀 방지

## 0.5.9 - 2026-04-15
- command type별(`critical/standard/detail`) polling fallback grace multiplier 정책을 도입해 평시 detail 경로의 polling 개입을 더 늦춤
- `/plugin/commands`와 runtime queue에 `deferredByFallbackClass`, `pollingFallbackPolicy`를 노출해 현재 fallback 정책/보류 분포를 즉시 확인 가능
- websocket 통합 테스트에 `critical fallback 선행` 시나리오를 추가해 타입별 fallback 우선순위 회귀를 방지

## 0.5.8 - 2026-04-15
- `/plugin/commands` 응답에 `queue.deferredByWsGuard`, `queue.oldestDeferredByWsGuardMs`를 추가해 WS 우선 지연으로 보류된 fallback 상태를 즉시 확인 가능
- `transport.counters.pollingDeferredByWsGuardTotal` 계측을 추가해 fallback 지연 누적 규모를 `/health`·`/api/runtime-ops`에서 추적 가능
- websocket 통합 테스트에 WS live 구간 fallback 지연 계측(assert)을 추가해 회귀 방지

## 0.5.7 - 2026-04-15
- polling fallback 지연이 명령 timeout 예산을 침범하지 않도록 `timeout budget cap`을 적용해 만료 리스크를 낮춤
- plugin 세션이 live일 때만 fallback 지연을 적용해 stale/offline 구간에서 fallback 전달이 불필요하게 늦어지지 않도록 보정
- websocket 통합 테스트에 `timeout budget respect` 시나리오를 추가해 회귀를 방지

## 0.5.6 - 2026-04-15
- plugin websocket 연결이 살아있는 동안 `polling fallback` 전달을 짧은 grace 구간에서 지연해 WS 우선 경로를 더 오래 유지
- `/health.transportHealth`에 `fallbackPressureRate`를 노출해 최근 신호 기준 fallback 압력을 별도로 확인 가능
- WS live 구간에서 polling fallback 지연 및 최근 fallback 소거 시 안정 복귀를 검증하는 통합 테스트 추가

## 0.5.5 - 2026-04-15
- transport health 판정이 최근 fallback 신호를 우선 반영하도록 조정해 과거 누적 fallback으로 high 상태가 고착되는 문제 완화
- `transportHealth.fallbackPressureRate`를 추가해 현재 운영 구간의 실질 fallback 압력을 별도로 노출
- WS→polling fallback 후 최근 신호가 사라지면 상태가 안정 구간으로 복귀하는 통합 테스트 추가

## 0.5.4 - 2026-04-15
- `transportHealth.fallbackIncidenceTrend`에 `status(stable/watch/high)`를 추가해 fallback 압력을 정성 상태로 표시
- plugin runtime `transport health` 카드에 `fallback status` 라인을 추가해 추세 해석을 단순화
- `report-streaming-first`와 preflight 테스트에 trend status 계약/일관성 검증 추가

## 0.5.3 - 2026-04-15
- `transportHealth.fallbackIncidenceTrend` 파생 지표를 추가해 fallback 비중의 방향성과 압력을 `/health`·`/api/runtime-ops`에서 직접 확인 가능
- plugin runtime 패널에 `fallback trend` 라인을 추가해 증감 추세를 즉시 식별
- `report-streaming-first` summary에 fallback incidence trend를 포함해 운영 리포트 가시성 강화

## 0.5.2 - 2026-04-14
- SSE와 session readiness가 안정적인 상태에서 WS 재연결 창이 열리면 polling을 즉시 적극화하지 않고 standby 지연으로 유지
- WS reconnect 중 불필요한 fallback polling 진입을 줄여 streaming-first 경로를 더 오래 유지

## 0.5.1 - 2026-04-14
- SSE가 살아 있고 세션/command readiness가 안정적인 경우 polling을 `standby` 간격으로 늦춰 WS/SSE 우선 구간을 더 오래 유지
- `activeSessionResolution`를 `/health`, `/api/runtime-ops`, `/api/sessions`, plugin UI에 노출해 active/stale ambiguity를 더 명확하게 표시
- 다중 live 세션에서 default 명령 경로가 모호할 때 `ERR_PLUGIN_SESSION_AMBIGUOUS`를 구조화된 details와 함께 반환

## 0.5.0 - 2026-04-14
- `commandReadiness`를 `/health`, `/api/runtime-ops`, plugin UI에 추가해 connected와 command-ready 상태를 분리
- queue backlog risk, adaptive timeout, fallback quiet-cycle read 절감으로 스트리밍 운영 안정성 강화
- read-heavy command timeout 완화와 observability/report 계약 보강으로 실사용 reliability 향상

## 0.4.0 - 2026-04-14
- streaming-first 하이브리드 운영 단계 확장 (SSE, WS command channel, polling fallback 안정화)
- `/health`, `/api/runtime-ops`, plugin UI에 transport/runtime observability와 UI metrics 계측 반영
- `report-streaming-first` 리포트 스크립트, summary, 계약 테스트 추가

## 0.3.0 - 2026-04-10
- DS-aware compose pipeline and external analyzer contract 반영
- `/api/pages`, 계정 기반 파일 탐색 API, compose metrics 확장
- bridge recovery UX 개선 (Primary CTA, 에러코드, 자동 재시도 카운트다운, 가이드 스텝)

## 0.2.0 - 2026-03-31
- compose 기반 authoring 흐름 및 helper 확장
- cross-page discovery와 운영 검증 로그 정리

## Versioning Rule
- `major`: 호환 불가 API/프로토콜 변경
- `minor`: 새로운 API, helper, UX 기능 추가
- `patch`: 버그 수정, 문서/메시지 개선, 내부 안정화
