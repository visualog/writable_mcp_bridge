# Xbridge Release Log

## 0.5.62 - 2026-04-29

- Reduced default read depth and node limits for metadata, node detail, instance detail, snapshot, and variable definition reads to lower queue pressure in fallback-heavy sessions.
- Shrunk metadata fallback detail reads to shallow, capped payloads so retry paths stop blocking the queue with large follow-up reads.

## 0.5.61 - 2026-04-29

- Fixed NVIDIA AI designer chat routing to use `chat/completions` instead of `responses`, so plugin chat requests no longer fail with HTTP 404 on supported NVIDIA models.
- Updated version alignment across server, plugin UI, and package metadata.

## 0.5.60 - 2026-04-29

- Added a WS-first preference window in the plugin runtime so recent WebSocket sessions retry aggressively before polling fallback resumes.
- Tightened plugin heartbeat cadence and reduced WS reconnect delay to make live command sessions stickier during brief drops.

## 0.5.59 - 2026-04-29

- Softened the top stability pill styling and shortened labels to `안정성 좋음`, `안정성 주의`, and `안정성 나쁨` so it aligns better with the neighboring badges.

## 0.5.58 - 2026-04-28

- Added a 3-step NVIDIA model selector to the AI composer so users can switch between `낮음`, `중간`, and `높음` presets directly from the plugin.
- Shortened the visible model label to human-friendly names such as `Nemotron Mini 4B · 낮음` instead of raw provider/model IDs.

## 0.5.57 - 2026-04-28

- Shortened the composer model pill to show a compact model name instead of the full provider/model slug.
- Switched the default saved NVIDIA model to the lighter `nvidia/nemotron-mini-4b-instruct`.

## 0.5.56 - 2026-04-28

- Compressed the in-flight progress UI into a denser status list with `완료 / 진행 중 / 대기` labels.
- Replaced long per-step descriptions with one short `현재:` line so chat progress reads more like a concise activity log.

## 0.5.55 - 2026-04-28

- Simplified the in-flight chat progress wording from developer-style labels to user-facing labels such as `요청 이해`, `화면 확인`, and `답변 준비`.
- Reduced the progress top line to a lighter `처리 중 · Xs` indicator and changed the footer from `생각 중` to `답변을 정리하고 있어요.`

## 0.5.54 - 2026-04-28

- Replaced the plain in-flight system text with a progress-style chat card that shows elapsed work time, current step, and a lightweight `생각 중` state while a response is being prepared.

## 0.5.53 - 2026-04-28

- Added AI configuration validation so malformed provider/model/base URL combinations are reported as a human-readable setup error instead of low-level URL parse failures.
- Updated the composer model pill to show `AI 설정 오류` instead of exposing shifted raw values when the AI config is malformed.

## 0.5.52 - 2026-04-28

- Renamed the top header health pill from a vague `컨디션` label to `작업 안정성` so it is clearer that the badge reflects overall operating stability, not raw server reachability.
- Added the current stability reason as the tooltip/accessible label for the header pill.

## 0.5.51 - 2026-04-28

- Added a top-level server condition pill beside `운영 창 보기` so the current bridge health is visible without opening diagnostics.
- Added the currently connected AI provider/model pill beside the chat composer send button.
- Suppressed planner/read-routing boilerplate for simple greeting prompts so conversational turns can surface the AI reply first.

## 0.5.50 - 2026-04-28

- Added first-class `nvidia` AI provider support for AI Designer using the OpenAI-compatible Responses API path, so NVIDIA-hosted models can be selected without falling into `unsupported_provider`.
- Added NVIDIA AI config and response parsing coverage in `tests/ai-designer-api.test.js`.

## 0.5.49 - 2026-04-28

- Guarded AI Designer Enter submission during IME composition so Korean text entry no longer leaves partial trailing characters in the composer after send.

## 0.5.48 - 2026-04-28

