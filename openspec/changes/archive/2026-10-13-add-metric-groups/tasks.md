# Tasks

Prerequisite: `polish-gui` is applied (the reworked metric settings page).
Each scenario maps to one test named after it, in a test file named after its
requirement, as the existing suites do.

## 1. Schema and migration

- [x] 1.1 Add `MetricGroup` (`metric_groups`: id, team_id, name, position, created_at; unique `(team_id, lower(name))`) to `app/models/metric.py`, add `BoardMetric.group_id` (ON DELETE SET NULL) and the `group` relationship, and remove `group_label`; verify `uv run mypy app` passes.
- [x] 1.2 Write the `add_metric_groups` Alembic migration with the data step of design §7 (case-merged labels become groups in today's board order; positions renumbered densely per container; `group_label` dropped) and a downgrade that restores labels; verify `alembic upgrade head` and `downgrade -1` run on an empty database and on one loaded by `scripts/import_legacy_board.py`.
- [x] 1.3 Add `tests/integration/test_migrate_group_labels_to_groups.py`: labels "Quality", "quality " and "Finance" on one board become two groups in board order, metrics keep their relative order; verify it passes.

## 2. Groups: service, API, errors

- [x] 2.1 Add the `DomainError` subclasses `metric_group_name.blank`, `.too_long`, `.duplicate`, `metric_group.not_found` (404) and `metric_layout.stale` (409) in `app/core/exceptions.py`, and group schemas (`MetricGroupCreate`, `MetricGroupRename`, `MetricGroupRead`) with `PydanticCustomError` codes; verify `tests/unit/test_metric_schemas.py` gains cases for blank, too-long and trimmed group names and passes.
- [x] 2.2 Implement add, rename, list and delete of groups in `app/services/metrics.py` (delete appends the group's metrics after the ungrouped ones, in order, in one transaction) and route them in a new `app/api/metric_groups.py` behind the configurer check; verify `tests/integration/test_define_a_boards_metric_groups.py` (A group is added; Group name is blank, too long or taken; Two boards use the same group name), `test_rename_a_metric_group.py` (A group is renamed; Renamed to a taken name) and `test_delete_a_metric_group.py` (A group with metrics is deleted; An unknown group is deleted) pass.
- [x] 2.3 Implement `PUT /teams/{team_id}/metric-layout` (lock, exact-set check including retired placements, rewrite positions and groups) per design §2; verify `tests/integration/test_arrange_a_boards_layout.py` (A metric is moved into another group; Groups are reordered; A layout made against an outdated board) passes.
- [x] 2.4 Verify `tests/integration/test_arranging_a_boards_metrics_is_part_of_configuring_it.py` (A leader arranges their board; An ordinary member cannot arrange the board; An administrator arranges any board) passes, and add the new rows to `tests/unit/test_permission_is_decided_per_team_not_per_role.py` if it enumerates writes.

## 3. Metrics placed by group

- [x] 3.1 Replace `group_label`/`position` with `group_id` in `MetricCreate`, `MetricUpdate`, `MetricCopy` and `GlobalMetricInclusion`, and with `group` (+ container `position`) in `MetricDefinitionRead`; append new and moved metrics at the end of their container; drop the source's group on copy; set `_PLACEMENT_KEYS` to `{group_id, owner_employee_id}`; verify `uv run mypy app` passes.
- [x] 3.2 Order `list_metrics` and the board read in `app/services/metric_values.py` by `(group position NULLS LAST, position, lower(name))`; verify `tests/integration/test_the_board_of_a_meeting.py` still passes.
- [x] 3.3 Update `tests/integration/test_define_a_metric_on_a_board.py` (A metric is added; A new metric is placed last in its group; The group is not the board's), `test_list_a_boards_metrics.py` (Metrics are returned in display order; Own and global metrics are listed together), `test_change_a_metric.py` (A metric is renamed and regrouped) and `test_copy_a_metric_from_another_board.py` (A metric is copied with its thresholds; A copy with no group is ungrouped); verify they pass.
- [x] 3.4 Update `test_include_a_global_metric_in_a_board.py` (A global metric is included; Included into another board's group), `test_a_board_cannot_change_a_global_metrics_definition.py` (A leader moves and regroups a global metric) and `test_define_a_global_metric.py` (A global metric is added: no group or position of its own); verify they pass.
- [x] 3.5 Update `scripts/import_legacy_board.py` to create a group per legacy KPI group and place metrics in it; verify `tests/integration/test_load_a_legacy_board.py` passes.
- [x] 3.6 Run `uv run pytest --cov=app --cov-report=term-missing` and `uv run ruff check . && uv run ruff format --check . && uv run mypy app`; verify everything passes and coverage stays ≥ 85% and does not drop.

## 4. Frontend API and board

- [x] 4.1 Update `src/api/metrics.ts` (types `MetricGroup`, `group` on metrics, `group_id` in payloads) and add the group and layout calls with their TanStack Query hooks in `features/metrics/useMetrics.ts`; verify `npm run typecheck` passes.
- [x] 4.2 Add the group strings and the five error codes to `src/i18n/en.ts` and `src/i18n/pl.ts`; verify `npm run typecheck` passes (missing keys fail `tsc`).
- [x] 4.3 Render `Tiles` in `BoardPage.tsx` by the board's group order, ungrouped last under `board.noGroup`, skipping groups without metrics; update `boardFixture.ts`; verify `BoardPage.test.tsx` "Tiles follow the board's layout" passes.

## 5. Arranging on the metric settings page

- [x] 5.1 Write a pure `moveInLayout` (and its inverse lookup) used by both dragging and the move controls, with unit tests `layout.test.ts` for moves within a group, across groups, to ungrouped and group reorders; verify they pass.
- [x] 5.2 Lay out the settings page as groups with their metrics and an "Ungrouped" section; add the group controls (add, rename, delete with confirmation for a non-empty group); remove the group and position fields from `MetricForm.tsx` and add a group select to the create, copy and include dialogs; verify `MetricSettingsPage.test.tsx` "An empty group is shown", "Deleting a group asks first", "An empty group is deleted at once" and "A viewer who may not configure the board cannot arrange it" pass.
- [x] 5.3 Add native drag and drop for metric rows and group headers with an insertion indicator, optimistic update and `metric_layout.stale` handling; verify `MetricSettingsPage.test.tsx` "A metric is dragged into a group" (fired drag events) and "A refused layout is reported and the page reloads" pass.
- [x] 5.4 Add the keyboard move controls (Move up / Move down / Move to group; group Move up / Move down) with labelled subjects and a polite live region; verify `MetricSettingsPage.test.tsx` "A metric is moved to a group from the keyboard", "A group is moved up from the keyboard" and "Moves that go nowhere are not offered" pass.
- [x] 5.5 Run `npm run lint && npm run typecheck && npm run test`; verify all pass, including `contrast.test.ts` for any new tokens (drop indicator on `--line-control`).

## 6. End to end and documentation

- [x] 6.1 Extend `e2e/configure-metrics.spec.ts` with a flow: a leader adds the groups "Quality" and "Finance", drags a metric into "Quality" (`locator.dragTo`), moves "Finance" above "Quality" from the keyboard, deletes an empty group, then opens the board and sees the tiles in that order; verify `npm run test:e2e` passes against `docker compose up`.
- [x] 6.2 Update CLAUDE.md (*Current state*: groups are a board's own, arranged on the settings page; the placement no longer has a group label) and the `design.md` link in the PR description; verify the text matches the shipped behaviour.
- [x] 6.3 Run `openspec validate add-metric-groups --strict`; verify it reports the change valid.

## Workflow follow-up

- Sync the delta specs with `/opsx:sync` and archive with `/opsx:archive` after the PR is merged.
