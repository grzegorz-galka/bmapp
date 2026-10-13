## MODIFIED Requirements

### Requirement: The dashboard shows the company declarations

The system SHALL display the company's mission, vision, values, strategic declaration and goals, each under its own heading, and SHALL make clear that they appear on every board. The mission and the vision SHALL each be one sentence. Each value SHALL show its name only. The strategic declaration SHALL show its horizon and its sentences. The goals SHALL be grouped by horizon, each group listing its goals. Lists keep the order supplied. A change of language SHALL redisplay them without a further request to the API.

#### Scenario: The declarations are displayed

- **WHEN** the dashboard is displayed and the summary has loaded
- **THEN** the mission and the vision each show their sentence, every value shows its name and no description, the strategic declaration shows its horizon and sentences, and the goals are shown in their horizon groups, all in the order supplied and each under a heading naming it

#### Scenario: The declarations are the company's

- **WHEN** the dashboard is displayed in Polish
- **THEN** the mission reads "Jesteśmy po to, aby zmieniać energetykę na lepsze", the vision reads "Chcemy tworzyć najlepsze rozwiązania w branży", the values are Skuteczność, Pasja, Innowacyjność and Współdziałanie in that order under "Nasze wartości", the strategic declaration under "Do 2030 roku" reads "PSE Innowacje stanie się firmą tworzącą najlepsze rozwiązania dla branży energetycznej w Polsce, osiągającą najwyższy poziom satysfakcji klientów." and "Osiągniemy to poprzez bycie najbardziej skutecznymi w dowożeniu.", and the goals are "Wzrost: 174 mln zł przychodu przy zatrudnieniu 397 osób" and "Satysfakcja klienta: pierwszy pomiar NPS z wynikiem dodatnim" under "W 2026 roku", then "Satysfakcja pracowników: eNPS 35+" and "Satysfakcja klienta: NPS 50+" under "Do 2030 roku"

#### Scenario: The declarations are translated

- **WHEN** the dashboard is displayed in English
- **THEN** the mission reads "We are here to change the energy sector for the better", the values are Effectiveness, Passion, Innovation and Collaboration under "Our values", the strategic declaration is under "By 2030", and the goals are under "In 2026" and "By 2030"

#### Scenario: The declarations follow a language change

- **WHEN** the declarations are displayed in English and the user changes the language to Polish
- **THEN** the mission, vision, values, strategic declaration and goals are redisplayed in Polish without a further request to the API

### Requirement: The declarations are illustrated

The system SHALL show a pictogram beside the mission, the vision, the strategic declaration and the goals, and a pictogram for each value, chosen by that value. The pictograms SHALL be decorative: they SHALL be hidden from assistive technology, and every declaration SHALL remain readable in words without them.

#### Scenario: Each value has its pictogram

- **WHEN** the declarations are displayed
- **THEN** each of the four values is shown with its own pictogram, and no two values share one

#### Scenario: Pictograms are hidden from assistive technology

- **WHEN** the declarations are read by assistive technology
- **THEN** no pictogram is announced, and every heading, sentence, value and goal is

### Requirement: The summary is language-neutral

The summary SHALL return the declarations in both English and Polish, and text a person typed as it was typed. A state from a fixed set, such as a role, an item's kind or stage, SHALL be a stable code the interface translates. An instant SHALL be ISO 8601 in UTC, a date an ISO 8601 calendar date and a time of day ISO 8601. No text formatted for display SHALL be returned instead.

#### Scenario: Prose carries both languages

- **WHEN** the dashboard summary is returned
- **THEN** the mission, the vision, every value's name, the strategic declaration's horizon and every sentence of it, and every goal group's horizon and every goal each carry an English and a Polish text, and neither is empty

#### Scenario: An assigned item's summary is returned as typed

- **WHEN** the dashboard summary is returned to a person responsible for a task whose summary was typed in Polish
- **THEN** that item's summary is the Polish text as typed, once

#### Scenario: States are returned as codes

- **WHEN** the dashboard summary is returned
- **THEN** each team's role, each value's pictogram, and each item's kind and stage are stable codes drawn from a fixed set, and no text intended for display accompanies them

#### Scenario: Times are returned as ISO 8601

- **WHEN** the dashboard summary is returned
- **THEN** every meeting start is an ISO 8601 instant in UTC alongside its calendar date and time of day in Europe/Warsaw, every due date is an ISO 8601 calendar date, and none is formatted for display

## ADDED Requirements

