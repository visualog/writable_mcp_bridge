# Writable Figma MCP Prototype

이 프로젝트는 열려 있는 Figma 파일에 직접 쓰기 작업을 수행할 수 있도록, 로컬 MCP 서버와 Figma 플러그인 브리지를 함께 제공합니다.

## 주요 기능

- stdio 기반 MCP tool 제공
- `http://localhost:3845` 이상의 로컬 HTTP 브리지 유지
- 현재 문서 안에서 Figma 플러그인이 직접 write 작업 실행
- 프레임, 사각형, 텍스트, 오토레이아웃 업데이트, 컴포넌트 프로퍼티 변경 같은 1차 authoring 작업 지원
- `fontFamily`, `fontStyle`, `fontSize`를 통한 텍스트 폰트 업데이트 지원
- 공식 MCP 흐름을 참고한 읽기 도구 추가
  - sparse selection XML: `get_metadata`
  - 토큰/스타일 사용 현황 조회: `get_variable_defs`

## 빠른 시작

1. 브리지 서버를 실행합니다.

```bash
npm start
```

개발 중에는 파일 변경 시 자동 재시작되는 개발 모드를 권장합니다.

```bash
npm run dev
```

2. Figma 데스크탑을 열고 대상 파일에서 `Writable MCP Bridge` 플러그인을 실행합니다.
3. 플러그인 창이 `connected` 상태를 표시할 때까지 열어둡니다.
4. 브리지 상태를 확인합니다.

```bash
curl -s http://127.0.0.1:3846/health
```

5. 연결된 파일에 대해 MCP tool 또는 로컬 HTTP 요청으로 노드를 생성하거나 수정합니다.

브리지가 재시작되면 플러그인 세션이 일시적으로 끊길 수 있습니다. 최신 플러그인 UI는 서버 복구를 감지하면 자동 재연결을 시도하고, 필요하면 `브리지 재연결`과 `세션 재등록` 버튼으로 수동 복구할 수 있습니다.

## 사용 가능한 MCP 도구

- `get_active_plugins`
- `get_selection`
- `get_metadata`
- `get_variable_defs`
- `search_design_system`
- `search_instances`
- `list_text_nodes`
- `search_nodes`
- `snapshot_selection`
- `search_library_assets`
- `recreate_snapshot`
- `search_file_components`
- `list_component_properties`
- `add_component_property`
- `edit_component_property`
- `set_variant_properties`
- `update_text`
- `set_component_property`
- `set_component_properties`
- `bind_variable`
- `apply_style`
- `create_component`
- `create_component_set`
- `preview_changes`
- `rename_node`
- `bulk_rename_nodes`
- `bulk_update_texts`
- `update_node`
- `bulk_update_nodes`
- `create_node`
- `import_library_component`
- `duplicate_node`
- `move_node`
- `move_section`
- `promote_section`
- `normalize_spacing`
- `apply_naming_rule`
- `delete_node`
- `reorder_child`
- `undo_last_batch`
- `compose_screen_from_intents`

## 프로젝트 구조

- `src/server.js`: stdio MCP 서버 + 로컬 HTTP 브리지
- `figma-plugin/manifest.json`: Figma 플러그인 매니페스트
- `figma-plugin/code.js`: 텍스트 읽기/업데이트와 각종 write 작업을 수행하는 플러그인 런타임
- `figma-plugin/ui.html`: 로컬 브리지에 연결하는 플러그인 UI

## Authoring Guidance

Xbridge를 사용해 화면을 생성할 때는 auto-layout 우선 기준을 따른다. 관련 문서는 아래를 참고한다.

- `docs/authoring/figma-authoring-principles.md`
- `docs/authoring/auto-layout-required-checklist.md`
- `docs/authoring/auto-layout-authoring-roadmap.md`
- `docs/authoring/code-to-figma-layout-mapping.md`
- `docs/authoring/layout-helper-schema-draft.md`
- `docs/authoring/ds-aware-canvas-engine.md`
- `docs/authoring/ds-aware-canvas-roadmap.md`
- `docs/authoring/external-analyzer-compose-contract.md`
- `docs/authoring/maturation-plan.md`
- `docs/authoring/maturation-todo.md`

## Devlog Recording

