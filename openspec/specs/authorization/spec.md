## Purpose

Decides whether the person a request is authenticated as may do what they are
asking. Reading is open to anyone signed in; writing is decided by one global
administrator list and by what the team records already say about membership and
leadership. There are no roles to assign.

## Requirements

### Requirement: Permission is decided per team, not per role

The system SHALL decide every write from two facts and no others: whether the
person is an administrator, and what relationship they have to the team the write
concerns. The relationship SHALL be read from the team's recorded membership — a
member is someone the team records as a member, and a leader is the member the
team records as its leader.

The system SHALL NOT hold a role for a person. Leadership SHALL NOT be configured
anywhere outside the team's own records, so that a person who leads one team holds
no authority over a team they do not lead.

An administrator SHALL be permitted every action this capability governs.

#### Scenario: A leader's authority does not reach another team

- **WHEN** the leader of one team attempts a write that only a leader may perform on a
  team they do not lead
- **THEN** the write is refused, and performing the same write on the team they lead
  succeeds

#### Scenario: Leadership comes from the team's records

- **WHEN** leadership of a team is handed from one member to another
- **THEN** the new leader is permitted what a leader may do on that team and the
  previous leader is not, with no other change made anywhere

#### Scenario: An administrator may act on any team

- **WHEN** an administrator performs a write on a team they neither lead nor belong to
- **THEN** the write succeeds

### Requirement: Administrators are named in configuration

The system SHALL take the set of administrators from its configuration, as a list
of email addresses compared lower-cased and trimmed. A person whose email appears
in that list SHALL be an administrator; a person whose email does not SHALL NOT
be, regardless of what any team records about them.

An administrator SHALL NOT be required to be a recorded employee, so that a system
with no teams yet can still have the first team registered.

When no administrators are configured, the system SHALL start and SHALL refuse
every write that requires one, rather than treating an empty list as permitting
everybody.

#### Scenario: A configured email is an administrator

- **WHEN** a person whose email is in the configured list, written in a different
  letter case, is authenticated
- **THEN** they are an administrator

#### Scenario: An administrator need not be an employee

- **WHEN** a person whose email is in the configured list but matches no recorded
  employee registers a team
- **THEN** the registration succeeds

#### Scenario: No administrators are configured

- **WHEN** no administrators are configured and a write requiring an administrator is
  attempted
- **THEN** it is refused rather than permitted

### Requirement: Anyone signed in may read

The system SHALL permit every authenticated person to read every board and
everything on it, whether or not they belong to any team and whether or not they
are a recorded employee — except a meeting's individual pulse answers and who has
not answered, which only the team's members and administrators read.

Reading SHALL NOT require an employee record, so that a person who has joined the
organization but has not yet been put on a team can still see the boards, and so
that an administrator can see a system in which nothing has been recorded yet.

#### Scenario: An authenticated person who belongs to no team reads a board

- **WHEN** an authenticated person who is a member of no team reads a team's board
- **THEN** the board is returned

#### Scenario: An authenticated person who is not a recorded employee reads

- **WHEN** an authenticated person whose email matches no recorded employee reads the
  team list and a team
- **THEN** both are returned

#### Scenario: Individual pulse answers are the one exception

- **WHEN** an authenticated person who is a member of no team reads the pulse results of a team's meeting
- **THEN** the results are returned without the individual answers or the missing members

### Requirement: Only an administrator may register a team or change who leads it

The system SHALL permit only an administrator to register a team and to name its
leader, and only an administrator to hand the leadership of a team to another
member.

A team's existence and the identity of the person who runs it are the
organization's decisions rather than the team's.

#### Scenario: An administrator registers a team

- **WHEN** an administrator registers a team with a leader's email
- **THEN** the team is registered as the `team-board` capability requires

#### Scenario: A non-administrator registers a team

- **WHEN** an authenticated person who is not an administrator registers a team
- **THEN** the request is refused and no team, board definition, employee or
  membership is created

#### Scenario: A leader cannot hand over their own leadership

- **WHEN** the leader of a team, who is not an administrator, makes another member the
  leader of that team
- **THEN** the request is refused and the team's leader is unchanged

#### Scenario: An administrator hands over leadership

- **WHEN** an administrator makes another member of a team its leader
- **THEN** the leadership passes as the `team-membership` capability requires

### Requirement: A team's leader manages that team's membership

The system SHALL permit the leader of a team, as well as an administrator, to add
a member to that team and to remove a member from it. It SHALL refuse those writes
to anyone else, including a member of that team who does not lead it.

The routine arrival and departure of people belongs to whoever runs the team, so
that an administrator is not required for it.

