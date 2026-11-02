# Proposal

## Why

Teams think of a metric as a number to hit, with a tolerance around it: ideal
utilisation is 72.3%, and more than 5% off it is a warning. BMAPP makes
them translate that into absolute boundaries by hand, and translate again
every time the number to hit changes. The legacy tool kept such a target per
week. The import flattened it into boundaries, which is why the Railway demo's
"Zatrudnienie wg planu miesięcznego" carries seven threshold versions that
differ only in the number. A metric with a target of 0, such as "Aneksy",
has no tolerance that can be a share of it, so it still needs a range.

A second need comes from the same boards. Some numbers have to be recorded
each week without being shown as tiles: a base value whose change is what the
board shows. The derivation of that change is the `derived-metrics` change
that follows this one. The ability to record a metric without a tile belongs
here, because it is a property of where a board shows a metric.

## What Changes

- **Target value.** Every new threshold version carries a **target value**
  (*wartość docelowa*): the number the metric aims at from its effective date
  on. It is versioned, back-datable and append-only like the rest of the
  version. A metric with no version still has no target value, and its values
  are `no_threshold`. The term is distinct from the prose **Target**, which
  never colours anything.
- **Tolerance as a share of the target value (default).** When the target
  value is not 0, a version gives a green and an amber tolerance in per cent
  of the target value. Only the worse side counts. For `higher_is_better`
  that is falling short, for `lower_is_better` going over, and for
  `within_band` either way. Boundaries still count as the better zone. For
  example, with target value 72.3 and tolerances 5% and 10%, a
  `within_band` value from 68.685 to 75.915 is green.
- **Range when the target value is 0.** A version whose target value is 0
  gives absolute boundaries, as every version does today, in any direction.
  A version with a non-zero target value cannot give boundaries, and one with
  target value 0 cannot give tolerances.
- **Threshold reads carry the resolved boundaries.** A version is returned
  with its target value and tolerances, and with the absolute boundaries they
  amount to. The board, the recording view and the trend chart keep drawing
  from boundaries and never work out a percentage. **BREAKING** for API
  writers: recording a threshold version requires `target_value`. The
  frontend is the only client and changes in the same change.
- **Hidden on the board.** A metric's placement may be marked hidden on the
  board, as it is created, copied or included, or later. A hidden metric is still active: it is listed in the recording view,
  takes values, counts in completeness and readiness, and has a trend. The
  board shows no tile for it. The setting is per board, so an included global
  metric may be hidden on one board and shown on another.
- **Migration.**
  1. The schema migration keeps every existing version exactly as recorded,
     with no target value, read as a range. No status changes.
  2. A conversion script, run per database, adds a target-value version for
     each existing version, effective from the same date. It derives the
     target value from the green boundary, or takes it from a mapping file
     where a person states it. Before writing anything it recomputes the
     status of every recorded value and reports every one that would change
     colour. It writes nothing while any change is unaccepted.
- The legacy import (`scripts/import_legacy_board.py`) writes target-value
  versions directly.

### Out of scope

- Deriving a value from other metrics, and the "Derive" control. That is the
  `derived-metrics` change.
- Renaming the `within_band` direction, and treating a move towards the
  target value as an improvement. See `design.md`, *Open Questions*.
- The prose targets capability.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `metrics`: a threshold version carries a target value, and tolerances or
  a range depending on it. The status rule resolves a version into
  boundaries. Threshold reads and copies carry the new fields. A metric's
  placement can be hidden on the board.
- `global-metrics`: a board may hide or show an included global metric. The
  catalogue's threshold versions follow the new version rules through the
  `metrics` capability.
- `metric-values`: the board page shows no tile for a hidden metric, while
  the recording view and completeness still count it. The metric detail
  draws the target value.

## Impact

- **Backend:**
  - `app/models/metric.py`: `MetricThreshold` gains `target_value`,
    `green_pct` and `amber_pct`, with the check constraints rewritten.
    `BoardMetric` gains `hidden`.
  - `app/services/metric_status.py`: a pure `bounds_of(direction, version)`.
    `status_of` is unchanged.
  - `app/schemas/metric.py`: `ThresholdCreate`, `ThresholdRead`, and the
    metric create and update models.
  - `app/services/metrics.py` and `global_metrics.py`: validation, copy and
    hidden.
  - `app/services/metric_values.py` resolves versions before judging.
- **Migration:** `alembic/versions/0010_add_threshold_target_values.py`.
- **Scripts:**
  - new `scripts/convert_thresholds.py`, with a mapping file format;
  - `scripts/import_legacy_board.py` updated.
- **Frontend:**
  - `features/metrics/thresholds.tsx` and `MetricForm.tsx` (the threshold
    form with target value and tolerances, and the hidden switch);
  - `display.tsx` (how a threshold reads);
  - `features/board/BoardPage.tsx` (no tile for a hidden metric);
  - `MetricDetail.tsx` (the target value line);
  - the API types and both language catalogues.
- **API:**
  - `POST …/thresholds` requires `target_value` and takes `green_pct` and
    `amber_pct`.
  - Threshold reads add three fields.
  - Metric reads and writes add `hidden`.
  - New error codes, listed in `design.md`.
- **Docs:** the CLAUDE.md glossary gains *Target value* and the Threshold
  entry changes. The `Target` entry states the distinction.
- **Dependencies:** none.
