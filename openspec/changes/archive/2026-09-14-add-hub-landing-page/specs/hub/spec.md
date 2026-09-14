## Purpose

The hub is the page BMAPP opens at: the one screen that tells a person what the
application is for, what their teams are doing, when their next board meeting is, and
where to go next. It also owns the navigation shell every page is rendered inside. Its
content is drawn from capabilities that are agreed but not yet built — meetings,
metrics, problems, tasks, employees — so until those exist the hub is supplied by a
single read-only summary of placeholder data shaped the way the real capabilities will
eventually fill it.

## ADDED Requirements

### Requirement: The application opens at the hub

The system SHALL present the hub as the page a visitor reaches at the application's
root address. The hub SHALL be reachable by that address directly, so it can be
bookmarked and returned to.

The system SHALL present, on every page, a navigation control naming the destinations
the application offers: the hub, the teams page, and the archive. The control SHALL
identify which destination is currently being shown. Choosing the hub or the teams
page SHALL display that page and SHALL change the address to the one that page is
reachable at, without reloading the application. The archive SHALL be named but SHALL
be presented as not yet available, and choosing it SHALL do nothing; it SHALL be
identified to assistive technology as unavailable rather than merely styled as such.

An address the application does not recognise SHALL display the hub rather than an
error or an empty page.

#### Scenario: The root address shows the hub

- **WHEN** a visitor opens the application at its root address
- **THEN** the hub is displayed

#### Scenario: The teams page keeps its own address

- **WHEN** a visitor chooses the teams destination from the navigation control
- **THEN** the team registration page is displayed, the address becomes the teams
  address, the application is not reloaded, and the navigation control identifies the
  teams destination as the current one

#### Scenario: The teams address can be opened directly

- **WHEN** a visitor opens the teams address directly
- **THEN** the team registration page is displayed

#### Scenario: The archive is named but unavailable

- **WHEN** the navigation control is displayed
- **THEN** the archive destination is named, is identified to assistive technology as
  unavailable, and choosing it neither changes the page nor changes the address

#### Scenario: An unknown address falls back to the hub

- **WHEN** a visitor opens an address the application does not recognise
- **THEN** the hub is displayed rather than an error page

### Requirement: The hub shows the company declarations

The system SHALL display the company-wide mission, the vision, the strategic goals and
the company values on the hub, each under its own heading, and SHALL make clear that
these declarations appear on every board. Mission and vision SHALL each be displayed as
prose. Strategic goals and values SHALL each be displayed as a list, in the order the
declarations are supplied, with every entry shown.

The declarations SHALL be displayed in the active language, and a change of language
SHALL redisplay them in the newly active language without a further request to the API.

#### Scenario: The declarations are displayed

- **WHEN** the hub is displayed and the declarations have loaded
- **THEN** the mission and the vision are shown as prose, every strategic goal and
  every value is shown in the order supplied, and each is under a heading naming it

#### Scenario: The declarations follow a language change

- **WHEN** the declarations are displayed in English and the user changes the language
  to Polish
- **THEN** the mission, vision, strategic goals and values are redisplayed in Polish
  without a further request to the API

### Requirement: The hub shows the user's teams and the next board meeting

The system SHALL display, on the hub, every team the current user belongs to. Each team
SHALL be shown with its name, the user's role on that team, the day and time of the
week it holds its board meeting, the date and time of its next board meeting, and
whether its board is ready for that meeting. The teams SHALL be ordered by their next
board meeting, soonest first.

The system SHALL single out the team whose board meeting is soonest, and SHALL display
the time remaining until that meeting as a countdown in whole days, hours and minutes.
The countdown SHALL advance while the page stays open, without the user reloading it.
When the nearest meeting is in the past or is happening now, the countdown SHALL read
zero rather than a negative value.

The system SHALL display how many teams the user belongs to.

Dates, times and countdown units SHALL be displayed in the active language.

#### Scenario: Teams are listed in order of their next meeting

- **WHEN** the hub is displayed and the current user belongs to more than one team
- **THEN** every team is listed with its name, the user's role, its weekly slot, the
  date and time of its next board meeting and its board readiness, ordered with the
  soonest meeting first, and the number of teams is shown

#### Scenario: The countdown counts down to the nearest meeting