`xlink`가 함께 있는 로컬 작업환경이라면, 브리지 작업 결과를 devlog handoff로 바로 남길 수 있다.

1. payload 초안을 생성한다.

```bash
npm run create:devlog-payload -- --title "dashboard-board helper added"
```

필요하면 `--tag`, `--file`, `--summary`, `--commit`, `--output`을 함께 넣는다.

2. 생성된 payload JSON을 다듬는다.
3. 아래 명령으로 `xlink`의 `record-devlog`를 호출한다.

```bash
npm run record:devlog -- --input /tmp/devlog-payload.json
```

옵션:
- `--source-agent bridge-agent`
- `--target-agent devlog-agent`
- `--sync-agent devlog-agent`
- `--handoff-title "..."`
- `--priority medium`

이 스크립트는 기본적으로 `../figma_skills/xlink`를 찾고, 내부 `xlink` CLI에 위임한다.

참고 파일:
- `scripts/devlog-payload.template.json`
- `scripts/create-devlog-payload.mjs`
- `scripts/record-devlog.mjs`

## 로컬 서버 실행

```bash
npm start
```

자동 재시작이 필요한 개발 모드:

```bash
npm run dev
```

이 프로세스는 동시에 두 역할을 수행합니다.

- Codex용 stdio MCP 서버
- Figma 플러그인용 HTTP 브리지
  - `3845-3849` 범위에서 사용 가능한 첫 번째 localhost 포트를 사용

## Figma 플러그인 로드

1. Figma 데스크탑을 엽니다.
2. `Plugins > Development > Import plugin from manifest`로 이동합니다.
3. `figma-plugin/manifest.json`을 선택합니다.
4. `Writable MCP Bridge` 플러그인을 실행하고 계속 열어둡니다.
5. 매니페스트가 바뀌었다면 다시 import 하거나 플러그인을 재실행해야 새 localhost 허용 포트가 반영됩니다.

## 기본 사용 흐름

1. `npm start`로 로컬 서버를 실행합니다.
2. 대상 Figma 파일에서 플러그인을 실행합니다.
3. Figma에서 프레임을 선택합니다.
4. MCP에서 `list_text_nodes`를 호출해 수정 가능한 텍스트 노드를 확인합니다.
5. 필요에 따라 `update_text`, `rename_node`, `list_component_properties`, `preview_changes` 또는 관련 변형 도구를 `target node id`와 함께 호출합니다.

`list_text_nodes`와 `search_nodes`는 `targetNodeId`가 있으면 그 노드를 루트로 사용하고, 없으면 현재 selection, selection도 없으면 현재 페이지를 기본 루트로 사용합니다. `scope`를 주면 이 동작을 강제로 바꿀 수 있습니다.
- `scope: "auto"`: 기본 동작
- `scope: "current-page"`: selection이 있어도 현재 페이지를 루트로 사용
- `scope: "selection"`: selection 우선
- `scope: "target"`: `targetNodeId`를 우선

파일 안의 다른 페이지를 읽고 싶다면 먼저 `GET /api/pages?pluginId=...` 또는 MCP `list_pages`로 `pageId`를 찾고, 그 값을 `targetNodeId`로 넘기면 됩니다. 현재는 이 방식이 가장 안정적입니다.

```bash
curl -s 'http://127.0.0.1:3846/api/pages?pluginId=page:817:417'

curl -s --json '{
  "pluginId": "page:817:417",
  "targetNodeId": "610:103",
  "maxDepth": 3
}' http://127.0.0.1:3846/api/get-metadata

curl -s --json '{
  "pluginId": "page:817:417",
  "targetNodeId": "610:103",
  "query": "Heading",
  "maxResults": 10
}' http://127.0.0.1:3846/api/search-nodes
```

노드 생성 계열인 `create_node`, `bulk_create_nodes`, `create_instance`는 `parentId`를 생략할 수 있습니다. 플러그인 세션이 현재 페이지를 등록한 상태라면, 브리지는 해당 페이지를 기본 부모로 사용합니다. 빈 selection 상태에서 새 `FRAME`, `RECTANGLE`, `TEXT`, `INSTANCE`를 바로 놓고 싶을 때 유용합니다.

