# Xbridge `src/` Directory Map

작성일: 2026-05-21

## 목적

`src/`는 Xbridge 로컬 브리지의 서버 런타임과 Figma 작업 계획 모듈이 있는 디렉토리다.

큰 역할은 네 가지다.

1. Figma plugin UI/main과 통신하는 localhost HTTP/WS/SSE bridge를 실행한다.
2. Figma canvas read/write 요청을 plugin command로 정규화한다.
3. AI Designer 요청을 intent, read plan, context model, suggestion, write plan으로 변환한다.
4. 디자인 시스템, 컴포넌트, 변수, 레이아웃, handoff 같은 고수준 작업을 작은 실행 단위로 나눈다.

`src/server.js`가 진입점이지만, 모든 기능을 직접 구현하는 파일로 보면 안 된다. 가능하면 아래 모듈을 먼저 확인하고, route wiring이나 runtime 상태가 필요할 때만 `server.js`를 연다.

## 주요 진입점

| 파일 | 역할 |
| --- | --- |
| `server.js` | Node HTTP bridge, SSE/WS transport, plugin session, command queue, REST routes, MCP stdio tool handler를 묶는 런타임 진입점. 현재 책임이 가장 많이 모여 있는 파일이다. |
| `ai-designer-server-contract.js` | server route에서 쓰는 AI Designer/Codex 응답 계약 유틸. Codex status, fallback meta, inspect timeout, AI snapshot, Codex-augmented suggestion bundle을 만든다. |
| `codex-cli-runner.js` | Codex CLI를 structured JSON backend로 실행한다. inspect, suggestion, text rewrite, variant/write preview schema와 process timeout을 관리한다. |
| `command-queue-policy.js` | plugin command polling/WS fallback의 지연 정책, timeout budget clamp 같은 queue 정책 계산을 담당한다. |
| `runtime-session-state.js` | plugin session lifecycle 상태값과 heartbeat/readiness 판단에 쓰이는 상태 정의를 제공한다. |

## AI Designer 계층

| 파일 | 역할 |
| --- | --- |
| `ai-designer-intents.js` | 자연어 요청을 designer intent envelope로 변환한다. selection scope, output expectation, execution policy 같은 상위 의도를 만든다. |
| `ai-designer-context.js` | 선택 노드, focused detail, structure, design-system hints를 모델 입력용 Context Model v1로 조립한다. |
| `ai-designer-read-routing.js` | intent와 context에 따라 어떤 read phase/command가 필요한지 보강한다. |
| `ai-designer-read-executor.js` | read plan의 phase와 command를 실행하고 coverage, warnings, contextModel을 만든다. |
| `ai-designer-suggestions-v2.js` | read 결과를 사용자에게 보여줄 suggestion bundle, findings, recommendations, summary로 변환한다. |
| `ai-designer-suggestions.js` | 이전 세대 suggestion helper. 남아 있는 legacy/compatibility 경로를 확인할 때 본다. |
| `ai-designer-suggestions-loader.mjs` | suggestion fixture 또는 loader 계열 스크립트에서 쓰는 ESM loader. |
| `ai-designer-action-preview.js` | suggestion을 Figma command 후보와 preview bundle로 바꾼다. |
| `ai-designer-fast-path.js` | 선택 텍스트 수정처럼 빠르게 처리할 수 있는 요청을 감지하고 text update draft를 만든다. |
| `ai-designer-api.js` | legacy/local AI provider 설정, provider discovery, model probe, 기존 AI API 호출/검증 유틸이 들어 있다. Codex-first 전환 후에도 legacy config 보관에 쓰인다. |

## Figma Read 모듈

| 파일 | 역할 |
| --- | --- |
| `read-node-details.js` | node/component/instance detail read plan을 만들고 detail payload를 정규화한다. |
| `read-annotations.js` | Figma annotation 읽기 plan과 결과 정규화를 담당한다. |
| `metadata-tree.js` | plugin metadata tree 결과를 selection/page structure summary로 파싱한다. |
| `node-discovery.js` | node search/discovery 관련 plan과 matching helper를 제공한다. |
| `scene-snapshot.js` | 선택/페이지 snapshot을 구조화해 replay나 분석에 쓸 수 있게 만든다. |
| `export-node.js` | Figma node export 요청을 bridge command 형태로 만든다. |
| `file-components.js` | 현재 파일의 component/component set/property 조회를 다룬다. |
| `figma-account.js` | Figma REST 계정/팀/project/file 계열 API helper를 담당한다. |
| `library-assets.js` | Figma REST library component/style/asset 검색과 필터링을 담당한다. |

## Figma Write / Command Plan 모듈

