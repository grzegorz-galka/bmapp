# Proposal

## Why

Some metrics are worked out from other metrics recorded in the same week.
Members currently compute them by hand and type them in. The Railway demo
shows all three shapes:

- Zarząd's "OTIF E" is the mean of its six units ("OTIF E: BPW" …
  "OTIF E: CKI-S").
- Zarząd's "OTIF E: CKI-P" is the CKI-P team's own "OTIF-Etap" from the
  same week, often rounded. CKI-P meets on Monday or Tuesday, Zarząd on
  Wednesday.
- A board wants to show how a number changed since the last meeting,
  recording the base number but not showing it. `metric-target-values`
  provides the hiding; this change provides the change itself.

The hand-typed values drift: "OTIF E" was off by up to 1.15 from the mean
of its units in September.

## What Changes

- **A derivation on a board's own metric.** A derivation is one of three
  kinds over an ordered list of sources, each source a metric on a named
  team's board (the same team or another):
  - `mean`: the arithmetic mean of one or more sources. With one source it
    copies a value from another team.
  - `sum`: the sum of one or more sources.
  - `delta`: exactly one source, its number minus its number at that team's
    previous meeting.

  Whoever configures the board sets, changes or removes a derivation. A
  closed list of kinds is used rather than code in the configuration (see
  `design.md`).
- **Same week.** A source is read at its team's meeting in the same ISO week
  (Europe/Warsaw) as the meeting being recorded. For a source on the same
  team, that is the same meeting. "Previous" for a delta is the source
  team's meeting immediately before that one, with no look-back past it.
- **"Derive" in the recording view.**
  - **Where:** on the row of a derived metric, wherever its number can be
    edited.
  - **What it does:** works the number out from saved values, puts it in
    the number field, and names the values it used. The row then saves as
    if the number had been typed.
  - **When a source is missing:** it fills nothing and names every source
    with no meeting or no number in that week, and for a delta the
    previous meeting.
  - **Nothing is computed when read:** a derived metric's value is an
    ordinary value of its meeting, so freezing, corrections, status and
    completeness are unchanged.
- **Safeguards.**
  - A metric used as a source cannot be deleted, nor a global metric
    removed from the board it is a source on, while the derivation
    stands.
  - A metric cannot be its own source.
  - A copy of a metric does not take its derivation.

### Out of scope

- Derivations on global metrics in the catalogue. Every known case is a
  board's own metric (see `design.md`, decision 6).
- Computing derived values automatically, live or in bulk.
- Recording on a value that it was derived.
- Expressions beyond the three kinds.

## Capabilities

### New Capabilities

- `derived-metrics`: how a board's metric is derived from other metrics
  recorded in the same week. It covers the derivation's definition and its
  sources, the same-week and previous-meeting rules, the safeguards on
  sources, and the "Derive" control that fills a value in the recording
  view.

### Modified Capabilities

None. The rules that touch defining, copying and deleting metrics are
stated in `derived-metrics`, so this change does not edit requirements
that the in-flight `metric-target-values` change also modifies.

## Impact

- **Depends on** `metric-target-values`: a delta metric is judged against
  the target value 0 with a range, and its base metric is hidden on the
  board. That change lands first.
- **Backend:**
  - `app/models/metric.py`: `metrics.derivation_kind` and a new
    `metric_derivation_sources` table.
  - `app/services/derivations.py` (new): validation, the same-week and
    previous-meeting rules, and the computation, pure where it can be.
  - `metrics.py`: create, change, copy and delete hooks.
  - `global_metrics.py`: refuse removing a global metric used as a source.
- **Migration:** `alembic/versions/0011_add_metric_derivations.py`.
- **API:**
  - The metric create and change requests take an optional `derivation`.
  - Metric reads carry it, with source team and metric names.
  - A new read endpoint returns a derived number for a meeting.
  - New error codes, listed in `design.md`.
- **Frontend:**
  - The metric dialog and rows on the settings page (a derivation editor);
  - `features/board/RecordingView.tsx` (the "Derive" control);
  - the API types and both catalogues.
- **Dependencies:** none.
