# Spec Delta

## MODIFIED Requirements

### Requirement: The recording view

The system SHALL present, for a meeting that can be edited, a table listing every active metric with its threshold in force, one row per metric and one column each for the metric, its number, its status set by hand, its comment and whether it was saved. The metrics SHALL be listed under the board's groups, in the board's order, the ungrouped ones last under a heading of their own. A metric hidden on the board SHALL be listed like any other, under its group. For each it SHALL show the previous meeting's number and fields for the number, the comment and a colour set by hand, headed by how complete the recording is. A row's message SHALL be shown on a line of its own under the row, as wide as the table. Numbers SHALL be entered and shown in the active language's format.

#### Scenario: A number is typed in the Polish format

- **WHEN** a member types `95,3` into a metric's number while the interface is in Polish
- **THEN** 95.3 is recorded, and shown as `95,3`

#### Scenario: A hidden metric is recorded

- **WHEN** the recording view is opened for a meeting of a board with a hidden metric
- **THEN** the hidden metric has its row with fields for the number, the status and the comment, and a number typed there is recorded

#### Scenario: A frozen meeting is read-only

- **WHEN** the recording view is opened for a meeting that cannot be edited, by someone who is not an administrator
- **THEN** the values are shown without fields to change them

#### Scenario: The fields line up in columns

- **WHEN** the recording view is displayed for metrics whose names and units differ in length
- **THEN** it is a table with the column headers Metric, Value, Status, Comment and a column for the row's state, and every metric's number field, status list and comment field sit in the same column as the others'

#### Scenario: Each field is named after its metric

- **WHEN** the recording view is displayed
- **THEN** no field label is repeated on each row, and each metric's number field, status list and comment field has an accessible name that includes the metric's name

#### Scenario: A frozen meeting uses the same columns

- **WHEN** the recording view is opened read-only for a meeting that cannot be edited
- **THEN** its values are shown in the same table columns as when they can be edited

#### Scenario: A narrow screen stacks each metric

- **WHEN** the recording view is displayed narrower than 40rem
- **THEN** each metric is shown as a card with its fields stacked and labelled, and the page does not scroll sideways

#### Scenario: The metrics are listed under their groups

- **WHEN** the recording view is opened for a board with the groups "Delivery" and "Quality", in that order, and one ungrouped metric
- **THEN** the table lists the metrics of "Delivery" under its heading, then those of "Quality" under its heading, each in the board's order, then the ungrouped metric under the heading for metrics in no group

#### Scenario: A hidden metric is listed under its group

- **WHEN** the recording view is opened for a board whose group "Quality" holds a hidden metric and a shown one
- **THEN** both are listed under the heading "Quality", in the board's order

#### Scenario: A group with only hidden metrics

- **WHEN** a group's metrics are all hidden on the board
- **THEN** the board shows no section for the group, and the recording view lists the group with its metrics

#### Scenario: A metric's details stay on one line

- **WHEN** the recording view is displayed in a window 1280 pixels wide for a metric whose threshold and previous number together take 60 characters
- **THEN** the metric's threshold and previous number are shown on one line

#### Scenario: A row's message spans the table

- **WHEN** a number that is not a number is typed into a row and the field is left
- **THEN** the message is shown on a line under that row, as wide as the table, and the row's other cells keep their width

### Requirement: The problems and tasks column is wider

The system SHALL keep the board within the same maximum width as the other pages, so a wide window centres it rather than stretching the metrics and the problems and tasks apart, and SHALL give the problems and tasks beside the tiles a column 20% wider than the other pages' side columns, between 21.6rem and 31.2rem. While the values are listed, the listing SHALL take the board's full width.

#### Scenario: The problems and tasks column is wider

- **WHEN** a team's board is opened in a window 1920 pixels wide
- **THEN** the problems and tasks column is 31.2rem wide and the board is no wider than the dashboard

#### Scenario: The recording view takes the full width

- **WHEN** a member opens the recording view in a window 1920 pixels wide
- **THEN** no problems and tasks column is shown, and the recording table is as wide as the board