- **WHEN** the hub is displayed and the nearest board meeting is in the future
- **THEN** the days, hours and minutes remaining until that meeting are displayed
  alongside the name and time of the team holding it

#### Scenario: The countdown advances while the page is open

- **WHEN** the hub has been displayed and time passes without the page being reloaded
- **THEN** the countdown is updated to the time now remaining

#### Scenario: A meeting that is not in the future reads zero

- **WHEN** the nearest board meeting is at or before the current moment
- **THEN** the countdown reads zero days, zero hours and zero minutes rather than a
  negative value

#### Scenario: Board readiness is distinguishable

- **WHEN** a team's board is ready for its next meeting and another team's is not
- **THEN** each team's readiness is stated in the active language, and the two are
  distinguishable by more than colour alone

### Requirement: The hub offers the things a person does at a board meeting

The system SHALL display on the hub a set of entry points naming what a person comes to
BMAPP to do: configure a board, prepare a board meeting, conduct a board meeting,
browse past board meetings, and manage access. Each SHALL carry a title and a short
description in the active language. Those that lead to capabilities not yet built SHALL
be presented as not yet available and SHALL be identified as such to assistive
technology.

The preparation entry point SHALL show how many metric values are still to be recorded,
how many problems are waiting to be reviewed, and how many tasks are open. The
conducting entry point SHALL indicate whether a board meeting is in session.

#### Scenario: The entry points are displayed

- **WHEN** the hub is displayed
- **THEN** all five entry points are shown, each with its title and description in the
  active language

#### Scenario: The preparation counts are shown

- **WHEN** the hub is displayed and the summary has loaded
- **THEN** the number of metric values still to record, the number of problems to
  review and the number of open tasks are each shown against the preparation entry
  point, labelled in the active language

#### Scenario: An entry point that leads nowhere yet says so

- **WHEN** an entry point leads to a capability that is not yet built
- **THEN** it is presented as not yet available, is identified to assistive technology
  as unavailable, and choosing it neither changes the page nor changes the address

### Requirement: The hub shows the problem and task funnel

The system SHALL display on the hub, across the current user's teams, how many problems
and how many tasks stand at each stage: open, in progress, and archived. Each stage
SHALL be shown with its name in the active language, the total number of items at that
stage, and the split between problems and tasks. The system SHALL state the scope the
figures cover.

The archived stage SHALL be presented as the end state items reach by being closed, not
by being deleted.

#### Scenario: Each funnel stage shows its figures

- **WHEN** the hub is displayed and the summary has loaded
- **THEN** the open, in-progress and archived stages are each shown with their name in
  the active language, their total, and the number of problems and tasks making it up

#### Scenario: The funnel states what it covers

- **WHEN** the funnel is displayed
- **THEN** the scope of the figures is stated in the active language

### Requirement: The hub shows the items assigned to the current user

The system SHALL display on the hub the problems and tasks assigned to the current user
across all their teams. Each item SHALL be shown with whether it is a problem or a task,
its summary, the team it belongs to, its progress as a percentage, and its due date. An
item whose due date has passed SHALL be distinguished from one whose has not, by more
than colour alone.

The heading of the list SHALL identify whose items they are.

When the current user has no items assigned, the system SHALL say so in the active
language rather than showing an empty area.

#### Scenario: Assigned items are displayed

- **WHEN** the hub is displayed and the current user has items assigned
- **THEN** each item is shown with its kind, summary, team, progress percentage and due
  date, and the heading identifies the user the items belong to

#### Scenario: An overdue item is distinguished

- **WHEN** an assigned item's due date has passed and another item's has not
- **THEN** the overdue item is marked as overdue in a way that does not depend on
  colour alone

#### Scenario: The user has no assigned items

- **WHEN** the hub is displayed and the current user has no items assigned
- **THEN** a message in the active language says so, and no empty list is shown

### Requirement: The hub is supplied by a single read-only summary

The system SHALL supply everything the hub displays as data through one read-only
request. That request SHALL NOT modify anything and SHALL succeed without the caller
being authenticated. Its response SHALL carry: the current user's identity, the company
declarations, the current user's teams, the preparation counts, whether a meeting is in
session, the funnel figures and their scope, and the items assigned to the current user.

The response SHALL follow these rules, so that the interface can present it in either
language and can be changed to the real data later without changing its own code:

