## 1. Prerequisite and schema

- [x] 1.1 Confirm that `add-pulse-check` is synced and archived, so that `openspec/specs/` holds its `authorization` and `meetings` deltas, and branch `feature/problems-and-tasks` from `main`. Verify that `openspec validate add-problems-and-tasks --strict` passes.
- [x] 1.2 Add `Stage` to `app/core/item_enums.py` and the `Problem` and `Task` models (columns, the `stage`/`closed_at` check, text-length checks, `RESTRICT`/`SET NULL` foreign keys as design.md lists them, the two indexes), exported from `app/models/__init__.py`. Verify that `uv run mypy app` is clean.
- [x] 1.3 Write `alembic/versions/0007_add_problems_and_tasks.py`. Verify that `upgrade head`, `downgrade -1` and `upgrade head` succeed on an empty database and on one holding teams, meetings, metric values and pulse answers, that `alembic check` reports no drift, and that inserting a problem at `act` with no `closed_at` directly in SQL is refused by the check constraint.

## 2. The lifecycle rule (pure)

- [x] 2.1 Implement `meeting_of_the_moment`, `apply_stage` and `is_overdue` in `app/services/item_lifecycle.py`, with no I/O. Verify with `tests/unit/test_item_lifecycle.py` covering: no meetings, only past meetings, a meeting today, a past and a future meeting; closing, staying active, moving back; due yesterday, today, none, and closed.
- [x] 2.2 Add `tests/features/item_lifecycle.feature` with step definitions in `tests/features/steps/`, stating in plain language the scenarios of *Progress is a PDCA stage*, *A closed item is archived* (closing, raised as done) and *The meetings at which an item was raised and closed* (before the coming meeting, at the meeting, after the last with none opened, no meetings), against the pure functions. Verify that `uv run pytest tests/features` passes.

## 3. Backend: validation, errors and schemas

- [x] 3.1 Add `ProblemCreate`, `ProblemChange`, `ProblemRead`, `TaskCreate`, `TaskChange`, `TaskRead` to `app/schemas/` (trimmed texts, the limits, blank summary refused, partial change through `model_fields_set`, `null` clearing optional fields). Verify that `tests/unit/test_item_schemas.py` covers a missing, blank and 501-character summary, a 4001-character text in each text field, an unknown stage, a malformed date and a change with only `due_on`, each with its published code and field.
- [x] 3.2 Add the eight domain errors of design.md's table to `app/core/exceptions.py`. Verify with `tests/unit/test_domain_errors.py` that each maps to its status and code through the existing handler.
- [x] 3.3 Verify that `tests/unit/test_permission_is_decided_per_team_not_per_role.py` has rows showing `may_record_meeting_data` grants a member, a leader and an administrator stranger and refuses a stranger, adding them if absent. No new permission function is needed.

## 4. Backend: services and API

- [x] 4.1 Add `app/services/problems.py` and `POST`/`PATCH /teams/{team_id}/problems…`: same-team checks, responsible a member, metric on the board, row lock, archive guard, meeting attribution through `meeting_of_the_moment`. Verify that `tests/integration/test_raise_a_problem.py`, `test_change_a_problem_or_a_task.py` (problem half), `test_the_responsible_person_is_a_member_of_the_team.py` and `test_a_linked_metric_is_on_the_teams_board.py` each hold one test per scenario.
- [x] 4.2 Add `app/services/tasks.py` and `POST`/`PATCH /teams/{team_id}/tasks…`, with the task's problem checks. Verify that `test_raise_a_task.py` and the task half of `test_change_a_problem_or_a_task.py` hold one test per scenario.
- [x] 4.3 Add `GET /teams/{team_id}/problems` and `…/tasks` with `state=active|archived`, ordering and `overdue`. Verify that `test_list_a_teams_problems_and_tasks.py` holds one test per scenario, with today pinned the way `pulse_api.freeze_today` does it (monkeypatching `today`).
- [x] 4.4 Verify that `test_progress_is_a_pdca_stage.py`, `test_a_closed_item_is_archived.py` (including the 405 on `DELETE` and two concurrent closes, the second getting `…archived`) and `test_the_meetings_at_which_an_item_was_raised_and_closed.py` (including deleting the meeting) each hold one test per scenario through the API.
- [x] 4.5 Wire the guards. Verify that `test_a_teams_members_keep_its_problems_and_tasks.py` holds one test per scenario, and that `test_anyone_signed_in_may_read.py` gains reading a team's active and archived items as a stranger.
- [x] 4.6 Log raised, stage changed and closed at INFO with kind, item id, team id and the actor's email. Verify with a `caplog` assertion in `test_problem_and_task_events_are_logged.py` that the texts do not appear.
- [x] 4.7 Run `uv run ruff check . && uv run ruff format --check . && uv run mypy app` and `uv run pytest --cov=app --cov-report=term-missing`. Verify that everything passes and coverage stays at or above 85% without dropping.

## 5. Backend: the hub

