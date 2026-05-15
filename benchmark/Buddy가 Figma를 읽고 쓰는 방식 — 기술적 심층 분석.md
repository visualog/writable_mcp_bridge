<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

## Buddy가 Figma를 읽고 쓰는 방식 — 기술적 심층 분석

> 주의: 이 문서는 Buddy의 `공개 자료 + 실행 화면 관찰 + Figma 일반 구현 패턴`을 바탕으로 한 설계 해석 문서입니다.
> 특히 `LLM이 어떤 형식의 출력을 반환하는지`, `codegen인지 structured action인지`, `서버와 어떤 프로토콜로 통신하는지`는 공개적으로 확인되지 않았습니다.


***

### 전체 아키텍처 구조(가장 가능성 높은 해석)

```
┌─────────────────────────────────────────────────────┐
│                  Figma Desktop / Web                │
│                                                     │
│  ┌──────────────────┐     postMessage      ┌──────┐ │
│  │   Plugin Sandbox  │◄──────────────────► │  UI  │ │
│  │   (code.ts)       │                     │iframe│ │
│  │   figma.* API     │                     │      │ │
│  └──────────┬────────┘                     └──┬───┘ │
│             │ 직접 접근                         │     │
│        Canvas / Nodes                    HTTPS │     │
└─────────────────────────────────────────────────────┘
                                                │
                                    ┌───────────▼──────────┐
                                    │   Anima 백엔드 서버    │
                                    │ (Claude Sonnet 4.6)  │
                                    └──────────────────────┘
```


***

### 1. READ — 캔버스를 어떻게 읽을 가능성이 높은가

#### (1) Figma Plugin API를 통한 직접 트리 순회

플러그인 샌드박스(code.ts)는 `figma` 글로벌 객체로 전체 문서 노드 트리에 **직접 접근**합니다.[^1]

```typescript
// 현재 페이지의 선택된 노드들
const selection = figma.currentPage.selection;

// 선택된 프레임 전체 트리 순회
function serializeNode(node: SceneNode): object {
  return {
    id: node.id,
    name: node.name,
    type: node.type,               // FRAME, TEXT, RECTANGLE...
    x: node.x, y: node.y,
    width: node.width, height: node.height,
    fills: node.fills,             // 색상, 그라디언트
    effects: node.effects,         // elevation, shadow
    layoutMode: node.layoutMode,   // AUTO_LAYOUT 여부
    children: node.children?.map(serializeNode)
  };
}
```


#### (2) 디자인 시스템 스캔 (Design System 버튼)

현재 화면에서 `Design system` 토글이 활성화된 것이 보이는데, 이 버튼이 하는 일:[^2]

```typescript
// 컴포넌트 라이브러리 전체 스캔
const components = figma.root.findAll(n => n.type === 'COMPONENT');

// Variables / Tokens 읽기
const collections = await figma.variables.getLocalVariableCollectionsAsync();
const variables = await figma.variables.getLocalVariablesAsync();

// 텍스트 스타일
const textStyles = await figma.getLocalTextStylesAsync();

// 컬러 스타일
const paintStyles = await figma.getLocalPaintStylesAsync();
```

이런 정보를 **직렬화된 컨텍스트**로 만들어 모델에 전달할 가능성은 높습니다. 다만 실제 payload 구조는 확인되지 않았습니다. `Retry design system` 오류 역시 실제 스캔 실패일 수는 있지만, 내부 원인은 공식적으로 공개되지 않았습니다.[^2]

#### (3) 이벤트 리스너로 실시간 감지

```typescript
// 유저 선택 변경 감지
figma.on('selectionchange', () => {
  const current = figma.currentPage.selection;
  // → UI iframe에 postMessage로 전달
});

// 문서 변경 감지
figma.on('documentchange', (event) => {
  // 변경된 노드 감지 → 컨텍스트 업데이트
});
```


***

### 2. WRITE — 캔버스에 어떻게 쓸 가능성이 높은가

#### 전체 흐름

```
유저 프롬프트
    ↓
[UI iframe] → postMessage → [code.ts 샌드박스]
                                    ↓
                         Anima 서버로 직렬화된
                         캔버스 컨텍스트 전송
                                    ↓
                         Claude Sonnet 4.6이
                         "Figma Plugin API 코드" 생성
                                    ↓
                         code.ts에서 eval() 실행
                                    ↓
                         figma.* API로 직접 노드 생성/수정
```


#### LLM이 생성하는 코드의 실제 형태

가능한 구현 패턴 중 하나는, 모델이 단순 설명이 아니라 **실행 가능한 Figma 액션 표현**을 반환하는 것입니다. 아래 코드는 Buddy 내부 확인 결과가 아니라, 공개 템플릿과 일반 패턴을 설명하기 위한 예시입니다:[^3]

