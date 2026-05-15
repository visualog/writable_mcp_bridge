이제 충분한 기술 정보를 수집했습니다. 심층 분석 리포트로 정리해드릴게요.분석 리포트를 다이어그램과 함께 정리해드릴게요.---

> 주의: 이 문서는 `공식 자료로 확인된 사실`과 `Buddy의 실제 구현을 추정한 해석`이 함께 섞여 있습니다.
> Figma 플러그인 일반 구조와 Anima의 공개 마케팅 문구는 사실로 볼 수 있지만, Buddy 내부 payload, prompt, action format, codegen 방식은 공개적으로 확인되지 않았습니다.

## Buddy (by Anima) 기술 심층 분석

### 1. 플러그인 기반 구조: Figma Plugin API

Figma Plugin API는 파일에 대한 읽기·쓰기 접근 권한을 모두 제공하며, 레이어의 색상·위치·계층·텍스트 등 속성을 조회하고 수정·생성하는 것이 가능합니다. 또한 외부 Web API(예: Google Maps API 등)도 함께 사용할 수 있습니다.

Buddy는 바로 이 Plugin API 위에 구축된 **에이전틱(Agentic) 플러그인**입니다.

---

### 2. 핵심 실행 아키텍처: 2-파트 샌드박스

Figma 플러그인은 두 개의 분리된 실행 환경으로 구성됩니다. 하나는 Figma 문서에 접근하며 메인 스레드에서 Realms 샌드박스 안에서 실행되는 부분, 나머지 하나는 브라우저 API에 접근하며 `<iframe>` 안에서 실행되는 부분입니다. 이 두 부분은 메시지 패싱(postMessage)을 통해 서로 통신합니다.

Figma가 최종적으로 선택한 샌드박스 솔루션은 QuickJS입니다. QuickJS는 WASM으로 컴파일될 수 있는 소형 JavaScript 엔진으로, 플러그인 아키텍처는 플러그인의 일부를 UI를 표시하는 `<iframe>`에서, 나머지 부분은 Figma 문서에 실제로 읽고 쓸 수 있는 QuickJS 안에서 실행합니다.

| 실행 환경 | 역할 | 접근 권한 |
|---|---|---|
| QuickJS 샌드박스 (메인 스레드) | Figma 노드 트리 Read/Write | Figma Scene O / 브라우저 API X |
| iframe (UI) | 채팅 UI, LLM API 호출 | 브라우저 API O / Figma Scene X |

---

### 3. 파일 읽기 (Read) 방식

Plugin API에서 모든 파일은 노드의 트리(tree of nodes)로 구성되며, 모든 파일의 루트는 `DocumentNode`입니다. `DocumentNode`를 통해 파일의 내용을 탐색하고 접근할 수 있으며, Figma 디자인 파일의 모든 `DocumentNode`에는 파일의 각 페이지를 나타내는 `PageNode`가 포함됩니다.

Buddy가 읽는 정보는 다음과 같이 **추정할 수 있습니다**.

Anima의 공개 설명을 보면 Buddy는 단순한 일반 생성기가 아니라, 사용자의 컴포넌트/변수/오토레이아웃을 활용하는 `design-system-aware` agent를 지향합니다. 다만 실제로 네이밍 컨벤션, 스페이싱 스케일, 컴포넌트 variant를 어떤 깊이로 수집하는지는 공개되지 않았습니다.

따라서 읽기 대상은 최소한 `컴포넌트 구조, 변수, 스타일, 오토레이아웃, 현재 선택 주변 구조`를 포함할 가능성이 높습니다.

---

### 4. 파일 쓰기 (Write) 방식

플러그인 메인 스레드는 Figma의 "scene"(Figma 문서를 구성하는 레이어의 계층)에 접근할 수 있지만 브라우저 API는 사용할 수 없습니다. 반대로 iframe은 브라우저 API에는 접근할 수 있지만 Figma scene에는 접근할 수 없습니다. 메인 스레드와 iframe은 메시지 패싱을 통해 통신합니다.

`figma/ai-plugin-template` 같은 공개 예제에서는 iframe 내부에서 플러그인 코드를 실행시키는 helper가 존재하고, 함수가 문자열화된 뒤 plugin 쪽에서 실행됩니다. 다만 Buddy가 동일하게 동작하는지는 확인되지 않았습니다.

