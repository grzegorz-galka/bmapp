# Tasks

Every scenario in the delta spec maps onto one named test, given in the task
that implements it. Backend integration tests follow the existing convention:
one file per requirement (`test_<requirement>.py`) and one function per
scenario (`test_<scenario>`). This change starts after `metric-target-values`
is merged.

## 1. Schema

- [x] 1.1 Add `Metric.derivation_kind` and the `MetricDerivationSource`
  model (`app/models/metric.py`), and the `DerivationKind` enum in
  `app/core/metric_enums.py`, per design decision 2. Write
  `alembic/versions/0011_add_metric_derivations.py`.
  - Verify `uv run alembic upgrade head` on an empty database, and
    downgrade then upgrade on the dev database.

## 2. Defining a derivation (API)

- [x] 2.1 Add `derivation` (kind and sources) to the metric create and change
  requests and to the metric read models, with source team and metric
  names. Validate in a new `app/services/derivations.py`:
  - the source count (`derivation.source_count`);
  - the source is on the named board (`derivation_source.not_found`);
  - not the metric itself (`derivation_source.self`);
  - no duplicates (`derivation_source.duplicate`).

  An included global metric is refused with `global_metric.read_only`.
  - Verify with `tests/unit/test_metric_schemas.py` for the request shape.
  - Verify with `tests/integration/test_define_a_metrics_derivation.py`:
    `test_a_mean_of_six_metrics`, `test_a_value_taken_from_another_team`,
    `test_a_metric_added_with_a_derivation`,
    `test_a_derivation_is_removed`, `test_a_derivation_is_changed`,
    `test_wrong_number_of_sources`,
    `test_a_source_that_is_not_on_the_named_board`,
    `test_a_metric_as_its_own_source`, `test_the_same_source_twice`,
    `test_only_whoever_configures_the_board_sets_a_derivation`.
  - Verify with `tests/integration/test_only_a_boards_own_metric_is_derived.py`:
    `test_a_global_metric_is_not_derived`, `test_a_global_metric_as_a_source`.
- [x] 2.2 Refuse deleting a source metric and removing an included global
  source with `metric.derivation_source` (HTTP 409). Leave the derivation
  out of a copy.
  - Verify with `tests/integration/test_a_source_cannot_be_taken_away.py`:
    `test_deleting_a_source_is_refused`,
    `test_removing_an_included_global_source_is_refused`,
    `test_a_copy_has_no_derivation`. The retired-source scenario is
    verified in 3.2.
- [x] 2.3 Mirror the request and read fields in `frontend/src/api/metrics.ts`,
  and add every new error code to `en.ts` and `pl.ts`.
  - Verify `npm run typecheck`.

## 3. Deriving a value (API)

- [x] 3.1 Add the pure same-week and previous-meeting rule to
  `derivations.py` (design decision 3), and the pure computation for each
  kind, with mean quantised to 6 places, half to even.
  - Verify with `tests/unit/test_the_meeting_a_source_is_read_at.py`:
    `test_another_team_met_earlier_in_the_week`,
    `test_another_team_met_later_in_the_week`,
    `test_another_team_met_twice_that_week`,
    `test_a_source_on_the_same_team`,
    `test_the_previous_meeting_for_a_delta`.
- [x] 3.2 Add
  `GET /teams/{team_id}/meetings/{meeting_id}/metrics/{metric_id}/derivation`
  (design decision 4), in three statements, refusing with one error entry
  per missing source.
  - Verify with `tests/integration/test_derive_a_value.py`:
    `test_the_mean_of_six_units`, `test_a_sum`, `test_a_delta`,
    `test_a_source_has_no_number`, `test_the_previous_number_is_missing`,
    `test_a_metric_with_no_derivation`, `test_anyone_signed_in_may_derive`.
  - Verify with `tests/integration/test_a_source_cannot_be_taken_away.py`:
    `test_a_retired_source_leaves_the_derivation_missing_a_number`.
  - Verify with `tests/integration/test_a_derived_value_is_an_ordinary_value.py`:
    `test_a_source_is_corrected_after_the_value_was_recorded`,
    `test_a_derived_metric_still_counts_as_missing`.
  - Mirror the response type in `frontend/src/api/`, and verify
    `npm run typecheck`.

## 4. The settings page (frontend)

- [x] 4.1 Add the derivation editor to the create dialog and to an own
  metric's change form, with the kind select, the ordered team-then-metric
  sources and the delta cap of one (design decision 8). Add the row's
  reading ("Mean of 6 metrics", "Metric (Team)"). All strings go in both
  catalogues.
  - Verify with `MetricSettingsPage.test.tsx`:
    `a derivation is set on the settings page`,
    `a source from another team`,
    `a viewer who may not configure the board` (the derivation is shown
    with no controls).
- [x] 4.2 Extend `e2e/configure-metrics.spec.ts`: give a metric a `mean`
  of two sources, one of them from another team.
  - Verify `npm run test:e2e` passes for that spec.

## 5. The recording view (frontend)

- [x] 5.1 Add "Derive" to the rows of derived metrics where the number is
  editable. It fills the field, saves through the row's existing `save()`,
  and shows the numbers used. On a refusal it shows the `notDerived` state
  naming each missing source or previous meeting (design decision 5).
  - Verify with `RecordingView.test.tsx`:
    `deriving fills and saves the number`,
    `a derived number can be changed`, `a missing source is named`,
    `no derive on a metric without a derivation`,
    `no derive on a frozen meeting`.
- [x] 5.2 Extend `e2e/record-meeting-metrics.spec.ts`: record two source
  values, derive their mean on a third metric, and see the tile show it
  with its status.
  - Verify `npm run test:e2e` passes for that spec.

## 6. Documentation

- [x] 6.1 Update `CLAUDE.md`:
  - add *Derived metric* to the glossary (a metric whose number "Derive"
    works out as a mean, a sum or a change since the previous meeting of
    other metrics in the same ISO week, saved as an ordinary value);
  - mention derivations in the *Metric* domain-model row;
  - note in *Current state* that `derived-metrics` is built.

  Verify by reading it against the spec.

## 7. Integration

- [x] 7.1 Run the full gates:
  - `uv run ruff check . && uv run ruff format --check . && uv run mypy app`
  - `uv run pytest --cov=app` (coverage not below the current figure)
  - `npm run lint && npm run typecheck && npm run test`
  - `npm run test:e2e`

  Verify all are green.
- [x] 7.2 With `docker compose up`, configure on two teams:
  - a `mean` across both teams;
  - a hidden base metric with a `delta` tile.

  Derive both at the next meeting, and verify by hand that the numbers,
  the notes, the refusal for a missing source, and the delta tile's colour
  against the target value 0 are right.

## Workflow follow-up

- After deploying to the Railway demo, configure "OTIF E" and
  "OTIF E: CKI-P" as in the design's *Migration Plan*. Check that "Derive"
  reproduces the October values.
- Archive the change after review, and sync its delta into
  `openspec/specs/`.
