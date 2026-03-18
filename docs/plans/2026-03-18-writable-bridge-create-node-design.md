# Create Node Design

## Goal
Add a first-slice `create_node` bridge command that can insert new `FRAME`, `TEXT`, and `RECTANGLE` nodes into a chosen parent in the current Figma file.

## Scope
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

## Approach
Use a shared helper to normalize and validate the request shape and defaults. In the plugin runtime, create the raw Figma node, insert it into the requested parent, then reuse existing update paths for styling and geometry where possible.

## Defaults
- `FRAME`: width `160`, height `120`, name `frame`
- `RECTANGLE`: width `160`, height `120`, name `rectangle`
- `TEXT`: width `160`, height `24`, name `text`, characters `New text`

## Safety
- only allow parents that support `appendChild` / `insertChild`
- reject unsupported node types
- require `characters` handling through font load before assignment
- return a compact created-node payload for verification