`compose_screen_from_intents`는 semantic intent를 registry-backed helper tree로 바꾼 뒤, 내부적으로 `build_layout`으로 바로 생성합니다. topbar/sidebar/table/dashboard 같은 section intent를 섞어 DS-aware screen 초안을 만들 때 쓰면 됩니다.

`validationMode`를 `strict`로 주면, validator 경고가 있는 payload도 compose를 중단합니다. 외부 분석기 결과를 운영 환경에 넣기 전, 품질 게이트로 사용할 때 유용합니다.

외부 분석기 payload를 먼저 점검하고 싶다면 `validate_external_compose_input`을 쓰면 됩니다. compose를 실제로 실행하지 않고 계약 위반, 누락된 `parentId`, 무시된 section 수를 먼저 확인할 수 있습니다.

validator 응답과 `compose_screen_from_intents.plan.validationReport`는 같은 요약 포맷(`status`, `canCompose`, `errorCount`, `warningCount`, `resolvedSource`, `resolvedSectionCount`)을 제공합니다. 외부 에이전트가 공통 게이트로 재사용하기 쉽도록 맞춰져 있습니다.
`validate_external_compose_input` 응답에는 `validationReport` alias가 함께 제공되고, `compose_screen_from_intents` 응답에는 top-level `validationReport`도 같이 노출됩니다.

```bash
curl -s --json '{
  "pluginId": "page:33023:62",
  "parentId": "33023:62",
  "intentSections": [
    { "intent": "screen/topbar", "title": "Overview" },
    { "title": "Missing intent and will be dropped" }
  ]
}' http://127.0.0.1:3846/api/validate-external-compose-input
```

```bash
curl -s --json '{
  "pluginId": "page:33023:62",
  "parentId": "33023:62",
  "name": "intent-dashboard-demo",
  "validationMode": "strict",
  "sections": [
    {
      "intent": "screen/topbar",
      "title": "Projects"
    },
    {
      "intent": "data/table",
      "density": "compact",
      "columns": ["Task", "Owner"],
      "rows": [["Wireframe", "IR"]]
    }
  ]
}' http://127.0.0.1:3846/api/compose-screen-from-intents
```

`referenceAnalysis`가 이미 있다면 `sections`를 직접 만들지 않고 바로 넘겨도 됩니다. 현재는 `navigation/header/table/summary-cards/list/actions` 같은 분석 section type을 intent section으로 변환합니다.

`referenceAnalysis.sections`는 확장 계약 필드를 지원합니다:
- `density`, `contentDensity`
- `tableColumns` (label/width/align/pattern)
- `tableRowPattern` (media-row, status-chip, progress-bar, avatar-stack, action-menu 등)
- `actionGroups` (group + actions)

```bash
curl -s --json '{
  "pluginId": "page:33023:62",
  "parentId": "33023:62",
  "name": "analysis-derived-dashboard",
  "referenceAnalysis": {
    "sections": [
      { "type": "navigation", "name": "sidebar", "headerTitle": "Workspace" },
      { "type": "header", "name": "topbar", "headerTitle": "Dashboard" },
      { "type": "table", "name": "project-list", "contentTitle": "Projects", "contentBody": "All active work." }
    ]
  }
}' http://127.0.0.1:3846/api/compose-screen-from-intents
```

```bash
curl -s --json '{
  "pluginId": "page:33023:62",
  "parentId": "33023:62",
  "name": "analysis-schema-contract-demo",
  "referenceAnalysis": {
    "sections": [
      {
        "type": "table",
        "name": "project-list",
        "density": "compact",
        "tableColumns": [
          { "key": "task", "label": "Task", "width": 260, "align": "min" },
          { "key": "progress", "label": "Progress", "width": 140, "align": "max" }
        ],
        "tableRowPattern": ["media-row", { "type": "progress-bar" }]
      },
      {
        "type": "actions",
        "name": "footer-actions",
        "actionGroups": [
          {
            "label": "Primary",
            "actions": [{ "label": "Create" }, { "label": "Share" }]
          }
        ]
      }
    ]
  }
}' http://127.0.0.1:3846/api/compose-screen-from-intents
```

외부 분석기가 이미 `intentSections`를 만들었다면, 이제 `compose_screen_from_intents`가 그 값을 그대로 우선 사용합니다. `referenceAnalysis.intentSections`나 top-level `intentSections`를 바로 넘길 수 있습니다.

