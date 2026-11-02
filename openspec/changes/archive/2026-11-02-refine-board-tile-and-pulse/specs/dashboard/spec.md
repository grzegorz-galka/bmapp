# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard shows the viewer's teams

The system SHALL list, in a tile "My teams", at most three of the teams the viewer is a member of, ordered by next meeting, soonest first, those without one last by name. The next meeting is the team's first opened meeting dated today or later, otherwise the date its schedule proposes, otherwise none. Each row SHALL show the team's name as a link to its members page, the viewer's role on it — team leader, leader deputy or member — its board's schedule or that it has none, and its next meeting's date and start time as a link to its meetings page. No row SHALL show a countdown to its meeting. The number of teams SHALL be shown. With more than three, a "More…" link SHALL lead to My teams.

#### Scenario: Teams are listed in order of their next meeting

- **WHEN** the viewer is a member of three teams, two with a next meeting on different dates and one with none
- **THEN** all three are listed with their name, the viewer's role, their schedule and their next meeting, the soonest first and the one without a meeting last, and the number 3 is shown

#### Scenario: A team's name leads to its members and its meeting to its meetings

- **WHEN** the viewer chooses a listed team's name, and then that team's next meeting
- **THEN** the team's members page is displayed, and then the team's meetings page

#### Scenario: At most three teams are listed

- **WHEN** the viewer is a member of five teams
- **THEN** the three with the soonest next meeting are listed, the number 5 is shown, and a "More…" link whose accessible name says it shows more teams leads to My teams

#### Scenario: Three teams need no link to more

- **WHEN** the viewer is a member of exactly three teams
- **THEN** all three are listed and no "More…" link is shown

#### Scenario: The nearest team is not repeated

- **WHEN** the dashboard is displayed to a member of two teams
- **THEN** each team's name appears once in the tile, and no separate block repeats the nearest team's name and date

#### Scenario: The viewer's role is shown per team

- **WHEN** the viewer leads one team, is a deputy of a second and an ordinary member of a third
- **THEN** the summary carries the role codes `leader`, `deputy` and `member` for them respectively, and the dashboard shows "Team leader", "Leader deputy" and "Member" in English and "Lider zespołu", "Zastępca lidera" and "Członek" in Polish

#### Scenario: An opened meeting comes before the proposal

- **WHEN** a team meets on Wednesdays and has opened a meeting for this Thursday
- **THEN** its next meeting is this Thursday's, not the proposed Wednesday

#### Scenario: A team with no meeting and no schedule

- **WHEN** a team of the viewer has no meeting dated today or later and its board has no schedule
- **THEN** the team is listed saying that it has no schedule and no next meeting, and the no-next-meeting text still leads to its meetings page

#### Scenario: A viewer on no team

- **WHEN** the dashboard is displayed to a person who is a member of no team
- **THEN** it says in the active language that they belong to no team yet

#### Scenario: The nearest meeting has no countdown

- **WHEN** the dashboard is displayed and the viewer's nearest next meeting is in the future
- **THEN** its row shows the meeting's date and start time and no countdown or timer

## REMOVED Requirements

### Requirement: The countdown to the nearest meeting

**Reason**: The row already shows the next meeting's date and start time, so a countdown that only the nearest row carries adds noise without adding information.

**Migration**: None. Read the meeting's date and start time on the team's row; the component, its timer and its catalogue strings are removed.