- [x] 5.1 Give `build_hub_summary` a session; compute the funnel and the assigned items from the two tables as design.md describes; change `Funnel` and `AssignedItem` in `app/schemas/hub.py`; delete the item and funnel constants from `app/services/hub.py`. Verify that the hub's integration tests gain *The funnel counts the recorded items of the user's teams*, *A user on no team*, *Only the user's active items are assigned* and *An assigned item's summary is returned as typed*, that *Prose carries both languages* and *States are returned as codes* are updated to the new shape, that *Both the overdue and the on-time case are present* is deleted, and that the next-meeting tests still pass.
- [x] 5.2 Verify that a test asserts a fixed number of SQL statements for the hub of a person on three teams with twenty items, and rerun the backend gates of 4.7.

## 6. Frontend: foundations

- [x] 6.1 Add `src/api/items.ts` (types and `getProblems`, `getTasks`, `createProblem`, `changeProblem`, `createTask`, `changeTask`) and `features/board/items/useItems.ts` with the queries and mutations invalidating both states of the kind and `['hub']`. Verify with a hook test that closing an item refetches the active and archived lists.
- [x] 6.2 Update `src/api/hub.ts` to the new `Funnel` and `AssignedItem` shape and `boardFixture.ts`/hub fixtures to match. Verify that `npm run typecheck` passes.
- [x] 6.3 Add the `items.*`, `pdca.*` and `archive.*` strings and the eleven codes to `en.ts` and `pl.ts` with design.md's wording, removing `items.progress`. Verify that `npm run typecheck` and `catalogues.test.ts` pass.
- [x] 6.4 Add the `--pdca-*` tokens to `theme.css` for both themes. Verify that `contrast.test.ts` passes with them held to 3:1.

## 7. Frontend: the board

- [x] 7.1 Build `PdcaBall` and `ItemEntry`. Verify with tests that each stage is named in words beside the symbol and in its accessible name, and that an overdue entry says so in words (*The overdue mark and the stage are not colour alone*).
- [x] 7.2 Build `ItemLists` and place it beside the tiles in `BoardPage`'s metrics view, collapsing below 1100px. Verify that `ItemLists.test.tsx` covers *The lists are shown*, *New at this meeting*, *Closed at this meeting*, *The lists do not depend on the meeting shown* and *Nothing is open*.
- [x] 7.3 Build `ItemDialog` for both kinds, with the confirmation before `act` and *Raise a task from this problem*. Verify that `ItemDialog.test.tsx` covers *A problem is added*, *A stage is moved on from the list*, *Closing is confirmed*, *A task is raised from a problem* and *A rejection is shown in the active language*.
- [x] 7.4 Build `ArchivedView` and the *Archived* entry of the view switch, kept in `?view=archived`. Verify that `ArchivedView.test.tsx` covers *The archived items are listed*, *The view has its own address* and *Nothing has been archived*, and that the pulse view's address tests still pass.
- [x] 7.5 Offer controls only as permitted. Verify that `features/board/permissions.test.tsx` gains the three scenarios of *The problems and tasks offer only what their viewer may do*.

## 8. Frontend: the hub

- [x] 8.1 Show the stage with `PdcaBall` and its name instead of the percentage in `AssignedItems`, link each item to its team's board, and state the funnel's scope as a number of teams. Verify that `HubPage.test.tsx` covers *Assigned items are displayed*, *An overdue item is distinguished*, *An assigned item leads to its board* and *The funnel states what it covers* on the new shape, and that `npm run lint && npm run typecheck && npm run test` passes.

## 9. End-to-end and documentation

- [x] 9.1 Add `frontend/e2e/problems-and-tasks.spec.ts`: in Polish, a member adds a problem with a reason, raises a task from it with themselves responsible and a past due date, sees it marked overdue and new, steps the task's ball to `check`, closes it with confirmation, finds it in *Zarchiwizowane* with its meetings, and sees it gone from their hub list while the hub funnel counts it as archived; a stranger sees the lists with no controls. Verify that `npm run test:e2e` passes.
- [x] 9.2 Update CLAUDE.md: the Problem and Task rows of the domain table (stage, responsible, metric, task's problem, raised/closed meetings), **Problem**, **Task** and **PDCA stage** in the glossary, the hub's real slice under *Current state*, the resolved half of the open decision on tying items to meetings, and the GUI flows in *Testing*. Update the README if it lists the board's features. Verify by reading the diff.
- [ ] 9.3 On a fresh volume, register a team of three, open last week's and this week's meetings, raise two problems and three tasks across members, close one task, and check the board, the Archived view and the hub as a member, a stranger and an administrator; then delete a meeting at which an item was raised. Verify that it works end to end and the item then shows no raising meeting.

## Workflow follow-up

- Sync the delta specs and archive the change after review (`/opsx:archive`).
- Candidates for follow-up changes: reopening an archived item; a per-team running number; turning a pulse answer into a task; the hub's preparation counts from real data; search and filters on the lists; importing the legacy board's items.
