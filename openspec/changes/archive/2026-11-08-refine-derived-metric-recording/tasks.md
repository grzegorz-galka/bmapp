# Tasks

Every scenario in the delta specs maps onto one named test, given in the task
that implements it. Backend integration tests follow the existing convention:
one file per requirement (`test_<requirement>.py`) and one function per
scenario (`test_<scenario>`). Frontend tests use `describe('<requirement>')`
and `it('<Scenario>')`. Where an existing test already covers an unchanged
scenario of a MODIFIED requirement, it stays as it is.

## 1. Weighted mean: schema

- [x] 1.1 Add `WEIGHTED_MEAN` to `DerivationKind` (`app/core/metric_enums.py`)
  and `weight: Mapped[Decimal | None]` (`NUMERIC(21, 6)`, with
  `CHECK (weight IS NULL OR weight > 0)`) to `MetricDerivationSource`
  (`app/models/metric.py`), per design decision 6. Write
  `alembic/versions/0013_add_weighted_mean_derivation.py`, whose downgrade
  raises while any metric is a `weighted_mean`.
  - Verify `uv run alembic upgrade head` on an empty database, and
    downgrade then upgrade on the dev database.

## 2. Weighted mean: defining it (API)

- [x] 2.1 Add an optional `weight` to `DerivationSourceWrite` and
  `DerivationSourceRead` (`app/schemas/metric.py`). Add
  `DerivationSourceWeightRequiredError` (`derivation_source.weight_required`)
  and `DerivationSourceWeightInvalidError` (`derivation_source.weight_invalid`)
  to `app/core/exceptions.py`. Check both in `check_derivation`, in source
  order, and store the weights in `set_derivation` and `load_derivations`
  (`app/services/derivations.py`).
  - Verify with `tests/unit/test_domain_errors.py` for the two codes and their
    fields.
  - Verify with `tests/integration/test_define_a_metrics_derivation.py`:
    `test_a_weighted_mean_of_three_metrics`, and
    `test_wrong_number_of_sources` extended to `weighted_mean`.
  - Verify with new `tests/integration/test_a_weighted_means_weights.py`:
    `test_a_source_without_a_weight`, `test_a_weight_of_zero_or_less`,
    `test_a_weight_on_another_kind`, `test_fractional_weights`.
- [x] 2.2 Check that a copy of a weighted-mean metric still takes no
  derivation, and that removing a weighted mean's source is still refused.
  - Verify the existing `test_a_copy_has_no_derivation` and
    `test_deleting_a_source_is_refused` pass with a `weighted_mean` fixture
    added to their parameters.

## 3. Weighted mean: deriving it (API)

- [x] 3.1 Extend `derive()` with the weights:
  `sum(w*x) / sum(w)`, quantised as a mean is. In `derive_value`
  (`app/services/metric_values.py`), pass each source's weight through and
  return it on `DerivedSource`.
  - Verify with `tests/unit/test_the_meeting_a_source_is_read_at.py`, which
    already tests `derive()`: weighted mean 3/1/1 over
    90/97/87 = 90.8; 1/2 over 10/20 = 16.666667; 0.6/0.2/0.2 equals 3/1/1.
  - Verify with `tests/integration/test_derive_a_value.py`:
    `test_a_weighted_mean`, `test_a_weighted_mean_is_rounded_half_to_even`,
    `test_weights_need_not_add_up_to_one`,
    `test_a_weighted_mean_with_a_source_missing_is_refused`.
- [x] 3.2 Run the backend gates.
  - Verify `uv run ruff check . && uv run ruff format --check . && uv run mypy app`
    and `uv run pytest --cov=app` pass, with coverage not below its previous
    figure.

## 4. Weighted mean: settings page

- [x] 4.1 Add `weighted_mean` to `DerivationKind` and `weight` to the source
  types in `frontend/src/api/metrics.ts`. Add the kind's caption, the
  pluralised `derived_weighted_mean_*` keys, the weight field's label, the
  two error codes and the weighted recording note to `i18n/en.ts` and
  `i18n/pl.ts`.
  - Verify `npm run typecheck` passes, so neither catalogue is missing a key.
- [x] 4.2 Add a weight field per source in `DerivationEditor.tsx` when the kind
  is weighted mean, per design decision 7: start each source at `1` when
  switching kind or adding a source, drop the weights when switching away,
  parse in the active language's format, and map
  `derivation.sources[i].weight` errors onto the field. The read-only summary
  lists each source with its weight.
  - Verify with `MetricSettingsPage.test.tsx`,
    `describe('the settings page edits a derivation')`:
    `A weighted mean is set on the settings page`, `A weight starts at one`,
    `Weights are dropped with the kind`,
    `A weight that is not a number greater than zero`.