#### Scenario: A leader adds a member to their team

- **WHEN** the leader of a team adds an employee to it by email
- **THEN** the member is added as the `team-membership` capability requires

#### Scenario: A leader removes a member from their team

- **WHEN** the leader of a team removes one of its members who is not the leader
- **THEN** the member is removed as the `team-membership` capability requires

#### Scenario: An ordinary member cannot change membership

- **WHEN** a member of a team who does not lead it adds or removes a member
- **THEN** the request is refused and the team's members are unchanged

#### Scenario: A stranger cannot change membership

- **WHEN** an authenticated person who is not a member of a team adds a member to it
- **THEN** the request is refused and the team's members are unchanged

### Requirement: A refusal says that it is a refusal, and why

The system SHALL refuse a write the person is not permitted with HTTP 403,
carrying a stable code naming the reason: `auth.forbidden` when the person is
authenticated but lacks the relationship the write requires, and
`auth.not_an_employee` when the write requires an employee record and the person
has none.

A refusal SHALL carry the same `{field, code, message}` shape every other rejection
uses, SHALL carry human-readable English text for a developer that clients are not
expected to display, and SHALL be shown to the person in the active language,
translated from its code. A code SHALL NOT change once published.

A refusal SHALL NOT disclose whether the thing being written to exists when the
person could not read that it exists — but since every authenticated person may
read everything, a refusal SHALL report 403 rather than concealing the resource as
not found.

#### Scenario: A forbidden write is refused with its code

- **WHEN** an authenticated person attempts a write they are not permitted
- **THEN** it is refused with HTTP 403 and the code `auth.forbidden`, and nothing is
  changed

#### Scenario: A write by someone who is not an employee

- **WHEN** an authenticated person whose email matches no recorded employee attempts a
  write that requires an employee record
- **THEN** it is refused with HTTP 403 and the code `auth.not_an_employee`

#### Scenario: A refusal is readable in both languages

- **WHEN** a refusal carrying an `auth.` code is shown in the interface
- **THEN** its wording comes from the catalogue of the active language, in both English
  and Polish

### Requirement: The interface offers only what its viewer may do

The system SHALL offer a control for an action only to a viewer permitted to
perform it. The members page SHALL offer adding a member, removing a member and
handing over the leadership only to a viewer permitted each, and the team page
SHALL offer registering a team only to an administrator. The meetings page SHALL
offer setting the schedule only to a viewer permitted to set it, and opening,
moving, re-hosting and deleting meetings only to a viewer permitted to manage
that team's meetings. The board SHALL offer recording values only to a viewer
permitted to record them at the meeting shown, and the metric settings SHALL offer
changing metrics and thresholds, copying a metric and including a global metric
only to a viewer permitted to configure the board. The global metrics page SHALL
offer adding and changing global metrics and their thresholds only to an
administrator.

A viewer who may perform nothing on a page SHALL still see the page and everything
it reads, since reading is open to everyone signed in.

#### Scenario: A leader sees the controls they may use

- **WHEN** the leader of a team, who is not an administrator, opens that team's members
  page
- **THEN** adding and removing members is offered, and handing over the leadership is
  not

#### Scenario: An ordinary member sees no membership controls

- **WHEN** a member of a team who does not lead it opens that team's members page
- **THEN** the team and its members are shown, and no add, remove or hand-over control
  is offered

#### Scenario: An administrator sees every control

- **WHEN** an administrator opens a team's members page
- **THEN** adding, removing and handing over the leadership are all offered

#### Scenario: Registering a team is offered only to an administrator

- **WHEN** an authenticated person who is not an administrator opens the team page
- **THEN** the registered teams are shown and no control for registering a team is
  offered

#### Scenario: An ordinary member manages meetings but not the schedule

- **WHEN** a member of a team who does not lead it opens that team's meetings page
- **THEN** opening, moving, re-hosting and deleting meetings are offered, and setting
  the schedule is not

#### Scenario: A stranger sees the meetings and no controls

- **WHEN** an authenticated person who is not a member of a team opens that team's
  meetings page
- **THEN** the schedule and the meetings are shown, and no control for the schedule or
  the meetings is offered

#### Scenario: A member records values but does not configure metrics

- **WHEN** a member of a team who does not lead it opens the board at a meeting that
  can be edited, and then the metric settings
- **THEN** recording values is offered on the board, and the settings show the metrics
  and thresholds without controls to change them, to copy a metric or to include a
  global metric

#### Scenario: A frozen meeting offers recording only to an administrator

