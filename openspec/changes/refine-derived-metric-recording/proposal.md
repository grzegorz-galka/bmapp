# Proposal

## Why

Recording the values of a board with derived metrics has shown five problems:

- The recording table shares the page with the problems and tasks column. Each
  metric's threshold and previous number therefore wrap over several lines.
- The table is one flat list. The metrics are in the board's order, but nothing
  shows which group a metric belongs to.
- "Derive" wraps under the number field. A refusal that names missing sources
  is squeezed into a narrow state column and runs over many lines.
- Once a derived value is recorded, nothing on the board shows which numbers it
  came from.
- Some board metrics are weighted averages of units of different size, and the
  three kinds, mean, sum and delta, cannot express that.

## What Changes

- **The recording view takes the board's full width.** While the values are
  listed (recorded, corrected or read), the problems and tasks column is not
  shown. A metric's name, unit, threshold and previous number no longer wrap at
  the board's usual widths. An address that names the problems or tasks list
  shows the tiles and the lists, not the recording view.
- **Group headings in the recording table.** Metrics are listed under their
  board's groups, in the board's order, with the ungrouped metrics last under a
  heading of their own. A metric hidden on the board is listed under its group.
- **Derive beside the number.** The number field and "Derive" stay on one line.
  A row's message spans the full width of the table on a line under the row:
  a refusal, a failed save, an invalid number, or the numbers a derived value
  used.
- **Sources in the metric detail.** For a derived metric, the detail opened
  from a tile has a collapsed "Sources" section for the meeting the board shows.
  Opening it derives the value again and lists each source's team, meeting date
  and number, or names the missing sources. When the result differs from the
  number recorded at that meeting, the section says the sources have changed
  since. Nothing is recorded.
- **Weighted mean, a fourth derivation kind.** `weighted_mean` takes one or
  more sources, each with a weight greater than 0. Its value is the sum of each
  weight times its source's number, divided by the sum of the weights. It is
  kept to 6 decimal places, rounding half to even. The weights need not add up
  to 1. A missing source refuses the derivation, as it does for `mean`. The
  settings page shows a weight field for every source, and both the settings
  row and the recording view show the weights.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `derived-metrics`: adds the `weighted_mean` kind with a weight per source and
  its validation codes, adds the weights to the settings page and the recording
  note, lays out Derive and its messages in the recording row, and adds the
  sources section in the metric detail.
- `metric-values`: the recording view is laid out at full width, in group
  sections, with each row's message on a line of its own. The problems and
  tasks column applies only while tiles are shown.
- `problems-and-tasks`: the board shows the active problems and tasks beside
  the tiles only, not while the values are listed. An address that names a list
  shows the tiles.

## Impact

- **Database:** one Alembic migration. It adds `weighted_mean` to the
  `metric_derivation_kind` check constraint and a nullable `weight
  NUMERIC(21, 6)` column to `metric_derivation_sources`, with a check that a
  weight is greater than 0 when present.
- **Backend:** `app/core/metric_enums.py` (the new kind),
  `app/models/metric.py`, `app/schemas/metric.py` (a `weight` on source writes
  and reads, and on `DerivedSource`), `app/services/derivations.py` (checking
  weights and computing the weighted mean), `app/services/metric_values.py`
  (`derive_value` passes the weights through), and `app/core/exceptions.py`
  (two new codes).
- **API:** the new kind value and the `weight` field are additive. Two new error
  codes are published: `derivation_source.weight_required` and
  `derivation_source.weight_invalid`. The derive endpoint is unchanged and is
  now also read by the metric detail.
- **Frontend:** `features/board/RecordingView.tsx`, `BoardPage.tsx`,
  `MetricDetail.tsx`, `board.module.css`, `features/metrics/DerivationEditor.tsx`,
  `api/metrics.ts`, and both i18n catalogues.
- **Docs:** the CLAUDE.md glossary entry for a derived metric names the fourth
  kind.
- **Dependencies:** none.
