## Purpose

Defines what a team measures on its board: its metrics, the thresholds that say what green and amber mean for each of them over time, and the rule that turns a recorded value into a status of green, amber or red.

## Requirements


### Requirement: Define a metric on a board

The system SHALL allow a metric to be added to a board with a name, a unit, 0–6 decimals to show, a direction (`higher_is_better`, `lower_is_better` or `within_band`), an optional group label, a position and an optional owner. The name SHALL be trimmed, at most 200 characters and unique on the board regardless of case, among the board's own metrics and the global metrics it includes. The unit SHALL be at most 20 characters and MAY be empty. An owner SHALL be a team member when named.

#### Scenario: A metric is added

- **WHEN** a metric is added with the name "Revenue", the unit "mln zł", 1 decimal, the direction `higher_is_better` and the group "Finance"
- **THEN** it is returned with a unique identifier and those properties, with no threshold, not retired and not global

#### Scenario: Name is blank, too long or taken

- **WHEN** a metric is added with a blank name, a name over 200 characters, or a name another metric of the same board uses in different letter case
- **THEN** it is rejected against the field `name` with `metric_name.blank`, `metric_name.too_long` or `metric_name.duplicate` respectively, and no metric is added

#### Scenario: Name of an included global metric

- **WHEN** a metric is added, or a board's own metric renamed, with the name of a global metric the board includes, in any letter case
- **THEN** it is rejected against `name` with `metric_name.duplicate`

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

The system SHALL return a board's metrics — its own and the global metrics it includes — ordered by display position, then by name. Each metric SHALL carry its properties, whether it is global, whether it is retired, and its threshold in force today, or none. A metric is retired on a board when it is retired there or, for a global metric, retired in the catalogue. Retired metrics SHALL be included and marked as such.

#### Scenario: Metrics are returned in display order

- **WHEN** a board's metrics are requested after three were added with positions 3, 1 and 2
- **THEN** they are returned in positions 1, 2, 3, each with its threshold in force today or none

#### Scenario: A retired metric is listed as retired

- **WHEN** a board has an active and a retired metric and its metrics are requested
- **THEN** both are returned, and only the retired one is marked retired

#### Scenario: Own and global metrics are listed together

- **WHEN** a board with an own metric at position 2 and an included global metric at position 1 is requested
- **THEN** the global metric is returned first, marked global, with its placement on this board and the catalogue's threshold in force today, and the own metric second, not marked global

### Requirement: Change a metric

The system SHALL allow a board's own metric's name, unit, decimals, group label, display position and owner to be changed, subject to the rules for defining one. For a global metric the board includes, only what the `global-metrics` capability allows SHALL change. A metric's direction SHALL NOT change after the metric is added: a request to change it SHALL be rejected with `metric_direction.immutable`, and the metric SHALL be unchanged.

#### Scenario: A metric is renamed and regrouped

- **WHEN** a metric's name and group label are changed
- **THEN** it is returned with the new name and group, its recorded values and threshold history unchanged

#### Scenario: Changing the direction is refused

- **WHEN** a request changes a `higher_is_better` metric to `lower_is_better`
- **THEN** it is rejected with `metric_direction.immutable` against `direction`, and the metric is unchanged

### Requirement: Retire or delete a metric

The system SHALL allow a metric to be retired and brought back. A retired metric SHALL keep its values and threshold history, SHALL NOT be shown on the board, and SHALL accept no new values. A board's own metric SHALL be deletable only while no value is recorded for it. Otherwise deletion SHALL be rejected with `metric.has_values`. Retiring or removing a global metric on a board SHALL follow the `global-metrics` capability.

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

The system SHALL allow a threshold version to be added to a board's own metric with the date it takes effect from, a green boundary and an amber boundary, and a reason. A `within_band` metric has a lower and an upper boundary for each. Effective dates MAY be in the past. Versions SHALL be kept, never edited or deleted, each with who recorded it and when. A global metric's versions SHALL be recorded in the catalogue, as the `global-metrics` capability requires, and never through a board.

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

### Requirement: Copy a metric from another board

The system SHALL allow a board's own metric, of any board, to be copied onto a board as a new metric of that board's own, optionally under a new name and at a given position. The copy SHALL take the source's unit, decimals, direction, group label and every threshold version, and SHALL NOT take its owner or its values. A global metric SHALL NOT be copied: that is rejected with `metric_copy.source_global`.

#### Scenario: A metric is copied with its thresholds

- **WHEN** a leader copies another team's metric "Open bugs" (unit "", `lower_is_better`, group "Quality") with versions effective from 2026-07-01 and 2026-09-01, onto their board
- **THEN** their board has a new, active metric "Open bugs" with that unit, direction and group, no owner, no values, and two versions with the same effective dates, boundaries and reasons, each recorded by the leader at the time of copying

#### Scenario: The same version is in force on every date

- **WHEN** a metric with two versions effective from the same date is copied
- **THEN** on that date and after, the copy's version in force has the boundaries of the source's version in force

#### Scenario: A copy under a new name

- **WHEN** a metric named "Revenue" is copied onto a board that has its own "Revenue", under the name "Revenue (Poland)"
- **THEN** it is added as "Revenue (Poland)"

#### Scenario: The copied name is taken

- **WHEN** a metric is copied without a new name onto a board that already has a metric, its own or an included global one, of that name in any letter case
- **THEN** it is rejected against `name` with `metric_name.duplicate`, and nothing is added

#### Scenario: The copy is independent of its source

- **WHEN** a copy is renamed and given a new threshold version, and its source is later changed and given another version
- **THEN** neither change appears on the other metric

#### Scenario: A global metric is not copied

- **WHEN** a leader copies a global metric
- **THEN** it is rejected against `source_metric_id` with `metric_copy.source_global` and HTTP 409, and nothing is added

#### Scenario: The source does not exist

- **WHEN** a leader copies a metric identifier that matches no metric
- **THEN** it is rejected with `metric.not_found` and HTTP 404

### Requirement: The metric settings page

The system SHALL present a board's metrics on its metric settings page with, in one row at the top, "Create new metric", "Copy from another board" and "Include global metric", each opening its form in a dialog over the page. No form for a new metric SHALL be shown on the page itself. The page SHALL carry no links to the board or the meetings beyond its link back to the board.

#### Scenario: The three ways to add a metric are offered at the top

- **WHEN** a leader opens their team's metric settings
- **THEN** "Create new metric", "Copy from another board" and "Include global metric" are offered in one row above the metrics, no field for a new metric is shown, and no Board or Meetings button is shown

#### Scenario: A metric is created from the dialog

- **WHEN** the leader chooses "Create new metric", fills in the name, unit, decimals and direction and saves
- **THEN** the dialog closes and the new metric is listed on the page

#### Scenario: Cancelling leaves the board unchanged

- **WHEN** the leader opens "Create new metric", types a name and cancels
- **THEN** the dialog closes and no metric is added

#### Scenario: A rejection keeps the dialog open

- **WHEN** creating a metric is rejected because its name is already on the board
- **THEN** the dialog stays open showing the reason next to the name, with what was typed kept
