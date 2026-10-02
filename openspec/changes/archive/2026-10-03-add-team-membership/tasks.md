## 1. Backend: schema and migration

- [x] 1.1 Add `Employee` and `TeamMember` models to `backend/app/models/` (an `employees` table with the email check constraint and unique email; a `team_members` table with the composite primary key, `is_leader`, the partial unique index on `team_id WHERE is_leader`, and the `employee_id` index), plus a `Team.members` relationship, and export them from `app/models/__init__.py`. Verify that `uv run mypy app` is clean.
- [x] 1.2 Write `alembic/versions/0002_add_employees_and_team_members.py`. It refuses to run when `teams` holds rows, with a message naming `docker compose down -v`, creates both tables with the FKs (`CASCADE` from teams, `RESTRICT` from employees) and the indexes from 1.1, and drops them on downgrade. Verify that `alembic upgrade head`, `downgrade -1` and `upgrade head` succeed on an empty database, that upgrade fails with the message when a team exists, and that `alembic check` reports no drift from the models.

## 2. Backend: validation and errors

- [x] 2.1 Add an email-normalising validator to `app/schemas/` (trim, lower-case, then the blank / too-long / invalid rules raising `PydanticCustomError` with the `employee_email.*` codes) and use it for `TeamCreate.leader_email` and a new `MemberAdd.email`. Verify that unit tests in `tests/unit/test_employee_email.py` cover every case in the email scenarios, including the 254/255-character boundary, `a@b`, `@b.c`, `a@@b.c`, `a@.bc`, `a@bc.` and an inner space.
- [x] 2.2 Add `TeamNotFoundError`, `DuplicateMemberError`, `MemberNotFoundError`, `LeaderRemovalError` and `LeaderNotMemberError` to `app/core/exceptions.py`, with the statuses, fields and codes from the design's table. Verify with a unit test that each one maps to its status and error body through the existing handler.
- [x] 2.3 Extend `TeamRead` with `leader` and `member_count`, and add `MemberRead`, `TeamDetail` and `LeaderChange` to `app/schemas/team.py`. Verify that `uv run mypy app` is clean and that the OpenAPI document lists the new shapes.

## 3. Backend: services

- [x] 3.1 Add `get_or_create_employee(session, email)` using `INSERT ... ON CONFLICT (email) DO NOTHING` followed by a select, with no commit of its own. Verify with an integration test that calling it twice with the same email returns one row, and that a rolled-back caller leaves no row behind.
- [x] 3.2 Change `register_team` to take `leader_email` and add the leader's membership before the single commit. Verify that the updated `test_register_a_team_with_its_board.py` has one test per scenario in the modified requirement, including that a duplicate name records no employee.
- [x] 3.3 Extend `list_teams` so that each team carries its leader and member count without a query per team. Verify that `test_retrieve_the_registered_teams.py` has one test per scenario, including "Member count follows membership changes", and that a test asserts a fixed number of SQL statements for a list of three teams.
- [x] 3.4 Add `get_team`, `add_member` and `remove_member` to `app/services/teams.py`, mapping the primary-key violation to `DuplicateMemberError` and rejecting removal of the leader. Verify that `test_read_a_team_with_its_members.py`, `test_add_a_member_to_a_team.py` and `test_remove_a_member_from_a_team.py` each hold one test per scenario.
- [x] 3.5 Add `change_leader`, which locks the team row `FOR UPDATE`, unsets the old flag, flushes, then sets the new one, and is a no-op for the current leader. Verify that `test_hand_over_the_leadership_of_a_team.py` holds one test per scenario, the concurrent one running two sessions on separate connections and asserting exactly one leader afterwards.
- [x] 3.6 Verify the cross-team rules with `test_an_employee_may_belong_to_and_lead_many_teams.py`, one test per scenario, and the employee rules with `test_employees_are_identified_by_email.py`, one test per scenario.

## 4. Backend: API

