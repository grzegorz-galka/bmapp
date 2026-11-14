## Purpose

Defines what a team measures on its board: its metrics, the thresholds that say what green and amber mean for each of them over time, and the rule that turns a recorded value into a status of green, amber or red.

## Requirements


### Requirement: Define a metric on a board

The system SHALL allow a metric to be added to a board with a name, a unit, 0–6 decimals to show, a direction (`higher_is_better`, `lower_is_better` or `within_band`), an optional group of that board and an optional owner. The metric SHALL be placed last in its group, or last among the ungrouped metrics when no group is named. The name SHALL be trimmed, at most 200 characters and unique on the board regardless of case, among the board's own metrics that belong to no project or product and the global metrics it includes. A project's or product's metric is named under the `projects-and-products` capability instead. The unit SHALL be at most 20 characters and MAY be empty. An owner SHALL be a team member when named.

#### Scenario: A metric is added

- **WHEN** a metric is added with the name "Revenue", the unit "mln zł", 1 decimal, the direction `higher_is_better` and the board's group "Finance"
- **THEN** it is returned with a unique identifier and those properties, in the group "Finance", with no threshold, not retired and not global

#### Scenario: A new metric is placed last in its group

- **WHEN** a metric is added to a group that already holds two metrics, and another is added with no group to a board with one ungrouped metric
- **THEN** the first is third in its group, and the second is second among the ungrouped metrics

#### Scenario: The group is not the board's

- **WHEN** a metric is added naming a group that does not exist or belongs to another board
- **THEN** it is rejected against `group_id` with `metric_group.not_found` and HTTP 404, and no metric is added

#### Scenario: Name is blank, too long or taken

- **WHEN** a metric is added with a blank name, a name over 200 characters, or a name another metric of the same board uses in different letter case
- **THEN** it is rejected against the field `name` with `metric_name.blank`, `metric_name.too_long` or `metric_name.duplicate` respectively, and no metric is added

#### Scenario: Name of an included global metric

- **WHEN** a metric is added, or a board's own metric renamed, with the name of a global metric the board includes, in any letter case
- **THEN** it is rejected against `name` with `metric_name.duplicate`

#### Scenario: A project's metric does not take the board's name

- **WHEN** a board has a metric "Budget consumed" of one of its projects, and a metric named "Budget consumed" is added to the board belonging to no project
- **THEN** it is added

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


### Requirement: Change a metric

The system SHALL allow a board's own metric's name, unit, decimals, group and owner to be changed, subject to the rules for defining one. Moving a metric to another group, or out of every group, SHALL place it last there; its order otherwise changes only through the board's layout. For a global metric the board includes, only what the `global-metrics` capability allows SHALL change. A metric's direction SHALL NOT change after the metric is added: a request to change it SHALL be rejected with `metric_direction.immutable`, and the metric SHALL be unchanged.

#### Scenario: A metric is renamed and regrouped

- **WHEN** a metric's name is changed and it is moved to another group of the board
- **THEN** it is returned with the new name, last in the new group, its recorded values and threshold history unchanged

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


### Requirement: Copy a metric from another board

The system SHALL allow a board's own metric, of any board, to be copied onto a board as a new metric of that board's own, optionally under a new name and into a group of the target board, placed last there or last among the ungrouped metrics. The copy SHALL take the source's unit, decimals, direction and every threshold version with its target value, tolerances or boundaries, and SHALL NOT take its group, its owner, whether it is hidden, or its values. A global metric SHALL NOT be copied: that is rejected with `metric_copy.source_global`. A project's or product's metric SHALL NOT be copied: that is rejected with `metric_copy.source_project` or `metric_copy.source_product`.

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

#### Scenario: A project's or product's metric is not copied

- **WHEN** a leader copies a metric of a project, or of a product, of any team
- **THEN** it is rejected against `source_metric_id` with `metric_copy.source_project` or `metric_copy.source_product` respectively and HTTP 409, and nothing is added

#### Scenario: The source does not exist

- **WHEN** a leader copies a metric identifier that matches no metric
- **THEN** it is rejected with `metric.not_found` and HTTP 404

### Requirement: The metric settings page

The system SHALL present a board's metrics on its metric settings page with, in one row at the top, "Create new metric", "Copy from another board" and "Include global metric", each opening its form in a dialog over the page. No form for a new metric SHALL be shown on the page itself. The page SHALL carry no links to the board or the meetings beyond its back link, which returns to the screen the page was opened from, or to the board when that is not known.

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

#### Scenario: Opened from Team metrics, the page leads back there

- **WHEN** a leader opens their team's metric settings from Team metrics and follows the back link
- **THEN** the link reads "Back to Team metrics" and returns them to Team metrics

### Requirement: Define a board's metric groups

The system SHALL allow a group to be added to a board with a name, placed after the board's other groups. The name SHALL be trimmed, at most 200 characters and unique among the board's groups regardless of case. A group MAY hold no metric. Groups SHALL be returned in their order, each with its identifier, name and position.

#### Scenario: A group is added

- **WHEN** a group named "Quality" is added to a board that has the group "Finance"
- **THEN** it is returned with a unique identifier, the name "Quality" and no metrics, after "Finance"

#### Scenario: Group name is blank, too long or taken

- **WHEN** a group is added with a blank name, a name over 200 characters, or the name of another group of the board in different letter case
- **THEN** it is rejected against `name` with `metric_group_name.blank`, `metric_group_name.too_long` or `metric_group_name.duplicate` respectively, and no group is added

