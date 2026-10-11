## Purpose

Records the board meetings a team holds. Every metric value, and later every problem and task, is tied to one of them. A meeting is opened explicitly by a member of its team, takes place on a date at a start time, and may name the member who hosts it.

## Requirements

### Requirement: Meeting dates and times are local to the organization

The system SHALL interpret every meeting date and start time it accepts, and SHALL express every one it returns, as wall-clock time in the Europe/Warsaw time zone. Each meeting SHALL also carry the instant it starts, in UTC. A given wall-clock time SHALL stay the same across a change between summer and winter time.

#### Scenario: A start time stays put across the change of clocks

- **WHEN** a team opens one meeting at 13:00 on a date in summer time and another at 13:00 on a date in winter time
- **THEN** both are returned with the start time 13:00, and their UTC instants are 11:00 and 12:00 respectively

### Requirement: Open a meeting

The system SHALL allow a meeting to be opened for a team with a date and a start time. A team SHALL hold at most one meeting on any date, and the date MAY be in the past. The response SHALL be the meeting: its identifier, its team's identifier, its date, its start time, its UTC start instant and its host, which is none when it is opened. A rejection SHALL carry the code its scenario names and SHALL open no meeting.

#### Scenario: A meeting is opened

- **WHEN** a meeting is opened for a team with a date on which that team holds no meeting, and a start time
- **THEN** the meeting is persisted with a unique identifier and returned with its date, its start time, its UTC start instant and no host

#### Scenario: A second meeting on the same date

- **WHEN** a meeting is opened for a team on a date on which that team already holds a meeting, at any start time
- **THEN** the request is rejected with the code `meeting_date.taken` against the field `date`, and the team still holds one meeting on that date

#### Scenario: Two teams meet on the same date

- **WHEN** two different teams each open a meeting on the same date
- **THEN** both meetings are opened

#### Scenario: A meeting in the past

- **WHEN** a meeting is opened for a date that has already passed
- **THEN** the meeting is opened like any other

#### Scenario: Date or time is missing or malformed

- **WHEN** a meeting is opened with a missing date, or with a start time that is not a valid time of day such as `25:00`
- **THEN** the request is rejected with the code `request.invalid_field` against the offending field, and no meeting is opened

#### Scenario: The team does not exist

- **WHEN** a meeting is opened for a team identifier that names no team
- **THEN** the request is rejected with the code `team.not_found` and HTTP 404

### Requirement: List a team's meetings

The system SHALL return a team's meetings ordered by start, earliest first, each carrying what is returned when a meeting is opened. The same response SHALL carry the board's schedule, or none, and the date and start time it proposes for the next meeting, or none, as the next-meeting requirement defines. A team with no meetings SHALL return an empty list rather than an error.

#### Scenario: Meetings are returned in order

- **WHEN** a team's meetings are requested after meetings were opened in an order different from their dates
- **THEN** every meeting of that team, and no meeting of any other team, is returned ordered by start, earliest first

#### Scenario: A team with no meetings

- **WHEN** the meetings of a team that has opened none are requested
- **THEN** an empty list is returned, together with the board's schedule and the proposed next meeting

### Requirement: Propose the date of the next meeting

The system SHALL propose, for a team whose board has a schedule, the earliest date on or after today that falls on the schedule's weekday and on which the team holds no meeting, at the schedule's start time. "Today" is the current date in Europe/Warsaw. For a team whose board has no schedule, the system SHALL propose nothing. A proposal SHALL NOT open a meeting.

#### Scenario: Today is the scheduled weekday and its meeting is not yet opened

- **WHEN** a team meets on Wednesdays at 13:00, today is a Wednesday, and no meeting has been opened for today
- **THEN** today at 13:00 is proposed, even if 13:00 has already passed

#### Scenario: This week's meeting is already opened

- **WHEN** a team meets on Wednesdays, today is a Wednesday, and a meeting is already opened for today
- **THEN** next Wednesday is proposed

#### Scenario: Several weeks are prepared ahead

- **WHEN** a team meets on Wednesdays and meetings are already opened for the next two Wednesdays
- **THEN** the third Wednesday from today is proposed

#### Scenario: A meeting off the schedule does not block the proposal

- **WHEN** a team meets on Wednesdays and its only upcoming meeting was opened on a Thursday
- **THEN** the next Wednesday is proposed

#### Scenario: A board without a schedule

- **WHEN** the meetings of a team whose board has no schedule are requested
- **THEN** no next meeting is proposed

### Requirement: Move a meeting

The system SHALL allow a meeting's date, its start time, or both to be changed. The new date SHALL be subject to the same rules as when a meeting is opened. The meeting SHALL keep its identifier and its host. The response SHALL be the meeting as changed. A meeting identifier that names no meeting of that team SHALL be rejected with the code `meeting.not_found`. Once any metric value is recorded at a meeting, a change of its date SHALL be rejected with the code `meeting.has_values`, because its values are judged against the thresholds in force on that date. Its start time MAY still change.

