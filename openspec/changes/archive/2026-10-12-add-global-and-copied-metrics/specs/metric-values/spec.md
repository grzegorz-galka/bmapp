## ADDED Requirements

### Requirement: A global metric's values belong to each team

The system SHALL keep the values of a global metric per team: a value belongs to the team whose meeting it was recorded at. A board, its completeness and a metric's trend SHALL show only the values recorded at that team's meetings, judged against the global metric's thresholds and placed as that board places it.

#### Scenario: Two teams record the same global metric

- **WHEN** two teams that include the same global metric record 99.1 and 99.8 for it at their own meetings
- **THEN** each team's board shows only its own number, and each team's trend runs along its own meetings only

#### Scenario: A global metric counts towards a board's completeness

- **WHEN** a board with three own metrics and one included global metric has numbers for its own three at a meeting
- **THEN** the board reports 3 of 4 recorded, with the global metric listed as missing, with the owner this board gave it

## MODIFIED Requirements

### Requirement: Record a metric value at a meeting

The system SHALL allow a value to be recorded for an active metric at a meeting of the same team. For a global metric, the same team is a team whose board includes it, and active means retired neither on that board nor in the catalogue. A value is an optional number, an optional comment, and an optional colour set by hand (green, amber or red). Recording again SHALL replace the value. The value SHALL carry who last recorded it and when, and SHALL be returned with its status.

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

#### Scenario: A global metric retired in the catalogue

- **WHEN** a value is recorded for an included global metric that an administrator has retired in the catalogue
- **THEN** it is rejected with `metric.retired` and HTTP 409

#### Scenario: A global metric the board does not include

- **WHEN** a value is recorded at a team's meeting for a global metric that team's board does not include
- **THEN** it is rejected with `metric.not_found` and HTTP 404

#### Scenario: Metric and meeting of different teams

- **WHEN** a value is recorded for a metric of one team at a meeting of another
- **THEN** it is rejected with `meeting.not_found` and HTTP 404

#### Scenario: A number out of range

- **WHEN** a number with an absolute value of 10^15 or more, or with more than 6 decimal places, is recorded
- **THEN** it is rejected with `metric_value.out_of_range` against `value`
