## Purpose

Governs the visual theme the web interface is displayed in. BMAPP is read at a board in
a meeting room as often as it is read at a desk, and the two are lit very differently,
so a person has to be able to choose between a dark and a light interface and have that
choice stick. This capability owns which themes exist, which one a first-time visitor
gets, how it is changed and how it is remembered.

## Requirements

### Requirement: The interface is available in a dark and a light theme

The system SHALL display the web interface in the active theme. The supported themes
SHALL be dark and light. The active theme SHALL apply to the whole interface — every
page, the application header and every control on it — so that no part of the interface
is displayed in one theme while the rest is displayed in the other.

The system SHALL declare the active theme on the document, so that browser and platform
chrome rendered around the page — form controls, scrollbars — matches it.

Text and its background SHALL meet a contrast ratio of at least 4.5:1 in both themes for
body text, and at least 3:1 for large text and for the boundaries of controls.

#### Scenario: The interface renders in the dark theme

- **WHEN** the active theme is dark
- **THEN** the whole interface is displayed in the dark theme and the document declares
  the dark theme

#### Scenario: The interface renders in the light theme

- **WHEN** the active theme is light
- **THEN** the whole interface is displayed in the light theme and the document declares
  the light theme

#### Scenario: Both themes are legible

- **WHEN** the interface is displayed in either theme
- **THEN** body text meets a contrast ratio of at least 4.5:1 against its background, and
  large text and control boundaries meet at least 3:1

### Requirement: A first-time visitor gets the dark theme

The system SHALL display the dark theme to a visitor who has not chosen a theme. A
remembered value that names an unsupported theme, or that cannot be read back, SHALL be
ignored and the dark theme used, and the application SHALL start normally rather than
failing.

#### Scenario: A first-time visitor sees the dark theme

- **WHEN** a visitor with no remembered choice opens the application
- **THEN** the interface is displayed in the dark theme

#### Scenario: An unusable remembered value is ignored

- **WHEN** the remembered theme names a theme the application does not support, or
  cannot be read back
- **THEN** the interface is displayed in the dark theme and the application starts
  normally

### Requirement: A user can change the theme

The system SHALL present a theme control in the application header on every page. The
control SHALL name the theme choosing it would switch to, in the active language, and
SHALL report the currently active theme to assistive technology. Choosing it SHALL
switch the interface to the other theme immediately, across the whole interface, without
reloading the page and without losing the data already loaded or the text already typed
into a form.

#### Scenario: The user switches to the light theme

- **WHEN** the interface is displayed in the dark theme and the user uses the theme
  control
- **THEN** the whole interface is redisplayed in the light theme without a page reload,
  and the control now names the dark theme

#### Scenario: The user switches back to the dark theme

- **WHEN** the interface is displayed in the light theme and the user uses the theme
  control
- **THEN** the whole interface is redisplayed in the dark theme without a page reload,
  and the control now names the light theme

#### Scenario: Work in progress survives a theme change

- **WHEN** the user has typed into a form field, or a list has been loaded, and the
  theme is then changed
- **THEN** the typed text and the loaded list are still present, and only the appearance
  has changed

#### Scenario: The theme control is named in the active language

- **WHEN** the language is changed while the theme control is displayed
- **THEN** the control's wording is redisplayed in the newly active language

### Requirement: The chosen theme is remembered

The system SHALL remember a theme the user chose explicitly and SHALL apply it on the
user's later visits in preference to the default. The remembered theme SHALL be applied
before the interface is first painted, so that a user who chose the light theme does not
see the dark one flash first.

#### Scenario: A remembered choice is applied on a later visit

- **WHEN** a user who chose the light theme opens the application again
- **THEN** the interface is displayed in the light theme

#### Scenario: The remembered theme is applied without a flash

- **WHEN** a user who chose the light theme opens the application again
- **THEN** the light theme is in effect from the first paint, and the dark theme is not
  displayed first

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
