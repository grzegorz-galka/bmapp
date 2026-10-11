## Purpose

Lets the organization define a metric once, with its thresholds, and have every board that includes it measure it the same way, while each team records its own values for it.

## ADDED Requirements

### Requirement: Define a global metric

The system SHALL allow a global metric to be added to the company-wide catalogue with a name, a unit, 0–6 decimals and a direction, under the rules for defining a board's metric. Its name SHALL be unique among global metrics regardless of case. A global metric SHALL have no group label, position or owner of its own; those belong to each board that includes it.

#### Scenario: A global metric is added

- **WHEN** a global metric is added with the name "Service availability", the unit "%", 2 decimals and the direction `higher_is_better`
- **THEN** it is returned with a unique identifier, those properties, marked global, with no threshold, not retired and included in no board

#### Scenario: A global metric name is taken

- **WHEN** a global metric is added with a name another global metric uses in different letter case
- **THEN** it is rejected against `name` with `metric_name.duplicate`, and no global metric is added

#### Scenario: Invalid properties are refused as for a board's metric

- **WHEN** a global metric is added with a blank name, a unit over 20 characters, 7 decimals or an unknown direction
- **THEN** it is rejected with `metric_name.blank`, `metric_unit.too_long`, `metric_decimals.out_of_range` or `request.invalid_field` respectively

#### Scenario: A board's metric and a global metric share a name

- **WHEN** a global metric is added with the name of a metric of a board that does not include it
- **THEN** it is added

### Requirement: List the global metrics

The system SHALL return every global metric ordered by name, each with its properties, whether it is retired, its threshold in force today or none, and the number of boards that include it. Retired global metrics SHALL be included and marked as such.

#### Scenario: The catalogue is listed

- **WHEN** the global metrics are requested after "Security findings" and "Availability" were added, and "Availability" was included in two boards
- **THEN** "Availability" is returned first with two including boards, then "Security findings" with none, each with its threshold in force today or none

### Requirement: Change a global metric

The system SHALL allow a global metric's name, unit and decimals to be changed under the rules for defining one, and SHALL refuse a change of direction with `metric_direction.immutable`. A new name SHALL be refused with `metric_name.duplicate` when a board that includes the metric has a metric of its own with that name. A change SHALL show on every board that includes the metric.

#### Scenario: A rename shows on every board

- **WHEN** a global metric included in two boards is renamed
- **THEN** both boards list it under the new name, with their values and its threshold history unchanged

#### Scenario: A rename that clashes on an including board

- **WHEN** a global metric is renamed to "Uptime" and one board that includes it has a metric of its own named "uptime"
- **THEN** it is rejected against `name` with `metric_name.duplicate`, and the global metric is unchanged

#### Scenario: Changing the direction of a global metric is refused

- **WHEN** a request changes a global metric's direction
- **THEN** it is rejected with `metric_direction.immutable` against `direction`, and the global metric is unchanged

### Requirement: Retire or delete a global metric

The system SHALL allow a global metric to be retired and brought back. A retired global metric SHALL keep its values on every board, SHALL NOT be shown on any board, SHALL accept no new values, and SHALL NOT be included in another board. A global metric SHALL be deletable only while no value is recorded for it on any board, otherwise deletion SHALL be rejected with `metric.has_values`. Deleting it SHALL remove it from every board that includes it.

#### Scenario: A retired global metric leaves every board

- **WHEN** a global metric included in two boards is retired
- **THEN** neither board shows it at a meeting, both still list it in their metrics marked retired, and its values are still returned in each team's trend

#### Scenario: A retired global metric cannot be included

- **WHEN** a leader includes a retired global metric in their board
- **THEN** it is rejected with `metric.retired` and HTTP 409, and the board is unchanged

#### Scenario: A global metric without values is deleted

- **WHEN** a global metric included in one board, with no value recorded on any board, is deleted
- **THEN** it is no longer in the catalogue nor among that board's metrics

#### Scenario: Deleting a global metric with values is refused

- **WHEN** a global metric with a value recorded at any team's meeting is deleted
- **THEN** the request is rejected with `metric.has_values` and HTTP 409, and the global metric is unchanged

### Requirement: Thresholds of a global metric

The system SHALL allow threshold versions to be recorded for a global metric, and its threshold history to be listed, under the rules the `metrics` capability sets for a board's metric. The version in force at a meeting SHALL be decided the same way, and SHALL apply on every board that includes the metric.

#### Scenario: One threshold judges every board

- **WHEN** a version effective from 2026-10-01 with green from 99.5 and amber from 99 is recorded for a global metric, and two teams record 99.2 at meetings after that date
- **THEN** both values are amber

#### Scenario: Invalid versions are refused as for a board's metric

