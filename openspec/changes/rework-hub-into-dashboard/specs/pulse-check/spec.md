## ADDED Requirements

### Requirement: The answer form has its own address

The system SHALL keep in the board's address whether the pulse check view shows the answer form, so that the form can be opened directly and survives a reload. An address asking for the form of a meeting that takes no answers, or from a viewer who may not answer, SHALL show the results instead.

#### Scenario: The answer form is opened from its address

- **WHEN** a member opens the address of a team's board naming the coming meeting, the pulse check view and the answer form
- **THEN** the pulse check view of that meeting is displayed with the member's answer form

#### Scenario: The form of a frozen meeting falls back to the results

- **WHEN** a member opens the address of the answer form for a meeting that no longer takes answers
- **THEN** the pulse check view shows that meeting's results and no form

#### Scenario: Switching to the results updates the address

- **WHEN** a member switches from the answer form to the results
- **THEN** the address no longer asks for the form
