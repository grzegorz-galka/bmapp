## ADDED Requirements

### Requirement: A team is registered from a section of the teams page

The system SHALL show the registered teams on the teams page, and SHALL show the form for registering a team only in a section of that page revealed by "Register team", which SHALL report whether the section is expanded. Revealing it SHALL move focus to its first field. A registered team SHALL close the section and appear in the list; a rejection SHALL keep it open with what was typed. Cancel and Escape SHALL close it without registering.

#### Scenario: The form is hidden until asked for

- **WHEN** an administrator opens the teams page
- **THEN** the registered teams and a "Register team" button are shown, and no registration field is shown

#### Scenario: The form opens in the page

- **WHEN** the administrator chooses "Register team"
- **THEN** the name and leader's email fields are shown in the teams page itself, not in a dialog, the button reports the section as expanded, and focus is on the name field

#### Scenario: A team is registered from the section

- **WHEN** the administrator chooses "Register team", enters a name and a leader's email and submits
- **THEN** the section closes and the new team is listed

#### Scenario: A rejection keeps the section open

- **WHEN** registering a team is rejected with `team_name.duplicate`
- **THEN** the section stays open, showing the reason next to the name and keeping the name and email typed

#### Scenario: Cancelling closes the section

- **WHEN** the administrator has revealed the section, typed a name, and chooses Cancel or presses Escape
- **THEN** the section closes, no team is registered, and the button reports the section as collapsed

## REMOVED Requirements

### Requirement: A team is registered from a dialog

**Reason**: Registering a team is a two-field form an administrator fills in while looking at the team list; a section of the teams page keeps the list in view, where a dialog covered it. It is one of the two documented exceptions to the rule that add forms open in a dialog.

**Migration**: Replaced by "A team is registered from a section of the teams page", which keeps the same behaviour - the form hidden until asked for, the team listed on success, the typed values kept on a rejection - in a section of the page instead of a dialog.
