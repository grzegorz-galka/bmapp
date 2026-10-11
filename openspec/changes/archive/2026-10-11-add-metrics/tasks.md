## 1. Prerequisite and schema

- [x] 1.1 Confirm that `add-meetings` is implemented and archived, so that `openspec/specs/meetings/spec.md` exists, and re-base this change's `authorization` MODIFIED block if `add-meetings` changed it. Verify that `openspec validate add-metrics --strict` passes with no "target spec does not exist" notice.
- [x] 1.2 Add `Metric`, `MetricThreshold`, `MetricValue` and `MetricValueCorrection` models with the columns, foreign keys, check constraints, unique name index and threshold index from the design, exported from `app/models/__init__.py`. Verify that `uv run mypy app` is clean.
- [x] 1.3 Write `alembic/versions/0004_add_metrics.py`. Verify that `upgrade head`, `downgrade -1` and `upgrade head` succeed on an empty database and on one holding teams and meetings, that `alembic check` reports no drift, and that inserting a band threshold with `amber_lo > green_lo` directly in SQL is refused by the check constraint.

## 2. The status rule (pure, BDD first)

- [x] 2.1 Add pytest-bdd's step layout under `tests/features/` and write `metric_status.feature`, with one scenario for each scenario of *The status of a value* and *The threshold in force at a meeting*. Verify that the feature runs and fails before 2.2.
- [x] 2.2 Implement `status_of` and `threshold_in_force` in `app/services/metric_status.py`, with no I/O and `Decimal` throughout. Verify that the feature passes, and that a unit test asserts 71.0 against a boundary of 71 is green.
- [x] 2.3 Implement `editable_meetings(meeting_dates, today)` in `app/services/metric_values.py`. Verify that `tests/unit/test_editable_meetings.py` has one test per scenario of *Only the latest held and the next meeting can be edited*.

## 3. Backend: validation, errors and schemas

- [x] 3.1 Add `MetricCreate`, `MetricChange`, `ThresholdCreate` (one-sided and band shapes, ordering validated per direction) and `MetricValueWrite` (decimal range, comment required with a manual status) to `app/schemas/`. Verify that unit tests cover every validation scenario in the `metrics` and `metric-values` specs.
- [x] 3.2 Add the domain errors from the design's table to `app/core/exceptions.py`. Verify with a unit test that each maps to its status, field and code through the existing handler.
- [x] 3.3 Add the read models `MetricRead`, `ThresholdRead`, `MetricValueRead`, `MeetingBoard` and `MetricTrend`, with decimals serialised as strings. Verify that `uv run mypy app` is clean and the OpenAPI document lists them.

## 4. Backend: services and API

- [x] 4.1 Add the metric definition services (add, list, change, retire or bring back, delete) and their router. Verify that `test_define_a_metric_on_a_board.py`, `test_list_a_boards_metrics.py`, `test_change_a_metric.py` and `test_retire_or_delete_a_metric.py` each hold one test per scenario.
- [x] 4.2 Add the threshold services (record a version, list history) and endpoints. Verify that `test_record_a_threshold_version.py` and `test_list_a_metrics_threshold_history.py` each hold one test per scenario, including the back-dated one.
- [x] 4.3 Add recording a value (upsert, same-team check, window rule, administrator correction with log in one transaction) and its endpoint. Verify that `test_record_a_metric_value_at_a_meeting.py`, `test_only_the_latest_held_and_the_next_meeting_can_be_edited.py` and `test_an_administrator_corrects_a_frozen_value.py` each hold one test per scenario.
- [x] 4.4 Add the meeting board read (values, statuses, previous and change, improvement, 12-meeting sparkline, completeness) and the metric trend. Verify that `test_the_board_of_a_meeting.py`, `test_how_complete_a_meetings_recording_is.py` and `test_a_metrics_trend.py` each hold one test per scenario, and that a test asserts a fixed number of SQL statements for a board of 14 metrics.
- [x] 4.5 Make `change_meeting` and `delete_meeting` raise `MeetingHasValuesError` as the modified `meetings` spec requires. Verify that the `add-meetings` move and delete test modules gain the new scenarios, and that their old scenarios still pass.
- [x] 4.6 Wire the guards. Verify that `test_a_teams_leader_configures_its_metrics_and_thresholds.py`, `test_a_teams_members_record_its_metric_values.py` and `test_only_an_administrator_corrects_a_frozen_value.py` each hold one test per scenario.
- [x] 4.7 Log metric added, changed, retired and deleted; threshold recorded; and value corrected, at INFO with ids and the acting email only. Verify with `caplog` assertions.
- [x] 4.8 Run `uv run ruff check . && uv run ruff format --check . && uv run mypy app` and `uv run pytest --cov=app --cov-report=term-missing`. Verify that everything passes and coverage stays at or above 85% without dropping.

