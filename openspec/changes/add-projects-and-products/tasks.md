# Tasks

Every scenario in the delta specs maps onto one named test, given in the
task that implements it. Backend integration tests follow the existing
convention: one file per requirement (`test_<requirement>.py`) and one
function per scenario (`test_<scenario>`). New scenarios on an existing
requirement go into that requirement's existing file.

## 1. Schema

- [x] 1.1 Add the `Project` and `Product` models in `app/models/project.py`
  per design decision 1. Add `Metric.project_id` and `Metric.product_id`
  with the composite foreign keys, `ck_metrics_one_parent`, the replaced
  `ck_metrics_derivation_own` and the three partial name indexes (design
  decisions 2 and 3). Add `Metric.project` and `Metric.product` as joined
  relationships. Write `alembic/versions/0014_add_projects_and_products.py`,
  with the downgrade caveat in its docstring.
  - Verify `uv run alembic upgrade head` on an empty database.
  - Verify downgrade then upgrade on the dev database.
  - Verify `uv run mypy app`.

## 2. Projects and products (API)

- [x] 2.1 Add the request and read schemas in `app/schemas/project.py`,
  with Pydantic validation carrying the codes in design decision 7. Add the
  `DomainError` subclasses for `project_code.duplicate`,
  `product_name.duplicate`, `project.not_found`, `product.not_found`,
  `project.has_values` and `product.has_values`.
  - Verify with `tests/unit/test_project_schemas.py`: blank and long codes
    and names, end date before start, and Jira links that are relative,
    `ftp` or over 2000 characters.
- [x] 2.2 Implement `app/services/projects.py` for both entities:
  - add, change, list, read and status changes;
  - name the manager or owner through `get_or_create_employee`;
  - a pure `past_end(active, end_date, today)`, called with `today()` from
    `app/core/time.py`;
  - delete, refusing while any metric has a value (the derivation-source
    refusal comes in 5.2).

  Add the routers `app/api/projects.py` and `app/api/products.py`, gated by
  `can_configure_board` for writes.
  - Verify with `tests/unit/test_an_active_project_past_its_end_date_is_flagged.py`:
    `test_an_active_project_past_its_end`, `test_a_project_ending_today`,
    `test_an_inactive_project_is_never_flagged`.
  - Verify with `tests/integration/test_register_a_project.py`:
    `test_a_project_is_added`, `test_the_code_is_taken_in_another_team`,
    `test_code_or_name_is_blank_or_too_long`,
    `test_the_end_is_before_the_start`, `test_a_project_lasting_one_day`.
  - Verify with `tests/integration/test_register_a_product.py`:
    `test_a_product_is_added`, `test_a_product_without_a_jira_board`,
    `test_the_name_is_taken_in_the_team`,
    `test_two_teams_have_a_product_of_the_same_name`,
    `test_name_is_blank_or_too_long`, `test_the_link_is_not_a_web_address`.
  - Verify with
    `tests/integration/test_a_project_manager_or_product_owner_is_named_by_email.py`:
    `test_a_manager_from_outside_the_team`,
    `test_naming_someone_gives_no_permission`,
    `test_the_email_is_malformed`.
  - Verify with `tests/integration/test_change_a_project_or_a_product.py`:
    `test_a_project_is_extended_and_handed_over`,
    `test_a_products_link_is_removed`,
    `test_a_change_breaking_a_rule_is_refused`.
  - Verify with
    `tests/integration/test_deactivate_and_reactivate_a_project_or_a_product.py`:
    `test_a_project_is_deactivated`, `test_a_project_is_reactivated`,
    `test_the_end_date_passes`.
  - Verify with `tests/integration/test_delete_a_project_or_a_product.py`:
    `test_a_project_without_values_is_deleted`,
    `test_deleting_a_project_with_values_is_refused`,
    `test_deleting_a_product_with_values_is_refused`.
  - Verify with
    `tests/integration/test_list_and_read_a_teams_projects_and_products.py`:
    `test_projects_are_listed_by_code`, `test_a_project_of_another_team`.
  - Verify with `tests/integration/test_employees_are_identified_by_email.py`:
    `test_a_project_manager_is_recorded_on_being_named`.
  - Verify with
    `tests/integration/test_a_teams_leader_manages_its_projects_and_products.py`:
    `test_a_deputy_adds_a_product`,
    `test_an_ordinary_member_cannot_manage_projects`,
    `test_an_administrator_manages_any_teams_projects`,
    `test_a_leader_cannot_manage_another_teams_projects`,
    `test_anyone_signed_in_reads_projects_and_products`. The other two
    scenarios in that file are verified in 3.1 and 4.2.
