## ADDED Requirements

### Requirement: Actions are outlined buttons

The system SHALL draw every button that performs an action as an outlined button: the panel's background, a border at control strength and text in the ink colour, with an accent tint while hovered. Pages SHALL NOT draw an action as a button filled with the accent colour. The header's navigation, language and theme controls are not actions in this sense.

#### Scenario: Actions on different pages look alike

- **WHEN** the metric settings page, a team's members page, the meetings page and the dashboard are displayed in either theme
- **THEN** every action button on them is outlined in the same way, and none of them is filled with the accent colour

#### Scenario: An action is tinted on hover

- **WHEN** a pointer rests on an action button
- **THEN** the button is tinted with the accent colour and its caption stays legible at 4.5:1

### Requirement: The solid accent marks a control that is on

The system SHALL fill a control with the solid accent colour only while that control is on: the chosen segment of a view switch, a toggle button that is pressed, or a disclosure button that is expanded. The same control SHALL be outlined while it is off. Its state SHALL also be exposed to assistive technology, not shown by colour alone.

#### Scenario: The chosen view is filled

- **WHEN** a board is displayed with its metrics view chosen in the view switch
- **THEN** the Metrics segment is filled with the solid accent and reported as pressed, and the other segments are outlined and reported as not pressed

#### Scenario: A disclosure is filled while it is open

- **WHEN** an administrator chooses "Register team" on the teams page and then chooses it again
- **THEN** the button is filled with the solid accent and reported as expanded while the section is open, and is outlined and reported as collapsed after the second choice

### Requirement: The default action of a group is marked lightly

The system SHALL mark the default action of a group of related actions, such as the submit of a form or the first way to add something, by outlining it in the accent colour with accent text and a heavier caption. It SHALL NOT fill it. A group SHALL have at most one default action.

#### Scenario: A form's submit is the default

- **WHEN** a dialog with a submit and a Cancel button is displayed, such as creating a metric
- **THEN** the submit is outlined in the accent colour with accent text and is not filled, and Cancel is an ordinary outlined button

#### Scenario: Creating a metric is the default way to add one

- **WHEN** a leader opens a team's metric settings page
- **THEN** "Create new metric" is marked as the default, and "Copy from another board" and "Include global metric" are ordinary outlined buttons

#### Scenario: The default action is legible in both themes

- **WHEN** a default action is displayed in either theme
- **THEN** its caption meets 4.5:1 and its accent border meets 3:1 against the panel

### Requirement: Navigation is a link

The system SHALL present a control that only leads to another page as a link, in the link colour and without a button's border and background. A control that changes data before it leads anywhere, such as an action on a dashboard meeting row that may open the meeting first, remains a button.

#### Scenario: The board's own links are links

- **WHEN** a team's board is displayed
- **THEN** the controls leading to its meetings page and its metric settings page are links without a button's border, and the meeting navigator's Previous and Next are outlined buttons

#### Scenario: The meetings page's own links are links

- **WHEN** a team's meetings page is displayed
- **THEN** the controls leading to the team's board and its metric settings page are links without a button's border, each with an icon

#### Scenario: No page draws a link as a button

- **WHEN** any page of the application is displayed
- **THEN** no control that only leads to another page carries a button's outline or the default marking

#### Scenario: The dashboard's list links are links

- **WHEN** the dashboard's "My teams' problems and tasks" tile is displayed
- **THEN** each team's problems, tasks and archive controls are links without a button's border
