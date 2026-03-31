# Create Node 설계

## 목표
Add a first-slice `create_node` bridge command that can insert new `FRAME`, `TEXT`, and `RECTANGLE` nodes into a chosen parent in the current Figma file.

## 범위
This slice supports:
- `parentId`
- optional `index`
- `nodeType`: `FRAME | TEXT | RECTANGLE`
- optional `name`
- optional `width`, `height`, `x`, `y`
- optional `characters` for text
- optional `fillColor`, `cornerRadius`, `opacity`

Out of scope for this slice:
- component/instance insertion
- image fills
- stroke/effects/typography beyond text content
- undo support for node creation

## 접근 방식
Use a shared helper to normalize and validate the request shape and defaults. In the plugin runtime, create the raw Figma node, insert it into the requested parent, then reuse existing update paths for styling and geometry where possible.

## 기본값
- `FRAME`: width `160`, height `120`, name `frame`
- `RECTANGLE`: width `160`, height `120`, name `rectangle`
- `TEXT`: width `160`, height `24`, name `text`, characters `New text`

## 안전 규칙
- only allow parents that support `appendChild` / `insertChild`
- reject unsupported node types
- require `characters` handling through font load before assignment
- return a compact created-node payload for verification
