# Tasks

Every scenario in the delta specs maps onto one named test, given in the task
that implements it. Backend integration tests follow the existing convention:
one file per requirement (`test_<requirement>.py`) and one function per
scenario (`test_<scenario>`). Scenarios of "The status of a value" live in
`tests/features/metric_status.feature`.

## 1. Schema

- [ ] 1.1 Add `target_value`, `green_pct` and `amber_pct` to `MetricThreshold`
  and `hidden` to `BoardMetric` (`app/models/metric.py`), with the check
  constraints of design decision 2. Write
  `alembic/versions/0010_add_threshold_target_values.py`, upgrade and
  downgrade, with the downgrade refusing while any version has a target value.
  - Verify `uv run alembic upgrade head` on an empty database.
  - Verify `uv run alembic downgrade -1 && uv run alembic upgrade head` on
    the dev database with existing versions.
  - Verify `uv run pytest tests/integration` stays green with no other
    change.

## 2. The status rule

- [ ] 2.1 Add the pure `bounds_of(direction, version)` to
  `app/services/metric_status.py` per design decision 3, leaving `status_of`
  unchanged. Route every caller that judges or returns a version
  (`metric_values.py`, `metrics.py`, `global_metrics.py`, `dashboard.py`)
  through it.
  - Verify with `tests/unit/test_the_boundaries_a_target_value_amounts_to.py`:
    `test_higher_is_better_falls_short_of_the_target_value`,
    `test_lower_is_better_goes_over_the_target_value`,
    `test_a_negative_target_value`,
    `test_a_tolerance_that_does_not_divide_evenly`.
- [ ] 2.2 Add the scenarios "Higher is better against a target value", "Lower
  is better against a target value", "Within a band around a target value"
  and "A negative target value" to `tests/features/metric_status.feature`,
  with step definitions in `tests/features/steps/metric_status.py`.
  - Verify `uv run pytest tests/features` passes, the existing scenarios
    included.

## 3. Recording and reading threshold versions (API)

- [ ] 3.1 Extend `ThresholdCreate` with `target_value`, `green_pct` and
  `amber_pct`, and the two-step shape check of design decision 5. Add
  `ThresholdToleranceNegativeError` (`threshold_tolerance.negative`) and
  reuse `threshold.order_invalid` for tolerances. Persist the new fields in
  `metrics.py` and `global_metrics.py`.
  - Verify with `tests/unit/test_metric_schemas.py` for the shape rules.
  - Verify with `tests/integration/test_a_threshold_versions_target_value.py`:
    `test_a_version_with_a_target_value_and_tolerances`,
    `test_a_version_with_the_target_value_0_and_a_range`,
    `test_the_target_value_is_missing`,
    `test_tolerances_where_the_target_value_is_0`,
    `test_boundaries_where_the_target_value_is_not_0`,
    `test_a_tolerance_is_missing`, `test_a_negative_tolerance`,
    `test_amber_tighter_than_green`,
    `test_equal_tolerances_make_a_plain_red_and_green_metric`.
- [ ] 3.2 Extend `ThresholdRead` with `target_value`, `green_pct` and
  `amber_pct`, with its four boundaries filled from `bounds_of`.
  - Update `tests/integration/test_record_a_threshold_version.py` to the
    modified scenarios: every request gains a target value, and
    `test_a_threshold_version_is_recorded` asserts the resolved boundaries.
  - Verify with `tests/integration/test_list_a_metrics_threshold_history.py`:
    `test_a_history_spanning_target_values`.
  - Verify with `tests/integration/test_versions_recorded_before_target_values.py`:
    `test_an_earlier_version_is_read`,
    `test_a_newer_version_takes_over_on_the_same_date`. Seed the earlier
    version directly through the model, as a pre-change row.
- [ ] 3.3 Bring the global catalogue's versions onto the same rules.
  - Verify with `tests/integration/test_thresholds_of_a_global_metric.py`:
    `test_one_target_value_judges_every_board`, and
    `test_invalid_versions_are_refused_as_for_a_boards_metric` extended to
    the new cases.
- [ ] 3.4 Mirror the new request and read fields in
  `frontend/src/api/metrics.ts` (and the global metrics client), and add
  the `threshold_tolerance.negative` message to `en.ts` and `pl.ts`.
  - Verify `npm run typecheck`.

## 4. Hidden on the board (API)

- [ ] 4.1 Expose `hidden` on the metric read models. Accept it on the
  change-metric request for own and included global metrics, and as an
  optional field (default `false`) on the create, copy and include requests.
  - Verify with `tests/integration/test_hide_a_metric_on_the_board.py`:
    `test_a_metric_is_hidden`, `test_a_hidden_metric_is_shown_again`,
    `test_a_new_metric_is_shown_by_default`,
    `test_a_metric_is_created_hidden`,
    `test_a_metric_is_copied_or_included_hidden`,
    `test_only_whoever_configures_the_board_hides_a_metric`.
  - Verify with `tests/integration/test_list_a_boards_metrics.py`:
    `test_a_hidden_metric_is_listed_as_hidden`.
  - Verify with `tests/integration/test_a_board_cannot_change_a_global_metrics_definition.py`:
    `test_a_leader_hides_a_global_metric_on_their_board`.
  - Verify with `tests/integration/test_how_complete_a_meetings_recording_is.py`:
    `test_a_hidden_metric_counts_towards_completeness`.