Buddy의 쓰기 흐름은 대략 아래와 비슷할 가능성이 높습니다:
```
LLM 응답 (예: JSON 명령 또는 action plan) 
→ iframe에서 파싱 
→ postMessage로 QuickJS 전달 
→ figma.createFrame() / node.setProperty() 등 실행 
→ 캔버스에 즉시 반영
```

Buddy는 프레임 생성, 컴포넌트 활용, 변수 적용, 오토 레이아웃 설정, 베리언트 빌드, 페이지 재편성 등 Figma 전반에 걸친 작업을 수행할 수 있습니다.

---

### 5. LLM 연결 구조 ("Your LLM of choice")

Buddy는 사용자가 선택한 LLM을 사용하여 캔버스 내에서 실제 디자인을 생성·확장·반복하도록 돕는 AI 디자인 파트너입니다.

이 구조는 중요한 설계 포인트입니다. 다만 Anima의 공개 문구는 오히려 `No API keys or config files`에 가깝기 때문에, 사용자가 자신의 API 키를 직접 넣는 구조라고 단정하면 안 됩니다. 확인된 사실은 `Choose your model`과 `No API keys or config files`가 함께 강조된다는 점입니다.

---

### 6. 빠르고 안정적인 연결의 비결

Anima는 8년간 디자인과 코드의 가교 역할을 하며 170만 설치를 달성한 1위 디자인-투-코드 플러그인입니다. 컴포넌트 관계, 디자인 시스템 로직, 의도와 결과 사이의 미묘한 차이에 대한 이해를 축적해 왔으며, Buddy는 그 구조적 전문성 위에 AI를 결합한 자연스러운 다음 단계입니다.

안정성의 핵심 요소:

1. **배치 처리 최적화 가능성** — LLM이 반환한 action을 묶어 적용하면 round-trip을 줄일 수 있습니다. 다만 Buddy가 실제로 이렇게 구현했는지는 확인되지 않았습니다.
2. **캔버스 반영 지연이 낮을 가능성** — 최종 노드 생성/수정은 Figma 내부 실행 컨텍스트에서 일어나므로 mutation 단계 latency는 낮을 수 있습니다. 하지만 모델 호출과 서버 round-trip까지 포함하면 전체 지연이 `없다`고 말할 수는 없습니다.
3. **디자인 시스템 사전 주입 가능성** — 세션 시작 시 한 번 색인화해 컨텍스트에 넣는 방식은 합리적인 가설이지만 공개 확인은 없습니다.
4. **스트리밍 또는 점진적 진행 표시 가능성** — 모델 응답과 postMessage를 단계적으로 연결해 진행 로그를 보여줄 수는 있지만, Buddy가 실제로 어떤 transport와 rendering 방식을 쓰는지는 확인되지 않았습니다.

---

### 7. 경쟁 차별점 (UI 디자이너 시각)

이것은 원샷(one-shot) 프롬프팅이 아닙니다. 대화형 방식으로, 각 메시지가 이전 메시지 위에 쌓이며 매번 처음부터 다시 시작하는 대신 협업을 지속합니다.

MCP 서버를 활용하면 오토레이아웃 설정, 변수, 라이브러리 컴포넌트를 포함한 실제 디자인 구조를 조작할 수 있는 프로그래밍 방식이 열립니다. 이 문장은 Buddy의 내부 구현 사실이라기보다, xbridge 같은 도구에 적용할 수 있는 설계 시사점으로 읽는 것이 맞습니다.

---

### 창업 관점에서의 인사이트

UI 디자이너로서 이 아키텍처를 이해했다면, 비슷한 구조로 **특정 산업 버티컬(예: 한국형 공공기관 UI 가이드라인 자동 준수 플러그인, 또는 디자인 시스템 감사 에이전트)**을 타깃으로 한 Figma 플러그인 창업이 충분히 현실적입니다. Figma Plugin API는 공개된 표준 API이고, LLM 호출은 외부 API 키로 처리하므로 초기 인프라 비용이 극히 낮습니다.

출처: [Anima Buddy 공식 설명](https://www.animaapp.com/blog/genai/figma-ai-design-agent/), [Figma Plugin API 공식 문서](https://developers.figma.com/docs/plugins/), [Figma 플러그인 시스템 구조 블로그](https://www.figma.com/blog/how-we-built-the-figma-plugin-system/), [GitHub Figma AI Plugin Template](https://github.com/figma/ai-plugin-template)
