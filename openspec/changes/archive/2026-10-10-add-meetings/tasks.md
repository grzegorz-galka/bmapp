## 1. Backend: schema and migration

- [x] 1.1 Spike, before writing models: on the compose PostgreSQL 18, run `CREATE UNIQUE INDEX` on `(team_id, ((starts_at AT TIME ZONE 'Europe/Warsaw')::date))` against a scratch table. Verify that it is accepted. If it is refused, switch to the design's fallback, an explicit `local_date` column, and record that in design.md before continuing.
- [x] 1.2 Add the `ORGANIZATION_TZ` constant to `app/core/`, the nullable `schedule_weekday` and `schedule_time` columns with their two check constraints on `BoardDefinition`, and a `Meeting` model (`team_id` cascade, `starts_at`, `host_employee_id` restrict, `created_at`, `created_by_email`, the unique index from 1.1, an index on the host), exported from `app/models/__init__.py`. Verify that `uv run mypy app` is clean.
- [x] 1.3 Write `alembic/versions/0003_add_meeting_schedule_and_meetings.py`. Verify that `alembic upgrade head`, `downgrade -1` and `upgrade head` succeed on an empty database and on one holding teams, and that `alembic check` reports no drift.

## 2. Backend: validation, errors and schemas

- [x] 2.1 Add `ScheduleSet` (weekday raising `PydanticCustomError` `schedule_weekday.out_of_range` outside 1–7; time `HH:MM`), `MeetingOpen` (`date`, `time`) and `MeetingChange` (optional `date`, `time`, `host_employee_id`, with absent told apart from null via `model_fields_set`) to `app/schemas/`. Verify that unit tests cover weekdays 0, 1, 7 and 8, `25:00`, a missing field, and absent versus null host.
- [x] 2.2 Add `MeetingDateTakenError`, `MeetingNotFoundError` and `MeetingHostNotMemberError` to `app/core/exceptions.py`, with the statuses, fields and codes from the design's table. Verify with a unit test that each maps to its status and error body through the existing handler.
- [x] 2.3 Add `ScheduleRead`, `MeetingRead`, `MeetingList` and `schedule` on `BoardRead`. Verify that `uv run mypy app` is clean and that the OpenAPI document lists the new shapes.

## 3. Backend: services

- [x] 3.1 Add pure functions `to_instant(date, time)`, `to_wall_clock(instant)` and `propose_next(schedule, taken_dates, today)` to `app/services/meetings.py`. Verify that `tests/unit/test_meeting_time.py` covers both DST edges of 2026, including the `fold=0` resolution, and that `tests/unit/test_propose_next.py` has one test per scenario of *Propose the date of the next meeting*.
- [x] 3.2 Add `set_schedule(session, team_id, weekday, time)` to `app/services/teams.py`, and include the schedule in `list_teams`. Verify that `test_set_a_boards_meeting_schedule.py` has one test per scenario, and that `test_retrieve_the_registered_teams.py` gains "A board's schedule is returned with its team".
- [x] 3.3 Add `open_meeting`, `list_meetings` (returning the schedule, the proposal using today in `ORGANIZATION_TZ`, and the meetings ordered by start), `change_meeting` and `delete_meeting`, mapping the unique-index violation to `MeetingDateTakenError` and checking host membership only when a host is set. Verify that `test_meeting_dates_and_times_are_local_to_the_organization.py`, `test_open_a_meeting.py`, `test_list_a_teams_meetings.py`, `test_move_a_meeting.py`, `test_name_the_host_of_a_meeting.py` and `test_delete_a_meeting.py` each hold one test per scenario, and that a rejected host in a combined `PATCH` leaves the date unchanged.

## 4. Backend: API

