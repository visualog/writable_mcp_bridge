# Buddy 역설계 분석 리포트와 Xbridge 개선 로드맵

이 문서는 현재 관찰 가능한 Buddy 동작을 기준으로 Xbridge에 적용할 처리 모델과 구현 우선순위를 정리합니다. Buddy 내부 코드는 전제하지 않고, 입력, 읽기 단계, 진행 문구, 최종 답변의 구조만 근거로 삼습니다.

## 기준 샘플

현재 확정 기준 샘플은 프리미티브 컬러 분석 요청입니다.

- 요청: `선택한 프리미티브 컬러를 분석하고 개선이 필요한지 분석해줘`
- Buddy 흐름: 착수 문장 -> `Read Figma frame` 단계 -> 데이터 파악 완료 선언 -> 잘 된 점 -> 개선점 -> 우선순위 -> 다음 액션
- 핵심 차이: Buddy는 데이터 부족을 먼저 말하지 않고, 읽은 근거로 판단 가능한 항목을 먼저 제시합니다.

6개 비교 유형은 `tests/fixtures/buddy-analysis-samples.json`에 고정했습니다.

## Buddy 동작 모델

공통 파이프라인은 다음처럼 모델링합니다.

```text
Intent classify
-> Figma read
-> Evidence extraction
-> Domain QA rules
-> Report composition
-> Next action prompt
```

단계별 역할:

- Intent classify: 분석, 생성, 정렬, 재구성, 실패 진단 같은 요청 범주를 먼저 좁힙니다.
- Figma read: 선택 노드, 프레임, 이미지, 컴포넌트 속성, 변수, CSS/토큰 데이터를 목적별로 읽습니다.
- Evidence extraction: 사용자가 신뢰할 수 있는 숫자와 이름을 뽑습니다. 예: 컬렉션 수, 변수 수, 누락 단계, 유사 색상 값.
- Domain QA rules: 도메인별 규칙으로 판단합니다. 예: 컬러 스케일 누락, Light/Dark 불일치, 네이밍과 실제 값 불일치.
- Report composition: 분석 결과를 `잘 된 점 / 개선 필요 / 우선순위 / 다음 액션`으로 재구성합니다.
- Next action prompt: 사용자가 바로 수정, 시각화, 재검증으로 이어갈 수 있게 끝맺습니다.

## Buddy 응답 구조

Buddy식 응답은 다음 특징이 있습니다.

- 첫 문장: “분석해드릴게요. 먼저 읽어볼게요.”처럼 기대와 다음 단계를 동시에 말합니다.
- 중간 단계: `Read Figma frame`처럼 사용자가 볼 수 있는 action 이름을 노출합니다.
- 완료 선언: “전체 토큰을 파악했습니다”처럼 분석 범위를 확정합니다.
- 본문: 장점과 문제를 분리하고, 문제는 구체적 토큰 이름과 값으로 설명합니다.
- 우선순위: 높음, 중간, 낮음처럼 실행 순서를 제공합니다.
- 다음 액션: 수정, 문서화, 시각화, 특정 컬러군 정리 같은 후속 행동으로 마무리합니다.

## QA 추론 규칙

프리미티브 컬러 기준 1차 구현 규칙:

- 토큰 스케일 누락: `10..100` 단계 중 빠진 값을 색상군별로 감지합니다.
- Alpha 명칭 불일치: `dark/Black alpha`가 실제 white alpha 값이면 high 이슈로 분류합니다.
- 유사 색상군: `Blue/60`과 `LightBlue/60`처럼 RGB 거리가 가까운 색상군을 혼용 위험으로 분류합니다.
- 근거 우선 응답: 컬렉션 수, 변수 수, 컬러 bucket, primitive 컬렉션 이름을 답변에 포함합니다.

추가해야 할 규칙:

- Light/Dark 간 사용 가능한 단계 차이 비교
- semantic/theme 토큰이 primitive를 일관되게 참조하는지 검수
- 컴포넌트 variant 누락, override 과다, 네이밍 drift 감지
- 화면 UX에서 spacing, hierarchy, touch target, 정보 밀도 감지
- 이미지 재구성에서 OCR coverage, 좌표 coverage, 겹침, fallback 아이콘 검증

## Xbridge 갭 분석

현재 가능한 것:

- selection read
- metadata read
- node detail read
- token export
- 디자인 시스템 검색
- action preview
- image reconstruction quality 일부 검증

부족했던 것:

- 읽은 데이터를 QA 판단으로 바꾸는 해석 레이어
- 사용자가 “분석받았다”고 느끼는 리포트 구성
- 부분 성공 상태에서 가능한 진단을 먼저 제시하는 UX
- 진행 상태 문구와 최종 리포트의 일관성

이번 1차 구현:

- `src/primitive-color-audit.js`: 프리미티브 컬러 audit 모듈 추가
- `src/buddy-report-composer.js`: Buddy식 리포트 구성과 progress state contract 추가
- `src/ai-designer-suggestions-v2.js`: primitive token context에서 Buddy-style report composer 사용
- `src/ai-designer-suggestions-v2.js`: component 개선 분석과 frame UX 리뷰에도 deterministic Buddy-style audit report 적용
- `src/server.js`: token export 결과에 `colorScaleGroups` 요약 추가
- `src/ai-designer-server-contract.js`: deterministic Buddy report를 Codex 후처리가 덮어쓰지 않도록 보존
- `tests/fixtures/buddy-analysis-samples.json`: Buddy 샘플 6개 유형 fixture화

## 적용 로드맵

v1: 응답 포맷과 QA 리포트 구조 개선

- 프리미티브 컬러 분석을 Buddy식 리포트로 전환
- evidence-first summary를 기본값으로 적용
- 데이터 부족 문구는 가능한 진단 뒤에 배치

v2: 도메인 audit module 확장

- color token audit 고도화
- component audit 추가
- layout/UX audit 추가
- image reconstruction QA 분리

v3: Progress UX contract 정리

- `읽는 중`, `분석 중`, `검증 중`, `완료`, `부분 완료`, `실패` 문구 표준화
- read/action 이름을 사용자에게 일관되게 노출
- 부분 성공 시 usable evidence와 missing evidence를 분리

v4: Regression과 live Figma 검증 자동화

- fixture 6종을 요청 intent, read command, evidence, QA 판단, 우선순위 출력으로 비교
- live Figma 최소 3종 검증: 프리미티브 컬러, 컴포넌트/인스턴스, 화면/프레임 UX 리뷰
- 결과 리포트가 generic summary로 회귀하지 않는지 검사

## Live 검증 메모

`FDS v2.0 -테스트용 / ┗ Color`에서 다음 3개 요청을 검증했습니다.

- 프리미티브 컬러: `get_selection`, `get_metadata`, `get_node_details`, `export_design_tokens` 4개 read 성공. 컬렉션 7개, 변수 548개, 컬러 bucket 198개 근거로 스케일 누락, `dark/Black alpha`, `Blue vs LightBlue` 이슈를 출력했습니다.
- 컴포넌트 개선: `Chip component` 대상으로 8개 read command를 시도했고, 성공/실패 근거를 분리해 component property evidence와 design-system lookup 제한을 우선순위로 출력했습니다.
- UX/UI 리뷰: `primitives` SECTION 대상으로 3개 read command가 성공했고, 실제 화면 FRAME이 아닌 SECTION이라는 판단 제한을 뒤쪽에 분리한 뒤 리뷰 대상 확정과 레이아웃 근거 보강을 제안했습니다.