```bash
curl -s --json '{
  "pluginId": "page:33023:62",
  "parentId": "33023:62",
  "name": "intent-sections-direct",
  "referenceAnalysis": {
    "intentSections": [
      { "intent": "screen/topbar", "title": "Overview" },
      { "intent": "screen/actions", "title": "Footer Actions" }
    ]
  }
}' http://127.0.0.1:3846/api/compose-screen-from-intents
```

`analyze_reference_selection` 응답에는 `intentSections`도 함께 들어갑니다. 그래서 다른 에이전트는 변환 단계를 따로 거치지 않고, 응답의 `intentSections`를 그대로 `compose_screen_from_intents.sections`에 넘기면 됩니다.

`compose_screen_from_intents` 결과의 `plan.composition[]`에는 `componentKey`/`componentVariant` 힌트도 포함됩니다. 외부 에이전트가 후속 DS import/매핑 단계를 자동화할 때 이 값을 그대로 사용할 수 있습니다.

대시보드 레퍼런스 회귀 스모크는 아래 스크립트로 한 번에 실행할 수 있습니다.

```bash
XBRIDGE_PARENT_ID="33023:62" \
XBRIDGE_PLUGIN_ID="page:33023:62" \
npm run smoke:compose-dashboard
```

옵션:
- `--base http://127.0.0.1:3846`
- `--pluginId page:...`
- `--parentId ...`
- `--validationMode strict|lenient`

운영 중 compose 품질/실패 추이를 보려면:

```bash
curl -s http://127.0.0.1:3846/api/compose-metrics
```

fragment 분석 정확도 리포트(정답셋 기반):

```bash
npm run report:fragment-accuracy
```

입출력 경로를 바꾸려면:

```bash
node scripts/report-fragment-accuracy.mjs \
  --input docs/authoring/fragment-golden-set.json \
  --output /tmp/fragment-accuracy-report.json
```

```bash
curl -s --json '{
  "pluginId": "page:817:417",
  "targetNodeId": "3494:1037"
}' http://127.0.0.1:3846/api/analyze-reference-selection

curl -s --json '{
  "pluginId": "page:817:417",
  "parentId": "817:417",
  "name": "analysis-intent-direct",
  "sections": [
    { "intent": "screen/sidebar", "title": "Trackline" },
    { "intent": "screen/topbar", "title": "Dashboard" },
    { "intent": "data/table", "title": "Project List", "columns": ["Name", "Summary"], "rows": [["Item", "Reference-derived row"]] },
    { "intent": "screen/actions", "title": "footer-actions" }
  ]
}' http://127.0.0.1:3846/api/compose-screen-from-intents
```

선택 분석과 compose를 한 번에 하고 싶다면 `analyze_selection_to_compose` 경로를 쓰면 됩니다. 현재 선택 또는 `targetNodeId`를 분석해 `intentSections`를 만들고, 그 결과를 바로 compose까지 이어줍니다.

```bash
curl -s --json '{
  "pluginId": "page:817:417",
  "parentId": "817:417",
  "targetNodeId": "3494:1037",
  "name": "sidebar-direct-compose"
}' http://127.0.0.1:3846/api/analyze-selection-to-compose
```

## HTTP 사용 예시

### `SF Compact Text`로 텍스트 노드 만들기

```bash
curl -s -X POST http://127.0.0.1:3846/api/create-node \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "parentId": "33011:2910",
    "nodeType": "TEXT",
    "name": "SCREEN_TITLE",
    "characters": "切角矩形 16:27:26",
    "fontFamily": "SF Compact Text",
    "fontStyle": "Semibold",
    "fontSize": 28,
    "x": 72,
    "y": 548,
    "width": 214,
    "height": 34
  }'
```

### 현재 페이지에 `parentId` 없이 노드 만들기

```bash
curl -s -X POST http://127.0.0.1:3846/api/create-node \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeType": "RECTANGLE",
    "name": "EMPTY_STATE_CARD",
    "width": 160,
    "height": 64,
    "fillColor": "#2F6BFF",
    "cornerRadius": 16
  }'
```

세션에 현재 페이지가 정상 등록되어 있다면 `parentId`를 넘기지 않아도 현재 페이지에 바로 삽입됩니다.

