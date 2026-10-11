## Purpose

Records the value of each of a board's metrics at each meeting, decides which meetings can still be edited, and presents the values as the board, the recording view and each metric's trend.

## Requirements

### Requirement: Record a metric value at a meeting

The system SHALL allow a value to be recorded for an active metric at a meeting of the same team. A value is an optional number, an optional comment, and an optional colour set by hand (green, amber or red). Recording again SHALL replace the value. The value SHALL carry who last recorded it and when, and SHALL be returned with its status.

#### Scenario: A value is recorded

- **WHEN** the number 96.2 and the comment "Ahead of plan" are recorded for a metric at a meeting
- **THEN** the value is returned with that number, that comment, its computed status, and who recorded it and when

#### Scenario: A value is replaced

- **WHEN** a value is recorded again for the same metric and meeting with a different number
- **THEN** the metric has one value at that meeting, carrying the new number

#### Scenario: A colour set by hand without a comment

- **WHEN** a colour is set by hand on a value without a non-blank comment
- **THEN** it is rejected with `metric_value.comment_required` against `comment`, and the value is unchanged

#### Scenario: A colour set by hand without a number

- **WHEN** a colour is set by hand with a comment and no number
- **THEN** the value is recorded, and its status is that colour

#### Scenario: A retired metric

- **WHEN** a value is recorded for a retired metric
- **THEN** it is rejected with `metric.retired` and HTTP 409

#### Scenario: Metric and meeting of different teams

- **WHEN** a value is recorded for a metric of one team at a meeting of another
- **THEN** it is rejected with `meeting.not_found` and HTTP 404

#### Scenario: A number out of range

- **WHEN** a number with an absolute value of 10^15 or more, or with more than 6 decimal places, is recorded
- **THEN** it is rejected with `metric_value.out_of_range` against `value`

### Requirement: Only the latest held and the next meeting can be edited

The system SHALL accept values only at a team's latest meeting dated today or earlier and at its first meeting dated after today, in Europe/Warsaw. A value at any other meeting is frozen. Recording one SHALL be rejected with `metric_value.meeting_frozen`, unless it is an administrator's correction.

#### Scenario: Values are typed in before the meeting

- **WHEN** today is Monday, the team's next meeting is on Wednesday and its last was the previous Wednesday
- **THEN** values can be recorded at both of those meetings

#### Scenario: A correction the day after

- **WHEN** today is Thursday, the team met yesterday, and next week's meeting is already opened
- **THEN** values can still be recorded at yesterday's meeting

#### Scenario: An older meeting is frozen

- **WHEN** a member records a value at a meeting earlier than the team's latest meeting dated today or earlier
- **THEN** it is rejected with `metric_value.meeting_frozen` and HTTP 409, and the value is unchanged

#### Scenario: Meetings prepared further ahead are frozen until their turn

- **WHEN** a member records a value at the team's second meeting after today
- **THEN** it is rejected with `metric_value.meeting_frozen`

### Requirement: An administrator corrects a frozen value

The system SHALL accept a value at a frozen meeting only as a correction carrying a non-blank reason. Without one, it SHALL be rejected with `metric_value_reason.blank`. Each correction SHALL be logged, never edited or deleted, with the previous and the new value, the reason, who made it and when.

#### Scenario: A frozen value is corrected

- **WHEN** a frozen value of 12 is corrected to 13 with the reason "Late invoice booked"
- **THEN** the value is 13, and the log for that metric holds the previous value 12, the new value 13, the reason, the author and the time

#### Scenario: A correction without a reason

- **WHEN** a frozen value is corrected with a blank reason
- **THEN** it is rejected with `metric_value_reason.blank` against `reason`, and the value is unchanged

#### Scenario: An edit inside the window is not logged as a correction

- **WHEN** a value is changed at a meeting that can still be edited
- **THEN** no correction is logged

### Requirement: The board of a meeting

The system SHALL return, for a meeting, each active metric with:

