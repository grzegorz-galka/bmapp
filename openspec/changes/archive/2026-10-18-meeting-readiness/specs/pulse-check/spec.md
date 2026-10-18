# Spec Delta

## MODIFIED Requirements

### Requirement: Names can be hidden for screen sharing

The system SHALL offer, on a team's board, a switch that hides who answered and who owes data. While it is on, the pulse check answers SHALL be labelled "Person 1", "Person 2" and so on, the missing members SHALL be reported only as a number, the readiness panel SHALL name no one and offer no addresses, and the problem and task lists SHALL not show who is responsible. The switch SHALL stay on across the board's views and meetings until the board is left, SHALL NOT be remembered, and SHALL change only the viewer's own screen.

#### Scenario: Names are hidden

- **WHEN** a member turns on hiding names in a pulse check view with 7 answers and 4 missing members
- **THEN** the table labels the answers Person 1 to Person 7, and the card reads that 4 answers are missing without naming anyone

#### Scenario: Hidden names stay hidden across views

- **WHEN** a member turns on hiding names in the pulse check view, switches to the metrics and back, then moves to the next meeting
- **THEN** no answer, missing member, metric owner or responsible member is named at any point

#### Scenario: The readiness panel and the item lists name no one

- **WHEN** names are hidden on the board of a coming meeting at which two people owe data and a problem has a responsible member
- **THEN** the readiness panel reports only how many people owe data and offers no addresses to copy, and the problem's row shows no responsible member

#### Scenario: Leaving the board forgets the switch

- **WHEN** a member hides names, leaves the board and opens it again
- **THEN** names are shown