### 기존 텍스트 노드의 폰트와 내용을 수정하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/update-node \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeId": "33011:2915",
    "characters": "切角矩形 16:27:26",
    "fontFamily": "SF Compact Text",
    "fontStyle": "Semibold",
    "fontSize": 28
  }'
```

### 프레임을 세로 오토레이아웃 컨테이너로 전환하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/update-node \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeId": "33011:2910",
    "layoutMode": "VERTICAL",
    "primaryAxisSizingMode": "AUTO",
    "counterAxisSizingMode": "FIXED",
    "primaryAxisAlignItems": "MIN",
    "counterAxisAlignItems": "CENTER",
    "paddingTop": 24,
    "paddingRight": 20,
    "paddingBottom": 32,
    "paddingLeft": 20,
    "itemSpacing": 28
  }'
```

### 여러 텍스트 노드를 한 번에 업데이트하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/bulk-update-nodes \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "updates": [
      {
        "nodeId": "33011:2915",
        "fontFamily": "SF Compact Text",
        "fontStyle": "Semibold",
        "fontSize": 28
      },
      {
        "nodeId": "33011:2914",
        "fontFamily": "SF Compact Text",
        "fontStyle": "Regular",
        "fontSize": 17
      }
    ]
  }'
```

### 현재 선택의 sparse XML 아웃라인 가져오기

```bash
curl -s -X POST http://127.0.0.1:3846/api/get-metadata \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "targetNodeId": "33011:2910",
    "maxDepth": 3,
    "maxNodes": 120
  }'
```

### 선택 영역에서 사용 중인 변수와 공유 스타일 확인하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/get-variable-defs \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "targetNodeId": "33011:2910",
    "maxDepth": 4,
    "maxNodes": 180
  }'
```

### 로컬 디자인 시스템 검색하기, 필요하면 외부 라이브러리 파일 키도 함께 사용하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/search-design-system \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "file:T2OpQl80MZvjobGFz57VSF",
    "query": "button",
    "includeComponents": true,
    "includeStyles": true,
    "includeVariables": true,
    "fileKeys": ["YOUR_LIBRARY_FILE_KEY"],
    "maxResults": 20
  }'
```

`search_design_system`은 새 입력 모델도 지원합니다.  
`kinds`와 `sources`를 사용하면 “무엇을 찾는지”와 “어디서 찾는지”를 분리해서 더 정확하게 검색할 수 있습니다.

```bash
curl -s -X POST http://127.0.0.1:3846/api/search-design-system \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "file:T2OpQl80MZvjobGFz57VSF",
    "query": "button",
    "kinds": ["components"],
    "sources": ["library-files"],
    "fileKeys": ["YOUR_LIBRARY_FILE_KEY"],
    "maxResults": 20
  }'
```

### 현재 선택 또는 현재 페이지에서 실제 인스턴스 사용 현황 검색하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/search-instances \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "file:T2OpQl80MZvjobGFz57VSF",
    "query": "button",
    "maxDepth": 5,
    "maxResults": 20,
    "includeProperties": true
  }'
```

### 지원되는 속성에 변수 바인딩 또는 해제하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/bind-variable \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeId": "33011:2910",
    "property": "fills.color",
    "variableId": "VariableID:2611:99"
  }'
```

### 여러 컴포넌트 프로퍼티를 한 번에 바꿔 atomic variant 전환하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/set-component-properties \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeId": "33041:937817",
    "properties": {
      "item1": "false",
      "item2": "true"
    }
  }'
```

### 로컬 컴포넌트나 component set에 새 property 추가하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/add-component-property \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "targetNodeId": "33041:937817",
    "propertyName": "isOpen",
    "propertyType": "BOOLEAN",
    "defaultValue": true
  }'
```

### 기존 component property 이름이나 기본값 수정하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/edit-component-property \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "targetNodeId": "33041:937817",
    "propertyName": "ButtonText#0:1",
    "name": "Label",
    "defaultValue": "Submit"
  }'
```

### component set 안의 컴포넌트에 variant 값 지정하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/set-variant-properties \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "componentNodeId": "33041:937817",
    "variantProperties": {
      "State": "Active",
      "Size": "M"
    }
  }'
