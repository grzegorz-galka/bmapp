## MODIFIED Requirements

### Requirement: The metric detail

The system SHALL present, for a metric, a trend chart over the team's meetings. The chart SHALL show each number coloured by its status and the threshold in force as a stepped line or band. The detail SHALL also list the recorded values with their comments, the threshold history and the correction log.

#### Scenario: The chart shows a threshold change as a step

- **WHEN** the detail of a metric whose threshold changed between two meetings is opened
- **THEN** the threshold line steps at the meeting from which the new version applies

## ADDED Requirements

### Requirement: The board's meeting navigator

The system SHALL place the control for the previous meeting, the chooser of the meeting shown and the control for the next meeting on one line, the chooser no wider than its longest meeting label needs. They SHALL wrap onto separate lines only in a window too narrow to hold them side by side.

#### Scenario: The navigator stays on one line

- **WHEN** a team's board is opened in a window 1280 pixels wide
- **THEN** the previous control, the meeting chooser and the next control are on one line, and the chooser is narrower than the board's tile column

### Requirement: The problems and tasks column is wider

The system SHALL keep the board within the same maximum width as the other pages, so a wide window centres it rather than stretching the metrics and the problems and tasks apart, and SHALL give the problems and tasks beside the metrics a column 20% wider than the other pages' side columns, between 21.6rem and 31.2rem.

#### Scenario: The problems and tasks column is wider

- **WHEN** a team's board is opened in a window 1920 pixels wide
- **THEN** the problems and tasks column is 31.2rem wide and the board is no wider than the dashboard

### Requirement: The view switch counts the recorded metrics

The system SHALL caption the board's switch to the metrics with how many active metrics have a number at the meeting shown out of how many there are, as the switch to the pulse check is captioned with the answers received out of the members.

#### Scenario: The metrics switch shows the count

- **WHEN** the board of a meeting with 14 active metrics, 12 of them with a number, is displayed in English
- **THEN** the switch to the metrics reads "Metrics 12/14"

#### Scenario: The count follows a recorded value

- **WHEN** a member records a number for one of the two missing metrics at that meeting
- **THEN** the switch to the metrics reads "Metrics 13/14" without reloading the page

### Requirement: The recording view's fields

The system SHALL size a metric's number field for ten characters. The colour set by hand SHALL be chosen with a toggle of four options, automatic, green, amber and red, captioned "Status", automatic meaning no colour set by hand. Choosing green, amber or red SHALL still need the comment the value rule asks for.

#### Scenario: A status is set by hand with the toggle

- **WHEN** a member chooses "Red" on a metric's status toggle, types a comment and leaves the row
- **THEN** the value is recorded with red set by hand, and the toggle shows "Red" as chosen

#### Scenario: Automatic clears a status set by hand

- **WHEN** a member chooses "Automatic" on a metric whose colour was set by hand and leaves the row
- **THEN** the value is recorded with no colour set by hand, and its status is computed from its threshold

#### Scenario: The number field fits ten characters

- **WHEN** the recording view is displayed
- **THEN** each number field is wide enough for ten characters and no wider than twelve

### Requirement: The metric detail is not covered

The system SHALL show the metric detail above every other part of the page, including the application header, with its heading and its close control visible when it opens.

#### Scenario: The header does not cover the detail

- **WHEN** a metric's detail is opened from the board while the page is scrolled down
- **THEN** the detail's heading and close control are visible and not covered by the application header

### Requirement: The metric detail's values grid

The system SHALL list a metric's recorded values in the detail as a grid with one row per meeting, newest first, and the columns date, value, status and comment. The date SHALL be the meeting's ISO 8601 calendar date in both languages. The value SHALL be formatted for the active language with the metric's unit, and the status given in words.

#### Scenario: The values are shown as a grid

- **WHEN** the detail of a metric with values at three meetings is opened in Polish
- **THEN** a grid with the columns date, value, status and comment lists three rows, newest first, dated like `2026-10-13`, with each value in the Polish number format

#### Scenario: A metric without values

- **WHEN** the detail of a metric with no recorded value is opened
- **THEN** the detail says there are no values yet instead of an empty grid
