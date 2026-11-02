# Spec Delta

## MODIFIED Requirements

### Requirement: How complete a meeting's recording is

The system SHALL return, with a meeting's board, how many active metrics have a number recorded at that meeting out of how many there are, and the metrics still without one, each with its owner if it has one. A metric hidden on the board is active and SHALL be counted.

#### Scenario: Recording is partly done

- **WHEN** a board has 14 active metrics, 12 have a number at a meeting, and one of the 2 missing has an owner
- **THEN** the board reports 12 of 14, and lists the 2 missing metrics, one with its owner

#### Scenario: A hidden metric counts towards completeness

- **WHEN** a board has three shown metrics with a number at a meeting and one hidden metric without one
- **THEN** the board reports 3 of 4 recorded, with the hidden metric listed as missing

### Requirement: The board page

The system SHALL present a team's board at the team's own address. It SHALL show one meeting's metrics as tiles under the board's groups, in the board's order, with the ungrouped metrics last under a heading of their own and a group that shows no metric left out, each tile with its value, colour, change and sparkline. A metric hidden on the board SHALL have no tile, and a group whose metrics are all hidden SHALL be left out. It SHALL move between the team's meetings, opening at its first meeting dated today or later, or else its latest. All text SHALL be in the active language.

#### Scenario: The board opens on the coming meeting

- **WHEN** a team's board is opened on a Monday before that week's Wednesday meeting
- **THEN** the board shows the Wednesday meeting

#### Scenario: Colour is never the only signal

- **WHEN** a tile is red, amber or green, or its colour was set by hand
- **THEN** the status and the set-by-hand mark are also given in words

#### Scenario: A board without metrics

- **WHEN** the board of a team with no metrics is opened
- **THEN** the board says no metrics are defined yet and, to a viewer who may configure the board, links to the metric settings

#### Scenario: Tiles follow the board's layout

- **WHEN** a board with the groups "Finance" then "Quality", "Quality" holding "Defects" then "Bugs", one ungrouped metric "Morale" and an empty group "Delivery" is opened at a meeting
- **THEN** the tiles are shown under "Finance", then "Quality" with "Defects" before "Bugs", then "Morale" under the ungrouped heading, and no heading "Delivery" is shown

#### Scenario: A hidden metric has no tile

- **WHEN** a board whose group "Headcount" holds the hidden metric "Zatrudnienie" and the shown metric "Zatrudnienie delta" is opened at a meeting where both have a number
- **THEN** only the tile "Zatrudnienie delta" is shown under "Headcount"

#### Scenario: A group of hidden metrics is left out

- **WHEN** a board's group holds only hidden metrics
- **THEN** the board shows no heading for that group

### Requirement: The recording view

The system SHALL present, for a meeting that can be edited, a table listing every active metric with its threshold in force, one row per metric and one column each for the metric, its number, its status set by hand, its comment and whether it was saved. A metric hidden on the board SHALL be listed like any other. For each it SHALL show the previous meeting's number and fields for the number, the comment and a colour set by hand, headed by how complete the recording is. Numbers SHALL be entered and shown in the active language's format.

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

### Requirement: The metric detail

The system SHALL present, for a metric, a trend chart over the team's meetings. The chart SHALL show each number coloured by its status, the threshold in force as a stepped line or band, and the target value in force, where the version has one, as a stepped line of its own. The detail SHALL also list the recorded values with their comments, the threshold history and the correction log.

#### Scenario: The chart shows a threshold change as a step

- **WHEN** the detail of a metric whose threshold changed between two meetings is opened
- **THEN** the threshold line steps at the meeting from which the new version applies

#### Scenario: The chart shows the target value

- **WHEN** the detail of a metric is opened whose target value was 376 until a version with the target value 395 took effect
- **THEN** the chart draws the target value as a line at 376 that steps to 395 at the meeting from which the new version applies, and the threshold zones step with it
