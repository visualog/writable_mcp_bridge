# Mobile Screen Naming Rule 구현 계획

**목표:** `apply_naming_rule`에 재사용 가능한 `mobile-detail-screen` preset을 추가해, iOS 스타일 상세 화면을 안정적인 짧은 이름 계층으로 바꿀 수 있게 한다.

**구현 방향:** 먼저 런타임 naming-rule planner를 확장하고, 이후 서버 enum과 문서에도 같은 preset을 반영한다. 로직은 preview 우선과 패턴 매핑 방식을 유지하고, 구조 변경은 수행하지 않는다.

**기술 스택:** Node.js ESM, Figma plugin runtime, local HTTP bridge, stdio MCP.

---

### 작업 1: new supported preset 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/figma-plugin/code.js`
- 수정: `/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/src/server.js`

**단계:**
- add `mobile-detail-screen` to supported naming presets
- expose it through MCP and HTTP schema enums

### 작업 2: Implement runtime pattern matching

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/figma-plugin/code.js`

**단계:**
- detect portrait screen roots
- identify header and content sections
- detect status bar and nav rows
- detect media block and title/date group
- emit deterministic rename proposals using local role names only, not repeated full paths

### 작업 3: preview verification workflow 추가

**파일:**
- 수정: `/Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/README.md`

**단계:**
- document when to use `mobile-detail-screen`
- show `previewOnly=true` usage first
- include one example outcome tree with short local names

### 작업 4: Optional tests

**파일:**
- Modify or add test coverage if the repo introduces naming-rule unit tests for the current runtime planner

**단계:**
- validate header/content/media/title grouping behavior
- validate duplicate-name skipping
- validate unmatched decorative nodes stay unchanged

### 작업 5: Verification

**검증 항목:**
- `node --check /Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/src/server.js`
- `node --check /Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge/figma-plugin/code.js`
- run `apply_naming_rule` in preview mode against a connected mobile-detail frame

## 권장 진행 순서
1. implement preset in preview mode only during manual verification
2. validate against the current ticket-detail screen
3. broaden to adjacent mobile layouts only after stable results
