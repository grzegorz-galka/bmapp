## Purpose

The dashboard is the page BMAPP opens at. It is the one screen that tells a person what the company is aiming at, which board meetings their teams hold next, what is still to be done for each, and which problems and tasks are theirs. It also owns the navigation shell every page is rendered inside.

## Requirements


### Requirement: The application opens at the dashboard

The system SHALL present the dashboard at the application's root address, so that it can be bookmarked and returned to. It SHALL be named "Dashboard" in English and "Pulpit" in Polish wherever the interface names it. An address the application does not recognise SHALL display the dashboard rather than an error or an empty page.

#### Scenario: The root address shows the dashboard

- **WHEN** a visitor opens the application at its root address
- **THEN** the dashboard is displayed

#### Scenario: An unknown address falls back to the dashboard

- **WHEN** a visitor opens an address the application does not recognise
- **THEN** the dashboard is displayed rather than an error page

#### Scenario: The dashboard is named in the active language

- **WHEN** the navigation is shown in English and then in Polish
- **THEN** the dashboard destination reads "Dashboard" and then "Pulpit"

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

### Requirement: The countdown to the nearest meeting

The system SHALL single out the viewer's team whose next meeting is soonest and display the time until its start as a countdown in whole days, hours and minutes, advancing while the page stays open. When that meeting has started or is past, the countdown SHALL read zero rather than a negative value. Dates, times and units SHALL be in the active language.

#### Scenario: The countdown counts down to the nearest meeting

- **WHEN** the dashboard is displayed and the nearest next meeting is in the future
- **THEN** the days, hours and minutes remaining until it starts are displayed alongside the name of the team holding it and its date and time

#### Scenario: The countdown advances while the page is open

- **WHEN** the dashboard has been displayed and time passes without the page being reloaded
- **THEN** the countdown is updated to the time now remaining

#### Scenario: A meeting that has started reads zero

- **WHEN** the nearest next meeting is dated today and its start time has passed
- **THEN** the countdown reads zero days, zero hours and zero minutes rather than a negative value

### Requirement: The dashboard lists the viewer's board meetings

The system SHALL show a tile "My board meetings" listing, for each of the viewer's teams, its meetings that still take values and are dated today or later. A team with none SHALL contribute the date its schedule proposes, marked as not yet opened. Rows SHALL be ordered by start, soonest first, each showing the team, date and start time, whether it is today, the host, how many active metrics have a value of how many, and whether the viewer has answered its pulse check.

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

#### Scenario: Recording progress and the pulse check are stated in words

- **WHEN** a meeting has values for 12 of 14 active metrics and the viewer has not answered its pulse check
- **THEN** the row reads that 12 of 14 are recorded and that the viewer's pulse check is not answered, in the active language and not by colour alone

#### Scenario: Nothing is coming up

- **WHEN** none of the viewer's teams has a meeting dated today or later or a schedule
- **THEN** the tile says in the active language that no board meeting is coming up

### Requirement: Prepare data from a meeting row

The system SHALL offer "Prepare data" on every row of "My board meetings". Choosing it SHALL open the team's board on that meeting with the recording view showing.

#### Scenario: Preparing data opens the recording view

- **WHEN** the viewer chooses "Prepare data" on next Wednesday's row of a team
- **THEN** that team's board is displayed on next Wednesday's meeting with its recording view open

### Requirement: Fill in the pulse check from a meeting row

The system SHALL offer "Fill pulse check" on every row of "My board meetings". Choosing it SHALL open the team's board on that meeting in the pulse check view with the viewer's answer form showing. When the viewer has already answered, the row SHALL say so and the action SHALL still be offered, to change the answer.

#### Scenario: Filling the pulse check opens the answer form

- **WHEN** the viewer chooses "Fill pulse check" on a row of a meeting they have not answered at
- **THEN** that team's board is displayed in the pulse check view of that meeting, with the answer form showing

#### Scenario: An answered pulse check can be changed

- **WHEN** the viewer has answered the pulse check of a listed meeting
- **THEN** the row says it is answered and still offers to open the form, which holds the viewer's answer

