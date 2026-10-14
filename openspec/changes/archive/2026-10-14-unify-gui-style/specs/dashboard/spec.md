## ADDED Requirements

### Requirement: The declarations use four type styles

The system SHALL set every text in the declarations band in exactly one of four type styles: a label (monospaced, small, upper case) for the band's title, its note and each column heading; a headline for the mission, the vision and each value's name; a subheading for each horizon; and body text for the strategic sentences and the goals. No other type style SHALL appear in the band.

#### Scenario: Every text in the band uses one of the four styles

- **WHEN** the declarations are displayed
- **THEN** the band's title, its note and the column headings share the label style, the mission, the vision and the value names share the headline style, both horizons share the subheading style, and the strategic sentences and the goals share the body style

#### Scenario: Values read at the same weight as the mission

- **WHEN** the declarations are displayed
- **THEN** each value's name is set in the same type style as the mission's sentence

## MODIFIED Requirements

### Requirement: The dashboard shows the viewer's teams

The system SHALL list, in a tile "My teams", at most three of the teams the viewer is a member of, ordered by next meeting, soonest first, those without one last by name. The next meeting is the team's first opened meeting dated today or later, otherwise the date its schedule proposes, otherwise none. Each row SHALL show the team's name as a link to its members page, the viewer's role on it — team leader, leader deputy or member — its board's schedule or that it has none, and its next meeting's date and start time as a link to its meetings page. The number of teams SHALL be shown. With more than three, a "More…" link SHALL lead to My teams.

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
- **THEN** it says in the active language that they belong to no team yet, and no countdown is shown

### Requirement: The countdown to the nearest meeting

The system SHALL single out the viewer's team whose next meeting is soonest and display the time until its start as a countdown in whole days, hours and minutes on that team's row of "My teams", advancing while the page stays open. When that meeting has started or is past, the countdown SHALL read zero rather than a negative value. Dates, times and units SHALL be in the active language.

#### Scenario: The countdown counts down to the nearest meeting

- **WHEN** the dashboard is displayed and the nearest next meeting is in the future
- **THEN** the days, hours and minutes remaining until it starts are displayed on the row of the team holding it, beside its date and time

#### Scenario: The countdown advances while the page is open

- **WHEN** the dashboard has been displayed and time passes without the page being reloaded
- **THEN** the countdown is updated to the time now remaining

#### Scenario: A meeting that has started reads zero

- **WHEN** the nearest next meeting is dated today and its start time has passed
- **THEN** the countdown reads zero days, zero hours and zero minutes rather than a negative value

### Requirement: The dashboard lists the viewer's board meetings

The system SHALL show a tile "My board meetings" listing, from the viewer's teams' meetings that still take values and are dated today or later, the three that start soonest. A team with none SHALL contribute the date its schedule proposes, marked as not yet opened. Rows SHALL be ordered by start, soonest first, each showing the team, date and start time, whether it is today, the host, how many active metrics have a value of how many, and whether the viewer has answered its pulse check. With more than three, a "More…" link SHALL lead to My meetings.

#### Scenario: Today's and the next meeting are listed

- **WHEN** a team of the viewer holds a meeting today and has opened one for next week
- **THEN** both are listed, today's marked as today, each with its host, its recording progress and whether the viewer has answered its pulse check

#### Scenario: Last week's meeting is not listed

- **WHEN** a team's latest meeting was yesterday and it has opened none since
- **THEN** yesterday's meeting is not listed, and the date its schedule proposes is listed instead if it has a schedule

#### Scenario: A proposed date is listed as not yet opened

- **WHEN** a team meets on Wednesdays and has opened no meeting dated today or later
- **THEN** the proposed Wednesday is listed at the schedule's start time, marked as not yet opened, with no host and no recording progress

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

- **WHEN** a meeting has values for 12 of 14 active metrics and the viewer has not answered its pulse check
- **THEN** the row reads that 12 of 14 are recorded and that the viewer's pulse check is not answered, in the active language and not by colour alone

#### Scenario: Nothing is coming up

- **WHEN** none of the viewer's teams has a meeting dated today or later or a schedule
- **THEN** the tile says in the active language that no board meeting is coming up

### Requirement: Start a meeting from a meeting row

The system SHALL offer "Start meeting" only on a row dated today, marked as that row's default action. Choosing it SHALL open the team's board on that meeting. Starting SHALL record nothing about the meeting.

#### Scenario: Today's meeting can be started

- **WHEN** the viewer chooses "Start meeting" on today's row of a team
- **THEN** that team's board is displayed on today's meeting

#### Scenario: A later meeting cannot be started yet

- **WHEN** a row is dated after today
- **THEN** it offers "Prepare data" and "Fill pulse check" but not "Start meeting", and none of its actions is marked as the default

#### Scenario: Start meeting is the row's default

- **WHEN** today's row is displayed
- **THEN** "Start meeting" is marked as the default action, and "Prepare data" and "Fill pulse check" are ordinary outlined buttons

### Requirement: Tiles and actions carry pictograms

The system SHALL show a pictogram beside the title of each tile, and an icon beside the caption of every action button, every link to a team's lists and every "More…" link the dashboard offers. A team's name and its next meeting in "My teams" are links in text and carry no icon. Pictograms and icons SHALL be hidden from assistive technology. An action's accessible name SHALL be its caption.

#### Scenario: Every action has an icon and keeps its caption

- **WHEN** a meeting row offering all three actions is displayed
- **THEN** "Prepare data", "Fill pulse check" and "Start meeting" each show an icon beside the caption, and assistive technology announces each by its caption alone

#### Scenario: Every tile title has a pictogram

- **WHEN** the dashboard is displayed
- **THEN** the titles "My teams", "My board meetings" and "My teams' problems and tasks" each show a pictogram that assistive technology does not announce