- Added `set:keychain-ai` so the bridge can store AI API settings in macOS Keychain alongside the existing Figma token flow.
- Extended `start:keychain` to load saved AI key, model, base URL, and provider values before starting the bridge, so AI designer chat no longer depends on manual shell exports.

## 0.5.47 - 2026-04-27

- Cleared the AI Designer input immediately when a prompt is submitted so pressing Enter or the send button no longer leaves the just-sent text sitting in the composer while the request is running.

## 0.5.46 - 2026-04-27

- Removed the visible `나` label from user chat bubbles so both sides of the AI Designer conversation now render as cleaner message-only entries.

## 0.5.45 - 2026-04-27

- Replaced the AI Designer `+` action with an attachment menu for current Figma context, images, files, and documents, and rendered attached items as removable chips above the composer.
- Included attachment summaries in designer requests so text-readable documents contribute short excerpts while binary/image attachments still travel as metadata hints.

## 0.5.44 - 2026-04-27

- Removed the AI Designer system-message speech bubble treatment and the visible `Xbridge` author label so guidance reads as lighter inline helper text within the conversation.

## 0.5.43 - 2026-04-27

- Made the AI Designer chat area fill the plugin window height more naturally so the conversation surface uses the available viewport instead of leaving a large dead zone below.
- Moved the `운영 창 보기` dropdown next to the top-right bridge toggle and refreshed system/user message bubbles so Xbridge responses align more cleanly and read more like a chat UI.

## 0.5.42 - 2026-04-27

- Added write-coalescing counters to runtime queue diagnostics so health/runtime views can report how many bind requests were merged and how many command round-trips were saved.
- Added regression coverage that verifies concurrent bind requests increment the coalescing metrics after flushing as one `bulk_bind_variables` command.

## 0.5.41 - 2026-04-27

- Added server-side `bind_variable` write coalescing so near-simultaneous single binding requests for the same plugin session can be flushed as one `bulk_bind_variables` command.
- Added regression coverage proving concurrent bind requests now ride one bulk write while each caller still receives an individual `bound` result.

## 0.5.40 - 2026-04-27

- Added plugin-runtime variable caches for variable-by-key, variable-by-id, and variable collection lookups so repeated bind/read flows reuse previously imported variable metadata.
- Added variable cache snapshots to `bind_variable` and `bulk_bind_variables` results so repeated write runs can confirm cache hit/miss behavior while tuning bridge performance.

## 0.5.39 - 2026-04-27

- Added adaptive timeout and expiry grace to write-heavy variable binding commands so `bind_variable` and `bulk_bind_variables` are less likely to expire under short queue pressure.
- Added integration coverage proving single bind writes can survive beyond the base timeout budget and still complete successfully.

## 0.5.38 - 2026-04-27

- Split diagnostics into read vs write readiness so the plugin can show "읽기 준비" and "쓰기 준비" separately for non-developer users.
- Added write-readiness details to the grouped diagnostics and advanced ops surface so mutation backlog/expiry risk is easier to spot.

## 0.5.37 - 2026-04-27

- Added `bulk_bind_variables` on the bridge and plugin runtime so repeated variable writes can be sent in a single mutation batch instead of one command at a time.
- Added `/health.writeReadiness` and runtime write queue diagnostics so write backlog, expiry risk, heartbeat gap, and recent write failures are visible separately from read readiness.

## 0.5.36 - 2026-04-23

- Removed the visible window-size control and fixed the plugin UI resize request to the large layout.
- Compressed bridge server/session diagnostics into small modal-trigger buttons so the default surface stays focused on the AI Designer chat.

## 0.5.35 - 2026-04-23

- Added an AI Designer action preview/readiness layer that turns suggestion apply candidates into scoped previews with blockers, confirmation level, and apply mode.
- Returned `designerActionPreviewBundle` from designer read/chat APIs and surfaced readiness details in the plugin `작업 상세` action list.

## 0.5.34 - 2026-04-23