- **WHEN** a leader and then an administrator open the board at a frozen meeting
- **THEN** recording is offered to the administrator only, as a correction asking for a
  reason

#### Scenario: A leader sees the global metrics without controls

- **WHEN** the leader of a team, who is not an administrator, opens the global metrics
  page, and then an administrator opens it
- **THEN** the leader sees the catalogue with no control to add or change a global metric
  or its thresholds, and the administrator is offered all of them

### Requirement: A team's leader sets its meeting schedule

The system SHALL permit the leader of a team, as well as an administrator, to set the meeting schedule of that team's board. It SHALL refuse it to anyone else, including a member of the team who does not lead it.

When a team meets is part of configuring its board, which belongs to whoever runs the team.

#### Scenario: A leader sets the schedule of their team

- **WHEN** the leader of a team sets its board's meeting schedule
- **THEN** the schedule is set as the `team-board` capability requires

#### Scenario: An ordinary member cannot set the schedule

- **WHEN** a member of a team who does not lead it sets its board's meeting schedule
- **THEN** the request is refused with the code `auth.forbidden` and the schedule is unchanged

#### Scenario: An administrator sets any team's schedule

- **WHEN** an administrator who does not belong to a team sets its board's meeting schedule
- **THEN** the schedule is set

### Requirement: A team's members manage its meetings

The system SHALL permit any member of a team, its leader included, as well as an administrator, to open a meeting for that team, to move one of its meetings, to name or clear its host, and to delete it. It SHALL refuse those writes to anyone who is not a member of the team.

Holding the meeting is the team's shared work, and it does not wait on the leader.

#### Scenario: A member opens a meeting

- **WHEN** a member of a team who does not lead it opens a meeting for that team
- **THEN** the meeting is opened as the `meetings` capability requires

#### Scenario: A member changes a meeting

- **WHEN** a member of a team moves one of its meetings, names its host, and then deletes it
- **THEN** each change is made as the `meetings` capability requires

#### Scenario: A stranger cannot open or change a meeting

- **WHEN** an authenticated person who is not a member of a team opens a meeting for it, or moves, re-hosts or deletes one of its meetings
- **THEN** each request is refused with the code `auth.forbidden` and the team's meetings are unchanged

#### Scenario: A member of another team cannot manage this team's meetings

- **WHEN** the leader of one team opens a meeting for a team they do not belong to
- **THEN** the request is refused, and opening a meeting for their own team succeeds

#### Scenario: An administrator manages any team's meetings

- **WHEN** an administrator who does not belong to a team opens a meeting for it
- **THEN** the meeting is opened

### Requirement: A team's leader configures its metrics and thresholds

The system SHALL permit the leader of a team, as well as an administrator, to add, change, retire, bring back and delete the metrics of that team's board, to record threshold versions for them, to copy a metric of any board onto it, and to include, place and remove global metrics on it. It SHALL refuse those writes to anyone else, including a member who does not lead the team.

What the team measures, and what counts as green, is part of configuring its board. Copying needs no permission on the source board, since anyone signed in may read it.

#### Scenario: A leader adds a metric and its threshold

- **WHEN** the leader of a team adds a metric to its board and records a threshold version for it
- **THEN** both are recorded as the `metrics` capability requires

#### Scenario: An ordinary member cannot configure metrics

- **WHEN** a member of a team who does not lead it adds a metric, changes one, records a threshold version, copies a metric onto the board or includes a global metric in it
- **THEN** each request is refused with `auth.forbidden`, and nothing is changed

#### Scenario: An administrator configures any team's metrics

- **WHEN** an administrator who does not belong to a team records a threshold version for one of its metrics
- **THEN** the version is recorded

#### Scenario: A leader copies from a board they do not belong to

- **WHEN** the leader of a team copies a metric of another team's board, of which they are not a member, onto their own board
- **THEN** the copy is added, and copying the same metric onto a board they do not lead is refused with `auth.forbidden`

#### Scenario: A leader includes a global metric

- **WHEN** the leader of a team, who is not an administrator, includes a global metric in its board and changes its placement there
- **THEN** both are done as the `global-metrics` capability requires

### Requirement: A team's members record its metric values

The system SHALL permit any member of a team, its leader included, as well as an administrator, to record values for the team's metrics at a meeting that can still be edited. It SHALL refuse that to anyone who is not a member of the team.

#### Scenario: A member records a value

- **WHEN** a member of a team who does not lead it records a value at the team's next meeting
- **THEN** the value is recorded as the `metric-values` capability requires

#### Scenario: A stranger cannot record a value

- **WHEN** an authenticated person who is not a member of a team records a value for one of its metrics
- **THEN** the request is refused with `auth.forbidden`, and nothing is recorded