- Authored prose published in both languages — the declarations, and the summary of an
  assigned item — SHALL be returned carrying both the English and the Polish text, so
  that changing the language needs no further request.
- Anything naming a state drawn from a fixed set — a user's role on a team, a team's
  board readiness, whether an item is a problem or a task — SHALL be returned as a
  stable code that the interface translates, in the same way it translates the codes
  carried by field errors. A code SHALL NOT change once published.
- Any point in time SHALL be returned as an ISO 8601 instant in UTC. Any date without a
  time SHALL be returned as an ISO 8601 calendar date. No text formatted for display
  SHALL be returned in place of either.

While the hub summary is placeholder data, its identity, declarations, counts and items
are fixed rather than recorded anywhere, and the response SHALL declare itself
provisional so that no caller mistakes it for recorded data.

#### Scenario: The summary is returned

- **WHEN** the hub summary is requested
- **THEN** it is returned successfully, carrying the current user's identity, the
  declarations, the teams, the preparation counts, the in-session indicator, the funnel
  figures and their scope, and the assigned items

#### Scenario: The summary needs no authentication

- **WHEN** the hub summary is requested with no credentials
- **THEN** it is returned successfully

#### Scenario: Prose carries both languages

- **WHEN** the hub summary is returned
- **THEN** the mission, the vision, every strategic goal, every value and every
  assigned item's summary each carry both an English and a Polish text, and neither is
  empty

#### Scenario: States are returned as codes

- **WHEN** the hub summary is returned
- **THEN** each team's role and board readiness and each item's kind are stable codes
  drawn from a fixed set, and no text intended for display accompanies them

#### Scenario: Times are returned as ISO 8601 in UTC

- **WHEN** the hub summary is returned
- **THEN** every next-meeting instant is an ISO 8601 instant in UTC and every due date
  is an ISO 8601 calendar date, and neither is formatted for display

#### Scenario: The summary declares itself provisional

- **WHEN** the hub summary is returned
- **THEN** it states that its data is placeholder data rather than recorded data

### Requirement: The hub summary stays current

The system SHALL return a hub summary whose dates are meaningful at the moment it is
requested, for as long as the summary is placeholder data. Every team's next board
meeting SHALL be the next occurrence, strictly after the moment of the request, of that
team's weekly slot. The assigned items SHALL include at least one whose due date has
passed and at least one whose has not.

#### Scenario: Next meetings are always ahead of the request

- **WHEN** the hub summary is requested at any moment
- **THEN** every team's next board meeting is strictly later than that moment and is
  the next occurrence of that team's weekly day and time

#### Scenario: A meeting later today has not already passed

- **WHEN** the hub summary is requested on the weekday of a team's board meeting, after
  that meeting's time of day
- **THEN** that team's next board meeting is the occurrence a week later, not the one
  earlier the same day

#### Scenario: Both the overdue and the on-time case are present

- **WHEN** the hub summary is requested at any moment
- **THEN** at least one assigned item has a due date before that day and at least one
  has a due date on or after it

### Requirement: The hub identifies the current user

The system SHALL display the current user's email address in the application header and
SHALL use it to head the list of items assigned to them. The identity SHALL come from
the hub summary rather than being written into the interface.

Until authentication is built the identity is a fixed placeholder, and the system SHALL
NOT present it as a signed-in session: no sign-in, no sign-out and no account control
SHALL be offered.

#### Scenario: The identity is displayed

- **WHEN** the hub is displayed and the summary has loaded
- **THEN** the current user's email address from the summary is shown in the header and
  heads the list of assigned items

#### Scenario: No session is implied

- **WHEN** any page of the application is displayed
- **THEN** no sign-in, sign-out or account control is offered

### Requirement: The hub reports loading and failure

The system SHALL tell the user, in the active language, that the hub is loading while
its summary is being fetched, and SHALL tell them that it could not be loaded if the
request fails. A failure SHALL leave the page usable: the navigation control, the
language control and the theme control SHALL remain available, and the parts of the hub
that need no data SHALL still be shown.

#### Scenario: The hub reports that it is loading

- **WHEN** the hub is displayed and its summary has not yet arrived
- **THEN** a loading message in the active language is shown

#### Scenario: The hub reports a failure

- **WHEN** the hub summary cannot be fetched
- **THEN** a failure message in the active language is shown, and the navigation,
  language and theme controls remain usable
