# Spec Delta

## MODIFIED Requirements

### Requirement: Define a global metric

The system SHALL allow a global metric to be added to the company-wide catalogue with a name, a unit, 0–6 decimals and a direction, under the rules for defining a board's metric. Its name SHALL be unique among global metrics regardless of case. A global metric SHALL have no group, position or owner of its own; those belong to each board that includes it.

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

### Requirement: Include a global metric in a board

The system SHALL allow an active global metric to be included in a board in an optional group of that board, placed last in it or last among the ungrouped metrics, with an optional owner, who SHALL be a team member when named. A global metric SHALL be included in a board at most once; including it again SHALL be rejected with `global_metric.already_included`. Its name SHALL NOT clash with a metric of the board's own, regardless of case.

#### Scenario: A global metric is included

- **WHEN** a leader includes the global metric "Service availability" in their board's group "Operations", which holds one metric, owned by a member of the team
- **THEN** the board lists it with its global name, unit, decimals, direction and threshold, second in "Operations" with that owner, marked global

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

#### Scenario: Included into another board's group

- **WHEN** a global metric is included naming a group of another board
- **THEN** it is rejected against `group_id` with `metric_group.not_found` and HTTP 404, and the board is unchanged

### Requirement: A board cannot change a global metric's definition

The system SHALL allow a board to change only an included global metric's group, its place in the board's layout and its owner, and its retirement on that board. A change on a board to its name, unit, decimals or direction, or a threshold version recorded through a board, SHALL be rejected with `global_metric.read_only` and HTTP 409, for an administrator as for a leader, and SHALL change nothing.

#### Scenario: A leader moves and regroups a global metric

- **WHEN** a leader moves an included global metric to another group of their board and changes its owner
- **THEN** it is returned with the new placement on that board, and its placement on every other board is unchanged

#### Scenario: A leader renames a global metric on their board

- **WHEN** a leader changes the name or the unit of an included global metric through their board
- **THEN** it is rejected with `global_metric.read_only` against that field, and the global metric is unchanged

#### Scenario: A threshold cannot be recorded through a board

- **WHEN** a leader or an administrator records a threshold version for an included global metric through a board
- **THEN** it is rejected with `global_metric.read_only` and HTTP 409, and no version is added
