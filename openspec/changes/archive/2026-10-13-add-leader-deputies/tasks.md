# Tasks

Test names follow the repo convention: a backend integration module per
requirement (`test_<requirement>.py`) with a function per scenario, and a
frontend `it('<Scenario name>')` inside a `describe('<Requirement>')`.

## 1. Persistence

- [x] 1.1 Add `is_deputy` to `TeamMember` in `backend/app/models/employee.py` with the check constraint `ck_team_members_not_leader_and_deputy` (design D1), and write the Alembic migration numbered after the current head; verify `uv run alembic upgrade head` on an empty database and `uv run alembic downgrade -1 && uv run alembic upgrade head` both succeed.
- [x] 1.2 Add an integration test that inserting a membership with both flags set is refused by the database; verify it passes.

## 2. Authorization rules

- [x] 2.1 Add `Relationship.DEPUTY` and `may_appoint_deputies` to `app/services/authz.py`, and widen the sets per design D2; make `relationship_to` in `app/api/dependencies.py` return `DEPUTY`. Verify with `tests/unit/test_permission_is_decided_per_team_not_per_role.py`: add `test_a_deputy_configures_their_own_board`, `test_a_deputy_manages_ordinary_membership`, `test_only_a_leader_or_an_administrator_appoints_deputies`, `test_a_deputy_cannot_hand_over_leadership`, and extend every parametrised "anyone on the team" test to include `DEPUTY`; all pass.
- [x] 2.2 Update the module docstrings in `authz.py` that say a leader is "the one thing a leader does" so they name deputies, and verify `uv run ruff check . && uv run mypy app` pass.

## 3. Membership services and API

- [x] 3.1 Add `appoint_deputy` and `revoke_deputy` to `app/services/teams.py`, the `TeamDeputyNotMemberError` (`team_deputy.not_member`) and `TeamDeputyIsLeaderError` (`team_deputy.is_leader`) in `app/core/exceptions.py`, and clear `is_deputy` on the new leader in `change_leader` (design D5). Verify with the integration modules below.
- [x] 3.2 Add `PUT` and `DELETE /teams/{team_id}/deputies/{employee_id}` in `app/api/teams.py` gated by `may_appoint_deputies`, and make `DELETE /teams/{team_id}/members/{employee_id}` require `may_appoint_deputies` when the target is a deputy (design D3). Add `is_deputy` to `MemberRead`. Verify `GET /openapi.json` lists both routes.
- [x] 3.3 Write `tests/integration/test_appoint_a_leader_deputy.py` with `test_a_member_is_appointed_deputy`, `test_a_team_has_several_deputies`, `test_a_deputy_is_appointed_again`, `test_the_leader_cannot_be_a_deputy`, `test_the_deputy_is_not_a_member`, `test_a_deputy_of_a_team_that_does_not_exist`; verify they pass.
- [x] 3.4 Write `tests/integration/test_revoke_a_leader_deputy.py` with `test_a_deputy_is_revoked`, `test_revoking_a_member_who_is_not_a_deputy`, `test_revoking_someone_who_is_not_a_member`; verify they pass.
- [x] 3.5 Write `tests/integration/test_deputies_are_independent_per_team.py` with `test_a_deputy_here_leads_elsewhere`; verify it passes.
- [x] 3.6 Extend `test_read_a_team_with_its_members.py` (`test_a_team_is_returned_with_its_deputies`, and assert `is_deputy` false in the existing scenario), `test_remove_a_member_from_a_team.py` (`test_a_deputy_is_removed`) and `test_hand_over_the_leadership_of_a_team.py` (`test_leadership_passes_to_a_deputy`); verify they pass.

## 4. Authorization at the API

