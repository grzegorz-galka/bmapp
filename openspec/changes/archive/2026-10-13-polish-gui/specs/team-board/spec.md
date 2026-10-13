## ADDED Requirements

### Requirement: A team is registered from a dialog

The system SHALL show the registered teams on the teams page, and SHALL show the form for registering a team only in a dialog opened by "Register team". A registered team SHALL close the dialog and appear in the list; a rejection SHALL keep the dialog open with what was typed.

#### Scenario: The form is hidden until asked for

- **WHEN** an administrator opens the teams page
- **THEN** the registered teams and a "Register team" button are shown, and no registration field is shown

#### Scenario: A team is registered from the dialog

- **WHEN** the administrator chooses "Register team", enters a name and a leader's email and submits
- **THEN** the dialog closes and the new team is listed

#### Scenario: A rejection keeps the dialog open

- **WHEN** registering a team is rejected with `team_name.duplicate`
- **THEN** the dialog stays open, showing the reason next to the name and keeping the name and email typed