### Requirement: Only an administrator corrects a frozen value

The system SHALL permit only an administrator to correct a value at a meeting that can no longer be edited. A member or leader of the team who attempts it SHALL be refused, as the `metric-values` capability requires for a frozen meeting.

Once a meeting is past its editing window, its record belongs to the organization rather than to the team.

#### Scenario: A leader cannot correct a frozen value

- **WHEN** the leader of a team, who is not an administrator, records a value with a reason at a frozen meeting of that team
- **THEN** it is rejected with `metric_value.meeting_frozen`, and the value is unchanged

#### Scenario: An administrator corrects a frozen value

- **WHEN** an administrator records a value with a reason at a frozen meeting
- **THEN** the value is changed and the correction is logged

### Requirement: Only an administrator defines global metrics

The system SHALL permit only an administrator to add, change, retire, bring back and delete a global metric, and to record its threshold versions. It SHALL refuse those writes to anyone else, a team's leader included, with `auth.forbidden`.

A metric measured the same way across the organization is the organization's decision, not one team's.

#### Scenario: An administrator defines a global metric and its threshold

- **WHEN** an administrator adds a global metric and records a threshold version for it
- **THEN** both are recorded as the `global-metrics` capability requires

#### Scenario: A leader cannot define a global metric

- **WHEN** the leader of a team, who is not an administrator, adds a global metric, changes or retires one, or records a threshold version for one
- **THEN** each request is refused with `auth.forbidden`, and nothing is changed

### Requirement: Only a team's members and administrators read its individual pulse answers

The system SHALL return a meeting's individual pulse answers, and the members who have not answered, only to a member of the meeting's team or an administrator. Anyone else signed in SHALL receive the meeting's results without them: the counts, the average, the distribution and the trend. A viewer refused the answers SHALL NOT be refused the results.

#### Scenario: A member reads the answers by name

- **WHEN** a member of a team reads the pulse results of one of its meetings
- **THEN** the results include every answer with its respondent and the members who have not answered

#### Scenario: An administrator reads the answers by name

- **WHEN** an administrator who is not a member of a team reads the pulse results of one of its meetings
- **THEN** the results include every answer with its respondent and the members who have not answered

#### Scenario: A stranger reads the aggregates only

- **WHEN** an authenticated person who is not a member of a team reads the pulse results of one of its meetings
- **THEN** the counts, the average, its status and change, the distribution and the trend are returned, and no answer, respondent or missing member is

#### Scenario: A former member reads the aggregates only

- **WHEN** a person who answered at a meeting and has since left the team reads that meeting's pulse results
- **THEN** they receive the aggregates only, as any other stranger does

### Requirement: Only a member answers the pulse check, for themselves

The system SHALL permit only a member of a team, its leader included, to record a pulse answer at the team's meetings, and only as their own answer. It SHALL refuse anyone else, an administrator who is not a member included, with `auth.forbidden`.

An answer is a statement of how its respondent felt; nobody else can make it for them.

#### Scenario: The leader answers

- **WHEN** the leader of a team records a pulse answer at the team's next meeting
- **THEN** the answer is recorded with the leader as its respondent

#### Scenario: A stranger cannot answer

- **WHEN** an authenticated person who is not a member of a team records a pulse answer at one of its meetings
- **THEN** the request is refused with `auth.forbidden`, and nothing is recorded

#### Scenario: An administrator who is not a member cannot answer

- **WHEN** an administrator who is not a member of a team records a pulse answer at one of its meetings
- **THEN** the request is refused with `auth.forbidden`, and nothing is recorded

### Requirement: The pulse check view offers only what its viewer may do

The system SHALL offer the pulse answer form only to a member of the team at a meeting that takes answers, and SHALL show the answers table and the names of missing members only to a viewer permitted to read them. A viewer refused them SHALL still see the cards and the trend, with the number of missing answers and without names.

#### Scenario: A member sees the form and the answers

- **WHEN** a member of a team opens the pulse check view of a meeting that takes answers
- **THEN** answering is offered, and the answers table and the missing members' names are shown

#### Scenario: A stranger sees the aggregates and no form

- **WHEN** an authenticated person who is not a member of a team opens the pulse check view of one of its meetings
- **THEN** the cards and the trend are shown with the number of missing answers, and no answers table, no names and no answer form

#### Scenario: An administrator sees the answers and no form

- **WHEN** an administrator who is not a member of a team opens the pulse check view of a meeting that takes answers
- **THEN** the answers table and the missing members' names are shown, and no answer form is offered