- **WHEN** a version is recorded for a global metric with its amber boundary better than its green one, or with a blank reason
- **THEN** it is rejected with `threshold.order_invalid` or `threshold_reason.blank`, and no version is added

### Requirement: Include a global metric in a board

The system SHALL allow an active global metric to be included in a board with a position, an optional group label and an optional owner, who SHALL be a team member when named. A global metric SHALL be included in a board at most once; including it again SHALL be rejected with `global_metric.already_included`. Its name SHALL NOT clash with a metric of the board's own, regardless of case.

#### Scenario: A global metric is included

- **WHEN** a leader includes the global metric "Service availability" in their board at position 2 in the group "Operations", owned by a member of the team
- **THEN** the board lists it with its global name, unit, decimals, direction and threshold, at position 2 in "Operations" with that owner, marked global

#### Scenario: Included twice

- **WHEN** a global metric already included in a board is included in it again
- **THEN** it is rejected against `global_metric_id` with `global_metric.already_included` and HTTP 409, and the board is unchanged

#### Scenario: Its name is taken on the board

- **WHEN** a global metric named "Availability" is included in a board that has a metric of its own named "availability"
- **THEN** it is rejected against `global_metric_id` with `metric_name.duplicate`, and the board is unchanged

#### Scenario: The owner is outside the team

- **WHEN** a global metric is included with an owner who is not a member of the team
- **THEN** it is rejected with `metric_owner.not_member` against `owner_employee_id`

#### Scenario: The global metric does not exist

- **WHEN** a board includes a global metric identifier that is not in the catalogue
- **THEN** it is rejected with `metric.not_found` and HTTP 404

### Requirement: A board cannot change a global metric's definition

The system SHALL allow a board to change only an included global metric's position, group label and owner, and its retirement on that board. A change on a board to its name, unit, decimals or direction, or a threshold version recorded through a board, SHALL be rejected with `global_metric.read_only` and HTTP 409, for an administrator as for a leader, and SHALL change nothing.

#### Scenario: A leader moves and regroups a global metric

- **WHEN** a leader changes an included global metric's position, group label and owner on their board
- **THEN** it is returned with the new placement on that board, and its placement on every other board is unchanged

#### Scenario: A leader renames a global metric on their board

- **WHEN** a leader changes the name or the unit of an included global metric through their board
- **THEN** it is rejected with `global_metric.read_only` against that field, and the global metric is unchanged

#### Scenario: A threshold cannot be recorded through a board

- **WHEN** a leader or an administrator records a threshold version for an included global metric through a board
- **THEN** it is rejected with `global_metric.read_only` and HTTP 409, and no version is added

### Requirement: Remove a global metric from a board

The system SHALL allow an included global metric to be removed from a board while no value is recorded for it at that team's meetings; otherwise removal SHALL be rejected with `metric.has_values`, and the global metric MAY be retired on that board instead. Removing or retiring it on one board SHALL NOT affect the global metric or any other board.

#### Scenario: A global metric without values on the board is removed

- **WHEN** a global metric is removed from a board at whose meetings no value was recorded for it, while another board has values for it
- **THEN** it is no longer among the first board's metrics, it stays in the catalogue and on the other board, and it can be included in the first board again

#### Scenario: Removing a global metric with values on the board is refused

- **WHEN** a global metric is removed from a board at one of whose meetings a value was recorded for it
- **THEN** the request is rejected with `metric.has_values` and HTTP 409, and the board still includes it

#### Scenario: A global metric is retired on one board

- **WHEN** a leader retires an included global metric on their board
- **THEN** it is marked retired on that board only, and other boards still show it and accept values for it

### Requirement: The global metrics page

The system SHALL present the catalogue of global metrics on its own page, reachable from the application header, listing each with its unit, direction, threshold in force today, retirement and the number of boards including it, and its threshold history on request. All text SHALL be in the active language.

#### Scenario: The catalogue is shown

- **WHEN** the global metrics page is opened
- **THEN** every global metric is listed with its unit, direction, threshold in force today, whether it is retired and how many boards include it

### Requirement: A global metric is marked as global

The system SHALL mark an included global metric as global wherever a board shows it: on the board's tiles, on the metric settings page and in the metric detail. The settings page SHALL show its definition and threshold history without controls to change them, and SHALL say they are set in the catalogue.

#### Scenario: A tile names a global metric as global

- **WHEN** a board that includes a global metric is opened at a meeting
- **THEN** its tile carries a global mark, given in words as well as by a symbol

#### Scenario: The settings page shows a global metric read-only

- **WHEN** a leader opens the metric settings of a board that includes a global metric
- **THEN** its placement can be changed, and its name, unit, decimals, direction and thresholds are shown without controls to change them
