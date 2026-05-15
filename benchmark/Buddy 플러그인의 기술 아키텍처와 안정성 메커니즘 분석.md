<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# 실제 작동방식 확인된 내용인거야? 추론 한거야?

솔직하게 말씀드리겠습니다.

***

## 이전 답변의 신뢰도 분류

### ✅ 확인된 사실 (공개 문서 기반)

| 내용 | 근거 |
| :-- | :-- |
| Figma Plugin API가 read/write 모두 지원 | Figma 공식 개발자 문서 |
| `figma.currentPage`, `figma.root.findAll()` 등 API 존재 | Figma 공식 API 레퍼런스 |
| code.ts ↔ ui.html 이 postMessage로 통신하는 구조 | Figma 공식 플러그인 아키텍처 문서 |
| code.ts는 네트워크 불가, ui.html은 figma.* 불가인 샌드박스 구조 | Figma 공식 문서 |
| 현재 화면 UI 상태 (Sonnet 4.6, Design system 토글, Retry 오류 등) | 스크린샷 직접 확인[^1] |
| Anima가 개발사임 | Figma 커뮤니티 플러그인 페이지 |


***

### 🟡 추론한 내용 (Figma Plugin API 일반 원리 + Buddy 마케팅 자료 조합)

| 내용 | 실제 근거 |
| :-- | :-- |
| Buddy가 노드를 JSON으로 직렬화해서 LLM에 전달하는 방식 | **Figma Plugin API의 일반적 패턴**을 Buddy에 적용한 추론. Buddy 내부 코드는 공개되지 않음 |
| LLM이 Plugin API 코드를 생성하고 eval로 실행하는 방식 | Figma MCP의 `use_figma` 도구와 유사 플러그인들의 패턴을 참조한 추론 |
| 디자인 시스템을 LLM 시스템 프롬프트에 주입하는 구체적 코드 | 추론. Anima가 이 방식을 쓴다고 공식 확인된 건 없음 |
| `Retry design system` 오류의 내부 원인 | 추론 (타임아웃/스캔 실패 가능성) |


***

### ❌ 확인 불가능한 영역

- Buddy 플러그인 소스코드는 **비공개** (난독화된 번들)
- Anima 서버와 통신하는 **정확한 payload 구조**
- LLM에 전달되는 **실제 프롬프트/컨텍스트 포맷**
- 코드 생성 방식인지, 아니면 structured output(JSON 명령어)인지

***

**결론적으로**, 이전 답변은 "Figma Plugin API가 어떻게 동작하는가"는 공식 문서 기반의 사실이지만, "Buddy가 구체적으로 어떻게 구현했는가"는 대부분 **합리적인 추론**입니다. 두 가지를 명확히 구분하지 않고 작성한 점은 잘못됐습니다.

정확히 알려면 플러그인 번들을 직접 디컴파일하거나, Anima가 기술 블로그로 내부 구현을 공개하는 경우에만 확인 가능합니다.

<div align="center">⁂</div>

[^1]: https://www.figma.com/design/T2OpQl80MZvjobGFz57VSF/Agent_skill_test?node-id=33023-62\&p=f\&t=9IrpRslKUHwQ8rnj-0

