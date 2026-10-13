# Design

## Context

See proposal.md for why. The relevant code today:

- `RecordingView.tsx` renders a `<ul>` of `RecordingRow`s. An editable row is a
  wrapping flex line (`.recordFields` in `board.module.css`): the metric's
  name and meta, then the number field with its unit, the four-way status
  toggle, the comment and a polite live region for "Saving…"/"Saved". Each
  field carries its own visible label. A read-only row (frozen meeting) is a
  different markup that shows the number and the comment as text.
- `TeamsPage.tsx` opens a `RegisterDialog` in `components/Modal.tsx` from its
  "Register team" button.
- `GlobalMetricsPage.tsx` renders `MetricForm` for a new global metric
  permanently above the catalogue. `MetricSettingsPage.tsx` already does what
  the global page should: "Create new metric" opens `MetricForm` in a `Modal`.

## Goals / Non-Goals

**Goals:**

- One column per field in the recording view, whatever the metric's name,
  unit or recording state.
- Reuse what exists: `Modal` and `MetricForm` for the global metric dialog,
  the register form's fields and error handling for the teams section.

**Non-Goals:**

- Keyboard movement between cells (an ARIA `grid`). The view stays in the
  natural Tab order.
- Changing what a row records or when it saves: the save-on-leaving-the-row
  behaviour, the comment rule and the correction reason stay as they are.
- The vertical gaps in the pulse check form and the item dialog (a separate
  `fix:` pull request).

## Decisions

### D1. A real `<table>`, not CSS grid on the list

The recording view becomes `<table>` with a `<thead>` (Metric, Value,
Status, Comment, and a visually hidden caption for the state column) and one
`<tr>` per metric. "Value", "Status" and "Comment" are the existing
`recording.value`, `recording.status` and `recording.comment` captions; only
"Metric" and the state column's caption are new.

- *Alternative: keep the `<ul>` and give it `display: grid` with
  `grid-template-columns`, each `<li>` using `subgrid`.* Lines up just as well
  on wide screens, but a screen reader then announces a list of items with
  labels rather than a table with headers, and what the user asked for is a
  table of records.
- *Alternative: `role="grid"`.* Rejected by decision: it promises arrow-key
  navigation that would have to be built and tested.

The metric cell keeps today's meta: unit, threshold in force and the previous
meeting's number, under the name. Putting the unit there keeps the Number
column one width.

### D2. Accessible names from the metric, visible labels from the headers

The per-row visible captions go. Each field is named by the templates the
catalogue already has - `recording.valueLabel` ("Value: {{name}}"),
`recording.commentLabel`, and `recording.statusLabel` as the status toggle's
visually hidden legend. A sighted user reads the column header; a screen
reader user hears the metric. Tests that already find fields by these names
keep working; any that use the bare caption move to them.

### D3. One table for editable and read-only rows

A frozen meeting renders the same table, with the number, status and comment
as text in their cells. The state column stays empty. Switching between
recording and reading therefore moves nothing.

### D4. Stacked cards below 40rem, by CSS only

Below 40rem the table's rows, cells and header are displayed as blocks; the
header is visually hidden and each cell shows its column name through a
`data-label` attribute and `::before`. No second markup and no resize
listener. The visible captions in `data-label` come from the same catalogue
strings as the headers.

### D5. The teams section is a disclosure, not a hidden dialog

"Register team" becomes a toggle button with `aria-expanded` and
`aria-controls` pointing at a `<section>` rendered below the button row only
while open. On open, focus moves to the name field; on success, Cancel or
Escape (handled on the section), the section unmounts and focus returns to the
button. The form's fields, validation and error display are the ones the
dialog uses today, lifted out of `Modal`.

- *Alternative: keep the section mounted and toggle `hidden`.* Keeps typed
  values across a cancel, which the spec does not want: cancelling discards.

### D6. The global metric form moves into a `Modal`

`GlobalMetricsPage` gets the same structure as the team metrics page: an "Add
global metric" button that opens `MetricForm` in a `Modal`, closed on success,
kept open on a rejection. No new component.

### D7. The convention is restated, not abolished

`CLAUDE.md` keeps "rarely needed forms open in `components/Modal.tsx`" and
names the two exceptions: registering a team (a section of the teams page)
and adding a member (an always-visible field on the members page).

## Risks / Trade-offs

- [The table is wider than the board column on a mid-size screen] → the
  comment column takes the remaining width and the others size to content;
  below 40rem the card layout takes over. Checked at 1280px, 1024px and phone
  width in the e2e flow.
- [Tests and e2e flows find fields by their old visible labels] → they move to
  the metric-named labels in the same change; `npm run test` and the e2e
  suite are part of the tasks.
- [An administrator's correction reason field sits above the table and is not
  a column] → unchanged: it applies to every row, not one.
