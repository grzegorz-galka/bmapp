## MODIFIED Requirements

### Requirement: The hub shows the problem and task funnel

The system SHALL display on the hub, across the current user's teams, how many problems
and how many tasks stand at each stage: open, in progress, and archived. The figures
SHALL be counted from the recorded problems and tasks of every team the current user is
a member of: open are those at `not_started`; in progress those at `plan`, `do` or
`check`; archived those closed, of all time. Each stage SHALL be shown with its name in
the active language, the total number of items at that stage, and the split between
problems and tasks. The system SHALL state the scope the figures cover, as the number
of the current user's teams.

The archived stage SHALL be presented as the end state items reach by being closed, not
by being deleted.

#### Scenario: Each funnel stage shows its figures

- **WHEN** the hub is displayed and the summary has loaded
- **THEN** the open, in-progress and archived stages are each shown with their name in
  the active language, their total, and the number of problems and tasks making it up

#### Scenario: The funnel states what it covers

- **WHEN** the funnel is displayed
- **THEN** the scope of the figures is stated in the active language

#### Scenario: The funnel counts the recorded items of the user's teams

- **WHEN** the current user is a member of two teams, which have between them one
  problem at `not_started`, two tasks at `do`, one task at `check` and three closed
  problems, and another team they do not belong to has open items
- **THEN** the funnel shows open: 1 problem and 0 tasks; in progress: 0 problems and 3
  tasks; archived: 3 problems and 0 tasks; and a scope of two teams

#### Scenario: A user on no team

- **WHEN** the hub is requested by a person who is a member of no team
- **THEN** every stage shows zero problems and zero tasks, and the scope is no teams

### Requirement: The hub shows the items assigned to the current user

The system SHALL display on the hub the active problems and tasks whose responsible
person is the current user, across all teams, in order of due date with those without
one last. Each item SHALL be shown with whether it is a problem or a task, its summary
as it was typed, the team it belongs to, its PDCA stage named in the active language,
and its due date. An item whose due date has passed SHALL be distinguished from one
whose has not, by more than colour alone. Archived items SHALL NOT be shown.

The heading of the list SHALL identify whose items they are.

When the current user has no items assigned, the system SHALL say so in the active
language rather than showing an empty area.

#### Scenario: Assigned items are displayed

- **WHEN** the hub is displayed and the current user has items assigned
- **THEN** each item is shown with its kind, summary, team, stage and due date, and the
  heading identifies the user the items belong to

#### Scenario: An overdue item is distinguished

- **WHEN** an assigned item's due date has passed and another item's has not
- **THEN** the overdue item is marked as overdue in a way that does not depend on
  colour alone

#### Scenario: The user has no assigned items

- **WHEN** the hub is displayed and the current user has no items assigned
- **THEN** a message in the active language says so, and no empty list is shown

#### Scenario: Only the user's active items are assigned

- **WHEN** the current user is responsible for an active task and a closed problem, and
  another member is responsible for an active problem of the same team
- **THEN** only the active task is shown

#### Scenario: An assigned item leads to its board

- **WHEN** the current user chooses an assigned item
- **THEN** the board of that item's team is opened

### Requirement: The hub is supplied by a single authenticated summary

The system SHALL supply everything the hub displays as data through one read-only
request. That request SHALL NOT modify anything and SHALL require the caller to be
authenticated, being refused as the `authentication` capability requires when it is
not. Its response SHALL carry: the current user's identity, the company
declarations, the current user's teams, the preparation counts, whether a meeting is
in session, the funnel figures and their scope, and the items assigned to the
current user.

The response SHALL follow these rules, so that the interface can present it in either
language and can be changed to the real data later without changing its own code:

- Authored prose published in both languages — the declarations — SHALL be returned
  carrying both the English and the Polish text, so that changing the language needs no
  further request. Text a person typed — the summary of an assigned item — SHALL be
  returned once, as it was typed.
- Anything naming a state drawn from a fixed set — a user's role on a team, a team's
  board readiness, whether an item is a problem or a task, an item's stage — SHALL be
  returned as a stable code that the interface translates, in the same way it
  translates the codes carried by field errors. A code SHALL NOT change once published.
- Any point in time SHALL be returned as an ISO 8601 instant in UTC. Any date without a
  time SHALL be returned as an ISO 8601 calendar date. No text formatted for display
  SHALL be returned in place of either.

The identity the summary carries SHALL be the authenticated caller's, so that two
people signed in as different employees receive different identities from the same
request. The funnel and the assigned items SHALL be the recorded ones. While the rest
of the hub summary is placeholder data, its declarations, teams, preparation counts and
in-session indicator are fixed rather than recorded anywhere, and the response SHALL
declare itself provisional so that no caller mistakes them for recorded data.

#### Scenario: The summary is returned

- **WHEN** the hub summary is requested by an authenticated caller
- **THEN** it is returned successfully, carrying the current user's identity, the
  declarations, the teams, the preparation counts, the in-session indicator, the funnel
  figures and their scope, and the assigned items

#### Scenario: The summary requires authentication

- **WHEN** the hub summary is requested with no credentials
- **THEN** it is refused with HTTP 401 and the code `auth.token_missing`, and no
  summary is returned

#### Scenario: The identity is the authenticated caller's

- **WHEN** the hub summary is requested by two callers authenticated as different
  people
- **THEN** each response carries the identity of the caller that requested it

#### Scenario: Prose carries both languages

- **WHEN** the hub summary is returned
- **THEN** the mission, the vision, every strategic goal and every value each carry
  both an English and a Polish text, and neither is empty

#### Scenario: An assigned item's summary is returned as typed

- **WHEN** the hub summary is returned to a person responsible for a task whose summary
  was typed in Polish
- **THEN** that item's summary is the Polish text as typed, once

#### Scenario: States are returned as codes

- **WHEN** the hub summary is returned
- **THEN** each team's role and board readiness and each item's kind and stage are
  stable codes drawn from a fixed set, and no text intended for display accompanies them

#### Scenario: Times are returned as ISO 8601 in UTC

- **WHEN** the hub summary is returned
- **THEN** every next-meeting instant is an ISO 8601 instant in UTC and every due date
  is an ISO 8601 calendar date, and neither is formatted for display

#### Scenario: The summary declares itself provisional

- **WHEN** the hub summary is returned
- **THEN** it states that its data is placeholder data rather than recorded data

## REMOVED Requirements

### Requirement: The hub summary stays current

**Reason**: The assigned items are now recorded problems and tasks, so the hub can no longer promise one overdue and one on-time item; what remains of the requirement concerns the next meetings only and is restated as *The hub's next meetings stay ahead of the request*.
**Migration**: Nothing for API clients. The test `Both the overdue and the on-time case are present` is deleted; the two next-meeting tests move to the new requirement unchanged.

## ADDED Requirements

### Requirement: The hub's next meetings stay ahead of the request

The system SHALL return a hub summary whose next meetings are meaningful at the moment it is requested, for as long as the teams in it are placeholder data. Every team's next board meeting SHALL be the next occurrence, strictly after the moment of the request, of that team's weekly slot.

#### Scenario: Next meetings are always ahead of the request

- **WHEN** the hub summary is requested at any moment
- **THEN** every team's next board meeting is strictly later than that moment and is the next occurrence of that team's weekly day and time

#### Scenario: A meeting later today has not already passed

- **WHEN** the hub summary is requested on the weekday of a team's board meeting, after that meeting's time of day
- **THEN** that team's next board meeting is the occurrence a week later, not the one earlier the same day
