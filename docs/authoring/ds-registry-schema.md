# DS Registry Schema

`DS registry` is the bridge between Xbridge's generic helper layer and a team's real design system knowledge.

It answers:
- Which helper pattern should be used for a section?
- Which default spacing, padding, fill, and text styling should that pattern use?
- Which variant should be selected for a given tone, density, or intent?

## Top Level Shape

```json
{
  "version": 1,
  "patterns": {
    "status-chip": {
      "kind": "helper",
      "helper": "status-chip",
      "tokens": {},
      "defaults": {},
      "variants": {}
    }
  }
}
```

## Pattern Entry

Each pattern entry may contain:

- `kind`
  - usually `helper`
- `helper`
  - the Xbridge helper this entry configures
- `defaults`
  - base values to use when the request does not override them
- `tokens`
  - semantic token references or normalized design-system values
- `variants`
  - named overrides for tone, density, or intent

## Example: status-chip

```json
{
  "kind": "helper",
  "helper": "status-chip",
  "defaults": {
    "gap": 6,
    "padding": { "x": 8, "y": 4 },
    "radius": 8,
    "fontSize": 12,
    "tone": "neutral"
  },
  "tokens": {
    "text": "#69707D",
    "fill": "#F5F6FA"
  },
  "variants": {
    "urgent": {
      "tokens": {
        "text": "#EB5757",
        "fill": "#FFF1F1"
      }
    },
    "normal": {
      "tokens": {
        "text": "#16B286",
        "fill": "#F1FFFA"
      }
    },
    "low": {
      "tokens": {
        "text": "#69707D",
        "fill": "#F5F6FA"
      }
    }
  }
}
```

## Example: toolbar

```json
{
  "kind": "helper",
  "helper": "toolbar",
  "defaults": {
    "widthMode": "fill",
    "heightMode": "hug",
    "gap": 16,
    "leftGap": 12,
    "rightGap": 10,
    "justify": "space-between",
    "padding": 0
  }
}
```

## Example: data-table

```json
{
  "kind": "helper",
  "helper": "data-table",
  "defaults": {
    "gap": 12,
    "headerGap": 12,
    "rowsGap": 10,
    "rowGap": 12,
    "showRowDividers": true,
    "showTopDivider": false
  },
  "variants": {
    "comfortable": {
      "defaults": {
        "rowGap": 12,
        "rowsGap": 10
      }
    },
    "compact": {
      "defaults": {
        "rowGap": 8,
        "rowsGap": 8
      }
    }
  }
}
```

## Resolution Rules

Resolution priority:
1. explicit request values
2. resolved pattern variant values
3. base pattern defaults
4. helper hardcoded fallback

Variant resolution is helper-specific:
- `status-chip`: by `tone`
- `data-table`: by `density`
- `toolbar`: base defaults only for now

## Initial Scope

First registry-aware helpers:
- `status-chip`
- `toolbar`
- `data-table`

Next likely entries:
- `sidebar-nav`
- `browser-chrome`
- `progress-bar`
- `avatar-stack`
- `app-shell`
