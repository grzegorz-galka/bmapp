# Spec Delta

## MODIFIED Requirements

### Requirement: Open a meeting

The system SHALL allow a meeting to be opened for a team with a date, a start time and, optionally, its host, who SHALL be a member of the team as when a host is named. A team SHALL hold at most one meeting on any date, and the date MAY be in the past. The response SHALL be the meeting: its identifier, its team's identifier, its date, its start time, its UTC start instant and its host, which is none when none was named. A rejection SHALL carry the code its scenario names and SHALL open no meeting.

#### Scenario: A meeting is opened

- **WHEN** a meeting is opened for a team with a date on which that team holds no meeting, and a start time, and no host
- **THEN** the meeting is persisted with a unique identifier and returned with its date, its start time, its UTC start instant and no host

#### Scenario: A meeting is opened with its host

- **WHEN** a meeting is opened for a team with a free date, a start time and a member of the team as host
- **THEN** the meeting is returned with that member's identifier and email as its host

#### Scenario: A meeting is opened with a host from outside the team

- **WHEN** a meeting is opened with an employee who is not a member of the team as host
- **THEN** the request is rejected with the code `meeting_host.not_member` against the field `host_employee_id`, and no meeting is opened

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

### Requirement: Meetings are managed from the meetings page

The system SHALL present a team's meetings on a meetings page of their own, reached from that team on the team page. The page SHALL show the board's schedule, the upcoming meetings and the past meetings, each with its date, its start time and its host, and each leading to the team's board at that meeting. It SHALL offer planning the next meeting, naming the proposal on the control that starts it and pre-filling it, with an optional host, and moving a meeting, naming or clearing its host, and deleting it. All its text SHALL be in the active language.

#### Scenario: Upcoming and past meetings are shown apart

- **WHEN** a team's meetings page is opened and the team has meetings both before and after the current moment
- **THEN** the upcoming meetings are shown soonest first, apart from the past meetings, which are shown most recent first

#### Scenario: The planning control names the proposal

- **WHEN** the meetings page of a team that meets on Wednesdays at 13:00 is opened while next Wednesday is proposed
- **THEN** the control to plan the next meeting names next Wednesday's date and 13:00 before it is chosen

#### Scenario: Preparing the next meeting is pre-filled from the schedule

- **WHEN** a member chooses "Plan next meeting" on the page of a team whose board has a schedule
- **THEN** the date and start time are pre-filled with the proposal, and can be changed before choosing "Create the meeting"

#### Scenario: Preparing a meeting without a schedule

- **WHEN** a member chooses "Plan next meeting" on the page of a team whose board has no schedule
- **THEN** the date and start time are left empty for the member to choose, and the form says that nothing is proposed because the board has no schedule

#### Scenario: The host is named while planning

- **WHEN** a member plans the next meeting, chooses another member as its host and chooses "Create the meeting"
- **THEN** the meeting is opened with that member as its host, and is listed among the upcoming meetings with them as host

#### Scenario: A meeting leads to its board

- **WHEN** a member chooses a meeting listed on the meetings page
- **THEN** the team's board is displayed on that meeting

#### Scenario: A rejection is shown in the active language

- **WHEN** creating a meeting is rejected with `meeting_date.taken` while the interface is in Polish
- **THEN** the page shows the Polish wording for that code next to the date field

#### Scenario: Dates and weekdays follow the active language

- **WHEN** the meetings page is shown in English and then in Polish
- **THEN** dates, start times and the schedule's weekday are formatted for each language in turn
