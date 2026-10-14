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

### Requirement: The recording view's fields

The system SHALL size a metric's number field for ten characters. The colour set by hand SHALL be chosen from a list of four options, Automatic, Green, Amber and Red, in that order, captioned "Status". The list SHALL show Automatic unless a colour was set by hand; Automatic means no colour set by hand. Green, Amber and Red SHALL each be shown in their status colour in the list and once chosen, and named in words. Choosing green, amber or red SHALL still need the comment the value rule asks for.

#### Scenario: A status is set by hand with the toggle

- **WHEN** a member chooses "Red" from a metric's status list, types a comment and leaves the row
- **THEN** the value is recorded with red set by hand, and the list shows "Red" as chosen

#### Scenario: The list defaults to Automatic

- **WHEN** the recording view is displayed for a metric whose colour was not set by hand
- **THEN** its status list shows "Automatic", and offers Automatic, Green, Amber and Red in that order

#### Scenario: The colours are shown in colour

- **WHEN** a metric's status list is displayed and "Amber" is chosen
- **THEN** the Green, Amber and Red options are each drawn in their status colour, the list shows "Amber" in the amber status colour, Automatic is drawn in the ink colour, and each meets 4.5:1 against its background in both themes

#### Scenario: Automatic clears a status set by hand

- **WHEN** a member chooses "Automatic" on a metric whose colour was set by hand and leaves the row
- **THEN** the value is recorded with no colour set by hand, and its status is computed from its threshold

#### Scenario: The number field fits ten characters

- **WHEN** the recording view is displayed
- **THEN** each number field is wide enough for ten characters and no wider than twelve