### Requirement: Start a meeting from a meeting row

The system SHALL offer "Start meeting" only on a row dated today. Choosing it SHALL open the team's board on that meeting. Starting SHALL record nothing about the meeting.

#### Scenario: Today's meeting can be started

- **WHEN** the viewer chooses "Start meeting" on today's row of a team
- **THEN** that team's board is displayed on today's meeting

#### Scenario: A later meeting cannot be started yet

- **WHEN** a row is dated after today
- **THEN** it offers "Prepare data" and "Fill pulse check" but not "Start meeting"

### Requirement: An action on a proposed date opens the meeting first

The system SHALL, when an action is chosen on a row not yet opened, open the meeting for that team at the row's date and start time, then proceed with the action on it. If opening is rejected, the system SHALL stay on the dashboard, show the rejection in the active language, and refresh the list.

#### Scenario: Preparing a proposed meeting opens it

- **WHEN** the viewer chooses "Prepare data" on a row proposed for next Wednesday at 13:00
- **THEN** a meeting is opened for that team next Wednesday at 13:00, and its board is displayed on it with the recording view open

#### Scenario: Someone else opened it meanwhile

- **WHEN** the viewer chooses an action on a proposed row after another member has opened a meeting on that date
- **THEN** the rejection `meeting_date.taken` is shown in the active language, no page is left, and the list is refreshed to show the opened meeting

### Requirement: The problems and tasks of the viewer's teams

The system SHALL show a tile "My teams' problems and tasks" counting, across the teams the viewer is a member of, the problems and tasks open (`not_started`), in progress (`plan`, `do`, `check`) and archived (closed, of all time). Each stage SHALL show its name, its total and its split between problems and tasks. The scope SHALL be stated as the number of teams. Archived SHALL read as the end state items reach by closing, not by deletion.

#### Scenario: Each stage shows its figures

- **WHEN** the dashboard is displayed and the summary has loaded
- **THEN** the open, in-progress and archived stages are each shown with their name in the active language, their total, and the number of problems and tasks making it up

#### Scenario: The figures count the recorded items of the viewer's teams

- **WHEN** the viewer is a member of two teams, which have between them one problem at `not_started`, two tasks at `do`, one task at `check` and three closed problems, and another team they do not belong to has open items
- **THEN** the tile shows open: 1 problem and 0 tasks; in progress: 0 problems and 3 tasks; archived: 3 problems and 0 tasks; and a scope of two teams

#### Scenario: A viewer on no team sees zeros

- **WHEN** the dashboard is requested by a person who is a member of no team
- **THEN** every stage shows zero problems and zero tasks, and the scope is no teams

### Requirement: The tile leads to each team's problems and tasks

The system SHALL offer, in "My teams' problems and tasks" and for each of the viewer's teams, a link to the team's problems list, one to its tasks list, and one to its archive. The first two SHALL open the team's board with that list in view. The archive SHALL open the board's archived view.

#### Scenario: Links lead to the board's lists

- **WHEN** the viewer chooses a team's problems link, then its tasks link, then its archive link
- **THEN** the team's board is displayed with its problems list in view, then with its tasks list in view, then in its archived view

### Requirement: The items assigned to the viewer

The system SHALL list in that tile the active problems and tasks the viewer is responsible for, on any team, by due date with undated ones last. Each SHALL show its kind, its summary as typed, its team, its PDCA stage, its due date, the metric it concerns, and for a task the problem it came from, when it has them. An overdue item SHALL be marked by more than colour alone. The heading SHALL name the viewer. With no items, a message SHALL say so.

#### Scenario: Assigned items are shown in detail

- **WHEN** the viewer is responsible for a task linked to a metric and to a problem, and for a problem with no due date
- **THEN** the task is listed first with its kind, summary, team, stage, due date, metric name and problem summary, the problem after it with no due date, and the heading names the viewer

#### Scenario: An overdue item is distinguished

