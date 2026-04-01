# Writable MCP Bridge 성능 개선 설계

## 배경

현재 브리지는 실제 Figma 파일에 화면을 생성하고 디자인 시스템 자산을 재사용하는 흐름까지 구현됐다. 다만 대시보드처럼 섹션이 많고 텍스트/카드/테이블 노드가 많은 화면을 한 번에 생성할 때 체감 속도가 느리고, 서버 재시작 이후 세션 복구도 수동 단계가 필요해 사용성이 떨어진다.

이번 성능 개선의 목적은 다음과 같다.

- 큰 화면 생성 시간을 줄인다.
- 플러그인 타임아웃과 응답 지연을 줄인다.
- 서버 재시작 이후 세션 복구를 더 자연스럽게 만든다.
- 디자인 시스템 자산 재사용 흐름을 유지하면서도 불필요한 중복 작업을 줄인다.

## 문제 정의

현재 느린 직접 원인은 다음과 같다.

1. 한 번의 명령에서 너무 많은 노드를 생성한다.
2. 같은 component/style/variable를 같은 세션 안에서 반복 import한다.
3. 텍스트 생성과 스타일 적용이 많은 화면에서 폰트 로드 비용이 누적된다.
4. polling 기반 통신 구조 때문에 명령 왕복 오버헤드가 생긴다.
5. 서버 재시작 시 plugin session이 끊기고 수동 재등록이 필요하다.

## 개선 원칙

1. 큰 작업은 한 번에 끝내지 않고 섹션 단위로 나눈다.
2. 같은 자산은 같은 세션 안에서 한 번만 import한다.
3. 텍스트/폰트 작업은 가능한 한 캐시한다.
4. 브리지 응답은 최소 정보만 반환한다.
5. 재연결/재등록은 가능한 한 자동 복구를 우선한다.
6. fallback primitive 생성보다 component instance 재사용을 우선한다.

## 1차 개선: 체감 속도 우선

### 1. 섹션 분할 실행

`build_screen_from_design_system` 같은 고수준 workflow를 다음 단계로 분리한다.

- screen scaffold
- sidebar
- metrics
- timeline
- table
- post-enhancement

이렇게 하면 한 단계 실패가 전체 화면 생성 실패로 이어지지 않고, 노드 생성량도 줄어든다.

### 2. import cache

세션 단위로 다음 캐시를 둔다.

- component key -> imported component/component set
- style key -> imported style id
- variable key -> imported variable id

이를 통해 같은 screen workflow 안에서 중복 import를 제거한다.

### 3. font load cache

`loadFontAsync` 호출을 `family/style` 단위로 캐시한다.

- 이미 로드된 폰트는 다시 로드하지 않는다.
- unavailable font는 즉시 실패시키기보다 skip 또는 fallback 처리 전략을 둔다.

## 2차 개선: 브리지 구조 최적화

### 4. batch mutation

여러 create/update/move 명령을 하나의 batch payload로 전달할 수 있게 한다.

효과:
- polling round trip 감소
- 서버/플러그인 message overhead 감소
- 큰 화면 생성 시 체감 속도 개선

### 5. polling 최적화

현재 polling은 idle 상태에서도 잦은 확인을 수행한다. 이를 다음처럼 나눈다.

- idle: 긴 polling interval
- active command: 짧은 polling interval
- reconnect/recovering: 별도 간격

## 3차 개선: 사용성 복구

### 6. 세션 자동 복구

서버 재시작 이후 plugin UI가 자동으로 session register를 재시도하도록 한다.

- health가 다시 살아나면 자동 register 시도
- 실패 시에만 수동 버튼 활성화
- 현재 상태와 필요한 액션을 짧게 안내

## 4차 개선: workflow 수준 최적화

### 7. fallback 최소화

대시보드처럼 복잡한 화면에서는 primitive fallback을 많이 생성할수록 느려진다. 따라서 다음 순서를 강제한다.

1. search_design_system
2. find_or_import_component
3. reuse_or_create_component
4. fallback 생성

### 8. recipe 기반 화면 조립

`build_screen_from_design_system`은 generic screen builder보다 recipe runner에 가까워져야 한다.

예:
- dashboard
- detail
- list
- form
- modal

각 recipe는 사용 가능한 component map과 section step을 가진다.

## 권장 우선순위

1. 섹션 분할 실행
2. import cache
3. font load cache
4. 세션 자동 복구
5. batch mutation
6. polling 최적화
7. recipe 기반 고도화

## 기대 효과

- 큰 화면 생성 시 타임아웃 감소
- 재사용 가능한 디자인 시스템 자산 import 속도 개선
- 서버 재시작 이후 플러그인 복구 경험 개선
- 레퍼런스 이미지 기반 화면 생성 workflow의 실사용성 향상
