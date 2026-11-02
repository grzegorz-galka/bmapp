## MODIFIED Requirements

### Requirement: The readiness panel

The system SHALL show, on a team's board, a readiness panel for the meeting shown when that meeting still takes values and is dated today or later. It SHALL be shown collapsed, its heading alone, unless the board was opened from the panel's own address; the viewer SHALL be able to expand and collapse it. Expanded, it SHALL list the metrics still without a number, each with its owner's display name or "no owner", and the members who have not answered the pulse check by display name, and state how many people owe data. Its text SHALL be in the active language.

#### Scenario: The panel is collapsed by default

- **WHEN** a member opens the board of the coming meeting from an address that does not name the readiness panel
- **THEN** the readiness panel shows only its heading, and expanding it shows what is missing

#### Scenario: The panel lists what is missing

- **WHEN** a member expands the panel on the board of the coming meeting, at which 3 of 5 metrics have a number, one missing metric owned by anna.nowak@example.com and one with no owner, and 4 of 6 members have answered
- **THEN** the panel lists both missing metrics, one with "Anna Nowak" and one with "no owner", the two members who have not answered by display name, and the number of people who owe data

#### Scenario: A complete meeting says so

- **WHEN** the panel is expanded on the board of a coming meeting at which nothing is missing
- **THEN** the panel says that every metric is recorded and everyone has answered, and offers no addresses to copy

#### Scenario: A past meeting has no panel

- **WHEN** the board is shown on a meeting dated before today, or on one that no longer takes values
- **THEN** no readiness panel is shown

#### Scenario: The panel stays current

- **WHEN** a member records the number of a missing metric while the panel is expanded
- **THEN** the panel no longer lists that metric, without reloading the page
