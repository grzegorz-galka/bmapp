## Purpose

Defines what a team measures on its board: its metrics, the thresholds that say what green and amber mean for each of them over time, and the rule that turns a recorded value into a status of green, amber or red.

## ADDED Requirements

### Requirement: Define a metric on a board

The system SHALL allow a metric to be added to a board with a name, a unit, 0–6 decimals to show, a direction (`higher_is_better`, `lower_is_better` or `within_band`), an optional group label, a position and an optional owner. The name SHALL be trimmed, at most 200 characters and unique on the board regardless of case. The unit SHALL be at most 20 characters and MAY be empty. An owner SHALL be a team member when named.

#### Scenario: A metric is added

- **WHEN** a metric is added with the name "Revenue", the unit "mln zł", 1 decimal, the direction `higher_is_better` and the group "Finance"
- **THEN** it is returned with a unique identifier and those properties, with no threshold and not retired

#### Scenario: Name is blank, too long or taken

- **WHEN** a metric is added with a blank name, a name over 200 characters, or a name another metric of the same board uses in different letter case
- **THEN** it is rejected against the field `name` with `metric_name.blank`, `metric_name.too_long` or `metric_name.duplicate` respectively, and no metric is added

#### Scenario: Two boards use the same metric name

- **WHEN** two different teams each add a metric named "Revenue"
- **THEN** both are added

#### Scenario: Unit or decimals out of bounds

- **WHEN** a metric is added with a unit over 20 characters, or with 7 decimals
- **THEN** it is rejected with `metric_unit.too_long` against `unit` or `metric_decimals.out_of_range` against `decimals`

#### Scenario: Owner outside the team

- **WHEN** a metric is added with an owner who is not a member of the team
- **THEN** it is rejected with `metric_owner.not_member` against `owner_employee_id`

#### Scenario: Unknown direction

- **WHEN** a metric is added with a direction that is not one of the three
- **THEN** it is rejected with `request.invalid_field` against `direction`

### Requirement: List a board's metrics

The system SHALL return a board's metrics ordered by display position, then by name. Each metric SHALL carry its properties, whether it is retired, and its threshold in force today, or none. Retired metrics SHALL be included and marked as such.

#### Scenario: Metrics are returned in display order

- **WHEN** a board's metrics are requested after three were added with positions 3, 1 and 2
- **THEN** they are returned in positions 1, 2, 3, each with its threshold in force today or none

#### Scenario: A retired metric is listed as retired

- **WHEN** a board has an active and a retired metric and its metrics are requested
- **THEN** both are returned, and only the retired one is marked retired

### Requirement: Change a metric

The system SHALL allow a metric's name, unit, decimals, group label, display position and owner to be changed, subject to the rules for defining one. A metric's direction SHALL NOT change after the metric is added: a request to change it SHALL be rejected with `metric_direction.immutable`, and the metric SHALL be unchanged.

#### Scenario: A metric is renamed and regrouped

- **WHEN** a metric's name and group label are changed
- **THEN** it is returned with the new name and group, its recorded values and threshold history unchanged

#### Scenario: Changing the direction is refused

- **WHEN** a request changes a `higher_is_better` metric to `lower_is_better`
- **THEN** it is rejected with `metric_direction.immutable` against `direction`, and the metric is unchanged

### Requirement: Retire or delete a metric

The system SHALL allow a metric to be retired and brought back. A retired metric SHALL keep its values and threshold history, SHALL NOT be shown on the board, and SHALL accept no new values. A metric SHALL be deletable only while no value is recorded for it. Otherwise deletion SHALL be rejected with `metric.has_values`.

#### Scenario: A metric is retired

- **WHEN** a metric with recorded values is retired
- **THEN** it is marked retired, and its values and threshold history are still returned

#### Scenario: A retired metric is brought back

- **WHEN** a retired metric is made active again
- **THEN** it is no longer marked retired and accepts values again

#### Scenario: A metric without values is deleted

- **WHEN** a metric for which no value was ever recorded is deleted
- **THEN** it is no longer returned, and its name is free for another metric of the board

#### Scenario: Deleting a metric with values is refused

- **WHEN** a metric with at least one recorded value is deleted
- **THEN** the request is rejected with `metric.has_values` and HTTP 409, and the metric is unchanged

### Requirement: Record a threshold version

