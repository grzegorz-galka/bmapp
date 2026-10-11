# Tasks

## 1. Schema: placements and global metrics

- [x] 1.1 Branch `feature/global-and-copied-metrics` from `main`. Verify with `git branch --show-current`.
- [x] 1.2 Add the `BoardMetric` model (`board_metrics`, primary key `(team_id, metric_id)`, FKs and owner index from the design) and change `Metric`: `team_id` nullable, `position`/`group_label`/`owner_employee_id` removed, `uq_metrics_global_name_lower` and `ck_metrics_global_only_retired` added, a `placements` relationship. Export it from `app/models/__init__.py`. Verify that `uv run mypy app` is clean.
- [x] 1.3 Write `alembic/versions/0005_add_board_metrics_and_global_metrics.py` following the design's *Migration Plan*, with a downgrade that refuses while a global metric exists. Verify that `upgrade head`, `downgrade -1`, `upgrade head` succeed on an empty database and on one seeded with metrics, thresholds and values (every metric gets one placement with its old position, group, owner and retirement; no value moves), and that `alembic check` reports no drift.

## 2. Board metrics read through placements (no behaviour change yet)

- [x] 2.1 Replace `get_metric` with `get_board_metric(session, team_id, metric_id)` returning the placement with its metric, and move `add_metric`, `list_metrics`, `change_metric`, `delete_metric`, `record_threshold`, `list_thresholds`, `record_value`, `build_board` and `build_trend` onto it, effective retirement being placement or catalogue. Verify that the whole existing backend suite (`uv run pytest`) passes unchanged, and that the fixed-statement-count test for a 14-metric board still holds.
- [x] 2.2 Add `scope` (`board` | `global`) to `MetricDefinitionRead`, keeping `team_id` as the board read. Verify with a schema unit test and an assertion in `test_list_a_boards_metrics.py` that own metrics read `scope: "board"`.

## 3. Backend: global metric catalogue

- [x] 3.1 Add `may_define_global_metrics(*, is_admin)` to `services/authz.py`. Verify with a unit test in `test_permission_is_decided_per_team_not_per_role.py` (administrator yes, anyone else no).
- [x] 3.2 Add `GlobalMetricCreate`, `GlobalMetricChange` and `GlobalMetricRead` schemas, reusing `_MetricFields` validation, and the errors `GlobalMetricReadOnlyError`, `GlobalMetricAlreadyIncludedError` and `MetricCopySourceGlobalError` with the codes, statuses and fields from the design. Verify with unit tests in `test_metric_schemas.py` and `test_domain_errors.py`.
- [x] 3.3 Add `services/global_metrics.py` (add, list with board count, change with the locked rename check against including boards, retire/bring back, delete with the any-board `has_values` check, record and list thresholds reusing the threshold path) and `api/global_metrics.py` mounted at `/global-metrics`. Verify that `test_define_a_global_metric.py`, `test_list_the_global_metrics.py`, `test_change_a_global_metric.py`, `test_retire_or_delete_a_global_metric.py` and `test_thresholds_of_a_global_metric.py` each hold one test per scenario of the matching `global-metrics` requirement.
- [x] 3.4 Guard every catalogue write with `may_define_global_metrics`. Verify that `test_only_an_administrator_defines_global_metrics.py` holds one test per scenario.

## 4. Backend: global metrics on a board

- [x] 4.1 Add the shared name-clash helper (lock team rows in id order, check own names against included global names and the reverse) and call it from add, rename and include; global rename calls it from 3.3. Verify with the new *Name of an included global metric* test in `test_define_a_metric_on_a_board.py` and the clash scenarios of 3.3 and 4.2.
- [x] 4.2 Add `POST /teams/{team_id}/metrics/inclusions` (`include_global_metric`). Verify that `test_include_a_global_metric_in_a_board.py` holds one test per scenario, plus *A retired global metric cannot be included*.
- [x] 4.3 Make `change_metric` and `record_threshold` refuse a global metric's definition with `global_metric.read_only` and apply placement keys and `retired` to the placement. Verify that `test_a_board_cannot_change_a_global_metrics_definition.py` holds one test per scenario, including the administrator case.
- [x] 4.4 Make `delete_metric` remove only the placement of a global metric, refused with `metric.has_values` when that team has values for it. Verify that `test_remove_a_global_metric_from_a_board.py` holds one test per scenario.
- [x] 4.5 Cover values of a global metric. Verify that `test_a_global_metrics_values_belong_to_each_team.py` holds one test per scenario, and that `test_record_a_metric_value_at_a_meeting.py` gains *A global metric retired in the catalogue* and *A global metric the board does not include*.
- [x] 4.6 Cover the modified list requirement. Verify that `test_list_a_boards_metrics.py` gains *Own and global metrics are listed together*, and that `test_retire_or_delete_a_global_metric.py`'s *A retired global metric leaves every board* asserts the board and the trend.

