# Tasks

Every scenario in the delta specs maps onto one named test, given in the task
that implements it.

## 1. The recording view as a table

- [x] 1.1 Rewrite `RecordingView.tsx` as a `<table>` per design D1 and D3: a header row (Metric, Value, Status, Comment, the state column), one `<tr>` per metric with the unit, threshold and previous number in the metric cell, the same columns for read-only rows of a frozen meeting; keep the correction reason above the table and the save-on-leaving behaviour unchanged. Add the new captions (the "Metric" header and the state column's hidden caption) to `en.ts` and `pl.ts`. Verify `npm run typecheck`.
- [x] 1.2 Name every field from the metric per design D2 (`recording.valueLabel`, `recording.commentLabel`, `recording.statusLabel` as the toggle's hidden legend) and drop the per-row visible captions. Verify in `RecordingView.test.tsx` with `it('Each field is named after its metric')`.
- [x] 1.3 Style the table in `board.module.css` so the columns align and the comment takes the remaining width, and stack each row as a labelled card below 40rem by CSS only (design D4, `data-label` captions from the catalogue). Verify in `RecordingView.test.tsx` with `it('The fields line up in columns')` (the table, its four headers and each row's fields in their cells) and `it('A narrow screen stacks each metric')` (each cell carries its column's caption as `data-label`).
- [x] 1.4 Add `it('A frozen meeting uses the same columns')` to `RecordingView.test.tsx`, and rename the existing tests that implement this requirement's earlier scenarios to the scenario names - `it('A number is typed in the Polish format')`, `it('A frozen meeting is read-only')` - moving any `getByLabel` on a bare caption to the metric-named label; verify the whole file passes.
- [x] 1.5 Extend `e2e/record-meeting-metrics.spec.ts`: the recording view is a table whose value fields share one left edge across rows at 1280px, and at a 375px viewport the page does not scroll sideways; verify the flow passes against `docker compose up`.

## 2. Registering a team in a section of the teams page

- [x] 2.1 In `TeamsPage.tsx`, replace `RegisterDialog`'s `Modal` with a disclosure per design D5: "Register team" with `aria-expanded`/`aria-controls`, a `<section>` rendered below the button row while open, focus to the name field on open, back to the button on close; success, Cancel and Escape close and unmount it; a rejection keeps it open with the typed values. Verify `npm run typecheck`.
- [x] 2.2 In `TeamsPage.test.tsx`, replace the `describe('A team is registered from a dialog')` block with `describe('A team is registered from a section of the teams page')` holding `it('The form is hidden until asked for')`, `it('The form opens in the page')` (no `dialog` role, `aria-expanded="true"`, focus on the name), `it('A team is registered from the section')`, `it('A rejection keeps the section open')` and `it('Cancelling closes the section')` (Cancel and Escape); verify they pass.
- [x] 2.3 Update `e2e/register-a-team.spec.ts` (and any other flow that registers a team through the UI, e.g. `manage-team-members.spec.ts`) to fill the fields in the page section instead of `getByRole('dialog')`; verify the flows pass against `docker compose up`.

## 3. Adding a global metric from a dialog

- [x] 3.1 In `GlobalMetricsPage.tsx`, remove the always-visible `MetricForm` and open it in `components/Modal.tsx` from an "Add global metric" button, as `MetricSettingsPage.tsx` does for "Create new metric" (design D6): closed on success, kept open with the reason beside the name on a rejection. Add the button's caption to both catalogues if it is new. Verify `npm run typecheck`.
- [x] 3.2 In `GlobalMetricsPage.test.tsx`, add `it('The add form is hidden until asked for')`, `it('A global metric is added from the dialog')` and `it('A rejection keeps the dialog open')`, rename `'shows the catalogue with unit, direction, threshold, retirement and boards'` to `it('The catalogue is shown')`, and move the existing add tests into the dialog; verify the file passes.
- [x] 3.3 Update `e2e/global-metrics.spec.ts` to add the global metric through the dialog; verify the flow passes against `docker compose up`.

## 4. Convention and gates

- [x] 4.1 Restate the dialog convention in `CLAUDE.md` (design D7): add forms open in `components/Modal.tsx`, except registering a team (a section of the teams page) and adding a member (an always-visible field on the members page); verify it matches the shipped teams, members and global metrics pages.
- [x] 4.2 Run `npm run lint && npm run typecheck && npm run test` in `frontend/`, including `contrast.test.ts` if any token is added; verify all pass.
- [x] 4.3 Run `npm run test:e2e` against `docker compose up`; verify every flow passes.
- [x] 4.4 Run `openspec validate refine-board-forms --strict`; verify it reports the change valid.