- [ ] 4.2 Copy target values and tolerances with the versions, and never
  take the source's `hidden`.
  - Verify with `tests/integration/test_copy_a_metric_from_another_board.py`:
    `test_target_values_and_tolerances_are_copied`,
    `test_a_hidden_metric_is_copied_as_shown`.

## 5. Settings page and catalogue (frontend)

- [ ] 5.1 Rework the threshold form in `features/metrics/thresholds.tsx`
  per design decision 8:
  - a target value field;
  - tolerances, or boundaries when the target value is 0;
  - a preview of the resolved boundaries.

  Rework `display.tsx` to read a version as its target value and
  tolerances. Put all strings in both catalogues.
  - Verify with `MetricSettingsPage.test.tsx`:
    `a version is recorded on the settings page`,
    `target value 0 asks for boundaries`.
  - Verify with the global metrics page test:
    `a global threshold reads as a target value`.
- [ ] 5.2 Add the "Hidden on board" switch and the hidden mark to the
  settings page's metric rows, hidden from a viewer who may not configure
  the board. Add the same switch, off by default, to the create, copy and
  include dialogs (`MetricForm.tsx`, `BringMetricDialogs.tsx`).
  - Verify with `MetricSettingsPage.test.tsx`:
    `a metric is hidden from the settings page`,
    `a metric is hidden in the create dialog`.
- [ ] 5.3 Update `e2e/configure-metrics.spec.ts` and
  `e2e/global-metrics.spec.ts` to record versions by target value and
  tolerances, and to hide a metric.
  - Verify `npm run test:e2e` passes for both specs.

## 6. Board, recording view and metric detail (frontend)

- [ ] 6.1 Leave hidden metrics out of the board's tiles and out of a group
  heading whose metrics are all hidden (`BoardPage.tsx`).
  - Verify with `BoardPage.test.tsx`: `a hidden metric has no tile`,
    `a group of hidden metrics is left out`.
- [ ] 6.2 Keep hidden metrics in the recording view, and show a version's
  target value and tolerances there.
  - Verify with `RecordingView.test.tsx`: `a hidden metric is recorded`.
- [ ] 6.3 Draw the target value as its own stepped line in the metric
  detail's chart (`MetricDetail.tsx`).
  - Verify with `MetricDetail.test.tsx`: `the chart shows the target value`.
- [ ] 6.4 Extend `e2e/record-meeting-metrics.spec.ts`: record a number for
  a hidden metric, and see the board show no tile for it while the switch
  counts it.
  - Verify `npm run test:e2e` passes.

## 7. Conversion of existing thresholds

- [ ] 7.1 Write `scripts/convert_thresholds.py` per the design's *Migration
  Plan*, step 2:
  - the mapping CSV;
  - the default rule;
  - the "needs a mapping row" list;
  - the before/after status verification;
  - dry-run by default, and `--apply` in one transaction only when
    nothing is unresolved or unaccepted.

  Keep the pure parts (default rule, mapping lookup, status comparison) free
  of I/O.
  - Verify with `tests/unit/test_threshold_conversion.py`: the default
    for a gap-0 version, a target value 0, an inexact amber tolerance, a
    band, a mapping row overriding the default, and a status change refused
    without `accept_changes`.
  - Verify with `tests/integration/test_convert_thresholds.py`: a dry run
    writes nothing, and `--apply` adds twin versions without changing any
    existing version or status.
- [ ] 7.2 Document the conversion in `README.md`: how to run it, the mapping
  file's columns, and reading the report.
  - Verify the documented command runs as written against the dev database
    in dry-run mode.

## 8. Legacy import

- [ ] 8.1 Make `scripts/import_legacy_board.py` write versions with target
  values per the design's *The legacy import*.
  - Verify with `tests/unit/test_legacy_board_import.py`, updated for the
    new version shape: one-sided, target 0 and band KPIs.
  - Verify that an imported board's statuses still match the legacy colours
    (the existing hand-colour test).

## 9. Documentation

- [ ] 9.1 Update `CLAUDE.md`:
  - add *Target value* to the glossary;
  - rewrite *Threshold* (a target value with tolerances, or boundaries when
    it is 0);
  - make *Target* state that it is prose, distinct from a target value;
  - mention hiding in the *Metric* entry;
  - note in *Current state* that target values and hiding are built.

  Update the domain model table.
  - Verify by reading it against the specs.

## 10. Integration

- [ ] 10.1 Run the full gates:
  - `uv run ruff check . && uv run ruff format --check . && uv run mypy app`
  - `uv run pytest --cov=app` (coverage not below the current figure)
  - `npm run lint && npm run typecheck && npm run test`
  - `npm run test:e2e`

  Verify all are green.
- [ ] 10.2 With `docker compose up`, record a target-value version on a
  board's metric, hide another, and record values at the next meeting.
  - Verify the colours, the missing tile and the chart's target-value
    line by hand.

## Workflow follow-up

- Agree the demo's mapping rows (design *Open Questions*), then run the
  conversion against the Railway demo in dry-run, review the report, and
  `--apply`. Only then announce the change.
- Propose `derived-metrics` (mean, sum, delta; "Derive" in the recording
  view) on top of this change.
- Archive the change after review, and sync its deltas into
  `openspec/specs/`.
