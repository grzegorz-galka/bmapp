## Why

Every metric value belongs to the meeting where it was recorded. The trend runs along the sequence of meetings, and problems and tasks will be raised and closed at meetings. BMAPP has no meetings yet. The team that runs the current board meetings does so in a stand-alone, single-team HTML tool. Its records show the shape a meeting has to cope with:

- one meeting a week on a fixed weekday;
- a week skipped now and then;
- a meeting prepared days ahead, with its host already chosen;
- a meeting whose data is filled in only partly.

Meetings are therefore the next root entity, and the metrics capability that follows needs them.

## What Changes

- A board definition gains a **meeting schedule**: the weekday and the local time its team meets. It is optional, since an existing board has none. The team's leader or an administrator sets it.
- New **meetings**. A meeting belongs to a team and takes place on a date at a start time. A team holds at most one meeting per date.
- A meeting is **opened explicitly** by a member of the team, typically ahead of time to prepare it. The proposed date is the earliest day, today or later, that falls on the schedule's weekday and has no meeting yet. The proposed start time is the schedule's time. Both can be changed. Without a schedule nothing is proposed and the member picks both. A skipped week simply has no meeting.
- A meeting has an optional **host** (*prowadzący*), who must be a member of the team when they are named. The host is a different thing from the team leader: the role rotates from meeting to meeting.
- Members may **move** a meeting to another date or time, change its host, or **delete** it. Nothing can be recorded at a meeting yet. The metrics change will forbid moving or deleting a meeting once values are recorded at it.
- The team list shows each board's schedule, if it has one. Each team links to a new **meetings page** at `/teams/:teamId/meetings`, which lists upcoming and past meetings, offers "Prepare next meeting", and lets the leader set the schedule.
- New stable error codes for the schedule and meeting rejections, translated in both catalogues.

## Capabilities

### New Capabilities

- `meetings`: The meetings a team holds. Covers opening one with a date proposed from the schedule, listing a team's meetings, moving one, naming its host, and deleting one.

### Modified Capabilities

- `team-board`: A board definition gains an optional weekly meeting schedule, which can be set and which the team list returns.
- `authorization`: Setting the schedule is the leader's or an administrator's to do, as configuring the board already is. Managing meetings belongs to any member of the team. The interface offers those controls only to someone permitted to use them.

## Impact

- **Data**: migration `0003` adds the nullable `schedule_weekday` and `schedule_time` columns to `board_definitions`, and a new `meetings` table. Existing teams stay valid: they simply have no schedule.
- **API**: `GET /teams` gains `board.schedule`. New endpoints: `PUT /teams/{team_id}/schedule`, `GET /teams/{team_id}/meetings`, `POST /teams/{team_id}/meetings`, `PATCH /teams/{team_id}/meetings/{meeting_id}`, `DELETE /teams/{team_id}/meetings/{meeting_id}`. Nothing changes in a breaking way.
- **Backend**: `may_configure_the_board` and `may_record_meeting_data` in `app/services/authz.py` already exist without a caller, and this change gives them their first. A new `app/services/meetings.py`.
- **Frontend**: `src/api/`, a new `features/meetings/`, a route in `routes.tsx`, the team list in `features/teams/`, and `en.ts`/`pl.ts`.
- **Dependencies**: none. Time-zone handling uses the standard library `zoneinfo` and the browser's `Intl`.
- **Unchanged**: the hub still serves placeholder data. Making its next-meeting countdown real from these schedules and meetings is a follow-up change.
- **Non-goals**: metric values and anything recorded at a meeting; suggesting who should host next and tracking who has never hosted; attendance, which is still an open decision; meeting duration, location, agenda and rules; schedules other than weekly; importing the legacy tool's history.

## Assumptions

- **One time zone for the whole organization, Europe/Warsaw, fixed in code rather than configured.** The deployment is on-premise for one company. A configurable zone would be configuration for the future, which the project avoids.
- **A meeting may be opened for a past date.** A meeting that took place but was never entered, or one being back-filled, needs a home. Only "one meeting per team per date" constrains the date.
- **A host who later leaves the team stays recorded as that meeting's host.** That is a historical fact about the meeting. The membership check applies only when the host is named.