```

### 공유 스타일 적용 또는 해제하기

```bash
curl -s -X POST http://127.0.0.1:3846/api/apply-style \
  -H 'Content-Type: application/json' \
  -d '{
    "pluginId": "page:33023:62",
    "nodeId": "33011:2915",
    "styleType": "text",
    "styleId": "StyleID:2611:120"
  }'
```

## 추천 authoring 방식

- 탐색 위주의 읽기에는 필요에 따라 공식 Figma MCP를 함께 사용합니다.
- 실제 write 작업은 이 브리지를 우선 사용합니다.
- `snapshot_selection`보다 가벼운 구조 확인이 필요할 때는 `get_metadata`를 사용합니다.
- 현재 캔버스에서 토큰/공유 스타일 사용 현황을 볼 때는 `get_variable_defs`를 사용합니다.
- `search_design_system`으로 로컬 컴포넌트, 로컬 스타일, 로컬 변수, 필요 시 REST 기반 라이브러리 메타데이터를 한 진입점에서 찾습니다.
- 색상을 직접 하드코딩하기보다 `bind_variable`로 재사용 가능한 로컬/가져온 변수를 연결합니다.
- 로컬 override를 만들기 전에 `apply_style`로 공유 텍스트/이펙트 스타일을 우선 재사용합니다.
- 화면은 점진적으로 조립하는 것을 권장합니다.
  1. 래퍼 프레임 생성
  2. 컨테이너를 오토레이아웃 프레임으로 전환
  3. 명시적인 폰트 설정으로 텍스트 노드 생성
  4. 이후 라이브러리 컴포넌트 배치와 토큰 바인딩으로 발전

화면 작업에서는 임의 스크립트 실행보다 `명령형 mutation` 흐름을 우선하세요.  
이 브리지는 범용 원격 코드 실행기보다 안정적인 authoring layer로 성장하는 것을 목표로 합니다.

## 멀티 파일 세션

플러그인이 여러 Figma 파일에서 동시에 열려 있으면, 각 파일은 file key 기반의 별도 브리지 세션으로 등록됩니다.  
`get_active_plugins`로 사용 가능한 `pluginId`를 확인하고, 소스 파일과 타깃 파일을 오갈 때는 원하는 `pluginId`를 명시적으로 넘기는 것을 권장합니다.

## 선택적 Figma REST 접근

현재 페이지 트리에 없는 published library 컴포넌트, component set, 스타일을 읽으려면 브리지를 시작하기 전에 Figma personal access token을 설정하세요.

```bash
export FIGMA_ACCESS_TOKEN=...
npm start
```

macOS Keychain을 쓰고 싶다면 토큰을 한 번만 저장한 뒤 Keychain에서 읽어 시작할 수 있습니다.

```bash
npm run set:keychain-token -- YOUR_TOKEN
npm run start:keychain
```

`set:keychain-token`은 `writable-mcp-bridge/figma-access-token` 항목으로 토큰을 저장하고, `start:keychain`은 그 값을 읽어 `FIGMA_ACCESS_TOKEN`으로 브리지를 실행합니다.

같은 토큰을 사용하면 계정 기반 REST 조회도 일부 가능합니다.
- `get_figma_account_profile`
- `list_team_projects`
- `list_project_files`
- `get_file_summary`

현재 브리지는 열린 파일 바깥까지 계정 파일을 자동 탐색하지는 않습니다. Figma REST 제약상 팀 ID는 별도로 알아야 하므로, 이 경로는 보통 `teamId -> projectId -> fileKey` 순서로 사용합니다.

```bash
curl -s http://127.0.0.1:3846/api/figma/me

curl -s 'http://127.0.0.1:3846/api/figma/team-projects?teamId=YOUR_TEAM_ID'

curl -s 'http://127.0.0.1:3846/api/figma/project-files?projectId=YOUR_PROJECT_ID'