## 5. Frontend: foundations

- [x] 5.1 Install `recharts` at a pinned version and rebuild with `docker compose up -d --build --renew-anon-volumes frontend`. Verify that the dev server starts and `npm run typecheck` passes. Name the dependency in the PR description.
- [x] 5.2 Add `--status-green`, `--status-amber` and `--status-red` (and their ink pairings) to both palettes in `theme.css`. Verify that `contrast.test.ts` covers them at the required ratios.
- [x] 5.3 Add `parseLocalizedDecimal` and `formatMetricValue` to `i18n/format.ts`. Verify that `format.test.ts` covers `95,3` in Polish, `95.3` in English, thousands separators, and rejection of `95,3,1`.
- [x] 5.4 Add `src/api/metrics.ts` (definitions, thresholds, trend, board, value write), and the strings and the fifteen new codes to `en.ts` and `pl.ts` with the design's Polish vocabulary. Verify that `npm run typecheck` and the catalogue parity test pass.

## 6. Frontend: pages

- [x] 6.1 Build `features/metrics/MetricSettingsPage.tsx` at `/teams/:teamId/metrics`, with the threshold dialog. Verify that its tests cover adding, editing, retiring, deleting, the immutable direction, the threshold order error and the read-only view for a member.
- [x] 6.2 Build `features/board/BoardPage.tsx` at `/teams/:teamId`, with the meeting navigator, grouped tiles, sparklines and the empty state. Verify that its tests hold one test per scenario of *The board page*.
- [x] 6.3 Build `RecordingView`, with per-field save on blur, a completeness header and a frozen read-only mode, plus a correction-with-reason mode for administrators. Verify that its tests hold one test per scenario of *The recording view*.
- [x] 6.4 Build the `MetricDetail` dialog: a Recharts trend with the threshold step or band, recent values, threshold history and corrections. Verify that its tests hold one test per scenario of *The metric detail*.
- [x] 6.5 Link the board, the meetings page and the metric settings to each other and from the team list. Verify that the two new permission scenarios pass in `features/board/permissions.test.tsx`, and that `npm run lint && npm run typecheck && npm run test` passes.

## 7. End-to-end and documentation

- [x] 7.1 Add `frontend/e2e/configure-metrics.spec.ts` (the leader adds three metrics, one per direction, with thresholds) and `record-meeting-metrics.spec.ts` (a member records values in Polish format, sees the colours and the change, sets a colour by hand with a comment; an older meeting is read-only). Verify that `npm run test:e2e` passes.
- [x] 7.2 Update CLAUDE.md: the domain table (Metric with direction and thresholds; a new Threshold row), the glossary (Threshold; Target unchanged as prose; red/amber/green), the Recharts note in the Tech stack, the Testing section (the first BDD feature exists) and *Current state*. Verify by reading the diff that no "acceptable min / max" or "red or green" wording remains.
- [x] 7.3 On a fresh volume, register a team, set its schedule, add metrics with thresholds, open two meetings, record values, back-date a threshold, and watch the earlier meeting recolour. Verify that it works end to end.

## Workflow follow-up

- Archive `add-meetings` before this change.
- Sync the delta specs and archive the change after review (`/opsx:archive`).
- Candidates for follow-up changes: hub readiness from real completeness; computed metrics (pulse check, KPI projects); per-unit breakdown (OTIF per organizational unit); legacy data import; problems and tasks.
