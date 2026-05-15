# Buddy 벤치마크 문서 안내

이 폴더는 `Buddy - Figma AI Agent, UX UI Co-Pilot`를 벤치마킹해 `xbridge`에 적용하기 위한 조사 문서를 모아둔 곳입니다.

중요한 점은, 이 폴더의 문서들이 모두 같은 신뢰도를 갖지 않는다는 것입니다. 일부는 `공식 자료와 관찰을 분리해서 쓴 문서`이고, 일부는 `설계 아이디어를 넓게 상상한 문서`입니다.  
따라서 이 폴더는 아래 순서로 읽는 것이 안전합니다.

## 읽는 순서

1. [Buddy 플러그인의 기술 아키텍처와 안정성 메커니즘 분석.md](./Buddy%20%ED%94%8C%EB%9F%AC%EA%B7%B8%EC%9D%B8%EC%9D%98%20%EA%B8%B0%EC%88%A0%20%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98%EC%99%80%20%EC%95%88%EC%A0%95%EC%84%B1%20%EB%A9%94%EC%BB%A4%EB%8B%88%EC%A6%98%20%EB%B6%84%EC%84%9D.md)
2. [xbridge-buddy-fact-checklist.md](./xbridge-buddy-fact-checklist.md)
3. 나머지 심층 분석 문서들

## 문서별 신뢰도 라벨

### A. 기준 문서

- [Buddy 플러그인의 기술 아키텍처와 안정성 메커니즘 분석.md](./Buddy%20%ED%94%8C%EB%9F%AC%EA%B7%B8%EC%9D%B8%EC%9D%98%20%EA%B8%B0%EC%88%A0%20%EC%95%84%ED%82%A4%ED%85%8D%EC%B2%98%EC%99%80%20%EC%95%88%EC%A0%95%EC%84%B1%20%EB%A9%94%EC%BB%A4%EB%8B%88%EC%A6%98%20%EB%B6%84%EC%84%9D.md)

이 문서는 `확인된 사실 / 추론 / 확인 불가`를 분리하고 있어서, 앞으로 Buddy 관련 논의의 기준점으로 삼기에 가장 안전합니다.

### B. 설계 힌트 문서

- [Buddy가 Figma를 읽고 쓰는 방식 — 기술적 심층 분석.md](./Buddy%EA%B0%80%20Figma%EB%A5%BC%20%EC%9D%BD%EA%B3%A0%20%EC%93%B0%EB%8A%94%20%EB%B0%A9%EC%8B%9D%20%E2%80%94%20%EA%B8%B0%EC%88%A0%EC%A0%81%20%EC%8B%AC%EC%B8%B5%20%EB%B6%84%EC%84%9D.md)
- [Buddy (by Anima) 기술 심층 분석.md](./Buddy%20%28by%20Anima%29%20%EA%B8%B0%EC%88%A0%20%EC%8B%AC%EC%B8%B5%20%EB%B6%84%EC%84%9D.md)
- [deep-research-report.md](./deep-research-report.md)
- [기술 심층 분석-코덷스-사이드채팅에서.md](./%E1%84%80%E1%85%B5%E1%84%89%E1%85%AE%E1%86%AF%20%E1%84%89%E1%85%B5%E1%86%B7%E1%84%8E%E1%85%B3%E1%86%BC%20%E1%84%87%E1%85%AE%E1%86%AB%E1%84%89%E1%85%A5%E1%86%A8-%E1%84%8F%E1%85%A9%E1%84%83%E1%85%A6%E1%86%AE%E1%84%89%E1%85%B3-%E1%84%89%E1%85%A1%E1%84%8B%E1%85%B5%E1%84%83%E1%85%B3%E1%84%8E%E1%85%A2%E1%84%90%E1%85%B5%E1%86%BC%E1%84%8B%E1%85%A6%E1%84%89%E1%85%A5.md)

이 문서들은 제품 방향과 엔진 아이디어를 얻는 데는 유용하지만, `Buddy의 실제 내부 구현`을 확정적으로 보여주는 자료로 쓰면 위험합니다.

## 이 폴더를 읽을 때 지킬 규칙

1. `공식 문서로 확인된 사실`과 `합리적 추정`을 섞어 읽지 않는다.
2. `Buddy가 실제로 이렇게 구현되었다`고 쓰기 전에 반드시 출처를 다시 확인한다.
3. `xbridge에 가져올 것`은 제품 경험과 구조이고, `복제`는 목표가 아니다.
4. 공식 근거가 없는 문장은 `Buddy 사실`이 아니라 `xbridge 설계 가설`로 취급한다.

## 현재 결론

이 자료 묶음에서 가장 안정적으로 가져갈 수 있는 결론은 아래 다섯 가지입니다.

- Buddy는 `canvas-native` 작업 에이전트를 지향한다.
- Buddy는 `design-system-aware`를 핵심 가치로 둔다.
- Buddy의 강점은 채팅이 아니라 `작업 로그 / 결과 요약 / 후속 액션` 경험에 있다.
- xbridge도 `Context Model -> Action Plan -> Executor -> Verifier` 구조로 가는 것이 맞다.
- UI보다 먼저 엔진을 `selection-local + bounded detail + DS-aware`로 강화해야 한다.

## source note

이 폴더의 문서는 주로 아래 공개 자료를 바탕으로 정리되었습니다.

- [Anima Buddy 소개](https://animaapp.com/blog/product-updates/ai-design-agent-for-figma-design-with-ai-in-canvas/?source=user_profile---------6----------------------------)
- [Figma Plugins: How Plugins Run](https://developers.figma.com/docs/plugins/how-plugins-run/)
- [Figma postMessage](https://developers.figma.com/docs/plugins/api/properties/figma-ui-postmessage/)
- [figma/ai-plugin-template](https://github.com/figma/ai-plugin-template)
- [Figma MCP: write to canvas](https://developers.figma.com/docs/figma-mcp-server/write-to-canvas/)
