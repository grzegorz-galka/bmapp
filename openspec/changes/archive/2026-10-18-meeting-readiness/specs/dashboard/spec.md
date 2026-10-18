# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard lists the viewer's board meetings

The system SHALL show a tile "My board meetings" listing, from the viewer's teams' meetings that still take values and are dated today or later, the three that start soonest. A team with none SHALL contribute the date its schedule proposes, marked as not yet opened. Rows SHALL be ordered by start, soonest first, each showing the team, date and start time, whether it is today, the host, how many active metrics have a value of how many, how many current members have answered its pulse check of how many, whether the viewer has answered it, and how many people still owe data for it as the `meeting-readiness` capability counts them. With more than three, a "More…" link SHALL lead to My meetings.

#### Scenario: Today's and the next meeting are listed

- **WHEN** a team of the viewer holds a meeting today and has opened one for next week
- **THEN** both are listed, today's marked as today, each with its host, its recording progress, its pulse check progress and whether the viewer has answered its pulse check

#### Scenario: Last week's meeting is not listed

- **WHEN** a team's latest meeting was yesterday and it has opened none since
- **THEN** yesterday's meeting is not listed, and the date its schedule proposes is listed instead if it has a schedule

#### Scenario: A proposed date is listed as not yet opened

- **WHEN** a team meets on Wednesdays and has opened no meeting dated today or later
- **THEN** the proposed Wednesday is listed at the schedule's start time, marked as not yet opened, with no host, no recording progress, no pulse check progress and no count of people owing data

#### Scenario: Meetings of several teams are interleaved

- **WHEN** the viewer is a member of two teams whose next meetings fall on Tuesday and on Monday
- **THEN** Monday's row is listed before Tuesday's

#### Scenario: At most three meetings are listed

- **WHEN** the viewer's teams have five meetings coming up between them
- **THEN** the three that start soonest are listed, and a "More…" link whose accessible name says it shows more board meetings leads to My meetings

#### Scenario: Three meetings need no link to more

- **WHEN** the viewer's teams have exactly three meetings coming up between them
- **THEN** all three are listed and no "More…" link is shown

#### Scenario: Recording progress and the pulse check are stated in words

- **WHEN** a meeting has values for 12 of 14 active metrics, 4 of the team's 6 members have answered its pulse check and the viewer is not one of them
- **THEN** the row reads that 12 of 14 are recorded, that 4 of 6 have answered the pulse check and that the viewer's pulse check is not answered, in the active language and not by colour alone

#### Scenario: The people owing data are counted, not named

- **WHEN** three people owe data for a meeting listed on the dashboard
- **THEN** the row reads that 3 people still owe data, and names none of them

#### Scenario: Nothing is coming up

- **WHEN** none of the viewer's teams has a meeting dated today or later or a schedule
- **THEN** the tile says in the active language that no board meeting is coming up

## ADDED Requirements

### Requirement: Check readiness from a meeting row

The system SHALL offer "Check readiness" on every opened row of the "My board meetings" tile, to every member, as an ordinary action. Choosing it SHALL open the team's board on that meeting with its readiness panel in view. A row not yet opened SHALL NOT offer it.

#### Scenario: The readiness of a coming meeting is checked

- **WHEN** the viewer chooses "Check readiness" on the row of next Wednesday's opened meeting
- **THEN** that team's board is displayed on that meeting with the readiness panel in view

#### Scenario: Every member is offered it

- **WHEN** a member who does not host a meeting views its row
- **THEN** the row offers "Check readiness"

#### Scenario: A proposed row does not offer it

- **WHEN** a row is proposed by the schedule and not yet opened
- **THEN** it offers no "Check readiness"

### Requirement: The viewer's own meetings to host are marked

The system SHALL mark, in words, a row of the "My board meetings" tile and of My meetings whose host is the viewer as hosted by them, in place of their own email.

#### Scenario: The host sees their meeting marked

- **WHEN** the viewer is named host of next Wednesday's meeting of their team
- **THEN** that row reads "You host" rather than the viewer's email

#### Scenario: Another member's meeting is not marked

- **WHEN** a meeting's host is another member
- **THEN** the row shows that member's email as host and no "You host" mark
