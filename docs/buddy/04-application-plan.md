# Buddy 벤치마크 기반 Xbridge 적용안

이 문서는 xbridge에 실제 적용할 계획만 정리합니다.

source note:
- `/Users/im_018/.gemini/antigravity/brain/b3680486-bec4-40aa-a725-8e036835c693/buddy_analysis_for_xbridge.md`
- `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/plans/2026-05-12-xbridge-buddy-benchmark-ux-plan.md`

## Context Model
- 목표:
  모델이 현재 선택뿐 아니라 주변 구조와 디자인 시스템 자산까지 이해하도록 만듭니다.
- 필요한 데이터:
  선택 노드, parent chain, children 요약, component/instance 정보, variable 바인딩, auto layout, variants, 페이지 내 유사 패턴.
- 예상 출력:
  모델 입력용 `작업 컨텍스트 객체`.
- 성공 기준:
  텍스트 변경 외 작업에서도 사용자가 별도 설명하지 않아도 현재 구조를 이해한 응답이 나온다.

## Action Taxonomy
- 목표:
  xbridge 작업을 `생성 / 변형 / 정리 / 참조` 4축으로 공식화합니다.
- 필요한 데이터:
  기존 텍스트 작업 분류, 읽기 명령, 쓰기 명령, 레이아웃 조작 가능 범위.
- 예상 출력:
  작업 종류 enum과 각 종류별 기본 읽기/쓰기 전략.
- 성공 기준:
  제안 chips, progress, 결과 요약, 후속 액션이 모두 같은 작업 분류를 기준으로 동작한다.

## Action Plan Schema
- 목표:
  자연어 요청을 곧바로 텍스트 결과로 받지 않고, 실행 가능한 중간 계획으로 정리합니다.
- 필요한 데이터:
  intent, 대상 범위, 읽기 결과, 예상 액션 목록, 검증 규칙.
- 예상 출력:
  `read summary -> action plan -> executable actions` 구조.
- 성공 기준:
  모델 출력이 흔들려도 브리지가 실행 전 검증과 복구를 수행할 수 있다.

## Executor + Verifier
- 목표:
  액션을 작은 단위로 실행하고, 실패 지점을 분리해 요약합니다.
- 필요한 데이터:
  텍스트 교체, node 생성, component 교체, variable 적용, auto layout 조정 같은 원자 액션 단위.
- 예상 출력:
  실행 결과 로그, 변경 요약, 실패 이유.
- 성공 기준:
  사용자는 무엇을 읽었고 무엇을 바꿨는지 항상 확인할 수 있다.

## UX Layer
- 목표:
  엔진 위에 Buddy 스타일의 작업 콘솔 UX를 얹습니다.
- 필요한 데이터:
  current context, task kind, last result, follow-up candidates.
- 예상 출력:
  웰컴 스크린, suggestion chips, New Chat, 결과 요약, 후속 액션, 상태 표시.
- 성공 기준:
  xbridge가 채팅창보다 `Figma-native action agent`로 느껴진다.