- [x] 4.1 Add `PUT /teams/{team_id}/schedule`, guarded by `may_configure_the_board`, to `app/api/teams.py`. Add a new `app/api/meetings.py` router with the four meeting endpoints, writes guarded by `may_record_meeting_data`, registered in `app/main.py`. Each endpoint only validates and delegates. Verify that the section 3 integration tests pass through the HTTP client, and that a non-UUID id returns 422 `request.invalid_field`.
- [x] 4.2 Verify the permission rules with `test_a_teams_leader_sets_its_meeting_schedule.py` and `test_a_teams_members_manage_its_meetings.py`, one test per scenario, each refusal asserting `auth.forbidden` and no change.
- [x] 4.3 Log schedule set, meeting opened, moved, re-hosted and deleted at INFO, with the team id, the meeting id and the acting email only. Verify with a `caplog` assertion per event.
- [x] 4.4 Run `uv run ruff check . && uv run ruff format --check . && uv run mypy app` and `uv run pytest --cov=app --cov-report=term-missing`. Verify that everything passes and coverage stays at or above 85% without dropping.

## 5. Frontend: API client, formatting and catalogues

- [x] 5.1 Add `src/api/meetings.ts` (types, `getMeetings`, `openMeeting`, `changeMeeting`, `deleteMeeting`) and `setSchedule` plus `schedule` on the board type in `src/api/teams.ts`. Verify that `npm run typecheck` passes.
- [x] 5.2 Add `formatMeetingDate`, `formatMeetingTime` and `formatScheduleWeekday` to `i18n/format.ts`, all in `Europe/Warsaw`. Verify that `format.test.ts` covers both languages, and a reader zone other than Warsaw still yielding Warsaw time.
- [x] 5.3 Add the meetings-page and team-list strings and the four new error codes to `en.ts` and `pl.ts`, using the design's Polish vocabulary. Verify that `npm run typecheck` and the catalogue parity test pass.

## 6. Frontend: pages

- [x] 6.1 Show each team's schedule (or "No schedule") and a link to its meetings page in `TeamsPage.tsx`. Verify with `TeamsPage.test.tsx`.
- [x] 6.2 Add `useMeetings`, `useOpenMeeting`, `useChangeMeeting`, `useDeleteMeeting` and `useSetSchedule` in `features/meetings/`, invalidating `['teams', teamId, 'meetings']`, and `['teams']` exactly for the schedule. Verify with a hook test that opening a meeting refetches the list and its proposal.
- [x] 6.3 Build `features/meetings/TeamMeetingsPage.tsx`: schedule display and form, upcoming and past lists, a prepare-next dialog pre-filled from the proposal, move / host / delete actions, and loading, failure and not-found states. Route it at `teams/:teamId/meetings`. Verify that `TeamMeetingsPage.test.tsx` holds one test per scenario of *Meetings are managed from the meetings page*.
- [x] 6.4 Offer controls by permission. Verify that `features/meetings/permissions.test.tsx` covers "An ordinary member manages meetings but not the schedule" and "A stranger sees the meetings and no controls", and that the existing members-page permission tests still pass.
- [x] 6.5 Run `npm run lint && npm run typecheck && npm run test`. Verify that all pass.

## 7. End-to-end and documentation

- [x] 7.1 Add `frontend/e2e/prepare-a-meeting.spec.ts` (the leader sets the schedule; a member prepares the next meeting from the proposal, names a host, moves it, prepares the following one; repeated in Polish). Verify that `npm run test:e2e` passes against `docker compose up`.
- [x] 7.2 Update CLAUDE.md's *Current state* (meetings implemented; hub still placeholder), extend the glossary with "Host", and add the meetings API to README if it lists endpoints. Verify by reading the diff that no convention is left stale.
- [x] 7.3 On a fresh volume (`docker compose down -v && docker compose up -d && docker compose exec backend alembic upgrade head`), register a team, set its schedule, and prepare two meetings through the UI. Verify that it works end to end.

## Workflow follow-up

- Sync the delta specs and archive the change after review (`/opsx:archive`).
- `add-metrics` must list `meetings` under Modified Capabilities, to refuse moving or deleting a meeting with recorded values.