The system SHALL allow a threshold version to be added to a metric with the date it takes effect from, a green boundary and an amber boundary, and a reason. A `within_band` metric has a lower and an upper boundary for each. Effective dates MAY be in the past. Versions SHALL be kept, never edited or deleted, each with who recorded it and when.

#### Scenario: A threshold version is recorded

- **WHEN** a version is added to a `higher_is_better` metric, effective from 2026-10-01, with green from 95, amber from 85, and the reason "Plan for Q4"
- **THEN** it is returned with those values, the reason, the email of whoever added it and the time it was added

#### Scenario: Boundaries in the wrong order

- **WHEN** a version is added whose amber boundary is better than its green one (higher for `higher_is_better`, lower for `lower_is_better`), or for a band whose amber range does not contain its green range
- **THEN** it is rejected with `threshold.order_invalid`, and no version is added

#### Scenario: A plain red-and-green metric

- **WHEN** a version is added whose amber boundary equals its green boundary
- **THEN** it is accepted, and values under it are only ever green or red

#### Scenario: Missing reason

- **WHEN** a version is added with a blank reason
- **THEN** it is rejected with `threshold_reason.blank` against `reason`

#### Scenario: Boundaries that do not fit the direction

- **WHEN** a version for a `within_band` metric is submitted without upper boundaries, or one for a `higher_is_better` metric with them
- **THEN** it is rejected with `request.invalid_field` against the offending field

#### Scenario: A back-dated version

- **WHEN** a version is added effective from a date before meetings that already have values
- **THEN** it is accepted, and those meetings' values are judged against it from then on

### Requirement: The threshold in force at a meeting

The system SHALL judge a value against the threshold version in force on its meeting's date. That is the version with the latest effective date on or before the meeting's date. When several versions share that date, the most recently recorded one SHALL be used. Before the first effective date, no threshold SHALL be in force.

#### Scenario: Meetings either side of a change

- **WHEN** a metric has versions effective from 2026-07-01 and 2026-09-01, and meetings on 2026-08-26 and 2026-09-02
- **THEN** the first meeting is judged against the July version and the second against the September version

#### Scenario: Two versions on the same date

- **WHEN** two versions are recorded effective from the same date
- **THEN** the one recorded later is in force from that date

#### Scenario: A meeting before any threshold

- **WHEN** a meeting's date is earlier than the metric's earliest effective date
- **THEN** no threshold is in force at that meeting

### Requirement: List a metric's threshold history

The system SHALL return every threshold version of a metric, ordered by effective date and then by when it was recorded, most recent first. Each SHALL carry its boundaries, its reason, who recorded it and when.

#### Scenario: The history of a metric's thresholds

- **WHEN** the threshold history of a metric with three versions is requested
- **THEN** all three are returned, most recent first, each with its reason and author

### Requirement: The status of a value

The system SHALL compute a value's status when it is read. The status is `no_data` if no number is recorded and no colour is set by hand. Otherwise it is the colour set by hand, if any; `no_threshold` if none is in force; and otherwise the zone the number falls in. Boundaries count as the better zone.

#### Scenario: Higher is better

- **WHEN** a `higher_is_better` metric has green from 95 and amber from 85, and the values 96, 95, 90, 85 and 84 are judged
- **THEN** they are green, green, amber, amber and red

#### Scenario: Lower is better

- **WHEN** a `lower_is_better` metric has green up to 5 and amber up to 10, and the values 0, 5, 7, 10 and 11 are judged
- **THEN** they are green, green, amber, amber and red

#### Scenario: Within a band

- **WHEN** a `within_band` metric has green from 71 to 72 and amber from 70.5 to 72.5, and the values 71.5, 71, 72, 70.8, 72.5, 70.4 and 72.6 are judged
- **THEN** they are green, green, green, amber, amber, red and red

#### Scenario: No number recorded

- **WHEN** a meeting has no number and no colour set by hand for a metric
- **THEN** its status is `no_data`

#### Scenario: No threshold in force

- **WHEN** a number is recorded at a meeting before the metric's earliest threshold
- **THEN** its status is `no_threshold`, not red

#### Scenario: A colour set by hand wins

- **WHEN** a value that the threshold would make green has the colour red set by hand
- **THEN** its status is red, and it is marked as set by hand

#### Scenario: A back-dated threshold changes a past status

- **WHEN** a value was amber, and a version is then added effective from before its meeting under which it is green
- **THEN** the value's status is green
