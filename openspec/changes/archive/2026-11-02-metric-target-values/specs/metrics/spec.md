# Spec Delta

## ADDED Requirements

### Requirement: A threshold version's target value

Every threshold version recorded from now on SHALL carry a target value: the number the metric aims at from the version's effective date. A target value other than 0 SHALL come with a green and an amber tolerance in per cent of the target value. A target value of 0 SHALL come with absolute boundaries, shaped by direction as before. A version SHALL be returned with its target value, its tolerances or none, and the absolute boundaries it amounts to.

#### Scenario: A version with a target value and tolerances

- **WHEN** a version is added to a `within_band` metric, effective from 2026-11-01, with the target value 72.3, a green tolerance of 5, an amber tolerance of 10 and the reason "Plan for 2027"
- **THEN** it is returned with that target value and those tolerances, and with green from 68.685 to 75.915 and amber from 65.07 to 79.53

#### Scenario: A version with the target value 0 and a range

- **WHEN** a version is added to a `lower_is_better` metric with the target value 0, green up to 5 and amber up to 10
- **THEN** it is returned with the target value 0, no tolerances, and those boundaries

#### Scenario: The target value is missing

- **WHEN** a version is added without a target value
- **THEN** it is rejected with `request.invalid_field` against `target_value`, and no version is added

#### Scenario: Tolerances where the target value is 0

- **WHEN** a version is added with the target value 0 and a green tolerance
- **THEN** it is rejected with `request.invalid_field` against `green_pct`

#### Scenario: Boundaries where the target value is not 0

- **WHEN** a version is added with the target value 95 and an absolute green boundary
- **THEN** it is rejected with `request.invalid_field` against the boundary given

#### Scenario: A tolerance is missing

- **WHEN** a version is added with the target value 95 and a green tolerance but no amber tolerance
- **THEN** it is rejected with `request.invalid_field` against `amber_pct`

#### Scenario: A negative tolerance

- **WHEN** a version is added with a green tolerance of -1
- **THEN** it is rejected with `threshold_tolerance.negative` against `green_pct`

#### Scenario: Amber tighter than green

- **WHEN** a version is added with a green tolerance of 10 and an amber tolerance of 5
- **THEN** it is rejected with `threshold.order_invalid`, and no version is added

#### Scenario: Equal tolerances make a plain red-and-green metric

- **WHEN** a version is added with the target value 100 and both tolerances 0
- **THEN** it is accepted, and values under it are only ever green or red

### Requirement: The boundaries a target value amounts to

The system SHALL turn a version with a non-zero target value T and tolerances g and a (per cent) into boundaries, d being |T| × p / 100 for each tolerance p. For `higher_is_better`, green from T − d(g) and amber from T − d(a). For `lower_is_better`, green up to T + d(g) and amber up to T + d(a). For `within_band`, both sides. The boundaries SHALL be exact, never rounded.

#### Scenario: Higher is better falls short of the target value

- **WHEN** a `higher_is_better` version has the target value 100 and tolerances 5 and 10
- **THEN** it amounts to green from 95 and amber from 90

#### Scenario: Lower is better goes over the target value

- **WHEN** a `lower_is_better` version has the target value 20 and tolerances 10 and 25
- **THEN** it amounts to green up to 22 and amber up to 25

#### Scenario: A negative target value

- **WHEN** a `higher_is_better` version has the target value −20 and tolerances 50 and 100
- **THEN** it amounts to green from −30 and amber from −40

#### Scenario: A tolerance that does not divide evenly

- **WHEN** a `higher_is_better` version has the target value 95 and an amber tolerance of 5.263158
- **THEN** its amber boundary is exactly 95 − 95 × 5.263158 / 100, and a value is judged against that number, not a rounded one

### Requirement: Versions recorded before target values

The system SHALL keep every threshold version recorded before target values existed as it was recorded: with no target value and no tolerances, judged by its absolute boundaries. Such a version SHALL be returned with no target value. No version SHALL be changed to give it one; a target value is given by recording a newer version.

#### Scenario: An earlier version is read

- **WHEN** a metric has a version recorded before target values existed, with green from 95 and amber from 85
- **THEN** it is returned with no target value and no tolerances, and values under it keep the statuses they had

#### Scenario: A newer version takes over on the same date

- **WHEN** a version with a target value is added effective from the same date as an earlier version without one
- **THEN** the newer version is in force from that date, as the most recently recorded one

### Requirement: Hide a metric on the board

The system SHALL allow whoever configures a board to mark any of its metrics, its own or an included global one, hidden on the board, and to show it again. A metric MAY be hidden as it is added, whether created, copied or included, and SHALL otherwise be added shown. A hidden metric SHALL stay active: it SHALL take values, count in the meeting's completeness and readiness, and keep its trend. Hiding SHALL apply to that board only.

#### Scenario: A metric is hidden

- **WHEN** a leader marks the metric "Zatrudnienie" hidden on their board
- **THEN** it is returned marked hidden, not retired, and a value can still be recorded for it at an editable meeting