- its value and its status;
- whether the colour was set by hand;
- its comment;
- the threshold in force;
- the number recorded at the team's previous meeting, and the change since then;
- whether that change is an improvement;
- its values over the team's last 12 meetings.

It SHALL also return whether the meeting can be edited.

#### Scenario: The change since the previous meeting

- **WHEN** a `higher_is_better` metric is 90 at a meeting and was 85 at the team's previous meeting
- **THEN** the board shows a change of +5, marked as an improvement

#### Scenario: Lower is better reads the change the other way

- **WHEN** a `lower_is_better` metric is 3 at a meeting and was 4 at the previous one
- **THEN** the change is −1, marked as an improvement

#### Scenario: A band metric has no better direction

- **WHEN** a `within_band` metric changes between meetings
- **THEN** the change is shown, marked as neither an improvement nor a decline

#### Scenario: No number at the previous meeting

- **WHEN** the team's previous meeting has no number for a metric
- **THEN** no change is shown for it, even if an earlier meeting has one

#### Scenario: Retired metrics are left off

- **WHEN** a board with a retired metric is requested for a meeting
- **THEN** the retired metric is not among the returned metrics

### Requirement: How complete a meeting's recording is

The system SHALL return, with a meeting's board, how many active metrics have a number recorded at that meeting out of how many there are, and the metrics still without one, each with its owner if it has one.

#### Scenario: Recording is partly done

- **WHEN** a board has 14 active metrics, 12 have a number at a meeting, and one of the 2 missing has an owner
- **THEN** the board reports 12 of 14, and lists the 2 missing metrics, one with its owner

### Requirement: A metric's trend

The system SHALL return, for a metric, every meeting of its team in date order. Each SHALL carry the metric's number there, or none, its status and the threshold in force, together with the metric's correction log.

#### Scenario: A trend spans a threshold change

- **WHEN** a metric's trend is requested across meetings either side of a new threshold version
- **THEN** each meeting carries the threshold in force on its own date

#### Scenario: Skipped meetings leave no gap

- **WHEN** a team did not meet in one week
- **THEN** the trend has no entry for that week, since only meetings that exist are returned

### Requirement: The board page

The system SHALL present a team's board at the team's own address. It SHALL show one meeting's metrics as tiles under their group labels, each with its value, colour, change and sparkline. It SHALL move between the team's meetings, opening at its first meeting dated today or later, or else its latest. All text SHALL be in the active language.

#### Scenario: The board opens on the coming meeting

- **WHEN** a team's board is opened on a Monday before that week's Wednesday meeting
- **THEN** the board shows the Wednesday meeting

#### Scenario: Colour is never the only signal

- **WHEN** a tile is red, amber or green, or its colour was set by hand
- **THEN** the status and the set-by-hand mark are also given in words

#### Scenario: A board without metrics

- **WHEN** the board of a team with no metrics is opened
- **THEN** the board says no metrics are defined yet and, to a viewer who may configure the board, links to the metric settings

### Requirement: The recording view

The system SHALL present, for a meeting that can be edited, a view listing every active metric with its threshold in force. For each it SHALL show the previous meeting's number and fields for the number, the comment and a colour set by hand, headed by how complete the recording is. Numbers SHALL be entered and shown in the active language's format.

#### Scenario: A number is typed in the Polish format

- **WHEN** a member types `95,3` into a metric's number while the interface is in Polish
- **THEN** 95.3 is recorded, and shown as `95,3`

#### Scenario: A frozen meeting is read-only

- **WHEN** the recording view is opened for a meeting that cannot be edited, by someone who is not an administrator
- **THEN** the values are shown without fields to change them

### Requirement: The metric detail

The system SHALL present, for a metric, a trend chart over the team's meetings. The chart SHALL show each number coloured by its status and the threshold in force as a stepped line or band. The detail SHALL also list the recent values with their comments, the threshold history and the correction log.

#### Scenario: The chart shows a threshold change as a step

- **WHEN** the detail of a metric whose threshold changed between two meetings is opened
- **THEN** the threshold line steps at the meeting from which the new version applies
