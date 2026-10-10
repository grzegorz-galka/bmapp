## Context

The persisted entities are `teams`, `board_definitions`, `employees` and `team_members`, from migrations `0001` and `0002`. `app/services/authz.py` already holds `may_configure_the_board` and `may_record_meeting_data`, written ahead of any caller so that this change would implement those rules rather than invent new ones. `BoardRead` is shared by the team list (`TeamRead`) and the team detail (`TeamDetail`). The hub computes placeholder "next meeting" instants with `next_occurrence()` in UTC. It stays placeholder here (see proposal.md, Impact).

The reference for this change is the single-team HTML tool the management board uses today. It keeps one record per week, keyed by the Wednesday date. A week exists only once someone presses "create week", and a week can carry its host before any data is entered. This change adopts that model, without the tool's copying of targets from week to week.

This change is the first of a sequence reached in exploration. Metrics come next, with red/amber/green status against thresholds that are versioned by an effective-from date, changed by the leader or an administrator with a mandatory reason, and allowed to be back-dated visibly. Those decisions belong to the `add-metrics` change. They are noted here only because they explain two choices below: the meeting's date has to be a single stable local date, and a meeting can still be moved or deleted in this change.

## Goals / Non-Goals

**Goals:**

- One meeting per team per local date, guaranteed by the database rather than by a read-then-write check.
- A wall-clock model that is correct across daylight-saving changes and gives the metrics change a single date to resolve thresholds against.

**Non-Goals:**

- Generating meetings from the schedule. Option B was rejected in exploration: skipped weeks would become empty meetings in every trend.
- Pagination. A weekly team produces about 50 meetings a year.

## Decisions

### Meetings are opened explicitly; the proposal is computed, never stored

`POST /teams/{team_id}/meetings` takes `{date, time}` and creates the meeting. The proposed next date (see the spec requirement *Propose the date of the next meeting*) is computed when `GET /teams/{team_id}/meetings` is called, and is returned alongside the list. A pure function `propose_next(schedule, taken_dates, today)` in `app/services/meetings.py` is unit-tested on every scenario without I/O.

Alternatives considered:

- **Generated from the schedule (B)** and **implicit on first value (C)**. Both were rejected in exploration, for empty meetings and stray meetings respectively.
- **Computing the proposal in the browser.** The rule is business logic, and it depends on "today in Warsaw", which a browser elsewhere would get wrong. It belongs in a service.

### Wall-clock time in one fixed zone; the UTC instant is stored

`meetings.starts_at` is `timestamptz`, which satisfies "UTC in storage". The API accepts and returns `date` (`YYYY-MM-DD`) and `time` (`HH:MM`) as Europe/Warsaw wall-clock time, and also returns `starts_at` as an ISO 8601 UTC instant. Conversion happens in the service with `zoneinfo.ZoneInfo("Europe/Warsaw")`. The zone is a module constant `ORGANIZATION_TZ` in `app/core/`, not a setting.

A local time that does not exist (02:30 on the spring-forward night) or occurs twice (the autumn night) is resolved with `fold=0`. Board meetings are not held at those hours, so this is a footnote rather than a rejection code.

Schedules store wall-clock values only, with no instant: `schedule_weekday smallint` (1–7, with a check constraint) and `schedule_time time`. Both are null, or both are set, enforced by a check.

Alternatives considered:

- **Storing local `date` and `time` columns only.** That is simpler to read, but it breaks the stated "UTC in storage" convention, and every consumer would have to convert.
- **A configurable zone.** That is configuration for the future. A single on-premise organization has one zone. Changing it later is one constant and a migration of the index below.
- **Accepting a full ISO instant from the client.** The client would then do the DST arithmetic, and a browser in another zone would open a meeting at the wrong hour.

### One meeting per team per local date, enforced by an expression index

The unique index is `ON meetings (team_id, ((starts_at AT TIME ZONE 'Europe/Warsaw')::date))`. A violation is turned into `MeetingDateTakenError` (`meeting_date.taken`, 409, field `date`), the same way `team_name.duplicate` is detected from its index. That keeps the no-race property every earlier uniqueness rule here has.

`timezone(text, timestamptz)` must be immutable for PostgreSQL to accept it in an index. The migration task verifies this on PostgreSQL 18 first. If it is refused, the fallback is an explicit `local_date date NOT NULL` column that the service sets, with `UNIQUE (team_id, local_date)`. The fallback changes no spec and no API.

### Meetings belong to the team, not to the board definition

`meetings.team_id` references `teams` `ON DELETE CASCADE`. The domain model says "Meeting: team, date and time", authorization decides per team, and every URL is under `/teams/{team_id}`. A team owns exactly one board, so either choice would work, and the team keeps the joins short.

`host_employee_id` references `employees`, is nullable, and is `ON DELETE RESTRICT` like `team_members`. The "must be a member" check runs only when the host is set, in the service. It is not a composite foreign key to `team_members`, because the host must survive leaving the team (spec: *Name the host of a meeting*).

### Endpoints

| Method and path | Body | Success | Guard |
|---|---|---|---|
| `PUT /teams/{team_id}/schedule` | `{weekday, time}` | 200, `TeamRead` | `may_configure_the_board` |
| `GET /teams/{team_id}/meetings` | — | 200, `MeetingList` | any token |
| `POST /teams/{team_id}/meetings` | `{date, time}` | 201, `MeetingRead` | `may_record_meeting_data` |
| `PATCH /teams/{team_id}/meetings/{meeting_id}` | any of `{date, time, host_employee_id}` | 200, `MeetingRead` | `may_record_meeting_data` |
| `DELETE /teams/{team_id}/meetings/{meeting_id}` | — | 204 | `may_record_meeting_data` |

