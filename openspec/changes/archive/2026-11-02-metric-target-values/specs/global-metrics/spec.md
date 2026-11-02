# Spec Delta

## MODIFIED Requirements

### Requirement: Thresholds of a global metric

The system SHALL allow threshold versions to be recorded for a global metric, and its threshold history to be listed, under the rules the `metrics` capability sets for a board's metric. The version in force at a meeting SHALL be decided the same way, and SHALL apply on every board that includes the metric.

#### Scenario: One threshold judges every board

- **WHEN** a version effective from 2026-10-01 with green from 99.5 and amber from 99 is recorded for a global metric, and two teams record 99.2 at meetings after that date
- **THEN** both values are amber

#### Scenario: One target value judges every board

- **WHEN** a version effective from 2026-11-01 with the target value 100 and tolerances 5 and 10 is recorded for a global metric, and two teams record 92 at meetings after that date
- **THEN** both values are amber

#### Scenario: Invalid versions are refused as for a board's metric

- **WHEN** a version is recorded for a global metric with its amber boundary better than its green one, with an amber tolerance smaller than its green one, with no target value, or with a blank reason
- **THEN** it is rejected with `threshold.order_invalid`, `threshold.order_invalid`, `request.invalid_field` against `target_value` or `threshold_reason.blank` respectively, and no version is added

### Requirement: A board cannot change a global metric's definition

The system SHALL allow a board to change only an included global metric's group, its place in the board's layout, its owner, whether it is hidden on that board, and its retirement on that board. A change on a board to its name, unit, decimals or direction, or a threshold version recorded through a board, SHALL be rejected with `global_metric.read_only` and HTTP 409, for an administrator as for a leader, and SHALL change nothing.

#### Scenario: A leader moves and regroups a global metric

- **WHEN** a leader moves an included global metric to another group of their board and changes its owner
- **THEN** it is returned with the new placement on that board, and its placement on every other board is unchanged

#### Scenario: A leader hides a global metric on their board

- **WHEN** a leader marks an included global metric hidden on their board, and another board includes it too
- **THEN** it is returned hidden on that board, and shown on the other board

#### Scenario: A leader renames a global metric on their board

- **WHEN** a leader changes the name or the unit of an included global metric through their board
- **THEN** it is rejected with `global_metric.read_only` against that field, and the global metric is unchanged

#### Scenario: A threshold cannot be recorded through a board

- **WHEN** a leader or an administrator records a threshold version for an included global metric through a board
- **THEN** it is rejected with `global_metric.read_only` and HTTP 409, and no version is added

### Requirement: The global metrics page

The system SHALL present the catalogue of global metrics on its own page, reachable from the application header, listing each with its unit, direction, threshold in force today, retirement and the number of boards including it, and its threshold history on request. A threshold SHALL read and be recorded as on a board's metric settings page: a target value with tolerances, or boundaries when the target value is 0. No form for a new global metric SHALL be shown on the page itself: "Add global metric" SHALL open it in a dialog over the page. All text SHALL be in the active language.

#### Scenario: The catalogue is shown

- **WHEN** the global metrics page is opened
- **THEN** every global metric is listed with its unit, direction, threshold in force today, whether it is retired and how many boards include it

#### Scenario: A global threshold reads as a target value

- **WHEN** the global metrics page lists a global metric whose version in force has the target value 100 and tolerances 5 and 10
- **THEN** its threshold reads as the target value 100 with tolerances 5% and 10%

#### Scenario: The add form is hidden until asked for

- **WHEN** an administrator opens the global metrics page
- **THEN** an "Add global metric" button is shown, and no field for a new global metric is shown on the page

#### Scenario: A global metric is added from the dialog

- **WHEN** the administrator chooses "Add global metric", fills in the definition in the dialog and submits it
- **THEN** the dialog closes and the new metric is listed in the catalogue

#### Scenario: A rejection keeps the dialog open

- **WHEN** adding a global metric is rejected with `metric_name.duplicate`
- **THEN** the dialog stays open, showing the reason next to the name and keeping what was typed
