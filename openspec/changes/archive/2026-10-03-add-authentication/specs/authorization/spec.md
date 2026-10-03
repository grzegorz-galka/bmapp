## Purpose

Decides whether the person a request is authenticated as may do what they are
asking. Reading is open to anyone signed in; writing is decided by one global
administrator list and by what the team records already say about membership and
leadership. There are no roles to assign.

## ADDED Requirements

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
SHALL offer registering a team only to an administrator.

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
