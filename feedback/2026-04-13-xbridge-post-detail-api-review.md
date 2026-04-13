# Xbridge Post Detail API Review

Date: 2026-04-13

## Purpose

This note captures follow-up feedback from another implementation agent after the detail-read API stabilization pass.

The earlier feedback said the bridge was connected, but implementation-grade detail reads were unreliable. This follow-up confirms that the latest detail API fixes materially improved the read path.

## Current Assessment

Xbridge has moved from "connected but not trustworthy for detail reads" to "usable for implementation inspection, with observability and UI integration still needing polish."

## Improved Areas

### Health

`/health` remains stable.

The bridge server and Figma plugin session can be observed as alive during implementation workflows.

### Metadata

`get_metadata` remains stable and useful.

It can still serve as the fallback inspection path for structure, coordinates, and XML-style node summaries.

### Component Variant Details

`get_component_variant_details` is now normalized enough to be useful.

The important improvement is that component property definitions are read from the `COMPONENT_SET` path first instead of attempting to read them from variant component nodes directly.

This fixed the practical issue where variant detail inspection often collapsed into an unhelpful failure.

### Instance Details

`get_instance_details` is now useful for implementation work.

Agents can read meaningful instance-level fields such as:

- `layoutMode`
- `itemSpacing`
- `padding`
- `variantProperties`
- `componentProperties`
- current variant state

For the toolbar case, the bridge could read the active instance state, including `status`, `error`, `success`, `active`, and `hovered`.

## Remaining Gaps

### Observability Still Carries Failure History

`/health` and related observability still report `failedTotal`.

This is not necessarily a current failure, but it makes the system look less clean to agents because historical failures and active failures are not easy to distinguish at a glance.

Recommended improvement:

- Split historical counters from recent-window counters.
- Add `recentFailedTotal`, `lastFailureAt`, and `lastFailureCommand`.
- Add a clear `currentReadHealth` summary for implementation APIs.

### Detail APIs Are Not Yet Wired Into Plugin UI

The new detail APIs are available for external agent calls, but the plugin UI itself does not yet use them directly.

That means the current improvement strengthens the bridge contract and agent workflow, but not yet the live in-plugin inspector experience.

Recommended improvement:

- Add a "Selected node detail" panel in the plugin UI.
- Use `get_node_details` or equivalent internal command data for the selected node.
- Show layout, variant, component, and instance fields in a compact inspector card.

### Metadata Fallback Should Stay Explicit

The fallback behavior is now useful, but agents need to know when they are reading full detail versus fallback detail.

Recommended improvement:

- Keep `fallback: true` explicit when fallback is used.
- Include `fallbackReason`.
- Include `detailCompleteness`, for example `full`, `partial`, or `metadata_fallback`.
- Include `safeToImplementFrom: true | false | "partial"`.

## Practical Meaning

The latest fix worked.

For implementation agents, the bridge can now provide meaningful variant and instance data instead of forcing coordinate-only inference.

The remaining work is less about core API existence and more about:

- cleaner health diagnostics
- lower ambiguity in fallback responses
- plugin UI surfacing the same detail data
- regression tests that protect the detail-read path

## Recommended Next Tasks

### P0. Separate Current Failures From Historical Failures

Update observability so agents can quickly distinguish:

- old failures from previous runs
- recent command failures
- currently healthy read APIs

Done when:

- `/health` can report stable current health even if `failedTotal` is non-zero historically.

### P1. Add Detail API Smoke Test Fixtures

Add regression coverage for:

- component set detail reads
- variant component detail reads
- instance detail reads
- metadata fallback response shape

Done when:

- the toolbar case can be tested without manual Figma inspection.

### P1. Add Plugin UI Detail Inspector

Expose detail-read information inside the plugin UI so a user can select a node and see implementation-critical fields directly.

Done when:

- a selected toolbar instance shows layout, padding, gap, variant state, and component property data in the plugin panel.

### P2. Document The New Recommended Inspection Flow

Update agent-facing docs with the current best flow:

1. Check `/health`.
2. Resolve plugin session.
3. Use `/api/pages` when cross-page discovery is needed.
4. Use `get_metadata` for broad structure.
5. Use `get_component_variant_details` for component sets.
6. Use `get_instance_details` for live component usage.
7. Treat `metadata_fallback` as partial but useful.

Done when:

- another agent can inspect a component without reading `server.js` or guessing endpoints.
