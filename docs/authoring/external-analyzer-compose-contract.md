# External Analyzer Compose Contract

이 문서는 외부 분석기와 Xbridge 사이의 공식 입력 계약을 정의합니다.

목표:
- 외부 분석기가 `referenceAnalysis` 또는 `intentSections`를 안정적으로 전달
- Xbridge는 변환 분기 없이 같은 규칙으로 compose
- 여러 에이전트가 같은 JSON 포맷으로 협업

## 1. 권장 흐름

1. 외부 분석기가 화면/이미지/프로토타입을 해석한다.
2. 가능한 경우 `intentSections`를 직접 만든다.
3. Xbridge에 `compose_screen_from_intents` 또는 `analyze_selection_to_compose`로 전달한다.
4. 외부 에이전트는 가능하면 먼저 `validate_external_compose_input`으로 payload를 검사한다.

우선순위:
1. `sections`
2. top-level `intentSections`
3. `referenceAnalysis.intentSections`
4. `referenceAnalysis.sections`를 Xbridge가 변환

## 2. referenceAnalysis 계약

```json
{
  "width": 1440,
  "height": 960,
  "backgroundColor": "#F7F8FA",
  "sections": [
    {
      "type": "navigation",
      "name": "sidebar",
      "headerTitle": "Workspace"
    },
    {
      "type": "table",
      "name": "project-list",
      "contentTitle": "Projects",
      "contentBody": "All active work."
    }
  ],
  "intentSections": [
    {
      "intent": "screen/sidebar",
      "title": "Workspace"
    },
    {
      "intent": "data/table",
      "title": "Projects",
      "columns": ["Name", "Summary"],
      "rows": [["Project A", "In progress"]]
    }
  ]
}
```

허용 `sections[].type`:
- `navigation`
- `header`
- `content`
- `actions`
- `summary-cards`
- `timeline`
- `list`
- `table`
- `form`

## 3. intentSections 계약

최소 필수 필드:
- `intent`

권장 필드:
- `key`
- `name`
- `title`
- `pattern`
- `variant`
- `tone`
- `density`
- `domain`
- `leftItems`
- `rightItems`
- `columns`
- `rows`
- `sections`
- `users`
- `children`

예:

```json
{
  "intentSections": [
    {
      "intent": "screen/topbar",
      "title": "Dashboard"
    },
    {
      "intent": "data/table",
      "title": "Project List",
      "density": "comfortable",
      "columns": ["Task", "Owner"],
      "rows": [["Wireframe", "IR"]]
    }
  ]
}
```

## 4. compose_screen_from_intents 입력 계약

```json
{
  "pluginId": "page:817:417",
  "parentId": "817:417",
  "name": "dashboard-compose",
  "width": 1440,
  "height": 960,
  "backgroundColor": "#FFFFFF",
  "intentSections": [
    {
      "intent": "screen/topbar",
      "title": "Dashboard"
    }
  ]
}
```

또는:

```json
{
  "pluginId": "page:817:417",
  "parentId": "817:417",
  "referenceAnalysis": {
    "intentSections": [
      {
        "intent": "screen/sidebar",
        "title": "Workspace"
      }
    ]
  }
}
```

## 5. 권장 책임 분리

외부 분석기:
- 원본 레퍼런스 구조 해석
- 가능한 경우 `intentSections` 직접 생성
- 모호한 경우 `referenceAnalysis.sections`까지만 제공

Xbridge:
- 계약 입력 정규화
- 계약 입력 검증
- fallback 변환
- DS-aware helper 선택
- Figma compose 실행

## 7. 사전 검증 API

실제 compose 전에 아래 경로로 계약 적합성을 먼저 확인할 수 있습니다.

```json
{
  "ok": true,
  "result": {
    "canCompose": true,
    "errors": [],
    "warnings": [
      {
        "code": "dropped_entries",
        "path": "intentSections",
        "message": "intentSections에서 1개 항목이 계약에 맞지 않아 무시되었습니다."
      }
    ],
    "resolved": {
      "source": "intentSections",
      "sectionCount": 1
    }
  }
}
```

권장 흐름:
1. 외부 분석기 payload 생성
2. `validate_external_compose_input`
3. `canCompose === true` 확인
4. `compose_screen_from_intents`

## 6. 현재 한계

- `intentSections`가 semantic 수준이므로, 실제 팀 라이브러리 key/variant 매핑은 아직 추가 고도화가 필요함
- `referenceAnalysis.sections`는 아직 heuristic 성격이 강함
- 복잡한 테이블, 카드 보드, 프로토타입 구조는 후속 analyzer가 더 정교해져야 함
