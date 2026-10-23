# Tasks

Every scenario in the delta spec maps onto one named test, given in the task
that implements it.

## 1. The panel opens only from its address (frontend)

- [x] 1.1 In `ReadinessPanel.tsx`, replace the unconditional `open` with React
  state initialised from `hash === '#readiness'`, synced by `onToggle`, and set
  to true by the existing scroll effect when the fragment arrives (design
  decision 1). Update the component's doc comment.
  - Verify in `ReadinessPanel.test.tsx`: add
    `it('The panel is collapsed by default')` (no `open` attribute without the
    fragment; clicking the heading sets it and shows the missing metrics), and
    extend `it('The panel is opened from its address')` to keep asserting
    `open` and the scroll.
- [x] 1.2 In `BoardPage.tsx`, key `ReadinessPanel` on the shown meeting's id
  (design decision 2).
  - Verify in `ReadinessPanel.test.tsx`: add
    `it('Leaving the panel's address collapses it again')` - open
    `?meeting=…#readiness`, switch to the pulse view and back, assert no
    `open`; reopen, switch meeting to another coming one, assert no `open`.
- [x] 1.3 Make the existing content tests expand the panel first, through a
  helper that clicks the heading (design decision 3): `The panel lists what is
  missing`, `A complete meeting says so`, `The panel stays current`, `reads in
  Polish, with Polish plural forms`, `The addresses are copied`, `Copying
  fails`, `A viewer from outside the team`. Do the same in `BoardPage.test.tsx`
  for `The readiness panel and the item lists name no one` and the panel step of
  `Hidden names stay hidden across views`. `A past meeting has no panel` stays
  as it is.
  - Verify `npm run test -- ReadinessPanel BoardPage` passes.

## 2. The host's journey (e2e)

- [x] 2.1 In `e2e/prepare-a-meeting.spec.ts`, assert after "Check readiness"
  that the panel is expanded (its owing line visible) - this is the scenario
  `Check readiness opens the panel expanded`. Where the journey returns to the
  metrics view after the pulse view, expect the panel collapsed and expand it
  before the remaining assertions on its contents.
  - Verify `npm run test:e2e -- prepare-a-meeting` passes against
    `docker compose up`.

## 3. Integration checks

- [x] 3.1 Run `npm run lint && npm run typecheck && npm run test` in
  `frontend/` and verify all pass with coverage not lower than before.
- [x] 3.2 Update the `meeting-readiness` paragraph of `CLAUDE.md` ("Current
  state") to say the panel opens collapsed and expanded from `#readiness`, and
  verify it reads correctly.

## Workflow follow-up

- Sync the delta into `openspec/specs/meeting-readiness/spec.md` and archive
  the change after review.
