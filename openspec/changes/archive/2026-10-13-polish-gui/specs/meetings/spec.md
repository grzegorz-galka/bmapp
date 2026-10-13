## MODIFIED Requirements

### Requirement: Meetings are managed from the meetings page

The system SHALL present a team's meetings on a meetings page of their own, reached from that team on the team page. The page SHALL show the board's schedule, the upcoming meetings and the past meetings, each with its date, its start time and its host. It SHALL offer planning the next meeting, pre-filled with the proposal when there is one, and moving a meeting, naming or clearing its host, and deleting it. All its text SHALL be in the active language.

#### Scenario: Upcoming and past meetings are shown apart

- **WHEN** a team's meetings page is opened and the team has meetings both before and after the current moment
- **THEN** the upcoming meetings are shown soonest first, apart from the past meetings, which are shown most recent first

#### Scenario: Preparing the next meeting is pre-filled from the schedule

- **WHEN** a member chooses "Plan next meeting" on the page of a team whose board has a schedule
- **THEN** the date and start time are pre-filled with the proposal, and can be changed before choosing "Create the meeting"

#### Scenario: Preparing a meeting without a schedule

- **WHEN** a member chooses "Plan next meeting" on the page of a team whose board has no schedule
- **THEN** the date and start time are left empty for the member to choose

#### Scenario: A rejection is shown in the active language

- **WHEN** creating a meeting is rejected with `meeting_date.taken` while the interface is in Polish
- **THEN** the page shows the Polish wording for that code next to the date field

#### Scenario: Dates and weekdays follow the active language

- **WHEN** the meetings page is shown in English and then in Polish
- **THEN** dates, start times and the schedule's weekday are formatted for each language in turn

## ADDED Requirements

### Requirement: The schedule is changed on request

The system SHALL show the board's schedule as text, and SHALL show the fields to set it only after a viewer permitted to set it chooses "Set schedule", when the board has none, or "Change schedule", when it has one. Saving or cancelling SHALL hide the fields again.

#### Scenario: The schedule fields are hidden until asked for

- **WHEN** the leader of a team whose board has a schedule opens its meetings page
- **THEN** the schedule is shown as text with a "Change schedule" link, and no weekday or start time field is shown

#### Scenario: A board without a schedule offers to set one

- **WHEN** the leader of a team whose board has no schedule opens its meetings page and chooses "Set schedule"
- **THEN** the weekday and start time fields are shown, empty, with a control to save and one to cancel

#### Scenario: Saving hides the fields

- **WHEN** the leader saves a new schedule
- **THEN** the fields are hidden and the new schedule is shown as text

### Requirement: The meetings page's fields fit their values

The system SHALL size the weekday, start time and date fields of the meetings page to the longest value each can hold in the active language, rather than to the width of the page.

#### Scenario: The fields are no wider than their values

- **WHEN** the meetings page is shown with the schedule fields and the planning fields open in a window 1280 pixels wide
- **THEN** none of the weekday, start time and date fields is wider than 14rem
