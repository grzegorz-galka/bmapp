# Spec Delta

## MODIFIED Requirements

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