#### Scenario: A hidden metric is shown again

- **WHEN** a leader marks a hidden metric shown
- **THEN** it is returned not marked hidden

#### Scenario: A new metric is shown by default

- **WHEN** a metric is added to a board without asking to hide it
- **THEN** it is returned not marked hidden

#### Scenario: A metric is created hidden

- **WHEN** a leader creates the metric "Zatrudnienie" asking to hide it on the board
- **THEN** it is returned marked hidden, and the board shows no tile for it

#### Scenario: A metric is copied or included hidden

- **WHEN** a leader copies another board's metric, or includes a global metric, asking to hide it on the board
- **THEN** it is returned marked hidden on that board only

#### Scenario: Only whoever configures the board hides a metric

- **WHEN** a member who may not configure the board marks one of its metrics hidden
- **THEN** it is refused as any other change to the board's metrics is, and the metric is unchanged

### Requirement: The settings page sets the target value and hiding

The metric settings page SHALL record a threshold version by a target value with green and amber tolerances in per cent, and SHALL ask for green and amber boundaries instead when the target value is 0. It SHALL show each version as its target value with its tolerances, or as its boundaries when it has none. It SHALL offer a switch to hide a metric on the board, on each metric and in each of the dialogs that add one, and mark a hidden metric as such.

#### Scenario: A version is recorded on the settings page

- **WHEN** a leader enters the target value 72.3, the green tolerance 5, the amber tolerance 10 and a reason for a metric
- **THEN** the version is recorded, and the metric's threshold reads as the target value 72.3 with tolerances 5% and 10%

#### Scenario: Target value 0 asks for boundaries

- **WHEN** a leader enters the target value 0 for a `lower_is_better` metric
- **THEN** the form asks for green and amber boundaries instead of tolerances

#### Scenario: A metric is hidden from the settings page

- **WHEN** a leader switches a metric to hidden on the settings page
- **THEN** the page marks it hidden, and the board shows no tile for it

#### Scenario: A metric is hidden in the create dialog

- **WHEN** a leader chooses "Create new metric", fills in the definition, switches "Hidden on board" on and saves
- **THEN** the new metric is listed marked hidden

## MODIFIED Requirements

### Requirement: Record a threshold version

The system SHALL allow a threshold version to be added to a board's own metric with the date it takes effect from, a target value, its tolerances or boundaries as the requirement "A threshold version's target value" sets, and a reason. Effective dates MAY be in the past. Versions SHALL be kept, never edited or deleted, each with who recorded it and when. A global metric's versions SHALL be recorded in the catalogue, as the `global-metrics` capability requires, and never through a board.

#### Scenario: A threshold version is recorded

- **WHEN** a version is added to a `higher_is_better` metric, effective from 2026-10-01, with the target value 100, tolerances 5 and 10, and the reason "Plan for Q4"
- **THEN** it is returned with those values, green from 95, amber from 90, the reason, the email of whoever added it and the time it was added

#### Scenario: Boundaries in the wrong order

- **WHEN** a version with the target value 0 is added whose amber boundary is better than its green one (higher for `higher_is_better`, lower for `lower_is_better`), or for a band whose amber range does not contain its green range
- **THEN** it is rejected with `threshold.order_invalid`, and no version is added

#### Scenario: A plain red-and-green metric

- **WHEN** a version with the target value 0 is added whose amber boundary equals its green boundary
- **THEN** it is accepted, and values under it are only ever green or red

#### Scenario: Missing reason

- **WHEN** a version is added with a blank reason
- **THEN** it is rejected with `threshold_reason.blank` against `reason`

#### Scenario: Boundaries that do not fit the direction

- **WHEN** a version with the target value 0 for a `within_band` metric is submitted without upper boundaries, or one for a `higher_is_better` metric with them
- **THEN** it is rejected with `request.invalid_field` against the offending field

#### Scenario: A back-dated version

- **WHEN** a version is added effective from a date before meetings that already have values
- **THEN** it is accepted, and those meetings' values are judged against it from then on

### Requirement: List a metric's threshold history

The system SHALL return every threshold version of a metric, ordered by effective date and then by when it was recorded, most recent first. Each SHALL carry its target value or none, its tolerances or none, the boundaries it amounts to, its reason, who recorded it and when.

#### Scenario: The history of a metric's thresholds

- **WHEN** the threshold history of a metric with three versions is requested
- **THEN** all three are returned, most recent first, each with its reason and author

#### Scenario: A history spanning target values

- **WHEN** a metric has a version recorded before target values existed and a later one with the target value 100 and tolerances 5 and 10
- **THEN** the later one is returned first with its target value, tolerances and boundaries, and the earlier one with no target value and its own boundaries

### Requirement: The status of a value

The system SHALL compute a value's status when it is read. The status is `no_data` if no number is recorded and no colour is set by hand. Otherwise it is the colour set by hand, if any; `no_threshold` if none is in force; and otherwise the zone the number falls in, against the boundaries the version in force amounts to. Boundaries count as the better zone.