- Reworked the AI Designer default surface into a chat-first layout with friendlier `Xbridge`/`나` message labels.
- Moved intent, read routing, suggestion, and handoff technical previews behind an `작업 상세` modal so the default plugin view stays focused on the design conversation.

## 0.5.33 - 2026-04-23

- Hid the full diagnostics panels from the default plugin surface so AI Designer remains the primary UI.
- Added a compact bridge status tools hub that opens connection/server, command, selection, and advanced diagnostics in the existing modal.

## 0.5.32 - 2026-04-23

- Reworked the bridge diagnostics UI into a non-developer friendly summary plus grouped detail buttons.
- Added a diagnostics modal so connection, command readiness, server/version, and response-speed details can be opened only when needed.

## 0.5.31 - 2026-04-23

- Added an OpenAI Responses API adapter for the plugin AI designer flow.
- Added `POST /api/designer/chat` so chat requests can run the existing read-context pipeline and, when configured, receive an AI-authored design response.
- Exposed AI designer provider/model/configured status in `/health`.

## 0.5.30 - 2026-04-21

- Added a designer suggestion builder so read execution results now produce evidence-backed findings, recommendations, risks, and candidate apply actions.
- Wired the plugin AI designer shell to render a `Suggestion Preview` card and recommended action list after read execution completes.

## 0.5.29 - 2026-04-21

- Added a runtime designer read executor and `POST /api/designer/read-context` so read routing plans can execute existing bridge reads phase-by-phase.
- Wired the plugin AI designer send flow to trigger the read executor and report execution summary back into the chat shell.

## 0.5.28 - 2026-04-21

- Added intent-to-read routing plans so designer intent envelopes now declare a concrete `fast_context -> focused_detail -> asset_lookup` escalation path.
- Added a plugin-side `Read Routing Preview` card so the AI designer shell can show which read phases and APIs are planned for the current request.

## 0.5.27 - 2026-04-21

- Added a design-AI-first summarized context layer that packages `fast context`, `focused detail`, and `asset lookup` guidance for plugin-side reasoning.
- Wired the plugin AI designer shell and intent preview to the new summarized context so selection-first read strategy is visible before deeper reads.

## 0.5.26 - 2026-04-21

- Added auto execution plan inference for `handoff:run-next` via `XBRIDGE_HANDOFF_CMD_<MODE>` and `XBRIDGE_HANDOFF_CMD_DEFAULT`.
- Added unit coverage for local execution plan inference and integration coverage for the auto runner path.

## 0.5.25 - 2026-04-21

- Extended `handoff:run-next` so it can execute a local command before marking the handoff complete.
- Surfaced execution command metadata in plugin completion messages and the recent handoff board.

## 0.5.24 - 2026-04-21

- Added `scripts/run-next-handoff.mjs` and `npm run handoff:run-next` to claim the next queued handoff and optionally complete it in one step.
- Added integration coverage for the one-step local handoff runner.

## 0.5.23 - 2026-04-21

- Extended handoff completion flow to capture `changedFiles` and `tests` metadata from the local worker.
- Expanded the plugin handoff board and completion messages to surface changed files and test commands.

## 0.5.22 - 2026-04-21

- Added a recent handoff status board to the plugin AI designer shell so queued, claimed, and completed implementation requests can be inspected directly in the plugin.
- Wired the handoff board to bridge refresh and realtime lifecycle events.

## 0.5.21 - 2026-04-21

- Added handoff lifecycle endpoints for queued work pickup and completion: `GET /api/handoffs/next`, `POST /api/handoffs/claim`, and `POST /api/handoffs/complete`.
- Added `scripts/claim-next-handoff.mjs` and `npm run handoff:claim-next` so a local worker can claim the next queued implementation handoff.

## 0.5.20 - 2026-04-21

- Added `POST /api/handoffs` and `GET /api/handoffs` so the plugin can submit and inspect local implementation handoff payloads.
- Promoted the AI designer shell from preview-only flow to actual bridge submission flow for local implementation requests.

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