```typescript
// LLM이 생성하고 실행되는 코드 예시
const frame = figma.createFrame();
frame.name = "Car Card";
frame.resize(360, 240);
frame.cornerRadius = 12;
frame.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];

// Auto Layout 설정
frame.layoutMode = 'VERTICAL';
frame.paddingTop = 16;
frame.paddingLeft = 16;
frame.itemSpacing = 12;

// 기존 컴포넌트 인스턴스 삽입 (디자인 시스템 활용)
const buttonComp = figma.root.findOne(
  n => n.type === 'COMPONENT' && n.name === 'Button/Primary'
);
const buttonInstance = buttonComp.createInstance();
frame.appendChild(buttonInstance);

// 텍스트 노드
const title = figma.createText();
await figma.loadFontAsync(title.fontName as FontName);
title.characters = "Tesla Model S";
frame.appendChild(title);
```


#### postMessage 통신 구조

플러그인은 두 개의 독립된 실행 컨텍스트로 분리되어 있습니다:[^4]

```
code.ts (메인 스레드)           ui.html (iframe)
─────────────────────          ──────────────────
figma.* API 접근 가능    ◄────  window.parent.postMessage({
figma.ui.postMessage({           type: 'RUN_CODE',
  type: 'RESULT',                code: '...' // LLM 생성 코드
  data: serializedCanvas  ────►  prompt: '...'
})                         })
```

**code.ts**는 `figma.*` API에만 접근 가능하고 네트워크 요청 불가
**ui.html**은 네트워크(fetch) 가능하지만 `figma.*` 직접 접근 불가
→ 이 두 컨텍스트가 postMessage로 반드시 통신해야 합니다

***

### 3. 디자인 시스템 통합의 기술적 구현(가능한 방식)

Buddy가 "당신의 버튼, 당신의 카드를 사용한다"고 공개적으로 주장하는 점을 기술적으로 구현하는 방식은 아래와 비슷할 수 있습니다:[^5]

```typescript
// 1. 컴포넌트 목록을 LLM 컨텍스트에 주입
const systemContext = {
  components: components.map(c => ({
    key: c.key,
    name: c.name,           // "Button/Primary/Large"
    variantProps: c.variantGroupProperties
  })),
  variables: variables.map(v => ({
    name: v.name,           // "color/primary/500"
    value: v.valuesByMode
  })),
  textStyles: textStyles.map(s => ({
    name: s.name,           // "Heading/H1"
    fontSize: s.fontSize,
    fontFamily: s.fontName
  }))
};

// 2. LLM 프롬프트에 삽입
const prompt = `
  Available components: ${JSON.stringify(systemContext.components)}
  Available variables: ${JSON.stringify(systemContext.variables)}
  User request: "${userMessage}"
  Generate Figma Plugin API code using these exact components and variables.
`;
```


***

### 4. 보안 샌드박스 제약

Figma는 플러그인 코드를 **격리된 샌드박스**에서 실행합니다:


| 항목 | code.ts | ui.html(iframe) |
| :-- | :-- | :-- |
| `figma.*` API | ✅ 완전 접근 | ❌ 불가 |
| `fetch()` 네트워크 | ❌ 불가 | ✅ 가능 |
| `localStorage` | ❌ 불가 | ✅ 가능 |
| DOM 조작 | ❌ 불가 | ✅ 가능 |
| 파일시스템 | ❌ 불가 | ❌ 불가 |

→ LLM API 호출은 반드시 **iframe에서** 발생하고, 실행은 **code.ts에서** 이루어지는 구조입니다.[^4]

***

### 5. 현재 플러그인 상태 해석(관찰 + 추정)[^2]

| 상태 | 기술적 의미 |
| :-- | :-- |
| `Design system` 토글 ON | 컴포넌트/변수 스캔 활성화 |
| `Retry design system` | 디자인 시스템 관련 스캔 또는 동기화 단계에 실패했을 가능성 |
| `Sonnet 4.6` | Anima가 내부적으로 Claude 계열 모델을 사용하거나 노출하고 있을 가능성 |
| `Only 4 messages left` | 서버사이드 사용량 제한 또는 세션 제한일 가능성 |
| `Vibe Code in` 버튼 | 별도 코드 생성/전환 파이프라인과 연결된 액션일 가능성 |


***

### 핵심 요약

**Read:** `figma.currentPage.selection`을 포함한 현재 문맥을 읽고, 모델이 이해할 수 있는 구조화 컨텍스트로 바꿀 가능성이 높습니다.  
**Write:** 모델이 만든 action 표현을 postMessage를 통해 sandbox 쪽 실행기로 전달할 가능성이 높습니다.  
**Design System:** 컴포넌트·변수·스타일을 어떤 방식으로든 읽어서 모델 판단에 반영할 가능성이 높습니다.

결국 Buddy의 핵심은 **"Figma 캔버스를 모델이 이해할 수 있는 컨텍스트로 바꾸고, 모델의 출력을 다시 Figma 액션으로 실행하는 양방향 변환 레이어"**라고 해석하는 것이 가장 안전합니다.

<div align="center">⁂</div>

[^1]: https://developers.figma.com/docs/plugins/

[^2]: https://www.figma.com/design/T2OpQl80MZvjobGFz57VSF/Agent_skill_test?node-id=33023-62\&p=f\&t=9IrpRslKUHwQ8rnj-0

[^3]: https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/

[^4]: https://blog.rememberlenny.com/2020/09/02/react-figma-plugin-how-to-get-data-from-the-canvas-to-your-app/

[^5]: https://www.animaapp.com/blog/genai/figma-ai-design-agent/