- [x] 4.1 Write `tests/integration/test_a_leader_deputy_stands_in_for_the_leader.py` with `test_a_deputy_configures_the_board`, `test_a_deputy_manages_ordinary_members`, `test_a_deputy_cannot_hand_over_the_leadership`, `test_a_deputys_authority_does_not_reach_another_team`, `test_revoking_a_deputy_removes_the_authority`; verify they pass.
- [x] 4.2 Write `tests/integration/test_only_a_teams_leader_or_an_administrator_chooses_its_deputies.py` with `test_a_leader_appoints_and_revokes_a_deputy`, `test_a_deputy_cannot_appoint_or_revoke_deputies`, `test_a_deputy_cannot_remove_another_deputy`, `test_an_ordinary_member_cannot_appoint_a_deputy`, `test_an_administrator_appoints_a_deputy_of_any_team`; verify they pass.
- [x] 4.3 Add `test_deputyship_comes_from_the_teams_records` to the per-team permission tests, and reword the "ordinary member" scenarios in `test_a_teams_leader_manages_that_teams_membership.py`, `test_a_teams_leader_sets_its_meeting_schedule.py` and `test_a_teams_leader_configures_its_metrics_and_thresholds.py` to use a member who is neither leader nor deputy; verify the suites pass.

## 5. Dashboard role

- [x] 5.1 Widen `TeamRole` to `leader | deputy | member` in `app/schemas/dashboard.py` and derive it in `app/services/dashboard.py` from both flags; add `test_the_viewers_role_is_shown_per_team` to the dashboard teams integration module and verify the three codes come back.
- [x] 5.2 Widen `TeamRole` in `frontend/src/api/dashboard.ts`, add `myTeams.role_deputy` ("Leader deputy" / "Zastępca lidera") to both catalogues, and add `it('The viewer\'s role is shown per team')` to `DashboardPage.test.tsx` covering both languages; verify `npm run test` and `npm run typecheck` pass.

## 6. Frontend: who may do what

- [x] 6.1 Add `is_deputy` to the member type in `frontend/src/api/teams.ts`, and the `appointDeputy` / `revokeDeputy` wrappers with their TanStack mutations in `useTeams.ts`; verify `useTeams.test.tsx` covers both and passes.
- [x] 6.2 Add `teamAuthority` in `features/teams/` (design D7) with a unit test over leader, deputy, member, stranger and administrator; replace the checks in `TeamMembersPage.tsx`, `BoardPage.tsx`, `TeamMeetingsPage.tsx` and `MetricSettingsPage.tsx` with it; verify the existing `permissions.test.tsx` files still pass.
- [x] 6.3 Extend `features/teams/permissions.test.tsx` with `it('A leader sees the controls they may use')` (now including appoint/revoke), `it('A deputy sees the controls they may use')`, `it('An ordinary member sees no membership controls')` and `it('An administrator sees every control')`; extend `features/meetings/permissions.test.tsx` and the metric settings permissions test so a deputy is offered the schedule and metric controls; verify they pass.

## 7. Frontend: the members page

- [x] 7.1 Mark deputies on `TeamMembersPage.tsx` with the word "Leader deputy" beside the email, and offer "Make deputy" / "Revoke deputy" per member to a viewer allowed to choose deputies, with remove offered on a deputy only to that viewer; add the strings (captions and `aria-label`s naming the member) and the error codes `team_deputy.not_member`, `team_deputy.is_leader` to `en.ts` and `pl.ts`; verify `npm run typecheck`.
- [x] 7.2 In `TeamMembersPage.test.tsx`, add `it('A deputy is appointed from the members page')` and `it('A deputy is revoked from the members page')`, and extend `it('A member is added from the members page')`, `it('The leader offers no remove action')` and `it('The members page reads in Polish')` for the deputy marker and actions; verify they pass.
- [x] 7.3 Extend `frontend/e2e/manage-team-members.spec.ts`: the leader appoints a deputy, the deputy signs in and adds a metric on the metric settings page, the leader revokes them; verify `npm run test:e2e` passes against `docker compose up`.

## 8. Documentation

- [x] 8.1 Add **Leader deputy** (*zastępca lidera*) to the glossary in `CLAUDE.md`, update the authorization summary there ("a team's leader or its deputies configure..."), and add the deputy column, the two deputy endpoints and the target-aware removal rule to the permission table in `SECURITY.md`; verify the two documents agree by reading the table against design D2.

## 9. Integration check

- [x] 9.1 Run the full gates: `uv run pytest --cov=app` (coverage not below the current figure), `uv run ruff check . && uv run ruff format --check . && uv run mypy app`, `npm run lint && npm run typecheck && npm run test`; verify all pass.

## Workflow follow-up

- Sync the delta specs into `openspec/specs/` and archive the change once it is merged.