- [x] 4.1 Add `GET /teams/{team_id}`, `POST /teams/{team_id}/members`, `DELETE /teams/{team_id}/members/{employee_id}` and `PUT /teams/{team_id}/leader` to `app/api/teams.py`, each only validating input and delegating. Verify that the integration tests from section 3 pass through the HTTP client, that a non-UUID path id returns 422 with `request.invalid_field`, and that `uv run ruff check . && uv run ruff format --check . && uv run mypy app` passes.
- [x] 4.2 Log registration, member added, member removed and leadership handed over at INFO, with the team id and the employee email only. Verify with a `caplog` assertion in one test per event.
- [x] 4.3 Run `uv run pytest --cov=app --cov-report=term-missing` and verify that coverage is at or above 85% and has not dropped.

## 5. Frontend: API client and catalogues

- [x] 5.1 Extend `frontend/src/api/teams.ts` with `leader` and `memberCount` on `Team` (or the API's field names, kept consistent with the existing client), the `TeamDetail` and `Member` types, `createTeam(name, leaderEmail)` and `getTeam`, `addMember`, `removeMember` and `makeLeader`. Verify that `npm run typecheck` passes.
- [x] 5.2 Add the team-page and members-page strings and the eight new error codes to `en.ts` and `pl.ts`, using the Polish vocabulary in the design. Verify that `npm run typecheck` fails when a key is in one catalogue only, and that the existing parity test passes.

## 6. Frontend: pages

- [x] 6.1 Add the leader email field to the registration form in `TeamsPage.tsx`, with its own error slot, and show each listed team's leader email, member count and a link to its members page. Verify that `TeamsPage.test.tsx` covers "A team is registered with its leader from the page" and "A rejected leader email is shown on its field".
- [x] 6.2 Add `useTeam`, `useAddMember`, `useRemoveMember` and `useMakeLeader` to `features/teams/useTeams.ts`, writing the response with `setQueryData` and invalidating `['teams']` exactly. Verify with a hook test that a mutation's response replaces the cached detail without a second fetch.
- [x] 6.3 Build `features/teams/TeamMembersPage.tsx` (heading, member list with a worded leader marker, add-member form, and remove and make-leader actions on every non-leader, plus loading, failure and not-found states) and route it at `teams/:teamId/members` in `routes.tsx`. Verify that `TeamMembersPage.test.tsx` holds one test per remaining page scenario: add, duplicate, remove, the leader offering no remove action, handover, missing team, and reading in Polish.

## 7. End-to-end and verification

- [x] 7.1 Update `frontend/e2e/register-a-team.spec.ts` to supply a unique leader email and assert the leader shown in the list. Verify that `npm run test:e2e` passes.
- [x] 7.2 Add `frontend/e2e/manage-team-members.spec.ts`: register a team, open its members page, add two members, make one the leader, remove the previous leader, then repeat the check in Polish. Verify that `npm run test:e2e` passes against the Compose stack.
- [x] 7.3 Run all the gates: `uv run pytest --cov=app`, `uv run ruff check . && uv run ruff format --check . && uv run mypy app`, and `npm run lint && npm run typecheck && npm run test && npm run test:e2e`. Verify that all pass.
- [x] 7.4 Bring the stack up from clean with `docker compose down -v && docker compose up -d --build && docker compose exec backend alembic upgrade head`, then register a team and manage its members in the browser. Verify that it works end to end in both languages and both themes.

## 8. Documentation

- [x] 8.1 Update `CLAUDE.md`: in the current-state paragraph, move employees, membership and the leader out of "agreed but not built"; remove "Whether one employee can be team leader of more than one team" from the open decisions; and record that a team's leader is required and is a member. Verify that no statement says membership is unbuilt.
- [x] 8.2 Replace the "indicators" sentence in the Purpose of `openspec/specs/team-board/spec.md` at sync time, so that it says metrics hang off a board. Verify with `grep -i indicator openspec/specs/team-board/spec.md`, which should return nothing.
- [x] 8.3 Note in `README.md` that a database created before this change must be reset with `docker compose down -v`. Verify that the note sits next to the migration command.
- [x] 8.4 Write the PR description: what and why, the breaking change to `POST /teams`, no new dependencies, and a link to this change's `design.md` for the leadership-flag and handover-locking decisions. Verify that it mentions the migration's refusal to run over existing teams.
