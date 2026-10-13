# Proposal

## Why

A review of the interface found three places where a form does not sit where
people expect it. In the recording view, each metric's fields start wherever
the metric's name ends, so the number fields, status toggles and comments of
consecutive metrics do not line up and the eye cannot run down a column.
Registering a team, a two-field form used by administrators, opens a dialog
where the rest of the teams page would serve. And the global metrics page
shows its add form permanently, while the team metrics page, which does the
same job for one board, keeps its add forms behind their buttons.

## What Changes

- The recording view becomes a table: one row per metric, one column each for
  the metric (with its unit, threshold in force and previous number), its
  number, its status set by hand, its comment and whether the row was saved.
  Column headers replace the labels repeated on every row; each field keeps an
  accessible name that includes its metric. A frozen meeting's read-only view
  uses the same columns. On a narrow screen each row stacks as a card. It is a
  table, not a spreadsheet: there is no arrow-key movement between cells.
- On the teams page, "Register team" reveals the registration fields in a
  section of the page instead of a dialog. The section closes when the team is
  registered or the form is cancelled, and stays open with what was typed when
  the registration is rejected.
- On the global metrics page, no add form is shown on the page itself: "Add
  global metric" opens it in a dialog, as "Create new metric" does on the team
  metrics page.
- The project convention in `CLAUDE.md` is restated: an add form opens in a
  dialog (`components/Modal.tsx`), except registering a team and adding a
  member to a team, which live in the page. Adding a member is already an
  always-visible field on the members page and does not change.
- Out of scope: the large vertical gaps between fields in the pulse check form
  and the problem and task dialogs. They come from the shared field style's
  flexible width acting as a height in a column, a defect fixed in a separate
  `fix:` pull request with no spec change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `metric-values`: the recording view is laid out as a table with one column
  per field, the same for a frozen meeting, stacking on a narrow screen.
- `team-board`: a team is registered from a section of the teams page rather
  than from a dialog.
- `global-metrics`: the global metrics page shows no add form until "Add global
  metric" opens it in a dialog.

## Impact

- **Frontend**: `features/board/RecordingView.tsx` and `board.module.css`;
  `features/teams/TeamsPage.tsx`; `features/globalMetrics/GlobalMetricsPage.tsx`;
  both catalogues (column headers, field names, the dialog's caption); the
  tests beside each, and the e2e flows `register-a-team.spec.ts`,
  `global-metrics.spec.ts` and `record-meeting-metrics.spec.ts`.
- **Backend / API**: none.
- **Docs**: `CLAUDE.md` (the dialog convention).
- **Dependencies**: none.
