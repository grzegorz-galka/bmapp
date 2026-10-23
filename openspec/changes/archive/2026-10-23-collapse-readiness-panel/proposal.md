# Proposal

## Why

The readiness panel opens expanded on every board of a coming meeting, so a
member who came to record values or look at the tiles has to scroll past the
host's checklist first. The panel is the host's tool, reached on purpose
through "Check readiness"; elsewhere it should stay out of the way until asked
for.

## What Changes

- The readiness panel is shown collapsed by default: only its heading, which
  the viewer can open.
- It opens expanded when the board is reached through its address with the
  readiness fragment (`#readiness`) - which is what "Check readiness" on the
  dashboard links to, and what a reload of that address keeps.
- Once shown, the panel opens and closes only at the viewer's hand. Switching
  view or meeting on the board drops the fragment from the address as it does
  today, so the panel comes back collapsed; the collapsed or expanded state is
  not remembered.
- Nothing else about the panel changes: when it is shown, what it lists, the
  copy control and the treatment of hidden names are as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `meeting-readiness`: "The readiness panel" gains that it is shown collapsed
  by default; "The readiness panel has its own address" now says the address
  opens the panel expanded as well as scrolled into view.

## Impact

- Frontend only: `frontend/src/features/board/ReadinessPanel.tsx` (the
  `<details>` loses its unconditional `open`), its tests in
  `ReadinessPanel.test.tsx`, the board tests in `BoardPage.test.tsx` that read
  the panel's contents, and the Playwright journey in
  `e2e/prepare-a-meeting.spec.ts`.
- No API, schema, translation or dependency change. The dashboard's "Check
  readiness" link already carries `#readiness`.