| 파일 | 역할 |
| --- | --- |
| `create-node.js` | create_node command 입력을 검증/정규화하고 Figma node 생성 plan을 만든다. |
| `create-component.js` | 선택 또는 node를 component로 만드는 command plan을 담당한다. |
| `create-component-set.js` | component set 생성/정리 command plan을 담당한다. |
| `create-instance.js` | component key/id 기반 instance 생성 command plan을 만든다. |
| `import-library-component.js` | library component import command를 정규화한다. |
| `apply-style.js` | style apply command plan을 만든다. |
| `bind-variable.js` | variable binding command와 bulk binding 입력을 정규화한다. |
| `set-component-properties.js` | component property 값을 설정하는 command plan을 만든다. |
| `set-variant-properties.js` | instance/component variant property 변경 plan을 만든다. |
| `add-component-property.js` | component property 추가 command plan을 만든다. |
| `edit-component-property.js` | component property 수정 command plan을 만든다. |
| `add-annotation.js` | Figma annotation 추가/bulk 추가 command plan을 담당한다. |
| `section-commands.js` | section move/promote/spacing/naming 같은 section 단위 command helper를 모은다. |
| `naming-rules.js` | layer/node naming rule 적용과 rename 관련 규칙을 담당한다. |
| `replay-snapshot.js` | 저장된 snapshot을 기반으로 recreate/replay command를 만든다. |

## Layout / Compose / Authoring 모듈

| 파일 | 역할 |
| --- | --- |
| `build-layout.js` | layout spec을 Figma node layout command로 변환한다. |
| `compose-screen-from-intents.js` | intent 목록에서 화면 구성 command plan을 만든다. |
| `compose-sections-from-intents.js` | section 단위 compose plan과 layout block을 만든다. |
| `compose-runtime-metrics.js` | compose 실행/검증 metric을 기록하고 report를 만든다. |
| `validate-external-compose-input.js` | 외부 analyzer나 agent가 넘긴 compose input을 검증한다. |
| `external-analyzer-contract.js` | 외부 analyzer와 bridge 사이의 compose/analysis payload 계약을 정의한다. |
| `analyze-reference-selection.js` | 선택된 reference UI를 분석해 layout/style/content 힌트를 만든다. |
| `reference-analysis-to-intents.js` | reference analysis 결과를 compose intent로 변환한다. |
| `analyze-selection-to-compose.js` | 선택 분석에서 compose 실행까지 이어지는 고수준 flow helper다. |
| `fragment-accuracy-report.js` | 생성 fragment와 기대 구조의 정확도/차이를 report한다. |
| `build-finance-summary-mock.js` | finance summary mock 화면 생성용 예제/fixture 성격의 builder다. |

## Design System / Component Reuse 모듈

| 파일 | 역할 |
| --- | --- |
| `design-system-search.js` | 로컬/라이브러리 디자인 시스템 자산 검색을 담당한다. |
| `ds-registry.js` | 디자인 시스템 registry schema와 lookup helper를 제공한다. |
| `ds-registry-loader.js` | registry 파일을 로드하고 normalize한다. |
| `resolve-pattern.js` | 자연어/intent를 reusable design pattern으로 매핑한다. |
| `resolve-component-for-pattern.js` | pattern에 맞는 component 후보를 찾는다. |
| `find-or-import-component.js` | component를 찾고 필요하면 library에서 import하는 flow를 담당한다. |
| `reuse-or-create-component.js` | 기존 component 재사용 또는 새 component 생성 판단/plan을 만든다. |
| `build-screen-from-design-system.js` | 디자인 시스템 자산을 사용해 screen scaffold를 만드는 고수준 builder다. |
| `search-instances.js` | 현재 selection/page에서 instance 사용 현황과 variant 상태를 검색한다. |

## Handoff / Agent 연동 모듈

| 파일 | 역할 |
| --- | --- |
| `plugin-handoff-contract.js` | plugin/local agent handoff payload schema와 validation을 담당한다. |
| `local-handoff-runner.js` | handoff queue 항목을 로컬 agent 실행으로 넘기는 runner다. |

## 기타 파일

| 파일 | 역할 |
| --- | --- |
| `.codex-replace-check` | Codex 작업 중 파일 write/replace 확인용 marker로 보인다. 제품 코드가 아니며 커밋 대상인지 별도 판단이 필요하다. |

## 리팩터링 기준

`src/server.js`를 열어야 하는 경우:

- 새 HTTP route를 연결해야 할 때
- plugin session, command queue, SSE/WS lifecycle을 바꿔야 할 때
- MCP stdio tool handler wiring을 바꿔야 할 때

`src/server.js`를 열기 전에 먼저 봐야 하는 경우:

- AI Designer intent/read/suggestion 문제: `ai-designer-*`
- Codex timeout/schema/process 문제: `codex-cli-runner.js`, `ai-designer-server-contract.js`
- Figma read detail 문제: `read-node-details.js`, `metadata-tree.js`
- write command 입력 문제: 해당 command module
- design-system/component reuse 문제: `design-system-search.js`, `ds-registry*.js`, reuse/import modules

## 현재 구조상 개선 포인트

- `server.js`는 아직 route table, transport, command queue, AI Designer orchestration, MCP handler가 한 파일에 모여 있다.
- 다음 분리 우선순위는 `designer routes -> generic route table -> command queue/transport` 순서가 안전하다.
- timeout/fallback처럼 UI와 server가 함께 의존하는 정책은 `ai-designer-server-contract.js` 같은 계약 모듈에 둬야 drift가 줄어든다.
