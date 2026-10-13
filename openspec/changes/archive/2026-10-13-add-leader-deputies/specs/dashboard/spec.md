# Spec Delta

## MODIFIED Requirements

### Requirement: The dashboard shows the viewer's teams

The system SHALL list every team the viewer is a member of, with its name, the viewer's role on it — team leader, leader deputy or member — its board's schedule or that it has none, and its next meeting. The next meeting is the team's first opened meeting dated today or later, otherwise the date its schedule proposes, otherwise none. Teams SHALL be ordered by next meeting, soonest first, those without one last by name. The number of teams SHALL be shown.

#### Scenario: Teams are listed in order of their next meeting

- **WHEN** the viewer is a member of three teams, two with a next meeting on different dates and one with none
- **THEN** all three are listed with their name, the viewer's role, their schedule and their next meeting, the soonest first and the one without a meeting last, and the number 3 is shown

#### Scenario: The viewer's role is shown per team

- **WHEN** the viewer leads one team, is a deputy of a second and an ordinary member of a third
- **THEN** the summary carries the role codes `leader`, `deputy` and `member` for them respectively, and the dashboard shows "Team leader", "Leader deputy" and "Member" in English and "Lider zespołu", "Zastępca lidera" and "Członek" in Polish

#### Scenario: An opened meeting comes before the proposal

- **WHEN** a team meets on Wednesdays and has opened a meeting for this Thursday
- **THEN** its next meeting is this Thursday's, not the proposed Wednesday

#### Scenario: A team with no meeting and no schedule

- **WHEN** a team of the viewer has no meeting dated today or later and its board has no schedule
- **THEN** the team is listed saying that it has no schedule and no next meeting

#### Scenario: A viewer on no team

- **WHEN** the dashboard is displayed to a person who is a member of no team
- **THEN** it says in the active language that they belong to no team yet, and no countdown is shown