- **WHEN** an assigned item's due date has passed and another item's has not
- **THEN** the overdue item is marked as overdue in a way that does not depend on colour alone

#### Scenario: Only the viewer's active items are listed

- **WHEN** the viewer is responsible for an active task and a closed problem, and another member is responsible for an active problem of the same team
- **THEN** only the active task is listed

#### Scenario: An assigned item leads to its list

- **WHEN** the viewer chooses an assigned task
- **THEN** the board of that task's team is displayed with its tasks list in view

#### Scenario: The viewer has no assigned items

- **WHEN** the dashboard is displayed and the viewer has no items assigned
- **THEN** a message in the active language says so, and no empty list is shown

### Requirement: Tiles and actions carry pictograms

The system SHALL show a pictogram beside the title of each tile, and an icon beside the caption of every action and link the dashboard offers. Pictograms and icons SHALL be hidden from assistive technology. An action's accessible name SHALL be its caption.

#### Scenario: Every action has an icon and keeps its caption

- **WHEN** a meeting row offering all three actions is displayed
- **THEN** "Prepare data", "Fill pulse check" and "Start meeting" each show an icon beside the caption, and assistive technology announces each by its caption alone

#### Scenario: Every tile title has a pictogram

- **WHEN** the dashboard is displayed
- **THEN** the titles "My teams", "My board meetings" and "My teams' problems and tasks" each show a pictogram that assistive technology does not announce

### Requirement: The dashboard is supplied by a single authenticated summary

The system SHALL supply everything the dashboard displays through one read-only request that requires authentication, refused as the `authentication` capability requires. It SHALL carry the viewer's identity, the declarations, the viewer's teams, their board meetings, the problem and task figures with their scope, and the items assigned to the viewer, all read from recorded data except the declarations.

#### Scenario: The summary is returned

- **WHEN** the dashboard summary is requested by an authenticated caller
- **THEN** it is returned successfully, carrying the caller's identity, the declarations, the teams, the board meetings, the problem and task figures and their scope, and the assigned items

#### Scenario: The summary requires authentication

- **WHEN** the dashboard summary is requested with no credentials
- **THEN** it is refused with HTTP 401 and the code `auth.token_missing`, and no summary is returned

#### Scenario: The identity is the authenticated caller's

- **WHEN** the dashboard summary is requested by two callers authenticated as different people
- **THEN** each response carries the identity of the caller that requested it

#### Scenario: The summary changes nothing

- **WHEN** the dashboard summary is requested for a viewer whose team has a schedule and no meeting opened ahead
- **THEN** the proposed meeting is returned and no meeting is opened

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

### Requirement: The dashboard identifies the signed-in person

The system SHALL display the signed-in person's email address in the application header, taken from the dashboard summary, and SHALL offer an account control from which they can sign out, as the `authentication` capability requires. A person who is not signed in SHALL be offered the sign-in instead and SHALL NOT be shown an identity.

#### Scenario: The identity is displayed

- **WHEN** the dashboard is displayed and the summary has loaded
- **THEN** the signed-in person's email address from the summary is shown in the header and heads the list of assigned items

#### Scenario: A session is offered

- **WHEN** any page of the application is displayed to a signed-in person
- **THEN** an account control is offered from which they can sign out

#### Scenario: No identity is shown when signed out

- **WHEN** any page of the application is displayed to a person who is not signed in
- **THEN** no identity is shown and the sign-in is offered

### Requirement: The dashboard reports loading and failure

The system SHALL say, in the active language, that the dashboard is loading while its summary is fetched, and that it could not be loaded if the request fails. A failure SHALL leave the navigation, language and theme controls usable, and the parts of the dashboard that need no data SHALL still be shown.

#### Scenario: The dashboard reports that it is loading

- **WHEN** the dashboard is displayed and its summary has not yet arrived
- **THEN** a loading message in the active language is shown

#### Scenario: The dashboard reports a failure

- **WHEN** the dashboard summary cannot be fetched
- **THEN** a failure message in the active language is shown, and the navigation, language and theme controls remain usable

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
