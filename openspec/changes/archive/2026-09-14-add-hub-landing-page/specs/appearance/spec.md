## Purpose

Governs the visual theme the web interface is displayed in. BMAPP is read at a board in
a meeting room as often as it is read at a desk, and the two are lit very differently,
so a person has to be able to choose between a dark and a light interface and have that
choice stick. This capability owns which themes exist, which one a first-time visitor
gets, how it is changed and how it is remembered.

## ADDED Requirements

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
