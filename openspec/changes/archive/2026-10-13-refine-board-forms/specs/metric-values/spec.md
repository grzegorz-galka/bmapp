## MODIFIED Requirements

### Requirement: The recording view

The system SHALL present, for a meeting that can be edited, a table listing every active metric with its threshold in force, one row per metric and one column each for the metric, its number, its status set by hand, its comment and whether it was saved. For each it SHALL show the previous meeting's number and fields for the number, the comment and a colour set by hand, headed by how complete the recording is. Numbers SHALL be entered and shown in the active language's format.

#### Scenario: A number is typed in the Polish format

- **WHEN** a member types `95,3` into a metric's number while the interface is in Polish
- **THEN** 95.3 is recorded, and shown as `95,3`

#### Scenario: A frozen meeting is read-only

- **WHEN** the recording view is opened for a meeting that cannot be edited, by someone who is not an administrator
- **THEN** the values are shown without fields to change them

#### Scenario: The fields line up in columns

- **WHEN** the recording view is displayed for metrics whose names and units differ in length
- **THEN** it is a table with the column headers Metric, Value, Status, Comment and a column for the row's state, and every metric's number field, status toggle and comment field sit in the same column as the others'

#### Scenario: Each field is named after its metric

- **WHEN** the recording view is displayed
- **THEN** no field label is repeated on each row, and each metric's number field, status toggle and comment field has an accessible name that includes the metric's name

#### Scenario: A frozen meeting uses the same columns

- **WHEN** the recording view is opened read-only for a meeting that cannot be edited
- **THEN** its values are shown in the same table columns as when they can be edited

#### Scenario: A narrow screen stacks each metric

- **WHEN** the recording view is displayed narrower than 40rem
- **THEN** each metric is shown as a card with its fields stacked and labelled, and the page does not scroll sideways