#### Scenario: Two boards use the same group name

- **WHEN** two different teams each add a group named "Quality"
- **THEN** both are added

### Requirement: Rename a metric group

The system SHALL allow a board's group to be renamed under the rules for adding one. Its metrics SHALL stay in it, in their order.

#### Scenario: A group is renamed

- **WHEN** the group "Qualty" holding two metrics is renamed "Quality"
- **THEN** it is returned as "Quality" holding the same two metrics in the same order

#### Scenario: Renamed to a taken name

- **WHEN** a group is renamed to the name of another group of the board in any letter case
- **THEN** it is rejected against `name` with `metric_group_name.duplicate`, and the group is unchanged

### Requirement: Delete a metric group

The system SHALL allow a board's group to be deleted whether or not it holds metrics. Its metrics SHALL move, in their order, after the board's ungrouped metrics, and SHALL keep their values, thresholds and owners. A group of another board, or one that does not exist, SHALL be rejected with `metric_group.not_found` and HTTP 404.

#### Scenario: A group with metrics is deleted

- **WHEN** the group "Quality" holding "Bugs" then "Defects" is deleted from a board whose only ungrouped metric is "Morale"
- **THEN** the board has no group "Quality", and its ungrouped metrics are "Morale", "Bugs", "Defects", with their values and thresholds unchanged

#### Scenario: An unknown group is deleted

- **WHEN** a group identifier of another board is deleted through this board
- **THEN** it is rejected with `metric_group.not_found` and HTTP 404, and both boards are unchanged

### Requirement: Arrange a board's layout

The system SHALL allow a board's layout to be replaced as one: the board's groups in their new order, and each of the board's metrics, retired ones included, in its new order within a group or among the ungrouped. A layout that does not name every group and every metric of the board exactly once, or that names one the board does not have, SHALL be rejected with `metric_layout.stale` and HTTP 409, and the board SHALL be unchanged. A layout SHALL NOT add, rename or delete a group.

#### Scenario: A metric is moved into another group

- **WHEN** a layout moves "Morale" from the ungrouped metrics to first in "Quality", ahead of "Bugs"
- **THEN** the board's metrics are returned with "Morale" first in "Quality", "Bugs" second, and no ungrouped metric

#### Scenario: Groups are reordered

- **WHEN** a layout puts the group "Finance" before "Quality", which came first
- **THEN** the groups are returned as "Finance", "Quality", each holding the same metrics in the same order

#### Scenario: A layout made against an outdated board

- **WHEN** a layout is submitted that leaves out a metric added to the board after the layout was read, or names a group since deleted
- **THEN** it is rejected with `metric_layout.stale` and HTTP 409, and the board's groups and metrics are as they were

### Requirement: The metric settings page arranges groups and metrics by dragging

The metric settings page SHALL show the board's groups in order, each with its metrics, and the ungrouped metrics last under a heading of their own. To a viewer permitted to configure the board it SHALL offer adding, renaming and deleting a group, and SHALL let a metric be dragged within its group, into another group or among the ungrouped, and a group to a new place, saving the resulting layout.

#### Scenario: A metric is dragged into a group

- **WHEN** a leader drags the ungrouped metric "Morale" onto the group "Quality" on the metric settings page
- **THEN** "Morale" is shown in "Quality", and on reopening the page and on the board it is in "Quality"

#### Scenario: An empty group is shown

- **WHEN** a leader adds the group "Delivery" and adds no metric to it
- **THEN** the settings page shows "Delivery" with a note that it holds no metric, as a place a metric can be dragged to

#### Scenario: A viewer who may not configure the board cannot arrange it

- **WHEN** a member who may not configure the board opens the metric settings page
- **THEN** the groups and their metrics are shown in order, nothing can be dragged, and no control to add, rename, delete or move a group or a metric is offered

#### Scenario: A refused layout is reported and the page reloads

- **WHEN** a leader's move is refused with `metric_layout.stale` because the board changed meanwhile
- **THEN** the page says, in the active language, that the board was changed elsewhere, and shows the board's current layout

### Requirement: Deleting a group that holds metrics asks first

The metric settings page SHALL ask for confirmation before deleting a group that holds metrics, saying how many will become ungrouped, and SHALL delete an empty group without asking.

#### Scenario: Deleting a group asks first

- **WHEN** a leader deletes a group that holds metrics
- **THEN** the page asks for confirmation, naming how many metrics will become ungrouped, and deletes only when confirmed

#### Scenario: An empty group is deleted at once

- **WHEN** a leader deletes a group that holds no metric
- **THEN** it is deleted without a confirmation

### Requirement: Groups and metrics can be arranged without dragging

The metric settings page SHALL offer, for every move it offers by dragging, a way to make it from the keyboard alone: moving a metric up or down within its group, moving it to another group or out of every group, and moving a group up or down. Each control SHALL name the metric or group it moves, and the new place SHALL be announced to assistive technology.

#### Scenario: A metric is moved to a group from the keyboard

- **WHEN** a leader, using the keyboard only, chooses to move "Morale" to the group "Quality"
- **THEN** "Morale" is last in "Quality", the layout is saved, and its new place is announced

#### Scenario: A group is moved up from the keyboard

- **WHEN** a leader, using the keyboard only, moves the second group up
- **THEN** it becomes the first group, the layout is saved, and its new place is announced

#### Scenario: Moves that go nowhere are not offered

- **WHEN** the first metric of a group and the last group of the board are shown
- **THEN** no "move up" is offered for that metric and no "move down" for that group

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
