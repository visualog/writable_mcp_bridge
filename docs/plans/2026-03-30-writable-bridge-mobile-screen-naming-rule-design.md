# Mobile Screen Naming Rule 설계

## 목표
Extend `apply_naming_rule` with a mobile-detail-screen preset that produces stable, design-system-friendly names for iOS-like single-screen layouts.

## 제안 rule set
- `mobile-detail-screen`

## 네이밍 모델
Use a reusable outer scaffold first, then specialize common mobile-detail regions.

Important naming rule:
- the layer tree already carries hierarchy
- child names should not repeat parent names
- each node should keep only its local role name
- use full path examples only to describe structure, not as literal layer names

### 화면 스캐폴드
- `screen`
- `header`
- `content`

### 헤더 의미 구조
Inside `screen > header`:
- `status-bar`
- `time`
- `icons`
- `signal`
- `wifi`
- `battery`
- `nav`
- `back-button`
- `icon`
- `more-button`
- `icon`

### 콘텐츠 의미 구조
Inside `screen > content`:
- `media` or `stamp-card`
- `base`
- `pattern-*`
- `cutout-left-*`
- `cutout-right-*`
- `title-group`
- `title`
- `subtitle`
- `date`

## 이 모델을 쓰는 이유
- It keeps the outer structure reusable across mobile screens.
- It preserves implementation-oriented names for common OS chrome like status and nav areas.
- It avoids overfitting to one screen title while still supporting richly structured media blocks.
- It keeps the layer list readable by avoiding repeated path prefixes in every child name.

## 감지 휴리스틱
The preset should work only on explicit screen-like frames and stay preview-first.

### 루트 감지
- top-level frame with portrait-ish aspect ratio
- vertically stacked children
- likely mobile width range

### 헤더 감지
- top-most child group
- contains a small time text or icon strip
- contains one or two circular action buttons or a horizontal nav cluster

### 콘텐츠 감지
- remaining main vertical region below header
- contains a dominant media/art card and a text group

### 미디어 감지
- largest centered visual block in content
- often contains layered rectangles or decorative children

### 타이틀 그룹 감지
- stacked text nodes beneath the media block
- first text becomes `title`
- second text becomes `date` or `subtitle` depending on copy pattern

## 안전 규칙 rules
- preview remains the default
- unmatched nodes stay unchanged
- duplicate target names still skip
- no destructive restructure; rename only

## 범위 of first version
- support simple portrait single-screen detail layouts
- cover status bar, nav, media card, and title/date grouping
- do not attempt deep semantic naming for arbitrary decorative children beyond known media patterns

## 예시 결과
Example tree:
- `screen`
- `header`
- `status-bar`
- `time`
- `icons`
- `nav`
- `back-button`
- `icon`
- `more-button`
- `icon`
- `content`
- `stamp-card`
- `title-group`
- `title`
- `date`
