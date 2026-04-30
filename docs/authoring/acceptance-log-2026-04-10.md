# Acceptance Log (2026-04-10)

## Scope

- repo: `writable_mcp_bridge`
- branch: `feature/auto-layout-authoring-foundation`
- linked repo: `figma_skills/xlink` (`main`)

## 1) Test Pass

- `npm --prefix /Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge test`
  - result: `184 passed, 0 failed`
- `npm --prefix /Users/im_018/Documents/GitHub/2026_important/figma_skills/xlink test`
  - result: `8 passed, 0 failed`

## 2) Restart + Runtime Smoke Reproduction

- Bridge + coordinator were restarted.
  - bridge: `npm --prefix /Users/im_018/Documents/GitHub/2026_important/figma_skills/xbridge start`
  - xlink: `npm --prefix /Users/im_018/Documents/GitHub/2026_important/figma_skills/xlink start`
- Health checks:
  - `GET http://127.0.0.1:3846/health` => `ok: true`
  - `GET http://127.0.0.1:3850/health` => `ok: true`
- Session check:
  - `GET http://127.0.0.1:3846/api/sessions` => active plugin sessions visible
- Compose smoke (runtime write path):
  - `POST /api/compose-screen-from-intents` with `pluginId=page:817:417`, `parentId=817:417`
  - result: `ok: true`, root created (`root.id` returned), `validationReport.status=pass`
- xlink↔xbridge integration smoke:
  - `POST /handoffs/handoff_2026_04_09_002/xbridge-validate`
  - result: `validationReport.status=warn`, projection returned, retry metadata returned

## 3) README-based 10-min onboarding viability

Validated minimal onboarding path by running README-described core flow:

1. start services
2. health/session/pages checks
3. xbridge validation call
4. compose call

Observed result:

- external agent can invoke the contract path without server code inspection
- wrong route confusion (`/api/metadata`, `POST /`) avoided by fixed endpoint sequence
- practical first success is reproducible in a short run