- [x] 2.3 Mirror the types and calls in `frontend/src/api/projects.ts` and
  `frontend/src/api/products.ts`. Add every new error code and the Polish
  terms of design decision 8 to `en.ts` and `pl.ts`.
  - Verify `npm run typecheck`.
- [x] 2.4 Update `CLAUDE.md`:
  - add Project and Product rows to the domain model;
  - add *Project*, *Product*, *Project manager* and *Product owner* to the
    glossary, saying that a project's or product's metric is a board's own
    metric that belongs to it, is never derived, and is retired while its
    project or product is inactive.
  - Verify by reading it against the spec.

## 3. A project's or product's metrics (API)

- [x] 3.1 Extend metric creation in `app/services/metrics.py` and
  `app/schemas/metric.py`:
  - take `project_id` or `product_id`, refusing both with
    `metric.project_and_product`;
  - refuse a project or product of another team with `project.not_found` or
    `product.not_found`;
  - `hidden` defaults to true for these metrics;
  - the owner defaults to the manager or owner when they are a member;
  - limit the global-name clash check to metrics with neither.

  Carry `project` and `product` on every metric read, the board's tiles and
  derivation sources included (design decision 5).
  - Verify with `tests/integration/test_a_projects_or_products_metric.py`:
    `test_a_metric_is_added_to_a_project`,
    `test_a_projects_metric_takes_a_threshold_version`,
    `test_the_project_is_another_teams`.
  - Verify with
    `tests/integration/test_a_projects_or_products_metric_is_added_hidden.py`:
    `test_a_projects_metric_has_no_tile_at_first`,
    `test_a_projects_metric_is_shown_as_a_tile`.
  - Verify with
    `tests/integration/test_the_owner_of_a_projects_or_products_metric.py`:
    `test_the_manager_is_a_member`, `test_the_manager_is_not_a_member`,
    `test_another_member_is_named`.
  - Verify with
    `tests/integration/test_a_projects_or_products_metric_name_is_unique_within_it.py`:
    `test_two_projects_measure_the_same_thing`,
    `test_the_name_is_taken_in_the_project`.
  - Verify with `tests/integration/test_define_a_metric_on_a_board.py`:
    `test_a_projects_metric_does_not_take_the_boards_name`.
  - Verify with
    `tests/integration/test_a_teams_leader_manages_its_projects_and_products.py`:
    `test_a_member_records_a_projects_metric`.
- [x] 3.2 Refuse a derivation on these metrics, at create and change, with
  `derivation.project_metric` or `derivation.product_metric`. Refuse
  copying one with `metric_copy.source_project` or
  `metric_copy.source_product`.
  - Verify with
    `tests/integration/test_a_projects_or_products_metric_is_never_derived.py`:
    `test_a_derivation_on_a_projects_metric_is_refused`,
    `test_a_derivation_on_a_products_metric_is_refused`.
  - Verify with `tests/integration/test_copy_a_metric_from_another_board.py`:
    `test_a_projects_or_products_metric_is_not_copied`.
- [x] 3.3 Mirror `project_id`, `product_id`, the optional `hidden` and the
  `project` and `product` read fields in `frontend/src/api/metrics.ts`.
  - Verify `npm run typecheck`.

## 4. Inactive means retired (API)

- [x] 4.1 Add `active_placement()` and extend `BoardMetric.retired` (design
  decision 4). Switch to it:
  - the board read and `owing_by_meeting` (`metric_values.py`);
  - the derivation's source read (`metric_values.py`);
  - the two dashboard counts (`dashboard.py`);
  - the recording check.
  - Verify that the existing suites for metric values, readiness,
    derivations and the dashboard pass unchanged.
