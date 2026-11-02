# Spec Delta

## ADDED Requirements

### Requirement: The viewer's answer at another team's meeting that week

The system SHALL return, with a meeting's results, the viewer's own answer at a meeting of another team dated in the same ISO week as this meeting, if they have one: its rating, its three texts, the team's name and the meeting's date. With several, it SHALL return the one changed last. It SHALL return none when the viewer has an answer at this meeting, and SHALL never return anyone else's answer.

#### Scenario: An answer at another team's meeting that week is returned

- **WHEN** a member of "Alpha" and "Beta" answered at Alpha's Monday meeting and requests the results of Beta's Thursday meeting in the same ISO week, where they have no answer
- **THEN** the results carry their Alpha answer with its rating, texts, the team name "Alpha" and Monday's date

#### Scenario: An answer in another week is not returned

- **WHEN** the member's only other answer is at Alpha's meeting on the Monday of the previous ISO week
- **THEN** the results of Beta's meeting carry no answer from another team

#### Scenario: The answer changed last wins

- **WHEN** the member answered at meetings of "Alpha" and "Gamma" in the same ISO week, and changed the Gamma answer after the Alpha one
- **THEN** the results of Beta's meeting carry the Gamma answer

#### Scenario: Nothing is offered once the meeting is answered

- **WHEN** the member has answered at Beta's meeting and at Alpha's meeting in the same ISO week
- **THEN** the results of Beta's meeting carry no answer from another team

#### Scenario: Only the viewer's own answer is returned

- **WHEN** another member of Beta answered at Alpha's meeting that week, and the viewer did not answer anywhere that week
- **THEN** the results the viewer receives for Beta's meeting carry no answer from another team

### Requirement: The answer form offers to copy that week's answer

The system SHALL, when the answer form is shown for a meeting at which the viewer has no answer and the results carry their answer at another team's meeting that week, offer above the questions to copy it, naming that team and meeting date. Copying SHALL fill the rating and the three texts without saving them. Declining SHALL hide the offer until the page is loaded again and SHALL NOT be remembered.

#### Scenario: Copying fills the form without saving

- **WHEN** a member opens the answer form for Beta's meeting, is offered their Alpha answer of that week, and chooses "Copy"
- **THEN** the form holds the Alpha rating and texts, the offer is gone, and no answer is recorded at Beta's meeting until they save

#### Scenario: The copied answer can be changed before saving

- **WHEN** the member copies their Alpha answer, changes the rating from 4 to 3 and saves
- **THEN** the answer recorded at Beta's meeting has the rating 3 and the copied texts, and the Alpha answer is unchanged

#### Scenario: Declining hides the offer

- **WHEN** the member chooses "Not now" on the offer
- **THEN** the offer is hidden, the form stays empty, and opening the page again offers it again

#### Scenario: No offer without an answer elsewhere

- **WHEN** a member opens the answer form for a meeting and has answered at no other team's meeting that ISO week
- **THEN** no offer to copy is shown

#### Scenario: The offer is in the active language

- **WHEN** the offer is shown with the Polish interface
- **THEN** it names the team and the meeting's date in Polish, with its actions in Polish
