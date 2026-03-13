# Home FAB Re Bridge Upgrade Design

**Goal**

`home-FAB-re` 프레임에 한정해 레이어명을 `slash + kebab-case` 규칙으로 정리할 수 있도록 Figma writable bridge를 업그레이드한다. 첫 단계는 `rename_node` 기능 추가와 `home-FAB-re` 네이밍 표준 적용이다.

**Scope**

- 대상 프레임: `home-FAB-re`
- 1차 기능: 레이어명 변경
- 후속 기능: auto layout 속성 수정, 정렬/간격 재배치, 컴포넌트 속성 변경
- 승인 규칙: 컴포넌트 속성 변경은 실제 Figma 문서 반영 전에 사용자 승인 필수

**Current Bridge Capability**

현재 브리지는 아래 작업을 지원한다.

- 텍스트 수정
- 노드 표시/숨김
- 단색 배경색 변경
- 위치 이동
- 크기 변경
- 노드 복제
- 부모 이동

현재 브리지가 지원하지 않는 핵심 항목은 아래다.

- 레이어명 변경
- auto layout 속성 변경
- padding / gap 변경
- layout mode / alignment 변경
- constraints / resizing mode 변경
- 인스턴스 속성 변경

**Naming Standard**

레이어명은 `slash + kebab-case`를 사용한다.

규칙:

- 화면 최상위 프레임은 기능명으로 명시
- 자식 레이어는 `group/item` 구조로 계층 의미를 이름에 반영
- 약어 최소화
- 상태는 suffix로 명시
- 숫자 기반 임시 이름, `Frame 70227`, `Rectangle 2914`, `Container`, `section` 같은 일반명 제거

예시:

- `home-fab-re`
- `header/container`
- `header/title`
- `header/actions`
- `ai-query/input`
- `hero-banner`
- `hero-banner/pagination`
- `recommendation-section`
- `recommendation-card-list`
- `recent-section`
- `recent-card-list`
- `recent-card/title`
- `recent-card/meta`
- `fab/trigger`
- `fab/menu`
- `fab/menu-item-create-page`

**Bridge Upgrade Design**

1. Add `rename_node`

- 입력: `nodeId`, `name`
- 동작: 해당 노드의 `name` 속성 변경
- 반환: `id`, `oldName`, `newName`, `type`

2. Add `bulk_rename_nodes`

- 입력: `updates: [{ nodeId, name }]`
- 동작: 여러 노드를 순차 변경
- 반환: 변경 결과 배열

3. Approval boundary for component properties

- `set_component_properties` 계열 기능은 브리지에만 추가 가능
- 실제 문서 반영 시에는 사전 설명과 사용자 승인 필요
- rename / move / resize는 승인 없이 진행 가능

**Why rename first**

- `home-FAB-re` 프레임의 구조를 읽기 쉽게 만든다
- 이후 auto layout 편집 시 대상 노드 지정이 쉬워진다
- 브리지 자동화 안정성이 높아진다
- 비개발자 협업자도 구조를 빠르게 파악할 수 있다

**Risks**

- 잘못된 rename이 기존 컴포넌트 해석이나 팀 관습과 충돌할 수 있다
- instance 내부 레이어 rename은 향후 컴포넌트 sync 시 재정렬 가능성이 있다
- 현재 브리지는 노드 탐색이 `nodeId` 기반이므로, rename 이후에도 식별은 안정적이지만 사람이 수동 추적하는 방식은 바뀐다

**Mitigation**

- 이번 단계는 `home-FAB-re`에만 한정
- 먼저 rename mapping을 문서로 정의 후 적용
- 의미가 불분명한 레이어는 보수적으로 rename
- 컴포넌트 속성 변경은 승인 절차 분리

**Application Strategy for home-FAB-re**

우선 아래 수준까지 이름을 정리한다.

- 최상위 홈 프레임
- 헤더
- AI 입력
- 배너
- 추천 섹션
- 최근 작성 섹션
- 최근 카드 리스트
- FAB 관련 노드
- 하단 탭

`thumbnail`, `image`, `badge`, `meta`, `utility`처럼 공통 하위 구조는 의미가 확실한 곳만 정리한다. 썸네일 내부 분할 프레임처럼 의미보다 구조 보조 역할이 큰 노드는 후순위로 둔다.

**Next steps after rename**

1. `auto layout` 속성 수정 기능 추가
2. `home-FAB-re` 내 섹션 위계와 간격 재정리
3. 필요 시 FAB 메뉴 확장 구조 재배치
4. 마지막으로 컴포넌트 속성 변경 기능 추가하되, 실제 반영은 승인 후 수행
