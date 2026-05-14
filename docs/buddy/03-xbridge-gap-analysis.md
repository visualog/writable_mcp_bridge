# Buddy와 Xbridge 차이 분석

이 문서는 Buddy와 xbridge의 차이를 비교합니다.

source note:
- `/Users/im_018/.gemini/antigravity/brain/b3680486-bec4-40aa-a725-8e036835c693/buddy_analysis_for_xbridge.md`
- `/Users/im_018/Documents/GitHub/Project/figma_skills/xbridge/docs/plans/2026-05-12-xbridge-buddy-benchmark-ux-plan.md`

## 엔진
- 이미 있음:
  xbridge는 로컬 브리지, 선택 기반 읽기/쓰기, 모델 연결, 진행 상태 표시 기반을 갖고 있습니다.
- 부족함:
  선택을 넘어선 디자인 시스템 인덱싱, component/variant/variable 인지, 중간 action plan 계층이 약합니다.
- 없음:
  생성 / 변형 / 정리 / 참조를 공식 작업 분류로 다루는 엔진 구조는 아직 없습니다.

## UX
- 이미 있음:
  작업 로그, 요약, 후속 액션, 모델 선택, 설정 패널이 있습니다.
- 부족함:
  Buddy처럼 `작업 콘솔`이 중심이 되는 흐름, 빈 상태 onboarding, suggestion chips, New Chat 초기화 경험이 약합니다.
- 없음:
  디자인 시스템 상태를 전면에 드러내는 흐름과 결과 중심의 액션 체이닝은 부족하거나 미구현입니다.

## 운영 모델
- 이미 있음:
  xbridge는 로컬 모델과 외부 모델을 선택할 수 있고, 사용자 데이터 통제 측면의 강점이 있습니다.
- 부족함:
  실행 안정성, 작업 종류 확대, 결과 품질 검증 계층이 아직 텍스트 작업 중심입니다.
- 없음:
  Buddy 수준의 상용 크레딧/업그레이드 모델은 없지만, 그 대신 로컬 무제한이라는 다른 강점을 전면화하는 제품 메시지는 아직 약합니다.

## 우선순위
1. 디자인 시스템 인지형 컨텍스트 모델
2. 자연어를 실행 계획으로 바꾸는 action plan 계층
3. 생성 / 변형 / 정리 / 참조 작업 분류
4. 작업 콘솔형 UX 보강
