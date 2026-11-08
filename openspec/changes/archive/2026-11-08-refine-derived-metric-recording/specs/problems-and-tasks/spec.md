# Spec Delta

## MODIFIED Requirements

### Requirement: The board shows the active problems and tasks

The board page SHALL show, beside the tiles of the meeting shown, the team's active problems and its active tasks as two lists, in the order the system returns them. While the meeting's values are listed, recorded or corrected, the lists SHALL NOT be shown. Each entry SHALL show its summary, its responsible person, its due date with an overdue mark, and its stage. Entries raised at the meeting shown SHALL be marked new, and the count of items closed at it SHALL be shown.

#### Scenario: The lists are shown

- **WHEN** a team's board is opened and the team has two active problems and three active tasks
- **THEN** both lists are shown beside the metrics, with each entry's summary, responsible person, due date and stage

#### Scenario: The lists are not shown while values are listed

- **WHEN** a member opens the recording view of a meeting, or a visitor lists the values of a frozen meeting, or an administrator corrects them
- **THEN** neither the problems list nor the tasks list is shown, and leaving for the tiles shows both again

#### Scenario: The overdue mark and the stage are not colour alone

- **WHEN** an entry is overdue, and another is at the stage `do`
- **THEN** the first is marked overdue in words, and the second's stage is named in words alongside its PDCA symbol

#### Scenario: New at this meeting

- **WHEN** the board shows a meeting at which one of the active tasks was raised
- **THEN** that task is marked new, and the others are not

#### Scenario: Closed at this meeting

- **WHEN** the board shows a meeting at which two items were closed
- **THEN** the board says that two items were closed at this meeting

#### Scenario: The lists do not depend on the meeting shown

- **WHEN** the board is moved from the coming meeting to an older one
- **THEN** the same active problems and tasks are shown

#### Scenario: Nothing is open

- **WHEN** a team has no active problems
- **THEN** the problems list says so in the active language rather than showing an empty area

### Requirement: The board's lists can be reached from an address

The system SHALL let an address of a team's board name its problems list or its tasks list, and SHALL bring the named list into view when the board is displayed. An address that names a list and also asks for the recording view SHALL display the tiles with the named list in view.

#### Scenario: The tasks list is brought into view

- **WHEN** a visitor opens the address of a team's board naming its tasks list
- **THEN** the board is displayed with its tasks list in view

#### Scenario: The problems list is brought into view

- **WHEN** a visitor opens the address of a team's board naming its problems list
- **THEN** the board is displayed with its problems list in view

#### Scenario: A list named while the recording view is asked for

- **WHEN** a visitor opens the address of a team's board asking for the recording view and naming its tasks list
- **THEN** the board is displayed with the tiles and its tasks list in view, and the address no longer asks for the recording view