## 5. Backend: copying a metric

- [x] 5.1 Add `MetricCopy` (`source_metric_id`, optional `name` validated as a metric name, optional `position`), `copy_metric` in `services/metrics.py` with thresholds re-recorded in source order with explicit `recorded_at`, and `POST /teams/{team_id}/metrics/copies`. Verify that `test_copy_a_metric_from_another_board.py` holds one test per scenario of *Copy a metric from another board*.
- [x] 5.2 Extend the configure-the-board guard to inclusions and copies. Verify that `test_a_teams_leader_configures_its_metrics_and_thresholds.py` gains *A leader copies from a board they do not belong to* and *A leader includes a global metric*, and its member scenario covers copy and include.
- [x] 5.3 Log global metric added, changed, retired, deleted and its threshold recorded; inclusion added and removed; metric copied (source and new id) — at INFO with ids and the acting email only. Verify with `caplog` assertions in `test_metric_events_are_logged.py`.
- [x] 5.4 Run `uv run ruff check . && uv run ruff format --check . && uv run mypy app` and `uv run pytest --cov=app --cov-report=term-missing`. Verify that everything passes and coverage stays at or above 85% without dropping.

## 6. Frontend: client and catalogue strings

- [x] 6.1 Add `scope` to `MetricDefinition`, `copyMetric` and `includeGlobalMetric` to `src/api/metrics.ts`, and `src/api/globalMetrics.ts` for the catalogue and its thresholds, with TanStack Query hooks beside the existing ones. Verify that `npm run typecheck` passes and a client test asserts the request paths and bodies.
- [x] 6.2 Add every new string and the three new error codes to `en.ts` and `pl.ts`, using *wskaźnik globalny* and the design's Polish wording. Verify that `npm run typecheck` (catalogue parity) passes.

## 7. Frontend: pages

- [x] 7.1 Extract the metric definition fields, the threshold dialog and the threshold history from `MetricSettingsPage.tsx` into components that take their save callback. Verify that `MetricSettingsPage.test.tsx` passes unchanged.
- [x] 7.2 Build `features/globalMetrics/GlobalMetricsPage.tsx` at `/global-metrics` and add a header link to it. Verify that its tests cover *The catalogue is shown*, adding, changing, retiring and recording a threshold as an administrator, and *A leader sees the global metrics without controls*.
- [x] 7.3 Extend `MetricSettingsPage`: *Copy from another board* and *Include a global metric* dialogs for configurers, and global rows that offer only placement, retire and remove, with read-only definition and threshold history. Verify that its tests cover both dialogs, *The settings page shows a global metric read-only*, the `metric_name.duplicate`, `global_metric.already_included` and `metric_copy.source_global` messages, and the member scenario of *The interface offers only what its viewer may do*.
- [x] 7.4 Add the global mark (inline SVG plus words) to board tiles and the metric detail. Verify that `BoardPage.test.tsx` covers *A tile names a global metric as global* and `MetricDetail.test.tsx` shows the mark.
- [x] 7.5 Run `npm run lint && npm run typecheck && npm run test`. Verify that everything passes, including `contrast.test.ts` if any token was added.

## 8. End to end and documentation

- [x] 8.1 Add `e2e/global-metrics.spec.ts` (an administrator defines a global metric with a threshold; a leader includes it; a member records a value and sees its colour) and extend `e2e/configure-metrics.spec.ts` with copying a metric from another board. Verify that `npm run test:e2e` passes against `docker compose up` after `alembic upgrade head`.
- [x] 8.2 Update CLAUDE.md: **Global metric** in the glossary, the domain table (Metric's team optional; a board's placement of a metric), *Current state*, and the GUI test list. Update README if it lists endpoints or pages. Verify by reading the diff against this change's specs.
- [x] 8.3 Run `openspec validate add-global-and-copied-metrics --strict`. Verify that it reports the change valid.

## Workflow follow-up

- Open a PR naming no new dependencies and linking this change's `design.md`.
- After merge, sync and archive the change with `/opsx:archive`.