### Requirement: Every page carries the navigation menu

The system SHALL present on every page a navigation control naming, in this order, the dashboard, My teams, My meetings, My pulse check and Configuration, and identifying the one shown. Choosing a destination SHALL display it and change the address without reloading the application. No archive destination SHALL be offered: each board keeps its own Archived view.

#### Scenario: The top-level destinations

- **WHEN** the navigation control is displayed in English
- **THEN** it names Dashboard, My teams, My meetings, My pulse check and Configuration, in that order, and names no archive

#### Scenario: A personal page keeps its own address

- **WHEN** a visitor chooses My meetings and then reloads the page
- **THEN** My meetings is displayed again at its own address and is identified as the current destination

### Requirement: Configuration groups the configuration pages

The system SHALL make Configuration a group in the navigation control that, when chosen, reveals Teams, Team metrics and Global metrics, tells assistive technology whether it is expanded, and is identified as current while any of its pages is shown.

#### Scenario: Configuration reveals its destinations

- **WHEN** a visitor chooses Configuration in the navigation control
- **THEN** Teams, Team metrics and Global metrics are offered, assistive technology is told the group is expanded, and choosing it again hides them

#### Scenario: The teams page keeps its own address

- **WHEN** a visitor chooses Teams under Configuration
- **THEN** the team registration page is displayed, the address becomes the teams address, the application is not reloaded, and the navigation control identifies Configuration as the current destination

#### Scenario: The teams address can be opened directly

- **WHEN** a visitor opens the teams address directly
- **THEN** the team registration page is displayed

### Requirement: My teams

The system SHALL present, at its own address, every team the viewer is a member of, ordered as the dashboard orders them, each with its name, the viewer's role, its schedule or that it has none, and its next meeting, and with links to its board, its meetings, its members and its metric settings. A viewer of no team SHALL be told so.

#### Scenario: The viewer's teams are listed with their links

- **WHEN** a member of two teams, leading one of them, opens My teams
- **THEN** both teams are listed with their role, schedule and next meeting, each linking to its board, meetings, members and metric settings

#### Scenario: A viewer of no team

- **WHEN** a signed-in person who belongs to no team opens My teams
- **THEN** the page says they do not belong to any team yet

### Requirement: My meetings

The system SHALL present, at its own address, the meetings of every team the viewer is a member of: the upcoming ones soonest first, apart from the past ones, most recent first. Each SHALL show its team, its date, its start time and its host, and SHALL lead to that team's board at that meeting. A viewer of no team SHALL be told there are no meetings.

#### Scenario: Meetings of several teams are shown together

- **WHEN** a member of two teams, each with a meeting next week and one last week, opens My meetings
- **THEN** the two upcoming meetings are shown soonest first with their team names, apart from the two past meetings shown most recent first

#### Scenario: A meeting leads to its board

- **WHEN** the viewer chooses a meeting on My meetings
- **THEN** that team's board is displayed on that meeting

### Requirement: My pulse check

The system SHALL present, at its own address, for every team the viewer is a member of, the meetings that take pulse answers, each saying whether the viewer has answered and offering to answer or to change the answer, and a link to the team's pulse check results. A team with no meeting taking answers SHALL say so.

#### Scenario: An unanswered pulse check is offered

- **WHEN** a member who has not answered the pulse check for their team's coming meeting opens My pulse check
- **THEN** that meeting is listed as not answered with an action to answer, and choosing it opens the board's answer form for that meeting

#### Scenario: An answered pulse check can be changed

- **WHEN** a member who has answered for their team's coming meeting opens My pulse check
- **THEN** that meeting is listed as answered with an action to change the answer

### Requirement: Team metrics

The system SHALL present, at its own address, the registered teams, those the viewer is a member of first, each leading to that team's metric settings.

#### Scenario: A team is chosen for its metric settings

- **WHEN** a leader opens Team metrics and chooses their team
- **THEN** that team's metric settings page is displayed

#### Scenario: The viewer's own teams come first

- **WHEN** a member of one team opens Team metrics while three teams are registered
- **THEN** all three are listed, their own team first

## REMOVED Requirements

### Requirement: Every page carries the navigation

**Reason**: The navigation is reorganised around what a person does — their teams, meetings and pulse check — with the configuration pages grouped, and the inert Archive entry is dropped because each board has its own Archived view.

**Migration**: Replaced by "Every page carries the navigation menu". The teams page keeps its address and is reached under Configuration; the archive is reached from a board's Archived view.