curl -s 'http://127.0.0.1:3846/api/figma/file-summary?fileKey=YOUR_FILE_KEY'
```

그 다음 `search_library_assets`에 라이브러리 파일 키를 넘기면 됩니다.  
브리지는 `/v1/files/:file_key/components`, `/component_sets`, `/styles` 같은 공식 Figma REST 엔드포인트를 조회한 뒤, 결과를 로컬에서 필터링해 Codex에 맞게 제공합니다.

published component 또는 component-set의 `key`를 확보하면, `import_library_component`에 대상 `parentId`를 넣어 현재 문서에 인스턴스를 배치할 수 있습니다.

Community 파일이나 published library key 대신 로컬 컴포넌트를 노출하는 소스 파일의 경우에는 `search_file_components`를 사용해 파일 컴포넌트 메타데이터를 확인할 수 있습니다. 이 경우에도 같은 Figma personal access token이 필요합니다.

같은 파일 안의 로컬 컴포넌트로 `create_instance`를 호출할 때도 `parentId`를 생략할 수 있습니다. 이 경우에도 현재 플러그인 세션의 페이지가 기본 부모가 됩니다.

## 파일 간 복제 워크플로

published library component로 가져올 수 없는 레이아웃은 아래 흐름으로 복제할 수 있습니다.

1. 소스 파일에서 플러그인을 실행합니다.
2. 대상 파일에서도 플러그인을 실행합니다.
3. 소스 세션에 대해 `snapshot_selection`을 호출합니다.
4. 대상 세션에 대해 `recreate_snapshot`을 호출하고 `target parent`를 지정합니다.

현재 1차 구현에서는 `FRAME`, `GROUP`, `RECTANGLE`, `TEXT` 구조를 직접 재생성하고, `INSTANCE` 노드는 placeholder frame으로 변환합니다.

## 참고 사항

- 이 프로토타입은 텍스트 노드 업데이트, 노드 이름 변경, 가시성 변경, 단색 fill 적용, corner radius 및 opacity 변경, 1차 노드 생성(`FRAME`, `TEXT`, `RECTANGLE`), 노드 복제, 부모 변경 이동, 노드 삭제, 자식 재정렬, 컴포넌트 프로퍼티 조회, 안전한 범위의 오토레이아웃 속성 업데이트를 지원합니다.
- 텍스트 노드 생성과 노드 업데이트는 `fontFamily`, `fontStyle`, `fontSize`를 지원합니다.
- `search_nodes`는 프레임, 섹션, 인스턴스를 이름 기준으로 빠르게 찾기 위한 가벼운 page-tree 탐색 도구입니다. 느린 전체 텍스트 탐색을 피하고 싶을 때 유용합니다.
- `get_metadata`는 공식 Figma MCP의 sparse XML 흐름을 참고해, 현재 selection, 명시적 target, 또는 selection이 없을 때 전체 페이지에 대해 구조를 반환합니다.
- `get_variable_defs`는 공식 Figma MCP의 token inspection 흐름을 참고해, 현재 selection, 명시적 target, 또는 selection이 없을 때 전체 페이지 기준으로 bound variable과 applied shared style을 보고합니다.
- `search_design_system`은 공식 Figma MCP의 검색 흐름에 대응하는 브리지 도구입니다. 열린 파일의 로컬 컴포넌트, 로컬 공유 스타일, 로컬 변수를 검색하고, `FIGMA_ACCESS_TOKEN`과 `fileKeys`가 있으면 외부 라이브러리/파일 검색 결과도 병합할 수 있습니다.
- `search_instances`는 정의 검색과 분리된 실제 사용 탐색 도구입니다. 현재 selection, 명시적 target, 또는 현재 페이지에서 인스턴스와 variant 상태를 확인할 수 있습니다.
- `snapshot_selection`은 열린 파일 한 곳의 제한된 subtree를 직렬화해 다른 파일에서 재생성할 수 있게 합니다.
- `search_library_assets`는 published library asset 탐색용 서버 사이드 도구이며 `FIGMA_ACCESS_TOKEN`이 필요합니다.
- `recreate_snapshot`은 직렬화된 subtree를 다른 연결된 파일에 재생성합니다.
- `search_file_components`는 파일 단위 컴포넌트 메타데이터를 확인하는 도구로, 특히 import 가능한 라이브러리로 publish되지 않은 Community 파일에서 유용합니다.
- `import_library_component`는 published component 또는 component set을 key로 현재 문서에 가져와 대상 부모에 인스턴스를 삽입합니다.
- `create_component`는 현재 파일의 기존 노드를 로컬 컴포넌트로 승격합니다. 1차 구현에서는 `FRAME`, `GROUP`, `COMPONENT`를 대상으로 하며, `INSTANCE`와 `COMPONENT_SET`은 제외합니다.
- `create_component_set`은 기존 로컬 `COMPONENT` 노드 두 개 이상을 묶어 component set으로 만듭니다. 1차 구현에서는 이미 컴포넌트인 노드만 입력으로 받습니다.
- `add_component_property`는 로컬 `COMPONENT` 또는 `COMPONENT_SET`에 `BOOLEAN`, `TEXT`, `VARIANT` property를 추가합니다.
- `edit_component_property`는 로컬 `COMPONENT` 또는 `COMPONENT_SET`의 기존 property 이름을 바꾸거나 기본값을 수정합니다. `VARIANT`는 이름 변경만 지원하고 기본값 수정은 허용하지 않습니다.
- `set_variant_properties`는 `COMPONENT_SET` 안에 있는 개별 `COMPONENT`의 variant 값을 지정합니다. 현재 1차 구현은 컴포넌트 이름을 안전하게 재구성하는 방식으로 동작합니다.
- `bind_variable`은 로컬 variable id 또는 가져온 variable key를 사용해 지원되는 단순 속성과 `fills.color` / `strokes.color`에 바인딩 또는 해제를 수행합니다.
- `apply_style`은 로컬 style id 또는 가져온 style key를 사용해 `text`와 `effect` 공유 스타일을 적용하거나 해제합니다.
- `move_section`은 low-level `move`와 `reorder`를 직접 고르지 않고도 컨테이너 성격의 노드를 의미적으로 이동/재정렬할 수 있는 helper입니다.
- `promote_section`은 섹션 성격의 노드를 컨테이너 계층에서 앞쪽으로 끌어올리고, 필요하면 목적지 spacing까지 정리할 수 있는 helper입니다.
- `normalize_spacing`은 오토레이아웃 컨테이너와 필요 시 그 하위 컨테이너 subtree에 명시적인 gap/padding 값을 적용하는 helper입니다.
- `apply_naming_rule`은 알려진 subtree 패턴에 대해 slash-and-kebab-case 기반의 결정적 rename plan을 미리보기 또는 적용하는 helper입니다.
- 지원되는 naming preset에는 기존 app/header/tab/card/fab 외에도 일반적인 스캐폴딩(`content-screen-basic`)과 AI 화면용 의미 구조(`ai-chat-screen`)가 포함됩니다.
- 컴포넌트 프로퍼티 수정은 `set_component_property`와 `set_component_properties`를 통해 지원합니다. 특히 variant set 조합 변경은 `set_component_properties`를 권장합니다.
- `preview_changes`는 non-mutating 도구이며, 지원되는 노드 업데이트에 대해 before/after snapshot만 반환합니다.
- `undo_last_batch`는 현재 플러그인 세션에서 마지막 text update, node rename, variable binding, style apply, `update_node` / `bulk_update_nodes` 배치만 되돌릴 수 있습니다.
- 지원되는 오토레이아웃 필드:
  - `layoutMode`
  - `itemSpacing`
  - `paddingLeft`
  - `paddingRight`
  - `paddingTop`
  - `paddingBottom`
  - `primaryAxisAlignItems`
  - `counterAxisAlignItems`
  - `primaryAxisSizingMode`
  - `counterAxisSizingMode`
  - `layoutGrow`
  - `layoutAlign`
- 텍스트 업데이트 전에는 해당 노드에서 사용 중인 폰트를 먼저 로드합니다.
- `fontFamily`나 `fontStyle`로 새 폰트를 지정하면, 플러그인이 먼저 해당 폰트를 로드한 뒤 적용합니다.
- 플러그인이 열려 있지 않으면 write 도구는 30초 후 timeout 됩니다.
- 향후 library-variable 워크플로를 위해 플러그인 매니페스트에는 `teamlibrary` 권한이 포함되어 있습니다.
- 플러그인은 `http://localhost:3845`부터 `http://localhost:3849`까지 순서대로 검사해, 가장 먼저 응답하는 건강한 브리지 origin에 연결합니다.
- 다음 단계로 구조화된 calendar-cell 업데이트가 필요하다면, `bulk_update_texts` 위에 더 고수준의 tool을 얹어 구현하는 것이 좋습니다.