#### Scenario: A meeting is rescheduled

- **WHEN** a meeting is moved to a date on which its team holds no other meeting, at a new start time
- **THEN** the meeting is returned with the new date and start time, the same identifier and the same host

#### Scenario: A meeting is moved onto a date already taken

- **WHEN** a meeting is moved to a date on which its team already holds another meeting
- **THEN** the request is rejected with the code `meeting_date.taken` against the field `date`, and the meeting is unchanged

#### Scenario: Only the start time changes

- **WHEN** a meeting's start time is changed and its date is left as it was
- **THEN** the meeting is returned on the same date at the new start time

#### Scenario: The meeting does not exist

- **WHEN** a meeting is moved by an identifier that names no meeting of that team, including a meeting of another team
- **THEN** the request is rejected with the code `meeting.not_found` and HTTP 404

#### Scenario: A meeting with values cannot change its date

- **WHEN** a meeting at which a metric value is recorded is moved to another date
- **THEN** the request is rejected with the code `meeting.has_values` and HTTP 409, and the meeting is unchanged

#### Scenario: A meeting with values can change its start time

- **WHEN** the start time of a meeting at which a metric value is recorded is changed, and its date is left as it was
- **THEN** the meeting is returned at the new start time

### Requirement: Name the host of a meeting

The system SHALL allow the host of a meeting to be set to a member of its team, or cleared. A person who is not a member of the meeting's team when the host is named SHALL be rejected with the code `meeting_host.not_member`, reported against the field `host_employee_id`, and the host SHALL be unchanged. A host who later leaves the team SHALL remain that meeting's host.

#### Scenario: A member is named host

- **WHEN** a member of a team is named host of one of its meetings
- **THEN** the meeting is returned with that member's identifier and email as its host

#### Scenario: Someone outside the team is named host

- **WHEN** an employee who is not a member of the meeting's team is named its host
- **THEN** the request is rejected with the code `meeting_host.not_member` against the field `host_employee_id`, and the host is unchanged

#### Scenario: The host is cleared

- **WHEN** the host of a meeting that has one is cleared
- **THEN** the meeting is returned with no host

#### Scenario: The host leaves the team

- **WHEN** a member who hosts a meeting is removed from its team
- **THEN** the meeting still names that person as its host

### Requirement: Delete a meeting

The system SHALL allow a meeting to be deleted, after which it SHALL no longer be returned and its date SHALL be free for another meeting of the team. A meeting identifier that names no meeting of that team SHALL be rejected with the code `meeting.not_found`. A meeting at which any metric value is recorded SHALL NOT be deleted: the request SHALL be rejected with the code `meeting.has_values`.

#### Scenario: A meeting opened by mistake is deleted

- **WHEN** a meeting is deleted
- **THEN** it no longer appears among its team's meetings, and a new meeting can be opened on its date

#### Scenario: The meeting does not exist

- **WHEN** a meeting is deleted by an identifier that names no meeting of that team
- **THEN** the request is rejected with the code `meeting.not_found` and HTTP 404

#### Scenario: A meeting with values cannot be deleted

- **WHEN** a meeting at which a metric value is recorded is deleted
- **THEN** the request is rejected with the code `meeting.has_values` and HTTP 409, and the meeting and its values remain

### Requirement: Meetings are managed from the meetings page

The system SHALL present a team's meetings on a meetings page of their own, reached from that team on the team page. The page SHALL show the board's schedule, the upcoming meetings and the past meetings, each with its date, its start time and its host. It SHALL offer opening the next meeting, pre-filled with the proposal when there is one, and moving a meeting, naming or clearing its host, and deleting it. All its text SHALL be in the active language.

#### Scenario: Upcoming and past meetings are shown apart

- **WHEN** a team's meetings page is opened and the team has meetings both before and after the current moment
- **THEN** the upcoming meetings are shown soonest first, apart from the past meetings, which are shown most recent first

#### Scenario: Preparing the next meeting is pre-filled from the schedule

- **WHEN** a member opens preparing the next meeting on the page of a team whose board has a schedule
- **THEN** the date and start time are pre-filled with the proposal, and can be changed before the meeting is opened

#### Scenario: Preparing a meeting without a schedule

- **WHEN** a member opens preparing the next meeting on the page of a team whose board has no schedule
- **THEN** the date and start time are left empty for the member to choose

#### Scenario: A rejection is shown in the active language

- **WHEN** opening a meeting is rejected with `meeting_date.taken` while the interface is in Polish
- **THEN** the page shows the Polish wording for that code next to the date field

#### Scenario: Dates and weekdays follow the active language

- **WHEN** the meetings page is shown in English and then in Polish
- **THEN** dates, start times and the schedule's weekday are formatted for each language in turn
