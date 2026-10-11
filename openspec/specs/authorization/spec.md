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
are a recorded employee.

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
changing metrics and thresholds only to a viewer permitted to configure the board.

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
  and thresholds without controls to change them

#### Scenario: A frozen meeting offers recording only to an administrator

- **WHEN** a leader and then an administrator open the board at a frozen meeting
- **THEN** recording is offered to the administrator only, as a correction asking for a
  reason

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

The system SHALL permit the leader of a team, as well as an administrator, to add, change, retire, bring back and delete the metrics of that team's board, and to record threshold versions for them. It SHALL refuse those writes to anyone else, including a member who does not lead the team.

What the team measures, and what counts as green, is part of configuring its board.

#### Scenario: A leader adds a metric and its threshold

- **WHEN** the leader of a team adds a metric to its board and records a threshold version for it
- **THEN** both are recorded as the `metrics` capability requires

#### Scenario: An ordinary member cannot configure metrics

- **WHEN** a member of a team who does not lead it adds a metric, changes one, or records a threshold version
- **THEN** each request is refused with `auth.forbidden`, and nothing is changed

#### Scenario: An administrator configures any team's metrics

- **WHEN** an administrator who does not belong to a team records a threshold version for one of its metrics
- **THEN** the version is recorded

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
