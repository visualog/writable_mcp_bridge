# Mobile Screen Naming Rule Design

## Goal
Extend `apply_naming_rule` with a mobile-detail-screen preset that produces stable, design-system-friendly names for iOS-like single-screen layouts.

## Proposed rule set
- `mobile-detail-screen`

## Naming model
Use a reusable outer scaffold first, then specialize common mobile-detail regions.

Important naming rule:
- the layer tree already carries hierarchy
- child names should not repeat parent names
- each node should keep only its local role name
- use full path examples only to describe structure, not as literal layer names

### Screen scaffold
- `screen`
- `header`
- `content`

### Header semantics
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

### Content semantics
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

## Why this model
- It keeps the outer structure reusable across mobile screens.
- It preserves implementation-oriented names for common OS chrome like status and nav areas.
- It avoids overfitting to one screen title while still supporting richly structured media blocks.
- It keeps the layer list readable by avoiding repeated path prefixes in every child name.

## Detection heuristics
The preset should work only on explicit screen-like frames and stay preview-first.

### Root detection
- top-level frame with portrait-ish aspect ratio
- vertically stacked children
- likely mobile width range

### Header detection
- top-most child group
- contains a small time text or icon strip
- contains one or two circular action buttons or a horizontal nav cluster

### Content detection
- remaining main vertical region below header
- contains a dominant media/art card and a text group

### Media detection
- largest centered visual block in content
- often contains layered rectangles or decorative children

### Title group detection
- stacked text nodes beneath the media block
- first text becomes `title`
- second text becomes `date` or `subtitle` depending on copy pattern

## Safety rules
- preview remains the default
- unmatched nodes stay unchanged
- duplicate target names still skip
- no destructive restructure; rename only

## Scope of first version
- support simple portrait single-screen detail layouts
- cover status bar, nav, media card, and title/date grouping
- do not attempt deep semantic naming for arbitrary decorative children beyond known media patterns

## Example outcome
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