#### Scenario: Higher is better

- **WHEN** a `higher_is_better` metric has green from 95 and amber from 85, and the values 96, 95, 90, 85 and 84 are judged
- **THEN** they are green, green, amber, amber and red

#### Scenario: Lower is better

- **WHEN** a `lower_is_better` metric has green up to 5 and amber up to 10, and the values 0, 5, 7, 10 and 11 are judged
- **THEN** they are green, green, amber, amber and red

#### Scenario: Within a band

- **WHEN** a `within_band` metric has green from 71 to 72 and amber from 70.5 to 72.5, and the values 71.5, 71, 72, 70.8, 72.5, 70.4 and 72.6 are judged
- **THEN** they are green, green, green, amber, amber, red and red

#### Scenario: Higher is better against a target value

- **WHEN** a `higher_is_better` metric has the target value 100 and tolerances 5 and 10, and the values 101, 95, 92, 90 and 89.9 are judged
- **THEN** they are green, green, amber, amber and red

#### Scenario: Lower is better against a target value

- **WHEN** a `lower_is_better` metric has the target value 20 and tolerances 10 and 25, and the values 18, 22, 23, 25 and 25.1 are judged
- **THEN** they are green, green, amber, amber and red

#### Scenario: Within a band around a target value

- **WHEN** a `within_band` metric has the target value 72.3 and tolerances 5 and 10, and the values 72.3, 68.685, 75.915, 68, 65.07, 79.53, 65 and 80 are judged
- **THEN** they are green, green, green, amber, amber, amber, red and red

#### Scenario: A negative target value

- **WHEN** a `higher_is_better` metric has the target value −20 and tolerances 50 and 100, and the values −25, −30, −35 and −41 are judged
- **THEN** they are green, green, amber and red

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

### Requirement: List a board's metrics

The system SHALL return a board's metrics — its own and the global metrics it includes — in the board's order: the metrics of each group in the groups' order, each group's in their order within it, then the ungrouped metrics in their order. Each metric SHALL carry its properties, its group (identifier, name and position) or none, its position within its group or among the ungrouped, whether it is global, whether it is retired, whether it is hidden on the board, and its threshold in force today, or none. A metric is retired on a board when it is retired there or, for a global metric, retired in the catalogue. Retired and hidden metrics SHALL be included and marked as such.

#### Scenario: Metrics are returned in display order

- **WHEN** a board has the groups "Quality" then "Finance", with "Bugs" and "Defects" in "Quality" in that order, "Revenue" in "Finance", and "Morale" in no group, and its metrics are requested
- **THEN** they are returned as "Bugs", "Defects", "Revenue", "Morale", each with its group or none and its threshold in force today or none

#### Scenario: A retired metric is listed as retired

- **WHEN** a board has an active and a retired metric and its metrics are requested
- **THEN** both are returned, and only the retired one is marked retired

#### Scenario: A hidden metric is listed as hidden

- **WHEN** a board has a shown and a hidden metric and its metrics are requested
- **THEN** both are returned in the board's order, and only the hidden one is marked hidden

#### Scenario: Own and global metrics are listed together

- **WHEN** a board's group holds an included global metric first and an own metric second, and the board is requested
- **THEN** the global metric is returned first, marked global, with its placement on this board and the catalogue's threshold in force today, and the own metric second, not marked global

### Requirement: Copy a metric from another board

The system SHALL allow a board's own metric, of any board, to be copied onto a board as a new metric of that board's own, optionally under a new name and into a group of the target board, placed last there or last among the ungrouped metrics. The copy SHALL take the source's unit, decimals, direction and every threshold version with its target value, tolerances or boundaries, and SHALL NOT take its group, its owner, whether it is hidden, or its values. A global metric SHALL NOT be copied: that is rejected with `metric_copy.source_global`.

#### Scenario: A metric is copied with its thresholds

- **WHEN** a leader copies another team's metric "Open bugs" (unit "", `lower_is_better`, in that board's group "Quality") with versions effective from 2026-07-01 and 2026-09-01, onto their board, into their board's group "Engineering"
- **THEN** their board has a new, active metric "Open bugs" with that unit and direction, last in "Engineering", no owner, no values, and two versions with the same effective dates, boundaries and reasons, each recorded by the leader at the time of copying

#### Scenario: Target values and tolerances are copied

- **WHEN** a metric whose only version has the target value 72.3 and tolerances 5 and 10 is copied
- **THEN** the copy's version has the target value 72.3 and tolerances 5 and 10, and a version without a target value is copied without one

#### Scenario: A hidden metric is copied as shown

- **WHEN** a metric hidden on its board is copied onto another board without asking to hide it
- **THEN** the copy is shown on the target board

#### Scenario: A copy with no group is ungrouped

- **WHEN** a metric in a group on its own board is copied onto another board without naming a group
- **THEN** the copy is last among that board's ungrouped metrics, and no group is added to that board

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