`MeetingRead` is `{id, team_id, date, time, starts_at, host: {id, email} | null}`. `MeetingList` is `{schedule: {weekday, time} | null, proposed: {date, time} | null, meetings: MeetingRead[]}`.

`BoardRead` gains `schedule`. It therefore appears on `TeamDetail` too. That is an additive field, and the `team-membership` read requirement lists the fields that are present, not the only ones allowed.

One `PATCH` covers moving and re-hosting because both have the same guard and the same response. In the body, `host_employee_id: null` clears the host and an absent key leaves it alone. Pydantic's `model_fields_set` tells the two apart. Moving checks the date index. Re-hosting checks membership. A `PATCH` that does both is one transaction, so a rejected host also leaves the date unchanged.

Alternatives considered: `PUT .../host` as a separate sub-resource, mirroring `PUT /teams/{id}/leader`. A team's leader is a permanent property that always exists, so replacing it fits `PUT`. A meeting's host is optional and is edited together with the date in the same dialog, so it fits a partial update.

### New domain errors and codes

| Code | Status | Field | Raised by |
|---|---|---|---|
| `schedule_weekday.out_of_range` | 422 | `weekday` | Pydantic validator (`PydanticCustomError`) |
| `meeting_date.taken` | 409 | `date` | service, from the unique index |
| `meeting.not_found` | 404 | none | service. A meeting of another team is also "not found" |
| `meeting_host.not_member` | 409 | `host_employee_id` | service |

`team.not_found` and `request.invalid_field` are reused. Every code gets entries in `en.errors` and `pl.errors`.

### Frontend: a meetings page per team

- New `features/meetings/` with `TeamMeetingsPage`, `useMeetings(teamId)` keyed `['teams', teamId, 'meetings']`, and `src/api/meetings.ts`. Mutations invalidate that key, because the proposal depends on the whole list. `PUT schedule` also invalidates `['teams']` exactly.
- Route `/teams/:teamId/meetings`. The bare `/teams/:teamId` stays reserved for the board.
- The team list shows "Wednesday, 13:00" or "No schedule", and links to the meetings page next to the members link.
- Dates and times are formatted as the wall-clock values the API returns, already on the organization's clock: built as UTC and formatted with `timeZone: 'UTC'`, so the reader's zone never shifts them. The existing hub formatters use the reader's zone; the meetings page shows the organization's time, so a colleague working from another zone sees the time the team actually meets. `formatMeetingDate`, `formatMeetingTime` and `formatScheduleWeekday` join `i18n/format.ts`.
- Who sees which control comes from the same `useTeam` relationship the members page already uses.

### Polish vocabulary added to the glossary

| English | Polish |
|---|---|
| Meeting | Spotkanie (already fixed) |
| Schedule | Harmonogram |
| Host (of a meeting) | Prowadzący |
| Prepare next meeting | Przygotuj następne spotkanie |
| Upcoming / Past | Nadchodzące / Minione |

### Testing

- Integration: one module per requirement, one test per scenario, named after it, as before. The DST scenario uses fixed dates in March and October 2026.
- Unit: `propose_next` covers every proposal scenario, and the wall-clock conversion covers both DST edges. `today` and `now` are injected, never read from the clock inside the function.
- Unit: the `authz` guards are already tested. New router wiring is covered by the authorization integration scenarios.
- Vitest: every scenario of *Meetings are managed from the meetings page*, plus the two new interface-permission scenarios.
- Playwright: `prepare-a-meeting.spec.ts`. The leader sets a schedule; a member prepares the next meeting from the proposal, names a host, moves the meeting, and prepares the one after; the same flow is then read in Polish.
- No BDD. Proposing a date is a scheduling convenience, not one of the plain-language business rules CLAUDE.md reserves pytest-bdd for.

## Risks / Trade-offs

- [The expression index needs an immutable `AT TIME ZONE`] → Verified first in the migration task. The fallback `local_date` column is described above and changes nothing outward.
- [Deleting or moving a meeting will become unsafe once values are recorded at it] → In this change nothing can be recorded, so both are always safe. `add-metrics` must modify *Move a meeting* and *Delete a meeting* to refuse once values exist. Its proposal should list `meetings` under Modified Capabilities.
- [Hub and meetings page format times in different zones] → Deliberate for now, because the hub is placeholder. When the hub's countdown becomes real, it should adopt the organization's zone too. That is noted for that follow-up.
- [Any member can delete any meeting of their team] → This is acceptable while meetings hold no data. The same rule as above closes it.
- [The fixed zone is wrong for a team abroad] → No such team exists. The constant is the single point to change.

## Migration Plan

1. `0003_add_meeting_schedule_and_meetings` adds the two nullable schedule columns to `board_definitions`, with checks for "weekday between 1 and 7" and "both set or both null".
2. It creates `meetings (id uuid pk, team_id fk cascade, starts_at timestamptz not null, host_employee_id fk restrict null, created_at, created_by_email)`, the expression unique index, and an index on `host_employee_id`.
3. Existing data needs no backfill. Downgrade drops the table and the columns.
4. `created_by_email` records who opened the meeting, for audit, as CLAUDE.md allows. It is logged at INFO with the team id when a meeting is opened, moved or deleted.

## Open Questions

- Should the meetings page show who opened a meeting? It is stored either way, so only the display is undecided.