## 5. Recording view layout

- [x] 5.1 Move the grouping out of `Tiles` into a shared
  `groupMetrics(board, { hidden })` (`features/board/groupMetrics.ts`), per
  design decision 3, and use it in `Tiles` without hidden metrics.
  - Verify with new `groupMetrics.test.ts` (group order, ungrouped last,
    position inside a group, hidden kept or left out), and that the existing
    board tile tests still pass.
- [x] 5.2 Render the recording table as one `<tbody>` per group, each headed by
  a `<th colSpan={5} scope="colgroup">`, using
  `groupMetrics(board, { hidden: true })`. Style the heading row for both the
  table and the stacked cards.
  - Verify with `RecordingView.test.tsx`, `describe('the recording view')`:
    `The metrics are listed under their groups`,
    `A hidden metric is listed under its group`,
    `A group with only hidden metrics`.
- [x] 5.3 Move each row's message (not a number, failed save, refused derive,
  derived note) to a second `<tr><td colSpan={5}>` rendered only when there
  is one, per design decision 4. Put the number input and "Derive" in a
  non-wrapping container. Leave only "Saving…"/"Saved" in the state column.
  - Verify with `RecordingView.test.tsx`:
    `A row's message spans the table` (`the recording view`),
    `Derive sits beside the number field`,
    `Several missing sources fit the row's width` and
    `Deriving a weighted mean names the weights`
    (`derive in the recording view`). Verify that the existing
    `A missing source is named` and `Deriving fills and saves the number` still
    pass.
- [x] 5.4 Hide `{lists}` and the two-column layout while the values are
  listed, in all three modes, per design decision 5. Drop the comment column's
  `width: 100%` and keep the metric cell's meta line on one line above 40rem.
  Drop `mode=record` with a `replace` navigation when the address names
  `#problems` or `#tasks`.
  - Verify with `BoardPage.test.tsx`: `The recording view takes the full width`
    (`the problems and tasks column is wider`).
  - Verify with `ItemLists.test.tsx`:
    `The lists are not shown while values are listed`
    (`the board shows the active problems and tasks`) and
    `A list named while the recording view is asked for`
    (`the board's lists can be reached from an address`).
  - Verify that `contrast.test.ts` and `controls.test.ts` still pass.
- [x] 5.5 Check the layout in a real browser.
  - Verify with `e2e/record-meeting-metrics.spec.ts`, extended: at 1280×800 the
    recording view shows group headings, no problems column, a 60-character
    metric meta on one line (`A metric's details stay on one line`), and
    "Derive" on the number field's line.

## 6. Sources in the metric detail

- [x] 6.1 Add a `useDerivation(teamId, meetingId, metricId, enabled)` query
  (`features/board/useBoard.ts`) beside the existing mutation, per design
  decision 2. Pass the shown meeting and the board entry's recorded value
  from `BoardPage` into `MetricDetail`.
  - Verify `npm run typecheck` passes.
- [x] 6.2 Add the collapsed `<details>` "Sources" section to `MetricDetail`
  for derived metrics only. List each source's team, metric, meeting date and
  number, with its weight or previous number. Show the derived number, and
  compare it with the recorded one by exact decimal value. Reuse
  `notDerivedMessage` (moved to a shared module) for refusals. Add the strings
  to both catalogues.
  - Verify with `MetricDetail.test.tsx`,
    `describe('the metric detail lists a derived value's sources')`:
    `The sources are listed`, `Nothing is derived until the section is opened`,
    `The sources have changed since the value was recorded`,
    `The value matches its sources` (including `"19.500000"` against `"19.5"`),
    `No value recorded yet`, `A source is missing now`,
    `A metric that is not derived`.

## 7. Documentation and integration

- [x] 7.1 Update CLAUDE.md: the derived-metric glossary entry names
  `weighted_mean`, and "Current state" notes the sources section in the
  metric detail and that the recording view lists by group at full width.
  - Verify by reading the diff.
- [x] 7.2 Run every gate and the stack end to end.
  - Verify that `npm run lint && npm run typecheck && npm run test` and
    `npm run test:e2e` pass.
  - Verify the full backend suite passes.
  - Verify that `docker compose up -d` followed by
    `docker compose exec backend alembic upgrade head` shows a weighted mean
    defined, derived and explained in the detail.
  - Verify `openspec validate refine-derived-metric-recording --strict`.

## Workflow follow-up

- Sync the delta specs and archive the change after the PR is merged.