- [x] 4.2 Cover inactivity across the readers.
  - Verify with
    `tests/integration/test_an_inactive_projects_or_products_metrics_are_retired.py`:
    `test_deactivating_stops_the_chase` (board tiles, completeness, the
    board's `owing` and the dashboard row together),
    `test_a_value_for_an_inactive_projects_metric_is_refused`,
    `test_history_stays_readable`,
    `test_reactivating_restores_the_metrics`.
  - Verify with `tests/integration/test_a_projects_or_products_metric.py`:
    `test_a_metric_of_an_inactive_project`.

## 5. Derivation sources (API)

- [x] 5.1 Confirm that `check_derivation` accepts a project's metric as a
  source with no change, and that an inactive source leaves the derivation
  missing a number.
  - Verify with
    `tests/integration/test_a_projects_or_products_metric_may_be_a_source.py`:
    `test_another_team_sums_two_projects`,
    `test_a_source_from_an_inactive_project`.
- [x] 5.2 Refuse deleting a project or product while any of its metrics is
  a derivation source, with `metric.derivation_source`.
  - Verify with `tests/integration/test_delete_a_project_or_a_product.py`:
    `test_deleting_a_project_whose_metric_is_a_source_is_refused`.

## 6. The metric label (frontend)

- [x] 6.1 Add `metricLabel()` beside the metric API types. Use it on the
  tiles, in the metric detail, in the recording view, in the readiness
  panel, on the settings page and in the derivation source picker. Hide the
  derivation editor for a project's or product's metric.
  - Verify with `BoardPage.test.tsx`: `a tile names the project`.
  - Verify with `ReadinessPanel.test.tsx`: `the readiness panel names the
    product`.
  - Verify with `MetricSettingsPage.test.tsx`: `no derivation is offered
    for a project's metric`.
  - Verify with `metricLabel.test.ts`: the label for a project, a product
    and neither.
- [x] 6.2 On the settings page, show a metric of an inactive project or
  product as retired with a note saying why, and offer no "Bring back"
  (its placement's switch is not what retired it), as for a global metric
  retired in the catalogue. Found in review.
  - Verify with `MetricSettingsPage.test.tsx`: `the settings page offers no
    bring-back while the project is inactive`.

## 7. The projects and products page (frontend)

- [x] 7.1 Add `features/projectsAndProducts/ProjectsAndProductsPage.tsx`
  at `/teams/:teamId/projects-and-products`, linked from the team's pages
  under the back-link convention:
  - the two lists, with status, manager or owner by display name, and a
    project's dates and past-end mark;
  - add and edit dialogs in `components/Modal.tsx`, and deactivate,
    reactivate and delete, all offered only to whoever may configure the
    board;
  - the refused deletion explained.
  - Verify with `ProjectsAndProductsPage.test.tsx`:
    `a leader adds a project`, `a member sees no controls`,
    `a refused deletion is explained`, `an active project past its end is
    marked`.

## 8. A project's or product's page (frontend)

- [x] 8.1 Add `ProjectPage.tsx` and `ProductPage.tsx` at
  `/teams/:teamId/projects/:projectId` and
  `/teams/:teamId/products/:productId`:
  - the details, and the Jira link opening in a new tab;
  - each metric's bare name, latest value with its status, a sparkline
    from its `/trend`, and a "Not on board" mark with a show/hide switch;
  - add a metric, record its threshold versions, retire it and delete it,
    reusing the settings page's metric dialog and threshold form;
  - no recording control, and an inactive mark, on an inactive one.
  - Verify with `ProjectPage.test.tsx`:
    `the page shows a metric's latest value and trend`,
    `a metric is added from the project page`,
    `the project page uses the bare name`,
    `an inactive project's page`.
  - Verify with `ProductPage.test.tsx`:
    `the Jira link opens the board`.
- [x] 8.2 Update `CLAUDE.md`'s *Current state*: `projects-and-products` is
  implemented, with its routes and the rule that inactive means retired.
  - Verify by reading it against the spec.

## 9. End to end

- [x] 9.1 Add `e2e/projects-and-products.spec.ts`:
  - a leader adds a project and a metric to it;
  - shows the metric on the board;
  - a member records its value;
  - the tile reads "PRJ-… · …";
  - deactivating the project removes the tile.

  Extend `e2e/configure-metrics.spec.ts` so another team's derived `sum`
  takes that project metric as a source.
  - Verify `npm run test:e2e` passes for both specs.

## 10. Integration

- [x] 10.1 Run the full gates:
  - `uv run ruff check . && uv run ruff format --check . && uv run mypy app`
  - `uv run pytest --cov=app` (coverage not below the current figure)
  - `npm run lint && npm run typecheck && npm run test`
  - `npm run test:e2e`

  Verify all are green.
- [x] 10.2 With `docker compose up`:
  - register a project with a manager from outside the team, and a product
    with a Jira link;
  - give each a metric and show one on the board;
  - record values at the next meeting;
  - check the readiness panel's labels;
  - deactivate the project and see its owner stop owing data;
  - reactivate it.

  Verify each step by hand.

## Workflow follow-up

- Archive the change after review, and sync its deltas into
  `openspec/specs/`.
